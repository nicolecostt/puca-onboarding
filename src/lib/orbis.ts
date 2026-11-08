// Contrato "Computer use" (docs/contratos.md): o que o app para Mac expõe ao front em window.orbis.
// Sem o app (npm run dev no navegador comum), window.orbis não existe e a sessão segue com o simulado.

/** Onde agir na página: pelo texto visível (sem diferenciar maiúscula nem acento) ou por seletor. Nunca coordenada. */
export type Alvo = { texto: string; seletor?: string } | { seletor: string };

/** Uma ação de Puca no navegador dele. Nenhuma publica nada em nome da pessoa. */
export type AcaoDaPuca =
  | { tipo: "abrir"; url: string }
  | { tipo: "apontar" | "circular" | "marcar" | "rolar" | "clicar"; alvo: Alvo }
  | { tipo: "limpar" };

export const TIPOS_DE_ACAO = ["abrir", "apontar", "circular", "marcar", "rolar", "clicar", "limpar"] as const;

/** O que a fila fez com um lote de ações. Alvo não achado ou endereço fora da Kota vira falha; a fila segue. */
export interface ResultadoDaFila {
  feitas: number;
  falhas: { acao: AcaoDaPuca; motivo: string }[];
  /** A pessoa falou por cima: o resto do lote não rodou. */
  cancelada: boolean;
}

export interface OrbisNavegador {
  /** Onde a área do navegador fica na janela (px do conteúdo da janela). */
  mostrar(bounds: { x: number; y: number; width: number; height: number }): void;
  esconder(): void;
  executar(acoes: AcaoDaPuca[]): Promise<ResultadoDaFila>;
  /** A pessoa falou por cima: a fila para antes da próxima ação e os desenhos somem. */
  cancelar(): void;
}

