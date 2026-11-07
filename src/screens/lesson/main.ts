// Aula no quadro: a Puca conduz a jornada (src/journey/data/*.journey.json) e monta o quadro
// enquanto explica. Conversa simulada: a pessoa responde pelas respostas sugeridas, pelo chat
// ou tocando no quadro. O perfil vem da call de entrevista; ?perfil=ana|bruno (ou novo|transicao)
// força um perfil da demo; ?auto=1 responde sozinho, para apresentar sem mexer no mouse.
import "../../styles/base.css";
import "./style.css";
import demo from "../../journey/data/mare-pagamentos.journey.json";
import { loadJourney } from "../../journey/validate";
import { createRunner, type RunnerIO } from "../../journey/runner";
import { createClock, Cancelled } from "../../journey/clock";
import { mountBoard } from "../../journey/board/board";
import { normalize } from "../../journey/conditions";
import { interpolateDeep, resolveProfile } from "../../journey/profile";
import type { Profile, Vinculo } from "../../journey/types";
import { mountAppHeader } from "../../components/app-header/app-header";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { loadAgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import { emit } from "../../lib/events";
import { qs } from "../../lib/dom";
import { profiles, type Profile as DemoProfile } from "../../data";

type AgentState = "speaking" | "listening" | "choosing" | "thinking" | "done";

const CAM_STATE: Record<AgentState, AgentVisualState> = {
  speaking: "talk",
  listening: "idle",
  choosing: "idle",
  thinking: "think",
  done: "idle",
};
const VINCULO_LABEL: Record<Vinculo, string> = { novo: "Começando na empresa", transicao: "Mudando de time" };

/** Pessoa mostrada no cabeçalho: o perfil da demo, ou o que a entrevista coletou. */
function headerPerson(p: Profile, fromInterview: boolean): DemoProfile {
  const base = p.vinculo === "transicao" ? profiles.bruno : profiles.ana;
  if (!fromInterview) return base;
  const initials = p.nome.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  // a entrevista não pergunta o time de origem
  return { ...base, name: p.nome, nickname: p.nome, initials, role: p.cargo ?? base.role, toTeam: p.time ?? base.toTeam, fromTeam: undefined };
}

async function main(): Promise<void> {
  const journey = loadJourney(demo);
  const auto = new URLSearchParams(location.search).get("auto") === "1";
  const resolved = resolveProfile(location.search);
  const profile = resolved.profile;

  // ---- Montagem da tela ----
  mountAppHeader({ current: "lesson", profile: headerPerson(profile, resolved.source === "entrevista") });
  const el = {
    boardHost: qs(document, "#board-host"),
    logoView: qs(document, "#logo-view"),
    logoCompany: qs(document, "#logo-company"),
    logoTitle: qs(document, "#logo-title"),
    logoWho: qs(document, "#logo-who"),
    lessonName: qs(document, "#lesson-name"),
    moment: qs(document, "#moment"),
    timer: qs(document, "#timer"),
    liveDot: qs(document, "#live-dot"),
    captionAgent: qs(document, "#caption-agent"),
    captionUser: qs(document, "#caption-user"),
    replies: qs(document, "#replies"),
    hint: qs(document, "#caption-hint"),
    voice: qs(document, "#voice"),
  };
  el.lessonName.textContent = journey.title;

  const clock = createClock();
  const board = mountBoard(el.boardHost);
  const chat = mountChatPanel({ title: "Transcrição da aula", messages: [] });
  mountCallBar({ chat }); // sem status: a legenda já mostra o que está acontecendo
  // a Puca aparece na "câmera" do canto, como numa videochamada
  const cam = mountAgentCam({ name: journey.agent.name, visual: await loadAgentVisual() });

  let paused = false;
  let ended = false;
  let agentState: AgentState = "thinking";
  let currentBoard: string | null = null;

  // Resposta pendente: resposta sugerida, chat ou clique no quadro resolvem.
  let pending: { kind: "reply" | "select"; resolve: (v: string) => void; reject: (e: Error) => void } | null = null;

  // ---- Estado visível ----
  function setAgent(s: AgentState): void {
    agentState = s;
    render();
  }

  function render(): void {
    const off = paused || ended;
    const voice = off ? "paused" : agentState === "speaking" ? "talk" : "listen";
    el.voice.dataset.state = voice;
    el.voice.setAttribute("aria-label", ended ? "Aula encerrada" : paused ? "Puca pausada" : voice === "talk" ? "Puca falando" : "Puca ouvindo");
    el.liveDot.classList.toggle("is-off", off);
    cam.setPaused(off);
    if (!off) cam.setState(CAM_STATE[agentState]);
    for (const b of el.replies.querySelectorAll<HTMLButtonElement>("button")) b.disabled = off;
    el.hint.textContent = ended
      ? "Use “Ligar para a Puca” para continuar de onde parou."
      : paused
        ? "Aula pausada."
        : agentState === "listening"
          ? "Escolha uma opção ou responda pelo chat."
          : agentState === "choosing"
            ? "Toque num item do quadro (ou escreva o nome no chat)."
            : "";
  }

  setInterval(() => {
    const s = clock.seconds;
    el.timer.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, 250);

  // ---- Respostas ----
  function showReplies(replies: string[]): void {
    el.replies.replaceChildren(
      ...replies.map((r, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "reply";
        b.textContent = r;
        b.style.animationDelay = `${i * 60}ms`;
        b.addEventListener("click", () => answer(r, "chip"));
        return b;
      }),
    );
    render();
  }

  /** Resposta da pessoa chegou (botão, chat ou modo auto). */
  function answer(text: string, from: "chip" | "chat" | "auto"): void {
    if (!pending || pending.kind !== "reply" || paused || ended) return;
    const p = pending;
    pending = null;
    el.replies.replaceChildren();
    el.captionUser.textContent = text;
    if (from !== "chat") chat.addMessage({ from: "user", text });
    p.resolve(text);
  }

  function pickNode(id: string, said: string): void {
    if (!pending || pending.kind !== "select" || paused || ended) return;
    const p = pending;
    pending = null;
    board.setSelectable(false);
    el.captionUser.textContent = said;
    p.resolve(id);
  }

  board.onSelect((id) => {
    const label = journey.boards[currentBoard ?? ""]?.nodes.find((n) => n.id === id)?.label ?? id;
    if (pending?.kind === "select") chat.addMessage({ from: "user", text: `(tocou em ${label})` });
    pickNode(id, label);
  });

  document.addEventListener("chatpanel:send", (e) => {
    const text = e.detail.text.trim();
    if (!text) return;
    if (pending?.kind === "reply") return answer(text, "chat");
    if (pending?.kind === "select") {
      // escreveu o nome de um item do quadro em vez de tocar nele
      const said = normalize(text);
      const hit = journey.boards[currentBoard ?? ""]?.nodes.find((n) => said.includes(normalize(n.label)) || said.includes(normalize(n.id)));
      if (hit) return pickNode(hit.id, text);
    }
    // O roteiro é fixo nesta versão: a pergunta fica anotada (§4.5, encaminhamento para uma pessoa).
    chat.addMessage({
      from: "agent",
      text: "Anotei a sua pergunta. Nesta versão eu sigo o roteiro da aula, mas ela fica registrada para a sua buddy responder.",
    });
  });

  // ---- Barra de call ----
  document.addEventListener("callbar:pause", (e) => {
    paused = !!e.detail.on;
    clock.setPaused(paused);
    render();
  });
  document.addEventListener("callbar:end", () => {
    ended = true;
    clock.setEnded(true);
    cam.hide();
    render();
  });
  document.addEventListener("callbar:start", () => {
    ended = false;
    clock.setEnded(false);
    cam.show();
    render();
  });

  // ---- Vistas ----
  function showLogo(): void {
    el.boardHost.hidden = true;
    el.logoView.hidden = false;
    el.logoCompany.textContent = journey.company;
    el.logoTitle.textContent = journey.title;
    el.logoWho.textContent = `${profile.nome} · ${VINCULO_LABEL[profile.vinculo]}`;
  }

  function showBoard(name: string, fresh: boolean): void {
    el.logoView.hidden = true;
    el.boardHost.hidden = false;
    if (fresh || name !== currentBoard) {
      board.load(interpolateDeep(journey.boards[name], profile));
      currentBoard = name;
    }
  }

  // ---- io do motor ----
  const io: RunnerIO = {
    enterView(view, fresh) {
      if (view.mode === "logo") showLogo();
      else showBoard(view.board, fresh);
    },
    apply: (a) => board.apply(a),
    async say(text) {
      setAgent("speaking");
      el.captionUser.textContent = "";
      const words = text.split(" ");
      for (let i = 0; i < words.length; i++) {
        el.captionAgent.textContent = words.slice(0, i + 1).join(" ");
        await clock.wait(150);
      }
      chat.addMessage({ from: "agent", text });
      await clock.wait(700);
    },
    listen(replies) {
      setAgent("listening");
      return new Promise<string>((resolve, reject) => {
        pending = { kind: "reply", resolve, reject };
        showReplies(replies);
        if (auto && replies.length) void clock.wait(2200).then(() => answer(replies[0], "auto"), () => {});
      }).then(async (text) => {
        setAgent("thinking");
        await clock.wait(700);
        return text;
      });
    },
    select(nodes) {
      setAgent("choosing");
      board.setSelectable(true);
      return new Promise<string>((resolve, reject) => {
        pending = { kind: "select", resolve, reject };
        if (auto) void clock.wait(2200).then(() => pickNode(nodes[0], nodes[0]), () => {});
      });
    },
    onMoment(m) {
      el.moment.textContent = m.title;
      emit("journey:moment", { id: m.id, title: m.title });
    },
    onStep(s, m) {
      emit("journey:step", { id: s.id, moment: m.id });
    },
  };

  // ---- Rodar / recomeçar ----
  async function start(): Promise<void> {
    clock.cancel(); // derruba esperas da execução anterior
    pending?.reject(new Cancelled());
    pending = null;
    board.setSelectable(false);
    el.replies.replaceChildren();
    el.captionAgent.textContent = "";
    el.captionUser.textContent = "";
    currentBoard = null;
    try {
      setAgent("thinking");
      await clock.wait(600);
      await createRunner(journey, profile, io).run();
      setAgent("done");
      el.moment.textContent = "aula completa";
      showReplies(["Recomeçar a aula"]);
      pending = { kind: "reply", resolve: () => void start(), reject: () => {} };
      el.hint.textContent = "Fim da aula.";
    } catch (err) {
      if (err instanceof Cancelled) return; // a aula recomeçou
      throw err;
    }
  }

  render();
  void start();
}

void main();
