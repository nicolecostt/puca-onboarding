import { describe, expect, it } from "vitest";
import demo from "../data/tail.journey.json";
import { loadJourney } from "../validate";
import { DEMO_CALIBRAGENS, atualizarCalibragem } from "../calibragem";
import { montarJornadaDaPessoa, proximosPassos } from "../jornada-da-pessoa";
import type { Calibragem, Certeza, Nivel, Tema } from "../types";

const journey = loadJourney(demo);

const estados = (c: Calibragem) => Object.fromEntries(montarJornadaDaPessoa(journey, c).momentos.map((m) => [m.id, m.estado]));

/** Calibragem da Ana com um tema trocado. */
function comTema(tema: Tema, nivel: Nivel, certeza: Certeza): Calibragem {
  const c = DEMO_CALIBRAGENS.novo;
  return {
    ...c,
    conhecimentos: c.conhecimentos.map((i) => (i.tema === tema ? { ...i, nivel, certeza, evidencia: "" } : i)),
  };
}

describe("montarJornadaDaPessoa", () => {
  it("traz todos os momentos da jornada, na ordem, com título e objetivo", () => {
    const j = montarJornadaDaPessoa(journey, DEMO_CALIBRAGENS.novo);
    expect(j.versao).toBe(1);
    expect(j.momentos.map((m) => m.id)).toEqual(journey.moments.map((m) => m.id));
    expect(j.momentos[1]).toMatchObject({ titulo: journey.moments[1].title, objetivo: journey.moments[1].goal });
  });

  it("leva os objetivos da calibragem", () => {
    expect(montarJornadaDaPessoa(journey, DEMO_CALIBRAGENS.transicao).objetivos).toEqual(DEMO_CALIBRAGENS.transicao.objetivos);
  });

  it("Bruno: a empresa fica fora, falha é revisão e o resto é para aprender", () => {
    const e = estados(DEMO_CALIBRAGENS.transicao);
    expect(e["empresa-e-cultura"]).toBe("fora");
    expect(e["seu-time"]).toBe("aprender");
    // pagamentos (já ouviu) pesa mais que mensageria (usa)
    expect(e["pagamentos"]).toBe("aprender");
    expect(e["falha"]).toBe("revisar");
    expect(e["checagem"]).toBe("aprender");
  });

  it("Ana: tudo é para aprender", () => {
    expect(new Set(Object.values(estados(DEMO_CALIBRAGENS.novo)))).toEqual(new Set(["aprender"]));
  });

  it("o motivo usa a frase da pessoa e explica o que ficou fora", () => {
    const j = montarJornadaDaPessoa(journey, DEMO_CALIBRAGENS.transicao);
    const m = (id: string) => j.momentos.find((x) => x.id === id)!;
    expect(m("falha").motivo).toContain("retry e DLQ");
    expect(m("pagamentos").motivo).toContain("adquirência");
    expect(m("empresa-e-cultura").motivo).toMatch(/já é da Tail/);
    expect(m("checagem").motivo).toBe("");
  });

  it("domina com certeza alta é 'já conhece'; com certeza menor, só revisão", () => {
    expect(estados(comTema("falhas", "domina", "alta"))["falha"]).toBe("ja_conhece");
    expect(estados(comTema("falhas", "domina", "media"))["falha"]).toBe("revisar");
  });

  it("os temas de cada momento vêm da calibragem", () => {
    const j = montarJornadaDaPessoa(journey, DEMO_CALIBRAGENS.novo);
    expect(j.momentos.find((m) => m.id === "pagamentos")!.temas).toEqual(["pagamentos", "mensageria"]);
    expect(j.momentos.find((m) => m.id === "boas-vindas")!.temas).toEqual([]);
  });
});

describe("montarJornadaDaPessoa depois da checagem", () => {
  const checa = (c: Calibragem, tema: Tema, entendeu: boolean) =>
    atualizarCalibragem(c, { tema, passo: "x", entendeu, tentativas: 1, resposta: "r" });

  it("entendeu marca o momento como já conhece; rever marca revisar, mesmo para quem não conhecia", () => {
    const ana = DEMO_CALIBRAGENS.novo; // pagamentos e falhas começam em aprender
    expect(estados(checa(ana, "pagamentos", true)).pagamentos).toBe("ja_conhece");
    expect(estados(checa(ana, "falhas", false)).falha).toBe("revisar");
  });

  it("rever em um tema do momento vale mais que entendeu em outro", () => {
    const c = checa(checa(DEMO_CALIBRAGENS.novo, "pagamentos", true), "mensageria", false);
    expect(estados(c).pagamentos).toBe("revisar");
  });

  it("o motivo fala da checagem, sem nota", () => {
    const m = montarJornadaDaPessoa(journey, checa(DEMO_CALIBRAGENS.novo, "falhas", false)).momentos.find((x) => x.id === "falha")!;
    expect(m.motivo).toBe("Na checagem da sessão, vale rever este assunto.");
  });
});

describe("proximosPassos", () => {
  const bruno = montarJornadaDaPessoa(journey, DEMO_CALIBRAGENS.transicao);

  it("antes de começar: todos menos os que ficaram fora", () => {
    const ids = proximosPassos(bruno, [], null).map((m) => m.id);
    expect(ids).not.toContain("empresa-e-cultura");
    expect(ids[0]).toBe("boas-vindas");
    expect(ids).toContain("primeira-tarefa");
  });

  it("no meio: só o que vem depois do atual e ainda não foi visto", () => {
    const ids = proximosPassos(bruno, ["boas-vindas", "seu-time", "pagamentos"], "pagamentos").map((m) => m.id);
    expect(ids).toEqual(["falha", "quem-cuida", "checagem", "primeira-tarefa", "encerramento"]);
  });

  it("o que a checagem pediu para rever volta aos próximos passos, mesmo já visto", () => {
    const c = atualizarCalibragem(DEMO_CALIBRAGENS.transicao, { tema: "falhas", passo: "fa-checa", entendeu: false, tentativas: 1, resposta: "Ela se perde" });
    const ids = proximosPassos(montarJornadaDaPessoa(journey, c), ["boas-vindas", "seu-time", "pagamentos", "falha", "checagem"], "primeira-tarefa").map((m) => m.id);
    expect(ids).toEqual(["falha", "quem-cuida", "encerramento"]);
  });

  it("depois de um pulo para frente, os pulados continuam como próximos", () => {
    const ids = proximosPassos(bruno, ["boas-vindas", "checagem"], "checagem").map((m) => m.id);
    expect(ids).toEqual(["seu-time", "pagamentos", "falha", "quem-cuida", "primeira-tarefa", "encerramento"]);
  });
});
