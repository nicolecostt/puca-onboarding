import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentVoice, HEALTH_TIMEOUT_MS, REQUEST_TIMEOUT_MS, type AskHandlers, type CallRequest } from "./agent-voice";
import { PcmPlayer } from "./pcm-player";

const req: CallRequest = { kind: "inicio", history: [], admissao: {}, anotado: {}, cultura: [] };
const event = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
const fala = event({ type: "speak", text: "Olá!", audio_url: null });
const handlers = (): AskHandlers => ({ onSpeak: vi.fn(async (_text, play) => play()), onAction: vi.fn(), onGoTo: vi.fn(), onTiming: vi.fn() });

function servidor(response: (init?: RequestInit) => Promise<Response> | Response, tts = false) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => url === "/api/health"
    ? new Response(JSON.stringify({ tts, stt: false, llm: true }))
    : response(init));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("recuperação da conversa", () => {
  it.each(["cabeçalhos", "corpo"])("health que não termina os %s libera a jornada sem servidor", async (fase) => {
    vi.useFakeTimers();
    const pendente = () => new Promise<Response>(() => {});
    const fetch = vi.fn((_url: string, _init?: RequestInit) => fase === "cabeçalhos" ? pendente() : Promise.resolve(new Response(new ReadableStream())));
    vi.stubGlobal("fetch", fetch);
    const criando = createAgentVoice();
    await vi.advanceTimersByTimeAsync(HEALTH_TIMEOUT_MS);
    const voice = await criando;
    expect([voice.llm, voice.tts, voice.stt]).toEqual([false, false, false]);
    expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it.each(["", "data: {invalido}\n\n", 'data: {"type":"speak"}\n\n', 'data: {"type":"speak"'])
  ("resposta vazia ou inválida não conta como sucesso: %s", async (body) => {
    servidor(() => new Response(body));
    const voice = await createAgentVoice();
    await expect(voice.call(req, handlers())).resolves.toBe(false);
  });

  it("queda durante a leitura não conta como sucesso", async () => {
    servidor(() => new Response(new ReadableStream({ start(c) { c.error(new Error("rede caiu")); } })));
    const voice = await createAgentVoice();
    await expect(voice.call(req, handlers())).resolves.toBe(false);
  });

  it.each(["timeout", "provider_error", "empty_response", "refusal"])("erro do LLM %s continua sendo falha mesmo com fala de recuperação", async (llm_error) => {
    servidor(() => new Response(fala + event({ type: "timing", timing: { llm_error } })));
    const voice = await createAgentVoice();
    const h = handlers();
    await expect(voice.call(req, h)).resolves.toBe(false);
    expect(h.onSpeak).toHaveBeenCalledOnce();
    expect(h.onTiming).toHaveBeenCalledWith({ llm_error });
  });

  it("fala de falha do servidor não toca: a tela decide o que dizer", async () => {
    const reserva = event({ type: "speak", text: "Tive um problema.", audio_url: null, source: "fallback" });
    servidor(() => new Response(reserva + event({ type: "timing", timing: { llm_error: "timeout" } })));
    const voice = await createAgentVoice();
    const h = handlers();
    await expect(voice.call(req, h)).resolves.toBe(false);
    expect(h.onSpeak).not.toHaveBeenCalled();
  });

  it("fala válida sem timing continua compatível", async () => {
    servidor(() => new Response(fala));
    const voice = await createAgentVoice();
    await expect(voice.call(req, handlers())).resolves.toBe(true);
  });

  it("ação válida sem fala pode concluir a call", async () => {
    servidor(() => new Response(event({ type: "done" })));
    const voice = await createAgentVoice();
    const onDone = vi.fn();
    await expect(voice.call(req, { ...handlers(), onDone })).resolves.toBe(true);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it.each(["cabeçalhos", "corpo"])("conversa pendurada nos %s libera a recuperação", async (fase) => {
    vi.useFakeTimers();
    const fetch = servidor(() => fase === "cabeçalhos" ? new Promise(() => {}) : new Response(new ReadableStream()));
    const voice = await createAgentVoice();
    const call = voice.call(req, handlers());
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await expect(call).resolves.toBe(false);
    expect(fetch.mock.calls[1][1]?.signal?.aborted).toBe(true);
  });

  it("o limite da rede não corta uma fala longa depois de receber o SSE inteiro", async () => {
    vi.useFakeTimers();
    const fetch = servidor(() => new Response(fala));
    const voice = await createAgentVoice();
    let terminou!: () => void;
    const call = voice.call(req, { ...handlers(), onSpeak: () => new Promise((resolve) => { terminou = resolve; }) });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1000);
    expect(fetch.mock.calls[1][1]?.signal?.aborted).toBe(false);
    terminou();
    await expect(call).resolves.toBe(true);
  });

  it("parar uma conversa pendurada é interrupção deliberada, não indisponibilidade", async () => {
    servidor(() => new Promise(() => {}));
    const voice = await createAgentVoice();
    const call = voice.call(req, handlers());
    voice.stop();
    await expect(call).resolves.toBe(true);
  });
});

describe("síntese de voz", () => {
  it("resposta atrasada da síntese não toca depois de cortar a fala", async () => {
    let finish!: (r: Response) => void;
    servidor(() => new Promise((resolve) => { finish = resolve; }), true);
    const play = vi.spyOn(PcmPlayer.prototype, "play").mockResolvedValue();
    const voice = await createAgentVoice();
    const speaking = voice.speak("Fala antiga");
    await Promise.resolve();
    voice.stop();
    finish(new Response(JSON.stringify({ id: "antiga", audio_url: "/api/tts/antiga" })));
    await speaking;
    expect(play).not.toHaveBeenCalled();
  });

  it("síntese pendurada deixa a legenda seguir", async () => {
    vi.useFakeTimers();
    servidor(() => new Promise(() => {}), true);
    const voice = await createAgentVoice();
    const onStart = vi.fn();
    const speaking = voice.speak("A legenda continua", { onStart });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await expect(speaking).resolves.toBeUndefined();
    expect(onStart).toHaveBeenCalledOnce();
  });
});
