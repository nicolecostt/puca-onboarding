// Voz da Puca na tela: fala com áudio do servidor (fila, um por vez), pergunta ao agente (ponte + LLM)
// e microfone (Deepgram) com barge-in. Sem servidor ou sem chaves, cada parte desliga sozinha e a
// tela segue como antes (legenda e chat).
import type { BoardAction } from "../journey/types";
import { classifyBargeIn } from "./barge-in";
import { startMic, type Mic } from "./mic";
import { PcmPlayer } from "./pcm-player";
import { createSttSession, type SttSession } from "./stt-session";
import type { WordTiming } from "./types";

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
  /** O agente não achou fonte confiável: a tela encaminha a dúvida à buddy (resumo do agente). */
  onEscalate?(summary: string): void;
  /** Tempo e tokens do pedido (último evento; não chega se a pessoa interrompeu). Custo da sessão, #52. */
  onTiming?(timing: AskTimingSummary): void;
}

/** O que a tela usa do `timing` do /api/ask (docs/contratos.md, "Custo da sessão"). */
export interface AskTimingSummary {
  total_ms: number;
  tokens_in: number | null;
  tokens_out: number | null;
  tokens_estimated: boolean;
}

export interface SpeakOptions {
  /** Cada palavra na hora em que é falada: `index` é a posição dela em `text.split(/\s+/)`. */
  onWord?(index: number, word: WordTiming): void;
}

/** Como está o microfone: ouvindo, ou por que a conversa segue só pelo chat. */
export type MicState = "ouvindo" | "negado" | "sem-microfone" | "indisponivel" | "caiu";

export interface ListenHandlers {
  /** Cada fala completa da pessoa. */
  onFinal(text: string): void;
  /** Legenda ao vivo do que a pessoa está dizendo. */
  onCaption?(text: string): void;
  /** A pessoa falou por cima da Puca: a fala já foi cortada; a tela decide o que fazer com o roteiro. */
  onBargeIn?(): void;
  /** O microfone ligou ("ouvindo") ou não vai ouvir (motivo). */
  onState?(state: MicState): void;
}

/** O que a Puca diz no chat quando o microfone não vai ouvir. */
export const MIC_AVISO: Record<Exclude<MicState, "ouvindo">, string> = {
  negado: "O microfone está bloqueado. Sigo pelo chat; para falar comigo, libere o microfone e recarregue a página.",
  "sem-microfone": "Não achei um microfone funcionando. Sigo pelo chat.",
  indisponivel: "A voz da conversa está fora do ar agora. Sigo pelo chat.",
  caiu: "Perdi a conexão do microfone. Sigo pelo chat; para voltar a falar, recarregue a página.",
};

/** Quantas vezes a conexão com o STT tenta voltar sozinha antes de desistir ("caiu"). */
const RECONEXOES = 3;

export interface AgentVoice {
  /** Servidor com TTS (voz de verdade) e com STT (microfone). */
  readonly tts: boolean;
  readonly stt: boolean;
  /**
   * Precisa de um clique: o browser só libera áudio e microfone depois de um gesto. Desiste em ~1 s e devolve false
   * se o som não foi liberado; aí `speak` não toca nada e a sessão segue com legenda.
   */
  unlock(): Promise<boolean>;
  /** Fala um texto (entra na fila). Resolve quando o áudio acabou ou foi cortado. */
  speak(text: string, opts?: SpeakOptions): Promise<void>;
  /** Corta o que está tocando e o que ia tocar. */
  stop(): void;
  /** Pergunta ao agente; corta a fala e a pergunta anteriores. false = servidor indisponível (a tela usa o fallback dela). */
  ask(req: AskRequest, h: AskHandlers): Promise<boolean>;
  /**
   * Liga o microfone: primeiro o pedido de permissão, depois a conexão com o STT. Não lança: o resultado chega em
   * `onState`. Chamar de novo com o microfone ligado não faz nada.
   */
  listen(h: ListenHandlers): Promise<void>;
  /** Desliga o microfone e a conexão (encerrar a call). `listen` pode ligar de novo. */
  stopListening(): void;
  /** Mudo da pessoa; vale também se o microfone ainda não ligou. */
  setMuted(muted: boolean): void;
  /** Pausa: a voz para na mesma palavra e o microfone fica mudo. */
  pause(): void;
  resume(): void;
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
  let somBloqueado = false;
  let mic: Mic | null = null;
  let session: SttSession | null = null;
  let listening = false; // de listen() até stopListening() ou uma falha
  let userMuted = false;
  let paused = false;
  const applyMute = () => {
    mic?.setMuted(userMuted || paused);
    session?.setMuted(userMuted || paused);
  };

  interface Audio {
    audio_url: string;
    /** Tempo de cada palavra (GET /api/tts/:id/words); pode chegar depois de o áudio começar. */
    words?: Promise<WordTiming[]>;
  }

  /** Busca os tempos das palavras de um áudio do servidor; [] se não vierem. */
  function wordsOf(id: string): Promise<WordTiming[]> {
    return fetch(`/api/tts/${id}/words`)
      .then((r) => (r.ok ? r.json() : { words: [] }))
      .then((b: { words?: WordTiming[] }) => b.words ?? [])
      .catch(() => []);
  }

  /** Põe um áudio na fila. onStart roda quando chega a vez dele; onWord, a cada palavra falada. */
  function enqueue(text: string, audio: () => Promise<Audio>, opts: SpeakOptions & { onStart?: () => void } = {}): Promise<void> {
    const gen = generation;
    const job = chain.then(async () => {
      if (gen !== generation) return;
      speaking = text;
      opts.onStart?.();
      let off = () => {};
      try {
        const a = await audio();
        if (opts.onWord) {
          const onWord = opts.onWord;
          let words: WordTiming[] = [];
          off = player.onWord((w) => onWord(words.indexOf(w), w));
          player.setWords([]); // não herda as palavras do áudio anterior
          void a.words?.then((ws) => {
            if (gen !== generation || speaking !== text) return; // chegou tarde: já é outra fala
            words = ws;
            player.setWords(ws);
          });
        }
        await player.play(a.audio_url);
      } catch {
        /* sem áudio: a legenda continua */
      } finally {
        off();
        if (gen === generation) speaking = "";
      }
    });
    chain = job;
    return job;
  }

  async function speakAudio(text: string, withWords: boolean): Promise<Audio> {
    const r = await fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    if (!r.ok) throw new Error(`speak HTTP ${r.status}`);
    const { id, audio_url } = (await r.json()) as { id: string; audio_url: string };
    return { audio_url, words: withWords ? wordsOf(id) : undefined };
  }

  /** Abre a conexão com o STT (token novo a cada vez). Só fica valendo se o microfone ainda está ligado. */
  async function openSession(h: ListenHandlers): Promise<void> {
    const s = createSttSession({
      getToken: async () => {
        const r = await fetch("/api/voice/token", { method: "POST" });
        if (!r.ok) throw new Error("microfone indisponível");
        return r.json();
      },
      onEvent: (ev) => {
        if (ev.type !== "caption" || paused) return;
        const c = ev.caption;
        // Mic aberto enquanto a Puca fala: o eco dela é ignorado; fala nova da pessoa corta.
        if (speaking) {
          const d = classifyBargeIn({ transcript: c.text, kind: c.kind, agentText: speaking });
          if (d.decision === "echo" || d.decision === "wait") return;
          voice.stop();
          h.onBargeIn?.();
        }
        h.onCaption?.(c.text);
        if (c.kind === "final" && c.speech_final && c.text.trim()) h.onFinal(c.text.trim());
      },
      // fechou sem stopListening (rede, STT): tenta voltar
      onClose: () => {
        if (session === s) void reconnect(h);
      },
    });
    await s.start();
    if (!mic) return s.stop();
    session = s;
    applyMute();
  }

  async function reconnect(h: ListenHandlers): Promise<void> {
    session = null;
    for (let i = 1; i <= RECONEXOES; i++) {
      await new Promise((r) => setTimeout(r, 500 * i));
      if (!mic) return; // a call foi encerrada nesse meio-tempo
      try {
        await openSession(h);
        return;
      } catch {
        /* tenta de novo */
      }
    }
    if (!mic) return;
    voice.stopListening();
    h.onState?.("caiu");
  }

  const voice: AgentVoice = {
    tts,
    stt,
    async unlock() {
      // destrava o AudioContext do próprio player, dentro do gesto; sem gesto reconhecido, o resume() não resolve
      const ok = await player.unlock();
      somBloqueado = !ok;
      return ok;
    },
    speak(text, opts = {}) {
      // som bloqueado: nem pede o áudio ao servidor (não gasta TTS); a sessão segue com legenda
      if (!tts || somBloqueado) return Promise.resolve();
      return enqueue(text, () => speakAudio(text, !!opts.onWord), opts);
    },
    stop() {
      generation++;
      chain = Promise.resolve();
      speaking = "";
      player.stop();
      askAbort?.abort();
    },
    async ask(req, h) {
      voice.stop(); // nunca duas respostas juntas: a pergunta nova corta a anterior e o que ela ia falar
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
      // ações do agente esperam a frase seguinte começar a tocar (contrato Voz ↔ quadro)
      let actions: BoardAction[] = [];
      let last: { started: boolean; actions: BoardAction[] } | null = null;
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
              const frase = { started: false, actions };
              actions = [];
              last = frase;
              const start = () => {
                frase.started = true;
                frase.actions.forEach((a) => h.onAction(a));
              };
              // som bloqueado: a frase sai na hora, só na legenda, sem esperar o player
              const play = () =>
                url && !somBloqueado ? enqueue(ev.text, async () => ({ audio_url: url }), { onStart: start }) : Promise.resolve(start());
              spoken.push(h.onSpeak(ev.text, play));
            } else if (ev.type === "action") actions.push(ev.action);
            else if (ev.type === "go_to") h.onGoTo(ev.target);
            else if (ev.type === "escalate") h.onEscalate?.(ev.summary);
            else if (ev.type === "timing") h.onTiming?.(ev.timing);
          }
        }
      } catch {
        /* interrompida */
      }
      // ações depois da última frase: com ela, se ainda não começou a tocar (mantém a ordem); senão, já
      const tail = last as { started: boolean; actions: BoardAction[] } | null;
      if (!ac.signal.aborted) {
        if (tail && !tail.started) tail.actions.push(...actions);
        else actions.forEach((a) => h.onAction(a));
      }
      await Promise.all(spoken);
      return true;
    },
    async listen(h) {
      if (!stt || listening) return;
      listening = true;
      // Permissão primeiro: o STT fecha a conexão depois de ~10 s sem áudio, e o pedido do navegador pode demorar.
      let m: Mic;
      try {
        m = await startMic((pcm) => session?.sendAudio(pcm));
      } catch (err) {
        listening = false;
        return h.onState?.(micState(err));
      }
      if (!listening) return m.stop(); // encerrou enquanto o pedido de permissão estava aberto
      mic = m;
      applyMute();
      try {
        await openSession(h);
      } catch {
        voice.stopListening();
        return h.onState?.("indisponivel");
      }
      if (listening) h.onState?.("ouvindo");
    },
    stopListening() {
      listening = false;
      const m = mic;
      const s = session;
      mic = null;
      session = null; // antes do stop(): o onClose desta sessão não reconecta
      s?.stop();
      m?.stop();
    },
    setMuted(muted) {
      userMuted = muted;
      applyMute();
    },
    pause() {
      paused = true;
      player.pause();
      applyMute();
    },
    resume() {
      paused = false;
      player.resume();
      applyMute();
    },
  };
  return voice;
}

/** Motivo de o microfone não ligar, pelo erro do getUserMedia. */
function micState(err: unknown): MicState {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "negado";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") return "sem-microfone";
  return "indisponivel";
}
