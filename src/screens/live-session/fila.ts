// Ordem do que o Slack envia, sem DOM (testável): encaminhamentos à buddy e pedidos de aprovação ao gestor.
import type { Forwarding, Outbox } from "../../journey/forwarding";
import type { PedidoDeAprovacao, Pedidos } from "../../journey/primeira-tarefa";

export interface FilaDoSlack {
  outbox: Outbox;
  pedidos: Pedidos;
  tab: string;
  esperar: (ms: number) => Promise<void>;
  encaminhar: (f: Forwarding) => Promise<void>;
  pedir: (p: PedidoDeAprovacao) => Promise<void>;
  restaurar: () => void;
}

/**
 * Envia tudo o que está pendente, um item de cada vez: encaminhamentos primeiro (a dúvida da pessoa espera), depois
 * pedidos de aprovação. Volta a olhar as duas filas depois de cada item, porque a sessão pode criar um encaminhamento
 * enquanto a Puca ainda digita o pedido. Um encaminhamento abre a DM da buddy por cima da do gestor: no fim, `restaurar`
 * traz de volta o pedido que ainda espera aprovação, com o botão.
 */
export async function drenar(o: FilaDoSlack): Promise<void> {
  let encaminhou = false;
  for (;;) {
    const f = o.outbox.pending(o.tab)[0];
    if (f) {
      o.outbox.claim(f.id, o.tab);
      // a outra aba pode ter pegado no mesmo instante: espera as duas escreverem e fica quem ganhou
      await o.esperar(150);
      if (o.outbox.ownerOf(f.id) !== o.tab) continue;
      await o.encaminhar(f);
      encaminhou = true;
      continue;
    }
    const p = o.pedidos.pending(o.tab)[0];
    if (!p) break;
    o.pedidos.claim(p.id, o.tab);
    await o.esperar(150);
    if (o.pedidos.ownerOf(p.id) !== o.tab) continue;
    await o.pedir(p);
  }
  if (encaminhou) o.restaurar();
}
