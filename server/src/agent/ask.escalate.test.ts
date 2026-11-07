// Encaminhamento pelo agente: o LLM chama escalate_to_buddy ou diz que não confirmou.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_PROFILES } from "../../../src/journey/profile";
import { loadJourney } from "../../../src/journey/validate";
import type { LlmEvent } from "../llm";

let script: LlmEvent[] = [];
vi.mock("../llm", () => ({
  async *streamChat() {
    for (const ev of script) yield ev;
  },
}));
const { ask } = await import("./ask");
type AskEvent = Parameters<Parameters<typeof ask>[1]>[0];

const journey = loadJourney(JSON.parse(readFileSync(new URL("../../../src/journey/data/tail.journey.json", import.meta.url), "utf8")));
const QUESTION = "Qual a política de home office do time?";

async function run(): Promise<AskEvent[]> {
  const evs: AskEvent[] = [];
  await ask(
    { journey, profile: DEMO_PROFILES.novo, momentId: "pagamentos", stepId: "pg-pergunta", text: QUESTION, tts: null, model: "x", timeoutMs: 2000 },
    (e) => evs.push(e),
  );
  return evs;
}

const escalations = (evs: AskEvent[]) => evs.filter((e) => e.type === "escalate");

describe("ask: encaminhamento", () => {
  beforeEach(() => {
    script = [];
  });

  it("o LLM chama escalate_to_buddy: sai um escalate com o resumo, antes do timing", async () => {
    script = [
      { type: "text", text: "Não consegui confirmar isso. " },
      { type: "tool_call", name: "escalate_to_buddy", args: { summary: "Política de home office" }, raw: "" },
      { type: "done", finishReason: "stop" },
    ];
    const evs = await run();
    expect(escalations(evs)).toEqual([{ type: "escalate", summary: "Política de home office" }]);
    expect(evs.findIndex((e) => e.type === "escalate")).toBeLessThan(evs.findIndex((e) => e.type === "timing"));
    expect(evs.at(-1)?.type).toBe("timing");
  });

  it("o LLM só diz que não confirmou: escalate com a pergunta como resumo", async () => {
    script = [{ type: "text", text: "Não consegui confirmar isso na documentação." }, { type: "done", finishReason: "stop" }];
    expect(escalations(await run())).toEqual([{ type: "escalate", summary: QUESTION }]);
  });

  it("resposta com fonte: nenhum encaminhamento", async () => {
    script = [{ type: "text", text: "O authorizer calcula o MDR, segundo o ADR-019." }, { type: "done", finishReason: "stop" }];
    expect(escalations(await run())).toEqual([]);
  });
});
