// Painel de chat flutuante ("Journey copilot"). Uso:
//   <link rel="stylesheet" href="src/components/chat-panel/chat-panel.css"><script src="src/components/chat-panel/chat-panel.js"></script>
//   const chat = ChatPanel.mount();   // começa fechado
//   chat.open(); chat.close(); chat.toggle();
// Evento no document: chatpanel:change { open }, chatpanel:send { text }
(function () {
  const ICONS = new URL("icons/", document.currentScript.src).href;

  // Conversa de exemplo do Figma
  const DEMO = [
    { from: "user", text: "Can you check the pricing page on our site and add a moment that walks the user through the plans?" },
    { from: "agent", text: "Sure — I'll open the pricing page in the browser first so I can see the plans." },
    {
      from: "actions",
      steps: [
        { name: "Browser navigate", done: true, shot: "Pricing" },
        { name: "Browser scroll", done: true, shot: "Plans" },
        { name: "Browser click" },
      ],
    },
  ];

  // Seta de enviar (não existe no Figma; mesmo traço dos outros ícones)
  const SEND_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function shotHTML(base, label) {
    // camadas e posições exatamente como no Figma (top right bottom left)
    const layers = [
      ["shot-topbar", "0 0 87.78% 0"],
      ["shot-line1", "22.22% 51.25% 72.22% 5%"],
      ["shot-line2", "33.33% 26.25% 62.22% 5%"],
      ["shot-line3", "41.11% 35.63% 54.44% 5%"],
      ["shot-button", "55.56% 66.88% 30% 5%"],
    ];
    return `
      <button class="chat-shot" aria-label="Ver captura: ${esc(label)}">
        <div class="chat-shot__img">
          <img src="${base}shot-bg.svg" alt="" style="inset:0">
          ${layers.map(([f, inset]) => `<span class="chat-shot__layer" style="inset:${inset}"><img src="${base}${f}.svg" alt=""></span>`).join("")}
          <span class="chat-shot__label" style="inset:55.56% 66.88% 30% 5%">${esc(label)}</span>
        </div>
      </button>`;
  }

  function stepHTML(base, s) {
    const status = s.done
      ? `<img src="${base}check.svg" width="12" height="12" alt="Concluído">`
      : `<img class="chat-spinner" src="${base}spinner.svg" width="12" height="12" alt="Em andamento">`;
    return `
      <div class="chat-step${s.shot ? " chat-step--shot" : ""}">
        <div class="chat-step__name"><img src="${base}tool.svg" width="12" height="12" alt="">${esc(s.name)}</div>
        ${status}
        ${s.shot ? shotHTML(base, s.shot) : ""}
      </div>`;
  }

  function msgHTML(base, m) {
    if (m.from === "user") return `<div class="chat-msg chat-msg--user"><p>${esc(m.text)}</p></div>`;
    if (m.from === "agent") return `<div class="chat-msg chat-msg--agent"><p>${esc(m.text)}</p></div>`;
    // grupo de ações
    return `
      <div class="chat-msg chat-actions">
        <button class="chat-actions__toggle" aria-expanded="true">
          <img class="chat-actions__chev" src="${base}chevron.svg" width="12" height="12" alt="">
          <span>Working on ${m.steps.length} actions</span>
          <img class="chat-spinner" src="${base}spinner.svg" width="12" height="12" alt="">
        </button>
        <div class="chat-actions__list"><div class="chat-actions__rail">${m.steps.map((s) => stepHTML(base, s)).join("")}</div></div>
      </div>`;
  }

  function mount(opts = {}) {
    const base = opts.iconsPath || ICONS;
    const messages = opts.messages || DEMO;
    const title = esc(opts.title || "Journey copilot");
    // "trabalhando" (spinners + botão parar) só na conversa de exemplo, a menos que peçam
    const working = opts.working ?? !opts.messages;
    const panel = document.createElement("section");
    panel.className = "chat-panel" + (working ? " is-working" : "");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", opts.title || "Journey copilot");
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
      <header class="chat-head">
        <h2 class="chat-head__title">${title}</h2>
        <div class="chat-head__actions">
          <button class="chat-icon-btn" data-act="threads" aria-pressed="false" aria-label="Conversas anteriores" title="Conversas anteriores"><img src="${base}threads.svg" width="14" height="14" alt=""></button>
          <button class="chat-icon-btn" data-act="new" aria-label="Nova conversa" title="Nova conversa"><img src="${base}new-conversation.svg" width="14" height="14" alt=""></button>
          <button class="chat-icon-btn" data-act="close" aria-label="Fechar" title="Fechar"><img src="${base}close.svg" width="14" height="14" alt=""></button>
        </div>
      </header>
      <div class="chat-body" aria-live="polite"></div>
      <div class="chat-compose">
        <div class="chat-compose__box">
          <textarea class="chat-compose__input" rows="1" placeholder="Message copilot · @ mention · /commands" aria-label="Mensagem para o copilot"></textarea>
          <button class="chat-compose__btn chat-stop" data-act="stop" aria-label="Parar geração" title="Parar"><img src="${base}stop.svg" width="12" height="12" alt=""></button>
          <button class="chat-compose__btn chat-send" data-act="send" aria-label="Enviar" title="Enviar" disabled>${SEND_SVG}</button>
        </div>
      </div>`;
    (opts.parent || document.body).appendChild(panel);

    const body = panel.querySelector(".chat-body");
    const input = panel.querySelector(".chat-compose__input");
    const threadsBtn = panel.querySelector('[data-act="threads"]');
    let isOpen = false;

    // conversa atual + conversas anteriores (mais recente primeiro)
    let current = { messages: messages.slice(), at: new Date() };
    const history = [];
    let showingHistory = false;

    function render() {
      const list = current.messages;
      body.innerHTML = list.length
        ? list.map((m) => msgHTML(base, m)).join("")
        : `<p class="chat-empty">Nova conversa. Pergunte qualquer coisa ao copilot.</p>`;
      body.scrollTop = body.scrollHeight;
    }

    function append(m) {
      current.messages.push(m);
      body.querySelector(".chat-empty")?.remove();
      body.insertAdjacentHTML("beforeend", msgHTML(base, m));
      body.scrollTop = body.scrollHeight;
    }

    // título = primeira mensagem do usuário
    function titleOf(t) {
      const first = t.messages.find((m) => m.from === "user") || t.messages.find((m) => m.text);
      return first ? first.text : "Conversa sem título";
    }

    function timeOf(d) {
      const mins = Math.round((Date.now() - d) / 60000);
      if (mins < 1) return "agora";
      if (mins < 60) return `há ${mins} min`;
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }

    // guarda a conversa atual no histórico (se tiver algo)
    function archiveCurrent() {
      if (current.messages.length) history.unshift(current);
    }

    function setHistoryView(on) {
      showingHistory = on;
      panel.classList.toggle("is-history", on);
      threadsBtn.setAttribute("aria-pressed", String(on));
      if (!on) return render();
      body.innerHTML = history.length
        ? `<p class="chat-history__label">Conversas anteriores</p>
           <ul class="chat-history">${history.map((t, i) => `
             <li><button class="chat-history__item" data-thread="${i}">
               <span class="chat-history__title">${esc(titleOf(t))}</span>
               <span class="chat-history__meta">${timeOf(t.at)} · ${t.messages.length} mensage${t.messages.length === 1 ? "m" : "ns"}</span>
             </button></li>`).join("")}
           </ul>`
        : `<p class="chat-empty">Nenhuma conversa anterior ainda.<br>Use o botão + para começar uma nova e esta fica guardada aqui.</p>`;
      body.scrollTop = 0;
    }

    function newConversation() {
      api.stop();
      archiveCurrent();
      current = { messages: [], at: new Date() };
      setHistoryView(false);
      input.focus({ preventScroll: true });
    }

    function openThread(i) {
      const [picked] = history.splice(i, 1);
      api.stop();
      archiveCurrent();
      current = picked;
      setHistoryView(false);
    }

    const api = {
      el: panel,
      get isOpen() { return isOpen; },
      open() { api.toggle(true); },
      close() { api.toggle(false); },
      toggle(force) {
        const next = typeof force === "boolean" ? force : !isOpen;
        if (next === isOpen) return;
        isOpen = next;
        panel.classList.toggle("is-open", isOpen);
        panel.setAttribute("aria-hidden", String(!isOpen));
        if (isOpen) input.focus({ preventScroll: true });
        document.dispatchEvent(new CustomEvent("chatpanel:change", { detail: { open: isOpen } }));
      },
      stop() { panel.classList.remove("is-working"); },
      newConversation,
      // adiciona uma mensagem vinda de fora ({ from: "agent" | "user", text })
      addMessage(m) { append(m); },
    };

    panel.addEventListener("click", (e) => {
      const thread = e.target.closest("[data-thread]");
      if (thread) return openThread(Number(thread.dataset.thread));
      const toggle = e.target.closest(".chat-actions__toggle");
      if (toggle) {
        const group = toggle.closest(".chat-actions");
        const collapsed = group.classList.toggle("is-collapsed");
        toggle.setAttribute("aria-expanded", String(!collapsed));
        return;
      }
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "close") api.close();
      if (act === "stop") api.stop();
      if (act === "send") send();
      if (act === "new") newConversation();
      if (act === "threads") setHistoryView(!showingHistory);
    });

    const sendBtn = panel.querySelector(".chat-send");

    // campo cresce com o texto (até o max-height do CSS)
    function fit() {
      input.style.height = "auto";
      input.style.height = input.scrollHeight + "px";
      sendBtn.disabled = !input.value.trim();
    }

    function send() {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      fit();
      append({ from: "user", text });
      document.dispatchEvent(new CustomEvent("chatpanel:send", { detail: { text } }));
    }

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

    // ---- Arrastar o painel pelo cabeçalho (independente da barra de call) ----
    const head = panel.querySelector(".chat-head");
    const POS_KEY = "chatpanel:pos";
    const MARGIN = 8;

    function place(x, y) {
      const r = panel.getBoundingClientRect();
      x = Math.min(Math.max(MARGIN, x), Math.max(MARGIN, innerWidth - r.width - MARGIN));
      y = Math.min(Math.max(MARGIN, y), Math.max(MARGIN, innerHeight - r.height - MARGIN));
      panel.classList.add("is-placed");
      panel.style.left = x + "px";
      panel.style.top = y + "px";
      return { x, y };
    }

    function resetPosition() {
      panel.classList.remove("is-placed");
      panel.style.left = panel.style.top = "";
      try { localStorage.removeItem(POS_KEY); } catch {}
    }

    let drag = null;
    head.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button")) return; // botões do cabeçalho seguem clicáveis
      const r = panel.getBoundingClientRect();
      drag = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moving: false, last: null };
      e.preventDefault(); // evita selecionar o título
    });
    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moving) {
        if (Math.hypot(dx, dy) < 3) return;
        drag.moving = true;
        panel.classList.add("is-dragging");
      }
      drag.last = place(drag.ox + dx, drag.oy + dy);
    });
    function endDrag() {
      if (drag && drag.moving) {
        panel.classList.remove("is-dragging");
        try { localStorage.setItem(POS_KEY, JSON.stringify(drag.last)); } catch {}
      }
      drag = null;
    }
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    // dois cliques no cabeçalho: volta para o canto
    head.addEventListener("dblclick", (e) => {
      if (!e.target.closest("button")) resetPosition();
    });

    window.addEventListener("resize", () => {
      if (!panel.classList.contains("is-placed")) return;
      const r = panel.getBoundingClientRect();
      place(r.left, r.top);
    });

    api.resetPosition = resetPosition;

    render();

    // posição salva da última vez
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) place(saved.x, saved.y);
    } catch {}

    return api;
  }

  window.ChatPanel = { mount };
})();
