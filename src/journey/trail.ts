// Rastro das decisões da Puca (PRODUCT.md §12.2): cada fala da pessoa, o caminho que a Puca escolheu
// (journey/route.ts), o que respondeu e de qual fonte. Fica no navegador; a tela de demo `rastro/`
// mostra e baixa em JSON. Formato em docs/contratos.md.
import type { Route } from "./route";
import { readJson, writeJson, type KeyValueStore } from "./storage";
import { uid } from "./uid";
import type { Journey, Moment } from "./types";

export type TrailRoute = Route["kind"];

export interface TrailEntry {
  id: string;
  /** ISO 8601. */
  at: string;
  session: string;
  from: "chat" | "voz";
  utterance: string;
  route: TrailRoute;
  /** O que a Puca disse (no ask, as frases juntas; "" se foi interrompida antes de falar). */
  answer: string;
  /** Títulos das fontes usadas; [] quando não houve. */
  sources: string[];
  moment: string | null;
  step: string | null;
  /** A fala virou encaminhamento (journey/forwarding.ts). */
  forwarding_id?: string;
  /** Tempo da resposta do agente, em ms (route "ask"). */
  ms?: number;
}

export const TRAIL_KEY = "puca:rastro";
const MAX_ENTRIES = 500;

export function createTrail(store: KeyValueStore, opts: { now?: () => Date; session?: string } = {}) {
  const now = opts.now ?? (() => new Date());
  const session = opts.session ?? uid();
  const read = (): TrailEntry[] => {
    const v = readJson<unknown>(store, TRAIL_KEY, []);
    return Array.isArray(v) ? (v as TrailEntry[]) : [];
  };
  const write = (list: TrailEntry[]) => writeJson(store, TRAIL_KEY, list.slice(-MAX_ENTRIES));

  return {
    record(e: Omit<TrailEntry, "id" | "at" | "session">): TrailEntry {
      const entry: TrailEntry = { ...e, id: uid(), at: now().toISOString(), session };
      write([...read(), entry]);
      return entry;
    },
    update(id: string, patch: Partial<Pick<TrailEntry, "answer" | "forwarding_id" | "ms">>): void {
      write(read().map((e) => (e.id === id ? { ...e, ...patch } : e)));
    },
    list: read,
    clear(): void {
      write([]);
    },
    exportJson(): string {
      return JSON.stringify(read(), null, 2);
    },
  };
}

export type Trail = ReturnType<typeof createTrail>;

/** Fontes que sustentam a resposta de um caminho (vazio quando a resposta não veio de fonte). */
export function sourcesFor(route: Route, journey: Journey, moment: Moment | null): string[] {
  if (route.kind === "knowledge") return [`Conhecimento da aula: ${moment?.title ?? journey.title}`];
  if (route.kind !== "faq") return [];
  const info = journey.boards[route.faq.board]?.nodes.find((n) => n.id === route.faq.node)?.info;
  const titles = [...(info?.docs ?? []).map((d) => d.title), ...(info?.adr ? [info.adr.id] : [])];
  return [...new Set(titles)];
}
