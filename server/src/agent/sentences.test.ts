import { describe, expect, it } from "vitest";
import { limparFala, SentenceSplitter } from "./sentences";

describe("limparFala", () => {
  it("tira o rótulo que o modelo põe antes da pergunta", () => {
    expect(limparFala("Pergunto: como você prefere ser chamado?")).toBe("Como você prefere ser chamado?");
    expect(limparFala("Pergunta: é sua primeira vez na Kota?")).toBe("É sua primeira vez na Kota?");
    expect(limparFala("Minha pergunta é: o que você fazia antes?")).toBe("O que você fazia antes?");
  });
  it("tira o próprio nome e as aspas em volta da fala", () => {
    expect(limparFala("Puca: Oi, Ana!")).toBe("Oi, Ana!");
    expect(limparFala('Pergunto: "Como prefere que eu te chame?"')).toBe("Como prefere que eu te chame?");
    expect(limparFala("O Puca — Pronto, seguimos.")).toBe("Pronto, seguimos.");
    expect(limparFala('Pergunto: "Como prefere que eu te chame"?')).toBe("Como prefere que eu te chame?");
  });
  it("não mexe em fala normal, nem em dois-pontos no meio da frase", () => {
    expect(limparFala("Perguntei ao time: eles usam Kafka.")).toBe("Perguntei ao time: eles usam Kafka.");
    expect(limparFala("A regra é simples: retry três vezes.")).toBe("A regra é simples: retry três vezes.");
    expect(limparFala('Ela disse "oi" para você.')).toBe('Ela disse "oi" para você.');
    expect(limparFala("Pergunta-chave é o deploy.")).toBe("Pergunta-chave é o deploy.");
    expect(limparFala("Fala-se muito disso.")).toBe("Fala-se muito disso.");
    expect(limparFala("Pergunta: 'API' é o quê?")).toBe("'API' é o quê?");
  });
});

describe("SentenceSplitter", () => {
  it("limpa cada frase antes de ir para a voz", () => {
    const sp = new SentenceSplitter();
    const out = sp.push("Pergunto: como prefere ser chamado? Resposta: legal. ");
    expect(out).toEqual(["Como prefere ser chamado?", "Legal."]);
    expect(sp.push("Puca: até já")).toEqual([]);
    expect(sp.flush()).toBe("Até já");
  });
});
