// Primeira tarefa (PRODUCT.md §4.4 e §12.1, passo 5): o Puca entrega uma tarefa do catálogo que o time aprovou e pede
// a aprovação do gestor. O catálogo são os nós `kind: "task"` da jornada; a sessão cria o pedido quando o cartão da
// tarefa abre, e a tela do Slack (screens/live-session) envia ao gestor e grava a aprovação. Formato em docs/contratos.md.
import { pendentes, proximaTentativa, type Reivindicavel } from "./claim-queue";
import { normalize } from "./conditions";
import { readJson, writeJson, type KeyValueStore } from "./storage";
import type { BoardNode, Journey, Profile, Step } from "./types";
import { uid } from "./uid";

/** Uma tarefa do catálogo, lida de um nó `task` da jornada. */
export interface TarefaDoTime {
  /** Id do nó na jornada. */
  no: string;
  titulo: string;
  problema: string;
  porque: string;
  sistemas: string;
  onde_ler: string;
  quem_ajuda: string;
}

export type StatusDoPedido = "pendente" | "enviando" | "aguardando" | "aprovada";

export interface PedidoDeAprovacao extends Reivindicavel {
  id: string;
  /** ISO 8601. */
  at: string;
  pessoa: string;
  /** Nome do gestor, como na DM do Slack. */
  gestor: string;
  tarefa: TarefaDoTime;
  moment: string | null;
  /** Sessão da tela que criou o pedido (id do rastro). Recomeçar na mesma página mantém a sessão; página nova, sessão nova. */
  sessao?: string;
  status: StatusDoPedido;
  aprovada_por?: string;
  /** ISO 8601. */
  aprovada_em?: string;
}

export const PEDIDOS_KEY = "puca:primeiras-tarefas";

/** Prefixo de cada bullet do nó `task` → campo da tarefa. */
const CAMPOS: [keyof Omit<TarefaDoTime, "no" | "titulo">, string][] = [
  ["problema", "Problema:"],
  ["porque", "Por que importa:"],
  ["sistemas", "Sistemas:"],
  ["onde_ler", "Onde ler:"],
  ["quem_ajuda", "Quem ajuda:"],
];

/** A tarefa de um nó `task`; null se o nó não é tarefa ou falta algum dos cinco campos. */
export function tarefaDoNo(node: BoardNode): TarefaDoTime | null {
  const info = node.info;
  if (node.kind !== "task" || !info?.role) return null;
  const bullets = info.bullets ?? [];
  const tarefa: Partial<TarefaDoTime> = { no: node.id, titulo: info.role };
  for (const [campo, prefixo] of CAMPOS) {
    const b = bullets.find((x) => x.startsWith(prefixo));
    if (!b) return null;
    tarefa[campo] = b.slice(prefixo.length).trim();
  }
  return tarefa as TarefaDoTime;
}

/**
 * A tarefa do catálogo para a pessoa: o nó `task` com `info.vinculo` igual ao dela; senão, o único nó `task` sem
 * vínculo; senão null (a jornada não tem tarefa para ela).
 */
export function tarefaDaPessoa(journey: Journey, profile: Profile): TarefaDoTime | null {
  const tasks = Object.values(journey.boards).flatMap((b) => b.nodes).filter((n) => n.kind === "task");
  const dela = tasks.find((n) => n.info?.vinculo === profile.vinculo);
  if (dela) return tarefaDoNo(dela);
  const semVinculo = tasks.filter((n) => !n.info?.vinculo);
  return semVinculo.length === 1 ? tarefaDoNo(semVinculo[0]) : null;
}

/** A tarefa cujo cartão o passo abre; null se o passo não apresenta uma tarefa. */
export function tarefaDoPasso(journey: Journey, step: Step): TarefaDoTime | null {
  const nodes = Object.values(journey.boards).flatMap((b) => b.nodes);
  for (const a of step.actions ?? []) {
    if (a.type !== "card") continue;
    const node = nodes.find((n) => n.id === a.target);
    const tarefa = node && tarefaDoNo(node);
    if (tarefa) return tarefa;
  }
  return null;
}

export function createPedidos(store: KeyValueStore, opts: { now?: () => Date } = {}) {
  const now = opts.now ?? (() => new Date());
  const read = (): PedidoDeAprovacao[] => {
    const v = readJson<unknown>(store, PEDIDOS_KEY, []);
    return Array.isArray(v) ? (v as PedidoDeAprovacao[]) : [];
  };
  const write = (list: PedidoDeAprovacao[]) => writeJson(store, PEDIDOS_KEY, list);

  return {
    /**
     * A mesma pessoa, a mesma tarefa e a mesma sessão devolvem o pedido que já existe (recomeçar ou voltar ao momento não
     * pede de novo). Sessão nova pede de novo: um ensaio aprovado no mesmo navegador não engole o passo 5 da apresentação.
     */
    add(p: Omit<PedidoDeAprovacao, "id" | "at" | "status">): PedidoDeAprovacao {
      const list = read();
      const same = list.find(
        (x) => normalize(x.pessoa) === normalize(p.pessoa) && x.tarefa?.no === p.tarefa.no && x.sessao === p.sessao,
      );
      if (same) return same;
      const created: PedidoDeAprovacao = { ...p, id: uid(), at: now().toISOString(), status: "pendente" };
      write([...list, created]);
      return created;
    },
    list: read,
    pending(tab?: string): PedidoDeAprovacao[] {
      return pendentes(read(), now().getTime(), tab);
    },
    nextRetryIn(tab: string): number | null {
      return proximaTentativa(read(), now().getTime(), tab);
    },
    setStatus(id: string, status: StatusDoPedido): void {
      write(read().map((p) => (p.id === id ? { ...p, status } : p)));
    },
    /** A aba pega o envio: tira dos pendentes e marca a dona. Vale a última que escreveu. */
    claim(id: string, tab: string): void {
      write(read().map((p) => (p.id === id ? { ...p, status: "enviando" as const, claimed_by: tab, claimed_at: now().toISOString() } : p)));
    },
    ownerOf(id: string): string | undefined {
      return read().find((p) => p.id === id)?.claimed_by;
    },
    /** O gestor aprovou. Devolve false se o pedido não existe ou já estava aprovado (outra aba, clique duplo). */
    aprovar(id: string, por: string): boolean {
      const list = read();
      const p = list.find((x) => x.id === id);
      if (!p || p.status === "aprovada") return false;
      write(list.map((x) => (x.id === id ? { ...x, status: "aprovada" as const, aprovada_por: por, aprovada_em: now().toISOString() } : x)));
      return true;
    },
  };
}

export type Pedidos = ReturnType<typeof createPedidos>;

/** Texto que o Puca manda ao gestor no Slack. Não supõe o gênero de ninguém. */
export function pedidoMessage(p: PedidoDeAprovacao): string {
  // sem nome, profile.nome vira "você" (journey/profile.ts)
  const nome = p.pessoa.trim();
  const de = nome && nome.toLowerCase() !== "você" ? `de ${nome}` : "da pessoa que estou acompanhando";
  const t = p.tarefa;
  return [
    `Oi, ${p.gestor}! Pedido de aprovação da primeira tarefa ${de}: "${t.titulo}"`,
    `Problema: ${t.problema}`,
    `Por que importa: ${t.porque}`,
    `Sistemas: ${t.sistemas}`,
    `Onde ler: ${t.onde_ler}`,
    `Quem ajuda: ${t.quem_ajuda}`,
    "A tarefa saiu do catálogo que o time aprovou. Posso passar para a pessoa?",
  ].join("\n");
}
