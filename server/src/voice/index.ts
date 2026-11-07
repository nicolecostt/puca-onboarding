import { TtsCache } from "./tts/cache";
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
}

/** Monta o serviço de TTS. No modo `ws` já abre o socket reserva. */
export function createTtsService(opts: CreateTtsServiceOptions): TtsService {
  if (!opts.apiKey) throw new VoiceConfigError("ELEVENLABS_API_KEY is not set");
  if (!opts.voiceId) throw new VoiceConfigError("ELEVENLABS_VOICE_ID is not set");
  const base = { apiKey: opts.apiKey, voiceId: opts.voiceId, modelId: opts.modelId };
  const provider: TtsProvider = opts.provider === "ws" ? new ElevenLabsWsProvider(base) : new ElevenLabsHttpProvider(base);
  provider.warm?.();
  return new TtsService({ provider, cache: new TtsCache(opts.cacheDir), voiceId: opts.voiceId, modelId: opts.modelId });
}
