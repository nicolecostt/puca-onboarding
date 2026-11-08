import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentVoice } from "./agent-voice";
import { AUDIO_RESUME_TIMEOUT_MS } from "./pcm";

/** Servidor com voz (TTS) e um navegador que segura o áudio: o resume() nunca resolve. */
function navegadorQueSeguraOAudio() {
  const fetch = vi.fn(async (url: string) => {
    if (url === "/api/health") return new Response(JSON.stringify({ tts: true, stt: false }));
    if (url === "/api/ask") return new Response('data: {"type":"speak","text":"Boa pergunta.","audio_url":"/api/tts/a"}\n\n');
    return new Response(JSON.stringify({ id: "x", audio_url: "/api/tts/x" }));
  });
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal(
    "AudioContext",
    class {
      state = "suspended";
      resume = () => new Promise<void>(() => {});
      close = () => Promise.resolve();
      destination = {};
      createAnalyser = () => ({ fftSize: 0, connect: () => {} });
    },
  );
  return fetch;
}

describe("createAgentVoice com o áudio bloqueado", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("unlock devolve false quando o navegador segura o áudio", async () => {
    navegadorQueSeguraOAudio();
    const voice = await createAgentVoice();
    vi.useFakeTimers();
    const ok = voice.unlock();
    await vi.advanceTimersByTimeAsync(AUDIO_RESUME_TIMEOUT_MS);
    await expect(ok).resolves.toBe(false);
  });

  it("com o som bloqueado, speak resolve sem pedir áudio ao servidor", async () => {
    const fetch = navegadorQueSeguraOAudio();
    const voice = await createAgentVoice();
    vi.useFakeTimers();
    const ok = voice.unlock();
    await vi.advanceTimersByTimeAsync(AUDIO_RESUME_TIMEOUT_MS);
    await ok;
    vi.useRealTimers();
    await voice.speak("Oi, eu sou Puca.");
    expect(fetch.mock.calls.map((c) => c[0])).toEqual(["/api/health"]);
  });

  it("com o som bloqueado, a frase do agente sai na hora, sem esperar o player", async () => {
    navegadorQueSeguraOAudio();
    const voice = await createAgentVoice();
    vi.useFakeTimers();
    const ok = voice.unlock();
    await vi.advanceTimersByTimeAsync(AUDIO_RESUME_TIMEOUT_MS);
    await ok;
    let tocou = false;
    const asked = voice.ask(
      { text: "e o settlement?", moment_id: "m", step_id: "s", perfil: "novo", history: [] },
      { onSpeak: (_t, play) => play().then(() => void (tocou = true)), onAction: () => {}, onGoTo: () => {} },
    );
    await vi.advanceTimersByTimeAsync(10); // bem antes do limite de 1 s do player
    expect(tocou).toBe(true);
    await vi.advanceTimersByTimeAsync(AUDIO_RESUME_TIMEOUT_MS);
    await expect(asked).resolves.toBe(true);
  });
});
