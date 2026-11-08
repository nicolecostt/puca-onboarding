// API do agente (sem estado): fala → áudio, pergunta → ponte + LLM por SSE, token do STT e áudio do TTS.
// A tela guarda onde a sessão está; o LLM conduz cada turno pelo /api/turn (decisão 0012), e o /api/ask fica
// para o roteiro (plano B, sem LLM).
// Contrato "API do servidor" em docs/contratos.md: token do Supabase, limites por pessoa, travas diárias e CORS.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { lerPedidoDeEncaminhamento, type PedidoDeEncaminhamento, type ResultadoDoEncaminhamento } from "../../src/journey/encaminhamento-slack";
import { createEncaminhador, slackDmDeVerdade } from "./slack/encaminhar";
import Fastify, { type FastifyReply } from "fastify";
import { DEMO_PROFILES } from "../../src/journey/profile";
import type { Journey, Profile } from "../../src/journey/types";
import { loadJourney } from "../../src/journey/validate";
import { ask, type AskEvent } from "./agent/ask";
import { carregarBrain, type Brain } from "./brain/brain";
import { notionDaKota } from "./agent/kota";
import { turn, type TurnEvent, type TurnKind } from "./agent/turn";
import { CAMPOS_DA_CALL, TEMAS_DE_CULTURA, callTurn, type CallEvent, type CampoDaCall } from "./agent/call";
import { bearer, criaVerificaToken, type VerificaToken } from "./auth";
import type { ChatMessage } from "./llm";
import { env } from "./env";
import { TravaDiaria } from "./trava-diaria";
import { DEEPGRAM_LISTEN_PARAMS, DEEPGRAM_LISTEN_URL, mintSttToken } from "./voice/deepgram-token";
import { isVoiceConfigError } from "./voice/errors";
import { createTtsService } from "./voice/index";
import type { TtsService } from "./voice/tts/service";

export function loadDemoJourney(): Journey {
  return loadJourney(JSON.parse(readFileSync(new URL("../../src/journey/data/kota.journey.json", import.meta.url), "utf8")));
}

/** TTS só quando há chave; sem ela o cliente cai no texto (e o servidor segue funcionando). */
export function tryCreateTts(): TtsService | null {
  if (!env.elevenKey || !env.elevenVoice) return null;
  const storage = env.supabaseUrl && env.supabaseServiceKey ? { url: env.supabaseUrl, serviceKey: env.supabaseServiceKey } : undefined;
  return createTtsService({ provider: env.ttsMode, apiKey: env.elevenKey, voiceId: env.elevenVoice, modelId: env.elevenModel, cacheDir: env.cacheDir, storage });
}

/** Verificador do token do Supabase; null sem SUPABASE_URL (dev local: nenhuma rota exige token). */
export function tryCreateVerificaToken(): VerificaToken | null {
  // no Fly (EXIGE_TOKEN=1), subir sem Supabase deixaria o servidor aberto: melhor não subir
  if (env.exigeToken && !env.supabaseUrl) throw new Error("EXIGE_TOKEN=1 sem SUPABASE_URL: o servidor ficaria sem login");
  if (!env.supabaseUrl || env.tokenDesligado) return null;
  return criaVerificaToken({ supabaseUrl: env.supabaseUrl, jwksUrl: env.supabaseJwksUrl });
}

/** Resposta crua (SSE, áudio) levando os cabeçalhos que os plugins já puseram (CORS, limite). */
function writeHead(reply: FastifyReply, headers: Record<string, string>): void {
  reply.hijack();
  reply.raw.writeHead(200, { ...(reply.getHeaders() as Record<string, string>), ...headers });
}

function sse(reply: FastifyReply): (ev: AskEvent | TurnEvent | CallEvent) => void {
  writeHead(reply, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  return (ev) => reply.raw.write(`data: ${JSON.stringify(ev)}\n\n`);
}

const MAX_TEXT = 500;
const MAX_CAMPO_PERFIL = 120;

/** Perfil que veio do app: só os campos conhecidos, texto curto e vínculo válido (o servidor é público). */
export function perfilSeguro(p: unknown, perfil: string | undefined): Profile {
  const base = DEMO_PROFILES[perfil === "transicao" ? "transicao" : "novo"];
  if (!p || typeof p !== "object") return base;
  const o = p as Record<string, unknown>;
  const campo = (k: string) => (typeof o[k] === "string" ? (o[k] as string).slice(0, MAX_CAMPO_PERFIL) : undefined);
  return {
    nome: campo("nome") || base.nome,
    cargo: campo("cargo"),
    time: campo("time"),
    gestor: campo("gestor"),
    ferramentas: campo("ferramentas"),
    aprender: campo("aprender"),
    vinculo: o.vinculo === "transicao" ? "transicao" : "novo",
  };
}

/** Limite por pessoa de cada rota (docs/stack.md §5.3). */
const POR_MINUTO = (max: number) => ({ rateLimit: { max, timeWindow: "1 minute" } });

export interface BuildAppOptions {
  journey?: Journey;
  tts?: TtsService | null;
  /** Verificador do token; null = não exige token. Padrão: pelo SUPABASE_URL do ambiente. */
  verificaToken?: VerificaToken | null;
  /** Travas diárias globais; padrão: LIMITE_DIARIO_* do ambiente. */
  limiteDiario?: { llm?: number; tts?: number; stt?: number };
  corsOrigins?: string[];
  /** Conhecimento da empresa para o turno; padrão: o Notion da Kota do kit. */
  knowledge?: string;
  /** Para testes: substitui a geração do token do Deepgram. */
  mintSttToken?: typeof mintSttToken;
  /** Company brain; padrão: carregado do kit da Kota em process.cwd() (sem kit, sobe sem brain). */
  brain?: Brain;
  /** Encaminhamento no Slack da Kota (#129); null = sem Slack. Padrão: pelo SLACK_BOT_TOKEN do ambiente. */
  encaminhar?: ((p: PedidoDeEncaminhamento) => Promise<ResultadoDoEncaminhamento>) | null;
}

export function tryCreateEncaminhador(): ((p: PedidoDeEncaminhamento) => Promise<ResultadoDoEncaminhamento>) | null {
  return env.slackBotToken ? createEncaminhador(slackDmDeVerdade(env.slackBotToken)) : null;
}

export function buildApp(opts: BuildAppOptions = {}) {
  const journey = opts.journey ?? loadDemoJourney();
  const knowledge = opts.knowledge ?? notionDaKota();
  // há LLM configurado: a tela deixa o LLM conduzir a sessão (decisão 0012)
  const llmKey = !!(process.env.ANTHROPIC_API_KEY || process.env.FEATHERLESS_API_KEY);
  const tts = opts.tts === undefined ? tryCreateTts() : opts.tts;
  const verificaToken = opts.verificaToken === undefined ? tryCreateVerificaToken() : opts.verificaToken;
  const limites = { ...env.limiteDiario, ...opts.limiteDiario };
  const trava = { llm: new TravaDiaria(limites.llm), tts: new TravaDiaria(limites.tts), stt: new TravaDiaria(limites.stt) };
  tts?.limitarCom(trava.tts); // vale também para as frases do /api/ask
  const mintToken = opts.mintSttToken ?? mintSttToken;
  const encaminhar = opts.encaminhar === undefined ? tryCreateEncaminhador() : opts.encaminhar;
  // trustProxy: atrás do proxy do Fly, o IP da pessoa vem no X-Forwarded-For
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, trustProxy: true });
  let brain = opts.brain;
  if (!brain) {
    try {
      brain = carregarBrain(process.cwd());
      app.log.info({ trechos: brain.total }, "brain carregado");
    } catch (err) {
      app.log.warn({ err }, "brain sem kit da Kota: o /api/ask responde sem trechos");
    }
  }

  app.register(cors, { origin: opts.corsOrigins ?? env.corsOrigins, methods: ["GET", "POST"], allowedHeaders: ["Authorization", "Content-Type"] });

  // Token do Supabase em toda rota, menos /api/health e o preflight do CORS.
  app.addHook("onRequest", async (req, reply) => {
    if (!verificaToken || req.method === "OPTIONS" || req.routeOptions.url === "/api/health") return;
    const token = bearer(req.headers.authorization);
    const pessoa = token ? await verificaToken(token) : null;
    if (!pessoa) return reply.status(401).send({ error: "unauthorized" });
    req.pessoa = pessoa;
  });

  // Limite por pessoa (depois do token, para contar pelo id dela; sem token, pelo IP).
  app.register(rateLimit, {
    global: false,
    hook: "preHandler",
    // sem token, pelo IP que o proxy do Fly grava (o X-Forwarded-For o cliente consegue forjar)
    keyGenerator: (req) => req.pessoa?.id ?? String(req.headers["fly-client-ip"] ?? req.ip),
    errorResponseBuilder: (_req, ctx) => ({ statusCode: 429, error: "rate_limited", retry_after_ms: ctx.ttl }),
  });

  app.register(async (api) => {
    api.get("/api/health", async () => ({ ok: true, tts: !!tts && !trava.tts.esgotada(), stt: !!env.deepgramKey && !trava.stt.esgotada(), llm: llmKey && !trava.llm.esgotada(), model: env.model }));

    /** Fala da jornada → id do áudio (do cache quando já foi gerada). */
    api.post<{ Body: { text?: string } }>("/api/speak", { config: POR_MINUTO(120) }, async (req, reply) => {
      const text = String(req.body?.text ?? "").trim().slice(0, MAX_TEXT);
      if (!tts) return reply.status(503).send({ error: "tts_unavailable" });
      if (!text) return reply.status(400).send({ error: "text_required" });
      // trava esgotada: só sai o que já está no cache (não custa nada)
      if (trava.tts.esgotada() && !(await tts.cached(text))) return reply.status(503).send({ error: "limite_diario" });
      const id = randomUUID();
      tts.start({ action_id: id, text }).catch((err) => req.log.warn({ err }, "tts failed"));
      return { id, audio_url: `/api/tts/${id}` };
    });

    /** Encaminhamento no Slack da Kota: mensagem direta ao próprio jurado (#129, docs/contratos.md). */
    api.post("/api/encaminhamentos", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (req, reply) => {
      if (!encaminhar) return reply.status(503).send({ enviado: false, motivo: "sem_slack" });
      const pedido = lerPedidoDeEncaminhamento(req.body);
      if (!pedido) return reply.status(400).send({ error: "pedido_invalido" });
      try {
        const r = await encaminhar(pedido);
        req.log.info({ id: pedido.id, enviado: r.enviado }, "encaminhamento");
        return r;
      } catch (err) {
        req.log.warn({ err, id: pedido.id }, "encaminhamento falhou");
        return reply.status(502).send({ error: "slack_falhou" });
      }
    });

    /** Pergunta que a tela não resolveu: ponte na hora + LLM em streaming. */
    api.post<{ Body: { text?: string; moment_id?: string; step_id?: string; perfil?: "novo" | "transicao"; profile?: Profile; history?: ChatMessage[] } }>(
      "/api/ask",
      { config: POR_MINUTO(30) },
      async (req, reply) => {
        const b = req.body ?? {};
        const text = String(b.text ?? "").trim().slice(0, MAX_TEXT);
        const moment = journey.moments.find((m) => m.id === b.moment_id);
        const step = moment?.steps.find((s) => s.id === b.step_id);
        if (!text || !moment || !step) return reply.status(400).send({ error: "text, moment_id e step_id válidos são obrigatórios" });
        // passou da trava: a tela responde como sem servidor (ponte e rotas locais, sem encaminhamento)
        if (!trava.llm.usa()) return reply.status(503).send({ error: "limite_diario" });
        const history = (b.history ?? [])
          .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_TEXT) }));
        const ac = new AbortController();
        reply.raw.on("close", () => { if (!reply.raw.writableFinished) ac.abort(); });
        const emit = sse(reply);
        const timing = await ask(
          { journey, profile: perfilSeguro(b.profile, b.perfil), momentId: moment.id, stepId: step.id, text, history, tts, model: env.model, timeoutMs: env.llmTimeoutMs, signal: ac.signal, brain },
          emit,
        );
        reply.raw.end();
        // custo da sessão (#52): auditável mesmo quando a pessoa interrompe; nunca leva o texto da pessoa
        req.log.info({ moment: moment.id, step: step.id, pessoa: req.pessoa?.id, timing }, "ask");
      },
    );

    /** Um turno da sessão conduzido pelo LLM (contrato "Turno da sessão"). */
    api.post<{
      Body: { kind?: string; text?: string; moment_id?: string; step_id?: string; perfil?: "novo" | "transicao"; profile?: Profile; history?: ChatMessage[]; interrupted?: { said?: string } };
    }>("/api/turn", { config: POR_MINUTO(60) }, async (req, reply) => {
      const b = req.body ?? {};
      const kind = (["inicio", "seguir", "fala", "silencio"] as const).find((k) => k === b.kind) as TurnKind | undefined;
      const text = String(b.text ?? "").trim().slice(0, MAX_TEXT);
      const moment = journey.moments.find((m) => m.id === b.moment_id);
      const step = moment?.steps.find((s) => s.id === b.step_id);
      if (!kind || !moment || !step || (kind === "fala" && !text)) return reply.status(400).send({ error: "kind, moment_id e step_id válidos são obrigatórios (e text numa fala)" });
      if (!trava.llm.usa()) return reply.status(503).send({ error: "limite_diario" });
      const history = (b.history ?? [])
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_TEXT) }));
      const said = typeof b.interrupted?.said === "string" ? b.interrupted.said.slice(0, MAX_TEXT) : undefined;
      const ac = new AbortController();
      reply.raw.on("close", () => { if (!reply.raw.writableFinished) ac.abort(); });
      const emit = sse(reply);
      const timing = await turn(
        { journey, knowledge, profile: perfilSeguro(b.profile, b.perfil), momentId: moment.id, stepId: step.id, kind, text, interrupted: said, history, tts, model: env.model, timeoutMs: Math.max(env.llmTimeoutMs, 15000), signal: ac.signal },
        emit,
      );
      reply.raw.end();
      req.log.info({ kind, moment: moment.id, step: step.id, pessoa: req.pessoa?.id, timing }, "turn");
    });

    /** Um turno da call inicial conduzida pelo LLM (contrato "Call inicial"). */
    api.post<{
      Body: { kind?: string; text?: string; history?: ChatMessage[]; interrupted?: { said?: string }; admissao?: Record<string, unknown>; anotado?: Record<string, unknown>; cultura?: unknown[] };
    }>("/api/call", { config: POR_MINUTO(60) }, async (req, reply) => {
      const b = req.body ?? {};
      const kind = (["inicio", "fala", "silencio"] as const).find((k) => k === b.kind);
      const text = String(b.text ?? "").trim().slice(0, MAX_TEXT);
      if (!kind || (kind === "fala" && !text)) return reply.status(400).send({ error: "kind válido é obrigatório (e text numa fala)" });
      if (!trava.llm.usa()) return reply.status(503).send({ error: "limite_diario" });
      const curto = (v: unknown) => (typeof v === "string" ? v.slice(0, MAX_CAMPO_PERFIL) : undefined);
      const ad = b.admissao ?? {};
      const anotado: Partial<Record<CampoDaCall, string>> = {};
      for (const k of CAMPOS_DA_CALL) {
        const v = curto(b.anotado?.[k]);
        if (v) anotado[k] = v;
      }
      const history = (b.history ?? [])
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(-16)
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_TEXT) }));
      const ac = new AbortController();
      reply.raw.on("close", () => { if (!reply.raw.writableFinished) ac.abort(); });
      const emit = sse(reply);
      const timing = await callTurn(
        {
          knowledge, kind, text, history, anotado, tts, model: env.model,
          cultura: (b.cultura ?? []).filter((t): t is string => typeof t === "string" && TEMAS_DE_CULTURA.includes(t)), timeoutMs: Math.max(env.llmTimeoutMs, 15000), signal: ac.signal,
          interrupted: curto(b.interrupted?.said),
          admissao: { nome: curto(ad.nome), cargo: curto(ad.cargo), time: curto(ad.time), gestor: curto(ad.gestor) },
        },
        emit,
      );
      reply.raw.end();
      req.log.info({ kind, pessoa: req.pessoa?.id, timing }, "call");
    });

    api.post("/api/voice/token", { config: POR_MINUTO(20) }, async (_req, reply) => {
      if (!trava.stt.usa()) return reply.status(503).send({ error: "limite_diario" });
      try {
        const { token, expires_in } = await mintToken({ apiKey: env.deepgramKey });
        return { token, expires_in, ws_url: DEEPGRAM_LISTEN_URL, params: DEEPGRAM_LISTEN_PARAMS };
      } catch (err) {
        if (isVoiceConfigError(err)) return reply.status(503).send({ error: "voice_unavailable", message: err.message });
        throw err;
      }
    });

    /** Tempo de cada palavra de um áudio do /api/speak (contrato Voz ↔ quadro em docs/contratos.md). */
    api.get<{ Params: { id: string } }>("/api/tts/:id/words", async (req, reply) => {
      if (!tts) return reply.status(503).send({ error: "tts_unavailable" });
      const words = tts.words(req.params.id);
      if (!words) return reply.status(404).send({ error: "audio_not_found" });
      return { words: await words };
    });

    api.get<{ Params: { id: string } }>("/api/tts/:id", async (req, reply) => {
      if (!tts) return reply.status(503).send({ error: "tts_unavailable" });
      if (!tts.has(req.params.id)) return reply.status(404).send({ error: "audio_not_found" });
      const ac = new AbortController();
      reply.raw.on("close", () => { if (!reply.raw.writableFinished) ac.abort(); });
      writeHead(reply, { "Content-Type": "application/octet-stream", "X-Audio-Format": "pcm_s16le_24000", "Cache-Control": "no-store" });
      try {
        for await (const chunk of tts.stream(req.params.id, ac.signal)) reply.raw.write(chunk);
      } catch (err) {
        req.log.error({ err }, "tts stream failed");
      } finally {
        reply.raw.end();
      }
    });
  });

  return app;
}
