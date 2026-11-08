// Call inicial conduzida pelo LLM: anotações válidas, cultura pelo vínculo, fim só com end_call.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, LlmEvent } from "../llm";

let script: LlmEvent[] = [];
let sent: ChatMessage[] = [];
vi.mock("../llm", () => ({
  async *streamChat(req: { messages: ChatMessage[] }) {
    sent = req.messages;
    for (const ev of script) yield ev;
  },
}));
const { callTurn } = await import("./call");
type CallEvent = Parameters<Parameters<typeof callTurn>[1]>[0];

const tool = (name: string, args: unknown): LlmEvent => ({ type: "tool_call", name, args, raw: JSON.stringify(args) });

async function run(over: Partial<Parameters<typeof callTurn>[0]> = {}): Promise<CallEvent[]> {
  const evs: CallEvent[] = [];
  await callTurn(
    { knowledge: "", kind: "fala", text: "sou a Ju, primeira vez aqui", admissao: { cargo: "Dev", time: "Terminais", gestor: "Marcos" }, anotado: {}, cultura: [], tts: null, model: "x", timeoutMs: 2000, ...over },
    (e) => evs.push(e),
  );
  return evs;
}

describe("callTurn", () => {
  beforeEach(() => {
    script = [];
  });

  it("anota só chaves conhecidas, marca a cultura e só acaba com end_call", async () => {
    script = [
      { type: "text", text: "Prazer, Ju! Na Kota, cada centavo confere." },
      tool("answer", { key: "nome", value: "Ju" }),
      tool("answer", { key: "salario", value: "x" }),
      tool("culture_told", { topic: "missao" }),
    ];
    const evs = await run();
    expect(evs.filter((e) => e.type === "answer")).toEqual([{ type: "answer", key: "nome", value: "Ju" }]);
    expect(evs).toContainEqual({ type: "culture", topic: "missao" });
    expect(evs.some((e) => e.type === "done")).toBe(false);

    script = [{ type: "text", text: "Obrigada, Ju!" }, tool("end_call", {})];
    expect((await run()).some((e) => e.type === "done")).toBe(true);
  });

  it("pede a cultura do time (não da empresa) para quem está mudando de time", async () => {
    script = [{ type: "text", text: "Legal." }];
    await run({ anotado: { vinculo: "transicao" } });
    const ctx = sent.at(-1)!.content;
    expect(ctx).toContain("cultura:rituais_do_time");
    expect(ctx).not.toContain("cultura:missao");
    expect(ctx).toContain("time_anterior");
  });

  it("assign_task no fim da call vira evento tarefa; sem título não", async () => {
    script = [
      { type: "text", text: "Antes da sessão, entre nos canais do time." },
      tool("assign_task", { titulo: "Entrar nos canais do time", porque: "É onde o time conversa.", passos: ["Entre em #terminais"] }),
      tool("assign_task", { titulo: "" }),
      tool("end_call", {}),
    ];
    const evs = await run();
    expect(evs.filter((e) => e.type === "tarefa")).toEqual([
      { type: "tarefa", tarefa: { titulo: "Entrar nos canais do time", porque: "É onde o time conversa.", passos: ["Entre em #terminais"] } },
    ]);
    expect(sent[0].content).toContain("assign_task");
  });

  it("a tarefa de preparação fecha a call: sem end_call (o Haiku esqueceu), a call acaba igual", async () => {
    script = [{ type: "text", text: "Antes da sessão, entre nos canais." }, tool("assign_task", { titulo: "Entrar nos canais", porque: "x", passos: [] })];
    const evs = await run();
    expect(evs.filter((e) => e.type === "done")).toEqual([{ type: "done" }]);
  });
});
