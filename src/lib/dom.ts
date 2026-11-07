/** querySelector que falha alto se o elemento não existir (evita checar null em todo lugar). */
export function qs<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Elemento não encontrado: ${selector}`);
  return el;
}

/** Escapa texto para colocar dentro de HTML. */
export function esc(value: unknown): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  return String(value).replace(/[&<>"]/g, (c) => map[c] ?? c);
}

/** Alvo do evento como Element (para usar .closest). */
export function targetEl(e: Event): Element | null {
  return e.target instanceof Element ? e.target : null;
}
