// Tarefas que o Puca passa na call inicial e nas sessões (ferramenta assign_task, contrato "Tarefas do agente" em
// docs/contratos.md). O servidor importa só lerTarefaDoAgente; a tela de tarefas (screens/tarefas) lê o store.
// Aprendizado ativo: a pessoa sai de cada conversa com algo pequeno para fazer e marca quando fez.
import { normalize } from "./conditions";
import { readList, writeJson, type KeyValueStore } from "./storage";
import { uid } from "./uid";

/** O que o agente manda: a tarefa, sem estado. */
export interface TarefaDoAgente {
  titulo: string;
  /** Por que a tarefa importa no trabalho da pessoa. */
  porque: string;
  passos: string[];
  /** Onde fazer ou ler (repo, página do Notion, canal). */
  onde?: string;
}

export type OrigemDaTarefa = "call" | "sessao";
export type StatusDaTarefa = "a-fazer" | "feita";

export interface TarefaAtribuida extends TarefaDoAgente {
  id: string;
  /** ISO 8601. */
  at: string;
  origem: OrigemDaTarefa;
  /** Título do momento da jornada em que a tarefa foi passada. */
  momento?: string;
  /** Sessão (id do rastro). */
  sessao?: string;
  status: StatusDaTarefa;
}

export const TAREFAS_KEY = "puca:tarefas";

const texto = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");

/** Argumentos da ferramenta → tarefa, ou null sem título. Corta textos longos em vez de recusar. */
export function lerTarefaDoAgente(args: unknown): TarefaDoAgente | null {
  if (!args || typeof args !== "object") return null;
  const a = args as Record<string, unknown>;
  const titulo = texto(a.titulo, 120);
  if (!titulo) return null;
  const passos = (Array.isArray(a.passos) ? a.passos : []).map((p) => texto(p, 200)).filter(Boolean).slice(0, 5);
  const onde = texto(a.onde, 200);
  return { titulo, porque: texto(a.porque, 300), passos, ...(onde ? { onde } : {}) };
}

function valida(x: unknown): x is TarefaAtribuida {
  if (!x || typeof x !== "object") return false;
  const t = x as Partial<TarefaAtribuida>;
  return (
    typeof t.id === "string" &&
    typeof t.titulo === "string" &&
    typeof t.at === "string" &&
    Array.isArray(t.passos) &&
    (t.origem === "call" || t.origem === "sessao") &&
    (t.status === "a-fazer" || t.status === "feita")
  );
}

export function createTarefas(store: KeyValueStore, opts: { now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date());
  const read = () => readList(store, TAREFAS_KEY, valida);
  const write = (list: TarefaAtribuida[]) => writeJson(store, TAREFAS_KEY, list);

  return {
    /** O mesmo título devolve a tarefa que já existe (rever a sessão não duplica). */
    add(t: TarefaDoAgente, de: { origem: OrigemDaTarefa; momento?: string; sessao?: string }): TarefaAtribuida {
      const list = read();
      const same = list.find((x) => normalize(x.titulo) === normalize(t.titulo));
      if (same) return same;
      const created: TarefaAtribuida = { ...t, ...de, id: uid(), at: now().toISOString(), status: "a-fazer" };
      write([...list, created]);
      return created;
    },
    list: read,
    marcar(id: string, status: StatusDaTarefa): void {
      write(read().map((t) => (t.id === id ? { ...t, status } : t)));
    },
  };
}
