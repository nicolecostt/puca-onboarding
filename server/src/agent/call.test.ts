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
const { callTurn, CAMPOS_DA_CALL, CULTURA } = await import("./call");
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

  it("na fala, os trechos do brain entram no prompt; sem brain, só o Notion", async () => {
    const brain = { buscar: () => [{ id: "adr:0004#decisao", titulo: "ADR · 4. Saldo com cache · Decisão", url: "u", texto: "O balancereader guarda o saldo em cache." }] };
    script = [{ type: "text", text: "Pela ADR 4, o saldo fica em cache." }];
    await run({ brain, text: "por que o saldo tem cache?" });
    expect(sent.some((m) => m.role === "system" && m.content.includes("ADR · 4. Saldo com cache · Decisão: O balancereader guarda"))).toBe(true);
    await run({ text: "por que o saldo tem cache?" });
    expect(sent.some((m) => m.content.includes("Trechos do company brain"))).toBe(false);
    await run({ brain, kind: "inicio", text: undefined });
    expect(sent.some((m) => m.content.includes("Trechos do company brain"))).toBe(false);
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
    // pauta coberta: tudo anotado (menos o que só vale para transição) e a cultura de quem é novo contada
    const daTransicao = ["time_anterior", "aproveita", "diferencas"];
    const anotado = Object.fromEntries(CAMPOS_DA_CALL.filter((k) => !daTransicao.includes(k)).map((k) => [k, k === "vinculo" ? "novo" : "x"]));
    script = [{ type: "text", text: "Antes da sessão, entre nos canais." }, tool("assign_task", { titulo: "Entrar nos canais", porque: "x", passos: [] })];
    const evs = await run({ anotado, cultura: [...CULTURA.novo] });
    expect(evs.filter((e) => e.type === "done")).toEqual([{ type: "done" }]);
  });

  it("uma tarefa cedo fica gravada, mas não encerra a call enquanto falta pauta (revisão do #223)", async () => {
    script = [{ type: "text", text: "Já entra no #livro-razao." }, tool("assign_task", { titulo: "Entrar no #livro-razao", porque: "x", passos: [] })];
    const evs = await run({ anotado: { vinculo: "novo", time: "Livro-razão" } });
    expect(evs.filter((e) => e.type === "tarefa")).toHaveLength(1);
    expect(evs.some((e) => e.type === "done")).toBe(false);
  });

  it("vínculo anotado com acento ou em palavras vira o valor do contrato, igual ao cliente (revisão do #221)", async () => {
    script = [tool("answer", { key: "vinculo", value: "transição" }), tool("answer", { key: "vinculo", value: "estou mudando de time" }), tool("answer", { key: "vinculo", value: "primeira vez" })];
    const evs = await run();
    expect(evs.filter((e) => e.type === "answer").map((e) => e.type === "answer" && e.value)).toEqual(["transicao", "transicao", "novo"]);
  });

  it("anotado com 'transição' (acento) segue a pauta de transição: pergunta o time anterior e conta a cultura do time", async () => {
    script = [{ type: "text", text: "Oi." }];
    await run({ anotado: { vinculo: "transição" } });
    const ctx = sent.at(-1)!.content;
    expect(ctx).toContain("time_anterior");
    expect(ctx).toContain("cultura:rituais_do_time");
    expect(ctx).not.toContain("cultura:missao");
  });
});
