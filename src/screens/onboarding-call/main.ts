// Call inicial: o agente se apresenta e coleta as infos iniciais do usuário, como numa entrevista.
// Por enquanto a conversa é simulada (roteiro abaixo). A pessoa pode responder
// "por voz" (resposta de exemplo depois de alguns segundos) ou digitando no chat.
import "../../styles/base.css";
import "./style.css";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { loadAgentVisual, type AgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import { emit } from "../../lib/events";
import { qs } from "../../lib/dom";
import { activeProfile, company } from "../../data";

// ---- Roteiro ----
type FieldKey = "nome" | "cargo" | "time" | "gestor" | "ferramentas" | "aprender";
type Answers = Partial<Record<FieldKey, string>>;

interface Field {
  key: FieldKey;
  label: string;
  /** Resposta de exemplo usada quando a pessoa "responde por voz" na simulação. */
  sample: string;
}

// Respostas de exemplo vêm do perfil da demo (?perfil=bruno | ana)
const profile = activeProfile();
const FIELDS: Field[] = [
  { key: "nome", label: "Como prefere ser chamado", sample: profile.nickname },
  { key: "cargo", label: "Cargo", sample: profile.role },
  { key: "time", label: "Time", sample: profile.toTeam },
  { key: "gestor", label: "Gestor(a)", sample: company.people[profile.managerId]?.name ?? "" },
  { key: "ferramentas", label: "Ferramentas que já usa", sample: profile.tools },
  { key: "aprender", label: "Como prefere aprender", sample: profile.learningStyle },
];

const QUESTIONS: Record<FieldKey, (a: Answers) => string> = {
  nome: () =>
    "Oi! Eu sou o agente que vai te acompanhar na sua primeira semana. Antes de começar, quero te conhecer um pouco. Como você prefere ser chamado?",
  cargo: (a) => `Prazer, ${a.nome}! Qual vai ser o seu cargo aqui?`,
  time: () => "Legal. Em qual time você vai entrar?",
  gestor: () => "E quem é a pessoa que vai ser sua gestora ou gestor?",
  ferramentas: () => "Quais ferramentas você já usa no dia a dia?",
  aprender: () => "E pra fechar: você aprende melhor lendo, vendo alguém fazer ou fazendo junto?",
};
const OUTRO = (a: Answers) =>
  `Perfeito, ${a.nome}. Já tenho o que preciso. Vou montar sua primeira semana com o time ${a.time} e te mostro em seguida.`;

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
const STATUS: Partial<Record<ShownState, string>> = {
  speaking: "Agente falando…",
  listening: "Ouvindo você…",
  thinking: "Pensando na sua resposta…",
  paused: "Call pausada",
  done: "Montando sua primeira semana…",
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
    onboardingAnswers?: Answers;
  }
}

async function main(): Promise<void> {
  const el = {
    orb: qs(document, "#orb"),
    agentState: qs(document, "#agent-state"),
    captionAgent: qs(document, "#caption-agent"),
    captionUser: qs(document, "#caption-user"),
    captionHint: qs(document, "#caption-hint"),
    live: qs(document, "#live"),
    timer: qs(document, "#timer"),
  };

  const answers: Answers = {};
  const state = { paused: false, ended: false, muted: false, seconds: 0, done: false };
  let agentState: AgentState = "idle";
  let pendingAnswer: ((text: string) => void) | null = null; // resposta da pergunta atual pelo chat

  const chat = mountChatPanel({ title: "Transcrição da call", messages: [] });
  const call = mountCallBar({ status: "Conectando…", chat });

  // Visual do agente (teste local). Sem ele, fica o círculo neutro.
  let visual: AgentVisual | null = null;
  const factory = await loadAgentVisual();
  if (factory) {
    el.orb.classList.add("has-iris");
    const holder = document.createElement("div");
    holder.className = "agent__iris";
    el.orb.appendChild(holder);
    visual = factory(holder);
  }

  // Guarda a resposta sem mostrar na tela: a pessoa vive uma entrevista,
  // não vê o que está sendo coletado. Fica em window.onboardingAnswers e no evento.
  window.onboardingAnswers = answers;
  function remember(key: FieldKey, value: string): void {
    answers[key] = value;
    emit("onboarding:answer", { key, value, answers: { ...answers } as Record<string, string> });
  }

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
    const status = STATUS[shown];
    if (status) call.setStatus(status);
    el.live.classList.toggle("is-off", state.ended);
    el.captionHint.textContent =
      shown === "listening" && state.muted
        ? "Seu microfone está mudo. Responda pelo chat."
        : shown === "listening"
          ? "Fale normalmente ou responda pelo chat."
          : shown === "ended"
            ? "Use “Ligar para o agente” para continuar de onde parou."
            : "";
  }

  // Espera que só corre com a call ativa (pausa e encerramento seguram o tempo)
  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      let left = ms;
      const t = setInterval(() => {
        if (state.paused || state.ended) return;
        left -= 50;
        if (left <= 0) {
          clearInterval(t);
          resolve();
        }
      }, 50);
    });
  }

  setInterval(() => {
    if (state.paused || state.ended || state.done) return;
    state.seconds++;
    const m = String(Math.floor(state.seconds / 60)).padStart(2, "0");
    const s = String(state.seconds % 60).padStart(2, "0");
    el.timer.textContent = `${m}:${s}`;
  }, 1000);

  // Agente "fala": a legenda aparece palavra por palavra
  async function say(text: string): Promise<void> {
    setAgent("speaking");
    el.captionUser.textContent = "";
    const words = text.split(" ");
    el.captionAgent.textContent = "";
    for (let i = 0; i < words.length; i++) {
      el.captionAgent.textContent = words.slice(0, i + 1).join(" ");
      await wait(140);
    }
    chat.addMessage({ from: "agent", text });
    await wait(300);
  }

  // Agente "ouve": resposta chega pelo chat ou, sem mudo, pela "voz" de exemplo
  function listen(field: Field): Promise<string> {
    setAgent("listening");
    return new Promise((resolve) => {
      let finished = false;
      const finish = (text: string, fromChat: boolean) => {
        if (finished) return;
        finished = true;
        pendingAnswer = null;
        if (!fromChat) chat.addMessage({ from: "user", text });
        el.captionUser.textContent = text;
        resolve(text);
      };
      pendingAnswer = (text) => finish(text, true);
      void (async () => {
        await wait(2600);
        while (state.muted && !finished) await wait(200); // mudo: espera o chat
        finish(field.sample, false);
      })();
    });
  }

  document.addEventListener("chatpanel:send", (e) => pendingAnswer?.(e.detail.text.trim()));

  document.addEventListener("callbar:pause", (e) => {
    state.paused = !!e.detail.on;
    render();
  });
  document.addEventListener("callbar:mute", (e) => {
    state.muted = !!e.detail.on;
    render();
  });
  document.addEventListener("callbar:end", () => {
    state.ended = true;
    render();
  });
  document.addEventListener("callbar:start", () => {
    state.ended = false;
    render();
  });

  render();
  await wait(900);
  for (const f of FIELDS) {
    await say(QUESTIONS[f.key](answers));
    const answer = await listen(f);
    // depois da resposta, ela "pensa" um pouco antes de anotar
    setAgent("thinking");
    await wait(1800);
    remember(f.key, answer);
    await wait(400);
  }
  await say(OUTRO(answers));
  state.done = true;
  setAgent("done");
}

void main();
