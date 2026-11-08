// A jornada como pauta (decisão 0010): o LLM conduz a sessão e avisa quando o passo acabou; daqui sai o próximo
// passo, pelas mesmas transições que o motor (runner.ts) usa no roteiro.
import { evaluate, matchReply } from "./conditions";
import type { Journey, Profile, ResultadoDaChecagem } from "./types";

export interface Posicao {
  moment: number;
  step: number;
}

/**
 * O passo que vem depois de `pos`. `reply` é a resposta que a pessoa deu (casa com as respostas sugeridas do passo) e
 * `checagem` o resultado da checagem do passo, quando houver. null = a jornada acabou.
 */
export function nextPosition(
  journey: Journey,
  profile: Profile,
  pos: Posicao,
  said: { reply?: string | null; checagem?: ResultadoDaChecagem | null } = {},
): Posicao | null {
  const moment = journey.moments[pos.moment];
  const step = moment?.steps[pos.step];
  if (!step) return null;
  const reply = said.reply ? matchReply(said.reply, step.suggested_replies ?? []) : null;
  const t = (step.transitions ?? []).find((tr) => !tr.if || evaluate(tr.if, { profile, reply, checagem: said.checagem ?? null }));
  if (t && "step" in t.to) {
    const target = t.to.step;
    const si = moment.steps.findIndex((s) => s.id === target);
    if (si >= 0) return { moment: pos.moment, step: si };
  }
  if (t && "moment" in t.to) {
    const target = t.to.moment;
    const mi = journey.moments.findIndex((m) => m.id === target);
    if (mi >= 0) return { moment: mi, step: 0 };
  }
  if (pos.step + 1 < moment.steps.length) return { moment: pos.moment, step: pos.step + 1 };
  if (pos.moment + 1 < journey.moments.length) return { moment: pos.moment + 1, step: 0 };
  return null;
}
