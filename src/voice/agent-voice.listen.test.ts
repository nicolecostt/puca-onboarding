import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentVoice, type MicState } from "./agent-voice";

/** Ordem do que aconteceu no "navegador": pedido de microfone, token do STT, conexão aberta. */
let ordem: string[] = [];
let sockets: FakeSocket[] = [];

class FakeSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor() {
    ordem.push("conexão");
    sockets.push(this);
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
    }, 0);
  }
  send() {}
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  /** O STT fechou sozinho (rede, ~10 s sem áudio). */
  cair() {
    this.readyState = 3;
    this.onclose?.();
  }
  /** Fala completa da pessoa. */
  falar(text: string) {
    const words = text.split(" ").map((word, i) => ({ word, start: i, end: i + 0.5, confidence: 1 }));
    this.onmessage?.({ data: JSON.stringify({ type: "Results", is_final: true, speech_final: true, channel: { alternatives: [{ words }] } }) });
  }
}

function navegador({ microfone = "ok" }: { microfone?: "ok" | "negado" } = {}) {
  ordem = [];
  sockets = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/health") return new Response(JSON.stringify({ tts: false, stt: true }));
    if (url === "/api/voice/token") {
      ordem.push("token");
      return new Response(JSON.stringify({ token: "t", expires_in: 30, ws_url: "wss://stt", params: {} }));
    }
    if (url === "/api/ask") {
      // resposta que só termina quando o pedido é abortado
      const signal = init?.signal;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          signal?.addEventListener("abort", () => c.error(new DOMException("aborted", "AbortError")));
        },
      });
      return new Response(body);
    }
    return new Response("{}");
  });
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("WebSocket", FakeSocket);
  const track = { enabled: true, stop: vi.fn() };
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(async () => {
        ordem.push("microfone");
        if (microfone === "negado") throw new DOMException("negado", "NotAllowedError");
        return { getAudioTracks: () => [track], getTracks: () => [track] };
      }),
    },
  });
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "running";
      destination = {};
      audioWorklet = { addModule: async () => {} };
      resume = async () => {};
      suspend = async () => {};
      close = async () => {};
      createAnalyser = () => ({ fftSize: 0, connect: () => {} });
      createMediaStreamSource = () => ({ connect: () => {}, disconnect: () => {} });
    },
  );
  vi.stubGlobal(
    "AudioWorkletNode",
    class {
      port = { onmessage: null };
      disconnect() {}
    },
  );
  return { fetch, track };
}

async function ouvindo() {
  const voice = await createAgentVoice();
  const estados: MicState[] = [];
  const falas: string[] = [];
  await voice.listen({ onFinal: (t) => falas.push(t), onState: (s) => estados.push(s) });
  return { voice, estados, falas };
}

describe("microfone da Puca", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("pede o microfone antes de abrir a conexão com o STT", async () => {
    navegador();
    const { estados } = await ouvindo();
    expect(ordem).toEqual(["microfone", "token", "conexão"]);
    expect(estados).toEqual(["ouvindo"]);
  });

  it("permissão negada avisa o motivo e não abre conexão", async () => {
    navegador({ microfone: "negado" });
    const { estados } = await ouvindo();
    expect(estados).toEqual(["negado"]);
    expect(ordem).toEqual(["microfone"]);
  });

  it("conexão que cai volta sozinha com token novo", async () => {
    navegador();
    const { estados, falas } = await ouvindo();
    vi.useFakeTimers();
    sockets[0].cair();
    await vi.advanceTimersByTimeAsync(600);
    expect(ordem).toEqual(["microfone", "token", "conexão", "token", "conexão"]);
    sockets[1].falar("oi Puca");
    expect(falas).toEqual(["oi Puca"]);
    expect(estados).toEqual(["ouvindo"]);
  });

  it("encerrar desliga o microfone e não reconecta", async () => {
    const { track } = navegador();
    const { voice } = await ouvindo();
    vi.useFakeTimers();
    voice.stopListening();
    await vi.advanceTimersByTimeAsync(5000);
    expect(track.stop).toHaveBeenCalled();
    expect(sockets).toHaveLength(1);
  });

  it("pausada, o microfone fica mudo e a fala não chega; retomada, volta", async () => {
    const { track } = navegador();
    const { voice, falas } = await ouvindo();
    voice.pause();
    expect(track.enabled).toBe(false);
    sockets[0].falar("isso não vale");
    voice.resume();
    expect(track.enabled).toBe(true);
    sockets[0].falar("agora vale");
    expect(falas).toEqual(["agora vale"]);
  });

  it("mudo antes de o microfone ligar continua mudo quando ele liga", async () => {
    const { track } = navegador();
    const voice = await createAgentVoice();
    voice.setMuted(true);
    await voice.listen({ onFinal: () => {} });
    expect(track.enabled).toBe(false);
  });
});

describe("uma resposta por vez", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uma pergunta nova corta a pergunta anterior", async () => {
    const { fetch } = navegador();
    const voice = await createAgentVoice();
    const h = { onSpeak: async () => {}, onAction: () => {}, onGoTo: () => {} };
    const req = { text: "e o balancereader?", moment_id: "m", step_id: "s", perfil: "novo" as const, history: [] };
    const primeira = voice.ask(req, h);
    await new Promise((r) => setTimeout(r, 0));
    void voice.ask({ ...req, text: "e o ledger?" }, h);
    await expect(primeira).resolves.toBe(true); // terminou (abortada), não ficou pendurada
    const sinais = fetch.mock.calls.filter((c) => c[0] === "/api/ask").map((c) => (c[1] as RequestInit).signal!);
    expect(sinais[0].aborted).toBe(true);
    expect(sinais[1].aborted).toBe(false);
  });
});
