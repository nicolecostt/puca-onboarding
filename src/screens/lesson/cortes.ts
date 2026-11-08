import type { BoardAction, SpeechCue } from "../../journey/types";

/**
 * Fala cortada (a pessoa tomou a vez ou houve um pulo): o quadro chega ao estado final do passo, mas o navegador
 * de Puca não age mais. Devolve as ações que faltavam a partir de `desde`, sem as do navegador.
 */
export function acoesQueAindaValem(cues: SpeechCue[], desde: number): BoardAction[] {
  return cues
    .slice(desde)
    .map((c) => c.action)
    .filter((a) => a.type !== "navegador");
}
