import { describe, expect, it } from "vitest";
import demo from "../data/orla-pagamentos.journey.json";
import { validateJourney } from "../validate";
import { matchReply } from "../conditions";
import { interpolate, vinculoFromAnswer, DEMO_PROFILES } from "../profile";
import type { Journey } from "../types";

// cópia mutável da demo, tipada como Journey para os testes alterarem campos
const clone = (v: unknown): Journey => JSON.parse(JSON.stringify(v)) as Journey;

function errorsOf(input: unknown): string[] {
  const r = validateJourney(input);
  return r.ok ? [] : r.errors;
}

describe("validateJourney", () => {
  it("aceita a jornada de demo", () => {
    expect(errorsOf(demo)).toEqual([]);
  });

  it("recusa ação que cita nó inexistente", () => {
    const j = clone(demo);
    j.moments[3].steps[0].actions = [{ type: "reveal", targets: ["nao-existe"] }];
    expect(errorsOf(j).join("\n")).toMatch(/nao-existe/);
  });

  it("recusa transição para momento inexistente", () => {
    const j = clone(demo);
    j.moments[0].steps[1].transitions = [{ to: { moment: "sumiu" } }];
    expect(errorsOf(j).join("\n")).toMatch(/momento inexistente "sumiu"/);
  });

  it("recusa passo wait sem pergunta nem respostas sugeridas", () => {
    const j = clone(demo);
    const step = j.moments[0].steps[0] as unknown as Record<string, unknown>;
    step.decision = "wait";
    step.line = "Vamos começar.";
    expect(errorsOf(j).join("\n")).toMatch(/passo "wait"/);
  });

  it("recusa transição que espera resposta fora de suggested_replies", () => {
    const j = clone(demo);
    const t = j.moments[3].steps[6].transitions![0] as unknown as { if: { reply: string } };
    t.if.reply = "Outra coisa";
    expect(errorsOf(j).join("\n")).toMatch(/não está em suggested_replies/);
  });

  it("recusa objetivos repetidos entre momentos", () => {
    const j = clone(demo);
    j.moments[2].goal = j.moments[1].goal;
    expect(errorsOf(j).join("\n")).toMatch(/objetivo repetido/);
  });

  it("recusa ação de quadro em momento com vista de logo", () => {
    const j = clone(demo);
    j.moments[0].steps[0] = { ...j.moments[0].steps[0], actions: [{ type: "reveal", targets: ["missao"] }] } as never;
    expect(errorsOf(j).join("\n")).toMatch(/sem quadro/);
  });
});

describe("matchReply", () => {
  const replies = ["E se o pagamento falhar?", "Quem cuida de cada serviço?", "Pode seguir"];

  it("reconhece a resposta exata", () => {
    expect(matchReply("Pode seguir", replies)).toBe("Pode seguir");
  });

  it("reconhece texto livre parecido", () => {
    expect(matchReply("o que acontece quando falha?", replies)).toBe("E se o pagamento falhar?");
    expect(matchReply("quem cuida disso?", replies)).toBe("Quem cuida de cada serviço?");
    expect(matchReply("bora seguir", replies)).toBe("Pode seguir");
  });

  it("devolve null quando nada combina", () => {
    expect(matchReply("qual o horário do almoço?", replies)).toBeNull();
  });
});

describe("perfil", () => {
  it("lê o vínculo da resposta livre", () => {
    expect(vinculoFromAnswer("Primeira vez")).toBe("novo");
    expect(vinculoFromAnswer("Estou mudando de time")).toBe("transicao");
    expect(vinculoFromAnswer("Já trabalho aqui, vim do time de checkout")).toBe("transicao");
  });

  it("interpola campos do perfil com texto neutro quando faltam", () => {
    expect(interpolate("Oi, {nome}! Time {time}.", DEMO_PROFILES.novo)).toBe("Oi, Bruno! Time TMS — fraud-score.");
    expect(interpolate("{gestor} lidera.", { nome: "Ana", vinculo: "novo" })).toBe("sua gestão lidera.");
  });
});
