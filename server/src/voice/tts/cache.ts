import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { WordTiming } from "../../../../src/voice/types";

export interface TtsCacheEntry {
  audio: Buffer;
  words: WordTiming[];
}

/** Onde o áudio sintetizado fica guardado, pela chave hash(texto, voz, modelo). Pode ser apagado a qualquer hora. */
export interface TtsCacheStore {
  key(parts: { text: string; voiceId: string; modelId: string }): string;
  get(key: string): Promise<TtsCacheEntry | null>;
  put(key: string, audio: Buffer, words: WordTiming[]): Promise<void>;
}

export function ttsCacheKey(parts: { text: string; voiceId: string; modelId: string }): string {
  return createHash("sha256").update(JSON.stringify([parts.text, parts.voiceId, parts.modelId])).digest("hex").slice(0, 32);
}

/** Cache em disco (dev local, sem Supabase). */
export class TtsCache implements TtsCacheStore {
  constructor(private readonly dir: string) {}

  key(parts: { text: string; voiceId: string; modelId: string }): string {
    return ttsCacheKey(parts);
  }

  async get(key: string): Promise<TtsCacheEntry | null> {
    try {
      const [audio, meta] = await Promise.all([readFile(join(this.dir, `${key}.pcm`)), readFile(join(this.dir, `${key}.json`), "utf8")]);
      return { audio, words: JSON.parse(meta) as WordTiming[] };
    } catch {
      return null;
    }
  }

  async put(key: string, audio: Buffer, words: WordTiming[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await Promise.all([writeFile(join(this.dir, `${key}.pcm`), audio), writeFile(join(this.dir, `${key}.json`), JSON.stringify(words))]);
  }
}

/** O pedaço do cliente do Supabase Storage que o cache usa (um bucket). */
export interface StorageBucket {
  download(path: string): Promise<{ data: Blob | null; error: unknown }>;
  upload(path: string, body: Buffer | string, opts: { upsert: boolean; contentType: string }): Promise<{ error: unknown }>;
}

/** Cache no Supabase Storage (bucket privado `tts-cache`): sobrevive a deploy e a troca de máquina. */
export class TtsStorageCache implements TtsCacheStore {
  constructor(private readonly bucket: StorageBucket) {}

  key(parts: { text: string; voiceId: string; modelId: string }): string {
    return ttsCacheKey(parts);
  }

  async get(key: string): Promise<TtsCacheEntry | null> {
    try {
      const [audio, meta] = await Promise.all([this.bucket.download(`${key}.pcm`), this.bucket.download(`${key}.json`)]);
      if (audio.error || meta.error || !audio.data || !meta.data) return null;
      return { audio: Buffer.from(await audio.data.arrayBuffer()), words: JSON.parse(await meta.data.text()) as WordTiming[] };
    } catch {
      return null;
    }
  }

  async put(key: string, audio: Buffer, words: WordTiming[]): Promise<void> {
    const opts = (contentType: string) => ({ upsert: true, contentType });
    const [a, m] = await Promise.all([
      this.bucket.upload(`${key}.pcm`, audio, opts("application/octet-stream")),
      this.bucket.upload(`${key}.json`, JSON.stringify(words), opts("application/json")),
    ]);
    if (a.error || m.error) throw new Error(`tts-cache upload falhou: ${String((a.error ?? m.error) as unknown)}`.slice(0, 200));
  }
}

/** Guarda na memória os áudios mais usados (até `maxBytes`) na frente de outro cache. */
export class LruTtsCache implements TtsCacheStore {
  private readonly entries = new Map<string, TtsCacheEntry>();
  private bytes = 0;

  constructor(
    private readonly inner: TtsCacheStore,
    private readonly maxBytes: number,
  ) {}

  key(parts: { text: string; voiceId: string; modelId: string }): string {
    return this.inner.key(parts);
  }

  async get(key: string): Promise<TtsCacheEntry | null> {
    const hit = this.entries.get(key);
    if (hit) {
      this.entries.delete(key);
      this.entries.set(key, hit); // vira o mais recente
      return hit;
    }
    const entry = await this.inner.get(key);
    if (entry) this.remember(key, entry);
    return entry;
  }

  async put(key: string, audio: Buffer, words: WordTiming[]): Promise<void> {
    this.remember(key, { audio, words });
    await this.inner.put(key, audio, words);
  }

  private remember(key: string, entry: TtsCacheEntry): void {
    const old = this.entries.get(key);
    if (old) {
      this.bytes -= old.audio.length;
      this.entries.delete(key);
    }
    if (entry.audio.length > this.maxBytes) return;
    this.entries.set(key, entry);
    this.bytes += entry.audio.length;
    for (const [k, e] of this.entries) {
      if (this.bytes <= this.maxBytes) break;
      this.entries.delete(k);
      this.bytes -= e.audio.length;
    }
  }
}
