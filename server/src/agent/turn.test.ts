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
const { turn } = await import("./turn");
type TurnEvent = Parameters<Parameters<typeof turn>[1]>[0];

const journey = loadJourney(JSON.parse(readFileSync(new URL("../../../src/journey/data/tail.journey.json", import.meta.url), "utf8")));
const tool = (name: string, args: unknown): LlmEvent => ({ type: "tool_call", name, args, raw: JSON.stringify(args) });

async function run(over: Partial<Parameters<typeof turn>[0]> = {}): Promise<TurnEvent[]> {
  const evs: TurnEvent[] = [];
  await turn(
    { journey, knowledge: "<pagina id=\"home-office\">Das 10h às 16h.</pagina>", profile: DEMO_PROFILES.novo, momentId: "pagamentos", stepId: "pg-gateway", kind: "seguir", tts: null, model: "x", timeoutMs: 2000, ...over },
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
      { type: "text", text: "O gateway recebe a venda. Depois chama o authorizer." },
      tool("highlight", { targets: ["gateway", "nao-existe"] }),
      tool("next_step", {}),
      tool("go_to", { moment: "falha" }),
      { type: "done", finishReason: "tool_use" },
    ];
    const evs = await run();
    expect(evs.filter((e) => e.type === "speak").map((e) => e.type === "speak" && e.text)).toEqual(["O gateway recebe a venda.", "Depois chama o authorizer."]);
    expect(evs).toContainEqual({ type: "action", action: { type: "highlight", targets: ["gateway"], tone: "focus" } });
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
