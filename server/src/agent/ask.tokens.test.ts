// Custo da sessão (#52): cada pergunta ao agente sai com os tokens no timing, do provedor ou estimados.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_PROFILES } from "../../../src/journey/profile";
import { loadJourney } from "../../../src/journey/validate";
import type { LlmEvent } from "../llm";

let script: LlmEvent[] = [];
let failAfterScript = false;
vi.mock("../llm", () => ({
  async *streamChat() {
    for (const ev of script) yield ev;
    if (failAfterScript) throw new Error("conexão caiu");
  },
}));
const { ask } = await import("./ask");
type AskEvent = Parameters<Parameters<typeof ask>[1]>[0];

const journey = loadJourney(JSON.parse(readFileSync(new URL("../../../src/journey/data/tail.journey.json", import.meta.url), "utf8")));

async function timing() {
  const evs: AskEvent[] = [];
  const t = await ask(
    { journey, profile: DEMO_PROFILES.novo, momentId: "pagamentos", stepId: "pg-pergunta", text: "Qual a política de home office do time?", tts: null, model: "x", timeoutMs: 2000 },
    (e) => evs.push(e),
  );
  const last = evs.at(-1);
  expect(last?.type).toBe("timing");
  expect(last?.type === "timing" && last.timing).toEqual(t);
  return t;
}

describe("ask: tokens no timing", () => {
  beforeEach(() => {
    script = [];
    failAfterScript = false;
  });

  it("usa o usage do provedor", async () => {
    script = [
      { type: "text", text: "A política fica no Notion. " },
      { type: "usage", input: 812, output: 41 },
      { type: "done", finishReason: "stop" },
    ];
    expect(await timing()).toMatchObject({ tokens_in: 812, tokens_out: 41, tokens_estimated: false });
  });

  it("sem usage, estima e marca como estimado", async () => {
    script = [
      { type: "text", text: "Oi, tudo bem." },
      { type: "done", finishReason: "stop" },
    ];
    const t = await timing();
    expect(t.tokens_estimated).toBe(true);
    expect(t.tokens_in).toBeGreaterThan(0);
    expect(t.tokens_out).toBe(Math.ceil("Oi, tudo bem.".length / 4));
  });

  it("timeout ou erro no meio: estima o que foi enviado e o que chegou", async () => {
    script = [{ type: "text", text: "Deixa eu ver isso direito para você. " }];
    failAfterScript = true;
    const t = await timing();
    expect(t.llm_error).not.toBeNull();
    expect(t.tokens_estimated).toBe(true);
    expect(t.tokens_in).toBeGreaterThan(0);
    expect(t.tokens_out).toBeGreaterThan(0);
  });
});
