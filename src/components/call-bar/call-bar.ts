// Barra de call flutuante (Figma: "Session control bar", nó 24:54).
//   const call = mountCallBar({ status: "Clicking “Compare plans”…", chat });
//   call.setStatus("…"); call.end(); call.start();
// Eventos no document: callbar:pause | control | mute | chat | end | start
import "../../styles/tokens.css";
import "./call-bar.css";
import pauseIcon from "./icons/pause.svg";
import handIcon from "./icons/hand.svg";
import ringIcon from "./icons/level-ring.svg";
import micIcon from "./icons/mic.svg";
import chatIcon from "./icons/chat.svg";
import chatOpenIcon from "./icons/chat-open.svg";
import endIcon from "./icons/end.svg";
import { qs, targetEl } from "../../lib/dom";
import { emit, type CallBarAction } from "../../lib/events";
import { makeDraggable } from "../../lib/draggable";
import type { ChatPanel } from "../chat-panel/chat-panel";
import type { AgentCam } from "../agent-cam/agent-cam";

// Ícone de telefone do botão "ligar" (não existe no Figma; mesmo traço dos outros ícones)
const PHONE_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

export interface CallBarOptions {
  /** Texto acima da barra (ex.: o que o agente está fazendo). */
  status?: string;
  /** Painel de chat que o botão de chat abre e fecha. */
  chat?: ChatPanel;
  parent?: HTMLElement;
  /** false = barra fixa no lugar padrão, sem arrastar (padrão: true). */
  draggable?: boolean;
  /** Prende a barra embaixo da câmera da Puca, compacta e da largura dela. Arrastar a câmera leva as duas. */
  attachTo?: AgentCam;
}

export interface CallBar {
  el: HTMLElement;
  setStatus(text?: string): void;
  /** Encerra a call: some a barra e fica só o botão de ligar. */
  end(fromKeyboard?: boolean): void;
  /** Liga de novo: volta a barra completa. */
  start(): void;
  resetPosition(): void;
}

export function mountCallBar(opts: CallBarOptions = {}): CallBar {
  const chat = opts.chat ?? null;
  const dock = document.createElement("div");
  dock.className = "call-dock";
  dock.innerHTML = `
    <div class="call-live">
      <div class="call-status" role="status" aria-live="polite"></div>
      <div class="call-bar" role="toolbar" aria-label="Controles da sessão">
        <button class="call-btn" data-act="pause" aria-pressed="false" aria-label="Pausar">
          <img src="${pauseIcon}" width="16" height="16" alt="">
        </button>
        <button class="call-btn" data-act="control" aria-pressed="false" aria-label="Assumir controle">
          <img src="${handIcon}" width="16" height="16" alt="">
        </button>
        <div class="call-mic">
          <img class="call-mic__ring" src="${ringIcon}" width="60" height="56" alt="">
          <button class="call-mic__btn" data-act="mute" aria-pressed="false" aria-label="Silenciar microfone">
            <img src="${micIcon}" width="18" height="18" alt="">
          </button>
          <span class="call-mic__slash" aria-hidden="true"></span>
        </div>
        <button class="call-btn call-btn--chat" data-act="chat" aria-pressed="false" aria-label="Abrir chat">
          <img src="${chatIcon}" width="40" height="32" alt="">
        </button>
        <button class="call-btn call-btn--end" data-act="end" aria-label="Encerrar sessão">
          <img src="${endIcon}" width="16" height="16" alt="">
        </button>
      </div>
    </div>
    <button class="call-redial" data-act="start" aria-label="Ligar para a Puca" tabindex="-1">
      <span class="call-redial__icon">${PHONE_SVG}</span>
      <span class="call-redial__label">Ligar para a Puca</span>
    </button>`;
  (opts.parent ?? document.body).appendChild(dock);

  const statusEl = qs(dock, ".call-status");
  const ring = qs(dock, ".call-mic__ring");
  const chatBtn = qs<HTMLButtonElement>(dock, '[data-act="chat"]');
  const chatImg = qs<HTMLImageElement>(chatBtn, "img");
  const redial = qs<HTMLButtonElement>(dock, ".call-redial");
  const liveBtns = dock.querySelectorAll<HTMLButtonElement>(".call-live button");
  ring.addEventListener("animationend", () => ring.classList.remove("is-pulsing"));

  // Estados do Figma: Chat=Closed (ponto de não lido) / Chat=Open (fundo cinza)
  function setChatOpen(open: boolean): void {
    chatBtn.setAttribute("aria-pressed", String(open));
    chatBtn.setAttribute("aria-label", open ? "Fechar chat" : "Abrir chat");
    chatImg.src = open ? chatOpenIcon : chatIcon;
  }
  document.addEventListener("chatpanel:change", (e) => setChatOpen(e.detail.open));

  function pulseRing(): void {
    ring.classList.remove("is-pulsing");
    void ring.offsetWidth; // reinicia a animação mesmo em cliques seguidos
    ring.classList.add("is-pulsing");
  }

  const attached = opts.attachTo ?? null;
  const drag =
    opts.draggable === false || attached
      ? { reset: () => {} }
      : makeDraggable(dock, { storageKey: "callbar:pos", threshold: 5, suppressClickAfterDrag: true });
  dock.classList.toggle("is-fixed", opts.draggable === false);

  // Presa na câmera: fica logo embaixo dela (ou em cima, se não couber), com a mesma largura.
  if (attached) {
    dock.classList.add("is-attached");
    document.body.classList.add("has-attached-callbar");
    const GAP = 8;
    let last: DOMRect | null = null;
    const follow = (r: DOMRect) => {
      last = r;
      const h = qs(dock, ".call-bar").offsetHeight || 42;
      const below = r.bottom + GAP + h <= innerHeight - 8;
      dock.style.width = `${r.width}px`;
      dock.style.left = `${r.left}px`;
      dock.style.top = `${below ? r.bottom + GAP : r.top - GAP - h}px`;
    };
    document.addEventListener("agentcam:move", (e) => {
      // escondida (call encerrada): a barra fica onde estava, com o botão de ligar
      if (e.detail.visible || !last) follow(e.detail.rect);
    });
    requestAnimationFrame(() => attached.sync());
  }

  const api: CallBar = {
    el: dock,
    setStatus(text) {
      statusEl.textContent = text ?? "";
    },
    end(fromKeyboard = false) {
      chat?.close();
      dock.classList.add("is-ended");
      liveBtns.forEach((b) => (b.tabIndex = -1));
      redial.tabIndex = 0;
      // quem usa teclado continua com o foco no botão de ligar
      if (fromKeyboard) redial.focus({ preventScroll: true });
    },
    start() {
      dock.classList.remove("is-ended");
      liveBtns.forEach((b) => b.removeAttribute("tabindex"));
      redial.tabIndex = -1;
      pulseRing();
    },
    resetPosition: drag.reset,
  };

  dock.addEventListener("click", (e) => {
    const btn = targetEl(e)?.closest<HTMLElement>("[data-act]");
    if (!btn) return;
    const act = btn.dataset.act as CallBarAction;
    let on: boolean | undefined;
    if (act === "chat") {
      on = chatBtn.getAttribute("aria-pressed") !== "true";
      if (chat) chat.toggle(on);
      else setChatOpen(on);
    } else if (btn.hasAttribute("aria-pressed")) {
      on = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", String(on));
    }
    if (act === "pause") btn.setAttribute("aria-label", on ? "Retomar" : "Pausar");
    if (act === "mute") {
      btn.setAttribute("aria-label", on ? "Ativar microfone" : "Silenciar microfone");
      pulseRing();
    }
    if (act === "end") api.end(e.detail === 0);
    if (act === "start") api.start();
    emit(`callbar:${act}`, { on });
  });

  api.setStatus(opts.status);
  return api;
}
