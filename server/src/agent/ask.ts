// Pergunta que a tela não resolveu sozinha (fora das respostas sugeridas, do conhecimento e do FAQ).
// Sem estado: a tela manda momento, passo, perfil e o histórico curto. A primeira coisa que sai é
// uma fala-ponte (áudio em cache); o LLM responde atrás dela, frase a frase.
import { randomUUID } from "node:crypto";
import { detectIntent } from "../../../src/journey/conditions";
import type { BoardAction, Journey, Profile } from "../../../src/journey/types";
import type { TtsService } from "../voice/tts/service";
import { streamChat, type ChatMessage } from "../llm";
import { FALLBACK_LINE, pickBridge } from "./bridges";
import { buildMessages, buildTools, visibleNodes } from "./prompt";
import { SentenceSplitter } from "./sentences";

export type SpeakSource = "bridge" | "llm" | "fallback";

export type AskEvent =
  | { type: "speak"; id: string; text: string; audio_url: string | null; source: SpeakSource }
  | { type: "action"; action: BoardAction }
  /** A pessoa pediu outro ponto da aula: "moment:<id>" ou "step:<id>" (transições do passo atual). */
  | { type: "go_to"; target: string }
  | { type: "timing"; timing: AskTiming };

export interface AskTiming {
  /** Do pedido até o primeiro `speak` (a ponte). */
  first_speak_ms: number | null;
  llm_first_token_ms: number | null;
  llm_first_sentence_ms: number | null;
  total_ms: number;
  llm_error: string | null;
}

export interface AskInput {
  journey: Journey;
  profile: Profile;
  momentId: string;
  stepId: string;
  text: string;
  history?: ChatMessage[];
  tts: TtsService | null;
  model: string;
  timeoutMs: number;
  /** Abortado quando a pessoa interrompe (o cliente fecha a conexão). */
  signal?: AbortSignal;
}

export async function ask(input: AskInput, emit: (ev: AskEvent) => void): Promise<AskTiming> {
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  const timing: AskTiming = { first_speak_ms: null, llm_first_token_ms: null, llm_first_sentence_ms: null, total_ms: 0, llm_error: null };
  const say = (text: string, source: SpeakSource) => {
    const id = randomUUID();
    input.tts?.start({ action_id: id, text }).catch(() => undefined);
    timing.first_speak_ms ??= ms();
    emit({ type: "speak", id, text, audio_url: input.tts ? `/api/tts/${id}` : null, source });
  };

  say(pickBridge(detectIntent(input.text)), "bridge");

  const ctx = { journey: input.journey, profile: input.profile, momentId: input.momentId, stepId: input.stepId, history: input.history };
  const ids = new Set(visibleNodes(ctx).map((n) => n.id));
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), input.timeoutMs);
  input.signal?.addEventListener("abort", () => ac.abort(), { once: true });
  const splitter = new SentenceSplitter();
  let spoke = false;
  let wentTo = false;
  const sentence = (s: string) => {
    timing.llm_first_sentence_ms ??= ms();
    spoke = true;
    say(s, "llm");
  };

  try {
    for await (const ev of streamChat({ model: input.model, messages: buildMessages(ctx, input.text), tools: buildTools(ctx), thinking: false, maxTokens: 250, signal: ac.signal })) {
      if (ev.type === "text" || ev.type === "tool_call") timing.llm_first_token_ms ??= ms();
      if (ev.type === "text") splitter.push(ev.text).forEach(sentence);
      if (ev.type !== "tool_call") continue;
      const a = ev.args as { targets?: string[]; target?: string } | null;
      if (ev.name === "highlight" && Array.isArray(a?.targets)) {
        const targets = a.targets.filter((t) => ids.has(t));
        if (targets.length) emit({ type: "action", action: { type: "highlight", targets, tone: "focus" } });
      } else if (ev.name === "open_card" && a?.target && ids.has(a.target)) {
        emit({ type: "action", action: { type: "card", target: a.target } });
      } else if (ev.name === "go_to" && typeof a?.target === "string") {
        wentTo = true;
        emit({ type: "go_to", target: a.target });
      }
    }
    const rest = splitter.flush();
    if (rest) sentence(rest);
  } catch (e) {
    timing.llm_error = ac.signal.aborted ? "timeout_or_cancel" : ((e as { code?: string }).code ?? String(e).slice(0, 80));
  } finally {
    clearTimeout(timer);
  }
  if (!spoke && !wentTo && !input.signal?.aborted) say(FALLBACK_LINE, "fallback");
  timing.total_ms = ms();
  emit({ type: "timing", timing });
  return timing;
}
