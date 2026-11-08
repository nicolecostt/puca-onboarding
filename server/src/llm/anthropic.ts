// Cliente do Claude (SDK oficial da Anthropic) que emite os mesmos LlmEvent do cliente da Featherless.
// Decisão 0007 e docs/stack.md §7.2.
import Anthropic from "@anthropic-ai/sdk";
import { LlmError, type ChatRequest, type LlmEvent } from "../llm";

/** O que o cliente usa do SDK; o teste troca por um stream falso. */
export interface AnthropicLike {
  messages: { stream(body: Anthropic.MessageStreamParams, options?: { signal?: AbortSignal }): AsyncIterable<Anthropic.MessageStreamEvent> };
}

let shared: Anthropic | null = null;

export async function* streamAnthropic(req: ChatRequest, client: AnthropicLike = (shared ??= new Anthropic())): AsyncGenerator<LlmEvent> {
  const system: Anthropic.TextBlockParam[] = req.messages.filter((m) => m.role === "system" && m.content).map((m) => ({ type: "text", text: m.content }));
  // tools e system vêm antes das mensagens no cache: a marca no fim do system cobre os dois
  if (system.length) system[system.length - 1].cache_control = { type: "ephemeral" };
  const messages: Anthropic.MessageParam[] = req.messages
    .filter((m) => m.role !== "system" && m.content)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  while (messages[0]?.role === "assistant") messages.shift();

  const schemas = new Map((req.tools ?? []).map((t) => [t.function.name, t.function.parameters]));
  const tools: Anthropic.Tool[] = (req.tools ?? []).map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
    eager_input_streaming: true,
  }));

  const body: Anthropic.MessageStreamParams = {
    model: req.model,
    // 250 (o que o ask pede ao Qwen) pode cortar o JSON de uma ferramenta no meio
    max_tokens: 1024,
    output_config: { effort: "medium" },
    system,
    messages,
  };
  if (req.thinking === false) body.thinking = { type: "disabled" };
  if (tools.length) body.tools = tools;

  const blocks = new Map<number, { name: string; json: string }>();
  let usage = null as { input: number; output: number; cacheRead: number } | null;
  let finishReason: string | null = null;
  try {
    for await (const ev of client.messages.stream(body, { signal: req.signal })) {
      if (ev.type === "message_start") {
        const u = ev.message.usage;
        usage = { input: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0), output: u.output_tokens, cacheRead: u.cache_read_input_tokens ?? 0 };
      } else if (ev.type === "message_delta") {
        finishReason = ev.delta.stop_reason ?? finishReason;
        const u = ev.usage;
        usage = {
          input: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) || (usage?.input ?? 0),
          output: u.output_tokens,
          cacheRead: u.cache_read_input_tokens ?? usage?.cacheRead ?? 0,
        };
      } else if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") {
        blocks.set(ev.index, { name: ev.content_block.name, json: "" });
      } else if (ev.type === "content_block_delta") {
        if (ev.delta.type === "text_delta") yield { type: "text", text: ev.delta.text };
        else if (ev.delta.type === "input_json_delta") {
          const b = blocks.get(ev.index);
          if (b) b.json += ev.delta.partial_json;
        }
      } else if (ev.type === "content_block_stop") {
        const b = blocks.get(ev.index);
        if (!b) continue;
        blocks.delete(ev.index);
        let args: unknown;
        try {
          args = b.json ? JSON.parse(b.json) : {};
        } catch {
          continue;
        }
        // com eager_input_streaming a API não valida a entrada: ferramenta fora do esquema é descartada
        const schema = schemas.get(b.name);
        if (schema && matches(args, schema)) yield { type: "tool_call", name: b.name, args, raw: b.json };
      }
    }
  } catch (e) {
    throw toLlmError(e);
  }
  if (usage) yield { type: "usage", ...usage };
  yield { type: "done", finishReason };
}

function toLlmError(e: unknown): unknown {
  if (e instanceof Anthropic.APIUserAbortError) return e;
  if (e instanceof Anthropic.RateLimitError) return new LlmError(e.message, "rate_limit", e.status);
  if (e instanceof Anthropic.AuthenticationError) return new LlmError(e.message, "auth", e.status);
  if (e instanceof Anthropic.APIConnectionError) return new LlmError(e.message, "connection");
  if (e instanceof Anthropic.APIError) return new LlmError(e.message, e.status ? `http_${e.status}` : "api", e.status);
  return e;
}

/** O pedaço de JSON Schema que as ferramentas de buildTools usam: object, array, string, enum, required. */
export function matches(value: unknown, schema: Record<string, unknown>): boolean {
  const s = schema as { type?: string; enum?: unknown[]; properties?: Record<string, Record<string, unknown>>; required?: string[]; items?: Record<string, unknown> };
  if (s.enum && !s.enum.includes(value)) return false;
  if (s.type === "string") return typeof value === "string";
  if (s.type === "array") return Array.isArray(value) && (!s.items || value.every((v) => matches(v, s.items!)));
  if (s.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const o = value as Record<string, unknown>;
    if (s.required?.some((k) => !(k in o))) return false;
    return Object.entries(s.properties ?? {}).every(([k, sub]) => !(k in o) || matches(o[k], sub));
  }
  return true;
}
