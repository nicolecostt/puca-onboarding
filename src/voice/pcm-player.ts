import type { SpeechPlayer, WordTiming } from "./types";
import { AUDIO_RESUME_TIMEOUT_MS, pcm16ToFloat32, resumeWithin } from "./pcm";

const SAMPLE_RATE = 24000;

/**
 * Plays the chunked PCM of one `speak` as it downloads (Web Audio), fires word callbacks from the
 * alignment (`setWords`) and exposes the output level for the orb.
 */
export class PcmPlayer implements SpeechPlayer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private listeners = new Set<(w: WordTiming) => void>();
  private words: WordTiming[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private controller: AbortController | null = null;

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** Word timings of the audio that is playing (from the `speech_alignment` message); may arrive late. */
  setWords(words: WordTiming[]): void {
    this.words = words;
    this.nextWord = 0;
    this.scheduleWords();
  }
  /** Audio-clock time (ctx.currentTime) of the first sample of the line playing. */
  private startCtx: number | null = null;
  /** Index of the next word to fire: after a pause only the words still ahead are scheduled again. */
  private nextWord = 0;
  private paused = false;

  // Delays come from the audio clock, which stops while the context is suspended (pause): resuming reschedules exactly.
  private scheduleWords(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    const ctx = this.ctx;
    if (!ctx || this.startCtx === null || this.paused) return;
    for (let i = this.nextWord; i < this.words.length; i++) {
      const w = this.words[i];
      const delay = Math.max(0, (this.startCtx + w.start_ms / 1000 - ctx.currentTime) * 1000);
      this.timers.push(
        setTimeout(() => {
          this.nextWord = i + 1;
          this.listeners.forEach((cb) => cb(w));
        }, delay),
      );
    }
  }

  /** Unlocks the output inside a user gesture: resume() is called synchronously on the context that plays. */
  unlock(): Promise<boolean> {
    return resumeWithin(this.ensure(), AUDIO_RESUME_TIMEOUT_MS);
  }

  /** Freezes the voice on the exact sample (AudioContext.suspend); the download keeps going. */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (this.ctx?.state === "running") void this.ctx.suspend().catch(() => undefined);
  }

  /** Continues from the same sample, and the word callbacks from the same word. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    void this.ctx
      ?.resume()
      .then(() => this.scheduleWords())
      .catch(() => undefined);
  }

  async play(audio_url: string, signal?: AbortSignal): Promise<void> {
    const ctx = this.ensure();
    // navegador segurando o áudio: falha esta fala (a legenda segue) em vez de travar a fila. Pausado, não destrava:
    // a fala fica parada junto e começa no resume().
    if (!this.paused && !(await resumeWithin(ctx, AUDIO_RESUME_TIMEOUT_MS))) throw new Error("áudio bloqueado pelo navegador");
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    signal?.addEventListener("abort", () => controller.abort(), { once: true });

    const res = await fetch(audio_url, { signal: controller.signal });
    if (!res.ok || !res.body) throw new Error(`audio fetch failed: HTTP ${res.status}`);
    const reader = res.body.getReader();

    let nextTime = ctx.currentTime + 0.05;
    this.startCtx = null;
    let leftover = new Uint8Array(0);
    let lastSource: AudioBufferSourceNode | null = null;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const merged = new Uint8Array(leftover.length + value.length);
        merged.set(leftover);
        merged.set(value, leftover.length);
        const usable = merged.length - (merged.length % 2);
        leftover = merged.slice(usable);
        if (usable === 0) continue;

        const samples = pcm16ToFloat32(merged.subarray(0, usable));
        const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
        buffer.copyToChannel(samples, 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.analyser!);
        source.start(nextTime);
        if (this.startCtx === null) {
          this.startCtx = nextTime;
          this.scheduleWords();
        }
        nextTime += buffer.duration;
        this.sources.add(source);
        source.onended = () => this.sources.delete(source);
        lastSource = source;
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      throw err;
    }

    if (lastSource) await new Promise<void>((resolve) => ((lastSource as AudioBufferSourceNode).onended = () => resolve()));
  }

  stop(): void {
    this.controller?.abort();
    this.controller = null;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.startCtx = null;
  }

  onWord(cb: (word: WordTiming) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  level(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(sum / data.length) * 3);
  }
}
