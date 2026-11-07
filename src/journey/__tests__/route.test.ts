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
