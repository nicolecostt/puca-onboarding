// Call inicial: o Puca acolhe, faz o onboarding cultural e conhece a pessoa (a calibragem), numa conversa de voz.
// O LLM conduz pelo /api/call (#57, decisão 0012): perguntas norteadoras, follow-ups dele e a cultura vinda do
// Notion da Kota. O que a pessoa conta chega como anotações, que viram o perfil e a calibragem da sessão.
import "../../styles/base.css";
import "./style.css";
import { preserveProfileLinks } from "../../lib/navigation";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { loadAgentVisual, type AgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import { emit } from "../../lib/events";
import { esc, qs } from "../../lib/dom";
import { mountPucaParticles } from "../../lib/puca-particles";
import { activeProfile, company } from "../../data";
import { loadSavedProfile, profileFromAnswers, saveProfile } from "../../journey/profile";
import { calibragemFromAnswers, saveCalibragem } from "../../journey/calibragem";
import { createAgentVoice, MIC_AVISO, type CallRequest, type SpeakOptions } from "../../voice/agent-voice";

const savedProfile = loadSavedProfile();
if (!savedProfile) qs<HTMLAnchorElement>(document, ".brand").href = "../boas-vindas/";
preserveProfileLinks();

// Dados da admissão: a empresa já sabe, o Puca só confirma (o vínculo salvo nas boas-vindas escolhe a pessoa da demo).
const profile = activeProfile(savedProfile?.vinculo === "transicao" ? "bruno" : "ana");
const admissao = {
  cargo: profile.role,
  time: profile.toTeam,
  gestor: company.people[profile.managerId]?.name ?? "",
};



const SEM_PUCA = "O Puca está fora do ar agora. Recarregue a página em alguns minutos para fazer a call.";
const FALHOU = "Perdi a conexão para pensar agora. Pode repetir?";

// ---- Estados ----
type AgentState = "idle" | "speaking" | "listening" | "thinking" | "done";
type ShownState = AgentState | "paused" | "ended";

const LABELS: Record<ShownState, string> = {
  idle: "Conectando…",
  speaking: "Falando",
  listening: "Ouvindo você",
  thinking: "Pensando…",
  paused: "Pausado",
  ended: "Call encerrada",
  done: "Montando sua semana…",
};
const VISUAL_STATE: Record<ShownState, AgentVisualState> = {
  idle: "idle",
  speaking: "talk",
  listening: "idle",
  thinking: "think",
  paused: "idle",
  ended: "idle",
  done: "think",
};

declare global {
  interface Window {
    /** Respostas coletadas na call (para a próxima tela usar). */
    onboardingAnswers?: Record<string, string>;
  }
}

async function main(): Promise<void> {
  const el = {
    orb: qs(document, "#orb"),
    agentState: qs(document, "#agent-state"),
    captionAgent: qs(document, "#caption-agent"),
    captionUser: qs(document, "#caption-user"),
    captionHint: qs(document, "#caption-hint"),
    timer: qs(document, "#timer"),
  };

  const answers: Record<string, string> = {};
  const cultura: string[] = [];
  const history: { role: "user" | "assistant"; content: string }[] = [];
  const state = { paused: false, ended: false, muted: false, seconds: 0, done: false, started: false };
  let agentState: AgentState = "idle";
  let turnoAtual = 0;
  let silencio = 0;
  let fraseAtual = "";
  let cortada = "";

  // partículas do Puca no fundo, atrás do texto, da esfera, do chat e da barra de call
  mountPucaParticles(qs<HTMLCanvasElement>(document, "#particles"), {
    occluders: ".topbar__row > *, .agent__orb, .agent__meta, .caption > *, .chat-panel, .call-dock, .call-gate",
    round: ".agent__orb",
    max: 40,
  });

  const chat = mountChatPanel({ title: "Transcrição da call", messages: [] });
  mountCallBar({ chat });
  const voice = await createAgentVoice();

  // Visual do Puca (teste local). Sem ele, fica o círculo neutro.
  let visual: AgentVisual | null = null;
  const factory = await loadAgentVisual();
  if (factory) {
    el.orb.classList.add("has-visual");
    const holder = document.createElement("div");
    holder.className = "agent__visual";
    el.orb.appendChild(holder);
    visual = factory(holder);
  }

  // A pessoa vive uma conversa: o que está sendo coletado não aparece na tela. Fica em window.onboardingAnswers e no evento.
  window.onboardingAnswers = answers;
  const remember = (role: "user" | "assistant", content: string) => {
    history.push({ role, content });
    if (history.length > 16) history.shift();
  };

  function setAgent(s: AgentState): void {
    agentState = s;
    render();
  }

  // estado visível: pausa/encerramento têm prioridade sobre o que o agente está fazendo
  function render(): void {
    const shown: ShownState = state.ended ? "ended" : state.paused ? "paused" : agentState;
    el.orb.dataset.state = shown;
    if (visual) {
      visual.setState(VISUAL_STATE[shown]);
      visual.setWarm(agentState === "thinking"); // continua quente mesmo se pausar no meio
    }
    el.agentState.textContent = LABELS[shown];
    el.captionHint.textContent =
      shown === "listening" && state.muted
        ? "Seu microfone está mudo. Responda pelo chat."
        : shown === "ended"
          ? "Use “Ligar para o Puca” para continuar de onde parou."
          : "";
    // o aviso aparece embaixo da conversa: se a fala era longa, rola até ele em vez de deixá-lo atrás da barra de call
    if (el.captionHint.textContent) requestAnimationFrame(() => el.captionHint.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }

  setInterval(() => {
    if (!state.started || state.paused || state.ended || state.done) return;
    state.seconds++;
    const m = String(Math.floor(state.seconds / 60)).padStart(2, "0");
    const s = String(state.seconds % 60).padStart(2, "0");
    el.timer.textContent = `${m}:${s}`;
  }, 1000);

  /** Uma frase do Puca: a legenda entra quando o áudio começa e segue as palavras dele; chat e voz. */
  async function falar(text: string, play: (o?: SpeakOptions) => Promise<void> = (o) => voice.speak(text, o)): Promise<void> {
    let words: Element[] = [];
    const show = () => {
      if (words.length) return;
      el.captionUser.textContent = "";
      el.captionAgent.innerHTML = text
        .split(/\s+/)
        .map((w) => `<span class="word">${esc(w)}</span>`)
        .join(" ");
      words = [...el.captionAgent.querySelectorAll(".word")];
      chat.addMessage({ from: "agent", text });
      remember("assistant", text);
    };
    await play({
      onStart: show,
      onWord: (i) => {
        show();
        for (const w of words.slice(0, i + 1)) w.classList.add("is-in");
      },
    });
    // sem os tempos das palavras (ou sem som): a frase inteira aparece no fim; frase descartada não aparece
    words.forEach((w) => w.classList.add("is-in"));
  }

  /** Um turno da call. O Puca fala; se a call acabou, grava o perfil e segue para as boas-vindas. */
  async function turno(kind: CallRequest["kind"], text?: string, interrupted?: string): Promise<void> {
    const meu = ++turnoAtual;
    clearTimeout(silencio);
    setAgent("thinking");
    let acabou = false;
    // a fala deste turno vai no `text`, não no histórico
    const passado = kind === "fala" ? history.slice(0, -1) : history.slice();
    const ok = await voice.call(
      { kind, text, history: passado, interrupted: interrupted ? { said: interrupted } : undefined, admissao, anotado: { ...answers }, cultura: [...cultura] },
      {
        onSpeak: (t, play) =>
          falar(t, async (o) => {
            if (meu !== turnoAtual) return;
            await play({
              ...o,
              onStart: () => {
                setAgent("speaking");
                fraseAtual = t;
                o?.onStart?.();
              },
            });
            if (fraseAtual === t) fraseAtual = "";
          }),
        onAction: () => {},
        onGoTo: () => {},
        onAnswer: (key, value) => {
          answers[key] = value;
          emit("onboarding:answer", { key, value, answers: { ...answers } });
        },
        onCulture: (topic) => cultura.push(topic),
        onDone: () => (acabou = true),
      },
    );
    if (meu !== turnoAtual || state.ended) return; // a pessoa falou por cima: o turno dela decide
    if (!ok) {
      await falar(kind === "inicio" ? SEM_PUCA : FALHOU);
      return setAgent(kind === "inicio" ? "idle" : "listening");
    }
    if (acabou) return encerrar();
    setAgent("listening");
    // ninguém respondeu: o Puca pergunta de novo, de outro jeito (uma vez por espera)
    if (kind !== "silencio") silencio = window.setTimeout(() => meu === turnoAtual && !state.paused && !state.ended && void turno("silencio"), 15000);
  }

  /** Fala da pessoa (voz ou chat): corta o Puca e vira um turno, levando a frase que ela cortou. */
  function fala(text: string, from: "voz" | "chat"): void {
    text = text.trim();
    if (!text || !state.started || state.paused || state.ended || state.done) return;
    if (from === "voz") chat.addMessage({ from: "user", text });
    el.captionUser.textContent = text;
    const interrompida = cortada || fraseAtual;
    cortada = "";
    voice.stop();
    remember("user", text);
    void turno("fala", text, interrompida || undefined);
  }

  /** Fim da call: o perfil e a calibragem vão para a sessão no quadro, que abre em seguida. */
  function encerrar(): void {
    state.done = true;
    setAgent("done");
    voice.stopListening();
    const perfil = profileFromAnswers(answers);
    saveCalibragem(calibragemFromAnswers(perfil, answers));
    saveProfile(perfil);
    window.setTimeout(leaveToSession, 1400);
  }

  function ouvir(): void {
    void voice.listen({
      onFinal: (t) => fala(t, "voz"),
      onCaption: (t) => (el.captionUser.textContent = t),
      onBargeIn: () => {
        // a voz já parou; o turno em andamento para de decidir até a fala da pessoa chegar
        cortada = fraseAtual || cortada;
        turnoAtual++;
        clearTimeout(silencio);
        setAgent("listening");
      },
      onState: (s) => {
        if (s !== "ouvindo") chat.addMessage({ from: "agent", text: MIC_AVISO[s] });
      },
    });
  }

  document.addEventListener("chatpanel:send", (e) => fala(e.detail.text, "chat"));
  document.addEventListener("callbar:pause", (e) => {
    state.paused = !!e.detail.on;
    if (state.paused) voice.pause();
    else voice.resume();
    render();
  });
  document.addEventListener("callbar:mute", (e) => {
    state.muted = !!e.detail.on;
    voice.setMuted(state.muted);
    render();
  });
  document.addEventListener("callbar:end", () => {
    state.ended = true;
    turnoAtual++;
    clearTimeout(silencio);
    voice.stop();
    voice.stopListening();
    render();
  });
  document.addEventListener("callbar:start", () => {
    state.ended = false;
    render();
    if (!state.started || state.done) return;
    ouvir();
    void turno("silencio"); // o Puca retoma de onde parou
  });

  render();
  if (!voice.llm) {
    chat.addMessage({ from: "agent", text: SEM_PUCA });
    el.captionAgent.textContent = SEM_PUCA;
    return;
  }
  // O navegador só libera som e microfone depois de um clique.
  const gate = document.createElement("button");
  gate.type = "button";
  gate.className = "call-gate";
  gate.textContent = "Começar a call";
  document.body.append(gate);
  gate.addEventListener("click", async () => {
    gate.remove();
    state.started = true;
    await voice.unlock();
    ouvir();
    void turno("inicio");
  });
}

/** Fim da call: a conversa e os controles somem (style.css, body.is-leaving) antes de abrir o quadro. */
function leaveToSession(): void {
  document.body.classList.add("is-leaving");
  window.setTimeout(() => location.replace("../lesson/"), 460);
}

void main();
