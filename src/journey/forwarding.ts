// Encaminhamento (PRODUCT.md §4.5 e §12.1, passo 4): quando a Puca não tem fonte confiável, a dúvida vai
// para a buddy com o contexto pronto (o que a pessoa perguntou, o que a Puca já consultou e por que não
// respondeu). A aula cria; a tela do Slack (screens/live-session) envia. Formato em docs/contratos.md.
import { normalize } from "./conditions";
import { readJson, writeJson, type KeyValueStore } from "./storage";
import type { Journey } from "./types";

export type ForwardingStatus = "pendente" | "enviando" | "enviado" | "confirmado";

export interface Forwarding {
  id: string;
  /** ISO 8601. */
  at: string;
  /** A buddy é o destino padrão (CONTEXT.md). */
  to: { name: string; role: "buddy" };
  pessoa: string;
  /** A fala da pessoa. */
  question: string;
  /** Resumo do agente, ou a própria pergunta. */
  summary: string;
  /** Fontes que a Puca consultou antes de desistir. */
  consulted: string[];
  /** Por que a Puca não respondeu. */
  reason: string;
  moment: string | null;
  status: ForwardingStatus;
}

export const FORWARDING_KEY = "puca:encaminhamentos";
const SAME_QUESTION_MS = 2 * 60_000;

export function createOutbox(store: KeyValueStore, opts: { now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date());
  const read = (): Forwarding[] => {
    const v = readJson<unknown>(store, FORWARDING_KEY, []);
    return Array.isArray(v) ? (v as Forwarding[]) : [];
  };
  const write = (list: Forwarding[]) => writeJson(store, FORWARDING_KEY, list);

  return {
    /** A mesma pergunta (normalizada) em menos de 2 minutos devolve o encaminhamento que já existe. */
    add(f: Omit<Forwarding, "id" | "at" | "status">): Forwarding {
      const list = read();
      const t = now().getTime();
      const q = normalize(f.question);
      const same = list.find((x) => normalize(x.question) === q && t - Date.parse(x.at) < SAME_QUESTION_MS);
      if (same) return same;
      const created: Forwarding = { ...f, id: crypto.randomUUID(), at: new Date(t).toISOString(), status: "pendente" };
      write([...list, created]);
      return created;
    },
    list: read,
    pending(): Forwarding[] {
      return read().filter((f) => f.status === "pendente");
    },
    setStatus(id: string, status: ForwardingStatus): void {
      write(read().map((f) => (f.id === id ? { ...f, status } : f)));
    },
  };
}

export type Outbox = ReturnType<typeof createOutbox>;

/** Nome da buddy: o rótulo do nó "buddy" da jornada. */
export function buddyOf(journey: Journey): string {
  const node = Object.values(journey.boards)
    .flatMap((b) => b.nodes)
    .find((n) => n.id === "buddy");
  return node?.label.replace(/\n/g, " ") ?? "sua buddy";
}

/** Texto da mensagem que a Puca manda para a buddy no Slack. */
export function forwardingMessage(f: Forwarding): string {
  const consulted = f.consulted.length ? f.consulted.join("; ") : "Não achei nenhuma fonte sobre isso.";
  return [
    `Oi, ${f.to.name}! A ${f.pessoa} perguntou na aula: "${f.question}"`,
    `O que eu já consultei: ${consulted}`,
    `Por que não respondi: ${f.reason}`,
    "Pode ajudar? Respondo para ela assim que você me disser.",
  ].join("\n");
}
