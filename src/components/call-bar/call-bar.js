// Barra de call flutuante. Uso:
//   <link rel="stylesheet" href="src/components/call-bar/call-bar.css"><script src="src/components/call-bar/call-bar.js"></script>
//   const call = CallBar.mount({ status: "Clicking “Compare plans”…", chat: ChatPanel.mount() });
//   call.setStatus("…"); call.end(); call.start();
// Eventos no document: callbar:pause, callbar:control, callbar:mute, callbar:chat, callbar:end, callbar:start
(function () {
  // ícones ficam em ./icons, ao lado deste script
  const ICONS = new URL("icons/", document.currentScript.src).href;

  // Ícone de telefone do botão "ligar" (não existe no Figma; mesmo traço dos outros ícones)
  const PHONE_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

  function mount(opts = {}) {
    const base = opts.iconsPath || ICONS;
    const chat = opts.chat || null;
    const dock = document.createElement("div");
    dock.className = "call-dock";
    dock.innerHTML = `
      <div class="call-live">
        <div class="call-status" role="status" aria-live="polite"></div>
        <div class="call-bar" role="toolbar" aria-label="Controles da sessão">
          <button class="call-btn" data-act="pause" aria-pressed="false" aria-label="Pausar">
            <img src="${base}pause.svg" width="16" height="16" alt="">
          </button>
          <button class="call-btn" data-act="control" aria-pressed="false" aria-label="Assumir controle">
            <img src="${base}hand.svg" width="16" height="16" alt="">
          </button>
          <div class="call-mic">
            <img class="call-mic__ring" src="${base}level-ring.svg" width="80" height="80" alt="">
            <button class="call-mic__btn" data-act="mute" aria-pressed="false" aria-label="Silenciar microfone">
              <img src="${base}mic.svg" width="22" height="22" alt="">
            </button>
            <span class="call-mic__slash" aria-hidden="true"></span>
          </div>
          <button class="call-btn call-btn--chat" data-act="chat" aria-pressed="false" aria-label="Abrir chat">
            <img src="${base}chat.svg" width="44" height="36" alt="">
          </button>
          <button class="call-btn call-btn--end" data-act="end" aria-label="Encerrar sessão">
            <img src="${base}end.svg" width="16" height="16" alt="">
          </button>
        </div>
      </div>
      <button class="call-redial" data-act="start" aria-label="Ligar para o agente" tabindex="-1">
        <span class="call-redial__icon">${PHONE_SVG}</span>
        <span class="call-redial__label">Ligar para o agente</span>
      </button>`;
    (opts.parent || document.body).appendChild(dock);

    const statusEl = dock.querySelector(".call-status");
    const ring = dock.querySelector(".call-mic__ring");
    const chatBtn = dock.querySelector('[data-act="chat"]');
    const chatImg = chatBtn.querySelector("img");
    const redial = dock.querySelector(".call-redial");
    const liveBtns = dock.querySelectorAll(".call-live button");
    ring.addEventListener("animationend", () => ring.classList.remove("is-pulsing"));

    // Estados do Figma: Chat=Closed (ponto de não lido) / Chat=Open (fundo cinza)
    function setChatOpen(open) {
      chatBtn.setAttribute("aria-pressed", String(open));
      chatBtn.setAttribute("aria-label", open ? "Fechar chat" : "Abrir chat");
      chatImg.src = base + (open ? "chat-open.svg" : "chat.svg");
    }
    document.addEventListener("chatpanel:change", (e) => setChatOpen(e.detail.open));

    function pulseRing() {
      ring.classList.remove("is-pulsing");
      void ring.offsetWidth; // reinicia a animação mesmo em cliques seguidos
      ring.classList.add("is-pulsing");
    }

    const api = {
      el: dock,
      setStatus(text) { statusEl.textContent = text || ""; },
      // Encerra a call: some a barra e fica só o botão de ligar
      end(fromKeyboard = false) {
        if (chat) chat.close();
        dock.classList.add("is-ended");
        liveBtns.forEach((b) => (b.tabIndex = -1));
        redial.tabIndex = 0;
        // quem usa teclado continua com o foco no botão de ligar
        if (fromKeyboard) redial.focus({ preventScroll: true });
      },
      // Liga de novo: volta a barra completa
      start() {
        dock.classList.remove("is-ended");
        liveBtns.forEach((b) => b.removeAttribute("tabindex"));
        redial.tabIndex = -1;
        pulseRing();
      },
    };

    dock.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      let on;
      if (act === "chat") {
        on = chatBtn.getAttribute("aria-pressed") !== "true";
        if (chat) chat.toggle(on); else setChatOpen(on);
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
      document.dispatchEvent(new CustomEvent("callbar:" + act, { detail: { on } }));
    });

    // ---- Arrastar a barra pela tela ----
    // Só vira arraste depois de mexer 5px, então clique normal nos botões continua funcionando.
    const POS_KEY = "callbar:pos";
    const MARGIN = 8;

    function place(x, y) {
      const r = dock.getBoundingClientRect();
      x = Math.min(Math.max(MARGIN, x), Math.max(MARGIN, innerWidth - r.width - MARGIN));
      y = Math.min(Math.max(MARGIN, y), Math.max(MARGIN, innerHeight - r.height - MARGIN));
      dock.classList.add("is-placed");
      dock.style.left = x + "px";
      dock.style.top = y + "px";
      return { x, y };
    }

    function resetPosition() {
      dock.classList.remove("is-placed");
      dock.style.left = dock.style.top = "";
      try { localStorage.removeItem(POS_KEY); } catch {}
    }

    let drag = null;
    let justDragged = false;

    dock.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const r = dock.getBoundingClientRect();
      drag = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moving: false, last: null };
    });

    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moving) {
        if (Math.hypot(dx, dy) < 5) return;
        drag.moving = true;
        dock.classList.add("is-dragging");
      }
      drag.last = place(drag.ox + dx, drag.oy + dy);
    });

    function endDrag() {
      if (drag && drag.moving) {
        dock.classList.remove("is-dragging");
        justDragged = true;
        setTimeout(() => (justDragged = false), 0); // o click vem logo depois do pointerup
        try { localStorage.setItem(POS_KEY, JSON.stringify(drag.last)); } catch {}
      }
      drag = null;
    }
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    // depois de arrastar, não deixa o soltar contar como clique no botão
    dock.addEventListener("click", (e) => {
      if (justDragged) { e.stopPropagation(); e.preventDefault(); }
    }, true);

    // dois cliques num espaço vazio da barra: volta para o centro
    dock.addEventListener("dblclick", (e) => {
      if (!e.target.closest("button")) resetPosition();
    });

    // mantém a barra dentro da tela quando a janela muda de tamanho
    window.addEventListener("resize", () => {
      if (!dock.classList.contains("is-placed")) return;
      const r = dock.getBoundingClientRect();
      place(r.left, r.top);
    });

    api.resetPosition = resetPosition;
    api.setStatus(opts.status);

    // posição salva da última vez
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) place(saved.x, saved.y);
    } catch {}

    return api;
  }

  window.CallBar = { mount };
})();
