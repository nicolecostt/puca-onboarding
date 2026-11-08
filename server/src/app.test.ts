// Contrato "API do servidor" (docs/contratos.md): token do Supabase, limite por pessoa, travas diárias e CORS.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, loadDemoJourney, perfilSeguro } from "./app";
import { criaVerificaToken, type VerificaToken } from "./auth";
import { TtsCache } from "./voice/tts/cache";
import { TtsService } from "./voice/tts/service";
import type { TtsChunk, TtsProvider } from "./voice/tts/types";

const SUPABASE = "https://kota-teste.supabase.co";
let privateKey: CryptoKey;
let verifica: VerificaToken;
let dir: string;

beforeAll(async () => {
  const pair = await generateKeyPair("ES256");
  privateKey = pair.privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "ES256" };
  verifica = criaVerificaToken({ supabaseUrl: SUPABASE, jwksUrl: "", keys: createLocalJWKSet({ keys: [jwk] }) });
  dir = await mkdtemp(join(tmpdir(), "puca-app-"));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function token(sub: string, o: { aud?: string; iss?: string; exp?: string; nome?: string } = {}) {
  return new SignJWT({ user_metadata: o.nome ? { nome: o.nome } : {} })
    .setProtectedHeader({ alg: "ES256", kid: "k1" })
    .setSubject(sub)
    .setAudience(o.aud ?? "authenticated")
    .setIssuer(o.iss ?? `${SUPABASE}/auth/v1`)
    .setIssuedAt()
    .setExpirationTime(o.exp ?? "1h")
    .sign(privateKey);
}

const journey = loadDemoJourney();
const moment = journey.moments[0];
const askBody = { text: "o que é isso?", moment_id: moment.id, step_id: moment.steps[0].id };
const mintSttToken = async () => ({ token: "dg-temp", expires_in: 30 });

class FakeProvider implements TtsProvider {
  async *synthesize(): AsyncGenerator<TtsChunk> {
    yield { audio: Buffer.from([1, 2, 3, 4]), chars: [..."Oi"].map((char, i) => ({ char, start_ms: i * 10, end_ms: i * 10 + 10 })) };
  }
}
const fakeTts = () => new TtsService({ provider: new FakeProvider(), cache: new TtsCache(dir), voiceId: "v", modelId: "m" });

describe("token do Supabase", () => {
  it("confere assinatura, emissor e audiência e devolve a pessoa", async () => {
    expect(await verifica(await token("p1", { nome: "Ana" }))).toEqual({ id: "p1", nome: "Ana" });
    expect(await verifica(await token("p1", { aud: "anon" }))).toBeNull();
    expect(await verifica(await token("p1", { iss: "https://outro.supabase.co/auth/v1" }))).toBeNull();
    expect(await verifica(await token("p1", { exp: "-1m" }))).toBeNull();
    expect(await verifica("nao-e-um-jwt")).toBeNull();
  });

  it("exige o token em toda rota menos /api/health", async () => {
    const app = buildApp({ journey, tts: null, verificaToken: verifica, mintSttToken });
    expect((await app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
    const sem = await app.inject({ method: "POST", url: "/api/voice/token" });
    expect(sem.statusCode).toBe(401);
    expect(sem.json()).toEqual({ error: "unauthorized" });
    expect((await app.inject({ method: "POST", url: "/api/voice/token", headers: { authorization: "Bearer lixo" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/tts/x" })).statusCode).toBe(401);
    const com = await app.inject({ method: "POST", url: "/api/voice/token", headers: { authorization: `Bearer ${await token("p1")}` } });
    expect(com.statusCode).toBe(200);
    expect(com.json().token).toBe("dg-temp");
    await app.close();
  });

  it("sem Supabase configurado (dev local), não exige token", async () => {
    const app = buildApp({ journey, tts: null, verificaToken: null, mintSttToken });
    expect((await app.inject({ method: "POST", url: "/api/voice/token" })).statusCode).toBe(200);
    await app.close();
  });
});

describe("limite por pessoa", () => {
  it("passa de 20 tokens de voz por minuto: 429 só para quem passou", async () => {
    const app = buildApp({ journey, tts: null, verificaToken: verifica, mintSttToken });
    const ana = { authorization: `Bearer ${await token("ana")}` };
    for (let i = 0; i < 20; i++) expect((await app.inject({ method: "POST", url: "/api/voice/token", headers: ana })).statusCode).toBe(200);
    const passou = await app.inject({ method: "POST", url: "/api/voice/token", headers: ana });
    expect(passou.statusCode).toBe(429);
    expect(passou.json().error).toBe("rate_limited");
    const bruno = { authorization: `Bearer ${await token("bruno")}` };
    expect((await app.inject({ method: "POST", url: "/api/voice/token", headers: bruno })).statusCode).toBe(200);
    await app.close();
  });
});

describe("limite por IP (sem token)", () => {
  it("conta pelo Fly-Client-IP: trocar o X-Forwarded-For não zera o limite", async () => {
    const app = buildApp({ journey, tts: null, verificaToken: null, mintSttToken });
    const req = (i: number) => app.inject({ method: "POST", url: "/api/voice/token", headers: { "fly-client-ip": "1.2.3.4", "x-forwarded-for": `9.9.9.${i}` } });
    for (let i = 0; i < 20; i++) expect((await req(i)).statusCode).toBe(200);
    expect((await req(99)).statusCode).toBe(429);
    await app.close();
  });
});

describe("travas diárias", () => {
  it("LLM: passou do limite do dia, /api/ask responde 503 limite_diario sem chamar o LLM", async () => {
    const app = buildApp({ journey, tts: null, verificaToken: null, limiteDiario: { llm: 0 } });
    const r = await app.inject({ method: "POST", url: "/api/ask", payload: askBody });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ error: "limite_diario" });
    await app.close();
  });

  it("STT: depois do limite, /api/voice/token recusa", async () => {
    const app = buildApp({ journey, tts: null, verificaToken: null, limiteDiario: { stt: 2 }, mintSttToken });
    expect((await app.inject({ method: "POST", url: "/api/voice/token" })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/voice/token" })).statusCode).toBe(200);
    const r = await app.inject({ method: "POST", url: "/api/voice/token" });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ error: "limite_diario" });
    await app.close();
  });

  it("TTS: conta só o sintetizado; esgotada, recusa fala nova, serve a do cache e /api/health diz tts: false", async () => {
    const tts = fakeTts();
    const app = buildApp({ journey, tts, verificaToken: null, limiteDiario: { tts: 14 } });
    expect((await app.inject({ method: "GET", url: "/api/health" })).json().tts).toBe(true);
    const primeira = await app.inject({ method: "POST", url: "/api/speak", payload: { text: "Olá, tudo bem?" } });
    expect(primeira.statusCode).toBe(200);
    await tts.words(primeira.json().id); // síntese pronta: 14 caracteres, chegou ao limite
    await tts.flush(); // e já gravada no cache
    const nova = await app.inject({ method: "POST", url: "/api/speak", payload: { text: "mais uma fala" } });
    expect(nova.statusCode).toBe(503);
    expect(nova.json()).toEqual({ error: "limite_diario" });
    expect((await app.inject({ method: "POST", url: "/api/speak", payload: { text: "Olá, tudo bem?" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/health" })).json().tts).toBe(false);
    await app.close();
  });
});

describe("perfil vindo do app", () => {
  it("só passa campos conhecidos, curtos, e vínculo válido", () => {
    const p = perfilSeguro({ nome: "Ana".repeat(1000), time: 42, vinculo: "admin", extra: "x" }, "novo");
    expect(p.nome.length).toBe(120);
    expect(p.time).toBeUndefined();
    expect(p.vinculo).toBe("novo");
    expect("extra" in p).toBe(false);
    expect(perfilSeguro(undefined, "transicao").vinculo).toBe("transicao");
  });
});

describe("CORS", () => {
  it("aceita o app e o Vite; recusa outra origem", async () => {
    const app = buildApp({ journey, tts: null, verificaToken: verifica });
    const preflight = (origin: string) =>
      app.inject({ method: "OPTIONS", url: "/api/ask", headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" } });
    expect((await preflight("app://orbis")).headers["access-control-allow-origin"]).toBe("app://orbis");
    expect((await preflight("http://localhost:5173")).headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect((await preflight("https://evil.example")).headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });

  it("o áudio (resposta crua) também leva o cabeçalho do CORS, com token", async () => {
    const app = buildApp({ journey, tts: fakeTts(), verificaToken: verifica });
    const headers = { origin: "app://orbis", authorization: `Bearer ${await token("p1")}` };
    const speak = await app.inject({ method: "POST", url: "/api/speak", payload: { text: "Oi" }, headers });
    expect(speak.statusCode).toBe(200);
    const audio = await app.inject({ method: "GET", url: speak.json().audio_url, headers });
    expect(audio.statusCode).toBe(200);
    expect(audio.headers["access-control-allow-origin"]).toBe("app://orbis");
    expect([...audio.rawPayload]).toEqual([1, 2, 3, 4]);
    await app.close();
  });
});

describe("POST /api/encaminhamentos (#129)", () => {
  const corpo = {
    id: "f1",
    destino: "buddy",
    para: "Beatriz Cavalcanti",
    pergunta: "Quem cuida do ledgermonolith?",
    resumo: "Quem cuida do ledgermonolith?",
    fontes_consultadas: ["ADR 6"],
    motivo: "Não há responsável confirmado.",
    email: "jurado@exemplo.com",
  };
  const enviou = { enviado: true as const, canal: "D1", ts: "1.2", link: "https://kota.slack.com/archives/D1/p12" };

  it("manda ao encaminhador e devolve o resultado", async () => {
    const recebidos: unknown[] = [];
    const app = buildApp({ journey, tts: null, verificaToken: null, encaminhar: async (p) => (recebidos.push(p), enviou) });
    const r = await app.inject({ method: "POST", url: "/api/encaminhamentos", payload: corpo });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual(enviou);
    expect(recebidos).toEqual([corpo]);
    await app.close();
  });

  it("corpo inválido: 400, e o encaminhador não é chamado", async () => {
    let chamou = false;
    const app = buildApp({ journey, tts: null, verificaToken: null, encaminhar: async () => ((chamou = true), enviou) });
    const r = await app.inject({ method: "POST", url: "/api/encaminhamentos", payload: { ...corpo, pergunta: "" } });
    expect(r.statusCode).toBe(400);
    expect(r.json()).toEqual({ error: "pedido_invalido" });
    expect(chamou).toBe(false);
    await app.close();
  });

  it("sem SLACK_BOT_TOKEN: 503 sem_slack", async () => {
    const app = buildApp({ journey, tts: null, verificaToken: null, encaminhar: null });
    const r = await app.inject({ method: "POST", url: "/api/encaminhamentos", payload: corpo });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toEqual({ enviado: false, motivo: "sem_slack" });
    await app.close();
  });

  it("falha do Slack: 502, sem vazar o erro", async () => {
    const app = buildApp({ journey, tts: null, verificaToken: null, encaminhar: async () => Promise.reject(new Error("Slack chat.postMessage: not_in_channel")) });
    const r = await app.inject({ method: "POST", url: "/api/encaminhamentos", payload: corpo });
    expect(r.statusCode).toBe(502);
    expect(r.json()).toEqual({ error: "slack_falhou" });
    await app.close();
  });

  it("com token exigido, sem token: 401", async () => {
    const app = buildApp({ journey, tts: null, verificaToken: verifica, encaminhar: async () => enviou });
    const r = await app.inject({ method: "POST", url: "/api/encaminhamentos", payload: corpo });
    expect(r.statusCode).toBe(401);
    await app.close();
  });
});

describe("POST /api/conversas/resumo", () => {
  const url = "/api/conversas/resumo";
  const payload = { falas: [{ role: "user", content: "Onde está a primeira tarefa?" }] };
  const criarApp = (texto: string, limite = 1) => buildApp({
    journey, tts: null, verificaToken: null, limiteDiario: { llm: limite },
    async *streamResumo(req) {
      expect(req.model).toBe("claude-haiku-5-5");
      expect(req.messages.at(-1)?.content).toBe(JSON.stringify(payload.falas));
      yield { type: "text", text: texto };
      yield { type: "done", finishReason: "end_turn" };
    },
  });

  const resumo = '{"topicos":["A pessoa perguntou pela primeira tarefa."]}';

  it.each([
    ["JSON puro", resumo],
    ["JSON entre cercas", `\n\`\`\`json\n${resumo}\n\`\`\`\n`],
  ])("aceita %s na saída do Haiku e aplica a trava diária", async (_formato, texto) => {
    const app = criarApp(texto);
    try {
      const ok = await app.inject({ method: "POST", url, payload });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toEqual({ topicos: ["A pessoa perguntou pela primeira tarefa."] });
      const limite = await app.inject({ method: "POST", url, payload });
      expect(limite.statusCode).toBe(503);
      expect(limite.json()).toEqual({ error: "limite_diario" });
    } finally {
      await app.close();
    }
  });

  it("rejeita pedidos inválidos ou grandes demais e trata uma saída inválida do Haiku", async () => {
    const app = criarApp('{"topicos":[]}');
    try {
      const invalido = await app.inject({ method: "POST", url, payload: { falas: [null] } });
      expect(invalido.statusCode).toBe(400);
      const grande = await app.inject({
        method: "POST", url, payload: { falas: [{ role: "user", content: "a".repeat(256 * 1024) }] },
      });
      expect(grande.statusCode).toBe(413);
      const falha = await app.inject({ method: "POST", url, payload });
      expect(falha.statusCode).toBe(503);
      expect(falha.json()).toEqual({ error: "resumo_indisponivel" });
    } finally {
      await app.close();
    }
  });
});
