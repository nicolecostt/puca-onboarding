import { describe, expect, it } from "vitest";
import demo from "../data/tail.journey.json";
import { buddyOf, createOutbox, FORWARDING_KEY, forwardingMessage, type Forwarding } from "../forwarding";
import { memoryStore } from "../storage";
import { loadJourney } from "../validate";

const journey = loadJourney(demo);
const draft = (question: string): Omit<Forwarding, "id" | "at" | "status"> => ({
  to: { name: "Paula Nunes", role: "buddy" },
  pessoa: "Ana",
  question,
  summary: question,
  consulted: ["ADR-012", "README do pos-gateway"],
  reason: "Não há responsável confirmado para o tail-common nas fontes da Tail.",
  moment: "pagamentos",
});

/** Relógio que a gente avança à mão. */
function clock(start = Date.parse("2026-11-07T22:00:00Z")) {
  let t = start;
  return { now: () => new Date(t), advance: (ms: number) => void (t += ms) };
}

describe("createOutbox", () => {
  it("encaminhamento novo fica pendente", () => {
    const out = createOutbox(memoryStore());
    const f = out.add(draft("Quem cuida do tail-common?"));
    expect(f.status).toBe("pendente");
    expect(out.pending().map((p) => p.id)).toEqual([f.id]);
  });

  it("a mesma dúvida em menos de 2 minutos não vira dois encaminhamentos", () => {
    const c = clock();
    const out = createOutbox(memoryStore(), { now: c.now });
    const a = out.add(draft("Quem cuida do tail-common?"));
    c.advance(30_000);
    const b = out.add(draft("  quem CUIDA do tail-common  "));
    expect(b.id).toBe(a.id);
    expect(out.list()).toHaveLength(1);
    c.advance(3 * 60_000);
    out.add(draft("Quem cuida do tail-common?"));
    expect(out.list()).toHaveLength(2);
  });

  it("em envio sai da lista de pendentes (duas abas do Slack não mandam duas vezes)", () => {
    const store = memoryStore();
    const f = createOutbox(store).add(draft("x"));
    createOutbox(store).setStatus(f.id, "enviando");
    expect(createOutbox(store).pending()).toEqual([]);
  });

  it("encaminhamentos corrompidos no navegador viram lista vazia", () => {
    const store = memoryStore();
    store.setItem(FORWARDING_KEY, "{lixo");
    expect(createOutbox(store).list()).toEqual([]);
  });
});

describe("buddyOf", () => {
  it("a buddy vem do nó buddy da jornada", () => {
    expect(buddyOf(journey)).toBe("Paula Nunes");
  });

  it("jornada sem nó buddy: 'sua buddy'", () => {
    expect(buddyOf({ ...journey, boards: {} })).toBe("sua buddy");
  });
});

describe("forwardingMessage", () => {
  const f: Forwarding = { ...draft("Quem cuida do tail-common?"), id: "1", at: "2026-11-07T22:00:00Z", status: "pendente" };

  it("leva a pessoa, a dúvida, o que foi consultado e o motivo", () => {
    const msg = forwardingMessage(f);
    expect(msg).toContain("Oi, Paula Nunes!");
    expect(msg).toContain("A Ana perguntou na aula");
    expect(msg).toContain('"Quem cuida do tail-common?"');
    expect(msg).toContain("ADR-012; README do pos-gateway");
    expect(msg).toContain("Não há responsável confirmado para o tail-common nas fontes da Tail.");
  });

  it("sem nada consultado, diz que não achou fonte", () => {
    expect(forwardingMessage({ ...f, consulted: [] })).toContain("Não achei nenhuma fonte sobre isso.");
  });
});

describe("createOutbox: posse do envio entre abas", () => {
  it("duas abas pegam o mesmo encaminhamento: só a última fica com ele", () => {
    const store = memoryStore();
    const f = createOutbox(store).add(draft("x"));
    createOutbox(store).claim(f.id, "aba-1");
    createOutbox(store).claim(f.id, "aba-2");
    expect(createOutbox(store).ownerOf(f.id)).toBe("aba-2");
    expect(createOutbox(store).pending()).toEqual([]);
  });
});
