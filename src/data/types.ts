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
