// "Câmera" do agente no canto inferior direito. Uso:
//   <link rel="stylesheet" href=".../agent-cam/agent-cam.css"><script src=".../agent-cam/agent-cam.js"></script>
//   const cam = AgentCam.mount({ name: "Iris" });
//   cam.setState("talk" | "idle" | "think"); cam.setPaused(true); cam.show(); cam.hide();
// Se o visual de teste da Iris (IrisAgent) estiver carregado, ela aparece dentro.
// Sem ele, mostra um círculo neutro.
(function () {
  const LABEL = { talk: "falando", idle: "", think: "pensando" };

  function mount(opts = {}) {
    const name = opts.name || "Agente";
    const cam = document.createElement("div");
    cam.className = "agent-cam";
    cam.dataset.state = "idle";
    cam.setAttribute("role", "img");
    cam.innerHTML = `
      <div class="agent-cam__view"></div>
      <div class="agent-cam__tag"><span class="agent-cam__dot"></span><span class="agent-cam__name"></span></div>`;
    (opts.parent || document.body).appendChild(cam);
    document.body.classList.add("has-agent-cam");

    const view = cam.querySelector(".agent-cam__view");
    const nameEl = cam.querySelector(".agent-cam__name");
    const visual = window.IrisAgent ? IrisAgent.mount(view) : null;
    if (!visual) view.innerHTML = `<div class="agent-cam__placeholder">${name}</div>`;

    function label() {
      const extra = cam.hasAttribute("data-paused") ? "pausado" : LABEL[cam.dataset.state];
      nameEl.textContent = extra ? `${name} · ${extra}` : name;
      cam.setAttribute("aria-label", `Câmera do agente ${name}${extra ? ", " + extra : ""}`);
    }

    const api = {
      el: cam,
      setState(s) {
        cam.dataset.state = s;
        if (visual) {
          visual.setState(cam.hasAttribute("data-paused") ? "idle" : s);
          visual.setWarm(s === "think");
        }
        label();
      },
      setPaused(on) {
        cam.toggleAttribute("data-paused", !!on);
        if (visual) visual.setState(on ? "idle" : cam.dataset.state);
        label();
      },
      show() { cam.classList.remove("is-hidden"); },
      hide() { cam.classList.add("is-hidden"); },
    };
    // ---- Arrastar a câmera pela tela ----
    // Fora do canto, o chat deixa de abrir "em cima" dela (classe has-agent-cam sai do body).
    const POS_KEY = "agentcam:pos";
    const MARGIN = 8;

    function place(x, y) {
      const r = cam.getBoundingClientRect();
      x = Math.min(Math.max(MARGIN, x), Math.max(MARGIN, innerWidth - r.width - MARGIN));
      y = Math.min(Math.max(MARGIN, y), Math.max(MARGIN, innerHeight - r.height - MARGIN));
      cam.classList.add("is-placed");
      document.body.classList.remove("has-agent-cam");
      cam.style.left = x + "px";
      cam.style.top = y + "px";
      return { x, y };
    }

    function resetPosition() {
      cam.classList.remove("is-placed");
      document.body.classList.add("has-agent-cam");
      cam.style.left = cam.style.top = "";
      try { localStorage.removeItem(POS_KEY); } catch {}
    }

    let drag = null;
    cam.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const r = cam.getBoundingClientRect();
      drag = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moving: false, last: null };
      e.preventDefault();
    });
    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moving) {
        if (Math.hypot(dx, dy) < 3) return;
        drag.moving = true;
        cam.classList.add("is-dragging");
      }
      drag.last = place(drag.ox + dx, drag.oy + dy);
    });
    function endDrag() {
      if (drag && drag.moving) {
        cam.classList.remove("is-dragging");
        try { localStorage.setItem(POS_KEY, JSON.stringify(drag.last)); } catch {}
      }
      drag = null;
    }
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);

    // dois cliques: volta para o canto
    cam.addEventListener("dblclick", resetPosition);

    window.addEventListener("resize", () => {
      if (!cam.classList.contains("is-placed")) return;
      const r = cam.getBoundingClientRect();
      place(r.left, r.top);
    });

    // ---- Borda na cor da "emoção" do agente ----
    // Com a Iris: cor dela em tempo real (azul, e quente quando pensa).
    // Sem ela: azul normal, laranja pensando.
    const FALLBACK = { idle: { r: 63, g: 140, b: 236 }, talk: { r: 63, g: 140, b: 236 }, think: { r: 241, g: 105, b: 46 } };
    (function tint() {
      const c = visual && visual.getColor ? visual.getColor() : FALLBACK[cam.dataset.state] || FALLBACK.idle;
      const strong = !cam.hasAttribute("data-paused") && cam.dataset.state !== "idle";
      // bem mais clara: mistura com branco (falando/pensando 60%, quieta 80%)
      const k = strong ? 0.6 : 0.8;
      const mix = (v) => Math.round(v + (255 - v) * k);
      cam.style.setProperty("--cam-accent", `rgb(${mix(c.r)}, ${mix(c.g)}, ${mix(c.b)})`);
      // bolinha da etiqueta: mesma cor, mais forte (quieta: um pouco mais clara)
      const kd = strong ? 0 : 0.45;
      const dot = (v) => Math.round(v + (255 - v) * kd);
      cam.style.setProperty("--cam-dot", `rgb(${dot(c.r)}, ${dot(c.g)}, ${dot(c.b)})`);
      requestAnimationFrame(tint);
    })();

    api.resetPosition = resetPosition;
    label();

    // posição salva da última vez
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) place(saved.x, saved.y);
    } catch {}

    return api;
  }

  window.AgentCam = { mount };
})();
