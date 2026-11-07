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

// ---- Aula no quadro ----

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
  /** id da pessoa dona (mostra @handle) ou texto livre (ex.: "cdn.mare.dev"). */
  ownerId?: string;
  caption?: string;
  /** Texto do selo embaixo do nó (ex.: "caixa preta · aguardando Carla"). */
  note?: string;
  /** Detalhes ao clicar no nó. */
  details?: { what: string; docs?: string[]; help?: string };
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

/** Um momento da aula: o que o agente fala e o que aparece no quadro. */
export interface LessonBeat {
  say: string;
  /** Pedaço de `say` que fica destacado em amarelo (o que está acontecendo agora). */
  highlight?: string;
  /** Nós, setas e rótulos que aparecem neste momento. */
  reveal?: string[];
  /** Nó em foco (anel amarelo). */
  focus?: string | null;
}

export interface LessonSection {
  title: string;
  beats: LessonBeat[];
}

export interface LessonQuestion {
  question: string;
  answer: string;
  focus?: string;
}

export interface Lesson {
  id: string;
  title: string;
  nodes: BoardNode[];
  edges: BoardEdge[];
  labels: BoardLabel[];
  /** Nós mostrados apagados desde o começo ("ainda não explicado"). */
  upcoming: string[];
  sections: LessonSection[];
  questions: LessonQuestion[];
  /** Respostas dos botões "mais fundo" / "mais simples" por trecho. */
  deeper: string[];
  simpler: string[];
}
