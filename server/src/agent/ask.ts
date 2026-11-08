// Pergunta que a tela não resolveu sozinha (fora das respostas sugeridas, do conhecimento e do FAQ).
// Sem estado: a tela manda momento, passo, perfil e o histórico curto. A primeira coisa que sai é
// uma fala-ponte (áudio em cache); o LLM responde atrás dela, frase a frase.
import { randomUUID } from "node:crypto";
import { detectIntent } from "../../../src/journey/conditions";
import { looksLikeQuestion } from "../../../src/journey/forwarding";
import type { BoardAction, Journey, Profile } from "../../../src/journey/types";
import type { Brain, Trecho } from "../brain/brain";
import type { TtsService } from "../voice/tts/service";
import { streamChat, type ChatMessage } from "../llm";
import { FAILURE_LINE, pickBridge } from "./bridges";
import { buildMessages, buildTools, visibleNodes } from "./prompt";
import { SentenceSplitter } from "./sentences";

export type SpeakSource = "bridge" | "llm" | "fallback";
export type LlmFailure = "timeout" | "interrupted" | "provider_error" | "refusal" | "empty_response";

export type AskEvent =
  | { type: "speak"; id: string; text: string; audio_url: string | null; source: SpeakSource }
  | { type: "action"; action: BoardAction }
  /** A pessoa pediu outro ponto da sessão: "moment:<id>" ou "step:<id>" (transições do passo atual). */
  | { type: "go_to"; target: string }
  /** Sem fonte confiável: a tela encaminha a dúvida à buddy (no máximo um por pedido, antes do timing). */
  | { type: "escalate"; summary: string }
  /** Trechos do kit citados na resposta ([fN]), sem repetir; antes do timing. */
  | { type: "fontes"; fontes: { titulo: string; url: string }[] }
  | { type: "timing"; timing: AskTiming };

export interface AskTiming {
  /** Do pedido até o primeiro `speak` (a ponte). */
  first_speak_ms: number | null;
  llm_first_token_ms: number | null;
  llm_first_sentence_ms: number | null;
  total_ms: number;
  llm_error: LlmFailure | null;
  /** Tokens de entrada e de saída da chamada ao LLM (null quando nada foi consumido: o provedor recusou antes de responder). */
  tokens_in: number | null;
  tokens_out: number | null;
  /** true quando o provedor não informou e os tokens foram estimados (estimateTokens). */
  tokens_estimated: boolean;
}

/** Estimativa de tokens quando o provedor não informa: ~4 caracteres por token. */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
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
  /** Company brain: trechos do kit da Kota para a fala (server/src/brain). */
  brain?: Brain;
}

// Marca de citação do LLM ("... pelo CI [f1]."): sai do texto falado, com o espaço antes.
// Aceita [f1], [F1], [f1, f2], [f1][f2] (cada colchete é uma marca), e também [1], (f2), [fonte 3] e (fonte 3);
// o número é o do trecho (f1 = 1). Guarda todos os ids citados. Número solto só vale entre colchetes: "(3)" fica.
const REF = "(?:f(?:onte)?\\s*)?\\d+";
const CITACAO = new RegExp(
  `\\s*(?:\\[\\s*${REF}(?:\\s*,\\s*${REF})*\\s*\\]|\\(\\s*(?:f(?:onte)?\\s*)\\d+(?:\\s*,\\s*(?:f(?:onte)?\\s*)?\\d+)*\\s*\\))`,
  "gi",
);

// O LLM às vezes admite que não confirmou sem chamar escalate_to_buddy: vale como encaminhamento.
const NO_SOURCE = /não (consegui|consigo) confirmar|não (achei|tenho) (isso )?confirmad/i;

// Caso pessoal da pessoa ("qual vai ser o meu bônus?"): a regra geral vem do kit, mas o caso dela vai para a buddy.
// Se o LLM não encaminhou, o código encaminha (nunca em falha técnica).
const CASO_PESSOAL = /\b(meu|minha|meus|minhas)\s+(?:\S+\s+)?(bonus|salario|ferias|promocao|avaliacao|desempenho|aumento|plr)\b/;
export function isCasoPessoal(text: string): boolean {
  return CASO_PESSOAL.test(text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
}

// Marcas internas no resumo do encaminhamento (vai para a buddy): [f2], [f2][f3], (f2), (fonte 3), f2 e "f2, f3 e f4".
// Marca de citação (colchete ou parêntese) vira o título entre parênteses, ou some se o título já está no resumo;
// lista solta vira os títulos no próprio texto. Trecho que não existe some.
const REF_RESUMO = "(?:f(?:onte)?\\s*)?\\d+";
const SEP_RESUMO = "(?:\\s*,\\s*(?:(?:e|ou)\\s+)?|\\s+(?:e|ou)\\s+)";
const MARCA_RESUMO = new RegExp(
  `(\\s*)(?:\\[\\s*${REF_RESUMO}(?:(?:${SEP_RESUMO}|\\s*\\]\\s*\\[\\s*)${REF_RESUMO})*\\s*\\]` +
    `|\\(\\s*(?:f(?:onte)?\\s*)\\d+(?:${SEP_RESUMO}${REF_RESUMO})*\\s*\\))` +
    `|\\b(f(?:onte)?\\s*\\d+(?:${SEP_RESUMO}f(?:onte)?\\s*\\d+)*)\\b`,
  "gi",
);
export function limparResumo(resumo: string, trechos: Trecho[]): string {
  const ditos = new Set<string>();
  const titulos = (marca: string) => {
    const novos: string[] = [];
    for (const n of marca.match(/\d+/g) ?? []) {
      const t = trechos[Number(n) - 1]?.titulo;
      if (t && !novos.includes(t)) novos.push(t);
    }
    return novos;
  };
  const juntar = (ts: string[]) => (ts.length > 1 ? `${ts.slice(0, -1).join(", ")} e ${ts.at(-1)}` : ts.join(""));
  return resumo
    .replace(MARCA_RESUMO, (m, espaco: string | undefined, solta: string | undefined) => {
      if (solta !== undefined) {
        const ts = titulos(solta);
        ts.forEach((t) => ditos.add(t));
        return ts.length ? juntar(ts) : "";
      }
      const ts = titulos(m).filter((t) => !ditos.has(t));
      ts.forEach((t) => ditos.add(t));
      return ts.length ? `${espaco ?? ""}(${juntar(ts)})` : "";
    })
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function ask(input: AskInput, emit: (ev: AskEvent) => void): Promise<AskTiming> {
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  const timing: AskTiming = { first_speak_ms: null, llm_first_token_ms: null, llm_first_sentence_ms: null, total_ms: 0, llm_error: null, tokens_in: null, tokens_out: null, tokens_estimated: false };
  const say = (text: string, source: SpeakSource) => {
    const id = randomUUID();
    input.tts?.start({ action_id: id, text }).catch(() => undefined);
    timing.first_speak_ms ??= ms();
    emit({ type: "speak", id, text, audio_url: input.tts ? `/api/tts/${id}` : null, source });
  };

  say(pickBridge(detectIntent(input.text)), "bridge");

  const trechos = input.brain?.buscar(input.text, 5) ?? [];
  const ctx = { journey: input.journey, profile: input.profile, momentId: input.momentId, stepId: input.stepId, history: input.history, trechos };
  const citados = new Set<number>();
  const ids = new Set(visibleNodes(ctx).map((n) => n.id));
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), input.timeoutMs);
  input.signal?.addEventListener("abort", () => ac.abort(), { once: true });
  const splitter = new SentenceSplitter();
  let spoke = false;
  let wentTo = false;
  let escalationSummary: string | null = null;
  let saidNoSource = false;
  let refused = false;
  const escalate = (summary: string) => { escalationSummary ??= summary; };
  const sentence = (raw: string) => {
    const s = raw.replace(CITACAO, (m) => { for (const n of m.match(/\d+/g) ?? []) citados.add(Number(n)); return ""; }).trim();
    // frase vazia, ou que sobrou só com pontuação ("CI. [f1]." deixa "."), não é falada
    if (!/[\p{L}\p{N}]/u.test(s)) return;
    timing.llm_first_sentence_ms ??= ms();
    spoke = true;
    say(s, "llm");
    // só marca: se o LLM chamar escalate_to_buddy logo depois, vale o resumo dele
    if (NO_SOURCE.test(s)) saidNoSource = true;
  };

  // custo (#52): o que foi enviado e o que chegou, para estimar se o provedor não informar
  let sentChars: number | null = null;
  let outChars = 0;
  let reached = false;
  let usage: { input: number; output: number } | null = null;
  try {
    const messages = buildMessages(ctx, input.text);
    const tools = buildTools(ctx);
    sentChars = JSON.stringify(messages).length + JSON.stringify(tools).length;
    for await (const ev of streamChat({ model: input.model, messages, tools, thinking: false, maxTokens: 250, signal: ac.signal })) {
      reached = true;
      if (ev.type === "usage") usage = { input: ev.input, output: ev.output };
      if (ev.type === "text") outChars += ev.text.length;
      if (ev.type === "tool_call") outChars += ev.raw.length;
      if (ev.type === "text" || ev.type === "tool_call") timing.llm_first_token_ms ??= ms();
      if (ev.type === "text") splitter.push(ev.text).forEach(sentence);
      if (ev.type === "done" && ev.finishReason === "refusal") refused = true;
      if (ev.type !== "tool_call") continue;
      const a = ev.args as { targets?: string[]; target?: string } | null;
      if (ev.name === "highlight" && Array.isArray(a?.targets)) {
        const targets = a.targets.filter((t) => ids.has(t));
        if (targets.length) emit({ type: "action", action: { type: "highlight", targets, tone: "focus" } });
      } else if (ev.name === "open_card" && a?.target && ids.has(a.target)) {
        emit({ type: "action", action: { type: "card", target: a.target } });
      } else if (ev.name === "escalate_to_buddy") {
        const summary = (ev.args as { summary?: unknown } | null)?.summary;
        escalate(typeof summary === "string" && summary.trim() ? summary.trim() : input.text);
      } else if (ev.name === "go_to" && typeof a?.target === "string") {
        wentTo = true;
        emit({ type: "go_to", target: a.target });
      }
    }
    const rest = splitter.flush();
    if (rest) sentence(rest);
  } catch (e) {
    timing.llm_error = input.signal?.aborted ? "interrupted" : ac.signal.aborted ? "timeout" : "provider_error";
  } finally {
    clearTimeout(timer);
  }
  // o provedor recusou antes de responder (sem chave, 401, 429) ou o pedido nem foi montado: nada foi consumido.
  // Interrompido ou estourado o tempo, o pedido já saiu: estima.
  const consumed = usage || reached || (ac.signal.aborted && sentChars !== null);
  if (usage) {
    timing.tokens_in = usage.input;
    timing.tokens_out = usage.output;
  } else if (consumed) {
    timing.tokens_estimated = true;
    timing.tokens_in = estimateTokens(sentChars ?? 0);
    timing.tokens_out = estimateTokens(outChars);
  }
  if (refused) timing.llm_error = "refusal";
  if (input.signal?.aborted && !timing.llm_error) timing.llm_error = "interrupted";
  const empty = !spoke && !wentTo && !escalationSummary && !input.signal?.aborted && !timing.llm_error;
  if (empty) timing.llm_error = "empty_response";
  // as fontes saem antes do encaminhamento: a tela leva o que foi consultado junto com a dúvida
  const fontes = [...citados].sort((a, b) => a - b).map((n) => trechos[n - 1]).filter(Boolean)
    .map((t) => ({ titulo: t.titulo, url: t.url }))
    .filter((f, i, all) => all.findIndex((g) => g.titulo === f.titulo && g.url === f.url) === i);
  if (fontes.length) emit({ type: "fontes", fontes });
  // respondeu com trecho citado e não é caso pessoal: o escalate_to_buddy do modelo ("ela pode querer mais detalhes")
  // é ignorado, porque a Puca não avisou ninguém. "Não consegui confirmar" e caso pessoal continuam encaminhando.
  const pessoal = isCasoPessoal(input.text);
  const respondeuComFonte = fontes.length > 0 && !pessoal && !saidNoSource;
  const resumo = escalationSummary && !respondeuComFonte ? limparResumo(escalationSummary, trechos) || input.text : null;
  if (timing.llm_error && timing.llm_error !== "interrupted") {
    say(FAILURE_LINE, "fallback");
  } else if (!input.signal?.aborted && looksLikeQuestion(input.text)) {
    if (resumo) emit({ type: "escalate", summary: resumo });
    else if (saidNoSource || pessoal) emit({ type: "escalate", summary: input.text });
  }
  timing.total_ms = ms();
  emit({ type: "timing", timing });
  return timing;
}
