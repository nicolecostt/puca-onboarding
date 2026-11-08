// Sessão no quadro: Puca conduz a jornada (src/journey/data/*.journey.json) e monta o quadro
// do Figma (components/whiteboard) enquanto explica. Conversa simulada: a pessoa responde pelas respostas sugeridas, pelo chat
// ou tocando no quadro. O perfil vem da call de entrevista; ?perfil=ana|bruno (ou novo|transicao)
// força um perfil da demo; ?auto=1 responde sozinho, para apresentar sem mexer no mouse.
import "../../styles/base.css";
import "./style.css";
import demo from "../../journey/data/kota.journey.json";
import { loadJourney } from "../../journey/validate";
import { createRunner, type Runner, type RunnerIO } from "../../journey/runner";
import { createClock, Cancelled } from "../../journey/clock";
import { mountWhiteboard, type Whiteboard } from "../../components/whiteboard/whiteboard";
import { whiteboardFromJourney } from "../../components/whiteboard/from-journey";
import { buildFaqs } from "../../journey/faq";
import { routeUtterance } from "../../journey/route";
import { enviarNoSlackReal, lerEmailDoSlack } from "../../journey/slack-real";
import { browserStore } from "../../journey/storage";
import { buddyOf, createOutbox, looksLikeQuestion } from "../../journey/forwarding";
import { createPedidos, PEDIDOS_KEY, tarefaDaPessoa, tarefaDoPasso } from "../../journey/primeira-tarefa";
import { createTrail, sourcesFor } from "../../journey/trail";
import { createAgentVoice, MIC_AVISO } from "../../voice/agent-voice";
import { interpolate, interpolateDeep, resolveProfile } from "../../journey/profile";
import { atualizarCalibragem, resolveCalibragem, saveCalibragem } from "../../journey/calibragem";
import { montarJornadaDaPessoa } from "../../journey/jornada-da-pessoa";
import type { Moment, Profile, SpeechCue, Step, Vinculo } from "../../journey/types";
import { mountAppHeader } from "../../components/app-header/app-header";
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";
import { mountAgentCam } from "../../components/agent-cam/agent-cam";
import { mountJourneyPanel } from "../../components/journey-panel/journey-panel";
import { loadAgentVisual, type AgentVisualState } from "../../lib/agent-visual";
import { mountPucaDots } from "../../lib/puca-dots";
import { screenHref } from "../../lib/navigation";
import { completeSession, sessionCompleted } from "../../journey/session-progress";
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
const SOM_BLOQUEADO =
  "O navegador não liberou o som. Sigo com legenda e chat; para ouvir a voz, recarregue a página e clique de novo em Começar.";

/** Pessoa mostrada no cabeçalho: o perfil da demo, ou o que a entrevista coletou. */
function headerPerson(p: Profile, fromInterview: boolean): DemoProfile {
  const base = p.vinculo === "transicao" ? profiles.bruno : profiles.ana;
  if (!fromInterview) return base;
  const initials = p.nome.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
  // a entrevista não pergunta o time de origem
  return { ...base, name: p.nome, nickname: p.nome, initials, role: p.cargo ?? base.role, toTeam: p.time ?? base.toTeam, fromTeam: undefined };
}

/** Legenda da fala, palavra por palavra (como na call inicial): cada palavra guarda onde termina na fala,
 *  para aparecer quando a voz chegar nela. O trecho de destaque do passo vem marcado. */
function captionWords(full: string, highlight?: string): string {
  const from = highlight ? full.indexOf(highlight) : -1;
  const to = from + (highlight?.length ?? 0);
  const words = [...full.matchAll(/\S+/g)].map((m) => {
    const end = m.index + m[0].length;
    return { text: m[0], end, marked: from >= 0 && m.index < to && end > from };
  });
  // dentro do destaque, o espaço vai junto da palavra: a marca fica contínua
  return words
    .map((w, i) => {
      const joined = w.marked && words[i + 1]?.marked;
      return `<span class="word${w.marked ? " is-mark" : ""}" data-end="${w.end}">${esc(w.text)}${joined ? " " : ""}</span>${joined ? "" : " "}`;
    })
    .join("");
}

/** Mostra as palavras já faladas (até `spoken` caracteres). */
function revealWords(host: HTMLElement, spoken: number): void {
  for (const w of host.querySelectorAll<HTMLElement>(".word:not(.is-in)")) {
    if (Number(w.dataset.end) <= spoken) w.classList.add("is-in");
  }
}

async function main(): Promise<void> {
  const journey = loadJourney(demo);
  const auto = new URLSearchParams(location.search).get("auto") === "1";
  const resolved = resolveProfile(location.search);
  const profile = resolved.profile;

  // ---- Montagem da tela ----
  const header = mountAppHeader({ current: "lesson", profile: headerPerson(profile, resolved.source === "entrevista") });
  const brand = qs<HTMLAnchorElement>(header, ".app-header__brand");
  const homeHref = brand.href;
  if (!sessionCompleted(profile)) {
    brand.removeAttribute("href");
    brand.setAttribute("aria-label", "Orbis");
  }
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
    forwardToast: qs(document, "#forward-toast"),
    forwardText: qs(document, "#forward-text"),
    forwardLink: qs<HTMLAnchorElement>(document, "#forward-link"),
  };
  el.lessonName.textContent = journey.title;
  mountPucaDots(qs(document, "#caption-orb")); // Puca na legenda: as bolinhas dela se mexendo

  const clock = createClock();
  const chat = mountChatPanel({ title: "Transcrição da sessão", messages: [] });
  // Puca aparece na "câmera" do canto, como numa videochamada; os controles ficam presos embaixo dela
  const cam = mountAgentCam({ name: journey.agent.name, visual: await loadAgentVisual() });
  const bar = mountCallBar({ chat, attachTo: cam }); // sem status: a legenda já mostra o que está acontecendo
  // Jornada da pessoa: a calibragem da call inicial marca cada momento (aprender, revisar, fora) e o painel mostra.
  // A checagem da sessão atualiza a calibragem e o painel (§4.2 e §12.1: atualiza os objetivos que faltam).
  const calibrada = resolveCalibragem(location.search);
  let calibragem = calibrada.calibragem;
  const journeyPanel = mountJourneyPanel({ jornada: montarJornadaDaPessoa(journey, calibragem) });
  let visitados: string[] = [];
  let painelRecolhido = false; // recolhe sozinho uma vez, quando o quadro aparece; depois, só a pessoa abre e fecha
  // Voz de verdade (servidor em server/): sem ele, a sessão segue só com legenda e chat.
  const voice = await createAgentVoice();
  const faqs = buildFaqs(journey, profile);
  // Rastro de cada fala (caminho, resposta e fonte): a tela de demo src/screens/rastro/ mostra.
  const trail = createTrail(browserStore());
  // Encaminhamentos à buddy: a tela do Slack (src/screens/live-session/) envia.
  const outbox = createOutbox(browserStore());
  const buddy = buddyOf(journey);
  // Primeira tarefa (§4.4 e §12.1, passo 5): o pedido de aprovação ao gestor; a tela do Slack envia e grava a aprovação.
  const pedidos = createPedidos(browserStore());
  // A tarefa da pessoa (pelo vínculo): responde as dúvidas sobre ela durante a sessão (#79).
  const tarefaDaSessao = tarefaDaPessoa(journey, profile);
  let pedidoDaSessao: string | null = null;
  const aprovacaoAvisada = new Set<string>();
  const history: { role: "user" | "assistant"; content: string }[] = [];
  const remember = (role: "user" | "assistant", content: string) => {
    history.push({ role, content });
    if (history.length > 6) history.shift();
  };

  const homeLink = Object.assign(document.createElement("a"), {
    className: "orbis-link",
    href: screenHref("../inicio/"),
    textContent: "Ir para o Início",
  });

  let paused = false;
  let ended = false;
  let micOk = false; // o microfone está ouvindo (sem ele, a conversa segue pelo chat)
  let agentState: AgentState = "thinking";
  let currentBoard: string | null = null;
  let board: Whiteboard | null = null;
  let currentStep: Step | null = null;

  // Resposta pendente: resposta sugerida, chat ou clique no quadro resolvem.
  let pending: { kind: "reply" | "select"; resolve: (v: string) => void; reject: (e: Error) => void; replies?: string[] } | null = null;
  let runner: Runner | null = null;
  let running = false;
  // A sessão está começando (antes de o runner rodar): um pulo pedido agora fica guardado e vale quando ela começar.
  let iniciando = false;
  let puloPendente: Moment | null = null;
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
    el.voice.setAttribute("aria-label", ended ? "Sessão encerrada" : paused ? "Puca pausada" : voice === "talk" ? "Puca falando" : micOk ? "Puca ouvindo" : "Puca esperando pelo chat");
    el.liveDot.classList.toggle("is-off", off);
    cam.setPaused(off);
    if (!off) cam.setState(CAM_STATE[agentState]);
    for (const b of el.replies.querySelectorAll<HTMLButtonElement>("button")) b.disabled = off;
    el.hint.textContent = ended
      ? ""
      : paused
        ? "Sessão pausada."
        : agentState === "listening"
          ? "Escolha uma opção ou responda pelo chat."
          : agentState === "choosing"
            ? "Toque num item do quadro (ou escreva o nome no chat)."
            : "";
    if (!off && agentState === "done" && sessionCompleted(profile)) el.hint.append(homeLink);
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

  /** Interrompe o que Puca está fazendo (fala, espera de resposta ou de clique) para pular de momento. */
  function interrupt(): void {
    clock.interrupt();
    encerrarVez(); // a fala que esperava a vez cai no Cancelled do pulo
    const p = pending;
    pending = null;
    el.replies.replaceChildren();
    board?.setSelectable(false);
    p?.reject(new Cancelled());
  }

  // ---- A vez de falar ----
  // A pessoa toma a vez quando fala por cima de Puca ou manda uma pergunta: a fala do passo para, Puca responde e
  // depois repete a fala cortada. `vez` existe enquanto uma fala do passo espera a pessoa ser atendida.
  let falando = false; // uma fala do passo está tocando agora
  let atendendo = 0; // falas da pessoa sendo respondidas agora
  let vez: { promise: Promise<void>; resolve: () => void } | null = null;

  function tomarAVez(): void {
    voice.stop();
    if (!falando || vez) return;
    let resolve = () => {};
    const promise = new Promise<void>((r) => (resolve = r));
    vez = { promise, resolve };
  }

  function encerrarVez(): void {
    const v = vez;
    vez = null;
    v?.resolve();
  }

  /** Espera a pessoa ser atendida; sem fala completa em 4 s de call ativa, foi um barulho e Puca retoma. */
  async function esperarAVez(): Promise<void> {
    const v = vez;
    if (!v) return;
    void clock.wait(4000).then(() => vez === v && atendendo === 0 && encerrarVez(), () => {});
    await v.promise;
  }

  /** Fala dita fora do roteiro (resposta da knowledge/FAQ ou do agente): legenda, chat e voz. */
  async function speakAside(text: string, play: () => Promise<void> = () => voice.speak(text)): Promise<void> {
    el.captionAgent.innerHTML = captionWords(text);
    requestAnimationFrame(() => revealWords(el.captionAgent, text.length));
    chat.addMessage({ from: "agent", text });
    remember("assistant", text);
    await play();
  }

  /** Fontes que Puca tinha à mão: as do quadro na tela e o conhecimento do momento. */
  function consultedNow(): string[] {
    const nodes = currentBoard ? (journey.boards[currentBoard]?.nodes ?? []) : [];
    const docs = nodes.flatMap((n) => [...(n.info?.docs ?? []).map((d) => d.title), ...(n.info?.adr ? [n.info.adr.id] : [])]);
    const knowledge = currentMoment?.knowledge ? [`Conhecimento da sessão: ${currentMoment.title}`] : [];
    return [...new Set([...docs, ...knowledge])];
  }

  let toastTimer = 0;
  /** Aviso no canto da sessão, com um link para a outra tela (Slack ou página da tarefa). */
  function showToast(text: string, link: { href: string; target: string; label: string }): void {
    el.forwardText.textContent = text;
    el.forwardLink.href = link.href;
    el.forwardLink.target = link.target;
    el.forwardLink.textContent = link.label;
    el.forwardToast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (el.forwardToast.hidden = true), 8000);
  }
  const SLACK = { href: screenHref("../live-session/"), target: "puca-slack", label: "Abrir Slack" };

  /** Encaminha a dúvida à buddy (§4.5): guarda para o Slack, marca no rastro e avisa na sessão. */
  function forward(entryId: string, f: { question: string; summary: string; reason: string; consulted?: string[] }): void {
    const consulted = [...new Set([...(f.consulted ?? []), ...consultedNow()])];
    const created = outbox.add({ ...f, to: { name: buddy, role: "buddy" }, pessoa: profile.nome, consulted, moment: currentMoment?.id ?? null });
    trail.update(entryId, { forwarding_id: created.id });
    showToast(`Encaminhado à ${buddy} no Slack`, SLACK);
    // com o e-mail do Slack da Kota, o servidor manda de verdade; senão, o Slack simulado envia (#129)
    void enviarNoSlackReal(created, { outbox, email: lerEmailDoSlack(browserStore()) }).then((link) => {
      if (!link) return;
      trail.update(entryId, { forwarding_link: link });
      showToast("Mandei a dúvida no seu Slack da Kota", { href: link, target: "_blank", label: "Abrir no Slack" });
    });
  }

  /** O passo abriu o cartão de uma tarefa do catálogo: pede a aprovação do gestor (o Slack envia). */
  function entregarTarefa(step: Step, momentId: string): void {
    const tarefa = tarefaDoPasso(journey, step);
    if (!tarefa) return;
    const gestor = profile.gestor?.trim();
    if (!gestor) {
      console.warn("primeira tarefa: perfil sem gestor, o pedido de aprovação não foi criado");
      return;
    }
    // a mesma pessoa, tarefa e sessão devolvem o pedido que já existe: recomeçar não pede de novo, página nova pede
    const p = pedidos.add({ pessoa: profile.nome, gestor, tarefa, moment: momentId, sessao: trail.session });
    pedidoDaSessao = p.id;
    if (p.status === "aprovada") aprovacaoAvisada.add(p.id);
    else showToast(`Pedido de aprovação enviado a ${gestor} no Slack`, SLACK);
  }

  // O gestor aprovou no Slack (outra aba): avisa uma vez, com o link para a página da tarefa.
  addEventListener("storage", (e) => {
    if (e.key !== PEDIDOS_KEY || !pedidoDaSessao || aprovacaoAvisada.has(pedidoDaSessao)) return;
    const p = pedidos.list().find((x) => x.id === pedidoDaSessao);
    if (p?.status !== "aprovada") return;
    aprovacaoAvisada.add(p.id);
    showToast(`${p.aprovada_por ?? p.gestor} aprovou a sua primeira tarefa`, {
      href: screenHref(`../primeira-tarefa/?id=${encodeURIComponent(p.id)}`),
      target: "puca-tarefa",
      label: "Ver tarefa",
    });
  });

  /** O agente pediu outro ponto da sessão: resposta do passo atual que leva lá, ou pulo de momento. */
  function goTo(target: string): void {
    const t = currentStep?.transitions?.find((tr) => ("moment" in tr.to ? `moment:${tr.to.moment}` : `step:${tr.to.step}`) === target);
    if (t?.if && "reply" in t.if) return answer(t.if.reply, "chat");
    const id = target.startsWith("moment:") ? target.slice(7) : null;
    if (id && runner?.jumpTo(id)) interrupt();
  }

  /** Pulo pedido pela pessoa (chat, voz ou clique no painel "Sua jornada"): vai ao início do momento. */
  /** Pula para o início do momento; devolve o que Puca disse (null se o pulo não aconteceu). */
  function pularPara(m: Moment): string | null {
    if (ended) return null;
    const line = `Claro, vamos para ${m.title.toLowerCase()}.`;
    if (!runner || iniciando) {
      // a sessão ainda não rodou: guarda o pulo; o start() aplica e fala quando ela começar
      puloPendente = m;
      return line;
    }
    if (!running) {
      puloPendente = m;
      void start();
      return line;
    }
    if (!runner.jumpTo(m.id)) return null;
    voice.stop();
    interrupt();
    void speakAside(line);
    return line;
  }

  // Fala da pessoa (chat ou voz). A ordem está em journey/route.ts: pulo → resposta sugerida → dúvida da primeira
  // tarefa → nome de um item do quadro → FAQ do nó → conhecimento da sessão → agente (ponte na hora + LLM no servidor).
  async function handleUtterance(text: string, from: "chat" | "voz"): Promise<void> {
    text = text.trim();
    if (!text || paused || ended) return;
    atendendo++;
    try {
      await atenderFala(text, from);
    } finally {
      atendendo--;
      if (atendendo === 0) encerrarVez(); // a fala do passo que foi cortada pode voltar
    }
  }

  async function atenderFala(text: string, from: "chat" | "voz"): Promise<void> {
    if (from === "voz") {
      el.captionUser.textContent = text;
      chat.addMessage({ from: "user", text });
    }
    const waiting = pending?.kind === "reply" ? { kind: "reply" as const, replies: pending.replies ?? [], check: !!currentStep?.check } : pending?.kind === "select" ? { kind: "select" as const } : null;
    const route = routeUtterance(text, {
      journey,
      moment: currentMoment,
      step: currentStep,
      waiting,
      board: currentBoard,
      faqs,
      tarefa: tarefaDaSessao,
      tarefaApresentada: visitados.includes("primeira-tarefa"),
    });
    const entry = trail.record({
      from,
      utterance: text,
      route: route.kind,
      answer: "",
      sources: sourcesFor(route, journey, currentMoment),
      moment: currentMoment?.id ?? null,
      step: currentStep?.id ?? null,
    });
    // resposta sugerida e clique no quadro só respondem o passo; o resto Puca responde, então a pessoa toma a vez
    if (route.kind !== "reply" && route.kind !== "select") tomarAVez();
    switch (route.kind) {
      case "jump": {
        const line = pularPara(route.moment);
        if (line) trail.update(entry.id, { answer: line });
        return;
      }
      case "reply":
        return answer(route.reply, "chat");
      case "select":
        return pickNode(route.node, text);
      case "knowledge":
        remember("user", text);
        trail.update(entry.id, { answer: route.text });
        return speakAside(route.text);
      case "tarefa": {
        remember("user", text);
        const r = route.resposta;
        if (r.kind === "sem_fonte") {
          // a tarefa não diz isso: não chuta, encaminha à buddy com o motivo (§4.5)
          const line = "Isso não está na tarefa, então não quero chutar. Já encaminhei a sua pergunta no Slack.";
          trail.update(entry.id, { answer: line });
          // a tarefa foi o que Puca consultou (§4.5: o encaminhamento leva o que já foi consultado)
          const daTarefa = tarefaDaSessao ? [`Primeira tarefa · ${tarefaDaSessao.titulo}`] : [];
          forward(entry.id, { question: text, summary: text, reason: r.motivo, consulted: daTarefa });
          return speakAside(line);
        }
        trail.update(entry.id, { answer: r.texto });
        const noQuadro = currentBoard && journey.boards[currentBoard]?.nodes.some((n) => n.id === tarefaDaSessao?.no);
        if (r.kind === "resposta" && noQuadro && tarefaDaSessao) io.apply({ type: "highlight", targets: [tarefaDaSessao.no], tone: "focus" });
        return speakAside(r.texto);
      }
      case "faq": {
        remember("user", text);
        // dono sem fonte confiável: a dúvida vai para a buddy, com contexto
        const said = route.faq.unconfirmed ? `${route.faq.text} Já encaminhei a sua pergunta no Slack.` : route.faq.text;
        trail.update(entry.id, { answer: said });
        for (const a of route.faq.actions) io.apply(a);
        if (route.faq.unconfirmed) {
          forward(entry.id, { question: text, summary: text, reason: `Não há responsável confirmado para o ${route.faq.label} nas fontes da ${journey.company}.` });
        }
        return speakAside(said);
      }
    }
    // ask: o agente responde; a ponte sai na hora e o LLM vem atrás.
    remember("user", text);
    const said: string[] = [];
    const t0 = performance.now();
    const asked =
      !!currentMoment &&
      !!currentStep &&
      (await voice.ask(
        { text, moment_id: currentMoment.id, step_id: currentStep.id, perfil: profile.vinculo, history: history.slice(0, -1) },
        {
          onSpeak: (t, play) => {
            said.push(t);
            return speakAside(t, play);
          },
          onAction: (a) => io.apply(a),
          onGoTo: goTo,
          onEscalate: (summary) => forward(entry.id, { question: text, summary, reason: "Não encontrei fonte confiável para responder." }),
          // custo da sessão (#52): só no rastro, para auditar; nada em tela
          onTiming: (t) =>
            trail.update(entry.id, { llm_ms: t.total_ms, llm_error: t.llm_error ?? undefined, tokens_in: t.tokens_in ?? undefined, tokens_out: t.tokens_out ?? undefined, tokens_estimated: t.tokens_estimated }),
        },
      ));
    // gravado mesmo se a pessoa interrompeu: fica a resposta parcial
    if (asked) return trail.update(entry.id, { answer: said.join(" "), ms: Math.round(performance.now() - t0) });
    // numa checagem só chega aqui pergunta (resposta vai pela rota): não conta como resposta, Puca repete a pergunta
    if (pending?.kind === "reply" && currentStep?.check) {
      const line = `Sem problema, repito: ${interpolate(currentStep.line, profile)}`;
      trail.update(entry.id, { answer: line });
      return speakAside(line);
    }
    if (pending?.kind === "reply") return answer(text, "chat");
    // sem servidor e sem fonte confiável: a dúvida fica anotada (§4.5, encaminhamento para uma pessoa)
    const line = "Não achei isso confirmado na documentação, então não quero chutar. Anotei a sua pergunta para a sua buddy responder.";
    trail.update(entry.id, { answer: line });
    // "ok" ou "valeu" não vão para a buddy
    if (looksLikeQuestion(text)) forward(entry.id, { question: text, summary: text, reason: "Estava sem acesso ao agente e não achei isso na sessão." });
    await speakAside(line);
  }

  document.addEventListener("chatpanel:send", (e) => void handleUtterance(e.detail.text, "chat"));
  // Sessão sob demanda: clicar num momento do painel leva ao início dele.
  document.addEventListener("journeypanel:pick", (e) => {
    const m = journey.moments.find((x) => x.id === e.detail.id);
    if (m && (!running || m.id !== currentMoment?.id) && !paused && !ended) pularPara(m);
  });
  document.addEventListener("callbar:mute", (e) => voice.setMuted(!!e.detail.on));

  // ---- Barra de call ----
  document.addEventListener("callbar:pause", (e) => {
    paused = !!e.detail.on;
    clock.setPaused(paused);
    // a voz para na mesma palavra (o quadro, que segue as palavras, para junto) e o microfone fica mudo
    if (paused) voice.pause();
    else voice.resume();
    render();
  });
  document.addEventListener("callbar:end", () => {
    ended = true;
    tomarAVez(); // corta a voz; a fala do passo que estava tocando volta quando a call voltar
    voice.stopListening(); // e o microfone desliga (para de mandar áudio ao STT)
    trail.endSession();
    clock.setEnded(true);
    cam.hide();
    render();
    // nesta tela não há "Ligar para Puca" no canto: a call some e um botão no centro retoma a sessão
    document.body.classList.add("is-call-off");
    showGate("Voltar para a sessão", () => {
      document.body.classList.remove("is-call-off");
      bar.start();
      emit("callbar:start", {});
      window.setTimeout(() => cam.sync(), 300);
    });
  });
  document.addEventListener("callbar:start", () => {
    ended = false;
    trail.startSession(); // retomar a call reabre a sessão (#52)
    clock.setEnded(false);
    cam.show();
    ouvir();
    encerrarVez(); // a fala cortada pelo encerramento volta já, sem esperar
    render();
  });

  /** Liga o microfone (de novo, ao retomar a call). Se não der, Puca avisa no chat e a conversa segue por ele. */
  function ouvir(): void {
    void voice.listen({
      onFinal: (t) => void handleUtterance(t, "voz"),
      onCaption: (t) => (el.captionUser.textContent = t),
      onBargeIn: tomarAVez,
      onState: (s) => {
        micOk = s === "ouvindo";
        if (s !== "ouvindo") chat.addMessage({ from: "agent", text: MIC_AVISO[s] });
        render();
      },
    });
  }

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

  /** Uma fala do passo: voz, legenda palavra a palavra e as ações marcadas com `at`. Para se a pessoa tomar a vez. */
  async function falar(text: string, cues: SpeechCue[]): Promise<void> {
    setAgent("speaking");
    el.captionUser.textContent = "";
    // trecho em amarelo: o highlight do passo, se esta fala for a fala do passo
    const highlight = currentStep?.highlight && text.includes(currentStep.highlight) ? currentStep.highlight : undefined;
    // Até onde a fala já chegou (em caracteres): move a legenda e dispara as ações marcadas com `at`.
    const ends = [...text.matchAll(/\S+/g)].map((m) => m.index + m[0].length);
    let spoken = 0;
    let next = 0;
    el.captionAgent.innerHTML = captionWords(text, highlight);
    const advance = (to: number) => {
      if (to <= spoken) return;
      spoken = to;
      revealWords(el.captionAgent, spoken);
      while (next < cues.length && cues[next].at < spoken) io.apply(cues[next++].action);
    };
    let heard = false; // chegou o tempo de alguma palavra do áudio
    let finished = false;
    // Pulo ou reinício no meio da fala: o relógio muda de geração. Com voz, nada do relógio fica esperando
    // durante o áudio, então `watch` derruba a espera e `cut()` impede de seguir com a fala antiga.
    const gen = clock.generation;
    const cut = () => clock.generation !== gen;
    const watch = (async () => {
      while (!finished) await clock.wait(100);
    })();
    watch.catch(() => {});
    // estimativa de 150 ms por palavra, a partir de onde a fala está; uma só por vez
    let estimating: Promise<void> | null = null;
    const estimate = () =>
      (estimating ??= (async () => {
        for (const end of ends) {
          if (heard || finished || vez) return; // a pessoa tomou a vez: a legenda para onde a fala parou
          if (end <= spoken) continue;
          advance(end);
          await clock.wait(150);
        }
      })());
    falando = true;
    try {
      // com voz, a legenda e o quadro seguem as palavras do áudio; sem voz, a estimativa de 150 ms por palavra
      const audio = voice.speak(text, {
        onWord: (i) => {
          if (i < 0 || finished) return;
          heard = true;
          advance(ends[Math.min(i, ends.length - 1)]);
        },
      });
      if (voice.tts) {
        // áudio sem tempo das palavras: depois de 2 s sem nenhuma, volta para a estimativa
        void clock.wait(2000).then(() => (heard || finished ? undefined : estimate())).catch(() => {});
        await Promise.race([audio, watch]);
        if (cut()) throw new Cancelled();
        if (!heard && !vez) await estimate(); // áudio falhou ou veio sem os tempos: termina no ritmo da estimativa
      } else await estimate();
    } finally {
      falando = false;
      finished = true;
      // fala cortada ou áudio que falhou: o quadro chega ao estado final do passo. Num pulo, a legenda
      // já é a resposta do pulo; com a pessoa tomando a vez, a legenda para onde Puca parou: só as ações que faltavam.
      if (cut() || vez) while (next < cues.length) io.apply(cues[next++].action);
      else advance(text.length);
    }
    if (cut()) throw new Cancelled();
    if (vez) return; // cortada pela pessoa: say() repete depois de responder
    chat.addMessage({ from: "agent", text });
    await clock.wait(voice.tts ? 250 : 700);
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
    async say(text, cues = []) {
      const gen = clock.generation;
      await falar(text, cues);
      // a pessoa tomou a vez no meio da fala: espera a resposta e repete a fala (o quadro já está no estado final)
      while (vez) {
        await esperarAVez();
        if (clock.generation !== gen) throw new Cancelled(); // foi um pulo
        await clock.whenRunning();
        await falar("Voltando ao que eu falava.", []);
        if (!vez) await falar(text, []);
      }
    },
    listen(replies) {
      setAgent("listening");
      return new Promise<string>((resolve, reject) => {
        pending = { kind: "reply", resolve, reject, replies };
        showReplies(replies);
        // Na demo automática, encerra em vez de voltar ao quadro pelo primeiro botão.
        const autoReply = replies.find((reply) => reply === "Terminar por hoje") ?? replies[0];
        if (auto && autoReply) void clock.wait(2200).then(() => answer(autoReply, "auto"), () => {});
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
    onCheck(r) {
      calibragem = atualizarCalibragem(calibragem, r);
      // perfil de demo pela URL não sobrescreve a calibragem que a call inicial gravou
      if (calibrada.source !== "url") saveCalibragem(calibragem);
      journeyPanel.setJornada(montarJornadaDaPessoa(journey, calibragem));
    },
    onStep(s, m) {
      currentStep = s;
      entregarTarefa(s, m.id);
      emit("journey:step", { id: s.id, moment: m.id });
    },
  };

  /** Botão no centro da tela, enquanto a call não está ligada. Some ao clicar. */
  function showGate(label: string, onClick: () => void): void {
    document.querySelector(".voice-gate")?.remove();
    const gate = document.createElement("button");
    gate.type = "button";
    gate.className = "voice-gate";
    gate.textContent = label;
    document.body.append(gate);
    gate.addEventListener("click", () => {
      gate.remove();
      onClick();
    });
  }

  // ---- Rodar / recomeçar ----
  async function start(): Promise<void> {
    iniciando = true;
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
      trail.startSession();
      running = true;
      iniciando = false;
      const run = runner.run();
      // pulo pedido antes de a sessão rodar (#65): vale uma vez, agora que o runner existe
      const pulo = puloPendente;
      puloPendente = null;
      if (pulo) pularPara(pulo);
      const result = await run;
      if (result.ended === "done") {
        completeSession(profile);
        brand.href = homeHref;
        brand.setAttribute("aria-label", "Orbis, início");
      }
      running = false;
      trail.endSession();
      journeyPanel.setProgress(visitados, null);
      setAgent("done");
      el.moment.textContent = "sessão completa";
      showReplies(["Recomeçar a sessão"]);
      pending = { kind: "reply", resolve: () => void start(), reject: () => {} };
    } catch (err) {
      if (err instanceof Cancelled) return; // a sessão recomeçou
      throw err;
    }
  }

  render();
  if (!voice.tts && !voice.stt) return void start();
  // O browser só libera som e microfone depois de um clique. Até lá, a câmera e os controles da call não aparecem.
  document.body.classList.add("is-call-off");
  showGate("Começar sessão com voz", async () => {
    document.body.classList.remove("is-call-off");
    window.setTimeout(() => cam.sync(), 300);
    // sem gesto reconhecido, o navegador pode segurar o áudio: a sessão começa assim mesmo, com legenda
    if (!(await voice.unlock())) chat.addMessage({ from: "agent", text: SOM_BLOQUEADO });
    ouvir();
    void start();
  });
}

void main();
