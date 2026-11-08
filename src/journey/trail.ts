// Rastro das decisões da Puca (PRODUCT.md §12.2): cada fala da pessoa, o caminho que a Puca escolheu
// (journey/route.ts), o que respondeu e de qual fonte. Fica no navegador; a tela de demo `rastro/`
// mostra e baixa em JSON. Formato em docs/contratos.md.
import type { Route } from "./route";
import { readList, writeJson, type KeyValueStore } from "./storage";
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
  /** Tempo da resposta do agente, em ms (route "ask"), medido no navegador. */
  ms?: number;
  /** Custo (#52), copiado do `timing` do servidor: tempo total do pedido e tokens do LLM. */
  llm_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
  tokens_estimated?: boolean;
}

/** Início e fim de uma sessão (o `session` das entradas). */
export interface TrailSession {
  session: string;
  started_at: string;
  ended_at: string | null;
}

/** Custo de uma sessão, para auditar a demo (#52). Não aparece em tela: vai no JSON baixado. */
export interface SessionSummary {
  session: string;
  started_at: string;
  ended_at: string | null;
  duration_ms: number;
  utterances: number;
  /** Perguntas ao agente que chegaram ao servidor (sem servidor, a fala não conta). */
  llm_calls: number;
  /** Perguntas que chegaram ao servidor, mas cujo timing não chegou ao navegador (a pessoa interrompeu); o log do servidor tem o número. */
  llm_calls_unmeasured: number;
  llm_ms: number;
  tokens_in: number;
  tokens_out: number;
  /** Algum token da sessão foi estimado, porque o provedor não informou. */
  tokens_estimated: boolean;
}

export const TRAIL_KEY = "puca:rastro";
export const SESSIONS_KEY = "puca:sessoes";
const MAX_ENTRIES = 500;

// O que a sessão e a tela de rastro leem sem conferir: o resto pode faltar.
const isTrailEntry = (x: unknown): x is TrailEntry => typeof (x as TrailEntry)?.id === "string" && Array.isArray((x as TrailEntry).sources);
const isTrailSession = (x: unknown): x is TrailSession => typeof (x as TrailSession)?.session === "string";

export function createTrail(store: KeyValueStore, opts: { now?: () => Date; session?: string } = {}) {
  const now = opts.now ?? (() => new Date());
  const session = opts.session ?? uid();
  const read = (): TrailEntry[] => readList(store, TRAIL_KEY, isTrailEntry);
  const write = (list: TrailEntry[]) => writeJson(store, TRAIL_KEY, list.slice(-MAX_ENTRIES));
  const readSessions = (): TrailSession[] => readList(store, SESSIONS_KEY, isTrailSession);
  const writeSessions = (list: TrailSession[]) => writeJson(store, SESSIONS_KEY, list);

  return {
    /** Id desta sessão: o mesmo enquanto a página não recarrega (recomeçar mantém). */
    session,
    record(e: Omit<TrailEntry, "id" | "at" | "session">): TrailEntry {
      const entry: TrailEntry = { ...e, id: uid(), at: now().toISOString(), session };
      write([...read(), entry]);
      return entry;
    },
    update(id: string, patch: Partial<Pick<TrailEntry, "answer" | "forwarding_id" | "ms" | "llm_ms" | "tokens_in" | "tokens_out" | "tokens_estimated">>): void {
      write(read().map((e) => (e.id === id ? { ...e, ...patch } : e)));
    },
    list: read,
    sessions: readSessions,
    /** A sessão começou. Recomeçar na mesma página mantém o início e reabre a sessão (apaga o fim). */
    startSession(): void {
      const list = readSessions();
      if (list.some((s) => s.session === session)) {
        writeSessions(list.map((s) => (s.session === session ? { ...s, ended_at: null } : s)));
        return;
      }
      writeSessions([...list, { session, started_at: now().toISOString(), ended_at: null }]);
    },
    /** A call foi encerrada ou a sessão terminou. */
    endSession(): void {
      writeSessions(readSessions().map((s) => (s.session === session ? { ...s, ended_at: now().toISOString() } : s)));
    },
    clear(): void {
      write([]);
      writeSessions([]);
    },
    /** O que a tela de rastro baixa: o custo de cada sessão e as falas (docs/contratos.md, "Custo da sessão"). */
    exportJson(): string {
      const entries = read();
      return JSON.stringify({ sessions: summarizeSessions(entries, readSessions()), entries }, null, 2);
    },
  };
}

export type Trail = ReturnType<typeof createTrail>;

/**
 * Custo de cada sessão, a partir das falas e dos registros de início e fim. Sessão sem registro (rastro gravado
 * antes do #52) começa na primeira fala. Sem fim, a duração vai até a última fala.
 */
export function summarizeSessions(entries: TrailEntry[], sessions: TrailSession[]): SessionSummary[] {
  const ids = [...new Set([...sessions.map((s) => s.session), ...entries.map((e) => e.session)])];
  return ids
    .map((id) => {
      const mine = entries.filter((e) => e.session === id);
      const rec = sessions.find((s) => s.session === id);
      const started_at = rec?.started_at ?? mine[0]?.at ?? "";
      const ended_at = rec?.ended_at ?? null;
      const end = ended_at ?? mine.at(-1)?.at ?? started_at;
      // só conta a pergunta que chegou ao servidor: com ms (o navegador recebeu resposta) ou com o timing
      const asks = mine.filter((e) => e.route === "ask" && (e.ms !== undefined || e.llm_ms !== undefined));
      const sum = (f: (e: TrailEntry) => number | undefined) => asks.reduce((n, e) => n + (f(e) ?? 0), 0);
      return {
        session: id,
        started_at,
        ended_at,
        duration_ms: Math.max(0, Date.parse(end) - Date.parse(started_at)) || 0,
        utterances: mine.length,
        llm_calls: asks.length,
        llm_calls_unmeasured: asks.filter((e) => e.llm_ms === undefined).length,
        llm_ms: sum((e) => e.llm_ms),
        tokens_in: sum((e) => e.tokens_in),
        tokens_out: sum((e) => e.tokens_out),
        tokens_estimated: asks.some((e) => e.tokens_estimated === true),
      };
    })
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
}

/**
 * Fontes que sustentam a resposta de um caminho (vazio quando a resposta não veio de fonte).
 * Só entra o que diz o que a Puca respondeu, para o jurado achar no kit (PRODUCT.md §13.2):
 * "o que é" vem das docs do nó, "por que existe" vem do ADR, e "quem cuida" fica sem fonte,
 * porque as docs do nó não dizem quem cuida.
 */
export function sourcesFor(route: Route, journey: Journey, moment: Moment | null): string[] {
  if (route.kind === "knowledge") return [`Conhecimento da sessão: ${moment?.title ?? journey.title}`];
  if (route.kind === "tarefa") return route.resposta.kind === "resposta" ? route.resposta.fontes : [];
  if (route.kind !== "faq") return [];
  const info = journey.boards[route.faq.board]?.nodes.find((n) => n.id === route.faq.node)?.info;
  if (route.faq.intent === "why") return info?.adr ? [info.adr.id] : [];
  if (route.faq.intent === "what") return [...new Set((info?.docs ?? []).map((d) => d.title))];
  return [];
}
