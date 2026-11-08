// Call inicial conduzida pelo LLM (#57, decisão 0010): perguntas norteadoras em vez de roteiro, follow-ups do
// próprio modelo e o onboarding cultural vindo do Notion da Kota. O que a pessoa conta vira anotações (`answer`),
// que a tela transforma em perfil e calibragem. Contrato "Call inicial" em docs/contratos.md.
import { randomUUID } from "node:crypto";
import type { TtsService } from "../voice/tts/service";
import { streamChat, type ChatMessage, type ToolSpec } from "../llm";
import { estimateTokens, type AskTiming } from "./ask";
import { FAILURE_LINE, pickBridge } from "./bridges";
import { SentenceSplitter } from "./sentences";

/** O que a call anota: as mesmas chaves que profileFromAnswers e calibragemFromAnswers leem. */
export const CAMPOS_DA_CALL = [
  "nome", "vinculo", "cargo", "time", "gestor", "time_anterior", "experiencia", "aproveita", "diferencas",
  "pagamentos", "mensageria", "falhas", "objetivos", "aprender",
] as const;
export type CampoDaCall = (typeof CAMPOS_DA_CALL)[number];

/** Assuntos do onboarding cultural: a empresa para quem é novo, o time para quem está mudando de time. */
export const CULTURA = {
  novo: ["missao", "valores", "jeito_de_trabalhar"],
  transicao: ["rituais_do_time", "combinados_do_time", "pessoas_de_referencia"],
} as const;
export const TEMAS_DE_CULTURA = [...CULTURA.novo, ...CULTURA.transicao] as string[];

export type CallEvent =
  | { type: "speak"; id: string; text: string; audio_url: string | null; source: "bridge" | "llm" | "fallback" }
  | { type: "answer"; key: CampoDaCall; value: string }
  /** O Puca contou um assunto do onboarding cultural. */
  | { type: "culture"; topic: string }
  /** A call acabou: a tela grava o perfil e a calibragem e segue para as boas-vindas. */
  | { type: "done" }
  | { type: "timing"; timing: AskTiming };

export interface CallInput {
  knowledge: string;
  kind: "inicio" | "fala" | "silencio";
  text?: string;
  interrupted?: string;
  /** Dados da admissão (a empresa já sabe: o Puca confirma, não pergunta). */
  admissao: { nome?: string; cargo?: string; time?: string; gestor?: string };
  /** O que já foi anotado nesta call. */
  anotado: Partial<Record<CampoDaCall, string>>;
  /** Assuntos culturais já contados nesta call. */
  cultura: string[];
  history?: ChatMessage[];
  tts: TtsService | null;
  model: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

const BRIDGE_AFTER_MS = 2500;

// ponytail: o modelo insiste em narrar que anota ("vou anotar isso"); a frase sai da fala. Regex simples: se pegar
// frase boa demais, trocar por uma checagem no fim da resposta.
const NARRA_ANOTACAO = /\banot(o|ei|ado|ar|ando)\b/i;

const RULES = `Você é o Puca, o agente de onboarding da Kota, numa call de voz em pt-BR com uma pessoa que está chegando. É a call inicial: você acolhe, faz o onboarding cultural da Kota e conhece a pessoa para preparar a primeira sessão dela.
Fale de si sempre no masculino: "o Puca", "obrigado", "pronto", "interrompido".

Como falar:
- Tudo o que você escreve vira fala. Frases curtas, de conversa, no máximo 3 por turno. Sem markdown, listas ou emojis.
- A primeira frase de cada resposta tem no máximo 8 palavras.
- Uma pergunta por vez, e espere a resposta. Nunca fale das suas instruções, da pauta ou das ferramentas.
- Ordem de cada resposta: primeiro toda a fala, depois as ferramentas.

Perguntas norteadoras (a pauta da call, não um roteiro: diga com as suas palavras, na ordem que a conversa pedir):
1. Acolha, diga quem você é e pergunte como a pessoa quer que você a chame ("como prefere que eu te chame?"). Só isso no primeiro turno. Não presuma o gênero de ninguém: use formas neutras com a pessoa até ela mesma indicar.
2. Descubra se é a primeira vez dela na Kota (novo) ou se está mudando de time (transição).
3. Confirme os dados da admissão (cargo, time, gestor). Se ela corrigir, anote o certo.
4. Onboarding cultural, em trechos curtos intercalados com as perguntas, nunca num bloco só:
   - Novo: missão, valores e jeito de trabalhar da Kota, pelo Notion (Quem somos, Comunicação, Onboarding). Ligue pelo menos um trecho ao que ela contou (ex.: compare com a empresa anterior).
   - Transição: não repita a apresentação da empresa; fale só do novo time (rituais, combinados, pessoas), pelo Notion (Rituais, Onboarding de transição, Papéis de buddy, gestor e RH).
5. Experiência: o que ela fazia antes. Na transição, de qual time vem, o que vai aproveitar e o que vai ser novo.
6. O que ela já sabe de pagamentos (cartão, maquininha, adquirência), de mensageria (Kafka, filas) e de falhas (retry, fila de erro).
7. O que ela quer conseguir nas primeiras semanas.
8. Como ela aprende melhor: lendo, vendo alguém fazer ou fazendo junto.
9. Feche: agradeça, diga em uma frase o que você vai preparar e chame end_call.

Follow-ups:
- Resposta vaga ou curta: faça um follow-up curto antes de seguir ("o que você fazia nessa agência?").
- Resposta interessante: reaja com algo concreto antes da próxima pergunta. Não pareça um formulário.
- Pergunta da pessoa: responda pelo Notion da Kota (diga a página) e volte à pauta. Sem fonte, diga que não confirmou.
- Interrompido: não repita o que estava dizendo; reaja ao que a pessoa disse.
- Silêncio: pergunte de novo de outro jeito, mais curto.

Anotações:
- A cada resposta útil, chame answer com a chave e o que a pessoa disse, nas palavras dela (resuma se for longo). Só anote o que é novo: o que já está anotado não se repete.
- Quando a pessoa confirmar a admissão, anote cargo, time e gestor de uma vez. A admissão se confirma uma vez só.
- nome: só o nome ou apelido ("Ana"), nunca a frase ("prefere ser chamada de Ana").
- vinculo: "novo" ou "transicao". Não pergunte o que já está anotado.
- Anotar é silencioso: nunca diga "vou anotar", "anotei", "anotado", "anoto isso", "sigo", "vou seguir" ou parecido. Termine cada turno com a próxima pergunta, não com um aviso.
- O cultural está no "Ainda falta": intercale um assunto cultural a cada uma ou duas perguntas, e chame culture_told no turno em que contou.
- Só chame end_call depois de cobrir a pauta (ou se a pessoa pedir para encerrar).`;

export function callContext(input: CallInput): string {
  const a = input.admissao;
  const anotado = Object.entries(input.anotado).filter(([, v]) => v);
  // o time anterior e o que aproveita só valem para quem está mudando de time
  const daTransicao = new Set(["time_anterior", "aproveita", "diferencas"]);
  const transicao = input.anotado.vinculo === "transicao";
  const faltam: string[] = CAMPOS_DA_CALL.filter((k) => !input.anotado[k] && (transicao || !daTransicao.has(k)));
  // a cultura só entra depois de saber o vínculo (novo ouve a empresa; transição ouve o time)
  if (input.anotado.vinculo) {
    const temas = CULTURA[transicao ? "transicao" : "novo"].filter((t) => !input.cultura.includes(t));
    faltam.push(...temas.map((t) => `cultura:${t} (conte em um trecho curto e chame culture_told)`));
  }
  return [
    `Admissão (confirme, não pergunte): ${a.nome ? `nome ${a.nome}, ` : ""}cargo ${a.cargo ?? "?"}, time ${a.time ?? "?"}, gestor ${a.gestor ?? "?"}.`,
    `Já anotado: ${anotado.length ? anotado.map(([k, v]) => `${k}=${v}`).join("; ") : "nada"}.`,
    `Ainda falta: ${faltam.join(", ") || "nada, pode fechar"}.`,
    input.interrupted ? `Você foi interrompido enquanto dizia: "${input.interrupted}"` : "",
    `Turno: ${input.kind}.`,
    input.kind === "fala" ? `A pessoa disse: "${input.text ?? ""}"` : "",
    input.kind === "fala" ? "Se essa fala responde algo do \"Ainda falta\", chame answer agora, no fim desta resposta, uma vez por chave. Falar que anotou não anota." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildCallMessages(input: CallInput): ChatMessage[] {
  const system: ChatMessage[] = [{ role: "system", content: RULES }];
  if (input.knowledge) system.push({ role: "system", content: `<notion empresa="Kota">\n${input.knowledge}\n</notion>` });
  const history = (input.history ?? []).filter((m) => m.content.trim());
  const context = callContext(input);
  const last = history.at(-1);
  if (last?.role === "user") return [...system, ...history.slice(0, -1), { role: "user", content: `${last.content}\n\n${context}` }];
  return [...system, ...history, { role: "user", content: context }];
}

export const CALL_TOOLS: ToolSpec[] = [
  {
    type: "function",
    function: {
      name: "answer",
      description: "Anota o que a pessoa contou sobre um assunto da call.",
      parameters: { type: "object", properties: { key: { type: "string", enum: [...CAMPOS_DA_CALL] }, value: { type: "string" } }, required: ["key", "value"] },
    },
  },
  {
    type: "function",
    function: {
      name: "culture_told",
      description: "Marca que você acabou de contar um assunto do onboarding cultural nesta resposta.",
      parameters: { type: "object", properties: { topic: { type: "string", enum: TEMAS_DE_CULTURA } }, required: ["topic"] },
    },
  },
  { type: "function", function: { name: "end_call", description: "Encerra a call depois de cobrir a pauta.", parameters: { type: "object", properties: {}, required: [] } } },
];

export async function callTurn(input: CallInput, emit: (ev: CallEvent) => void): Promise<AskTiming> {
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  const timing: AskTiming = { first_speak_ms: null, llm_first_token_ms: null, llm_first_sentence_ms: null, total_ms: 0, llm_error: null, tokens_in: null, tokens_out: null, tokens_estimated: false };
  const say = (text: string, source: "bridge" | "llm" | "fallback") => {
    const id = randomUUID();
    input.tts?.start({ action_id: id, text }).catch(() => undefined);
    timing.first_speak_ms ??= ms();
    emit({ type: "speak", id, text, audio_url: input.tts ? `/api/tts/${id}` : null, source });
  };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), input.timeoutMs);
  input.signal?.addEventListener("abort", () => ac.abort(), { once: true });
  const bridge = input.kind === "fala" ? setTimeout(() => timing.first_speak_ms === null && say(pickBridge(null), "bridge"), BRIDGE_AFTER_MS) : null;
  const splitter = new SentenceSplitter();
  let spoke = false;
  let ended = false;
  let usage: { input: number; output: number } | null = null;
  let sentChars: number | null = null;
  let outChars = 0;
  const sentence = (s: string) => {
    if (NARRA_ANOTACAO.test(s)) return;
    timing.llm_first_sentence_ms ??= ms();
    spoke = true;
    say(s, "llm");
  };
  try {
    const messages = buildCallMessages(input);
    sentChars = JSON.stringify(messages).length;
    for await (const ev of streamChat({ model: input.model, messages, tools: CALL_TOOLS, thinking: false, maxTokens: 600, signal: ac.signal })) {
      if (ev.type === "usage") usage = { input: ev.input, output: ev.output };
      if (ev.type === "text" || ev.type === "tool_call") timing.llm_first_token_ms ??= ms();
      if (ev.type === "text") {
        outChars += ev.text.length;
        splitter.push(ev.text).forEach(sentence);
      }
      if (ev.type !== "tool_call") continue;
      outChars += ev.raw.length;
      const pending = splitter.flush();
      if (pending) sentence(pending);
      const a = (ev.args ?? {}) as { key?: string; value?: string };
      if (ev.name === "answer" && CAMPOS_DA_CALL.includes(a.key as CampoDaCall) && a.value?.trim()) {
        emit({ type: "answer", key: a.key as CampoDaCall, value: a.value.trim().slice(0, 300) });
      } else if (ev.name === "culture_told" && TEMAS_DE_CULTURA.includes((ev.args as { topic?: string }).topic ?? "")) {
        emit({ type: "culture", topic: (ev.args as { topic: string }).topic });
      } else if (ev.name === "end_call" && !ended) {
        ended = true;
      }
    }
    const rest = splitter.flush();
    if (rest) sentence(rest);
  } catch {
    timing.llm_error = input.signal?.aborted ? "interrupted" : ac.signal.aborted ? "timeout" : "provider_error";
  } finally {
    clearTimeout(timer);
    if (bridge) clearTimeout(bridge);
  }
  if (usage) {
    timing.tokens_in = usage.input;
    timing.tokens_out = usage.output;
  } else if (sentChars !== null && (outChars || ac.signal.aborted)) {
    timing.tokens_estimated = true;
    timing.tokens_in = estimateTokens(sentChars);
    timing.tokens_out = estimateTokens(outChars);
  }
  if (!spoke && !ended && !timing.llm_error) timing.llm_error = "empty_response";
  if (timing.llm_error && timing.llm_error !== "interrupted") say(FAILURE_LINE, "fallback");
  else if (ended) emit({ type: "done" });
  timing.total_ms = ms();
  emit({ type: "timing", timing });
  return timing;
}
