// O que fazer com uma fala (voz ou chat) da pessoa, do mais rápido ao mais caro.
// Tudo aqui é local e instantâneo; só "ask" vai ao servidor (ponte na hora + LLM).
//   jump      → pediu outro assunto            → pula para o início do momento
//   reply     → bateu numa resposta sugerida   → segue o roteiro (numa checagem, qualquer fala que não seja
//               pergunta nem pulo é a resposta: o motor decide se entendeu)
//   select    → disse o nome de um nó          → conta como o toque no quadro
//   knowledge → o conhecimento da aula responde
//   faq       → pergunta sobre um nó do quadro ("quem cuida do X?")
//   ask       → nada disso: pergunta ao agente
import { matchFaq, scoreReply, normalize } from "./conditions";
import type { Faq } from "./faq";
import { answerFromKnowledge, findJump } from "./intent";
import type { Journey, Moment, Step } from "./types";

export type Route =
  | { kind: "jump"; moment: Moment }
  | { kind: "reply"; reply: string }
  | { kind: "select"; node: string }
  | { kind: "knowledge"; text: string }
  | { kind: "faq"; faq: Faq }
  | { kind: "ask" };

export interface RouteContext {
  journey: Journey;
  moment: Moment | null;
  step: Step | null;
  /** O que a tela está esperando agora. */
  /** `check`: o passo é uma checagem de entendimento (step.check). */
  waiting: { kind: "reply"; replies: string[]; check?: boolean } | { kind: "select" } | null;
  /** Nome do quadro na tela (para o FAQ e o toque por nome). */
  board: string | null;
  faqs: Faq[];
}

// ponytail: limiares fixos, ajustados à mão nos cenários do bench; revisar olhando bench:turn.
const REPLY_MIN = 0.6;
const FAQ_MIN = 0.5;

/** Parece pergunta ("pode repetir?", "o que é a dlq"): numa checagem, não conta como resposta. */
const QUESTION_START = /^(o que|oq|que|como|por que|porque|pq|quem|onde|qual|quais|quando|quanto|pode|podes|poderia|repete|repita|explica|nao entendi)\b/;
export function isQuestion(text: string): boolean {
  return text.trim().endsWith("?") || QUESTION_START.test(normalize(text));
}

export function routeUtterance(text: string, ctx: RouteContext): Route {
  const w = ctx.waiting;
  const reply = w?.kind === "reply" ? scoreReply(text, w.replies) : null;
  const isReply = !!reply?.reply && reply.score >= REPLY_MIN;

  if (!isReply) {
    const jump = findJump(text, ctx.journey, ctx.moment?.id);
    if (jump) return { kind: "jump", moment: jump };
  }
  if (isReply) return { kind: "reply", reply: reply!.reply! };
  // Checagem: a resposta da pessoa vai inteira ao motor (ele casa com as respostas certas), em vez de cair no
  // conhecimento, que entregaria a resposta. Perguntas continuam indo ao conhecimento e ao agente.
  if (w?.kind === "reply" && w.check && !isQuestion(text)) return { kind: "reply", reply: text.trim() };

  const nodes = ctx.board ? (ctx.journey.boards[ctx.board]?.nodes ?? []) : [];
  if (w?.kind === "select") {
    const said = normalize(text);
    const hit = nodes.find((n) => said.includes(normalize(n.label)) || said.includes(normalize(n.id)));
    if (hit) return { kind: "select", node: hit.id };
  }

  // FAQ com nó + intenção ("quem cuida do authorizer?") é mais preciso que a busca por palavra na knowledge,
  // que aceita uma palavra só em comum e respondia outra coisa sobre o mesmo nó.
  const faq = matchFaq(text, ctx.faqs.filter((f) => f.board === ctx.board));
  if (faq.faq && faq.score === 1) return { kind: "faq", faq: faq.faq };

  const known =
    answerFromKnowledge(text, ctx.step, ctx.moment) ??
    ctx.journey.moments.map((m) => answerFromKnowledge(text, null, m)).find((a): a is string => !!a);
  if (known) return { kind: "knowledge", text: known };

  if (faq.faq && faq.score >= FAQ_MIN) return { kind: "faq", faq: faq.faq };

  return { kind: "ask" };
}
