import { describe, expect, it } from "vitest";
import demo from "../data/kota.journey.json";
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

  it("aceita ação navegador num momento sem quadro", () => {
    const j = clone(demo);
    const m = j.moments.find((x) => x.view?.mode === "logo") ?? j.moments[0];
    m.view = { mode: "logo" };
    m.steps[0].actions = [{ type: "navegador", acao: { tipo: "abrir", url: "https://github.com/JucaGF/kota-bank" } }];
    expect(errorsOf(j)).toEqual([]);
  });

  it("recusa ação navegador com tipo desconhecido", () => {
    const j = clone(demo);
    j.moments[3].steps[0].actions = [{ type: "navegador", acao: { tipo: "digitar" } } as never];
    expect(errorsOf(j).join("\n")).toMatch(/navegador/);
  });

  it("recusa ação que cita nó inexistente", () => {
    const j = clone(demo);
    j.moments[3].steps[0].actions = [{ type: "reveal", targets: ["nao-existe"] }];
    expect(errorsOf(j).join("\n")).toMatch(/nao-existe/);
  });

  it("aceita at que é trecho da fala e recusa o que não é", () => {
    const j = clone(demo);
    const step = j.moments[3].steps[0];
    step.actions = [{ type: "reveal", targets: ["frontend"], at: step.line.slice(0, 10) }];
    expect(errorsOf(j)).toEqual([]);
    step.actions = [{ type: "reveal", targets: ["frontend"], at: "trecho que ninguém fala" }];
    expect(errorsOf(j).join("\n")).toMatch(/at "trecho que ninguém fala", que não é trecho da fala/);
  });

  it("recusa check fora de wait/select, com tema que não existe ou com replies fora das sugeridas", () => {
    const j = clone(demo);
    const auto = j.moments[3].steps[0];
    auto.check = { tema: "pagamentos" };
    const wait = j.moments[0].steps.find((s) => s.decision === "wait") ?? j.moments[3].steps.find((s) => s.decision === "wait")!;
    wait.check = { tema: "nada" as never, replies: ["não existe"] };
    const erros = errorsOf(j).join("\n");
    expect(erros).toMatch(/check só vale em passo "wait" ou "select"/);
    expect(erros).toMatch(/tema "nada"/);
    expect(erros).toMatch(/check.replies cita "não existe"/);
  });

  it("recusa transição por checagem num passo sem check", () => {
    const j = clone(demo);
    j.moments[3].steps[0].transitions = [{ to: { moment: "checagem" }, if: { checagem: "rever" } }];
    expect(errorsOf(j).join("\n")).toMatch(/transição por checagem num passo sem check/);
  });

  it("recusa when numa transição por checagem", () => {
    const j = clone(demo);
    const checa = j.moments.flatMap((m) => m.steps).find((s) => s.id === "fa-checa")!;
    checa.transitions![0].when = "a pessoa entendeu";
    expect(errorsOf(j).join("\n")).toMatch(/transição por checagem não leva when/);
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
    const t = j.moments.find((m) => m.id === "pagamentos")!.steps.find((s) => s.id === "pg-pergunta")!.transitions![0] as unknown as { if: { reply: string } };
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
    expect(interpolate("Oi, {nome}! Time {time}.", DEMO_PROFILES.novo)).toBe("Oi, Ana! Time Livro-razão.");
    expect(interpolate("{gestor} lidera.", { nome: "Ana", vinculo: "novo" })).toBe("sua gestão lidera.");
  });
});
