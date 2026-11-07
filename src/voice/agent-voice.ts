// Voz da Puca na tela: fala com áudio do servidor (fila, um por vez), pergunta ao agente (ponte + LLM)
// e microfone (Deepgram) com barge-in. Sem servidor ou sem chaves, cada parte desliga sozinha e a
// tela segue como antes (legenda e chat).
import type { BoardAction } from "../journey/types";
import { classifyBargeIn } from "./barge-in";
import { startMic, type Mic } from "./mic";
import { PcmPlayer } from "./pcm-player";
import { createSttSession, type SttSession } from "./stt-session";

export interface AskRequest {
  text: string;
  moment_id: string;
  step_id: string;
  perfil: "novo" | "transicao";
  history: { role: "user" | "assistant"; content: string }[];
}

export interface AskHandlers {
  /** Cada frase da Puca, na ordem: a ponte primeiro, depois o LLM. Resolve quando terminou de falar. */
  onSpeak(text: string, play: () => Promise<void>): Promise<void>;
  onAction(action: BoardAction): void;
  onGoTo(target: string): void;
}

export interface AgentVoice {
  /** Servidor com TTS (voz de verdade) e com STT (microfone). */
  readonly tts: boolean;
  readonly stt: boolean;
  /** Precisa de um clique: o browser só libera áudio e microfone depois de um gesto. */
  unlock(): Promise<void>;
  /** Fala um texto (entra na fila). Resolve quando o áudio acabou ou foi cortado. */
  speak(text: string): Promise<void>;
  /** Corta o que está tocando e o que ia tocar. */
  stop(): void;
  /** Pergunta ao agente. false = servidor indisponível (a tela usa o fallback dela). */
  ask(req: AskRequest, h: AskHandlers): Promise<boolean>;
  /** Liga o microfone. onFinal recebe cada fala completa da pessoa. */
  listen(onFinal: (text: string) => void, onCaption?: (text: string) => void): Promise<void>;
  setMuted(muted: boolean): void;
}

export async function createAgentVoice(): Promise<AgentVoice> {
  const health = await fetch("/api/health")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  const tts = !!health?.tts;
  const stt = !!health?.stt;
  const player = new PcmPlayer();
  let chain: Promise<void> = Promise.resolve();
  let generation = 0;
  let speaking = "";
  let askAbort: AbortController | null = null;
  let mic: Mic | null = null;
  let session: SttSession | null = null;

  function enqueue(text: string, url: () => Promise<string>): Promise<void> {
    const gen = generation;
    const job = chain.then(async () => {
      if (gen !== generation) return;
      speaking = text;
      try {
        await player.play(await url());
      } catch {
        /* sem áudio: a legenda continua */
      } finally {
        if (gen === generation) speaking = "";
      }
    });
    chain = job;
    return job;
  }

  async function speakUrl(text: string): Promise<string> {
    const r = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!r.ok) throw new Error(`speak HTTP ${r.status}`);
    return (await r.json()).audio_url as string;
  }

  const voice: AgentVoice = {
    tts,
    stt,
    async unlock() {
      // toca 0 ms de silêncio dentro do gesto para destravar o AudioContext do player
      const ctx = new AudioContext();
      await ctx.resume().catch(() => undefined);
      void ctx.close();
    },
    speak(text) {
      if (!tts) return Promise.resolve();
      return enqueue(text, () => speakUrl(text));
    },
    stop() {
      generation++;
      chain = Promise.resolve();
      speaking = "";
      player.stop();
      askAbort?.abort();
    },
    async ask(req, h) {
      const ac = new AbortController();
      askAbort = ac;
      let res: Response;
      try {
        res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal: ac.signal });
      } catch {
        return false;
      }
      if (!res.ok || !res.body) return false;
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      const spoken: Promise<void>[] = [];
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += value;
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            if (!block.startsWith("data: ")) continue;
            const ev = JSON.parse(block.slice(6));
            if (ev.type === "speak") {
              const url: string | null = ev.audio_url;
              const play = () => (url ? enqueue(ev.text, async () => url) : Promise.resolve());
              spoken.push(h.onSpeak(ev.text, play));
            } else if (ev.type === "action") h.onAction(ev.action);
            else if (ev.type === "go_to") h.onGoTo(ev.target);
          }
        }
      } catch {
        /* interrompida */
      }
      await Promise.all(spoken);
      return true;
    },
    async listen(onFinal, onCaption) {
      if (!stt || mic) return;
      session = createSttSession({
        getToken: async () => {
          const r = await fetch("/api/voice/token", { method: "POST" });
          if (!r.ok) throw new Error("microfone indisponível");
          return r.json();
        },
        onEvent: (ev) => {
          if (ev.type !== "caption") return;
          const c = ev.caption;
          // Mic aberto enquanto a Puca fala: o eco dela é ignorado; fala nova da pessoa corta.
          if (speaking) {
            const d = classifyBargeIn({ transcript: c.text, kind: c.kind, agentText: speaking });
            if (d.decision === "echo" || d.decision === "wait") return;
            voice.stop();
          }
          onCaption?.(c.text);
          if (c.kind === "final" && c.speech_final && c.text.trim()) onFinal(c.text.trim());
        },
      });
      await session.start();
      mic = await startMic((pcm) => session?.sendAudio(pcm));
    },
    setMuted(muted) {
      mic?.setMuted(muted);
      session?.setMuted(muted);
    },
  };
  return voice;
}
