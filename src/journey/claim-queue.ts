// Fila de envio entre abas: a sessão deixa itens "pendente" no localStorage e uma aba do Slack os pega ("enviando").
// Duas abas não mandam o mesmo item, e um item preso por uma aba que fechou volta a valer para outra depois de 30 s.
// Usada pelo encaminhamento (forwarding.ts) e pelo pedido de aprovação da primeira tarefa (primeira-tarefa.ts).

/** Passados 30 s sem enviar, outra aba pode pegar o item. */
export const STALE_CLAIM_MS = 30_000;

export interface Reivindicavel {
  status: string;
  /** ISO 8601: quando o item foi criado. */
  at: string;
  /** Aba do Slack que ficou com o envio. */
  claimed_by?: string;
  /** Quando a aba pegou o envio (ISO). */
  claimed_at?: string;
}

const presoHa = (item: Reivindicavel, agora: number) => agora - Date.parse(item.claimed_at ?? item.at);

/** Para enviar: os pendentes e, para outra aba, os presos em "enviando" há mais de 30 s (aba fechada no meio). */
export function pendentes<T extends Reivindicavel>(list: T[], agora: number, tab?: string): T[] {
  return list.filter(
    (x) => x.status === "pendente" || (tab !== undefined && x.status === "enviando" && x.claimed_by !== tab && presoHa(x, agora) > STALE_CLAIM_MS),
  );
}

/** Quanto falta (ms) para um item preso em "enviando" por outra aba poder ser pego por esta; null se não há. */
export function proximaTentativa<T extends Reivindicavel>(list: T[], agora: number, tab: string): number | null {
  const waits = list.filter((x) => x.status === "enviando" && x.claimed_by !== tab).map((x) => Math.max(0, STALE_CLAIM_MS - presoHa(x, agora)));
  return waits.length ? Math.min(...waits) : null;
}
