// Quadro da aula: renderiza um BoardSpec em SVG e aplica as ações da jornada
// (revelar, destacar, focar, pulso de fluxo, cartão do nó). Sem biblioteca.
// Visual do Figma ("03 · Aula no quadro"): fundo pontilhado, traço desenhado e letra à mão.
//   const board = mountBoard(container);
//   board.load(spec);  board.apply({ type: "reveal", targets: ["checkout-web"] });
//   board.setSelectable(true);  board.onSelect((id) => …);
import "../../styles/tokens.css";
import "./board.css";
import { esc } from "../../lib/dom";
import type { BoardAction, BoardEdge, BoardNode, BoardSpec, HighlightTone } from "../types";

const W = 1200;
const H = 700;
const NS = "http://www.w3.org/2000/svg";
const FULL: Box = { x: 0, y: 0, w: W, h: H };
const ZOOM = 1.55;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface NodeView {
  data: BoardNode;
  g: SVGGElement;
  w: number;
  h: number;
}

interface EdgeView {
  data: BoardEdge;
  g: SVGGElement;
  path: SVGPathElement;
}

export interface Board {
  el: HTMLElement;
  /** Troca o quadro mostrado (tudo começa oculto). */
  load(spec: BoardSpec): void;
  apply(action: BoardAction): void;
  /** Liga/desliga o modo de escolha: nós visíveis viram clicáveis. */
  setSelectable(on: boolean): void;
  onSelect(cb: (nodeId: string) => void): void;
}

const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

const KIND_LABEL: Record<string, string> = {
  frontend: "interface",
  service: "serviço",
  db: "banco de dados",
  external: "externo",
  queue: "fila",
  person: "pessoa",
  team: "time",
  value: "valor",
  doc: "referência",
  task: "tarefa",
};

/** Largura aproximada do nó pelo tamanho do texto (sem medir o DOM). */
function nodeSize(n: BoardNode): { w: number; h: number } {
  const longest = Math.max(n.label.length * 8.4, (n.sublabel?.length ?? 0) * 6.2);
  return { w: Math.max(120, Math.round(longest + 36)), h: n.sublabel ? 58 : 44 };
}

function edgeGeometry(a: NodeView, b: NodeView): { d: string; mid: { x: number; y: number } } {
  const ax = a.data.x, ay = a.data.y, bx = b.data.x, by = b.data.y;
  const dx = bx - ax, dy = by - ay;
  let x1, y1, x2, y2, c1x, c1y, c2x, c2y;
  // Diagonal exata sai por cima/baixo: pela lateral embolaria com as setas de entrada.
  if (Math.abs(dx) > Math.abs(dy)) {
    const s = Math.sign(dx) || 1;
    x1 = ax + (s * a.w) / 2; y1 = ay;
    x2 = bx - (s * b.w) / 2 - s * 4; y2 = by;
    const k = (x2 - x1) / 2;
    c1x = x1 + k; c1y = y1; c2x = x2 - k; c2y = y2;
  } else {
    const s = Math.sign(dy) || 1;
    x1 = ax; y1 = ay + (s * a.h) / 2;
    x2 = bx; y2 = by - (s * b.h) / 2 - s * 4;
    const k = (y2 - y1) / 2;
    c1x = x1; c1y = y1 + k; c2x = x2; c2y = y2 - k;
  }
  // ponto do meio da curva cúbica (t = 0,5)
  const mid = { x: (x1 + 3 * c1x + 3 * c2x + x2) / 8, y: (y1 + 3 * c1y + 3 * c2y + y2) / 8 };
  return { d: `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`, mid };
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function mountBoard(parent: HTMLElement): Board {
  const el = document.createElement("div");
  el.className = "board";
  el.innerHTML = `<p class="board__title" aria-hidden="true"></p><div class="board__card" role="dialog" aria-live="polite" hidden></div>`;
  const titleEl = el.querySelector<HTMLElement>(".board__title")!;
  const cardEl = el.querySelector<HTMLElement>(".board__card")!;

  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "board__svg", role: "group" });
  const defs = svg("defs");
  for (const tone of ["base", "focus", "warn", "ok"]) {
    const m = svg("marker", { id: `arrow-${tone}`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" });
    m.appendChild(svg("path", { d: "M1.5,1.5 L8.5,5 L1.5,8.5", class: `board__arrow board__arrow--${tone}` }));
    defs.appendChild(m);
  }
  const edgesG = svg("g", { class: "board__edges" });
  const nodesG = svg("g", { class: "board__nodes" });
  const pulse = svg("circle", { r: 7, class: "board__pulse" });
  root.append(defs, edgesG, nodesG, pulse);
  el.prepend(root);
  parent.appendChild(el);

  let nodes = new Map<string, NodeView>();
  let edges = new Map<string, EdgeView>();
  let view: Box = { ...FULL };
  let viewAnim = 0;
  let flowAnim = 0;
  let cardFor: string | null = null;
  let selectCb: ((id: string) => void) | null = null;
  let selectable = false;

  function setView(b: Box): void {
    view = b;
    root.setAttribute("viewBox", `${b.x} ${b.y} ${b.w} ${b.h}`);
    positionCard();
  }

  function animateView(to: Box): void {
    cancelAnimationFrame(viewAnim);
    if (reducedMotion()) return setView(to);
    const from = { ...view };
    const start = performance.now();
    const dur = 700;
    const step = (now: number) => {
      const t = ease(Math.min(1, (now - start) / dur));
      setView({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        w: from.w + (to.w - from.w) * t,
        h: from.h + (to.h - from.h) * t,
      });
      if (t < 1) viewAnim = requestAnimationFrame(step);
    };
    viewAnim = requestAnimationFrame(step);
  }

  function focusBox(id: string | null): Box {
    const n = id ? nodes.get(id) : null;
    if (!n) return { ...FULL };
    const w = W / ZOOM, h = H / ZOOM;
    const x = Math.min(Math.max(0, n.data.x - w / 2), W - w);
    const y = Math.min(Math.max(0, n.data.y - h / 2), H - h);
    return { x, y, w, h };
  }

  // ---- montagem ----
  function load(spec: BoardSpec): void {
    cancelAnimationFrame(flowAnim);
    pulse.classList.remove("is-on");
    closeCard();
    edgesG.replaceChildren();
    nodesG.replaceChildren();
    nodes = new Map();
    edges = new Map();
    titleEl.textContent = spec.title ?? "";
    el.classList.remove("has-highlight");

    for (const n of spec.nodes) {
      const { w, h } = nodeSize(n);
      const g = svg("g", { class: "bnode", "data-id": n.id, "data-kind": n.kind, "data-state": "hidden", transform: `translate(${n.x},${n.y})` });
      // dono não confirmado: nó tracejado, como "caixa preta" no quadro
      if (n.info?.owner_confirmed === false) g.dataset.unconfirmed = "";
      g.setAttribute("aria-label", `${n.label}${n.sublabel ? ", " + n.sublabel : ""} (${KIND_LABEL[n.kind] ?? n.kind})`);
      const inner = svg("g", { class: "bnode__inner" });
      // anel amarelo de foco, atrás da caixa
      inner.appendChild(svg("rect", { class: "bnode__halo", x: -w / 2 - 6, y: -h / 2 - 6, width: w + 12, height: h + 12, rx: n.kind === "queue" ? h / 2 + 6 : 17 }));
      inner.appendChild(svg("rect", { class: "bnode__box", x: -w / 2, y: -h / 2, width: w, height: h, rx: n.kind === "queue" ? h / 2 : 12 }));
      const label = svg("text", { class: "bnode__label", x: 0, y: n.sublabel ? -3 : 6, "text-anchor": "middle" });
      label.textContent = n.label;
      inner.appendChild(label);
      if (n.sublabel) {
        const sub = svg("text", { class: "bnode__sub", x: 0, y: 16, "text-anchor": "middle" });
        sub.textContent = n.sublabel;
        inner.appendChild(sub);
      }
      g.appendChild(inner);
      nodesG.appendChild(g);
      nodes.set(n.id, { data: n, g, w, h });
    }

    for (const e of spec.edges) {
      const a = nodes.get(e.from), b = nodes.get(e.to);
      if (!a || !b) continue;
      const { d, mid } = edgeGeometry(a, b);
      const g = svg("g", { class: "bedge", "data-id": e.id, "data-state": "hidden" });
      if (e.style) g.dataset.style = e.style;
      const path = svg("path", { class: "bedge__path", d, "marker-end": "url(#arrow-base)" });
      g.appendChild(path);
      if (e.label) {
        const t = svg("text", { class: "bedge__label", x: mid.x, y: mid.y - 9, "text-anchor": "middle" });
        t.textContent = e.label;
        g.appendChild(t);
      }
      edgesG.appendChild(g);
      edges.set(e.id, { data: e, g, path });
    }

    cancelAnimationFrame(viewAnim);
    setView({ ...FULL });
    applySelectable();
  }

  // ---- ações ----
  function reveal(ids: string[]): void {
    ids.forEach((id, i) => {
      const n = nodes.get(id);
      if (n && n.g.dataset.state === "hidden") {
        n.g.style.setProperty("--delay", `${i * 90}ms`);
        n.g.dataset.state = "shown";
      }
      const e = edges.get(id);
      if (e && e.g.dataset.state === "hidden") {
        const len = e.path.getTotalLength?.() ?? 400;
        e.path.style.strokeDasharray = `${len}`;
        e.path.style.strokeDashoffset = `${len}`;
        e.g.style.setProperty("--delay", `${150 + i * 90}ms`);
        e.g.dataset.state = "shown";
        // próximo frame: anima o traço "se desenhando"
        requestAnimationFrame(() => requestAnimationFrame(() => (e.path.style.strokeDashoffset = "0")));
      }
    });
    applySelectable();
  }

  function highlight(ids: string[], tone: HighlightTone): void {
    for (const id of ids) {
      const v = nodes.get(id) ?? edges.get(id);
      if (!v) continue;
      v.g.dataset.tone = tone;
      if ("path" in v) v.path.setAttribute("marker-end", `url(#arrow-${tone})`);
    }
    el.classList.add("has-highlight");
  }

  function clearHighlight(): void {
    for (const v of [...nodes.values(), ...edges.values()]) {
      delete v.g.dataset.tone;
      if ("path" in v) v.path.setAttribute("marker-end", "url(#arrow-base)");
    }
    el.classList.remove("has-highlight");
  }

  function flow(path: string[]): void {
    cancelAnimationFrame(flowAnim);
    const paths = path.map((id) => edges.get(id)).filter((e): e is EdgeView => !!e && e.g.dataset.state !== "hidden");
    if (!paths.length || reducedMotion()) return;
    const per = 650;
    const start = performance.now() + 250;
    pulse.classList.add("is-on");
    const step = (now: number) => {
      const t = Math.max(0, now - start);
      const i = Math.floor(t / per);
      if (i >= paths.length) {
        pulse.classList.remove("is-on");
        return;
      }
      const p = paths[i].path;
      const pt = p.getPointAtLength(p.getTotalLength() * ease((t % per) / per));
      pulse.setAttribute("cx", String(pt.x));
      pulse.setAttribute("cy", String(pt.y));
      flowAnim = requestAnimationFrame(step);
    };
    flowAnim = requestAnimationFrame(step);
  }

  function reset(): void {
    for (const v of [...nodes.values(), ...edges.values()]) {
      v.g.dataset.state = "hidden";
      v.g.removeAttribute("data-focus");
    }
    clearHighlight();
    closeCard();
    animateView({ ...FULL });
  }

  // ---- cartão do nó ----
  function cardHTML(n: BoardNode): string {
    const i = n.info ?? {};
    const parts: string[] = [`<header class="bcard__head"><span class="bcard__kind" data-kind="${esc(n.kind)}">${esc(KIND_LABEL[n.kind] ?? n.kind)}</span><h3 class="bcard__title">${esc(n.label)}</h3><button class="bcard__close" type="button" aria-label="Fechar cartão">×</button></header>`];
    if (i.role) parts.push(`<p class="bcard__role">${esc(i.role)}</p>`);
    const facts: string[] = [];
    if (i.team) facts.push(`<dt>Time</dt><dd>${esc(i.team)}</dd>`);
    if (i.owner && i.owner_confirmed !== false) facts.push(`<dt>Responsável</dt><dd>${esc(i.owner)}</dd>`);
    if (facts.length) parts.push(`<dl class="bcard__facts">${facts.join("")}</dl>`);
    if (i.owner_confirmed === false) {
      parts.push(`<p class="bcard__unconfirmed">Não encontrei um responsável confirmado na documentação. Fale com a sua buddy antes de assumir quem cuida.</p>`);
    }
    if (i.adr) {
      parts.push(`<div class="bcard__adr"><span class="bcard__adr-id">${esc(i.adr.id)}</span><strong>${esc(i.adr.title)}</strong><p>${esc(i.adr.summary)}</p>${i.adr.owner ? `<span class="bcard__muted">Decisão: ${esc(i.adr.owner)}</span>` : ""}</div>`);
    }
    if (i.bullets?.length) parts.push(`<ul class="bcard__list">${i.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`);
    if (i.docs?.length) {
      parts.push(`<div class="bcard__docs"><span class="bcard__muted">Fontes</span>${i.docs.map((d) => `<span class="bcard__doc">${esc(d.title)}</span>`).join("")}</div>`);
    }
    return parts.join("");
  }

  function openCard(id: string): void {
    const n = nodes.get(id);
    if (!n) return;
    cardFor = id;
    cardEl.innerHTML = cardHTML(n.data);
    cardEl.setAttribute("aria-label", `Detalhes: ${n.data.label}`);
    cardEl.hidden = false;
    cardEl.classList.remove("is-in");
    void cardEl.offsetWidth;
    cardEl.classList.add("is-in");
    positionCard();
  }

  function closeCard(): void {
    cardFor = null;
    cardEl.hidden = true;
    cardEl.classList.remove("is-in");
  }

  /**
   * Cartão perto do nó, no lado que menos cobre os outros nós visíveis
   * (direita, esquerda, abaixo, acima — nessa ordem de preferência). Nunca cobre o próprio nó.
   */
  function positionCard(): void {
    if (!cardFor) return;
    const n = nodes.get(cardFor);
    const ctm = root.getScreenCTM();
    if (!n || !ctm) return;
    const host = el.getBoundingClientRect();
    const rectOf = (v: NodeView): Box => {
      const a = new DOMPoint(v.data.x - v.w / 2, v.data.y - v.h / 2).matrixTransform(ctm);
      const b = new DOMPoint(v.data.x + v.w / 2, v.data.y + v.h / 2).matrixTransform(ctm);
      return { x: a.x - host.left, y: a.y - host.top, w: b.x - a.x, h: b.y - a.y };
    };
    const overlap = (a: Box, b: Box) =>
      Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const clamp = (b: Box): Box => ({
      ...b,
      x: Math.min(Math.max(8, b.x), Math.max(8, host.width - b.w - 8)),
      y: Math.min(Math.max(8, b.y), Math.max(8, host.height - b.h - 8)),
    });

    const anchor = rectOf(n);
    const others = [...nodes.values()].filter((v) => v !== n && v.g.dataset.state !== "hidden").map(rectOf);
    const cw = cardEl.offsetWidth || 300;
    const ch = cardEl.offsetHeight || 200;
    const gap = 14;
    const cy = anchor.y + anchor.h / 2 - ch / 2;
    const cx = anchor.x + anchor.w / 2 - cw / 2;
    const candidates: Box[] = [
      { x: anchor.x + anchor.w + gap, y: cy, w: cw, h: ch },
      { x: anchor.x - gap - cw, y: cy, w: cw, h: ch },
      { x: cx, y: anchor.y + anchor.h + gap, w: cw, h: ch },
      { x: cx, y: anchor.y - gap - ch, w: cw, h: ch },
    ].map(clamp);

    let best = candidates[0];
    let bestCost = Infinity;
    candidates.forEach((c, i) => {
      // cobrir o próprio nó é o pior caso; depois, área coberta dos outros; empate fica com a ordem
      const cost = overlap(c, anchor) * 100 + others.reduce((s, o) => s + overlap(c, o), 0) + i;
      if (cost < bestCost) {
        bestCost = cost;
        best = c;
      }
    });
    cardEl.style.transform = `translate(${Math.round(best.x)}px, ${Math.round(best.y)}px)`;
  }

  cardEl.addEventListener("click", (e) => {
    if ((e.target as Element).closest(".bcard__close")) closeCard();
  });
  window.addEventListener("resize", positionCard);

  // ---- escolha de nó (passo "select") ----
  function applySelectable(): void {
    el.classList.toggle("is-selecting", selectable);
    for (const n of nodes.values()) {
      const on = selectable && n.g.dataset.state !== "hidden";
      if (on) {
        n.g.setAttribute("tabindex", "0");
        n.g.setAttribute("role", "button");
      } else {
        n.g.removeAttribute("tabindex");
        n.g.removeAttribute("role");
      }
    }
  }

  function pick(target: EventTarget | null): void {
    if (!selectable || !(target instanceof Element)) return;
    const g = target.closest<SVGGElement>(".bnode");
    if (!g || g.dataset.state === "hidden") return;
    selectCb?.(g.dataset.id!);
  }
  nodesG.addEventListener("click", (e) => pick(e.target));
  nodesG.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(e.target);
    }
  });

  return {
    el,
    load,
    apply(a: BoardAction) {
      switch (a.type) {
        case "reveal": return reveal(a.targets);
        case "highlight": return highlight(a.targets, a.tone ?? "focus");
        case "clear_highlight": return clearHighlight();
        case "focus":
          for (const n of nodes.values()) n.g.toggleAttribute("data-focus", n.data.id === a.target);
          return animateView(focusBox(a.target));
        case "flow": return flow(a.path);
        case "card": return openCard(a.target);
        case "close_card": return closeCard();
        case "reset": return reset();
      }
    },
    setSelectable(on: boolean) {
      selectable = on;
      applySelectable();
    },
    onSelect(cb) {
      selectCb = cb;
    },
  };
}
