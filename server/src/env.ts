// Carrega server/.env (Node nativo, sem dotenv). Ausente = usa o ambiente.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(path)) process.loadEnvFile(path);

export const env = {
  port: Number(process.env.PORT ?? 8787),
  model: process.env.LLM_MODEL ?? "Qwen/Qwen3-32B",
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 8000),
  deepgramKey: process.env.DEEPGRAM_API_KEY ?? "",
  elevenKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenVoice: process.env.ELEVENLABS_VOICE_ID ?? "",
  elevenModel: process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5",
  ttsMode: (process.env.TTS_MODE ?? "ws") as "ws" | "http",
  cacheDir: process.env.TTS_CACHE_DIR ?? fileURLToPath(new URL("../cache/tts", import.meta.url)),
};
