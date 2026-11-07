// Motor da jornada: percorre momentos e passos, aplica as ações no quadro e decide as transições.
// Não toca no DOM: a tela entrega o `io` (falar, ouvir, esperar clique, mostrar a vista).
// Assim um runtime com LLM pode trocar só o `io` e a decisão de transição, mantendo o mesmo JSON.
import { evaluate, matchReply } from "./conditions";
import { interpolate } from "./profile";
import { effectiveViews } from "./validate";
import type { BoardAction, Journey, Moment, Profile, Step, Transition, View } from "./types";

export interface RunnerIO {
  /** Mostra a vista do momento. fresh = o momento declara a vista (recomeça o quadro); false = herda o estado. */
  enterView(view: View, fresh: boolean): void;
  apply(action: BoardAction): void;
  say(text: string): Promise<void>;
  /** Espera a resposta (botão de resposta sugerida, chat ou voz). Devolve o texto dito. */
  listen(replies: string[]): Promise<string>;
  /** Espera um clique num nó do quadro. Devolve o id do nó. */
  select(nodes: string[]): Promise<string>;
  onMoment?(moment: Moment, index: number): void;
  onStep?(step: Step, moment: Moment): void;
}

/** O que o runner devolve: rodar a jornada e pedir um pulo para outro momento no meio dela. */
export interface Runner {
  run(): Promise<RunResult>;
  /**
   * Pede para ir ao início de outro momento (a pessoa pediu para mudar de assunto).
   * A tela deve interromper o que estiver esperando (fala, resposta, clique); o runner trata a
   * interrupção como o pulo. Entre momentos, sempre pelo primeiro passo. Devolve false se o momento não existe.
   */
  jumpTo(momentId: string): boolean;
}

export interface RunResult {
  /** "done" = chegou ao fim; "limit" = parou no limite de passos (laço de transições). */
  ended: "done" | "limit";
  /** Ids dos passos na ordem em que rodaram. */
  steps: string[];
  /** Ids dos momentos na ordem em que entraram. */
  moments: string[];
}

export interface RunnerOptions {
  /** Teto de passos por execução, contra laço infinito de transições. */
  maxSteps?: number;
}

export function createRunner(journey: Journey, profile: Profile, io: RunnerIO, opts: RunnerOptions = {}): Runner {
  const maxSteps = opts.maxSteps ?? 200;
  const views = effectiveViews(journey.moments);
  const momentIndex = new Map(journey.moments.map((m, i) => [m.id, i]));
  const say = (text: string) => io.say(interpolate(text, profile));
  let jumpRequest: number | null = null;

  function enterMoment(mi: number, result: RunResult): void {
    const m = journey.moments[mi];
    const view = views[mi];
    if (view) io.enterView(view, m.view !== undefined);
    result.moments.push(m.id);
    io.onMoment?.(m, mi);
  }

  /** Passo "select": tenta até acertar ou esgotar as tentativas. */
  async function runSelect(step: Step): Promise<void> {
    const expect = step.expect!;
    const retries = expect.retries ?? 1;
    for (let attempt = 0; ; attempt++) {
      const picked = await io.select(expect.nodes);
      if (expect.nodes.includes(picked)) {
        io.apply({ type: "highlight", targets: [picked], tone: "ok" });
        await say(expect.on_correct);
        return;
      }
      if (attempt < retries) {
        io.apply({ type: "highlight", targets: [picked], tone: "warn" });
        await say(expect.on_wrong);
        io.apply({ type: "clear_highlight" });
        continue;
      }
      io.apply({ type: "highlight", targets: expect.nodes, tone: "ok" });
      await say(expect.on_reveal ?? expect.on_correct);
      return;
    }
  }

  async function run(): Promise<RunResult> {
    const result: RunResult = { ended: "done", steps: [], moments: [] };
    let mi = 0;
    let si = 0;
    enterMoment(mi, result);

    for (let count = 0; ; count++) {
      if (count >= maxSteps) {
        result.ended = "limit";
        return result;
      }
      const moment = journey.moments[mi];
      const step = moment.steps[si];
      result.steps.push(step.id);
      io.onStep?.(step, moment);

      let reply: string | null = null;
      try {
        for (const a of step.actions ?? []) io.apply(a);
        await say(step.line);

        const decision = step.decision ?? "auto";
        if (decision === "wait") {
          const replies = step.suggested_replies ?? [];
          const said = await io.listen(replies);
          reply = matchReply(said, replies);
        } else if (decision === "select") {
          await runSelect(step);
        }
        if (jumpRequest !== null) throw new Error("pulo pedido");
      } catch (err) {
        // interrupção por pulo: vai para o início do momento pedido
        if (jumpRequest === null) throw err;
        mi = jumpRequest;
        si = 0;
        jumpRequest = null;
        enterMoment(mi, result);
        continue;
      }

      // Primeira transição cuja condição vale; sem nenhuma, segue a ordem.
      const t: Transition | undefined = (step.transitions ?? []).find(
        (tr) => !tr.if || evaluate(tr.if, { profile, reply }),
      );
      if (t && "step" in t.to) {
        const target = t.to.step;
        si = moment.steps.findIndex((s) => s.id === target);
        continue;
      }
      if (t && "moment" in t.to) {
        mi = momentIndex.get(t.to.moment)!;
        si = 0;
        enterMoment(mi, result);
        continue;
      }
      if (si + 1 < moment.steps.length) {
        si++;
        continue;
      }
      if (mi + 1 < journey.moments.length) {
        mi++;
        si = 0;
        enterMoment(mi, result);
        continue;
      }
      return result;
    }
  }

  function jumpTo(momentId: string): boolean {
    const i = momentIndex.get(momentId);
    if (i === undefined) return false;
    jumpRequest = i;
    return true;
  }

  return { run, jumpTo };
}
