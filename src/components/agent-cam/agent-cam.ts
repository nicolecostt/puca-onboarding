// "Câmera" do agente no canto inferior direito, como numa videochamada.
//   const cam = mountAgentCam({ name: "Puca", visual: await loadAgentVisual() });
//   cam.setState("talk" | "idle" | "think"); cam.setPaused(true); cam.show(); cam.hide();
// Sem visual, mostra um círculo neutro.
import "../../styles/tokens.css";
import "./agent-cam.css";
import { esc, qs } from "../../lib/dom";
import { makeDraggable } from "../../lib/draggable";
import type { AgentVisualFactory, AgentVisualState, RGB } from "../../lib/agent-visual";

export interface AgentCamOptions {
  name?: string;
  visual?: AgentVisualFactory | null;
  parent?: HTMLElement;
}

export interface AgentCam {
  el: HTMLElement;
  setState(state: AgentVisualState): void;
  setPaused(on: boolean): void;
  show(): void;
  hide(): void;
  resetPosition(): void;
}

const LABEL: Record<AgentVisualState, string> = { talk: "falando", idle: "", think: "pensando" };

// Sem visual: azul normal, laranja pensando.
const FALLBACK: Record<AgentVisualState, RGB> = {
  idle: { r: 63, g: 140, b: 236 },
  talk: { r: 63, g: 140, b: 236 },
  think: { r: 241, g: 105, b: 46 },
};

/** Clareia uma cor misturando com branco (k = 0 nada, 1 = branco). */
function lighten(c: RGB, k: number): string {
  const mix = (v: number) => Math.round(v + (255 - v) * k);
  return `rgb(${mix(c.r)}, ${mix(c.g)}, ${mix(c.b)})`;
}

export function mountAgentCam(opts: AgentCamOptions = {}): AgentCam {
  const name = opts.name ?? "Puca";
  let state: AgentVisualState = "idle";
  let paused = false;

  const cam = document.createElement("div");
  cam.className = "agent-cam";
  cam.dataset.state = state;
  cam.setAttribute("role", "img");
  cam.innerHTML = `
    <div class="agent-cam__view"></div>
    <div class="agent-cam__tag"><span class="agent-cam__dot"></span><span class="agent-cam__name"></span></div>`;
  (opts.parent ?? document.body).appendChild(cam);
  document.body.classList.add("has-agent-cam");

  const view = qs(cam, ".agent-cam__view");
  const nameEl = qs(cam, ".agent-cam__name");
  const visual = opts.visual ? opts.visual(view) : null;
  if (!visual) view.innerHTML = `<div class="agent-cam__placeholder">${esc(name)}</div>`;

  function label(): void {
    const extra = paused ? "pausado" : LABEL[state];
    nameEl.textContent = extra ? `${name} · ${extra}` : name;
    cam.setAttribute("aria-label", `Câmera da ${name}${extra ? `, ${extra}` : ""}`);
  }

  // Borda e bolinha na cor da "emoção" do agente: com visual, a cor dele em tempo real
  // (azul, e quente quando pensa); forte quando fala/pensa, clarinha quando quieto.
  (function tint() {
    const c = visual ? visual.getColor() : FALLBACK[state];
    const strong = !paused && state !== "idle";
    cam.style.setProperty("--cam-accent", lighten(c, strong ? 0.6 : 0.8));
    cam.style.setProperty("--cam-dot", lighten(c, strong ? 0 : 0.45));
    requestAnimationFrame(tint);
  })();

  // O chat abre colado na câmera, onde quer que ela esteja: acima dela, ou abaixo se não couber.
  // Passa a posição para o CSS do chat por variáveis no body (ver agent-cam.css).
  function syncChat(): void {
    const r = cam.getBoundingClientRect();
    const visible = !cam.classList.contains("is-hidden");
    document.body.classList.toggle("has-agent-cam", visible);
    if (!visible) return;
    const gap = 12;
    const below = r.top < 320; // pouco espaço em cima: abre embaixo
    const style = document.body.style;
    style.setProperty("--chat-right", `${Math.max(8, innerWidth - r.right)}px`);
    style.setProperty("--chat-bottom", below ? "auto" : `${innerHeight - r.top + gap}px`);
    style.setProperty("--chat-top", below ? `${r.bottom + gap}px` : "auto");
    style.setProperty("--chat-space", `${below ? innerHeight - r.bottom - gap - 16 : r.top - gap - 16}px`);
  }

  // Arrastar: o chat acompanha.
  const drag = makeDraggable(cam, {
    storageKey: "agentcam:pos",
    threshold: 3,
    preventDefault: true,
    dblClickOnButtons: true,
    onPlace: syncChat,
    onReset: syncChat,
  });
  addEventListener("resize", syncChat);
  requestAnimationFrame(syncChat);

  const api: AgentCam = {
    el: cam,
    setState(s) {
      state = s;
      cam.dataset.state = s;
      if (visual) {
        visual.setState(paused ? "idle" : s);
        visual.setWarm(s === "think");
      }
      label();
    },
    setPaused(on) {
      paused = on;
      cam.toggleAttribute("data-paused", on);
      visual?.setState(on ? "idle" : state);
      label();
    },
    show() {
      cam.classList.remove("is-hidden");
      syncChat();
    },
    hide() {
      cam.classList.add("is-hidden");
      syncChat();
    },
    resetPosition: drag.reset,
  };
  label();
  return api;
}
