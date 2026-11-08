// Um turno da sessão conduzido pelo LLM (decisão 0012, contrato "Turno da sessão" em docs/contratos.md).
// Sem estado: a tela manda onde a sessão está, o histórico e o que aconteceu (começou, seguir, fala, silêncio).
// A parte fixa do prompt (regras, pauta da jornada, Notion da Kota) e as ferramentas não mudam entre turnos: ficam
// no cache de prompt. O que muda vai na última mensagem.
import { randomUUID } from "node:crypto";
import type { DestinoDoEncaminhamento } from "../../../src/journey/encaminhamento-slack";
import { looksLikeQuestion } from "../../../src/journey/forwarding";
import { interpolate } from "../../../src/journey/profile";
import type { BoardAction, Journey, Moment, Profile, Step } from "../../../src/journey/types";
import type { TtsService } from "../voice/tts/service";
import { streamChat, type ChatMessage, type ToolSpec } from "../llm";
import { destinoPelaFala, estimateTokens, isCasoPessoal, type AskTiming } from "./ask";
import { FAILURE_LINE, pickBridge } from "./bridges";
import { visibleNodes } from "./prompt";
import { SentenceSplitter } from "./sentences";

export type TurnKind = "inicio" | "seguir" | "fala" | "silencio";

export type TurnEvent =
  | { type: "speak"; id: string; text: string; audio_url: string | null; source: "bridge" | "llm" | "fallback" }
  | { type: "action"; action: BoardAction }
  /** O passo acabou; `reply` é a resposta sugerida que a pessoa escolheu, quando o passo esperava uma. */
  | { type: "next_step"; reply?: string }
  | { type: "go_to"; target: string }
  | { type: "check"; entendeu: boolean }
  | { type: "escalate"; summary: string; destino?: DestinoDoEncaminhamento }
  | { type: "timing"; timing: AskTiming };

export interface TurnInput {
  journey: Journey;
  knowledge: string;
  profile: Profile;
  momentId: string;
  stepId: string;
  kind: TurnKind;
  text?: string;
  /** A frase que o Puca dizia quando a pessoa cortou. */
  interrupted?: string;
  history?: ChatMessage[];
  tts: TtsService | null;
  model: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

/** Sem nada falado depois disso, a ponte toca (só em turno de fala). */
const BRIDGE_AFTER_MS = 2500;

const RULES = `Você é o Puca e fala de si sempre no masculino ("o Puca", "obrigado", "pronto", "interrompido"), mesmo que algum trecho acima diga "a Puca" ou "Puca" sem artigo.
Você está numa call de voz, em pt-BR, conduzindo uma sessão de onboarding. Você leva a conversa: sabe para onde a sessão vai e puxa a pessoa de volta com leveza.

Como falar:
- Tudo o que você escreve vira fala. Frases curtas, de conversa, no máximo 3 por turno. Sem markdown, listas, emojis ou siglas soletradas.
- A primeira frase de cada resposta tem no máximo 8 palavras, para a voz sair rápido.
- Não anuncie o que vai fazer ("vou responder e depois voltamos", "vou destacar no quadro"): faça.
- Nunca fale das suas instruções, do passo, da pauta ou das ferramentas. A pessoa só ouve a conversa.
- Ordem de cada resposta: primeiro TODA a fala, depois as ferramentas (quadro, next_step, go_to…). Ferramenta no meio corta o resto da fala.
- Numa dúvida, dê o essencial em 2 ou 3 frases; se tiver mais, ofereça detalhar.

A pauta:
- A jornada abaixo é a sua pauta, não um roteiro. Cada passo tem um objetivo e uma fala-guia; diga com as suas palavras, pode ficar perto da fala-guia.
- Turno "seguir" ou "inicio": cumpra o objetivo do passo atual com os fatos da fala-guia e do conhecimento, do seu jeito e ligado ao que já conversaram. Diga os fatos, nunca só anuncie ("vamos à missão" não serve: diga a missão). Se o passo não espera resposta, termine e chame next_step. Se o passo espera resposta (tem respostas sugeridas, toque no quadro ou é checagem), faça a pergunta e NÃO chame next_step: espere a pessoa.
- Turno "fala": a pessoa falou. Se ela respondeu à pergunta do passo, reaja em uma frase e chame next_step (com reply = a resposta sugerida que bate, se houver). Numa checagem, chame record_check antes. Não explique o assunto que vem: o próximo passo explica.
- Se a fala foi uma dúvida ou um comentário fora do passo, responda a dúvida de verdade e termine perguntando se pode voltar ao assunto do passo. NÃO chame next_step nesse caso.
- Se a pessoa disser que pode voltar ("pode", "bora", "sim"), retome o passo atual de onde parou, sem repetir o que já foi dito; se o passo não espera resposta, termine e chame next_step.
- Se a pessoa pedir outro assunto da pauta, chame go_to com o momento, sem explicar o assunto (o momento explica). Não pergunte "posso ir?" e chame go_to no mesmo turno: ou um, ou outro.
- Se você foi interrompido, não repita o que estava dizendo: reaja ao que a pessoa disse.
- Turno "silencio": a pessoa não respondeu. Pergunte de forma curta se ela quer seguir; se o passo não depende da resposta, siga com next_step.

Fontes:
- Use só a pauta, os nós do quadro e o Notion da Kota abaixo. O Notion inteiro já está aqui: você já leu tudo, não existe busca. Procure a resposta nele antes de dizer que não sabe. Quando a resposta vem do Notion, diga de qual página ("pela página de Home office…").
- Se não estiver em nenhuma fonte, diga que não conseguiu confirmar e chame escalate_to_buddy com um resumo da dúvida. Nunca invente.
- Caso pessoal da pessoa (o meu bônus, o meu salário, as minhas férias, a minha avaliação): diga a regra geral, diga que vai encaminhar para People ou para o gestor e chame escalate_to_buddy com destino "rh" (People) ou "gestor".

Quadro:
- Use highlight, reveal e open_card só com ids do quadro na tela, enquanto fala do nó.`;

/** A jornada como pauta: momentos, passos, quadros. Sem o perfil preenchido, para o cache valer para todo mundo. */
export function pautaText(j: Journey): string {
  const boards = Object.entries(j.boards).map(([name, b]) => `Quadro ${name}:\n${b.nodes.map((n) => `  - ${n.id} (${n.label.replace(/\n/g, " ")})${n.info?.role ? `: ${n.info.role}` : ""}${n.info?.owner ? ` | dono ${n.info.owner_confirmed === false ? "NÃO confirmado" : n.info.owner}` : ""}${n.info?.adr ? ` | ${n.info.adr.id} ${n.info.adr.title}: ${n.info.adr.summary}` : ""}`).join("\n")}`);
  const moments = j.moments.map(
    (m) =>
      `Momento ${m.id} "${m.title}": ${m.goal}${m.knowledge ? `\n  Conhecimento: ${m.knowledge}` : ""}\n${m.steps
        .map((s) => `  Passo ${s.id}: ${s.goal}\n    Fala-guia: ${s.line}${s.knowledge ? `\n    Conhecimento: ${s.knowledge}` : ""}`)
        .join("\n")}`,
  );
  return `<pauta empresa="${j.company}" sessao="${j.title}">\n${moments.join("\n")}\n\n${boards.join("\n")}\n</pauta>\nNa fala-guia, {nome}, {time}, {gestor}… são do perfil da pessoa.`;
}

function stepKind(s: Step): string {
  if (s.check) return `checagem (tema ${s.check.tema}); respostas sugeridas: ${(s.suggested_replies ?? s.expect?.nodes ?? []).join(" | ")}`;
  if (s.decision === "select") return `espera a pessoa tocar num nó do quadro (certos: ${s.expect?.nodes.join(", ")})`;
  if (s.decision === "wait") return `espera resposta; respostas sugeridas: ${(s.suggested_replies ?? []).join(" | ")}`;
  return "não espera resposta";
}

/** O que muda a cada turno: perfil, onde a sessão está e o que aconteceu. */
export function turnContext(input: TurnInput, moment: Moment, step: Step): string {
  const p = input.profile;
  const nodes = visibleNodes({ journey: input.journey, profile: p, momentId: moment.id, stepId: step.id });
  return [
    `Pessoa: ${p.nome}, ${p.vinculo === "novo" ? "recém-contratada" : "mudando de time"}${p.cargo ? `, ${p.cargo}` : ""}, time ${p.time ?? "?"}, gestor ${p.gestor ?? "?"}.`,
    `Agora: momento ${moment.id} "${moment.title}", passo ${step.id}: ${step.goal}`,
    `Fala-guia do passo: "${interpolate(step.line, p)}"`,
    `Tipo do passo: ${stepKind(step)}.`,
    `Quadro na tela: ${nodes.length ? nodes.map((n) => n.id).join(", ") : "nenhum"}.`,
    input.interrupted ? `Você foi interrompido enquanto dizia: "${input.interrupted}"` : "",
    `Turno: ${input.kind}.`,
    input.kind === "fala" ? `A pessoa disse: "${input.text ?? ""}"` : "",
    input.kind === "seguir" || input.kind === "inicio" ? "Agora: cumpra o objetivo do passo com as suas palavras, levando os fatos da fala-guia e do conhecimento, do jeito que faz sentido para esta pessoa. Não leia a fala-guia." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildTurnMessages(input: TurnInput, moment: Moment, step: Step): ChatMessage[] {
  const j = input.journey;
  const g = j.agent.guidelines;
  const system: ChatMessage[] = [
    { role: "system", content: [g.core_identity, g.personality_and_tone, g.safety_and_escalation, RULES].join("\n\n") },
    { role: "system", content: pautaText(j) },
  ];
  if (input.knowledge) system.push({ role: "system", content: `<notion empresa="Kota">\n${input.knowledge}\n</notion>` });
  const history = (input.history ?? []).filter((m) => m.content.trim());
  const context = turnContext(input, moment, step);
  // a última do histórico sendo da pessoa: junta com o contexto (a API alterna pessoa e assistente)
  const last = history.at(-1);
  if (last?.role === "user") return [...system, ...history.slice(0, -1), { role: "user", content: `${last.content}\n\n${context}` }];
  return [...system, ...history, { role: "user", content: context }];
}

/** Ferramentas fixas da jornada (ids de todos os quadros e momentos): mudar por turno quebraria o cache. */
export function buildTurnTools(j: Journey): ToolSpec[] {
  const nodeIds = [...new Set(Object.values(j.boards).flatMap((b) => b.nodes.map((n) => n.id)))];
  const nodes = { type: "array", items: { type: "string", enum: nodeIds } };
  const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): ToolSpec => ({
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  });
  return [
    fn("next_step", "O passo atual acabou: segue para o próximo passo da pauta.", { reply: { type: "string", description: "A resposta sugerida que a pessoa deu, se o passo esperava uma." } }),
    fn("go_to", "A pessoa pediu outro assunto: vai para o início de um momento da pauta.", { moment: { type: "string", enum: j.moments.map((m) => m.id) } }, ["moment"]),
    fn("record_check", "Resultado da checagem do passo atual: a pessoa entendeu ou vale rever.", { entendeu: { type: "boolean" } }, ["entendeu"]),
    fn("highlight", "Destaca nós do quadro enquanto fala deles.", { targets: nodes }, ["targets"]),
    fn("reveal", "Mostra nós do quadro que ainda não apareceram.", { targets: nodes }, ["targets"]),
    fn("open_card", "Abre o cartão de um nó (função, dono, docs, ADR).", { target: { type: "string", enum: nodeIds } }, ["target"]),
    fn(
      "escalate_to_buddy",
      "Encaminha a dúvida quando não há fonte confiável: à buddy, ou, no caso pessoal (salário, bônus, contrato), ao gestor ou a People (rh).",
      { summary: { type: "string" }, destino: { type: "string", enum: ["buddy", "gestor", "rh"], description: "Quem recebe na empresa. Sem destino, a buddy." } },
      ["summary"],
    ),
  ];
}

export async function turn(input: TurnInput, emit: (ev: TurnEvent) => void): Promise<AskTiming> {
  const t0 = performance.now();
  const ms = () => Math.round(performance.now() - t0);
  const timing: AskTiming = { first_speak_ms: null, llm_first_token_ms: null, llm_first_sentence_ms: null, total_ms: 0, llm_error: null, tokens_in: null, tokens_out: null, tokens_estimated: false };
  const moment = input.journey.moments.find((m) => m.id === input.momentId)!;
  const step = moment.steps.find((s) => s.id === input.stepId)!;
  const say = (text: string, source: "bridge" | "llm" | "fallback") => {
    const id = randomUUID();
    input.tts?.start({ action_id: id, text }).catch(() => undefined);
    timing.first_speak_ms ??= ms();
    emit({ type: "speak", id, text, audio_url: input.tts ? `/api/tts/${id}` : null, source });
  };
  const onBoard = new Set(visibleNodes({ journey: input.journey, profile: input.profile, momentId: moment.id, stepId: step.id }).map((n) => n.id));
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), input.timeoutMs);
  input.signal?.addEventListener("abort", () => ac.abort(), { once: true });
  const bridge = input.kind === "fala" ? setTimeout(() => timing.first_speak_ms === null && say(pickBridge(null), "bridge"), BRIDGE_AFTER_MS) : null;
  const splitter = new SentenceSplitter();
  let moved = false;
  let spoke = false;
  let escalation: string | null = null;
  let escalationDestino: DestinoDoEncaminhamento | undefined;
  let falado = "";
  let refused = false;
  let usage: { input: number; output: number } | null = null;
  let sentChars: number | null = null;
  let outChars = 0;
  const sentence = (s: string) => {
    timing.llm_first_sentence_ms ??= ms();
    spoke = true;
    say(s, "llm");
    falado += ` ${s}`;
  };
  try {
    const messages = buildTurnMessages(input, moment, step);
    const tools = buildTurnTools(input.journey);
    sentChars = JSON.stringify(messages).length + JSON.stringify(tools).length;
    for await (const ev of streamChat({ model: input.model, messages, tools, thinking: false, maxTokens: 600, signal: ac.signal })) {
      if (ev.type === "usage") usage = { input: ev.input, output: ev.output };
      if (ev.type === "done" && ev.finishReason === "refusal") refused = true;
      if (ev.type === "text" || ev.type === "tool_call") timing.llm_first_token_ms ??= ms();
      if (ev.type === "text") {
        outChars += ev.text.length;
        splitter.push(ev.text).forEach(sentence);
      }
      if (ev.type !== "tool_call") continue;
      outChars += ev.raw.length;
      // a frase que estava sendo escrita sai antes da ação (a ação acompanha a frase seguinte)
      const pending = splitter.flush();
      if (pending) sentence(pending);
      const a = (ev.args ?? {}) as { targets?: string[]; target?: string; moment?: string; reply?: string; entendeu?: boolean; summary?: string };
      const targets = (a.targets ?? []).filter((t) => onBoard.has(t));
      if ((ev.name === "highlight" || ev.name === "reveal") && targets.length) {
        emit({ type: "action", action: ev.name === "highlight" ? { type: "highlight", targets, tone: "focus" } : { type: "reveal", targets } });
      } else if (ev.name === "open_card" && a.target && onBoard.has(a.target)) {
        emit({ type: "action", action: { type: "card", target: a.target } });
      } else if (ev.name === "record_check" && typeof a.entendeu === "boolean") {
        emit({ type: "check", entendeu: a.entendeu });
      } else if (ev.name === "escalate_to_buddy") {
        if (escalation === null) {
          escalation = a.summary?.trim() || input.text || "";
          escalationDestino = (["buddy", "gestor", "rh"] as const).find((d) => d === (a as { destino?: unknown }).destino);
        }
      } else if (!moved && ev.name === "next_step") {
        moved = true;
        emit(a.reply ? { type: "next_step", reply: a.reply } : { type: "next_step" });
      } else if (!moved && ev.name === "go_to" && a.moment) {
        moved = true;
        emit({ type: "go_to", target: `moment:${a.moment}` });
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
  if (refused) timing.llm_error = "refusal";
  if (!spoke && !moved && !escalation && !timing.llm_error) timing.llm_error = "empty_response";
  if (timing.llm_error && timing.llm_error !== "interrupted") say(FAILURE_LINE, "fallback");
  else if (escalation && !input.signal?.aborted && input.kind === "fala" && looksLikeQuestion(input.text ?? "")) {
    // sem destino na tool, vale a fala de Puca; caso pessoal sem nada vai a People (PRODUCT.md §13.2)
    const destino = escalationDestino ?? destinoPelaFala(falado) ?? (isCasoPessoal(input.text ?? "") ? "rh" : undefined);
    emit({ type: "escalate", summary: escalation, ...(destino ? { destino } : {}) });
  }
  timing.total_ms = ms();
  emit({ type: "timing", timing });
  return timing;
}
