// Tipos dos dados de exemplo. Quando houver backend, ele deve devolver estes mesmos formatos.

export interface Person {
  id: string;
  name: string;
  /** @usuário no GitHub/Slack, mostrado nos nós do quadro. */
  handle: string;
  role: string;
  team: string;
}

export interface Company {
  name: string;
  teams: string[];
  people: Record<string, Person>;
}

/** Um item do cartão "Calibragem": o que o agente sabe sobre a pessoa. */
export interface CalibrationItem {
  label: string;
  value: string;
  tone: "success" | "warning" | "neutral";
}

export interface Profile {
  id: string;
  kind: "new-hire" | "transfer";
  name: string;
  /** Como prefere ser chamado. */
  nickname: string;
  initials: string;
  role: string;
  /** Só na transição: time de onde veio. */
  fromTeam?: string;
  toTeam: string;
  managerId: string;
  buddyId: string;
  tools: string;
  learningStyle: string;
  calibration: CalibrationItem[];
}

export type JourneyStepId = "access" | "lesson" | "first-ticket" | "ready";

export interface JourneyStep {
  id: JourneyStepId;
  label: string;
}

// ---- Sessão no quadro ----

/** Quanto a informação é confiável (contexto 4.3: deixar explícito quando não foi confirmado). */
export type Evidence = "proven" | "inferred";

export type BoardNodeKind =
  | "service" // caixa branca com borda
  | "topic" // pílula azul (fila/tópico)
  | "blackbox" // tracejado cinza, sem documentação confirmada
  | "dlq" // pílula vermelha tracejada
  | "external"; // sistema externo (sem dono interno)

export interface BoardNode {
  id: string;
  label: string;
  kind: BoardNodeKind;
  /** Posição e largura no quadro de 1440×844 (coordenadas do Figma). */
  x: number;
  y: number;
  w: number;
  /** id da pessoa dona (mostra @handle) ou texto livre (ex.: "kota.example"). */
  ownerId?: string;
  caption?: string;
  /** Texto do selo embaixo do nó (ex.: "legado · não sobe"). */
  note?: string;
  /** Detalhes ao clicar no nó (ou quando o Puca abre o cartão). */
  details?: NodeDetails;
}

export interface NodeDetails {
  what?: string;
  /** Linhas "rótulo: valor" (ex.: Time, Dono). */
  rows?: { label: string; value: string }[];
  /** Aviso (ex.: dono não confirmado). */
  warn?: string;
  /** Lista livre (ex.: detalhes da tarefa, resumo de uma decisão). */
  list?: string[];
  docs?: string[];
  help?: string;
}

export interface BoardEdge {
  id: string;
  from: string;
  to: string;
  /** Caminho SVG da linha e da ponta, em coordenadas do quadro (seguem o desenho do Figma). */
  path: string;
  head: string;
  style?: "solid" | "inferred" | "retry";
  label?: { text: string; x: number; y: number; font?: "hand" | "mono" };
  evidence?: { kind: Evidence; x: number; y: number };
}

export interface BoardLabel {
  id: string;
  text: string;
  x: number;
  y: number;
}

/** O que o quadro desenha: nós, setas, textos soltos e o que já aparece apagado. */
export interface WhiteboardSpec {
  nodes: BoardNode[];
  edges: BoardEdge[];
  labels: BoardLabel[];
  /** Nós mostrados apagados desde o começo ("ainda não explicado"). */
  upcoming: string[];
}
