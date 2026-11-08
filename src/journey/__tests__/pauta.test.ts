import { describe, expect, it } from "vitest";
import demo from "../data/tail.journey.json";
import { loadJourney } from "../validate";
import { DEMO_PROFILES } from "../profile";
import { nextPosition, type Posicao } from "../pauta";

const journey = loadJourney(demo);
const at = (moment: string, step: string): Posicao => {
  const mi = journey.moments.findIndex((m) => m.id === moment);
  return { moment: mi, step: journey.moments[mi].steps.findIndex((s) => s.id === step) };
};
const ids = (p: Posicao | null) => (p ? `${journey.moments[p.moment].id}/${journey.moments[p.moment].steps[p.step].id}` : null);

describe("nextPosition", () => {
  it("segue a transição pelo perfil (transição pula a parte institucional)", () => {
    expect(ids(nextPosition(journey, DEMO_PROFILES.novo, at("boas-vindas", "bv-oi")))).toBe("boas-vindas/bv-novo");
    expect(ids(nextPosition(journey, DEMO_PROFILES.transicao, at("boas-vindas", "bv-oi")))).toBe("boas-vindas/bv-transicao");
  });

  it("usa a resposta da pessoa, mesmo dita com outras palavras", () => {
    expect(ids(nextPosition(journey, DEMO_PROFILES.novo, at("pagamentos", "pg-pergunta"), { reply: "e se a liquidação falhar" }))).toBe("falha/fa-retry");
    expect(ids(nextPosition(journey, DEMO_PROFILES.novo, at("pagamentos", "pg-pergunta")))).toBe("checagem/ch-pergunta");
  });

  it("usa o resultado da checagem", () => {
    expect(ids(nextPosition(journey, DEMO_PROFILES.novo, at("falha", "fa-checa"), { checagem: "entendeu" }))).toBe("falha/fa-certo");
    expect(ids(nextPosition(journey, DEMO_PROFILES.novo, at("falha", "fa-checa"), { checagem: "rever" }))).toBe("falha/fa-reforco");
  });

  it("acaba no último passo", () => {
    const m = journey.moments.length - 1;
    expect(nextPosition(journey, DEMO_PROFILES.novo, { moment: m, step: journey.moments[m].steps.length - 1 })).toBeNull();
  });
});
