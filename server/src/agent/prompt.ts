// Prompt do agente para UM turno fora do roteiro: guidelines + passo atual + nós visíveis + perfil.
// Mínimo de propósito: prompt menor = prefill menor = primeiro token mais cedo.
import { interpolate } from "../../../src/journey/profile";
import { effectiveViews } from "../../../src/journey/validate";
import type { BoardNode, Journey, Profile } from "../../../src/journey/types";
import type { ChatMessage, ToolSpec } from "../llm";

export interface TurnContext {
  journey: Journey;
  profile: Profile;
  momentId: string;
  stepId: string;
  /** Histórico curto já falado (últimas trocas), opcional. */
  history?: ChatMessage[];
}

export function visibleNodes(ctx: TurnContext): BoardNode[] {
  const mi = ctx.journey.moments.findIndex((m) => m.id === ctx.momentId);
  const view = effectiveViews(ctx.journey.moments)[mi];
  return view?.mode === "board" ? ctx.journey.boards[view.board].nodes : [];
}

function nodeLine(n: BoardNode, p: Profile): string {
  const i = n.info;
  if (!i) return `- ${n.id}: ${n.label}`;
  const owner = i.owner ? (i.owner_confirmed === false ? `dono NÃO confirmado` : `dono ${i.owner}`) : "";
  const adr = i.adr ? `${i.adr.id} "${i.adr.title}": ${i.adr.summary}` : "";
  const docs = i.docs?.map((d) => d.title).join("; ") ?? "";
  return interpolate(`- ${n.id} (${n.label}): ${[i.role, i.team && `time ${i.team}`, owner, adr, docs && `fontes: ${docs}`].filter(Boolean).join(" | ")}`, p);
}

export function buildMessages(ctx: TurnContext, userText: string, mode: "min" | "full" = "min"): ChatMessage[] {
  const { journey, profile } = ctx;
  const moment = journey.moments.find((m) => m.id === ctx.momentId)!;
  const step = moment.steps.find((s) => s.id === ctx.stepId)!;
  const g = journey.agent.guidelines;
  const nodes = visibleNodes(ctx);
  const transitions = (step.transitions ?? [])
    .filter((t) => t.when)
    .map((t) => `- ${"moment" in t.to ? `moment:${t.to.moment}` : `step:${t.to.step}`} quando ${t.when}`);

  const system = [
    g.core_identity,
    g.personality_and_tone,
    g.safety_and_escalation,
    "Você está FALANDO em voz alta, em pt-BR. Responda em 1 a 3 frases curtas. A primeira frase tem no máximo 6 palavras.",
    "Use só os fatos abaixo. Se não estiverem lá, diga que não conseguiu confirmar e indique a buddy.",
    "Use as tools só com os ids listados. Sem markdown, sem listas, sem emojis.",
    "",
    `Pessoa: ${profile.nome}, ${profile.vinculo === "novo" ? "recém-contratada" : "mudando de time"}, time ${profile.time ?? "?"}, gestor ${profile.gestor ?? "?"}.`,
    `Momento: ${moment.title}. Objetivo: ${moment.goal}`,
    `Passo atual: ${step.goal}. Você acabou de dizer: "${interpolate(step.line, profile)}"`,
    moment.knowledge || step.knowledge ? `Conhecimento: ${[moment.knowledge, step.knowledge].filter(Boolean).join(" ")}` : "",
    transitions.length ? `Para onde ir (tool go_to):\n${transitions.join("\n")}` : "",
    nodes.length ? `Quadro (ids):\n${nodes.map((n) => nodeLine(n, profile)).join("\n")}` : "",
    mode === "full" ? `Jornada completa:\n${JSON.stringify(journey)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [{ role: "system", content: system }, ...(ctx.history ?? []), { role: "user", content: userText }];
}

export function buildTools(ctx: TurnContext): ToolSpec[] {
  const ids = visibleNodes(ctx).map((n) => n.id);
  const step = ctx.journey.moments.find((m) => m.id === ctx.momentId)!.steps.find((s) => s.id === ctx.stepId)!;
  const targets = (step.transitions ?? []).map((t) => ("moment" in t.to ? `moment:${t.to.moment}` : `step:${t.to.step}`));
  const tools: ToolSpec[] = [
    {
      type: "function",
      function: {
        name: "escalate_to_buddy",
        description: "Encaminha a dúvida para a buddy quando não há fonte confiável.",
        parameters: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
      },
    },
  ];
  if (ids.length) {
    // Enum dos ids: o modelo deixa de inventar "serviço fraud-score".
    const idList = { type: "array", items: { type: "string", enum: ids } };
    tools.push(
      { type: "function", function: { name: "highlight", description: "Destaca nós do quadro enquanto fala deles.", parameters: { type: "object", properties: { targets: idList }, required: ["targets"] } } },
      { type: "function", function: { name: "open_card", description: "Abre o cartão de um nó (função, dono, docs, ADR).", parameters: { type: "object", properties: { target: { type: "string", enum: ids } }, required: ["target"] } } },
    );
  }
  if (targets.length) {
    tools.push({
      type: "function",
      function: { name: "go_to", description: "Segue a aula para outro ponto quando a pessoa pedir.", parameters: { type: "object", properties: { target: { type: "string", enum: targets } }, required: ["target"] } },
    });
  }
  return tools;
}
