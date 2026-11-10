// O histórico que a tela manda ao servidor a cada turno (contratos "Turno da sessão" e "Call inicial").
export type Historico = { role: "user" | "assistant"; content: string }[];

/** Quantos turnos a tela guarda e o servidor aceita. */
export const TURNOS_NO_HISTORICO = 24;

/** Guarda uma fala. Frases seguidas de Puca são o mesmo turno: viram uma entrada só, e a janela conta turnos, não frases. */
export function lembrar(h: Historico, role: "user" | "assistant", content: string, max = TURNOS_NO_HISTORICO): void {
  const last = h.at(-1);
  if (role === "assistant" && last?.role === "assistant") last.content += ` ${content}`;
  else h.push({ role, content });
  if (h.length > max) h.shift();
}
