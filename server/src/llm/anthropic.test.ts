// Cliente do Claude: os eventos do stream do SDK viram os mesmos LlmEvent da Featherless, com um stream falso.
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { ChatRequest, LlmEvent, ToolSpec } from "../llm";
import { streamAnthropic } from "./anthropic";

const goTo: ToolSpec = {
  type: "function",
  function: { name: "go_to", description: "Segue a sessão.", parameters: { type: "object", properties: { target: { type: "string", enum: ["moment:fraude"] } }, required: ["target"] } },
};

const usage = { input_tokens: 100, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 700 };

function start(): Anthropic.MessageStreamEvent {
  return { type: "message_start", message: { usage } } as unknown as Anthropic.MessageStreamEvent;
}
function text(index: number, t: string): Anthropic.MessageStreamEvent {
  return { type: "content_block_delta", index, delta: { type: "text_delta", text: t } } as Anthropic.MessageStreamEvent;
}
function toolUse(index: number, name: string, json: string): Anthropic.MessageStreamEvent[] {
  return [
    { type: "content_block_start", index, content_block: { type: "tool_use", id: `t${index}`, name, input: {} } },
    { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json: json } },
    { type: "content_block_stop", index },
  ] as Anthropic.MessageStreamEvent[];
}
function end(stop: string, output: number): Anthropic.MessageStreamEvent {
  return { type: "message_delta", delta: { stop_reason: stop }, usage: { ...usage, output_tokens: output } } as unknown as Anthropic.MessageStreamEvent;
}

async function run(events: Anthropic.MessageStreamEvent[], req: Partial<ChatRequest> = {}) {
  const bodies: Anthropic.MessageStreamParams[] = [];
  const client = {
    messages: {
      async *stream(body: Anthropic.MessageStreamParams) {
        bodies.push(body);
        yield* events;
      },
    },
  };
  const out: LlmEvent[] = [];
  const full: ChatRequest = { model: "claude-haiku-5-5", messages: [{ role: "system", content: "regras" }, { role: "user", content: "oi" }], tools: [goTo], thinking: false, ...req };
  for await (const ev of streamAnthropic(full, client)) out.push(ev);
  return { out, body: bodies[0] };
}

describe("streamAnthropic", () => {
  it("texto vira text, e usage e done saem no fim", async () => {
    const { out } = await run([start(), text(0, "Oi, "), text(0, "tudo bem?"), end("end_turn", 12)]);
    expect(out).toEqual([
      { type: "text", text: "Oi, " },
      { type: "text", text: "tudo bem?" },
      { type: "usage", input: 800, output: 12, cacheRead: 700 },
      { type: "done", finishReason: "end_turn" },
    ]);
  });

  it("um bloco tool_use válido vira um tool_call", async () => {
    const { out } = await run([start(), ...toolUse(0, "go_to", '{"target":"moment:fraude"}'), end("tool_use", 20)]);
    expect(out.filter((e) => e.type === "tool_call")).toEqual([{ type: "tool_call", name: "go_to", args: { target: "moment:fraude" }, raw: '{"target":"moment:fraude"}' }]);
  });

  it("descarta ferramenta fora do esquema, JSON quebrado e ferramenta desconhecida", async () => {
    const { out } = await run([
      start(),
      ...toolUse(0, "go_to", '{"target":"moment:inventado"}'),
      ...toolUse(1, "go_to", '{"target":"moment:fr'),
      ...toolUse(2, "apaga_tudo", "{}"),
      end("tool_use", 20),
    ]);
    expect(out.map((e) => e.type)).toEqual(["usage", "done"]);
  });

  it("system vai para o campo system com cache, a conversa começa com user e o raciocínio fica desligado", async () => {
    const { body } = await run([start(), end("end_turn", 1)], {
      messages: [{ role: "system", content: "regras" }, { role: "assistant", content: "olá" }, { role: "user", content: "oi" }],
    });
    expect(body.system).toEqual([{ type: "text", text: "regras", cache_control: { type: "ephemeral", ttl: "1h" } }]);
    expect(body.messages).toEqual([{ role: "user", content: "oi" }]);
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.output_config).toEqual({ effort: "low" });
    expect(body.tools?.[0]).toMatchObject({ name: "go_to", input_schema: goTo.function.parameters });
  });

  it("a conversa até a penúltima mensagem entra no cache; a última, que muda a cada turno, não", async () => {
    const { body } = await run([start(), end("end_turn", 1)], {
      messages: [{ role: "system", content: "regras" }, { role: "user", content: "oi" }, { role: "assistant", content: "olá" }, { role: "user", content: "e agora?" }],
    });
    expect(body.messages).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: [{ type: "text", text: "olá", cache_control: { type: "ephemeral" } }] },
      { role: "user", content: "e agora?" },
    ]);
  });

  it("system depois de uma fala fica na conversa, e a fala inteira entra no cache", async () => {
    const { body } = await run([start(), end("end_turn", 1)], {
      messages: [{ role: "system", content: "regras" }, { role: "user", content: "e o home office?" }, { role: "system", content: "Turno: fala." }],
    });
    expect(body.system).toHaveLength(1);
    expect(body.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "e o home office?", cache_control: { type: "ephemeral" } }] },
      { role: "system", content: "Turno: fala." },
    ]);
  });

  it("modelo que não aceita desligar o raciocínio não recebe disabled", async () => {
    const msg = [start(), end("end_turn", 1)];
    expect((await run(msg, { model: "claude-sonnet-5-5" })).body.thinking).toEqual({ type: "between_tools" });
    expect((await run(msg, { model: "claude-opus-5-5" })).body.thinking).toBeUndefined();
  });
});
