import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_PROFILES } from "../../../src/journey/profile";
import { loadJourney } from "../../../src/journey/validate";
import { ask, type AskEvent } from "./ask";

const journey = loadJourney(JSON.parse(readFileSync(new URL("../../../src/journey/data/tail.journey.json", import.meta.url), "utf8")));

describe("ask", () => {
  it("LLM fora do ar: a ponte sai na hora e o fallback fecha, sem travar", async () => {
    process.env.FEATHERLESS_BASE_URL = "http://127.0.0.1:9";
    process.env.FEATHERLESS_API_KEY = "test";
    const evs: AskEvent[] = [];
    const t = await ask(
      { journey, profile: DEMO_PROFILES.novo, momentId: "pagamentos", stepId: "pg-pergunta", text: "Quanto ganha um pleno aqui?", tts: null, model: "x", timeoutMs: 2000 },
      (e) => evs.push(e),
    );
    const speaks = evs.filter((e) => e.type === "speak");
    expect(speaks.map((s) => s.source)).toEqual(["bridge", "fallback"]);
    expect(t.first_speak_ms!).toBeLessThan(50);
    expect(t.llm_error).not.toBeNull();
    expect(evs.at(-1)?.type).toBe("timing");
  });
});
