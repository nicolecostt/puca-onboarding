// Formato da jornada da Puca.
// Vocabulário de jornadas de agentes de demonstração por voz (momentos → passos, com objetivo,
// fala-guia, vista, conhecimento, decisão e transições), mais uma vista nova: o quadro.
// Detalhes e exemplos em docs/journey-format.md.

// ---------- Perfil da pessoa ----------

/** "novo" = recém-contratado; "transicao" = já é da empresa e está mudando de time. */
export type Vinculo = "novo" | "transicao";

export interface Profile {
  nome: string;
  cargo?: string;
  time?: string;
  gestor?: string;
  ferramentas?: string;
  aprender?: string;
  vinculo: Vinculo;
}

// ---------- Quadro ----------

export type NodeKind = "frontend" | "service" | "db" | "external" | "queue" | "person" | "team" | "value" | "doc" | "task";

export interface NodeDoc {
  title: string;
  url?: string;
}

export interface NodeAdr {
  id: string;
  title: string;
  summary: string;
  owner?: string;
}

/** Informações do cartão do nó (§4.3: função, time, dono, docs, decisão arquitetural). */
export interface NodeInfo {
  role?: string;
  team?: string;
  owner?: string;
  /** false = não há fonte confiável para o dono; o cartão manda falar com o buddy. */
  owner_confirmed?: boolean;
  docs?: NodeDoc[];
  adr?: NodeAdr;
  /** Linhas livres (ex.: detalhes da primeira tarefa). */
  bullets?: string[];
}

export interface BoardNode {
  id: string;
  label: string;
  kind: NodeKind;
  /** Centro do nó no espaço virtual do quadro (1200 × 700). */
  x: number;
  y: number;
  /** Texto menor embaixo do rótulo. */
  sublabel?: string;
  info?: NodeInfo;
}

export interface BoardEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** inferred = ligação deduzida, sem confirmação (tracejada) · retry = caminho de erro/retentativa. */
  style?: "inferred" | "retry";
}

export interface BoardSpec {
  title?: string;
  nodes: BoardNode[];
  edges: BoardEdge[];
}

export type HighlightTone = "focus" | "warn" | "ok";

export type BoardAction =
  | { type: "reveal"; targets: string[] }
  | { type: "highlight"; targets: string[]; tone?: HighlightTone }
  | { type: "clear_highlight" }
  | { type: "focus"; target: string | null }
  | { type: "flow"; path: string[] }
  | { type: "card"; target: string }
  | { type: "close_card" }
  | { type: "reset" };

// ---------- Jornada ----------

export type View = { mode: "logo" } | { mode: "board"; board: string };

/** auto = segue sozinho · wait = espera resposta · select = espera um clique num nó do quadro. */
export type Decision = "auto" | "wait" | "select";

export type Condition =
  | { profile: keyof Profile; eq: string }
  | { reply: string };

/** Para outro passo do mesmo momento, ou para o INÍCIO de outro momento (nunca o meio). */
export type TransitionTarget = { step: string } | { moment: string };

export interface Transition {
  to: TransitionTarget;
  /** Condição em linguagem natural (para um runtime com LLM, fase 2). */
  when?: string;
  /** Condição estruturada que o motor local avalia. Sem `if`, a transição sempre vale. */
  if?: Condition;
}

export interface SelectExpect {
  /** Nós que contam como resposta certa. */
  nodes: string[];
  on_correct: string;
  on_wrong: string;
  /** Quantas tentativas erradas antes de mostrar a resposta (padrão 1). */
  retries?: number;
  /** Fala depois de esgotar as tentativas (o quadro destaca a resposta). */
  on_reveal?: string;
}

export interface Step {
  id: string;
  /** O que o passo quer alcançar. O agente não fala isso. */
  goal: string;
  /** O que o agente fala. Aceita {nome}, {time}, {gestor}… do perfil. */
  line: string;
  knowledge?: string;
  actions?: BoardAction[];
  decision?: Decision;
  suggested_replies?: string[];
  expect?: SelectExpect;
  transitions?: Transition[];
}

export interface Moment {
  id: string;
  /** Rótulo curto mostrado no topo da tela. */
  title: string;
  goal: string;
  /** Sem view, o momento herda a vista do momento anterior. */
  view?: View;
  knowledge?: string;
  steps: Step[];
}

export interface Guidelines {
  core_identity: string;
  personality_and_tone: string;
  safety_and_escalation: string;
}

export interface Journey {
  version: 1;
  id: string;
  title: string;
  company: string;
  agent: { name: string; guidelines: Guidelines };
  boards: Record<string, BoardSpec>;
  moments: Moment[];
}
