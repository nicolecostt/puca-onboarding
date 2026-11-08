import { describe, expect, it } from "vitest";
import demo from "../data/tail.journey.json";
import { buildFaqs } from "../faq";
import { DEMO_PROFILES } from "../profile";
import { routeUtterance, type RouteContext } from "../route";
import { loadJourney } from "../validate";

const journey = loadJourney(demo);
const moment = journey.moments.find((m) => m.id === "pagamentos")!;
const step = moment.steps.find((s) => s.id === "pg-pergunta")!;
const ctx: RouteContext = {
  journey,
  moment,
  step,
  waiting: { kind: "reply", replies: step.suggested_replies ?? [] },
  board: "pagamentos",
  faqs: buildFaqs(journey, DEMO_PROFILES.novo),
};

describe("routeUtterance", () => {
  it("resposta sugerida, pulo e pergunta nova", () => {
    expect(routeUtterance("pode seguir", ctx)).toMatchObject({ kind: "reply", reply: "Pode seguir" });
    expect(routeUtterance("quero ver a primeira tarefa", ctx).kind).toBe("jump");
    expect(routeUtterance("Quanto ganha um engenheiro pleno aqui?", ctx).kind).toBe("ask");
  });

  it("toque por nome quando a tela espera um clique", () => {
    const node = journey.boards.pagamentos.nodes[0];
    const r = routeUtterance(`acho que é o ${node.label.replace("\n", " ")}`, { ...ctx, waiting: { kind: "select" } });
    expect(r).toMatchObject({ kind: "select", node: node.id });
  });
});

describe("routeUtterance: FAQ antes da knowledge", () => {
  it("quem cuida do nó vai para o FAQ, não para uma frase solta da knowledge", () => {
    const r = routeUtterance("Quem cuida do authorizer?", ctx);
    expect(r.kind).toBe("faq");
    if (r.kind === "faq") expect(r.faq).toMatchObject({ node: "authorizer", intent: "owner" });
  });
});

describe("routeUtterance: dono não confirmado vira encaminhamento", () => {
  it("quem cuida do tail-common cai no FAQ marcado como não confirmado", () => {
    const r = routeUtterance("Quem cuida do tail-common?", ctx);
    expect(r).toMatchObject({ kind: "faq", faq: { node: "common", intent: "owner", unconfirmed: true } });
  });

  it("dono confirmado não fica marcado", () => {
    const r = routeUtterance("Quem cuida do authorizer?", ctx);
    expect(r.kind === "faq" && r.faq.unconfirmed).toBeFalsy();
  });
});

describe("routeUtterance: checagem por resposta", () => {
  const falha = journey.moments.find((m) => m.id === "falha")!;
  const checa = falha.steps.find((s) => s.id === "fa-checa")!;
  const cctx: RouteContext = { ...ctx, moment: falha, step: checa, waiting: { kind: "reply", replies: checa.suggested_replies ?? [], check: true } };

  it("resposta livre vai inteira ao motor, sem passar pelo conhecimento que entregaria a resposta", () => {
    for (const t of ["para a dlq", "acho que se perde", "não sei"]) expect(routeUtterance(t, cctx)).toEqual({ kind: "reply", reply: t });
  });

  it("pergunta e pulo continuam funcionando durante a checagem", () => {
    expect(routeUtterance("pode repetir a pergunta?", cctx).kind).not.toBe("reply");
    expect(routeUtterance("o que é a dlq", cctx).kind).not.toBe("reply");
    expect(routeUtterance("quero ver a primeira tarefa", cctx).kind).toBe("jump");
  });

  it("fora de uma checagem, nada muda: a mesma fala vai ao conhecimento", () => {
    expect(routeUtterance("para a dlq", { ...cctx, waiting: { kind: "reply", replies: checa.suggested_replies ?? [] } }).kind).toBe("knowledge");
  });
});
