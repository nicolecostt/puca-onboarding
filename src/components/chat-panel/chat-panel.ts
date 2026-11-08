// Painel de chat flutuante (Figma: "Chat (floating window)", nó 44:369).
//   const chat = mountChatPanel();   // começa fechado
//   chat.open(); chat.close(); chat.toggle(); chat.addMessage({ from: "agent", text });
// Eventos no document: chatpanel:change { open }, chatpanel:send { text }
import "../../styles/tokens.css";
import "./chat-panel.css";
import threadsIcon from "./icons/threads.svg";
import newConversationIcon from "./icons/new-conversation.svg";
import closeIcon from "./icons/close.svg";
import stopIcon from "./icons/stop.svg";
import chevronIcon from "./icons/chevron.svg";
import spinnerIcon from "./icons/spinner.svg";
import shotBg from "./icons/shot-bg.svg";
import shotTopbar from "./icons/shot-topbar.svg";
import shotLine1 from "./icons/shot-line1.svg";
import shotLine2 from "./icons/shot-line2.svg";
import shotLine3 from "./icons/shot-line3.svg";
import shotButton from "./icons/shot-button.svg";
import { esc, qs, targetEl } from "../../lib/dom";
import { emit } from "../../lib/events";
import { makeDraggable } from "../../lib/draggable";

export interface ActionStep {
  name: string;
  done?: boolean;
  /** Texto do botão na miniatura da captura de tela (se tiver captura). */
  shot?: string;
}

export type ChatMessage =
  | { from: "user" | "agent"; text: string }
  | { from: "actions"; steps: ActionStep[] };

export interface ChatPanelOptions {
  title?: string;
  /** Conversa inicial. Sem isso, mostra a conversa de exemplo do Figma. */
  messages?: ChatMessage[];
  /** Mostra spinners + botão de parar. Padrão: só na conversa de exemplo. */
  working?: boolean;
  parent?: HTMLElement;
}

export interface ChatPanel {
  el: HTMLElement;
  readonly isOpen: boolean;
  open(): void;
  close(): void;
  toggle(force?: boolean): void;
  stop(): void;
  newConversation(): void;
  addMessage(m: ChatMessage): void;
  resetPosition(): void;
}

// Conversa de exemplo (tela de auxílio): o Puca usando o Slack da pessoa, com os passos que está fazendo
const DEMO: ChatMessage[] = [
  { from: "user", text: "Onde fica o README do terminal-config-api?" },
  { from: "agent", text: "O Lucas mandou o link hoje no #time-terminais. Vou abrir o canal e te mostrar." },
  {
    from: "actions",
    steps: [
      { name: "Abrir o #time-terminais", done: true },
      { name: "Abrir o link do README", done: true },
      { name: "Buscar “firmware” no Slack" },
    ],
  },
];

// Seta de enviar (não existe no Figma; mesmo traço dos outros ícones)
const SEND_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;

function shotHTML(label: string): string {
  // camadas e posições exatamente como no Figma (top right bottom left)
  const layers: [string, string][] = [
    [shotTopbar, "0 0 87.78% 0"],
    [shotLine1, "22.22% 51.25% 72.22% 5%"],
    [shotLine2, "33.33% 26.25% 62.22% 5%"],
    [shotLine3, "41.11% 35.63% 54.44% 5%"],
    [shotButton, "55.56% 66.88% 30% 5%"],
  ];
  return `
    <button class="chat-shot" aria-label="Ver captura: ${esc(label)}">
      <div class="chat-shot__img">
        <img src="${shotBg}" alt="" style="inset:0">
        ${layers.map(([src, inset]) => `<span class="chat-shot__layer" style="inset:${inset}"><img src="${src}" alt=""></span>`).join("")}
        <span class="chat-shot__label" style="inset:55.56% 66.88% 30% 5%">${esc(label)}</span>
      </div>
    </button>`;
}

// Um passo do que o Puca está fazendo na tela: marca cheia com visto (feito) ou anel com ponto (fazendo agora)
const STEP_CHECK = `<svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-4.9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function stepHTML(s: ActionStep): string {
  return `
    <div class="chat-step${s.done ? " is-done" : " is-now"}${s.shot ? " chat-step--shot" : ""}">
      <span class="chat-step__mark">${s.done ? STEP_CHECK : ""}<span class="sr-only">${s.done ? "Concluído" : "Em andamento"}</span></span>
      <div class="chat-step__name">${esc(s.name)}</div>
      ${s.shot ? shotHTML(s.shot) : ""}
    </div>`;
}

function msgHTML(m: ChatMessage): string {
  if (m.from !== "actions") return `<div class="chat-msg chat-msg--${m.from}"><p>${esc(m.text)}</p></div>`;
  // grupo de ações
  return `
    <div class="chat-msg chat-actions">
      <button class="chat-actions__toggle" aria-expanded="true">
        <img class="chat-actions__chev" src="${chevronIcon}" width="12" height="12" alt="">
        <span>Usando o Slack · ${m.steps.filter((x) => x.done).length} de ${m.steps.length} passos</span>
        <img class="chat-spinner" src="${spinnerIcon}" width="12" height="12" alt="">
      </button>
      <div class="chat-actions__list"><div class="chat-actions__rail">${m.steps.map(stepHTML).join("")}</div></div>
    </div>`;
}

interface Thread {
  messages: ChatMessage[];
  at: Date;
}

// título = primeira mensagem do usuário
function titleOf(t: Thread): string {
  const withText = t.messages.filter((m): m is Extract<ChatMessage, { text: string }> => m.from !== "actions");
  const first = withText.find((m) => m.from === "user") ?? withText[0];
  return first ? first.text : "Conversa sem título";
}

function timeOf(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function mountChatPanel(opts: ChatPanelOptions = {}): ChatPanel {
  const titleText = opts.title ?? "Puca";
  const working = opts.working ?? !opts.messages;
  const panel = document.createElement("section");
  panel.className = "chat-panel" + (working ? " is-working" : "");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", titleText);
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = `
    <header class="chat-head">
      <h2 class="chat-head__title">${esc(titleText)}</h2>
      <div class="chat-head__actions">
        <button class="chat-icon-btn" data-act="threads" aria-pressed="false" aria-label="Conversas anteriores" title="Conversas anteriores"><img src="${threadsIcon}" width="14" height="14" alt=""></button>
        <button class="chat-icon-btn" data-act="new" aria-label="Nova conversa" title="Nova conversa"><img src="${newConversationIcon}" width="14" height="14" alt=""></button>
        <button class="chat-icon-btn" data-act="close" aria-label="Fechar" title="Fechar"><img src="${closeIcon}" width="14" height="14" alt=""></button>
      </div>
    </header>
    <div class="chat-body" aria-live="polite"></div>
    <div class="chat-compose">
      <div class="chat-compose__box">
        <textarea class="chat-compose__input" rows="1" placeholder="Fale com o Puca · @ menção · /comandos" aria-label="Mensagem para o Puca"></textarea>
        <button class="chat-compose__btn chat-stop" data-act="stop" aria-label="Parar geração" title="Parar"><img src="${stopIcon}" width="12" height="12" alt=""></button>
        <button class="chat-compose__btn chat-send" data-act="send" aria-label="Enviar" title="Enviar" disabled>${SEND_SVG}</button>
      </div>
    </div>`;
  (opts.parent ?? document.body).appendChild(panel);

  const body = qs(panel, ".chat-body");
  const input = qs<HTMLTextAreaElement>(panel, ".chat-compose__input");
  const threadsBtn = qs<HTMLButtonElement>(panel, '[data-act="threads"]');
  const sendBtn = qs<HTMLButtonElement>(panel, ".chat-send");
  const head = qs(panel, ".chat-head");
  let isOpen = false;

  // conversa atual + conversas anteriores (mais recente primeiro)
  let current: Thread = { messages: (opts.messages ?? DEMO).slice(), at: new Date() };
  const history: Thread[] = [];
  let showingHistory = false;

  function render(): void {
    const list = current.messages;
    body.innerHTML = list.length
      ? list.map(msgHTML).join("")
      : `<p class="chat-empty">Nova conversa. Pergunte qualquer coisa ao Puca.</p>`;
    body.scrollTop = body.scrollHeight;
  }

  function append(m: ChatMessage): void {
    current.messages.push(m);
    body.querySelector(".chat-empty")?.remove();
    body.insertAdjacentHTML("beforeend", msgHTML(m));
    body.scrollTop = body.scrollHeight;
  }

  // guarda a conversa atual no histórico (se tiver algo)
  function archiveCurrent(): void {
    if (current.messages.length) history.unshift(current);
  }

  function setHistoryView(on: boolean): void {
    showingHistory = on;
    panel.classList.toggle("is-history", on);
    threadsBtn.setAttribute("aria-pressed", String(on));
    if (!on) return render();
    body.innerHTML = history.length
      ? `<p class="chat-history__label">Conversas anteriores</p>
         <ul class="chat-history">${history
           .map(
             (t, i) => `
           <li><button class="chat-history__item" data-thread="${i}">
             <span class="chat-history__title">${esc(titleOf(t))}</span>
             <span class="chat-history__meta">${timeOf(t.at)} · ${t.messages.length} mensage${t.messages.length === 1 ? "m" : "ns"}</span>
           </button></li>`,
           )
           .join("")}
         </ul>`
      : `<p class="chat-empty">Nenhuma conversa anterior ainda.<br>Use o botão + para começar uma nova e esta fica guardada aqui.</p>`;
    body.scrollTop = 0;
  }

  function newConversation(): void {
    api.stop();
    archiveCurrent();
    current = { messages: [], at: new Date() };
    setHistoryView(false);
    input.focus({ preventScroll: true });
  }

  function openThread(i: number): void {
    const [picked] = history.splice(i, 1);
    if (!picked) return;
    api.stop();
    archiveCurrent();
    current = picked;
    setHistoryView(false);
  }

  // campo cresce com o texto (até o max-height do CSS)
  function fit(): void {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
    sendBtn.disabled = !input.value.trim();
  }

  function send(): void {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    fit();
    append({ from: "user", text });
    emit("chatpanel:send", { text });
  }

  const drag = makeDraggable(panel, {
    storageKey: "chatpanel:pos",
    handle: head,
    threshold: 3,
    ignoreButtons: true,
    preventDefault: true,
  });

  const api: ChatPanel = {
    el: panel,
    get isOpen() {
      return isOpen;
    },
    open() {
      api.toggle(true);
    },
    close() {
      api.toggle(false);
    },
    toggle(force) {
      const next = typeof force === "boolean" ? force : !isOpen;
      if (next === isOpen) return;
      isOpen = next;
      panel.classList.toggle("is-open", isOpen);
      panel.setAttribute("aria-hidden", String(!isOpen));
      if (isOpen) input.focus({ preventScroll: true });
      emit("chatpanel:change", { open: isOpen });
    },
    stop() {
      panel.classList.remove("is-working");
    },
    newConversation,
    addMessage: append,
    resetPosition: drag.reset,
  };

  panel.addEventListener("click", (e) => {
    const el = targetEl(e);
    const thread = el?.closest<HTMLElement>("[data-thread]");
    if (thread) return openThread(Number(thread.dataset.thread));
    const toggle = el?.closest(".chat-actions__toggle");
    if (toggle) {
      const collapsed = toggle.closest(".chat-actions")?.classList.toggle("is-collapsed") ?? false;
      toggle.setAttribute("aria-expanded", String(!collapsed));
      return;
    }
    const act = el?.closest<HTMLElement>("[data-act]")?.dataset.act;
    if (act === "close") api.close();
    if (act === "stop") api.stop();
    if (act === "send") send();
    if (act === "new") newConversation();
    if (act === "threads") setHistoryView(!showingHistory);
  });

  input.addEventListener("input", fit);
  // Enter envia, Shift+Enter quebra linha
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    send();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) api.close();
  });

  render();
  return api;
}
