import { describe, expect, it } from "vitest";
import demo from "../../journey/data/kota.journey.json";
import { createOutbox, type Forwarding } from "../../journey/forwarding";
import { createPedidos, tarefaDoNo } from "../../journey/primeira-tarefa";
import { memoryStore } from "../../journey/storage";
import { loadJourney } from "../../journey/validate";
import { drenar } from "./fila";

const journey = loadJourney(demo);
const task403 = Object.values(journey.boards).flatMap((b) => b.nodes).find((n) => n.id === "task-403")!;

const duvida = (question: string): Omit<Forwarding, "id" | "at" | "status"> => ({
  to: { name: "Beatriz Cavalcanti", role: "buddy" },
  pessoa: "Bruno",
  question,
  summary: question,
  consulted: [],
  reason: "Não achei fonte.",
  moment: "primeira-tarefa",
});

function montar() {
  const store = memoryStore();
  const outbox = createOutbox(store);
  const pedidos = createPedidos(store);
  const feitos: string[] = [];
  let restauracoes = 0;
  return {
    outbox,
    pedidos,
    feitos,
    restauracoes: () => restauracoes,
    opts: {
      outbox,
      pedidos,
      tab: "aba-1",
      esperar: async () => {},
      restaurar: () => void restauracoes++,
    },
  };
}

describe("drenar (fila do Slack)", () => {
  it("encaminhamento criado enquanto o Puca digita o pedido também sai", async () => {
    const t = montar();
    t.pedidos.add({ pessoa: "Bruno", gestor: "Natália Brandão", tarefa: tarefaDoNo(task403)!, moment: "primeira-tarefa" });
    await drenar({
      ...t.opts,
      encaminhar: async (f) => {
        t.feitos.push(`encaminhou: ${f.question}`);
        t.outbox.setStatus(f.id, "confirmado");
      },
      pedir: async (p) => {
        t.feitos.push(`pediu: ${p.tarefa.no}`);
        // a pessoa pergunta algo sem fonte enquanto o Puca ainda digita o pedido
        t.outbox.add(duvida("Quando o ledgermonolith sai do repositório?"));
        t.pedidos.setStatus(p.id, "aguardando");
      },
    });
    expect(t.feitos).toEqual(["pediu: task-403", "encaminhou: Quando o ledgermonolith sai do repositório?"]);
  });

  it("depois de um encaminhamento, a DM do gestor volta com o pedido que espera aprovação", async () => {
    const t = montar();
    t.outbox.add(duvida("Quando o ledgermonolith sai do repositório?"));
    await drenar({
      ...t.opts,
      encaminhar: async (f) => t.outbox.setStatus(f.id, "confirmado"),
      pedir: async () => {},
    });
    expect(t.restauracoes()).toBe(1);
  });

  it("sem encaminhamento, não mexe na DM do gestor", async () => {
    const t = montar();
    t.pedidos.add({ pessoa: "Bruno", gestor: "Natália Brandão", tarefa: tarefaDoNo(task403)!, moment: "primeira-tarefa" });
    await drenar({
      ...t.opts,
      encaminhar: async () => {},
      pedir: async (p) => t.pedidos.setStatus(p.id, "aguardando"),
    });
    expect(t.restauracoes()).toBe(0);
  });

  it("item que outra aba pegou no mesmo instante fica com ela", async () => {
    const t = montar();
    const f = t.outbox.add(duvida("Quando o ledgermonolith sai do repositório?"));
    const encaminhados: string[] = [];
    await drenar({
      ...t.opts,
      // enquanto esta aba espera os 150 ms, a outra escreve por cima e ganha
      esperar: async () => t.outbox.claim(f.id, "aba-2"),
      encaminhar: async (x) => void encaminhados.push(x.id),
      pedir: async () => {},
    });
    expect(encaminhados).toEqual([]);
    expect(t.outbox.ownerOf(f.id)).toBe("aba-2");
  });
});
