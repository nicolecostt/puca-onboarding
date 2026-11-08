import { afterEach, describe, expect, it, vi } from "vitest";
import { PcmPlayer } from "./pcm-player";

/** AudioContext com relógio manual: `currentTime` só anda quando o teste manda (e não anda suspenso). */
class FakeContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = async () => void (this.state = "running");
  suspend = async () => void (this.state = "suspended");
  createAnalyser = () => ({ fftSize: 0, connect: () => {} });
  createBuffer = (_c: number, n: number, rate: number) => ({ duration: n / rate, copyToChannel: () => {} });
  createBufferSource = () => ({ buffer: null, connect: () => {}, start: () => {}, stop: () => {}, onended: null });
}

describe("PcmPlayer na pausa", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("as palavras param na pausa e continuam da mesma palavra", async () => {
    let ctx!: FakeContext;
    vi.stubGlobal(
      "AudioContext",
      class extends FakeContext {
        constructor() {
          super();
          ctx = this;
        }
      },
    );
    // 2 s de áudio a 24 kHz, num pedaço só; o corpo nunca termina (a fala ainda está tocando)
    vi.stubGlobal("fetch", async () => new Response(new ReadableStream({ start: (c) => c.enqueue(new Uint8Array(96000)) })));
    vi.useFakeTimers();
    const player = new PcmPlayer();
    const ditas: string[] = [];
    player.onWord((w) => ditas.push(w.word));
    void player.play("/api/tts/x");
    await vi.advanceTimersByTimeAsync(0);
    player.setWords([
      { word: "oi", start_ms: 0, end_ms: 200 },
      { word: "Puca", start_ms: 1000, end_ms: 1200 },
    ]);
    await vi.advanceTimersByTimeAsync(300);
    ctx.currentTime = 0.35;
    expect(ditas).toEqual(["oi"]);

    player.pause();
    await vi.advanceTimersByTimeAsync(5000); // pausada: o relógio do áudio não anda
    expect(ditas).toEqual(["oi"]);

    player.resume();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(600); // faltavam 0,7 s até "Puca"
    expect(ditas).toEqual(["oi"]);
    await vi.advanceTimersByTimeAsync(200);
    expect(ditas).toEqual(["oi", "Puca"]);
  });
});
