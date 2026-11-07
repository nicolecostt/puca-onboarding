import { describe, expect, it } from "vitest";
import { classifyBargeIn } from "./barge-in";

describe("classifyBargeIn", () => {
  const agentText = "Em 27 a.C., o Senado deu a Otávio o título de Augusto.";

  it("waits for two words in an interim transcript", () => {
    expect(classifyBargeIn({ transcript: "Espera", kind: "interim", agentText })).toMatchObject({ decision: "wait" });
  });

  it("ignores a partial transcript that matches the agent audio", () => {
    expect(classifyBargeIn({ transcript: "o Senado deu a Otávio", kind: "interim", agentText })).toMatchObject({
      decision: "echo",
      overlap: 1,
    });
  });

  it("confirms a different two-word interim transcript as barge-in", () => {
    expect(classifyBargeIn({ transcript: "Espera aí", kind: "interim", agentText })).toMatchObject({ decision: "interrupt" });
  });

  it("confirms a different single-word final transcript", () => {
    expect(classifyBargeIn({ transcript: "Pare", kind: "final", agentText })).toMatchObject({ decision: "interrupt" });
  });

  it("ignores a final transcript copied from the agent", () => {
    expect(classifyBargeIn({ transcript: "Augusto", kind: "final", agentText })).toMatchObject({ decision: "echo" });
  });

  it("does not hide a real disagreement just because one word overlaps", () => {
    expect(classifyBargeIn({ transcript: "Não entendi", kind: "interim", agentText: "Não foi durante a República." })).toMatchObject({ decision: "interrupt" });
  });
});
