// Contrato do envio do encaminhamento no Slack da Kota (docs/contratos.md, "Encaminhamento no Slack da Kota", #129).
// Só tipos e validação, sem nada do navegador: o servidor importa este arquivo.

export type DestinoDoEncaminhamento = "buddy" | "gestor" | "rh";

export interface PedidoDeEncaminhamento {
  /** O id do Forwarding: o mesmo id duas vezes não posta duas vezes. */
  id: string;
  destino: DestinoDoEncaminhamento;
  /** Quem receberia na Kota (ex.: "Paula Nunes"). */
  para: string;
  pergunta: string;
  resumo: string;
  /** Títulos das fontes que o Puca consultou, como em Forwarding.consulted. */
  fontes_consultadas: string[];
  /** Por que o Puca não respondeu. */
  motivo: string;
  /** E-mail do jurado no Slack da Kota; sem ele, nada é postado. */
  email?: string;
}

export type ResultadoDoEncaminhamento =
  | { enviado: true; canal: string; ts: string; link: string }
  | { enviado: false; motivo: "sem_slack" };

const DESTINOS: readonly string[] = ["buddy", "gestor", "rh"];
const texto = (x: unknown, max: number) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null);

/** Corpo do POST → pedido válido, ou null. Corta textos longos em vez de recusar. */
export function lerPedidoDeEncaminhamento(body: unknown): PedidoDeEncaminhamento | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const id = texto(b.id, 100);
  const para = texto(b.para, 100);
  const pergunta = texto(b.pergunta, 1000);
  const motivo = texto(b.motivo, 500);
  if (!id || !para || !pergunta || !motivo || !DESTINOS.includes(String(b.destino))) return null;
  const fontes = Array.isArray(b.fontes_consultadas) ? b.fontes_consultadas : [];
  const email = texto(b.email, 200);
  return {
    id,
    destino: b.destino as DestinoDoEncaminhamento,
    para,
    pergunta,
    resumo: texto(b.resumo, 1000) ?? pergunta,
    fontes_consultadas: fontes.map((f) => texto(f, 200)).filter((f): f is string => !!f).slice(0, 20),
    motivo,
    ...(email ? { email } : {}),
  };
}
