// Encaminhamento pelo agente: o LLM chama escalate_to_buddy ou diz que não confirmou.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_PROFILES } from "../../../src/journey/profile";
import { loadJourney } from "../../../src/journey/validate";
import type { LlmEvent } from "../llm";

let script: (LlmEvent | { type: "throw"; error: unknown } | { type: "wait_for_abort" })[] = [];
vi.mock("../llm", () => ({
  async *streamChat(req: { signal?: AbortSignal }) {
    for (const ev of script) {
      if (ev.type === "wait_for_abort") {
        await new Promise<void>((resolve) => req.signal?.addEventListener("abort", () => resolve(), { once: true }));
        throw new Error("aborted");
      }
      if (ev.type === "throw") throw ev.error;
      yield ev;
    }
  },
}));
const { ask } = await import("./ask");
const { buildTools } = await import("./prompt");
const { destinoPelaFala } = await import("./ask");
type AskEvent = Parameters<Parameters<typeof ask>[1]>[0];

const journey = loadJourney(JSON.parse(readFileSync(new URL("../../../src/journey/data/kota.journey.json", import.meta.url), "utf8")));
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

  it("caso pessoal: o LLM escolhe rh ou gestor e o destino vai junto (#125, mensagem real do #129)", async () => {
    for (const destino of ["rh", "gestor"] as const) {
      script = [
        { type: "text", text: "Isso é com People. " },
        { type: "tool_call", name: "escalate_to_buddy", args: { summary: "Bônus", destino }, raw: "" },
        { type: "done", finishReason: "stop" },
      ];
      expect(escalations(await run())).toEqual([{ type: "escalate", summary: "Bônus", destino }]);
    }
  });

  it("destino desconhecido é ignorado: vai à buddy, como antes", async () => {
    script = [
      { type: "tool_call", name: "escalate_to_buddy", args: { summary: "x", destino: "canal-geral" }, raw: "" },
      { type: "done", finishReason: "stop" },
    ];
    expect(escalations(await run())).toEqual([{ type: "escalate", summary: "x" }]);
  });

  it("sem a tool, o texto do LLM manda falar com People ou com o gestor: o destino segue o texto", async () => {
    const casos = [
      { fala: "Não consegui confirmar informações sobre bônus. Recomendo que converse com o gestor ou com a equipe de People (RH).", destino: "rh" },
      { fala: "Não consegui confirmar isso. Fale com sua gestora sobre o contrato.", destino: "gestor" },
    ];
    for (const c of casos) {
      script = [{ type: "text", text: c.fala }, { type: "done", finishReason: "stop" }];
      expect(escalations(await run())).toEqual([{ type: "escalate", summary: QUESTION, destino: c.destino }]);
    }
  });

  it("o Puca diz que encaminha sem chamar a tool: encaminha de fato, com o destino da fala", async () => {
    const falas = ["Isso é uma dúvida pessoal. Escalo para o seu gestor ou para a equipe de People.", "Vou te encaminhar para a equipe de People.", "Vou encaminhar sua dúvida para a sua gestora."];
    for (const fala of falas) {
      script = [{ type: "text", text: fala }, { type: "done", finishReason: "stop" }];
      const [ev] = escalations(await run());
      expect(ev?.type).toBe("escalate");
    }
  });

  it("\"encaminho\" no sentido de levar a uma página, com fonte citada, não é encaminhamento", async () => {
    for (const fala of ["Encaminho você ao card do deploy [f1].", "Vou te encaminhar para a página de férias no Notion [f1]."]) {
      script = [{ type: "text", text: fala }, { type: "done", finishReason: "stop" }];
      expect(escalations(await run())).toEqual([]);
    }
  });

  it("a tool com destino vence o texto", async () => {
    script = [
      { type: "text", text: "Não consegui confirmar. Fale com People. " },
      { type: "tool_call", name: "escalate_to_buddy", args: { summary: "Bônus", destino: "gestor" }, raw: "" },
      { type: "done", finishReason: "stop" },
    ];
    expect(escalations(await run())).toEqual([{ type: "escalate", summary: "Bônus", destino: "gestor" }]);
  });

  it("o LLM só diz que não confirmou: escalate com a pergunta como resumo", async () => {
    script = [{ type: "text", text: "Não consegui confirmar isso na documentação." }, { type: "done", finishReason: "stop" }];
    expect(escalations(await run())).toEqual([{ type: "escalate", summary: QUESTION }]);
  });

  it("resposta com fonte: nenhum encaminhamento", async () => {
    script = [{ type: "text", text: "O balancereader responde o saldo do cache, segundo o ADR-0004." }, { type: "done", finishReason: "stop" }];
    expect(escalations(await run())).toEqual([]);
  });

  it.each([
    ["recusa", [{ type: "done", finishReason: "refusal" }]],
    ["resposta vazia", []],
  ] as const)("%s não encaminha e usa fala de falha", async (_label, events) => {
    script = [...events] as LlmEvent[];
    const evs = await run();
    expect(escalations(evs)).toEqual([]);
    expect(evs.filter((e) => e.type === "speak").map((e) => e.type === "speak" && e.source)).toEqual(["bridge", "fallback"]);
    expect(evs.filter((e) => e.type === "speak").at(-1)).toMatchObject({ text: expect.stringContaining("problema para pensar") });
  });

  it("timeout não encaminha e registra uma razão estável", async () => {
    script = [{ type: "wait_for_abort" }];
    const evs: AskEvent[] = [];
    await ask({ journey, profile: DEMO_PROFILES.novo, momentId: "pagamentos", stepId: "pg-pergunta", text: QUESTION,
      tts: null, model: "x", timeoutMs: 1 }, (e) => evs.push(e));
    expect(escalations(evs)).toEqual([]);
    expect(evs.at(-1)).toMatchObject({ type: "timing", timing: { llm_error: "timeout" } });
    expect(evs.filter((e) => e.type === "speak").at(-1)).toMatchObject({ text: expect.stringContaining("problema para pensar") });
  });

  it("resposta interrompida depois de dizer que não confirmou não encaminha", async () => {
    const controller = new AbortController();
    script = [{ type: "text", text: "Não consegui confirmar isso." }, { type: "done", finishReason: "stop" }];
    const evs: AskEvent[] = [];
    await ask({ journey, profile: DEMO_PROFILES.novo, momentId: "pagamentos", stepId: "pg-pergunta", text: QUESTION,
      tts: null, model: "x", timeoutMs: 2000, signal: controller.signal }, (e) => {
      evs.push(e);
      if (e.type === "speak" && e.source === "llm") controller.abort();
    });
    expect(escalations(evs)).toEqual([]);
  });

  it("falha depois de tool de encaminhamento também não emite evento", async () => {
    script = [
      { type: "tool_call", name: "escalate_to_buddy", args: { summary: "resumo" }, raw: "" },
      { type: "throw", error: new Error("Authorization: token sensível") },
    ];
    const evs = await run();
    expect(escalations(evs)).toEqual([]);
    expect(evs.at(-1)).toMatchObject({ type: "timing", timing: { llm_error: "provider_error" } });
    expect(evs.filter((e) => e.type === "speak").at(-1)).toMatchObject({ text: expect.stringContaining("problema para pensar") });
  });

  it.each(["ok", "valeu"])("conversa fiada %s não encaminha, mesmo se o LLM pedir", async (text) => {
    script = [{ type: "tool_call", name: "escalate_to_buddy", args: { summary: text }, raw: "" }];
    const evs: AskEvent[] = [];
    await ask({ journey, profile: DEMO_PROFILES.novo, momentId: "pagamentos", stepId: "pg-pergunta", text,
      tts: null, model: "x", timeoutMs: 2000 }, (e) => evs.push(e));
    expect(escalations(evs)).toEqual([]);
  });
});

describe("escalate_to_buddy: o que o LLM recebe", () => {
  it("tem destino opcional: buddy, gestor ou rh", () => {
    const tool = buildTools({ journey, profile: DEMO_PROFILES.novo, momentId: "pagamentos", stepId: "pg-pergunta" }).find((t) => t.function.name === "escalate_to_buddy")!;
    const params = tool.function.parameters as { properties: Record<string, { enum?: string[] }>; required: string[] };
    expect(params.properties.destino.enum).toEqual(["buddy", "gestor", "rh"]);
    expect(params.required).toEqual(["summary"]);
  });
});

describe("destinoPelaFala", () => {
  it("a fala cita a buddy: fica a buddy, mesmo citando o gestor", () => {
    expect(destinoPelaFala("Não consegui confirmar. Pergunte à sua buddy ou ao gestor.")).toBeUndefined();
  });
  it("palavra que só contém rh ou gestor não conta", () => {
    expect(destinoPelaFala("O gestorservice não está nas docs, nem o ahrhh.")).toBeUndefined();
  });
});
