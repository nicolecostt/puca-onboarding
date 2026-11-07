// Quadro da aula (Figma: "03 · Aula no quadro"). Desenha nós, setas e selos a partir
// dos dados da aula e vai revelando aos poucos, acompanhando a fala do agente.
//   const board = mountWhiteboard(el, lesson);
//   board.reveal(["gateway", "pos-gateway"]); board.setFocus("gateway");
import "../../styles/tokens.css";
import "./whiteboard.css";
import lockWhiteIcon from "./icons/lock-white.svg";
import lockIcon from "./icons/lock.svg";
import { esc, targetEl } from "../../lib/dom";
import { company, type BoardEdge, type BoardNode, type Lesson } from "../../data";

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
      <path class="wb-edge__line" d="${e.path}" pathLength="1"/>
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

export function mountWhiteboard(parent: HTMLElement, lesson: Lesson): Whiteboard {
  const root = document.createElement("div");
  root.className = "wb";
  root.innerHTML = `
    <div class="wb__stage" style="width:${BOARD_W}px;height:${BOARD_H}px">
      <svg class="wb__edges" viewBox="0 0 ${BOARD_W} ${BOARD_H}" width="${BOARD_W}" height="${BOARD_H}" aria-hidden="true">
        ${lesson.edges.map(edgeSVG).join("")}
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

  // ajusta o quadro à área disponível, mantendo a proporção do Figma
  function fit(): void {
    const s = Math.min(root.clientWidth / BOARD_W, root.clientHeight / BOARD_H);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  new ResizeObserver(fit).observe(root);

  // ---- detalhes ao clicar num nó ----
  function closePop(): void {
    pop.hidden = true;
    root.querySelector(".wb-node.is-open")?.classList.remove("is-open");
  }

  function openPop(btn: HTMLElement, n: BoardNode): void {
    const owner = n.ownerId ? company.people[n.ownerId] : undefined;
    const d = n.details;
    pop.innerHTML = `
      <p class="wb-pop__title">${esc(n.label.replace("\n", " "))}</p>
      ${d ? `<p class="wb-pop__what">${esc(d.what)}</p>` : ""}
      ${owner ? `<p class="wb-pop__row"><span>Dono</span>${esc(owner.name)} · ${esc(owner.team)}</p>` : ""}
      ${d?.docs?.length ? `<p class="wb-pop__row"><span>Fontes</span>${d.docs.map(esc).join("<br>")}</p>` : ""}
      ${d?.help ? `<p class="wb-pop__row"><span>Ajuda</span>${esc(d.help)}</p>` : ""}`;
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

  root.addEventListener("click", (e) => {
    const btn = targetEl(e)?.closest<HTMLElement>(".wb-node");
    if (!btn || !btn.classList.contains("is-shown")) {
      if (!targetEl(e)?.closest(".wb-pop")) closePop();
      return;
    }
    const n = nodesById.get(btn.dataset.id ?? "");
    if (!n) return;
    if (btn.classList.contains("is-open")) closePop();
    else {
      closePop();
      openPop(btn, n);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePop();
  });

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
    },
  };

  api.reset();
  fit();
  return api;
}
