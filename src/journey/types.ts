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

// ---------- Calibragem (call inicial → jornada e adaptação) ----------

/** Assuntos da calibragem: lista fechada, ligada aos momentos da jornada (CALIBRAGEM_TEMAS em calibragem.ts). */
export type Tema = "empresa" | "rituais" | "pagamentos" | "mensageria" | "falhas";

/** O que a pessoa já sabe do assunto. Não é nota: só o ponto de partida. */
export type Nivel = "nao_conhece" | "ja_ouviu" | "usa" | "domina";

/** alta = a pessoa disse com clareza; media = deduzido do que ela contou; baixa = palpite, confirmar na sessão. */
export type Certeza = "alta" | "media" | "baixa";

export interface ItemCalibragem {
  tema: Tema;
  nivel: Nivel;
  certeza: Certeza;
  /** A frase da pessoa que levou a essa conclusão (vazia quando foi deduzido). */
  evidencia: string;
  /** call = respondeu na call · vinculo = deduzido de ser novo ou de transição · sessao = atualizado na checagem. */
  origem: "call" | "vinculo" | "sessao";
}

/** O que a Puca concluiu na call inicial (CONTEXT.md: calibragem). Contrato em docs/contratos.md. */
export interface Calibragem {
  versao: 1;
  perfil: Profile;
  /** O que a pessoa fazia antes, nas palavras dela. */
  experiencia?: string;
  /** O que a pessoa quer conseguir fazer nas primeiras semanas. */
  objetivos: string[];
  /** Um item por tema, sempre os cinco. */
  conhecimentos: ItemCalibragem[];
  /** Só na transição: time de onde vem, o que aproveita e o que já sabe que vai ser novo. */
  time_anterior?: string;
  aproveita?: string;
  diferencas?: string;
  /** ISO 8601. */
  atualizada_em: string;
}

// ---------- Jornada da pessoa (calibragem → jornada marcada) ----------

/**
 * Como a jornada trata cada momento para esta pessoa. Nenhum momento sai da jornada: o estado só marca.
 * aprender = assunto novo · revisar = já usa, passa mais rápido · ja_conhece = domina (certeza alta) ·
 * fora = a jornada desvia dele (parte institucional para quem está em transição).
 */
export type EstadoMomento = "aprender" | "revisar" | "ja_conhece" | "fora";

export interface MomentoDaPessoa {
  /** Id do momento na jornada. */
  id: string;
  titulo: string;
  /** O goal do momento: serve para a Puca e para o painel do buddy, não é mostrado à pessoa. */
  objetivo: string;
  estado: EstadoMomento;
  /** Por que esse estado, em uma frase curta para a pessoa (vazio quando não há o que dizer). */
  motivo: string;
  /** Temas da calibragem que o momento cobre (vazio nos momentos sem tema, como a checagem). */
  temas: Tema[];
}

/** A jornada como a pessoa vê: os objetivos dela e cada momento marcado pela calibragem. Contrato em docs/contratos.md. */
export interface JornadaDaPessoa {
  versao: 1;
  /** Os objetivos que a pessoa contou na call inicial. */
  objetivos: string[];
  /** Todos os momentos da jornada, na ordem. */
  momentos: MomentoDaPessoa[];
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
  /** Rótulo (pode ter quebra de linha com \n). */
  label: string;
  kind: NodeKind;
  /** Centro do nó no quadro, que tem 1440 × 844 (o tamanho do Figma). */
  x: number;
  y: number;
  /** Texto menor embaixo do rótulo (ex.: @dono). */
  sublabel?: string;
  /** Largura no quadro (sem ela, sai do tamanho do rótulo). */
  w?: number;
  /** Visual especial: caixa preta (sem documentação confirmada) ou fila de mensagens com erro. */
  look?: "blackbox" | "dlq";
  /** Selo embaixo do nó (ex.: "caixa preta · aguardando Carla"). */
  note?: string;
  info?: NodeInfo;
}

export interface BoardEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** inferred = ligação deduzida, sem confirmação (tracejada) · retry = caminho de erro/retentativa. */
  style?: "inferred" | "retry";
  /** Desenho exato da seta (caminho SVG da linha e da ponta), em coordenadas do quadro. Sem ele, é calculado. */
  path?: string;
  head?: string;
  /** Onde fica o rótulo (canto de cima à esquerda) e a letra (à mão ou de código). */
  label_at?: { x: number; y: number };
  label_font?: "hand" | "mono";
  /** Selo de confiança: provado (confirmado) ou inferido (deduzido, sem confirmação do dono). */
  evidence?: { kind: "proven" | "inferred"; x: number; y: number };
}

export interface BoardSpec {
  title?: string;
  nodes: BoardNode[];
  edges: BoardEdge[];
  /** Nós e setas que já aparecem apagados desde o começo ("ainda não explicado"). */
  upcoming?: string[];
  /** Textos soltos no quadro (canto de cima à esquerda). */
  labels?: { id: string; text: string; x: number; y: number }[];
}

export type HighlightTone = "focus" | "warn" | "ok";

export type BoardAction = (
  | { type: "reveal"; targets: string[] }
  | { type: "highlight"; targets: string[]; tone?: HighlightTone }
  | { type: "clear_highlight" }
  | { type: "focus"; target: string | null }
  | { type: "flow"; path: string[] }
  | { type: "card"; target: string }
  | { type: "close_card" }
  | { type: "reset" }
) & {
  /** Trecho da fala do passo: a ação acontece quando a Puca chega nele. Sem `at`, acontece antes da fala. */
  at?: string;
};

/** Ação marcada para um ponto da fala: `at` é a posição (em caracteres) no texto já com o perfil preenchido. */
export interface SpeechCue {
  at: number;
  action: BoardAction;
}

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
  /** Pedaço da fala destacado em amarelo na legenda. */
  highlight?: string;
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
