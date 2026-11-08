import { describe, expect, it } from "vitest";
import demo from "../data/kota.journey.json";
import { loadJourney } from "../validate";
import { createRunner, type RunnerIO } from "../runner";
import { DEMO_PROFILES } from "../profile";
import { answerFromKnowledge, findJump } from "../intent";

const journey = loadJourney(demo);
const moment = (id: string) => journey.moments.find((m) => m.id === id)!;

describe("pulo de momento pedido pela pessoa", () => {
  it("reconhece o pedido pelo título do momento", () => {
    expect(findJump("volta pro caminho da transação", journey)?.id).toBe("pagamentos");
    expect(findJump("quero ver a primeira tarefa", journey)?.id).toBe("primeira-tarefa");
    expect(findJump("me mostra quem cuida de cada coisa", journey)?.id).toBe("quem-cuida");
  });

  it("sem sinal de navegação é pergunta, não pulo", () => {
    expect(findJump("quem cuida do ledger?", journey)).toBeNull();
    expect(findJump("a que horas é a daily?", journey)).toBeNull();
  });

  it("o runner entra no início do momento pedido", async () => {
    const said: string[] = [];
    let runner: ReturnType<typeof createRunner>;
    let jumped = false;
    const io: RunnerIO = {
      enterView: () => {},
      apply: () => {},
      say: async (t) => {
        said.push(t);
      },
      listen: async () => {
        // na primeira pergunta, a pessoa pede para ir direto à primeira tarefa
        if (!jumped) {
          jumped = true;
          runner.jumpTo("primeira-tarefa");
          throw new Error("interrompido");
        }
        return "Terminar por hoje";
      },
      select: async () => "balancereader",
    };
    runner = createRunner(journey, DEMO_PROFILES.transicao, io);
    const r = await runner.run();
    expect(r.moments).toEqual(["boas-vindas", "seu-time", "primeira-tarefa", "encerramento"]);
    expect(r.steps).toContain("pt-tarefa"); // primeiro passo do momento
    expect(r.ended).toBe("done");
  });

  it("pulo para momento inexistente é ignorado", () => {
    const runner = createRunner(journey, DEMO_PROFILES.novo, { enterView() {}, apply() {}, say: async () => {}, listen: async () => "", select: async () => "" });
    expect(runner.jumpTo("nao-existe")).toBe(false);
  });
});

describe("respostas com o conhecimento do momento", () => {
  it("responde o que está no conhecimento", () => {
    expect(answerFromKnowledge("como o ledgerwriter confere o saldo?", null, moment("pagamentos"))).toMatch(/balancereader por HTTP/);
    expect(answerFromKnowledge("o saldo pode estar atrasado?", null, moment("pagamentos"))).toMatch(/um ciclo atrasado/);
    expect(answerFromKnowledge("que horas é a daily?", null, moment("seu-time"))).toMatch(/15 minutos/);
  });

  it("não chuta quando o conhecimento não cobre", () => {
    expect(answerFromKnowledge("qual o horário do almoço?", null, moment("seu-time"))).toBeNull();
  });
});
