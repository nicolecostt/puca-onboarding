import { describe, expect, it } from "vitest";
import type { TarefaAtribuida } from "../../journey/tarefas";
import { grupos, origemDaTarefa } from "./lista";

const t = (id: string, at: string, over: Partial<TarefaAtribuida> = {}): TarefaAtribuida => ({
  id, at, titulo: id, porque: "", passos: [], origem: "sessao", status: "a-fazer", ...over,
});

describe("grupos", () => {
  it("separa a fazer e feitas, a mais recente primeiro", () => {
    const g = grupos([
      t("a", "2026-11-08T10:00:00Z"),
      t("b", "2026-11-08T12:00:00Z", { status: "feita" }),
      t("c", "2026-11-08T11:00:00Z"),
      t("d", "2026-11-08T09:00:00Z", { status: "feita" }),
    ]);
    expect(g.aFazer.map((x) => x.id)).toEqual(["c", "a"]);
    expect(g.feitas.map((x) => x.id)).toEqual(["b", "d"]);
  });
});

describe("origemDaTarefa", () => {
  it("diz de onde veio a tarefa", () => {
    expect(origemDaTarefa(t("a", "x", { origem: "call" }))).toBe("Da call inicial");
    expect(origemDaTarefa(t("a", "x", { momento: "Como uma transferência acontece" }))).toBe("Da sessão · Como uma transferência acontece");
    expect(origemDaTarefa(t("a", "x"))).toBe("Da sessão");
  });
});
