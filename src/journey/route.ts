// O que fazer com uma fala (voz ou chat) da pessoa, do mais rápido ao mais caro.
// Tudo aqui é local e instantâneo; só "ask" vai ao servidor (ponte na hora + LLM).
//   jump      → pediu outro assunto            → pula para o início do momento
//   reply     → bateu numa resposta sugerida   → segue o roteiro (numa checagem, qualquer fala que não seja
//               pergunta nem pulo é a resposta: o motor decide se entendeu)
//   tarefa    → pergunta sobre a primeira tarefa → os campos da tarefa da pessoa respondem, ou vira
//               encaminhamento (#79); vem antes do toque por nome, que confundia "a primeira tarefa" com o nó
//   select    → disse o nome de um nó          → conta como o toque no quadro
//   knowledge → o conhecimento da sessão responde
//   faq       → pergunta sobre um nó do quadro ("quem cuida do X?")
//   ask       → nada disso: pergunta ao agente
import { matchFaq, scoreReply, normalize } from "./conditions";
import { respostaSobreTarefa, semPalavraTarefa, type RespostaSobreTarefa } from "./duvidas-da-tarefa";
import type { Faq } from "./faq";
import { tarefaDoPasso, type TarefaDoTime } from "./primeira-tarefa";
import { answerFromKnowledge, findJump } from "./intent";
import type { Journey, Moment, Step } from "./types";

export type Route =
  | { kind: "jump"; moment: Moment }
  | { kind: "reply"; reply: string }
  | { kind: "tarefa"; resposta: RespostaSobreTarefa }
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
  /** A primeira tarefa da pessoa (tarefaDaPessoa); sem ela, a fala segue o caminho de sempre. */
  tarefa?: TarefaDoTime | null;
  /** A tarefa já foi apresentada na sessão; antes disso Puca não adianta a tarefa. */
  tarefaApresentada?: boolean;
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

  // Pergunta sobre a primeira tarefa: responde pelos campos da tarefa. Antes do toque por nome, porque "a primeira
  // tarefa" é também o rótulo de um nó, e uma pergunta não é toque.
  if (isQuestion(text)) {
    const r = respostaSobreTarefa(text, ctx.tarefa ?? null, ctx.tarefaApresentada ?? false);
    if (r?.kind === "sem_fonte" && ctx.tarefa) {
      // a tarefa não diz, mas a sessão pode saber ("quem aprova a tarefa?"). Só o conhecimento do momento que apresenta
      // a tarefa (e dos passos dele): o de outros momentos fala de outros sistemas e punha como "dono da tarefa" quem
      // não é (revisão do #121). Casa pelo resto da pergunta, sem a palavra "tarefa", que sozinha casaria qualquer coisa.
      const rest = semPalavraTarefa(text);
      const no = ctx.tarefa.no;
      const daTarefa = ctx.journey.moments.filter((m) => m.steps.some((st) => st.actions?.some((a) => a.type === "card" && a.target === no)));
      const known = daTarefa
        .flatMap((m) => [
          answerFromKnowledge(rest, null, m),
          // passo que apresenta a tarefa de outro vínculo não fala por esta pessoa
          ...m.steps.filter((st) => (tarefaDoPasso(ctx.journey, st)?.no ?? no) === no).map((st) => answerFromKnowledge(rest, st, null)),
        ])
        .find((a): a is string => !!a);
      if (known) return { kind: "knowledge", text: known };
    }
    if (r) return { kind: "tarefa", resposta: r };
  }

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
