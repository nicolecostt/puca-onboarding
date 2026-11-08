// Aula no quadro: a Puca conduz a jornada (src/journey/data/*.journey.json) e monta o quadro
// do Figma (components/whiteboard) enquanto explica. Conversa simulada: a pessoa responde pelas respostas sugeridas, pelo chat
// ou tocando no quadro. O perfil vem da call de entrevista; ?perfil=ana|bruno (ou novo|transicao)
// força um perfil da demo; ?auto=1 responde sozinho, para apresentar sem mexer no mouse.
import "../../styles/base.css";
import "./style.css";
import demo from "../../journey/data/tail.journey.json";
import { loadJourney } from "../../journey/validate";
import { createRunner, type Runner, type RunnerIO } from "../../journey/runner";
import { createClock, Cancelled } from "../../journey/clock";
import { mountWhiteboard, type Whiteboard } from "../../components/whiteboard/whiteboard";
import { whiteboardFromJourney } from "../../components/whiteboard/from-journey";
import { buildFaqs } from "../../journey/faq";
import { routeUtterance } from "../../journey/route";
import { createAgentVoice } from "../../voice/agent-voice";
import { interpolateDeep, resolveProfile } from "../../journey/profile";
import { resolveCalibragem } from "../../journey/calibragem";
import { montarJornadaDaPessoa } from "../../journey/jornada-da-pessoa";
import type { Moment, Profile, Step, Vinculo } from "../../journey/types";
import { mountAppHeader } from "../../components/app-header/app-header";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { mountJourneyPanel } from "../../components/journey-panel/journey-panel";
import { loadAgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import { emit } from "../../lib/events";
import { esc, qs } from "../../lib/dom";
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

/** Legenda até onde já foi falado, com o trecho de destaque marcado (se já chegou nele). */
function captionHTML(full: string, spokenLength: number, highlight?: string): string {
  const spoken = full.slice(0, spokenLength);
  const from = highlight ? full.indexOf(highlight) : -1;
  if (from < 0 || from >= spoken.length) return esc(spoken);
  const to = Math.min(spoken.length, from + (highlight?.length ?? 0));
  return `${esc(spoken.slice(0, from))}<mark>${esc(spoken.slice(from, to))}</mark>${esc(spoken.slice(to))}`;
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
  const chat = mountChatPanel({ title: "Transcrição da aula", messages: [] });
  mountCallBar({ chat, draggable: false }); // fixa; sem status: a legenda já mostra o que está acontecendo
  // a Puca aparece na "câmera" do canto, como numa videochamada
  const cam = mountAgentCam({ name: journey.agent.name, visual: await loadAgentVisual() });
  // Jornada da pessoa: a calibragem da call inicial marca cada momento (aprender, revisar, fora) e o painel mostra.
  const jornadaDaPessoa = montarJornadaDaPessoa(journey, resolveCalibragem(location.search).calibragem);
  const journeyPanel = mountJourneyPanel({ jornada: jornadaDaPessoa, final: "primeira-tarefa" });
  let visitados: string[] = [];
  let painelRecolhido = false; // recolhe sozinho uma vez, quando o quadro aparece; depois, só a pessoa abre e fecha
  // Voz de verdade (servidor em server/): sem ele, a aula segue só com legenda e chat.
  const voice = await createAgentVoice();
  const faqs = buildFaqs(journey, profile);
  const history: { role: "user" | "assistant"; content: string }[] = [];
  const remember = (role: "user" | "assistant", content: string) => {
    history.push({ role, content });
    if (history.length > 6) history.shift();
  };

  let paused = false;
  let ended = false;
  let agentState: AgentState = "thinking";
  let currentBoard: string | null = null;
  let board: Whiteboard | null = null;
  let currentStep: Step | null = null;

  // Resposta pendente: resposta sugerida, chat ou clique no quadro resolvem.
  let pending: { kind: "reply" | "select"; resolve: (v: string) => void; reject: (e: Error) => void; replies?: string[] } | null = null;
  let runner: Runner | null = null;
  let running = false;
  let currentMoment: Moment | null = null;

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
    board?.setSelectable(false);
    el.captionUser.textContent = said;
    p.resolve(id);
  }

  function onBoardSelect(id: string): void {
    const label = (journey.boards[currentBoard ?? ""]?.nodes.find((n) => n.id === id)?.label ?? id).replace("\n", " ");
    if (pending?.kind === "select") chat.addMessage({ from: "user", text: `(tocou em ${label})` });
    pickNode(id, label);
  }

  /** Interrompe o que a Puca está fazendo (fala, espera de resposta ou de clique) para pular de momento. */
  function interrupt(): void {
    clock.interrupt();
    const p = pending;
    pending = null;
    el.replies.replaceChildren();
    board?.setSelectable(false);
    p?.reject(new Cancelled());
  }

  /** Fala dita fora do roteiro (resposta da knowledge/FAQ ou do agente): legenda, chat e voz. */
  async function speakAside(text: string, play: () => Promise<void> = () => voice.speak(text)): Promise<void> {
    el.captionAgent.textContent = text;
    chat.addMessage({ from: "agent", text });
    remember("assistant", text);
    await play();
  }

  /** O agente pediu outro ponto da aula: resposta do passo atual que leva lá, ou pulo de momento. */
  function goTo(target: string): void {
    const t = currentStep?.transitions?.find((tr) => ("moment" in tr.to ? `moment:${tr.to.moment}` : `step:${tr.to.step}`) === target);
    if (t?.if && "reply" in t.if) return answer(t.if.reply, "chat");
    const id = target.startsWith("moment:") ? target.slice(7) : null;
    if (id && runner?.jumpTo(id)) interrupt();
  }

  /** Pulo pedido pela pessoa (chat, voz ou clique no painel "Sua jornada"): vai ao início do momento. */
  function pularPara(m: Moment): void {
    if (running && runner?.jumpTo(m.id)) {
      voice.stop();
      interrupt();
      void speakAside(`Claro, vamos para ${m.title.toLowerCase()}.`);
    }
  }

  // Fala da pessoa (chat ou voz). A ordem está em journey/route.ts: pulo → resposta sugerida → nome de
  // um item do quadro → conhecimento da aula → FAQ do nó → agente (ponte na hora + LLM no servidor).
  async function handleUtterance(text: string, from: "chat" | "voz"): Promise<void> {
    text = text.trim();
    if (!text) return;
    if (from === "voz") {
      el.captionUser.textContent = text;
      chat.addMessage({ from: "user", text });
    }
    const waiting = pending?.kind === "reply" ? { kind: "reply" as const, replies: pending.replies ?? [] } : pending?.kind === "select" ? { kind: "select" as const } : null;
    const route = routeUtterance(text, { journey, moment: currentMoment, step: currentStep, waiting, board: currentBoard, faqs });
    switch (route.kind) {
      case "jump":
        return pularPara(route.moment);
      case "reply":
        return answer(route.reply, "chat");
      case "select":
        return pickNode(route.node, text);
      case "knowledge":
        remember("user", text);
        return speakAside(route.text);
      case "faq":
        remember("user", text);
        for (const a of route.faq.actions) io.apply(a);
        return speakAside(route.faq.text);
    }
    // ask: o agente responde; a ponte sai na hora e o LLM vem atrás.
    remember("user", text);
    const asked =
      !!currentMoment &&
      !!currentStep &&
      (await voice.ask(
        { text, moment_id: currentMoment.id, step_id: currentStep.id, perfil: profile.vinculo, history: history.slice(0, -1) },
        { onSpeak: (t, play) => speakAside(t, play), onAction: (a) => io.apply(a), onGoTo: goTo },
      ));
    if (asked) return;
    if (pending?.kind === "reply") return answer(text, "chat");
    // sem servidor e sem fonte confiável: a dúvida fica anotada (§4.5, encaminhamento para uma pessoa)
    void speakAside("Não achei isso confirmado na documentação, então não quero chutar. Anotei a sua pergunta para a sua buddy responder.");
  }

  document.addEventListener("chatpanel:send", (e) => void handleUtterance(e.detail.text, "chat"));
  // Aula sob demanda: clicar num momento do painel leva ao início dele.
  document.addEventListener("journeypanel:pick", (e) => {
    const m = journey.moments.find((x) => x.id === e.detail.id);
    if (m && m.id !== currentMoment?.id && !paused && !ended) pularPara(m);
  });
  document.addEventListener("callbar:mute", (e) => voice.setMuted(!!e.detail.on));

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
      board?.destroy();
      board = mountWhiteboard(el.boardHost, whiteboardFromJourney(interpolateDeep(journey.boards[name], profile)));
      board.onSelect(onBoardSelect);
      currentBoard = name;
    }
  }

  // ---- io do motor ----
  const io: RunnerIO = {
    enterView(view, fresh) {
      if (view.mode === "logo") showLogo();
      else showBoard(view.board, fresh);
      if (view.mode === "board" && !painelRecolhido) {
        painelRecolhido = true;
        journeyPanel.toggle(false); // aberto, o painel tampa a esquerda do quadro
      }
    },
    apply(a) {
      if (!board) return;
      switch (a.type) {
        case "reveal": return board.reveal(a.targets);
        case "highlight": return board.highlight(a.targets, a.tone ?? "focus");
        case "clear_highlight": return board.clearHighlight();
        case "focus": return board.setFocus(a.target);
        case "flow": return board.flow(a.path);
        case "card": return board.openCard(a.target);
        case "close_card": return board.closeCard();
        case "reset": return board.reset();
      }
    },
    async say(text) {
      setAgent("speaking");
      el.captionUser.textContent = "";
      // trecho em amarelo: o highlight do passo, se esta fala for a fala do passo
      const highlight = currentStep?.highlight && text.includes(currentStep.highlight) ? currentStep.highlight : undefined;
      const words = text.split(" ");
      const audio = voice.speak(text); // voz de verdade junto com a legenda (sem servidor, resolve na hora)
      for (let i = 0; i < words.length; i++) {
        el.captionAgent.innerHTML = captionHTML(text, words.slice(0, i + 1).join(" ").length, highlight);
        await clock.wait(150);
      }
      chat.addMessage({ from: "agent", text });
      await audio;
      await clock.wait(voice.tts ? 250 : 700);
    },
    listen(replies) {
      setAgent("listening");
      return new Promise<string>((resolve, reject) => {
        pending = { kind: "reply", resolve, reject, replies };
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
      board?.setSelectable(true);
      return new Promise<string>((resolve, reject) => {
        pending = { kind: "select", resolve, reject };
        if (auto) void clock.wait(2200).then(() => pickNode(nodes[0], nodes[0]), () => {});
      });
    },
    onMoment(m) {
      currentMoment = m;
      if (!visitados.includes(m.id)) visitados.push(m.id);
      journeyPanel.setProgress(visitados, m.id);
      el.moment.textContent = m.title;
      emit("journey:moment", { id: m.id, title: m.title });
    },
    onStep(s, m) {
      currentStep = s;
      emit("journey:step", { id: s.id, moment: m.id });
    },
  };

  // ---- Rodar / recomeçar ----
  async function start(): Promise<void> {
    clock.cancel(); // derruba esperas da execução anterior
    pending?.reject(new Cancelled());
    pending = null;
    board?.setSelectable(false);
    el.replies.replaceChildren();
    el.captionAgent.textContent = "";
    el.captionUser.textContent = "";
    currentBoard = null;
    visitados = [];
    journeyPanel.setProgress(visitados, null);
    try {
      setAgent("thinking");
      await clock.wait(600);
      runner = createRunner(journey, profile, io);
      running = true;
      await runner.run();
      running = false;
      journeyPanel.setProgress(visitados, null);
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
  if (!voice.tts && !voice.stt) return void start();
  // O browser só libera som e microfone depois de um clique.
  const gate = document.createElement("button");
  gate.type = "button";
  gate.className = "voice-gate";
  gate.textContent = "Começar aula com voz";
  document.body.append(gate);
  gate.addEventListener("click", async () => {
    gate.remove();
    await voice.unlock();
    void voice.listen((t) => void handleUtterance(t, "voz"), (t) => (el.captionUser.textContent = t)).catch((e) => console.warn("microfone:", e));
    void start();
  });
}

void main();
