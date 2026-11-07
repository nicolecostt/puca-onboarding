// Aula no quadro: o Puca conduz a jornada (src/journey/data/*.journey.json) e monta o quadro
// enquanto explica. Conversa simulada: a pessoa responde pelos botões de resposta sugerida,
// pelo chat ou tocando no quadro. ?perfil=novo|transicao escolhe o perfil; ?auto=1 responde sozinho (demo).
import "./style.css";
import demo from "../../journey/data/orla-pagamentos.journey.json";
import { loadJourney } from "../../journey/validate";
import { createRunner, type RunnerIO } from "../../journey/runner";
import { createClock, Cancelled } from "../../journey/clock";
import { mountBoard } from "../../journey/board/board";
import { normalize } from "../../journey/conditions";
import { DEMO_PROFILES, interpolateDeep, resolveProfile } from "../../journey/profile";
import type { Profile, Vinculo } from "../../journey/types";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { loadAgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import { emit } from "../../lib/events";
import { qs } from "../../lib/dom";

type AgentState = "speaking" | "listening" | "choosing" | "thinking" | "done";

const STATUS: Record<AgentState, string> = {
  speaking: "Puca explicando…",
  listening: "Esperando você…",
  choosing: "Toque no quadro…",
  thinking: "Pensando…",
  done: "Aula concluída",
};
const CAM_STATE: Record<AgentState, AgentVisualState> = {
  speaking: "talk",
  listening: "idle",
  choosing: "idle",
  thinking: "think",
  done: "idle",
};
const VINCULO_LABEL: Record<Vinculo, string> = { novo: "Recém-contratado", transicao: "Mudando de time" };

async function main(): Promise<void> {
  const journey = loadJourney(demo);
  const params = new URLSearchParams(location.search);
  const auto = params.get("auto") === "1";

  const el = {
    momentLabel: qs(document, "#moment-label"),
    timer: qs(document, "#timer"),
    live: qs(document, "#live"),
    logoView: qs(document, "#logo-view"),
    logoCompany: qs(document, "#logo-company"),
    logoTitle: qs(document, "#logo-title"),
    logoWho: qs(document, "#logo-who"),
    boardHost: qs(document, "#board-host"),
    captionAgent: qs(document, "#caption-agent"),
    captionUser: qs(document, "#caption-user"),
    replies: qs(document, "#replies"),
    hint: qs(document, "#caption-hint"),
  };

  const clock = createClock();
  const chat = mountChatPanel({ title: "Transcrição da aula", messages: [] });
  const call = mountCallBar({ status: "Conectando…", chat });
  const cam = mountAgentCam({ name: journey.agent.name, visual: await loadAgentVisual() });
  const board = mountBoard(el.boardHost);

  let profile: Profile = resolveProfile(location.search).profile;
  let paused = false;
  let ended = false;
  let agentState: AgentState = "thinking";

  // Resposta pendente: botão de resposta sugerida, chat ou clique no quadro resolvem.
  let pending: { kind: "reply" | "select"; resolve: (v: string) => void; reject: (e: Error) => void; nodes?: string[] } | null = null;

  // ---------- estado visível ----------
  function setAgent(s: AgentState): void {
    agentState = s;
    render();
  }

  function render(): void {
    call.setStatus(ended ? "" : paused ? "Aula pausada" : STATUS[agentState]);
    cam.setState(CAM_STATE[agentState]);
    cam.setPaused(paused);
    el.live.classList.toggle("is-off", ended);
    for (const b of el.replies.querySelectorAll<HTMLButtonElement>("button")) b.disabled = paused || ended;
    el.hint.textContent = ended
      ? "Use “Ligar para o agente” para continuar de onde parou."
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

  // ---------- perfil da demo ----------
  const switchBtns = [...document.querySelectorAll<HTMLButtonElement>(".profile-switch__opt")];
  function renderSwitch(): void {
    for (const b of switchBtns) b.setAttribute("aria-checked", String(b.dataset.vinculo === profile.vinculo));
  }
  for (const b of switchBtns) {
    b.addEventListener("click", () => {
      const v = b.dataset.vinculo as Vinculo;
      if (v === profile.vinculo) return;
      const url = new URL(location.href);
      url.searchParams.set("perfil", v);
      history.replaceState(null, "", url);
      profile = DEMO_PROFILES[v];
      void start();
    });
  }

  // ---------- respostas ----------
  function showReplies(replies: string[]): void {
    el.replies.replaceChildren(
      ...replies.map((r, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "reply-chip";
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

  board.onSelect((id) => {
    if (!pending || pending.kind !== "select" || paused || ended) return;
    const p = pending;
    pending = null;
    board.setSelectable(false);
    const label = journey.boards[currentBoard ?? ""]?.nodes.find((n) => n.id === id)?.label ?? id;
    el.captionUser.textContent = label;
    chat.addMessage({ from: "user", text: `(tocou em ${label})` });
    p.resolve(id);
  });

  document.addEventListener("chatpanel:send", (e) => {
    const text = e.detail.text.trim();
    if (!text) return;
    if (pending?.kind === "reply") return answer(text, "chat");
    if (pending?.kind === "select") {
      // escreveu o nome de um item do quadro em vez de tocar nele
      const nodes = journey.boards[currentBoard ?? ""]?.nodes ?? [];
      const said = normalize(text);
      const hit = nodes.find((n) => said.includes(normalize(n.label)) || said.includes(normalize(n.id)));
      if (hit) {
        const p = pending;
        pending = null;
        board.setSelectable(false);
        el.captionUser.textContent = text;
        p.resolve(hit.id);
        return;
      }
    }
    // Nesta versão o roteiro é fixo: a pergunta fica anotada (§4.5 — encaminhamento humano).
    chat.addMessage({
      from: "agent",
      text: "Anotei a sua pergunta. Nesta versão eu sigo o roteiro da aula, mas ela fica registrada para a sua buddy responder.",
    });
  });

  // ---------- barra de call ----------
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

  // ---------- vistas ----------
  let currentBoard: string | null = null;

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

  // ---------- io do motor ----------
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
        pending = { kind: "select", resolve, reject, nodes };
        if (auto) {
          void clock.wait(2200).then(() => {
            if (pending?.kind !== "select") return;
            const p = pending;
            pending = null;
            board.setSelectable(false);
            p.resolve(nodes[0]);
          }, () => {});
        }
      });
    },
    onMoment(m) {
      el.momentLabel.textContent = `Aula · ${m.title}`;
      emit("journey:moment", { id: m.id, title: m.title });
    },
    onStep(s, m) {
      emit("journey:step", { id: s.id, moment: m.id });
    },
  };

  // ---------- rodar / reiniciar ----------
  let runId = 0;
  async function start(): Promise<void> {
    const id = ++runId;
    clock.cancel(); // derruba esperas da execução anterior
    pending?.reject(new Cancelled());
    pending = null;
    board.setSelectable(false);
    el.replies.replaceChildren();
    el.captionAgent.textContent = "";
    el.captionUser.textContent = "";
    currentBoard = null;
    chat.newConversation();
    renderSwitch();
    try {
      await clock.wait(600);
      await createRunner(journey, profile, io).run();
      if (id !== runId) return;
      setAgent("done");
      el.momentLabel.textContent = "Aula concluída";
      showReplies(["Recomeçar a aula"]);
      pending = { kind: "reply", resolve: () => void start(), reject: () => {} };
      el.hint.textContent = "Fim da aula.";
    } catch (err) {
      if (err instanceof Cancelled) return; // troca de perfil reiniciou a aula
      throw err;
    }
  }

  render();
  void start();
}

void main();
