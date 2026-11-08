// API do agente (sem estado): fala → áudio, pergunta → ponte + LLM por SSE, token do STT e áudio do TTS.
// Quem conduz a aula é a tela (src/screens/lesson), com o runner da jornada.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import Fastify, { type FastifyReply } from "fastify";
import { DEMO_PROFILES } from "../../src/journey/profile";
import type { Journey, Profile } from "../../src/journey/types";
import { loadJourney } from "../../src/journey/validate";
import { ask, type AskEvent } from "./agent/ask";
import type { ChatMessage } from "./llm";
import { env } from "./env";
import { DEEPGRAM_LISTEN_PARAMS, DEEPGRAM_LISTEN_URL, mintSttToken } from "./voice/deepgram-token";
import { isVoiceConfigError } from "./voice/errors";
import { createTtsService } from "./voice/index";
import type { TtsService } from "./voice/tts/service";

export function loadDemoJourney(): Journey {
  return loadJourney(JSON.parse(readFileSync(new URL("../../src/journey/data/tail.journey.json", import.meta.url), "utf8")));
}

/** TTS só quando há chave; sem ela o cliente cai no texto (e o servidor segue funcionando). */
export function tryCreateTts(): TtsService | null {
  if (!env.elevenKey || !env.elevenVoice) return null;
  return createTtsService({ provider: env.ttsMode, apiKey: env.elevenKey, voiceId: env.elevenVoice, modelId: env.elevenModel, cacheDir: env.cacheDir });
}

function sse(reply: FastifyReply): (ev: AskEvent) => void {
  reply.hijack();
  reply.raw.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  return (ev) => reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
}

const MAX_TEXT = 500;

export function buildApp(opts: { journey?: Journey; tts?: TtsService | null } = {}) {
  const journey = opts.journey ?? loadDemoJourney();
  const tts = opts.tts === undefined ? tryCreateTts() : opts.tts;
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  app.get("/api/health", async () => ({ ok: true, tts: !!tts, stt: !!env.deepgramKey, model: env.model }));

  /** Fala da jornada → id do áudio (do cache quando já foi gerada). */
  app.post<{ Body: { text?: string } }>("/api/speak", async (req, reply) => {
    const text = String(req.body?.text ?? "").trim().slice(0, MAX_TEXT);
    if (!tts) return reply.status(503).send({ error: "tts_unavailable" });
    if (!text) return reply.status(400).send({ error: "text_required" });
    const id = randomUUID();
    tts.start({ action_id: id, text }).catch((err) => req.log.warn({ err }, "tts failed"));
    return { id, audio_url: `/api/tts/${id}` };
  });

  /** Pergunta que a tela não resolveu: ponte na hora + LLM em streaming. */
  app.post<{ Body: { text?: string; moment_id?: string; step_id?: string; perfil?: "novo" | "transicao"; profile?: Profile; history?: ChatMessage[] } }>(
    "/api/ask",
    async (req, reply) => {
      const b = req.body ?? {};
      const text = String(b.text ?? "").trim().slice(0, MAX_TEXT);
      const moment = journey.moments.find((m) => m.id === b.moment_id);
      const step = moment?.steps.find((s) => s.id === b.step_id);
      if (!text || !moment || !step) return reply.status(400).send({ error: "text, moment_id e step_id válidos são obrigatórios" });
      const history = (b.history ?? [])
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_TEXT) }));
      const ac = new AbortController();
      reply.raw.on("close", () => { if (!reply.raw.writableFinished) ac.abort(); });
      const emit = sse(reply);
      await ask(
        { journey, profile: b.profile ?? DEMO_PROFILES[b.perfil ?? "novo"], momentId: moment.id, stepId: step.id, text, history, tts, model: env.model, timeoutMs: env.llmTimeoutMs, signal: ac.signal },
        emit,
      );
      reply.raw.end();
    },
  );

  app.post("/api/voice/token", async (_req, reply) => {
    try {
      const { token, expires_in } = await mintSttToken({ apiKey: env.deepgramKey });
      return { token, expires_in, ws_url: DEEPGRAM_LISTEN_URL, params: DEEPGRAM_LISTEN_PARAMS };
    } catch (err) {
      if (isVoiceConfigError(err)) return reply.status(503).send({ error: "voice_unavailable", message: err.message });
      throw err;
    }
  });

  /** Tempo de cada palavra de um áudio do /api/speak (contrato Voz ↔ quadro em docs/contratos.md). */
  app.get<{ Params: { id: string } }>("/api/tts/:id/words", async (req, reply) => {
    if (!tts) return reply.status(503).send({ error: "tts_unavailable" });
    const words = tts.words(req.params.id);
    if (!words) return reply.status(404).send({ error: "audio_not_found" });
    return { words: await words };
  });

  app.get<{ Params: { id: string } }>("/api/tts/:id", async (req, reply) => {
    if (!tts) return reply.status(503).send({ error: "tts_unavailable" });
    if (!tts.has(req.params.id)) return reply.status(404).send({ error: "audio_not_found" });
    const ac = new AbortController();
    reply.raw.on("close", () => { if (!reply.raw.writableFinished) ac.abort(); });
    reply.hijack();
    reply.raw.writeHead(200, { "Content-Type": "application/octet-stream", "X-Audio-Format": "pcm_s16le_24000", "Cache-Control": "no-store" });
    try {
      for await (const chunk of tts.stream(req.params.id, ac.signal)) reply.raw.write(chunk);
    } catch (err) {
      req.log.error({ err }, "tts stream failed");
    } finally {
      reply.raw.end();
    }
  });

  return app;
}
