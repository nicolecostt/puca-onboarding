// Visual do agente: a esfera de pontos da Puca (puca-sphere.ts), usada em todas as telas.
// Se der erro ao carregar, as telas usam um círculo neutro no lugar.

export type AgentVisualState = "idle" | "think" | "talk";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface AgentVisual {
  setState(state: AgentVisualState): void;
  /** true = "esquenta" (pensando: a faixa satura e o arco-íris gira mais rápido); false = volta ao normal. */
  setWarm(on: boolean): void;
  /** Cor atual da faixa do agente, 0–255 (hoje nenhuma tela usa; a câmera ficou neutra). */
  getColor(): RGB;
}

export type AgentVisualFactory = (container: HTMLElement) => AgentVisual;

export async function loadAgentVisual(): Promise<AgentVisualFactory | null> {
  try {
    return (await import("./puca-sphere")).mountPucaSphere;
  } catch (err) {
    console.warn("Não foi possível carregar o visual da Puca:", err);
    return null;
  }
}
