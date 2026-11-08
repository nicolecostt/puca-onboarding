// Correções da revisão final (encaminhamento e rastro).
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOutbox, forwardingMessage, looksLikeQuestion, type Forwarding } from "../forwarding";
import { memoryStore } from "../storage";
import { uid } from "../uid";

const draft = (question: string, summary = question): Omit<Forwarding, "id" | "at" | "status"> => ({
  to: { name: "Paula Nunes", role: "buddy" }, pessoa: "Ana", question, summary, consulted: [], reason: "motivo", moment: null,
});

describe("I3: envio preso em 'enviando' volta a ser pegável", () => {
  it("aba que fechou no meio do envio: depois de 30 s outra aba pega de novo", () => {
    let t = Date.parse("2026-11-07T22:00:00Z");
    const store = memoryStore();
    const out = createOutbox(store, { now: () => new Date(t) });
    const f = out.add(draft("Quem cuida do tail-common?"));
    out.claim(f.id, "aba-que-fechou");
    expect(out.pending("aba-nova")).toEqual([]);
    t += 31_000;
    expect(out.pending("aba-nova").map((p) => p.id)).toEqual([f.id]);
    expect(out.pending("aba-que-fechou")).toEqual([]); // a própria dona não repega o que está enviando
  });

  it("#84: a aba sabe quanto esperar para tentar de novo, sem depender de outro evento", () => {
    let t = Date.parse("2026-11-07T22:00:00Z");
    const out = createOutbox(memoryStore(), { now: () => new Date(t) });
    expect(out.nextRetryIn("aba-nova")).toBeNull(); // nada preso: não agenda
    const f = out.add(draft("Quem cuida do tail-common?"));
    out.claim(f.id, "aba-que-fechou");
    t += 10_000;
    expect(out.nextRetryIn("aba-nova")).toBe(20_000);
    expect(out.nextRetryIn("aba-que-fechou")).toBeNull(); // a dona não espera por ela mesma
    t += 25_000;
    expect(out.nextRetryIn("aba-nova")).toBe(0); // já pode pegar
    out.setStatus(f.id, "enviado");
    expect(out.nextRetryIn("aba-nova")).toBeNull();
  });
});

describe("I4: id sem contexto seguro (http://<ip-da-rede>)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("uid funciona sem crypto.randomUUID e não repete", () => {
    vi.stubGlobal("crypto", { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    const ids = new Set(Array.from({ length: 200 }, () => uid()));
    expect(ids.size).toBe(200);
  });
  it("uid funciona sem crypto nenhum", () => {
    vi.stubGlobal("crypto", undefined);
    expect(uid()).toMatch(/\w{8,}/);
  });
});

describe("M2: o resumo do agente chega à buddy", () => {
  it("resumo diferente da pergunta entra na mensagem", () => {
    const f = { ...draft("e o home office?", "Política de home office do time"), id: "1", at: "", status: "pendente" as const };
    expect(forwardingMessage(f)).toContain("Resumo: Política de home office do time");
  });
  it("resumo igual à pergunta não repete", () => {
    const f = { ...draft("Quem cuida do tail-common?"), id: "1", at: "", status: "pendente" as const };
    expect(forwardingMessage(f)).not.toContain("Resumo:");
  });
});

describe("M5: conversa fiada não vira encaminhamento", () => {
  it("'ok', 'valeu' e 'beleza então' não são dúvida", () => {
    for (const t of ["ok", "valeu", "beleza então"]) expect(looksLikeQuestion(t)).toBe(false);
  });
  it("pergunta com '?' ou frase com 3+ palavras é dúvida", () => {
    for (const t of ["home office?", "qual a política de home office", "quem cuida do tail-common"]) expect(looksLikeQuestion(t)).toBe(true);
  });
});
