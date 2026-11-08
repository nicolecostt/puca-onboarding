import { describe, expect, it } from "vitest";
import demo from "../data/kota.journey.json";
import { buddyOf, createOutbox, destinoDaDuvida, FORWARDING_KEY, forwardingMessage, type Forwarding } from "../forwarding";
import { memoryStore } from "../storage";
import { loadJourney } from "../validate";

const journey = loadJourney(demo);
const draft = (question: string): Omit<Forwarding, "id" | "at" | "status"> => ({
  to: { name: "Beatriz Cavalcanti", role: "buddy" },
  pessoa: "Ana",
  question,
  summary: question,
  consulted: ["ADR-0001", "README do ledgermonolith"],
  reason: "Nenhuma fonte da Kota diz quando o ledgermonolith sai do repositório.",
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
    const f = out.add(draft("Quando o ledgermonolith sai do repositório?"));
    expect(f.status).toBe("pendente");
    expect(out.pending().map((p) => p.id)).toEqual([f.id]);
  });

  it("a mesma dúvida em menos de 2 minutos não vira dois encaminhamentos", () => {
    const c = clock();
    const out = createOutbox(memoryStore(), { now: c.now });
    const a = out.add(draft("Quando o ledgermonolith sai do repositório?"));
    c.advance(30_000);
    const b = out.add(draft("  quando o LEDGERMONOLITH sai do repositório  "));
    expect(b.id).toBe(a.id);
    expect(out.list()).toHaveLength(1);
    c.advance(3 * 60_000);
    out.add(draft("Quando o ledgermonolith sai do repositório?"));
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

  it("encaminhamento malformado é descartado e não quebra o add", () => {
    const store = memoryStore();
    const valido = { ...draft("Quando o ledgermonolith sai do repositório?"), id: "ok", at: "2026-11-08T05:00:00.000Z", status: "pendente" };
    store.setItem(FORWARDING_KEY, JSON.stringify([null, { id: "sem-pergunta" }, valido]));
    const out = createOutbox(store);
    expect(() => out.add(draft("Qual a política de home office?"))).not.toThrow();
    expect(out.list().map((f) => f.question)).toEqual(["Quando o ledgermonolith sai do repositório?", "Qual a política de home office?"]);
  });

  it("encaminhamento antigo sem consulted continua na lista e a mensagem do slack sai", () => {
    const store = memoryStore();
    const { consulted: _, ...antigo } = { ...draft("Quando o ledgermonolith sai do repositório?"), id: "velho", at: "2026-11-08T05:00:00.000Z", status: "pendente" };
    store.setItem(FORWARDING_KEY, JSON.stringify([antigo]));
    const [f] = createOutbox(store).list();
    expect(f.id).toBe("velho");
    expect(() => forwardingMessage(f)).not.toThrow();
  });
});

describe("buddyOf", () => {
  it("a buddy vem do nó buddy da jornada", () => {
    expect(buddyOf(journey)).toBe("Beatriz Cavalcanti");
  });

  it("jornada sem nó buddy: 'sua buddy'", () => {
    expect(buddyOf({ ...journey, boards: {} })).toBe("sua buddy");
  });
});

describe("forwardingMessage", () => {
  const f: Forwarding = { ...draft("Quando o ledgermonolith sai do repositório?"), id: "1", at: "2026-11-07T22:00:00Z", status: "pendente" };

  it("leva a pessoa, a dúvida, o que foi consultado e o motivo", () => {
    const msg = forwardingMessage(f);
    expect(msg).toContain("Oi, Beatriz Cavalcanti!");
    expect(msg).toContain('Pergunta de Ana na sessão: "Quando o ledgermonolith sai do repositório?"');
    expect(msg).toContain("ADR-0001; README do ledgermonolith");
    expect(msg).toContain("Nenhuma fonte da Kota diz quando o ledgermonolith sai do repositório.");
  });

  it("sem nada consultado, diz que não achou fonte", () => {
    expect(forwardingMessage({ ...f, consulted: [] })).toContain("Não achei nenhuma fonte sobre isso.");
  });

  it("não supõe o gênero da pessoa nem da buddy (#86)", () => {
    const msg = forwardingMessage({ ...f, pessoa: "Bruno", to: { name: "Igor Valadares", role: "buddy" } });
    expect(msg).toContain('Pergunta de Bruno na sessão: "Quando o ledgermonolith sai do repositório?"');
    expect(msg).not.toMatch(/\b(A|O) Bruno\b/);
    expect(msg).not.toMatch(/\b(ela|ele)\b/);
  });

  it("sem nome da pessoa, não sai 'A você perguntou' (#66)", () => {
    for (const pessoa of ["você", "", "  "]) {
      const msg = forwardingMessage({ ...f, pessoa });
      expect(msg).toContain('A pessoa que estou acompanhando perguntou na sessão: "Quando o ledgermonolith sai do repositório?"');
      expect(msg).not.toMatch(/você perguntou|de você/i);
    }
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

describe("destinoDaDuvida", () => {
  const quem = { buddy: "Beatriz Cavalcanti", gestor: "Natália Brandão" };

  // Notion da Kota, Bônus: "Casos individuais: fale com seu gestor ou com People"
  it("caso pessoal vai ao gestor, não à buddy", () => {
    expect(destinoDaDuvida("qual vai ser o meu bônus?", quem)).toEqual({ name: "Natália Brandão", role: "gestor" });
    expect(destinoDaDuvida("quando sai a minha promoção?", quem)).toEqual({ name: "Natália Brandão", role: "gestor" });
  });

  it("dúvida do dia a dia vai à buddy", () => {
    expect(destinoDaDuvida("quando o ledgermonolith sai do repositório?", quem)).toEqual({ name: "Beatriz Cavalcanti", role: "buddy" });
  });

  it("sem gestor no perfil, o caso pessoal vai à buddy", () => {
    expect(destinoDaDuvida("qual vai ser o meu bônus?", { buddy: "Beatriz Cavalcanti" })).toEqual({ name: "Beatriz Cavalcanti", role: "buddy" });
  });
});
