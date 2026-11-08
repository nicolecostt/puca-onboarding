import { describe, expect, it } from "vitest";
import demo from "../data/tail.journey.json";
import { createPedidos, pedidoMessage, PEDIDOS_KEY, tarefaDoNo, tarefaDoPasso, type PedidoDeAprovacao } from "../primeira-tarefa";
import { memoryStore } from "../storage";
import type { BoardNode } from "../types";
import { loadJourney } from "../validate";

const journey = loadJourney(demo);
const nodes = Object.values(journey.boards).flatMap((b) => b.nodes);
const node = (id: string) => nodes.find((n) => n.id === id)!;
const step = (id: string) => journey.moments.flatMap((m) => m.steps).find((s) => s.id === id)!;

const draft = (pessoa = "Bruno", no = "task-dlq"): Omit<PedidoDeAprovacao, "id" | "at" | "status"> => ({
  pessoa,
  gestor: "Marcos Vidal",
  tarefa: tarefaDoNo(node(no))!,
  moment: "primeira-tarefa",
});

/** Relógio que a gente avança à mão. */
function clock(start = Date.parse("2026-11-08T14:00:00Z")) {
  let t = start;
  return { now: () => new Date(t), advance: (ms: number) => void (t += ms) };
}

describe("tarefa do catálogo", () => {
  it("tarefaDoNo lê os cinco campos do nó task", () => {
    const t = tarefaDoNo(node("task"))!;
    expect(t.no).toBe("task");
    expect(t.titulo).toBe("Validar a versão mínima de firmware antes de publicar uma configuração.");
    expect(t.problema.startsWith("hoje dá para mandar")).toBe(true);
    expect(t.porque).toBe("o lojista fica com a maquininha desatualizada sem saber");
    expect(t.sistemas).toBe("só o terminal-config-api (validação e testes)");
    expect(t.onde_ler).toBe("README do terminal-config-api");
    expect(t.quem_ajuda).toBe("Lucas Melo e Paula Nunes");

    const semAjuda: BoardNode = { ...node("task"), info: { ...node("task").info!, bullets: node("task").info!.bullets!.slice(0, 4) } };
    expect(tarefaDoNo(semAjuda)).toBeNull();
    expect(tarefaDoNo(node("config-api"))).toBeNull(); // não é nó task
  });

  it("todo nó task da jornada de demo vira TarefaDoTime", () => {
    const tasks = nodes.filter((n) => n.kind === "task");
    expect(tasks.map((n) => n.id).sort()).toEqual(["task", "task-dlq"]);
    for (const n of tasks) expect(tarefaDoNo(n), n.id).not.toBeNull();
  });

  it("tarefaDoPasso acha a tarefa pelo cartão aberto", () => {
    expect(tarefaDoPasso(journey, step("pt-tarefa-novo"))?.no).toBe("task");
    expect(tarefaDoPasso(journey, step("pt-tarefa-transicao"))?.no).toBe("task-dlq");
    expect(tarefaDoPasso(journey, step("pt-escopo"))).toBeNull();
    expect(tarefaDoPasso(journey, step("pt-tarefa"))).toBeNull();
  });
});

describe("createPedidos", () => {
  it("pedido novo fica pendente e vai para a chave do contrato", () => {
    const store = memoryStore();
    const pedidos = createPedidos(store);
    const p = pedidos.add(draft());
    expect(p.status).toBe("pendente");
    expect(pedidos.pending().map((x) => x.id)).toEqual([p.id]);
    expect(JSON.parse(store.getItem(PEDIDOS_KEY)!)).toHaveLength(1);
  });

  it("add devolve o pedido existente da mesma pessoa e tarefa", () => {
    const pedidos = createPedidos(memoryStore());
    const a = pedidos.add(draft());
    pedidos.aprovar(a.id, "Marcos Vidal");
    const b = pedidos.add(draft());
    expect(b.id).toBe(a.id);
    expect(b.status).toBe("aprovada");
    expect(pedidos.list()).toHaveLength(1);
    expect(pedidos.add(draft("Ana", "task")).id).not.toBe(a.id); // outra pessoa e outra tarefa: pedido novo
    expect(pedidos.list()).toHaveLength(2);
  });

  it("pending e nextRetryIn seguem a regra de 30 s", () => {
    const c = clock();
    const pedidos = createPedidos(memoryStore(), { now: c.now });
    expect(pedidos.nextRetryIn("aba-nova")).toBeNull();
    const p = pedidos.add(draft());
    pedidos.claim(p.id, "aba-que-fechou");
    expect(pedidos.ownerOf(p.id)).toBe("aba-que-fechou");
    expect(pedidos.pending("aba-nova")).toEqual([]);
    c.advance(10_000);
    expect(pedidos.nextRetryIn("aba-nova")).toBe(20_000);
    expect(pedidos.nextRetryIn("aba-que-fechou")).toBeNull();
    c.advance(21_000);
    expect(pedidos.pending("aba-nova").map((x) => x.id)).toEqual([p.id]);
    expect(pedidos.pending("aba-que-fechou")).toEqual([]);
    pedidos.setStatus(p.id, "aguardando");
    expect(pedidos.pending("aba-nova")).toEqual([]);
    expect(pedidos.nextRetryIn("aba-nova")).toBeNull();
  });

  it("aprovar é idempotente", () => {
    const c = clock();
    const pedidos = createPedidos(memoryStore(), { now: c.now });
    const p = pedidos.add(draft());
    pedidos.setStatus(p.id, "aguardando");
    expect(pedidos.aprovar(p.id, "Marcos Vidal")).toBe(true);
    const aprovado = pedidos.list()[0];
    expect(aprovado).toMatchObject({ status: "aprovada", aprovada_por: "Marcos Vidal", aprovada_em: "2026-11-08T14:00:00.000Z" });
    c.advance(5_000);
    expect(pedidos.aprovar(p.id, "Marcos Vidal")).toBe(false);
    expect(pedidos.list()[0].aprovada_em).toBe("2026-11-08T14:00:00.000Z");
    expect(pedidos.aprovar("nao-existe", "Marcos Vidal")).toBe(false);
  });

  it("lista corrompida no localStorage vira lista vazia", () => {
    const store = memoryStore();
    store.setItem(PEDIDOS_KEY, '{"nao":"lista"}');
    expect(createPedidos(store).list()).toEqual([]);
  });
});

describe("pedidoMessage", () => {
  it("não supõe gênero e traz o essencial", () => {
    const pedidos = createPedidos(memoryStore());
    const text = pedidoMessage(pedidos.add(draft()));
    expect(text).toContain("Oi, Marcos Vidal!");
    expect(text).toContain("Pedido de aprovação da primeira tarefa de Bruno");
    expect(text).toContain("Fazer a publicação de configuração tentar de novo");
    expect(text).toContain("Problema: se o config-topic fica fora do ar");
    expect(text).toContain("Sistemas: terminal-config-api e config-topic");
    expect(text).toContain("Quem ajuda: Lucas Melo e Paula Nunes");
    expect(text).toContain("Posso passar para a pessoa?");
    expect(text).not.toMatch(/\b(ele|ela|o Bruno|a Bruno)\b/);
  });

  it("sem nome, fala da pessoa que a Puca acompanha", () => {
    const pedidos = createPedidos(memoryStore());
    for (const pessoa of ["", "você"]) {
      expect(pedidoMessage(pedidos.add(draft(pessoa)))).toContain("da pessoa que estou acompanhando");
    }
  });
});
