// Cursor da Puca: a seta com a etiqueta "Puca" que mexe na tela da pessoa (por enquanto simulado).
//   const cursor = mountAgentCursor();
//   await cursor.moveTo(el);  await cursor.click();  cursor.setPaused(true);  cursor.hide();
// Não recebe cliques (pointer-events: none): só mostra o que a Puca está fazendo.
import "../../styles/tokens.css";
import "./agent-cursor.css";

export interface AgentCursorOptions {
  name?: string;
  parent?: HTMLElement;
  /** Posição inicial (px da tela). */
  start?: { x: number; y: number };
}

export interface AgentCursor {
  el: HTMLElement;
  /** Vai até o centro do elemento (ou até um ponto). Resolve quando chega. */
  moveTo(target: Element | { x: number; y: number }): Promise<void>;
  /** "Clica" onde está: aperta a seta e solta um anel. */
  click(): Promise<void>;
  /** Pausado: para no lugar, e as esperas seguram até voltar. */
  setPaused(on: boolean): void;
  show(): void;
  hide(): void;
}

const ARROW = `<svg class="agent-cursor__arrow" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M4 3.2 20.4 10a.6.6 0 0 1-.05 1.13l-6.8 2.1a1 1 0 0 0-.65.62l-2.3 6.6a.6.6 0 0 1-1.13.02L3.2 4a.6.6 0 0 1 .8-.8z"/>
</svg>`;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mountAgentCursor(opts: AgentCursorOptions = {}): AgentCursor {
  const el = document.createElement("div");
  el.className = "agent-cursor";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `${ARROW}<span class="agent-cursor__tag">${opts.name ?? "Puca"}</span><span class="agent-cursor__ring"></span>`;
  (opts.parent ?? document.body).appendChild(el);

  let pos = opts.start ?? { x: innerWidth * 0.55, y: innerHeight * 0.4 };
  let paused = false;
  place(pos, 0);

  function place(p: { x: number; y: number }, ms: number): void {
    el.style.transitionDuration = `${ms}ms`;
    el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
  }

  /** Espera que não corre enquanto pausado. */
  async function wait(ms: number): Promise<void> {
    let left = ms;
    while (left > 0) {
      await sleep(50);
      if (!paused) left -= 50;
    }
  }

  return {
    el,
    async moveTo(target) {
      let to = target instanceof Element ? null : target;
      if (target instanceof Element) {
        const r = target.getBoundingClientRect();
        to = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      if (!to) return;
      while (paused) await sleep(50);
      // mais longe = mais tempo, com teto (parece uma mão mexendo o mouse)
      const dist = Math.hypot(to.x - pos.x, to.y - pos.y);
      const ms = reducedMotion() ? 0 : Math.min(1100, 350 + dist * 0.9);
      place(to, ms);
      pos = to;
      await wait(ms);
    },
    async click() {
      while (paused) await sleep(50);
      el.classList.remove("is-clicking");
      void el.offsetWidth; // reinicia a animação
      el.classList.add("is-clicking");
      await wait(450);
    },
    setPaused(on) {
      paused = on;
      el.classList.toggle("is-paused", on);
      if (on) {
        // congela onde está no meio do movimento
        const now = getComputedStyle(el).transform;
        el.style.transitionDuration = "0ms";
        el.style.transform = now;
      } else {
        place(pos, 300);
      }
    },
    show() {
      el.classList.remove("is-hidden");
    },
    hide() {
      el.classList.add("is-hidden");
    },
  };
}
