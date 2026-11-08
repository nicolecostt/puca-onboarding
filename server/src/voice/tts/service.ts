import type { WordTiming } from "../../../../src/voice/types";
import { charsToWords, type CharTiming } from "../alignment";
import type { TtsCacheStore } from "./cache";
import { remapWordTimings, toSpokenText, toSpokenWords } from "./spoken-text";
import type { TtsProvider } from "./types";

export interface SpeakResult {
  words: WordTiming[];
  first_byte_ms: number | null;
  audio_bytes: number;
  cached: boolean;
}

export interface StartSpeakRequest {
  action_id: string;
  text: string;
  previous_text?: string;
  next_text?: string;
}

interface Job {
  chunks: Buffer[];
  done: boolean;
  error: Error | null;
  waiters: Set<() => void>;
  abort: AbortController;
  /** Resultado da síntese (palavras com tempo); preenchido logo depois de criar o job. */
  result?: Promise<SpeakResult>;
}

export interface TravaDoTts {
  esgotada(): boolean;
  usa(chars: number): boolean;
  devolve(chars: number): void;
}

export interface TtsServiceOptions {
  provider: TtsProvider;
  cache: TtsCacheStore;
  voiceId: string;
  modelId: string;
  /** How long a finished job stays available for GET /api/tts/:action_id. Default 5 minutes. */
  retainMs?: number;
}

/** One job per `speak`: starts synthesizing at once, streams chunks to whoever asks, caches the result. */
export class TtsService {
  private readonly jobs = new Map<string, Job>();
  constructor(private readonly opts: TtsServiceOptions) {}

  has(action_id: string): boolean {
    return this.jobs.has(action_id);
  }

  /** Tempo de cada palavra do áudio: resolve quando a síntese termina ([] se falhou). null se o id não existe. */
  words(action_id: string): Promise<WordTiming[]> | null {
    const job = this.jobs.get(action_id);
    if (!job?.result) return null;
    return job.result.then((r) => r.words, () => []);
  }

  cancel(action_id: string): void {
    this.jobs.get(action_id)?.abort.abort();
  }

  /** Trava diária de caracteres sintetizados (docs/stack.md §5.3); o cache não conta nem é barrado. */
  private trava: TravaDoTts | null = null;

  limitarCom(trava: TravaDoTts): void {
    this.trava = trava;
  }

  /** true se o texto já tem áudio no cache (sai sem custo). */
  async cached(text: string): Promise<boolean> {
    const { cache, voiceId, modelId } = this.opts;
    return !!(await cache.get(cache.key({ text: toSpokenText(text, toSpokenWords(text)), voiceId, modelId })));
  }

  private readonly pending = new Set<Promise<void>>();

  private track(put: Promise<void>): void {
    const p = put.catch(() => undefined).finally(() => this.pending.delete(p));
    this.pending.add(p);
  }

  /** Espera as gravações no cache que ainda estão em andamento (o precompute usa antes de sair). */
  async flush(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
  }

  cancelAll(): void {
    for (const job of this.jobs.values()) job.abort.abort();
    this.opts.provider.close?.();
  }

  start(req: StartSpeakRequest): Promise<SpeakResult> {
    const job: Job = { chunks: [], done: false, error: null, waiters: new Set(), abort: new AbortController() };
    this.jobs.set(req.action_id, job);
    const wake = () => {
      const ws = [...job.waiters];
      job.waiters.clear();
      for (const w of ws) w();
    };
    const t0 = performance.now();

    // The voice says what a person would ("753 antes de Cristo", "x ao quadrado"); the timings are mapped
    // back onto the written words the caption shows. The cache is keyed (and stores timings) by spoken text.
    const spokenWords = toSpokenWords(req.text);
    const spoken = toSpokenText(req.text, spokenWords);

    const run = async (): Promise<SpeakResult> => {
      const { provider, cache, voiceId, modelId } = this.opts;
      const key = cache.key({ text: spoken, voiceId, modelId });
      const hit = await cache.get(key);
      if (hit) {
        job.chunks.push(hit.audio);
        job.done = true;
        wake();
        return { words: remapWordTimings(spokenWords, hit.words), first_byte_ms: 0, audio_bytes: hit.audio.length, cached: true };
      }
      if (job.abort.signal.aborted) {
        job.done = true;
        wake();
        return { words: [], first_byte_ms: null, audio_bytes: 0, cached: false };
      }
      let first: number | null = null;
      const chars: CharTiming[] = [];
      let bytes = 0;
      let reservado = false;
      try {
        // reserva antes de chamar o provedor: sínteses simultâneas não passam juntas da trava
        if (this.trava && !this.trava.usa(spoken.length)) throw new Error("limite_diario");
        reservado = !!this.trava;
        for await (const chunk of provider.synthesize({
          text: spoken,
          previous_text: req.previous_text,
          next_text: req.next_text,
          signal: job.abort.signal,
        })) {
          if (first === null) first = Math.round(performance.now() - t0);
          job.chunks.push(chunk.audio);
          bytes += chunk.audio.length;
          chars.push(...chunk.chars);
          wake();
        }
        if (bytes === 0 && reservado) this.trava?.devolve(spoken.length); // nada sintetizado: não conta
        reservado = false;
        const words = charsToWords(chars);
        // guarda em segundo plano: o Storage não atrasa o fim do áudio nem as palavras; falhar só perde o cache
        if (!job.abort.signal.aborted && bytes > 0) this.track(cache.put(key, Buffer.concat(job.chunks), words));
        return { words: remapWordTimings(spokenWords, words), first_byte_ms: first, audio_bytes: bytes, cached: false };
      } catch (err) {
        if (bytes === 0 && reservado) this.trava?.devolve(spoken.length);
        job.error = err instanceof Error ? err : new Error(String(err));
        throw job.error;
      } finally {
        job.done = true;
        wake();
      }
    };

    const result = run();
    job.result = result;
    result.catch(() => undefined); // errors are reported through the returned promise and stream()
    const retain = setTimeout(() => this.jobs.delete(req.action_id), this.opts.retainMs ?? 5 * 60_000);
    retain.unref?.();
    return result;
  }

  async *stream(action_id: string, signal?: AbortSignal): AsyncGenerator<Buffer> {
    const job = this.jobs.get(action_id);
    if (!job) return;
    let i = 0;
    for (;;) {
      while (i < job.chunks.length) yield job.chunks[i++]!;
      if (job.error) throw job.error;
      if (job.done || signal?.aborted) return;
      await new Promise<void>((resolve) => {
        job.waiters.add(resolve);
        signal?.addEventListener("abort", () => resolve(), { once: true });
      });
    }
  }
}
