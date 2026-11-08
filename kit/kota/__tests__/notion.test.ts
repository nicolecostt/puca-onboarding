import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ContextoKota } from "../checar/contexto";
import { regraNotionUrls } from "../checar/regras/notion-urls";
import { criarRegraPaginas } from "../checar/regras/paginas";
import { mapa } from "../mapa";
import { ARVORE, linhasDatabase } from "../notion/arvore";
import { resolverLinks } from "../notion/links";

const ctx: ContextoKota = { mapa, notionUrls: {}, jornadas: [] };
const pastaTemp = () => mkdtempSync(join(tmpdir(), "kota-notion-"));
const filhos = (pai: string) => ARVORE.filter((n) => n.pai === pai).map((n) => n.chave);

describe("ARVORE", () => {
  it("toda chave é única e todo pai existe antes do filho, com uma raiz só", () => {
    const vistas = new Set<string>();
    for (const no of ARVORE) {
      expect(vistas.has(no.chave), `chave ${no.chave} repetida`).toBe(false);
      if (no.pai !== null) expect(vistas.has(no.pai), `pai ${no.pai} antes de ${no.chave}`).toBe(true);
      vistas.add(no.chave);
    }
    expect(ARVORE.filter((n) => n.pai === null).map((n) => n.chave)).toEqual(["kota"]);
  });

  it("tem as seções do Notion da Kota, com pessoas, times, sistemas e rfcs como databases", () => {
    expect(filhos("kota")).toEqual([
      "comece-aqui", "quem-somos", "pessoas", "times", "sistemas", "jeito-de-trabalhar",
      "rfcs", "politicas", "kota-people", "onboarding", "glossario",
    ]);
    expect(filhos("jeito-de-trabalhar")).toEqual(["rituais", "code-review", "deploy", "incidentes", "de-rfc-a-adr", "comunicacao"]);
    expect(filhos("politicas")).toEqual([
      "seguranca-e-acesso", "dados-de-cliente-e-lgpd", "ferias", "home-office", "despesas", "papeis-buddy-gestor-rh",
    ]);
    expect(filhos("kota-people")).toEqual(["ciclo-de-desempenho", "trilha-de-carreira", "promocao", "bonus", "revisao-salarial"]);
    expect(filhos("onboarding")).toEqual(["onboarding-novo", "onboarding-transicao"]);
    expect(filhos("rfcs")).toEqual(["rfc-1", "rfc-2", "rfc-3"]);
    expect(ARVORE.filter((n) => n.tipo === "database").map((n) => n.chave)).toEqual(["pessoas", "times", "sistemas", "rfcs"]);
    expect(ARVORE.filter((n) => n.tipo === "linha").map((n) => n.chave)).toEqual(["rfc-1", "rfc-2", "rfc-3"]);
  });

  it("o título de cada linha de RFC é o Título da linha dela na database, para a busca pelo título achar a linha", () => {
    const rfcs = linhasDatabase(mapa, "rfcs");
    for (const no of ARVORE.filter((n) => n.pai === "rfcs")) {
      expect(no.titulo).toBe(rfcs.find((l) => `rfc-${l["Número"]}` === no.chave)?.["Título"]);
    }
    expect(ARVORE.find((n) => n.chave === "rfc-3")?.titulo).toBe("Fila de eventos de transação");
  });
});

describe("linhasDatabase", () => {
  it("cada database tem as colunas combinadas, nesta ordem", () => {
    expect(Object.keys(linhasDatabase(mapa, "pessoas")[0])).toEqual(["Nome", "Cargo", "Área", "E-mail", "Slack", "Papel"]);
    expect(Object.keys(linhasDatabase(mapa, "times")[0]))
      .toEqual(["Nome", "Missão", "Gestor", "Tech lead", "Buddies", "Canal", "Canal de ajuda", "Plantão"]);
    expect(Object.keys(linhasDatabase(mapa, "sistemas")[0]))
      .toEqual(["Nome", "Time", "Linguagem", "O que faz", "Depende de", "Pasta no repo", "Legado"]);
    expect(Object.keys(linhasDatabase(mapa, "rfcs")[0])).toEqual(["Título", "Número", "Autor", "Status", "ADR"]);
  });

  it("uma linha por pessoa, time, sistema e RFC do mapa", () => {
    expect(linhasDatabase(mapa, "pessoas").map((l) => l["Nome"])).toEqual(mapa.pessoas.map((p) => p.nome));
    expect(linhasDatabase(mapa, "times").map((l) => l["Nome"])).toEqual(["Contas", "Livro-razão", "Canais", "Plataforma"]);
    expect(linhasDatabase(mapa, "sistemas").map((l) => l["Nome"])).toEqual(mapa.sistemas.map((s) => s.id));
    expect(linhasDatabase(mapa, "rfcs").map((l) => l["Número"])).toEqual([1, 2, 3]);
  });

  it("pessoa tem a área pelo nome e todos os papéis que tem nos times", () => {
    const pessoa = (m: typeof mapa, nome: string) => linhasDatabase(m, "pessoas").find((l) => l["Nome"] === nome);
    expect(pessoa(mapa, "Beatriz Cavalcanti")).toEqual({
      Nome: "Beatriz Cavalcanti", Cargo: "Engenheira de software sênior", Área: "Livro-razão",
      "E-mail": "beatriz@kota.example", Slack: "Beatriz Cavalcanti", Papel: ["buddy"],
    });
    expect(pessoa(mapa, "Natália Brandão")?.["Papel"]).toEqual(["gestor"]);
    expect(pessoa(mapa, "Ana Lacerda")?.["Papel"]).toEqual([]);
    expect(pessoa(mapa, "Simone Araújo")).toMatchObject({ Área: "People", Papel: [] });
    expect(pessoa(mapa, "Jonas Ferraz")?.["Área"]).toBe("Segurança");
    const thiagoBuddy = { ...mapa, times: mapa.times.map((t) => (t.id === "livro-razao" ? { ...t, buddies: ["beatriz", "thiago"] } : t)) };
    expect(pessoa(thiagoBuddy, "Thiago Nakamura")?.["Papel"]).toEqual(["tech lead", "buddy"]);
  });

  it("time cita gestor, tech lead e buddies pelo nome", () =>
    expect(linhasDatabase(mapa, "times").find((l) => l["Nome"] === "Livro-razão")).toMatchObject({
      Gestor: "Natália Brandão", "Tech lead": "Thiago Nakamura", Buddies: ["Beatriz Cavalcanti"],
      Canal: "#livro-razao", "Canal de ajuda": "#livro-razao-ajuda",
    }));

  it("sistemas têm a pasta no repo como link", () =>
    expect(linhasDatabase(mapa, "sistemas")[0]["Pasta no repo"]).toMatch(/^https:\/\/github\.com\/JucaGF\/kota-bank\/tree\/main\/src\//));

  it("sistema legado aparece marcado, com o time pelo nome e as dependências", () => {
    const sistemas = linhasDatabase(mapa, "sistemas");
    expect(sistemas.find((l) => l["Nome"] === "ledgermonolith")).toEqual({
      Nome: "ledgermonolith", Time: "Livro-razão", Linguagem: "Java",
      "O que faz": "Versão antiga, em monolito, dos três serviços do livro-razão.", "Depende de": ["ledger-db"],
      "Pasta no repo": "https://github.com/JucaGF/kota-bank/tree/main/src/ledgermonolith", Legado: true,
    });
    expect(sistemas.find((l) => l["Nome"] === "ledgerwriter")?.["Legado"]).toBe(false);
  });

  it("RFC 3 aparece como rejeitada e aponta para o ADR 6", () => {
    const rfcs = linhasDatabase(mapa, "rfcs");
    expect(rfcs.find((l) => l["Número"] === 3)).toEqual({
      Título: "Fila de eventos de transação", Número: 3, Autor: "Gustavo Schmitt", Status: "rejeitada",
      ADR: "https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0006-fila-entre-o-ledgerwriter-e-os-leitores.md",
    });
    expect(rfcs.find((l) => l["Número"] === 1)).toMatchObject({
      Status: "virou ADR",
      ADR: "https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0001-quebrar-o-monolito-do-livro-razao-em-tres-servicos.md",
    });
  });
});

describe("resolverLinks", () => {
  const urls = { bonus: "https://kota.notion.site/Bonus-0a1b", rituais: "https://kota.notion.site/Rituais-2c3d" };

  it("resolverLinks troca notion:<chave> pela URL e falha com chave sem URL", () => {
    expect(resolverLinks("Veja [bônus](notion:bonus), [rituais](notion:rituais) e [o ADR](https://github.com/JucaGF/kota-bank).", urls))
      .toBe("Veja [bônus](https://kota.notion.site/Bonus-0a1b), [rituais](https://kota.notion.site/Rituais-2c3d) e [o ADR](https://github.com/JucaGF/kota-bank).");
    expect(() => resolverLinks("[férias](notion:ferias)", urls)).toThrow(/notion:ferias sem URL/);
  });

  it("chave com nome de propriedade de objeto não vira URL", () =>
    expect(() => resolverLinks("[x](notion:constructor)", urls)).toThrow(/notion:constructor sem URL/));
});

describe("regra paginas", () => {
  const OBRIGATORIAS = ARVORE.filter((n) => n.tipo !== "database" && n.chave !== "comece-aqui").map((n) => n.chave);
  const pastaCom = (paginas: Record<string, string>) => {
    const pasta = pastaTemp();
    for (const chave of OBRIGATORIAS) writeFileSync(join(pasta, `${chave}.md`), "# Página\n");
    for (const [chave, md] of Object.entries(paginas)) writeFileSync(join(pasta, `${chave}.md`), md);
    return pasta;
  };
  const checar = (pasta: string, c: ContextoKota = ctx) => criarRegraPaginas(pasta).checar(c);

  it("aceita e-mails do mapa e dos aliases e links para chaves da árvore, sem exigir comece-aqui", () =>
    expect(checar(pastaCom({
      bonus: "Casos individuais: fale com natalia@kota.example ou com People (people@kota.example).\nVeja [promoção](notion:promocao).",
    }))).toEqual([]));

  it("regra paginas acusa e-mail fora do mapa, @handle e chave inexistente", () => {
    const erros = checar(pastaCom({
      ferias: "Escreva para fulano@kota.example ou chame @raissa no Slack.\nVeja [despesas](notion:despesa).",
    }));
    expect(erros).toHaveLength(3);
    expect(erros).toEqual(expect.arrayContaining([
      expect.stringMatching(/ferias\.md.*fulano@kota\.example/),
      expect.stringMatching(/ferias\.md.*@raissa/),
      expect.stringMatching(/ferias\.md.*notion:despesa\b/),
    ]));
  });

  it("acusa e-mail de fora da kota mesmo sem @handle", () =>
    expect(checar(pastaCom({ despesas: "Reembolso: financeiro@empresa.com.br" })))
      .toEqual([expect.stringMatching(/despesas\.md.*financeiro@empresa\.com\.br/)]));

  it("acusa página que falta", () => {
    const pasta = pastaCom({});
    rmSync(join(pasta, "bonus.md"));
    rmSync(join(pasta, "rfc-2.md"));
    const erros = checar(pasta);
    expect(erros).toHaveLength(2);
    expect(erros).toEqual(expect.arrayContaining([expect.stringMatching(/\bbonus\.md/), expect.stringMatching(/\brfc-2\.md/)]));
  });

  it("pasta que ainda não existe: acusa cada página que falta, sem lançar", () =>
    expect(checar(join(pastaTemp(), "paginas"))).toHaveLength(OBRIGATORIAS.length));

  it("com repo, acusa link do kota-bank para caminho que não existe, inclusive com outra caixa", () => {
    const repo = pastaTemp();
    mkdirSync(join(repo, "src/ledger/balancereader"), { recursive: true });
    mkdirSync(join(repo, "docs/adr"), { recursive: true });
    writeFileSync(join(repo, "docs/adr/0006-fila.md"), "");
    const base = "https://github.com/JucaGF/kota-bank";
    const pasta = pastaCom({
      "rfc-3": [
        `[leitor](${base}/tree/main/src/ledger/balancereader/)`,
        `[ADR](${base}/blob/main/docs/adr/0006-fila.md#resultado)`,
        `[sumiu](${base}/blob/main/docs/adr/0009-nada.md)`,
        `[caixa](${base}/tree/main/src/Ledger/balancereader)`,
      ].join("\n"),
    });
    const erros = checar(pasta, { ...ctx, repo });
    expect(erros).toHaveLength(2);
    expect(erros).toEqual(expect.arrayContaining([
      expect.stringMatching(/rfc-3\.md.*docs\/adr\/0009-nada\.md/),
      expect.stringMatching(/rfc-3\.md.*src\/Ledger\/balancereader/),
    ]));
    expect(checar(pasta)).toEqual([]);
  });
});

describe("regra notion-urls", () => {
  const todas = (dominio = "kota") =>
    Object.fromEntries(ARVORE.map((n) => [n.chave, `https://${dominio}.notion.site/${n.chave}-0123abcd`]));
  const checar = (notionUrls: Record<string, string>) => regraNotionUrls.checar({ ...ctx, notionUrls });

  it("aceita toda chave com URL pública no mesmo domínio", () => expect(checar(todas())).toEqual([]));

  it("regra notion-urls acusa URL notion.so e chave sem URL", () => {
    const urls = todas();
    delete urls["ferias"];
    urls["bonus"] = "https://www.notion.so/Bonus-0123abcd";
    urls["deploy"] = "http://kota.notion.site/deploy-0123abcd";
    const erros = checar(urls);
    expect(erros).toHaveLength(3);
    expect(erros).toEqual(expect.arrayContaining([
      expect.stringMatching(/\bferias\b.*sem URL/),
      expect.stringMatching(/\bbonus\b.*www\.notion\.so/),
      expect.stringMatching(/\bdeploy\b.*http:\/\/kota\.notion\.site/),
    ]));
  });

  it("acusa URLs em mais de um domínio", () =>
    expect(checar({ ...todas(), rituais: "https://outra.notion.site/rituais-0123abcd" }))
      .toEqual([expect.stringMatching(/kota\.notion\.site.*outra\.notion\.site/)]));
});
