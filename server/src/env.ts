// Carrega server/.env (Node nativo, sem dotenv). Ausente = usa o ambiente.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(path)) process.loadEnvFile(path);

/** Número de uma variável; vazia ou inválida = sem limite (Infinity). */
function limite(name: string): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : Infinity;
}

const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");

export const env = {
  port: Number(process.env.PORT ?? 8787),
  /** Com ANTHROPIC_API_KEY, o Claude (decisão 0007); LLM_MODEL fica só para a Featherless. */
  model: process.env.ANTHROPIC_API_KEY ? (process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5") : (process.env.LLM_MODEL ?? "Qwen/Qwen3-32B"),
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 8000),
  deepgramKey: process.env.DEEPGRAM_API_KEY ?? "",
  elevenKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenVoice: process.env.ELEVENLABS_VOICE_ID ?? "",
  elevenModel: process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5",
  ttsMode: (process.env.TTS_MODE ?? "ws") as "ws" | "http",
  cacheDir: process.env.TTS_CACHE_DIR ?? fileURLToPath(new URL("../cache/tts", import.meta.url)),
  /** Sem SUPABASE_URL (dev local), o servidor não exige token e o cache de áudio fica no disco. */
  supabaseUrl,
  /** "1": exige token e não sobe sem SUPABASE_URL. "0": não exige, mesmo com Supabase (até o app fazer login, #159). */
  exigeToken: process.env.EXIGE_TOKEN === "1",
  tokenDesligado: process.env.EXIGE_TOKEN === "0",
  supabaseJwksUrl: process.env.SUPABASE_JWKS_URL || (supabaseUrl ? `${supabaseUrl}/auth/v1/.well-known/jwks.json` : ""),
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  /** Travas diárias globais por provedor pago (docs/stack.md §5.3). Vazias = sem trava. */
  limiteDiario: {
    llm: limite("LIMITE_DIARIO_LLM"),
    tts: limite("LIMITE_DIARIO_TTS"),
    stt: limite("LIMITE_DIARIO_STT"),
  },
  /** Token do bot do app da Kota (#118): o encaminhamento no Slack real (#129). Vazio = a rota responde sem_slack. */
  slackBotToken: process.env.SLACK_BOT_TOKEN ?? "",
  /** Origens aceitas pelo CORS: o app (Electron) e o Vite em dev. */
  corsOrigins: (process.env.CORS_ORIGINS ?? "app://orbis,http://localhost:5173").split(",").map((o) => o.trim()).filter(Boolean),
};
