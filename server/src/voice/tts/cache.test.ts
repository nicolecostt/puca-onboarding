import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LruTtsCache, TtsCache, TtsStorageCache, type StorageBucket, type TtsCacheStore } from "./cache";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "puca-tts-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("TtsCache", () => {
  it("returns null for a miss and the stored audio and words after put", async () => {
    const cache = new TtsCache(dir);
    const key = cache.key({ text: "Olá!", voiceId: "v", modelId: "m" });
    expect(await cache.get(key)).toBeNull();
    const audio = Buffer.from([9, 8, 7, 6]);
    const words = [{ word: "Olá!", start_ms: 0, end_ms: 300 }];
    await cache.put(key, audio, words);
    const hit = await cache.get(key);
    expect(hit?.audio.equals(audio)).toBe(true);
    expect(hit?.words).toEqual(words);
  });

  it("builds different keys for different text, voice or model and the same key for the same input", () => {
    const cache = new TtsCache(dir);
    const base = { text: "a", voiceId: "v", modelId: "m" };
    expect(cache.key(base)).toBe(cache.key({ ...base }));
    expect(cache.key(base)).not.toBe(cache.key({ ...base, text: "b" }));
    expect(cache.key(base)).not.toBe(cache.key({ ...base, voiceId: "w" }));
    expect(cache.key(base)).not.toBe(cache.key({ ...base, modelId: "n" }));
  });
});

/** Bucket do Storage na memória, com o mesmo formato de resposta do supabase-js. */
class FakeBucket implements StorageBucket {
  files = new Map<string, Buffer>();
  downloads = 0;
  async download(path: string) {
    this.downloads++;
    const f = this.files.get(path);
    return f ? { data: new Blob([new Uint8Array(f)]), error: null } : { data: null, error: new Error("Object not found") };
  }
  async upload(path: string, body: Buffer | string) {
    this.files.set(path, Buffer.from(body));
    return { error: null };
  }
}

describe("TtsStorageCache", () => {
  it("guarda e lê áudio e palavras no bucket; ausente = null", async () => {
    const bucket = new FakeBucket();
    const cache = new TtsStorageCache(bucket);
    const key = cache.key({ text: "Olá!", voiceId: "v", modelId: "m" });
    expect(await cache.get(key)).toBeNull();
    await cache.put(key, Buffer.from([1, 2, 3]), [{ word: "Olá!", start_ms: 0, end_ms: 300 }]);
    expect([...bucket.files.keys()].sort()).toEqual([`${key}.json`, `${key}.pcm`]);
    const hit = await cache.get(key);
    expect([...hit!.audio]).toEqual([1, 2, 3]);
    expect(hit!.words[0].word).toBe("Olá!");
  });

  it("falha no upload vira erro (o serviço ignora e só perde o cache)", async () => {
    const cache = new TtsStorageCache({ download: async () => ({ data: null, error: null }), upload: async () => ({ error: new Error("bucket not found") }) });
    await expect(cache.put("k", Buffer.from([1]), [])).rejects.toThrow(/tts-cache upload falhou/);
  });
});

describe("LruTtsCache", () => {
  it("serve da memória depois da primeira leitura e descarta o mais antigo acima do limite", async () => {
    const bucket = new FakeBucket();
    const inner: TtsCacheStore = new TtsStorageCache(bucket);
    const lru = new LruTtsCache(inner, 6);
    await inner.put("a", Buffer.from([1, 2, 3]), []);
    await lru.get("a");
    await lru.get("a");
    expect(bucket.downloads).toBe(2); // .pcm e .json uma vez só
    await lru.put("b", Buffer.from([4, 5, 6]), []);
    await lru.put("c", Buffer.from([7, 8, 9]), []); // passa de 6 bytes: "a" sai da memória
    await lru.get("a");
    expect(bucket.downloads).toBe(4);
  });
});
