// O que fazer com uma fala (voz ou chat) da pessoa, do mais rápido ao mais caro.
// Tudo aqui é local e instantâneo; só "ask" vai ao servidor (ponte na hora + LLM).
//   jump      → pediu outro assunto            → pula para o início do momento
//   reply     → bateu numa resposta sugerida   → segue o roteiro
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
  waiting: { kind: "reply"; replies: string[] } | { kind: "select" } | null;
  /** Nome do quadro na tela (para o FAQ e o toque por nome). */
  board: string | null;
  faqs: Faq[];
}

// ponytail: limiares fixos, ajustados à mão nos cenários do bench; revisar olhando bench:turn.
const REPLY_MIN = 0.6;
const FAQ_MIN = 0.5;

export function routeUtterance(text: string, ctx: RouteContext): Route {
  const w = ctx.waiting;
  const reply = w?.kind === "reply" ? scoreReply(text, w.replies) : null;
  const isReply = !!reply?.reply && reply.score >= REPLY_MIN;

  if (!isReply) {
    const jump = findJump(text, ctx.journey, ctx.moment?.id);
    if (jump) return { kind: "jump", moment: jump };
  }
  if (isReply) return { kind: "reply", reply: reply!.reply! };

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
