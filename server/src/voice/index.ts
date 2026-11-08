import { createClient } from "@supabase/supabase-js";
import { LruTtsCache, TtsCache, TtsStorageCache, type StorageBucket, type TtsCacheStore } from "./tts/cache";
import { ElevenLabsHttpProvider } from "./tts/elevenlabs-http";
import { ElevenLabsWsProvider } from "./tts/elevenlabs-ws";
import { TtsService } from "./tts/service";
import type { TtsProvider } from "./tts/types";
import { VoiceConfigError } from "./errors";

export interface CreateTtsServiceOptions {
  provider: "http" | "ws";
  apiKey: string;
  voiceId: string;
  modelId: string;
  cacheDir: string;
  /** Com Supabase, o cache vai para o Storage (bucket privado `tts-cache`); sem, fica no disco. */
  storage?: { url: string; serviceKey: string };
}

export const TTS_BUCKET = "tts-cache";
/** Áudios mais usados na memória, na frente do Storage (~20 min de fala em PCM 24 kHz). */
const LRU_BYTES = 128 * 1024 * 1024;

/** Bucket do cache de áudio; cria o bucket privado na primeira gravação, se ainda não existir. */
function storageBucket(url: string, serviceKey: string): StorageBucket {
  const storage = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  const bucket = storage.from(TTS_BUCKET);
  let ready: Promise<void> | null = null;
  const ensure = () =>
    (ready ??= storage.getBucket(TTS_BUCKET).then(async ({ error }) => {
      if (!error) return;
      const created = await storage.createBucket(TTS_BUCKET, { public: false });
      if (created.error && !/already exists/i.test(created.error.message)) {
        ready = null;
        throw created.error;
      }
    }));
  return {
    download: (path) => bucket.download(path),
    upload: async (path, body, opts) => {
      await ensure();
      return bucket.upload(path, body, opts);
    },
  };
}

function createCache(opts: CreateTtsServiceOptions): TtsCacheStore {
  if (!opts.storage) return new TtsCache(opts.cacheDir);
  return new LruTtsCache(new TtsStorageCache(storageBucket(opts.storage.url, opts.storage.serviceKey)), LRU_BYTES);
}

/** Monta o serviço de TTS. No modo `ws` já abre o socket reserva. */
export function createTtsService(opts: CreateTtsServiceOptions): TtsService {
  if (!opts.apiKey) throw new VoiceConfigError("ELEVENLABS_API_KEY is not set");
  if (!opts.voiceId) throw new VoiceConfigError("ELEVENLABS_VOICE_ID is not set");
  const base = { apiKey: opts.apiKey, voiceId: opts.voiceId, modelId: opts.modelId };
  const provider: TtsProvider = opts.provider === "ws" ? new ElevenLabsWsProvider(base) : new ElevenLabsHttpProvider(base);
  provider.warm?.();
  return new TtsService({ provider, cache: createCache(opts), voiceId: opts.voiceId, modelId: opts.modelId });
}
