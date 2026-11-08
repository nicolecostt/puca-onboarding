// Cliente do LLM: o pedido em streaming e a leitura do SSE, com o fetch simulado.
import { afterEach, describe, expect, it, vi } from "vitest";
import { streamChat, type LlmEvent } from "./llm";

/** Resposta SSE montada à mão: cada item vira uma linha `data:`. */
function sse(chunks: unknown[]): Response {
  const body = [...chunks.map((c) => `data: ${typeof c === "string" ? c : JSON.stringify(c)}\n\n`)].join("");
  return new Response(new TextEncoder().encode(body), { status: 200 });
}

function stubFetch(chunks: unknown[]) {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => sse(chunks));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function collect(): Promise<LlmEvent[]> {
  const out: LlmEvent[] = [];
  for await (const ev of streamChat({ model: "m", messages: [{ role: "user", content: "oi" }] }, "chave-de-teste")) out.push(ev);
  return out;
}

afterEach(() => vi.unstubAllGlobals());

describe("streamChat: tokens", () => {
  it("pede o usage no stream", async () => {
    const fetch = stubFetch(["[DONE]"]);
    await collect();
    const body = JSON.parse(String(fetch.mock.calls[0][1].body));
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it("emite usage do chunk final, mesmo sem choices", async () => {
    stubFetch([
      { choices: [{ delta: { content: "Oi" } }] },
      { choices: [], usage: { prompt_tokens: 812, completion_tokens: 41 } },
      "[DONE]",
    ]);
    expect(await collect()).toEqual([
      { type: "text", text: "Oi" },
      { type: "usage", input: 812, output: 41 },
      { type: "done", finishReason: null },
    ]);
  });

  it("sem usage, não emite usage", async () => {
    stubFetch([{ choices: [{ delta: { content: "Oi" }, finish_reason: "stop" }] }, "[DONE]"]);
    expect((await collect()).map((e) => e.type)).toEqual(["text", "done"]);
  });
});
