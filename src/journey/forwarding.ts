// Encaminhamento (PRODUCT.md §4.5 e §12.1, passo 4): quando Puca não tem fonte confiável, a dúvida vai
// para a buddy com o contexto pronto (o que a pessoa perguntou, o que Puca já consultou e por que não
// respondeu). A sessão cria; a tela do Slack (screens/live-session) envia. Formato em docs/contratos.md.
import { pendentes, proximaTentativa } from "./claim-queue";
import { normalize } from "./conditions";
import { readList, writeJson, type KeyValueStore } from "./storage";
import type { Journey } from "./types";
import { uid } from "./uid";

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
  /** Fontes que Puca consultou antes de desistir. */
  consulted: string[];
  /** Por que Puca não respondeu. */
  reason: string;
  moment: string | null;
  status: ForwardingStatus;
  /** Aba do Slack que ficou com o envio (duas abas abertas não mandam duas vezes). */
  claimed_by?: string;
  /** Quando a aba pegou o envio (ISO). Passados 30 s sem enviar, outra aba pode pegar. */
  claimed_at?: string;
  /** Link da mensagem no Slack da Kota, quando o servidor enviou de verdade (#129). */
  slack_link?: string;
}

export const FORWARDING_KEY = "puca:encaminhamentos";
const SAME_QUESTION_MS = 2 * 60_000;

// O que a sessão, o Slack e o rastro leem sem conferir: o resto pode faltar.
const isForwarding = (x: unknown): x is Forwarding => {
  const f = x as Forwarding;
  return typeof f?.id === "string" && typeof f.question === "string" && typeof f.to?.name === "string";
};

export function createOutbox(store: KeyValueStore, opts: { now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date());
  // encaminhamento de antes do `consulted` continua valendo, com a lista vazia
  const read = (): Forwarding[] =>
    readList(store, FORWARDING_KEY, isForwarding).map((f) => (Array.isArray(f.consulted) ? f : { ...f, consulted: [] }));
  const write = (list: Forwarding[]) => writeJson(store, FORWARDING_KEY, list);

  return {
    /** A mesma pergunta (normalizada) em menos de 2 minutos devolve o encaminhamento que já existe. */
    add(f: Omit<Forwarding, "id" | "at" | "status">): Forwarding {
      const list = read();
      const t = now().getTime();
      const q = normalize(f.question);
      const same = list.find((x) => normalize(x.question) === q && t - Date.parse(x.at) < SAME_QUESTION_MS);
      if (same) return same;
      const created: Forwarding = { ...f, id: uid(), at: new Date(t).toISOString(), status: "pendente" };
      write([...list, created]);
      return created;
    },
    list: read,
    /** Para enviar: os pendentes e, para outra aba, os presos em "enviando" há mais de 30 s (aba fechada no meio). */
    pending(tab?: string): Forwarding[] {
      return pendentes(read(), now().getTime(), tab);
    },
    /**
     * Quanto falta (ms) para um envio preso em "enviando" por outra aba poder ser pego por esta; null se não há.
     * A tela agenda uma nova tentativa com isso: sem timer, o envio só voltaria com outro evento (#84).
     */
    nextRetryIn(tab: string): number | null {
      return proximaTentativa(read(), now().getTime(), tab);
    },
    setStatus(id: string, status: ForwardingStatus): void {
      write(read().map((f) => (f.id === id ? { ...f, status } : f)));
    },
    /** A aba pega o envio: tira dos pendentes e marca a dona. Vale a última que escreveu. */
    claim(id: string, tab: string): void {
      write(read().map((f) => (f.id === id ? { ...f, status: "enviando" as const, claimed_by: tab, claimed_at: now().toISOString() } : f)));
    },
    /** O servidor enviou no Slack da Kota (#129): fica "enviado", com o link, e o Slack simulado não envia de novo. */
    marcarNoSlack(id: string, link: string): void {
      write(read().map((f) => (f.id === id ? { ...f, status: "enviado" as const, slack_link: link } : f)));
    },
    ownerOf(id: string): string | undefined {
      return read().find((f) => f.id === id)?.claimed_by;
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

/** Texto da mensagem que Puca manda para a buddy no Slack. Não supõe o gênero de ninguém. */
export function forwardingMessage(f: Forwarding): string {
  // sem nome, profile.nome vira "você" (journey/profile.ts)
  const nome = f.pessoa.trim();
  const asked = nome && nome.toLowerCase() !== "você" ? `Pergunta de ${nome} na sessão` : "A pessoa que estou acompanhando perguntou na sessão";
  const consulted = f.consulted.length ? f.consulted.join("; ") : "Não achei nenhuma fonte sobre isso.";
  const summary = f.summary.trim() && normalize(f.summary) !== normalize(f.question) ? [`Resumo: ${f.summary.trim()}`] : [];
  return [
    `Oi, ${f.to.name}! ${asked}: "${f.question}"`,
    ...summary,
    `O que eu já consultei: ${consulted}`,
    `Por que não respondi: ${f.reason}`,
    "Pode ajudar? Volto para a pessoa assim que você me disser.",
  ].join("\n");
}

/** Fala com cara de dúvida (tem "?" ou 3+ palavras). "ok" e "valeu" não viram encaminhamento. */
export function looksLikeQuestion(text: string): boolean {
  return text.includes("?") || normalize(text).split(" ").filter(Boolean).length >= 3;
}
