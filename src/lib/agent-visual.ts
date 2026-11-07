// Visual do agente (a "bolha"). Ainda em definição: hoje existe só um teste local
// (sandbox/iris-teste.ts, fora do git). Se o arquivo não existir, as telas usam
// um círculo neutro no lugar.

export type AgentVisualState = "idle" | "think" | "talk";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface AgentVisual {
  setState(state: AgentVisualState): void;
  /** true = "esquenta" (fica vermelha, pensando); false = volta ao normal. */
  setWarm(on: boolean): void;
  /** Cor atual do agente, 0–255 (usada na borda da câmera). */
  getColor(): RGB;
}

export type AgentVisualFactory = (container: HTMLElement) => AgentVisual;

// import.meta.glob não quebra o build quando o arquivo não existe: só volta vazio.
const testVisual = import.meta.glob<{ mountIris: AgentVisualFactory }>("../../sandbox/iris-teste.ts");

export async function loadAgentVisual(): Promise<AgentVisualFactory | null> {
  const load = testVisual["../../sandbox/iris-teste.ts"];
  if (!load) return null;
  try {
    return (await load()).mountIris;
  } catch (err) {
    console.warn("Não foi possível carregar o visual de teste do agente:", err);
    return null;
  }
}
