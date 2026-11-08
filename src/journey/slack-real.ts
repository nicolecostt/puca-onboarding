// Encaminhamento no Slack da Kota pelo servidor (#129, docs/contratos.md "Encaminhamento no Slack da Kota").
// O servidor manda uma mensagem direta ao próprio jurado, achado pelo e-mail do Slack que ele informa no início.
// Sem e-mail, sem servidor ou com erro, o encaminhamento volta para a fila e o Slack simulado (live-session) envia.
import { apiUrl } from "../voice/api";
import type { PedidoDeEncaminhamento, ResultadoDoEncaminhamento } from "./encaminhamento-slack";
import type { Forwarding, Outbox } from "./forwarding";
import type { KeyValueStore } from "./storage";

export const SLACK_EMAIL_KEY = "puca:slack-email";
/** Dono do envio enquanto o servidor responde: a aba do Slack simulado não pega (claim-queue.ts). */
const SLACK_REAL = "slack-real";

const emailValido = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** E-mail do jurado no Slack da Kota, ou null. */
export function lerEmailDoSlack(store: KeyValueStore): string | null {
  try {
    const v = (store.getItem(SLACK_EMAIL_KEY) ?? "").trim().toLowerCase();
    return emailValido(v) ? v : null;
  } catch {
    return null;
  }
}

/** Guarda o e-mail (aparado e minúsculo); vazio ou inválido apaga. */
export function salvarEmailDoSlack(store: KeyValueStore, email: string): void {
  const v = email.trim().toLowerCase();
  try {
    store.setItem(SLACK_EMAIL_KEY, emailValido(v) ? v : "");
  } catch {
    /* navegador sem espaço: segue sem e-mail */
  }
}

function pedidoDe(f: Forwarding, email: string): PedidoDeEncaminhamento {
  return {
    id: f.id,
    destino: f.to.role,
    para: f.to.name,
    pergunta: f.question,
    resumo: f.summary,
    fontes_consultadas: f.consulted,
    motivo: f.reason,
    email,
  };
}

/** Pede ao servidor o envio no Slack da Kota. Devolve o link da mensagem, ou null (o simulado envia). Não lança. */
export async function enviarNoSlackReal(
  f: Forwarding,
  deps: { outbox: Outbox; email: string | null; fetchFn?: typeof fetch },
): Promise<string | null> {
  // já saiu (a mesma pergunta em menos de 2 min devolve o encaminhamento que existe): não reenvia nem volta à fila
  if (f.status !== "pendente") return f.slack_link ?? null;
  if (!deps.email) return null;
  const fetchFn = deps.fetchFn ?? fetch;
  deps.outbox.claim(f.id, SLACK_REAL);
  try {
    const r = await fetchFn(apiUrl("/api/encaminhamentos"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pedidoDe(f, deps.email)),
    });
    const res = r.ok ? ((await r.json()) as ResultadoDoEncaminhamento) : null;
    if (res?.enviado) {
      deps.outbox.marcarNoSlack(f.id, res.link);
      return res.link;
    }
  } catch {
    /* servidor fora do ar: o simulado envia */
  }
  deps.outbox.setStatus(f.id, "pendente");
  return null;
}
