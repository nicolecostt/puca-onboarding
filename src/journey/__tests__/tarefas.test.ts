import { describe, expect, it } from "vitest";
import { memoryStore } from "../storage";
import { createTarefas, lerTarefaDoAgente, TAREFAS_KEY, type TarefaDoAgente } from "../tarefas";

const tarefa: TarefaDoAgente = {
  titulo: "Rodar o ledgerwriter na sua máquina",
  porque: "É o serviço que grava cada transferência.",
  passos: ["Clone o repo ledgerwriter", "Rode npm test"],
  onde: "README do ledgerwriter",
};

describe("lerTarefaDoAgente", () => {
  it("aceita a tarefa e apara os textos", () => {
    expect(lerTarefaDoAgente({ ...tarefa, titulo: "  Rodar o ledgerwriter na sua máquina  " })).toEqual(tarefa);
  });

  it("sem título não é tarefa", () => {
    expect(lerTarefaDoAgente({ ...tarefa, titulo: " " })).toBeNull();
    expect(lerTarefaDoAgente(null)).toBeNull();
    expect(lerTarefaDoAgente("tarefa")).toBeNull();
  });

  it("corta textos longos, no máximo 5 passos, descarta passo vazio e onde vazio", () => {
    const t = lerTarefaDoAgente({
      titulo: "x".repeat(300),
      porque: "y".repeat(500),
      passos: ["a", " ", 3, "b", "c", "d", "e", "f"],
      onde: "  ",
    })!;
    expect(t.titulo).toHaveLength(120);
    expect(t.porque).toHaveLength(300);
    expect(t.passos).toEqual(["a", "b", "c", "d", "e"]);
    expect(t).not.toHaveProperty("onde");
  });

  it("sem passos nem porque: listas e textos vazios, não quebra", () => {
    expect(lerTarefaDoAgente({ titulo: "Ler o README" })).toEqual({ titulo: "Ler o README", porque: "", passos: [] });
  });
});

describe("createTarefas", () => {
  const now = () => new Date("2026-11-08T14:00:00Z");

  it("tarefa nova fica a fazer, com a origem", () => {
    const t = createTarefas(memoryStore(), { now }).add(tarefa, { origem: "sessao", momento: "pagamentos", sessao: "s1" });
    expect(t).toMatchObject({ ...tarefa, origem: "sessao", momento: "pagamentos", sessao: "s1", status: "a-fazer", at: "2026-11-08T14:00:00.000Z" });
  });

  it("o mesmo título não vira duas tarefas", () => {
    const store = memoryStore();
    const a = createTarefas(store, { now }).add(tarefa, { origem: "call" });
    const b = createTarefas(store, { now }).add({ ...tarefa, titulo: "  rodar o LEDGERWRITER na sua máquina " }, { origem: "sessao" });
    expect(b.id).toBe(a.id);
    expect(createTarefas(store).list()).toHaveLength(1);
  });

  it("marcar como feita e voltar para a fazer", () => {
    const store = memoryStore();
    const t = createTarefas(store, { now }).add(tarefa, { origem: "call" });
    createTarefas(store).marcar(t.id, "feita");
    expect(createTarefas(store).list()[0].status).toBe("feita");
    createTarefas(store).marcar(t.id, "a-fazer");
    expect(createTarefas(store).list()[0].status).toBe("a-fazer");
  });

  it("JSON corrompido vira lista vazia e item malformado é descartado", () => {
    const store = memoryStore();
    store.setItem(TAREFAS_KEY, "{lixo");
    expect(createTarefas(store).list()).toEqual([]);
    const ok = { ...tarefa, id: "ok", at: "2026-11-08T13:00:00.000Z", origem: "call", status: "a-fazer" };
    store.setItem(TAREFAS_KEY, JSON.stringify([null, { id: "sem-titulo" }, { ...ok, passos: "não é lista" }, ok]));
    const out = createTarefas(store, { now });
    expect(out.list().map((t) => t.id)).toEqual(["ok"]);
    expect(() => out.add({ ...tarefa, titulo: "Outra" }, { origem: "call" })).not.toThrow();
    expect(out.list()).toHaveLength(2);
  });
});
