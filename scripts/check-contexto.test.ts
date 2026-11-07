import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checarGlossario, checarProduto, mapaEvitar, slug, termosEvitados } from "./check-contexto";

const produto = (corpo: string) =>
  ["# Puca", "", "## Sumário", "", "1. [Visão](#1-visão)", "2. [Encaixe: o desafio](#2-encaixe-o-desafio)", "", "---", "", corpo].join("\n");
const secoes = "## 1. Visão\n\ntexto\n\n## 2. Encaixe: o desafio\n\n### 2.1. Processo\n\nver [§1](#1-visão)\n";

describe("slug", () => {
  it("segue a âncora do GitHub (acentos ficam, pontuação sai, travessão vira dois hífens)", () => {
    expect(slug("10.2. Incorporação de respostas à base — opcional no hackathon")).toBe("102-incorporação-de-respostas-à-base--opcional-no-hackathon");
    expect(slug("12. Encaixe no Desafio Tako: a Puca")).toBe("12-encaixe-no-desafio-tako-a-puca");
  });
});

describe("checarProduto", () => {
  it("aceita o PRODUCT.md do repositório", () => {
    expect(checarProduto(readFileSync("PRODUCT.md", "utf8")).erros).toEqual([]);
  });
  it("aceita um documento no padrão", () => {
    expect(checarProduto(produto(secoes)).erros).toEqual([]);
  });
  it("acusa seção nova fora do sumário", () => {
    const r = checarProduto(produto(secoes + "\n## 3. Avaliação\n"));
    expect(r.erros.join("\n")).toMatch(/seção 3 .*não está no sumário/);
  });
  it("acusa numeração pulada e subseção fora de ordem", () => {
    const r = checarProduto(produto(secoes.replace("### 2.1.", "### 2.2.") + "\n## 4. Pulo\n"));
    expect(r.erros.join("\n")).toMatch(/subseção 2\.2 fora de ordem/);
    expect(r.erros.join("\n")).toMatch(/seção 4 fora de ordem/);
  });
  it("acusa link interno quebrado e título do sumário diferente", () => {
    const r = checarProduto(produto(secoes.replace("(#1-visão)", "(#1-visao)").replace("## 1. Visão", "## 1. Visão geral")));
    expect(r.erros.join("\n")).toMatch(/link para "#1-visao"/);
    expect(r.erros.join("\n")).toMatch(/sumário diz "Visão"/);
  });
});

describe("checarGlossario", () => {
  const g = (corpo: string) => `# Puca\n\nIntro.\n\n## Pessoas\n\n${corpo}\n`;
  it("aceita o CONTEXT.md do repositório", () => {
    expect(checarGlossario(readFileSync("CONTEXT.md", "utf8")).erros).toEqual([]);
  });
  it("acusa termo sem definição e _Avoid_ fora do lugar", () => {
    const r = checarGlossario(g("**Puca**:\n\n**Buddy**:\n_Avoid_: mentor\nColega."));
    expect(r.erros.join("\n")).toMatch(/"Puca" sem definição/);
    expect(r.erros.join("\n")).toMatch(/"_Avoid_" tem que ser a última linha/);
  });
  it("acusa termo repetido, a menos que diga 'Não confundir'", () => {
    expect(checarGlossario(g("**Aula**:\nUma sessão.\n\n**Aula**:\nOutra coisa.")).erros.join()).toMatch(/repetido/);
    expect(checarGlossario(g("**Aula**:\nUma sessão.\n\n**Aula**:\nOutra coisa. (Não confundir com a sessão.)")).erros).toEqual([]);
  });
  it("acusa _Avoid_ que contradiz outro termo, a menos que venha explicado", () => {
    expect(checarGlossario(g("**Lousa**:\nO produto.\n\n**Quadro**:\nA vista.\n_Avoid_: lousa")).erros.join()).toMatch(/manda evitar "Lousa"/);
    expect(checarGlossario(g("**Lousa**:\nO produto.\n\n**Quadro**:\nA vista.\n_Avoid_: lousa (é o produto)")).erros).toEqual([]);
  });
});

describe("termosEvitados", () => {
  const mapa = mapaEvitar("## Jornada\n\n**Jornada**:\nO roteiro.\n_Avoid_: trilha, script\n");
  it("acha palavra evitada inteira, sem pegar pedaço de outra", () => {
    expect(termosEvitados("A trilha da pessoa", mapa)).toEqual([{ palavra: "trilha", usar: "Jornada" }]);
    expect(termosEvitados("Trilhas não, mas description sim", mapa)).toEqual([]);
  });
  it("ignora a própria linha de _Avoid_", () => {
    expect(termosEvitados("_Avoid_: trilha", mapa)).toEqual([]);
  });
  it("não avisa palavra de uso comum e respeita item explicado ('lousa (é o produto)')", () => {
    const m = mapaEvitar("## G\n\n**Conhecimento**:\nExtra.\n_Avoid_: contexto, base\n\n**Quadro**:\nA vista.\n_Avoid_: lousa (é o produto)\n");
    expect(termosEvitados("o contexto da base", m)).toEqual([]);
    expect(termosEvitados("o jurado testa a Lousa", m)).toEqual([]);
    expect(termosEvitados("desenha na lousa", m)).toEqual([{ palavra: "lousa", usar: "Quadro" }]);
  });
});
