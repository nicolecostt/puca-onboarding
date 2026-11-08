// Lógica da página da primeira tarefa, sem DOM: qual pedido mostrar e como dizer o estado da aprovação.
import type { PedidoDeAprovacao } from "../../journey/primeira-tarefa";

const isStr = (v: unknown): v is string => typeof v === "string";

/** Pedido com o que a página precisa; o localStorage pode ter qualquer coisa (versão antiga, editado à mão). */
function valido(v: unknown): v is PedidoDeAprovacao {
  if (!v || typeof v !== "object") return false;
  const p = v as Partial<PedidoDeAprovacao>;
  const t = p.tarefa;
  return (
    isStr(p.id) && isStr(p.at) && isStr(p.status) && isStr(p.pessoa) && isStr(p.gestor) &&
    !!t && [t.titulo, t.problema, t.porque, t.sistemas, t.onde_ler, t.quem_ajuda].every(isStr)
  );
}

/** Com id, aquele pedido; sem id, o mais recente. Nada válido: null (a página mostra o estado vazio). */
export function pedidoDaPagina(raw: unknown, id: string | null): PedidoDeAprovacao | null {
  if (!Array.isArray(raw)) return null;
  const list = raw.filter(valido);
  if (id !== null) return list.find((p) => p.id === id) ?? null;
  return list.reduce<PedidoDeAprovacao | null>((last, p) => (!last || Date.parse(p.at) > Date.parse(last.at) ? p : last), null);
}

/** Mesmo formato de hora do Slack simulado ("14h32"). */
function quando(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "numeric", minute: "2-digit" }).replace(":", "h");
  return `${dia}, ${hora}`;
}

export function statusDaPagina(p: PedidoDeAprovacao): string {
  if (p.status === "aprovada") return `Aprovada por ${p.aprovada_por ?? p.gestor}${p.aprovada_em ? ` em ${quando(p.aprovada_em)}` : ""}`;
  return `Aguardando aprovação de ${p.gestor}`;
}
