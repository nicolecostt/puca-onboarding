// Cliente OpenAI-compatível (Featherless) com streaming. Sem SDK: fetch + SSE.
// Emite texto, raciocínio (quando o modelo vaza "thinking") e tool calls já montados.

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  maxTokens?: number;
  temperature?: number;
  /** false manda `chat_template_kwargs.enable_thinking=false` (Qwen3). */
  thinking?: boolean;
  signal?: AbortSignal;
}

export type LlmEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool_call"; name: string; args: unknown; raw: string }
  /** Tokens que o provedor informou no fim do stream (no máximo um, antes do `done`). */
  | { type: "usage"; input: number; output: number }
  | { type: "done"; finishReason: string | null };

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export async function* streamChat(req: ChatRequest, apiKey = process.env.FEATHERLESS_API_KEY): AsyncGenerator<LlmEvent> {
  const BASE_URL = process.env.FEATHERLESS_BASE_URL ?? "https://api.featherless.ai/v1";
  if (!apiKey) throw new LlmError("FEATHERLESS_API_KEY is not set", "config");
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream: true,
    // o provedor manda os tokens num chunk final, sem choices
    stream_options: { include_usage: true },
    max_tokens: req.maxTokens ?? 300,
    temperature: req.temperature ?? 0.4,
  };
  if (req.tools?.length) body.tools = req.tools;
  if (req.thinking === false) body.chat_template_kwargs = { enable_thinking: false };

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: req.signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let code = `http_${res.status}`;
    try {
      code = JSON.parse(text)?.error?.code ?? code;
    } catch {}
    throw new LlmError(text.slice(0, 300) || res.statusText, code, res.status);
  }

  // Tool calls chegam fatiados por índice; montamos e emitimos no fim.
  const calls = new Map<number, { name: string; args: string }>();
  let finishReason: string | null = null;
  let usage: { input: number; output: number } | null = null;
  const decoder = new TextDecoder();
  let buf = "";

  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let json: any;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      if (json.error) throw new LlmError(json.error.message ?? "stream error", json.error.code ?? "stream");
      if (typeof json.usage?.prompt_tokens === "number" && typeof json.usage?.completion_tokens === "number") {
        usage = { input: json.usage.prompt_tokens, output: json.usage.completion_tokens };
      }
      const choice = json.choices?.[0];
      if (!choice) continue;
      const d = choice.delta ?? {};
      const reasoning = d.reasoning_content ?? d.reasoning;
      if (reasoning) yield { type: "reasoning", text: reasoning };
      if (d.content) yield { type: "text", text: d.content };
      for (const tc of d.tool_calls ?? []) {
        const cur = calls.get(tc.index ?? 0) ?? { name: "", args: "" };
        if (tc.function?.name) cur.name += tc.function.name;
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        calls.set(tc.index ?? 0, cur);
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }

  for (const { name, args } of calls.values()) {
    let parsed: unknown = null;
    try {
      parsed = args ? JSON.parse(args) : {};
    } catch {}
    yield { type: "tool_call", name, args: parsed, raw: args };
  }
  if (usage) yield { type: "usage", ...usage };
  yield { type: "done", finishReason };
}
