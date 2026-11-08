// Turno conduzido pelo LLM: falas, ações do quadro só com nós na tela, um movimento por turno, contexto no prompt.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_PROFILES } from "../../../src/journey/profile";
import { loadJourney } from "../../../src/journey/validate";
import type { ChatMessage, LlmEvent } from "../llm";

let script: LlmEvent[] = [];
let sent: ChatMessage[] = [];
vi.mock("../llm", () => ({
  async *streamChat(req: { messages: ChatMessage[] }) {
    sent = req.messages;
    for (const ev of script) yield ev;
  },
}));
const { turn, buildTurnTools } = await import("./turn");
type TurnEvent = Parameters<Parameters<typeof turn>[1]>[0];

const journey = loadJourney(JSON.parse(readFileSync(new URL("../../../src/journey/data/kota.journey.json", import.meta.url), "utf8")));
const tool = (name: string, args: unknown): LlmEvent => ({ type: "tool_call", name, args, raw: JSON.stringify(args) });

async function run(over: Partial<Parameters<typeof turn>[0]> = {}): Promise<TurnEvent[]> {
  const evs: TurnEvent[] = [];
  await turn(
    { journey, knowledge: "<pagina id=\"home-office\">Das 10h às 16h.</pagina>", profile: DEMO_PROFILES.novo, momentId: "pagamentos", stepId: "pg-ledgerwriter", kind: "seguir", tts: null, model: "x", timeoutMs: 2000, ...over },
    (e) => evs.push(e),
  );
  return evs;
}

describe("turn", () => {
  beforeEach(() => {
    script = [];
  });

  it("fala frase a frase, filtra nós fora do quadro e aceita um só movimento", async () => {
    script = [
      { type: "text", text: "O ledgerwriter grava a transferência. Depois confere o saldo." },
      tool("highlight", { targets: ["ledgerwriter", "nao-existe"] }),
      tool("next_step", {}),
      tool("go_to", { moment: "falha" }),
      { type: "done", finishReason: "tool_use" },
    ];
    const evs = await run();
    expect(evs.filter((e) => e.type === "speak").map((e) => e.type === "speak" && e.text)).toEqual(["O ledgerwriter grava a transferência.", "Depois confere o saldo."]);
    expect(evs).toContainEqual({ type: "action", action: { type: "highlight", targets: ["ledgerwriter"], tone: "focus" } });
    expect(evs.filter((e) => e.type === "next_step" || e.type === "go_to")).toEqual([{ type: "next_step" }]);
  });

  it("leva o Notion na parte fixa e a interrupção e a fala da pessoa na última mensagem", async () => {
    script = [{ type: "text", text: "Das dez às quatro. Posso voltar?" }];
    await run({ kind: "fala", text: "e o home office?", interrupted: "O gateway recebe a venda." });
    expect(sent.filter((m) => m.role === "system").some((m) => m.content.includes("home-office"))).toBe(true);
    const last = sent.at(-1)!;
    expect(last.role).toBe("user");
    expect(last.content).toContain('interrompido enquanto dizia: "O gateway recebe a venda."');
    expect(last.content).toContain('A pessoa disse: "e o home office?"');
  });

  it("sem fala nem movimento: frase de falha, sem encaminhar", async () => {
    script = [{ type: "done", finishReason: "end_turn" }];
    const evs = await run({ kind: "fala", text: "qual a política de férias?" });
    expect(evs.find((e) => e.type === "speak" && e.source === "fallback")).toBeTruthy();
    expect(evs.some((e) => e.type === "escalate")).toBe(false);
  });
});

describe("turn: destino do encaminhamento (#125, mensagem real do #129)", () => {
  const escalates = (evs: TurnEvent[]) => evs.filter((e) => e.type === "escalate");

  it("a tool traz o destino: ele vai junto", async () => {
    script = [
      { type: "text", text: "Isso é com o seu gestor. " },
      { type: "tool_call", name: "escalate_to_buddy", args: { summary: "Contrato", destino: "gestor" }, raw: "" },
      { type: "done", finishReason: "end_turn" },
    ];
    expect(escalates(await run({ kind: "fala", text: "como fica o meu contrato?" }))).toEqual([{ type: "escalate", summary: "Contrato", destino: "gestor" }]);
  });

  it("tool sem destino: vale a fala; caso pessoal sem nada vai a People", async () => {
    script = [
      { type: "text", text: "Não consegui confirmar isso. " },
      { type: "tool_call", name: "escalate_to_buddy", args: { summary: "Bônus" }, raw: "" },
      { type: "done", finishReason: "end_turn" },
    ];
    expect(escalates(await run({ kind: "fala", text: "qual vai ser o meu bônus?" }))).toEqual([{ type: "escalate", summary: "Bônus", destino: "rh" }]);
  });

  it("caso pessoal encaminha a People mesmo sem a tool (o LLM só explicou a regra)", async () => {
    script = [{ type: "text", text: "A PLR é paga uma vez por ano, conforme a política." }, { type: "done", finishReason: "end_turn" }];
    expect(escalates(await run({ kind: "fala", text: "qual vai ser o meu bônus?" }))).toEqual([{ type: "escalate", summary: "qual vai ser o meu bônus?", destino: "rh" }]);
  });

  it("dúvida técnica sem destino: a buddy, sem destino no evento", async () => {
    script = [
      { type: "text", text: "Não consegui confirmar isso. " },
      { type: "tool_call", name: "escalate_to_buddy", args: { summary: "Convênio" }, raw: "" },
      { type: "done", finishReason: "end_turn" },
    ];
    expect(escalates(await run({ kind: "fala", text: "tem convênio com academia?" }))).toEqual([{ type: "escalate", summary: "Convênio" }]);
  });

  it("o LLM recebe o destino opcional na tool", () => {
    const tool = buildTurnTools(journey).find((t) => t.function.name === "escalate_to_buddy")!;
    expect((tool.function.parameters as { properties: Record<string, { enum?: string[] }> }).properties.destino.enum).toEqual(["buddy", "gestor", "rh"]);
  });
});

describe("turn: tarefas (assign_task)", () => {
  it("assign_task vira evento tarefa, com os textos limpos; sem título é descartado", async () => {
    script = [
      { type: "text", text: "Uma tarefa para hoje: rode o ledgerwriter." },
      tool("assign_task", { titulo: "  Rodar o ledgerwriter  ", porque: "Grava cada transferência.", passos: ["Clone o repo", " "], onde: "README do ledgerwriter" }),
      tool("assign_task", { porque: "sem título" }),
      tool("next_step", {}),
    ];
    const evs = await run();
    expect(evs.filter((e) => e.type === "tarefa")).toEqual([
      { type: "tarefa", tarefa: { titulo: "Rodar o ledgerwriter", porque: "Grava cada transferência.", passos: ["Clone o repo"], onde: "README do ledgerwriter" } },
    ]);
    expect(evs).toContainEqual({ type: "next_step" });
  });

  it("só a tarefa, sem fala: não é resposta vazia", async () => {
    script = [tool("assign_task", { titulo: "Ler o README", porque: "x", passos: [] })];
    const evs = await run();
    expect(evs.some((e) => e.type === "speak" && e.source === "fallback")).toBe(false);
  });

  it("assign_task está nas ferramentas fixas e as regras dizem quando usar", async () => {
    const tool = buildTurnTools(journey).find((t) => t.function.name === "assign_task")!;
    expect((tool.function.parameters as { required: string[] }).required).toEqual(["titulo", "porque", "passos"]);
    script = [{ type: "text", text: "Oi." }];
    await run();
    expect(sent[0].content).toContain("assign_task");
  });
});
