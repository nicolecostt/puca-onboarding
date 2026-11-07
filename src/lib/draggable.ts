// Arrastar um elemento fixo pela tela. Usado pela barra de call, pelo chat e pela câmera.
// Regras comuns: só vira arraste depois de mexer alguns px, não sai da tela,
// lembra a posição (localStorage) e duplo clique volta para o lugar original.
import { targetEl } from "./dom";

export interface DraggableOptions {
  /** Chave no localStorage para lembrar a posição. */
  storageKey: string;
  /** Onde o arraste começa (padrão: o próprio elemento). */
  handle?: HTMLElement;
  /** Quantos px mexer antes de virar arraste. */
  threshold?: number;
  /** Não começa arraste em cima de botões. */
  ignoreButtons?: boolean;
  /** Chama preventDefault no pointerdown (evita selecionar texto). */
  preventDefault?: boolean;
  /** Depois de arrastar, o soltar não conta como clique (para elementos cheios de botões). */
  suppressClickAfterDrag?: boolean;
  /** Duplo clique em botão também reseta? (padrão: não) */
  dblClickOnButtons?: boolean;
  onPlace?: () => void;
  onReset?: () => void;
}

interface Point {
  x: number;
  y: number;
}

const MARGIN = 8;

export function makeDraggable(el: HTMLElement, opts: DraggableOptions): { reset: () => void } {
  const handle = opts.handle ?? el;
  const threshold = opts.threshold ?? 5;

  function place(x: number, y: number): Point {
    const r = el.getBoundingClientRect();
    x = Math.min(Math.max(MARGIN, x), Math.max(MARGIN, innerWidth - r.width - MARGIN));
    y = Math.min(Math.max(MARGIN, y), Math.max(MARGIN, innerHeight - r.height - MARGIN));
    el.classList.add("is-placed");
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    opts.onPlace?.();
    return { x, y };
  }

  function reset(): void {
    el.classList.remove("is-placed");
    el.style.left = el.style.top = "";
    try {
      localStorage.removeItem(opts.storageKey);
    } catch {
      /* sem localStorage: tudo bem */
    }
    opts.onReset?.();
  }

  let drag: { sx: number; sy: number; ox: number; oy: number; moving: boolean; last: Point | null } | null = null;
  let justDragged = false;

  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (opts.ignoreButtons && targetEl(e)?.closest("button")) return;
    const r = el.getBoundingClientRect();
    drag = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moving: false, last: null };
    if (opts.preventDefault) e.preventDefault();
  });

  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (!drag.moving) {
      if (Math.hypot(dx, dy) < threshold) return;
      drag.moving = true;
      el.classList.add("is-dragging");
    }
    drag.last = place(drag.ox + dx, drag.oy + dy);
  });

  function endDrag(): void {
    if (drag?.moving) {
      el.classList.remove("is-dragging");
      justDragged = true;
      setTimeout(() => (justDragged = false), 0); // o click vem logo depois do pointerup
      try {
        localStorage.setItem(opts.storageKey, JSON.stringify(drag.last));
      } catch {
        /* sem localStorage: tudo bem */
      }
    }
    drag = null;
  }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  if (opts.suppressClickAfterDrag) {
    el.addEventListener(
      "click",
      (e) => {
        if (!justDragged) return;
        e.stopPropagation();
        e.preventDefault();
      },
      true,
    );
  }

  handle.addEventListener("dblclick", (e) => {
    if (!opts.dblClickOnButtons && targetEl(e)?.closest("button")) return;
    reset();
  });

  // continua dentro da tela quando a janela muda de tamanho
  window.addEventListener("resize", () => {
    if (!el.classList.contains("is-placed")) return;
    const r = el.getBoundingClientRect();
    place(r.left, r.top);
  });

  // posição salva da última vez
  try {
    const saved = JSON.parse(localStorage.getItem(opts.storageKey) ?? "null") as Partial<Point> | null;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) place(saved.x as number, saved.y as number);
  } catch {
    /* posição inválida ou sem localStorage */
  }

  return { reset };
}
