// Call inicial: Puca se apresenta, confirma os dados da admissão e levanta o que a pessoa já sabe e
// o que ela quer (a calibragem), como numa conversa.
// Por enquanto a conversa é simulada (roteiro abaixo). A pessoa pode responder
// "por voz" (resposta de exemplo depois de alguns segundos) ou digitando no chat.
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
import { callAnswers } from "../../data/call-answers";
import { normalize } from "../../journey/conditions";
import { loadSavedProfile, profileFromAnswers, saveProfile, vinculoFromAnswer } from "../../journey/profile";
import { calibragemFromAnswers, saveCalibragem } from "../../journey/calibragem";

const savedProfile = loadSavedProfile();
if (!savedProfile) qs<HTMLAnchorElement>(document, ".brand").href = "../boas-vindas/";
preserveProfileLinks();

// ---- Roteiro ----
// Puca confirma os dados da admissão (não pergunta o que a empresa já sabe) e gasta a conversa com o que
// só a pessoa pode contar: experiência, o que já sabe de cada tema da sessão e os objetivos. Quem está
// mudando de time ganha perguntas sobre o time anterior. No fim, as respostas viram a calibragem.
type FieldKey =
  | "nome" | "vinculo" | "confirma" | "cargo" | "time" | "gestor"
  | "time_anterior" | "experiencia" | "aproveita" | "diferencas"
  | "pagamentos" | "mensageria" | "falhas" | "objetivos" | "aprender";
type Answers = Partial<Record<FieldKey, string>>;

interface Field {
  key: FieldKey;
  question: (a: Answers) => string;
  /** Só pergunta quando a condição vale (ex.: só na transição). */
  when?: (a: Answers) => boolean;
  /** Resposta de exemplo usada quando a pessoa "responde por voz" na simulação. */
  sample: string;
}

// Dados da admissão e respostas de exemplo vêm do perfil da demo (?perfil=bruno | ana)
const profile = activeProfile(savedProfile?.vinculo === "transicao" ? "bruno" : "ana");
const sample = callAnswers[profile.id] ?? {};
const admissao = {
  cargo: profile.role,
  time: profile.toTeam,
  gestor: company.people[profile.managerId]?.name ?? "",
};
const transicao = (a: Answers) => vinculoFromAnswer(a.vinculo) === "transicao";
const corrigir = (a: Answers) => /^(nao|errado)\b/.test(normalize(a.confirma ?? ""));

const FIELDS: Field[] = [
  {
    key: "nome",
    question: () =>
      "Oi! Eu sou Puca, e vou te acompanhar na sua primeira semana. Antes de começar, quero te conhecer um pouco. Como você prefere ser chamado?",
    sample: profile.nickname,
  },
  {
    key: "vinculo",
    question: (a) => `Prazer, ${a.nome}! É a sua primeira vez aqui na empresa ou você está mudando de time?`,
    sample: sample.vinculo ?? "",
  },
  {
    key: "confirma",
    question: () =>
      `Vi aqui que você vai entrar como ${admissao.cargo.toLowerCase()} no time ${admissao.time}, com ${admissao.gestor} na gestão. Está certo?`,
    sample: sample.confirma ?? "Sim",
  },
  { key: "cargo", when: corrigir, question: () => "Me corrige então: qual vai ser o seu cargo?", sample: admissao.cargo },
  { key: "time", when: corrigir, question: () => "E em qual time você vai entrar?", sample: admissao.time },
  { key: "gestor", when: corrigir, question: () => "E quem vai ser sua gestora ou gestor?", sample: admissao.gestor },
  { key: "time_anterior", when: transicao, question: () => "De qual time você está vindo?", sample: sample.time_anterior ?? "" },
  {
    key: "experiencia",
    question: (a) =>
      transicao(a) ? "Me conta rapidinho o que você fazia lá." : "Me conta rapidinho o que você fazia antes de chegar aqui.",
    sample: sample.experiencia ?? "",
  },
  {
    key: "aproveita",
    when: transicao,
    question: () => "O que do seu time antigo você acha que vai continuar usando aqui?",
    sample: sample.aproveita ?? "",
  },
  {
    key: "diferencas",
    when: transicao,
    question: () => "E o que você já sabe que vai ser novo pra você?",
    sample: sample.diferencas ?? "",
  },
  {
    key: "pagamentos",
    question: () => "Agora sobre o que a gente vai ver junto. Você já trabalhou com banco, tipo transferência, saldo e extrato?",
    sample: sample.pagamentos ?? "",
  },
  { key: "mensageria", question: () => "E com mensageria, tipo Kafka ou filas?", sample: sample.mensageria ?? "" },
  {
    key: "falhas",
    question: () => "Quando algo falha num sistema, tipo retry ou fila de erro, você já lidou com isso?",
    sample: sample.falhas ?? "",
  },
  { key: "objetivos", question: () => "O que você quer conseguir fazer nas primeiras semanas?", sample: sample.objetivos ?? "" },
  {
    key: "aprender",
    question: () => "E pra fechar: você aprende melhor lendo, vendo alguém fazer ou fazendo junto?",
    sample: profile.learningStyle,
  },
];



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
    timer: qs(document, "#timer"),
  };

  const answers: Answers = {};
  const state = { paused: false, ended: false, muted: false, seconds: 0, done: false };
  let agentState: AgentState = "idle";
  let pendingAnswer: ((text: string) => void) | null = null; // resposta da pergunta atual pelo chat

  // partículas de Puca no fundo, atrás do texto, da esfera, do chat e da barra de call
  mountPucaParticles(qs<HTMLCanvasElement>(document, "#particles"), {
    occluders: ".topbar__row > *, .agent__orb, .agent__meta, .caption > *, .chat-panel, .call-dock",
    round: ".agent__orb",
    max: 40,
  });

  const chat = mountChatPanel({ title: "Transcrição da call", messages: [] });
  mountCallBar({ chat });

  // Visual de Puca (teste local). Sem ele, fica o círculo neutro.
  let visual: AgentVisual | null = null;
  const factory = await loadAgentVisual();
  if (factory) {
    el.orb.classList.add("has-visual");
    const holder = document.createElement("div");
    holder.className = "agent__visual";
    el.orb.appendChild(holder);
    visual = factory(holder);
  }

  // Guarda a resposta sem mostrar na tela: a pessoa vive uma conversa,
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
    el.captionHint.textContent =
      shown === "listening" && state.muted
        ? "Seu microfone está mudo. Responda pelo chat."
        : shown === "ended"
          ? "Use “Ligar para Puca” para continuar de onde parou."
          : "";
    // o aviso aparece embaixo da conversa: se a fala era longa, rola até ele em vez de deixá-lo atrás da barra de call
    if (el.captionHint.textContent) requestAnimationFrame(() => el.captionHint.scrollIntoView({ block: "nearest", behavior: "smooth" }));
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
    // a frase entra inteira e invisível (o texto não pula de linha); cada palavra aparece suave, em sequência
    el.captionAgent.innerHTML = text
      .split(" ")
      .map((w) => `<span class="word">${esc(w)}</span>`)
      .join(" ");
    for (const word of el.captionAgent.querySelectorAll(".word")) {
      word.classList.add("is-in");
      await wait(95);
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
    if (f.when && !f.when(answers)) continue;
    await say(f.question(answers));
    const answer = await listen(f);
    // depois da resposta, ela "pensa" um pouco antes de anotar
    setAgent("thinking");
    await wait(1800);
    remember(f.key, answer);
    // dados da admissão confirmados: entram como se a pessoa tivesse respondido
    if (f.key === "confirma" && !corrigir(answers)) for (const [k, v] of Object.entries(admissao)) remember(k as FieldKey, v);
    await wait(400);
  }
  await say(OUTRO(answers));
  state.done = true;
  setAgent("done");

  // Entrega o perfil e a calibragem para a sessão no quadro e abre o quadro.
  const perfil = profileFromAnswers(answers);
  saveCalibragem(calibragemFromAnswers(perfil, answers));
  saveProfile(perfil);
  await wait(1400);
  leaveToSession();
}

/** Fim da call: a conversa e os controles somem (style.css, body.is-leaving) antes de abrir o quadro. */
function leaveToSession(): void {
  document.body.classList.add("is-leaving");
  window.setTimeout(() => location.replace("../lesson/"), 460);
}

void main();
