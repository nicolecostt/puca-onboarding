import { describe, expect, it } from "vitest";
import { CALIBRAGEM_TEMAS, DEMO_CALIBRAGENS, calibragemFromAnswers, itemDoTema, nivelFromAnswer } from "../calibragem";
import { DEMO_PROFILES } from "../profile";
import demo from "../data/tail.journey.json";
import type { Tema } from "../types";

describe("nivelFromAnswer", () => {
  it.each([
    ["Sim, uso Kafka todo dia", "usa"],
    ["Já, a gente tinha retry e DLQ", "usa"],
    ["Nunca trabalhei com pagamentos", "nao_conhece"],
    ["Não", "nao_conhece"],
    ["Pouco, só vi num curso", "ja_ouviu"],
    ["Não muito, retry eu sei o que é", "ja_ouviu"],
    ["Domino, trabalho com isso há anos", "domina"],
    ["Sim, mas lá não tinha DLQ", "usa"],
  ])("%s → %s", (answer, nivel) => {
    expect(nivelFromAnswer(answer)).toBe(nivel);
  });

  it("devolve null quando a resposta não diz o nível", () => {
    expect(nivelFromAnswer("hmm, depende")).toBeNull();
    expect(nivelFromAnswer("")).toBeNull();
  });
});

describe("calibragemFromAnswers", () => {
  it("tem um item por tema, sempre os cinco", () => {
    const c = calibragemFromAnswers(DEMO_PROFILES.novo, {});
    expect(c.conhecimentos.map((i) => i.tema).sort()).toEqual(Object.keys(CALIBRAGEM_TEMAS).sort());
  });

  it("sem resposta clara, usa a experiência que a pessoa contou (certeza média)", () => {
    const c = calibragemFromAnswers(DEMO_PROFILES.novo, { mensageria: "depende", experiencia: "Mexia com filas no SQS" });
    expect(itemDoTema(c, "mensageria")).toMatchObject({ nivel: "usa", certeza: "media" });
  });

  it("sem nada, fica no nível do meio com certeza baixa (para a aula confirmar)", () => {
    const c = calibragemFromAnswers(DEMO_PROFILES.novo, {});
    expect(itemDoTema(c, "falhas")).toMatchObject({ nivel: "ja_ouviu", certeza: "baixa" });
  });

  it("só a transição guarda time anterior, o que aproveita e o que muda", () => {
    const r = { time_anterior: "Antifraude", aproveita: "Kafka", diferencas: "terminais" };
    expect(calibragemFromAnswers(DEMO_PROFILES.transicao, r)).toMatchObject(r);
    expect(calibragemFromAnswers(DEMO_PROFILES.novo, r).time_anterior).toBeUndefined();
  });
});

describe("calibragens da demo", () => {
  it("Ana e Bruno saem diferentes nos temas da aula", () => {
    const nivel = (v: "novo" | "transicao", t: Tema) => itemDoTema(DEMO_CALIBRAGENS[v], t)?.nivel;
    expect(nivel("transicao", "mensageria")).toBe("usa");
    expect(nivel("novo", "mensageria")).toBe("ja_ouviu");
    expect(nivel("transicao", "pagamentos")).toBe("ja_ouviu");
    expect(nivel("novo", "pagamentos")).toBe("nao_conhece");
    expect(nivel("transicao", "empresa")).toBe("usa");
    expect(nivel("novo", "empresa")).toBe("nao_conhece");
    expect(DEMO_CALIBRAGENS.novo.objetivos).toHaveLength(1);
  });

  it("os momentos de cada tema existem na jornada da Tail", () => {
    const ids = new Set(demo.moments.map((m) => m.id));
    for (const t of Object.values(CALIBRAGEM_TEMAS)) for (const m of t.momentos) expect(ids).toContain(m);
  });
});
