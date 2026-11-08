// Quadro da sessão (Figma: "03 · Aula no quadro"). Desenha nós, setas e selos e vai revelando aos poucos,
// acompanhando a fala da Puca. Os dados vêm da jornada (ver from-journey.ts).
//   const board = mountWhiteboard(el, spec);
//   board.reveal(["gateway", "e-pos-gw"]); board.setFocus("gateway"); board.highlight(["dlq"], "warn");
//   board.openCard("gateway"); board.flow(["e-pos-gw", "e-gw-topic"]); board.setSelectable(true);
import "../../styles/tokens.css";
import "./whiteboard.css";
import lockWhiteIcon from "./icons/lock-white.svg";
import lockIcon from "./icons/lock.svg";
import { esc, targetEl } from "../../lib/dom";
import { company, type BoardEdge, type BoardNode, type WhiteboardSpec } from "../../data";

export type HighlightTone = "focus" | "warn" | "ok";

/** Tamanho do quadro no Figma; tudo é desenhado nessa escala e depois ajustado à tela. */
export const BOARD_W = 1440;
export const BOARD_H = 844;

export interface Whiteboard {
  el: HTMLElement;
  /** Mostra nós, setas e rótulos (com animação). */
  reveal(ids: string[]): void;
  /** Anel amarelo num nó (null tira). Revela o nó se ainda estiver escondido. */
  setFocus(id: string | null): void;
  /** Destaca quem é dono de cada nó. */
  showOwners(on: boolean): void;
  isShown(id: string): boolean;
  /** Volta ao começo (só o que é "ainda não explicado" aparece). */
  reset(): void;
  /** Destaca nós/setas num tom (o resto fica apagado até limpar). */
  highlight(ids: string[], tone: HighlightTone): void;
  clearHighlight(): void;
  /** Abre o cartão de detalhes do nó (o mesmo do clique). */
  openCard(id: string): void;
  closeCard(): void;
  /** Uma bolinha percorre as setas, em ordem. */
  flow(edgeIds: string[]): void;
  /** Modo de escolha: tocar num nó visível chama onSelect em vez de abrir o cartão. */
  setSelectable(on: boolean): void;
  onSelect(cb: (id: string) => void): void;
  /** Tira o quadro da tela. */
  destroy(): void;
}

function ownerText(n: BoardNode): string {
  if (n.ownerId) {
    const p = company.people[n.ownerId];
    return p ? `@${p.handle}` : "";
  }
  return n.caption ?? "";
}

function nodeHTML(n: BoardNode): string {
  const owner = ownerText(n);
  const label = n.label.split("\n").map(esc).join("<br>");
  return `
    <button class="wb-node wb-node--${n.kind}" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.w}px"
      aria-label="${esc(n.label.replace("\n", " "))}${owner ? `, ${esc(owner)}` : ""}">
      <span class="wb-node__label">${label}</span>
      ${owner ? `<span class="wb-node__owner">${esc(owner)}</span>` : ""}
      ${n.kind === "blackbox" ? `<span class="wb-node__lock"><img src="${lockWhiteIcon}" width="12" height="12" alt=""></span>` : ""}
      ${n.note ? `<span class="wb-node__note"><img src="${lockIcon}" width="11" height="11" alt="">${esc(n.note)}</span>` : ""}
    </button>`;
}

function edgeSVG(e: BoardEdge): string {
  const style = e.style ?? "solid";
  return `<g class="wb-edge wb-edge--${style}" data-id="${e.id}">
      <path class="wb-edge__line" d="${e.path}"${style === "solid" ? ' pathLength="1"' : ""}/>
      <path class="wb-edge__head" d="${e.head}"/>
    </g>`;
}

function edgeExtrasHTML(e: BoardEdge): string {
  let html = "";
  if (e.label) {
    const font = e.label.font === "mono" ? "mono" : "hand";
    html += `<span class="wb-label wb-label--${font}${e.style === "retry" ? " wb-label--danger" : ""}" data-edge="${e.id}"
      style="left:${e.label.x}px;top:${e.label.y}px">${esc(e.label.text)}</span>`;
  }
  if (e.evidence) {
    const proven = e.evidence.kind === "proven";
    html += `<span class="wb-badge wb-badge--${e.evidence.kind}" data-edge="${e.id}" style="left:${e.evidence.x}px;top:${e.evidence.y}px">
      ${proven ? "✓ provado" : "inferido · não confirmado pelo dono"}</span>`;
  }
  return html;
}

export function mountWhiteboard(parent: HTMLElement, lesson: WhiteboardSpec): Whiteboard {
  const root = document.createElement("div");
  root.className = "wb";
  root.innerHTML = `
    <div class="wb__stage" style="width:${BOARD_W}px;height:${BOARD_H}px">
      <svg class="wb__edges" viewBox="0 0 ${BOARD_W} ${BOARD_H}" width="${BOARD_W}" height="${BOARD_H}" aria-hidden="true">
        ${lesson.edges.map(edgeSVG).join("")}
        <circle class="wb-pulse" r="7"/>
      </svg>
      ${lesson.edges.map(edgeExtrasHTML).join("")}
      ${lesson.labels.map((l) => `<span class="wb-label wb-label--hand wb-label--section" data-id="${l.id}" style="left:${l.x}px;top:${l.y}px">${esc(l.text)}</span>`).join("")}
      ${lesson.nodes.map(nodeHTML).join("")}
    </div>
    <div class="wb-pop" role="dialog" aria-live="polite" hidden></div>`;
  parent.appendChild(root);

  const stage = root.querySelector<HTMLElement>(".wb__stage")!;
  const pop = root.querySelector<HTMLElement>(".wb-pop")!;
  const nodesById = new Map(lesson.nodes.map((n) => [n.id, n]));

  // elementos de cada id (nó, seta + seus selos/rótulos, rótulo solto)
  function elementsOf(id: string): Element[] {
    return [...root.querySelectorAll(`[data-id="${id}"], [data-edge="${id}"]`)];
  }

  function setState(id: string, state: "hidden" | "upcoming" | "shown"): void {
    for (const el of elementsOf(id)) {
      el.classList.toggle("is-shown", state === "shown");
      el.classList.toggle("is-upcoming", state === "upcoming");
      if (el instanceof HTMLButtonElement) el.tabIndex = state === "hidden" ? -1 : 0;
    }
  }

  // Ajusta o quadro à área disponível pelo que está desenhado nele (todos os nós e rótulos, inclusive os que
  // ainda vão aparecer, para o zoom não mudar no meio da sessão), e não pela folha inteira de 1440×844.
  let content: { x: number; y: number; w: number; h: number } | null = null;
  function measure(): { x: number; y: number; w: number; h: number } {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const el of stage.querySelectorAll<HTMLElement>(":scope > :not(svg)")) {
      if (!el.offsetWidth) continue;
      x0 = Math.min(x0, el.offsetLeft);
      y0 = Math.min(y0, el.offsetTop);
      x1 = Math.max(x1, el.offsetLeft + el.offsetWidth);
      y1 = Math.max(y1, el.offsetTop + el.offsetHeight);
    }
    if (!Number.isFinite(x0)) return { x: 0, y: 0, w: BOARD_W, h: BOARD_H };
    const pad = 32;
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  }
  function fit(): void {
    content ??= measure();
    const s = Math.min(root.clientWidth / content.w, root.clientHeight / content.h, 1.6);
    const tx = root.clientWidth / 2 - (content.x + content.w / 2) * s;
    const ty = root.clientHeight / 2 - (content.y + content.h / 2) * s;
    stage.style.transformOrigin = "0 0";
    stage.style.left = stage.style.top = "0";
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  }
  const resize = new ResizeObserver(fit);
  resize.observe(root);
  // a fonte à mão muda a largura dos nós: mede de novo quando as fontes terminam de carregar
  void document.fonts?.ready.then(() => {
    content = null;
    fit();
  });

  // ---- detalhes ao clicar num nó ----
  function closePop(): void {
    pop.hidden = true;
    root.querySelector(".wb-node.is-open")?.classList.remove("is-open");
  }

  function openPop(btn: HTMLElement, n: BoardNode): void {
    const owner = n.ownerId ? company.people[n.ownerId] : undefined;
    const d = n.details;
    const row = (label: string, value: string) => `<div class="wb-pop__row"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
    const rows = [
      owner ? row("Dono", `${esc(owner.name)} · ${esc(owner.team)}`) : "",
      ...(d?.rows ?? []).map((r) => row(r.label, esc(r.value))),
      d?.docs?.length ? row("Fontes", d.docs.map(esc).join("<br>")) : "",
      d?.help ? row("Ajuda", esc(d.help)) : "",
    ].join("");
    // cabeçalho (nome e legenda do nó), o que é, os dados em linhas e o que vale saber
    pop.innerHTML = `
      <header class="wb-pop__head">
        <p class="wb-pop__title">${esc(n.label.replace("\n", " "))}</p>
        ${n.caption ? `<p class="wb-pop__caption">${esc(n.caption)}</p>` : ""}
      </header>
      ${d?.what ? `<p class="wb-pop__what">${esc(d.what)}</p>` : ""}
      ${rows ? `<dl class="wb-pop__rows">${rows}</dl>` : ""}
      ${d?.warn ? `<p class="wb-pop__warn">${esc(d.warn)}</p>` : ""}
      ${d?.list?.length ? `<ul class="wb-pop__list">${d.list.map((li) => `<li>${esc(li)}</li>`).join("")}</ul>` : ""}`;
    pop.hidden = false;
    btn.classList.add("is-open");
    // posiciona perto do nó (em px da tela)
    const r = btn.getBoundingClientRect();
    const base = root.getBoundingClientRect();
    const left = Math.min(r.left - base.left, base.width - pop.offsetWidth - 12);
    const below = r.bottom - base.top + 10;
    const top = below + pop.offsetHeight > base.height - 12 ? r.top - base.top - pop.offsetHeight - 10 : below;
    pop.style.left = `${Math.max(12, left)}px`;
    pop.style.top = `${Math.max(12, top)}px`;
  }

  let selecting = false;
  let selectCb: ((id: string) => void) | null = null;

  root.addEventListener("click", (e) => {
    const btn = targetEl(e)?.closest<HTMLElement>(".wb-node");
    if (!btn || !btn.classList.contains("is-shown")) {
      if (!targetEl(e)?.closest(".wb-pop")) closePop();
      return;
    }
    const n = nodesById.get(btn.dataset.id ?? "");
    if (!n) return;
    if (selecting) {
      closePop();
      selectCb?.(n.id);
      return;
    }
    if (btn.classList.contains("is-open")) closePop();
    else {
      closePop();
      openPop(btn, n);
    }
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") closePop();
  };
  document.addEventListener("keydown", onKey);

  // ---- pulso percorrendo as setas ----
  const svgEl = root.querySelector<SVGSVGElement>(".wb__edges")!;
  const pulse = root.querySelector<SVGCircleElement>(".wb-pulse")!;
  let flowAnim = 0;
  function runFlow(edgeIds: string[]): void {
    cancelAnimationFrame(flowAnim);
    // caminho de medida sem pathLength (o pathLength="1" do traço muda as contas de distância)
    const paths = edgeIds
      .filter((id) => shown.has(id))
      .map((id) => lesson.edges.find((e) => e.id === id))
      .filter((e): e is BoardEdge => !!e)
      .map((e) => {
        const m = document.createElementNS("http://www.w3.org/2000/svg", "path");
        m.setAttribute("d", e.path);
        m.setAttribute("fill", "none");
        m.setAttribute("stroke", "none");
        svgEl.appendChild(m);
        return m;
      });
    if (!paths.length || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paths.forEach((m) => m.remove());
      return;
    }
    const per = 650;
    const start = performance.now() + 200;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    pulse.classList.add("is-on");
    const step = (now: number) => {
      const t = Math.max(0, now - start);
      const i = Math.floor(t / per);
      if (i >= paths.length) {
        pulse.classList.remove("is-on");
        paths.forEach((m) => m.remove());
        return;
      }
      const m = paths[i];
      const pt = m.getPointAtLength(m.getTotalLength() * ease((t % per) / per));
      pulse.setAttribute("cx", String(pt.x));
      pulse.setAttribute("cy", String(pt.y));
      flowAnim = requestAnimationFrame(step);
    };
    flowAnim = requestAnimationFrame(step);
  }

  const shown = new Set<string>();

  const api: Whiteboard = {
    el: root,
    reveal(ids) {
      for (const id of ids) {
        shown.add(id);
        setState(id, "shown");
      }
    },
    setFocus(id) {
      root.querySelectorAll(".wb-node.is-focus").forEach((el) => el.classList.remove("is-focus"));
      if (!id) return;
      if (!shown.has(id)) api.reveal([id]);
      root.querySelector(`.wb-node[data-id="${id}"]`)?.classList.add("is-focus");
    },
    showOwners(on) {
      root.classList.toggle("wb--owners", on);
    },
    isShown: (id) => shown.has(id),
    reset() {
      shown.clear();
      closePop();
      const all = [...lesson.nodes.map((n) => n.id), ...lesson.edges.map((e) => e.id), ...lesson.labels.map((l) => l.id)];
      for (const id of all) setState(id, lesson.upcoming.includes(id) ? "upcoming" : "hidden");
      api.setFocus(null);
      api.clearHighlight();
    },
    highlight(ids, tone) {
      for (const id of ids) {
        for (const el of elementsOf(id)) {
          el.classList.remove("tone-focus", "tone-warn", "tone-ok");
          el.classList.add(`tone-${tone}`);
        }
      }
      root.classList.add("wb--highlight");
    },
    clearHighlight() {
      root.querySelectorAll(".tone-focus, .tone-warn, .tone-ok").forEach((el) => el.classList.remove("tone-focus", "tone-warn", "tone-ok"));
      root.classList.remove("wb--highlight");
    },
    openCard(id) {
      const btn = root.querySelector<HTMLElement>(`.wb-node[data-id="${id}"]`);
      const n = nodesById.get(id);
      if (!btn || !n) return;
      if (!shown.has(id)) api.reveal([id]);
      closePop();
      openPop(btn, n);
    },
    closeCard: () => closePop(),
    flow: (ids) => runFlow(ids),
    setSelectable(on) {
      selecting = on;
      root.classList.toggle("wb--selecting", on);
    },
    onSelect(cb) {
      selectCb = cb;
    },
    destroy() {
      cancelAnimationFrame(flowAnim);
      resize.disconnect();
      document.removeEventListener("keydown", onKey);
      root.remove();
    },
  };

  api.reset();
  fit();
  return api;
}
