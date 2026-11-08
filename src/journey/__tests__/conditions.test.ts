import { describe, expect, it } from "vitest";
import { detectIntent, matchFaq, scoreReply } from "../conditions";
import demo from "../data/tail.journey.json";
import { buildFaqs } from "../faq";
import { DEMO_PROFILES } from "../profile";
import { loadJourney } from "../validate";

const journey = loadJourney(demo);

const faqs = [
  { node: "payments-api", label: "payments-api", intent: "what" as const },
  { node: "payments-api", label: "payments-api", intent: "owner" as const },
  { node: "fraud-score", label: "fraud-score", intent: "why" as const },
  { node: "fraud-score", label: "fraud-score", intent: "what" as const },
  { node: "api-gateway", label: "API Gateway", intent: "what" as const },
];

describe("scoreReply", () => {
  it("dá 1 para resposta igual e fração para parecida", () => {
    const replies = ["E se o pagamento falhar?", "Quem cuida de cada serviço?", "Pode seguir"];
    expect(scoreReply("e se o pagamento falhar", replies)).toEqual({ reply: replies[0], score: 1 });
    expect(scoreReply("o pagamento pode falhar?", replies).reply).toBe(replies[0]);
    expect(scoreReply("quanto custa o almoço", replies).score).toBe(0);
  });
});

describe("matchFaq", () => {
  it("acha nó + intenção", () => {
    expect(detectIntent("quem cuida do payments-api?")).toBe("owner");
    expect(matchFaq("quem cuida do payments-api?", faqs)).toMatchObject({ faq: faqs[1], score: 1 });
    expect(matchFaq("por que existe o fraud score?", faqs)).toMatchObject({ faq: faqs[2], score: 1 });
    expect(matchFaq("me explica o api gateway", faqs)).toMatchObject({ faq: faqs[4], score: 1 });
  });

  it("vale o nó citado por inteiro, não outro cujo id está dentro do nome (\"config-topic\" não é \"topic\")", () => {
    const parecidos = [
      { node: "topic", label: "transactions.authorized", intent: "what" as const },
      { node: "config-topic", label: "terminal.config.updated", intent: "what" as const },
    ];
    expect(matchFaq("o que é o config-topic?", parecidos).faq?.node).toBe("config-topic");
    expect(matchFaq("o que é o topic?", parecidos).faq?.node).toBe("topic");
    // na jornada de demo
    const pagamentos = buildFaqs(journey, DEMO_PROFILES.novo).filter((f) => f.board === "pagamentos");
    expect(matchFaq("o que é o config-topic?", pagamentos).faq?.node).toBe("config-topic");
  });

  it("sem intenção cai no 'what' com confiança média; sem nó, nada", () => {
    expect(matchFaq("fraud-score", faqs)).toMatchObject({ faq: faqs[3], score: 0.5 });
    expect(matchFaq("quanto ganha um pleno?", faqs)).toEqual({ faq: null, score: 0 });
  });
});
