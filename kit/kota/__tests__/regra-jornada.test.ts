import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { carregarContexto, type ContextoKota } from "../checar/contexto";
import { regras } from "../checar/regras";
import { regraJornada, type TarefaDaJornada } from "../checar/regras/jornada";
import { mapa } from "../mapa";
import { TAREFAS as CATALOGO } from "../tarefas/tarefas";
import { caminhoAdr } from "../tipos";

const URLS = { "rfc-1": "https://kota.notion.site/rfc-1", "quem-somos": "https://kota.notion.site/quem-somos" };
const TAREFAS: TarefaDaJornada[] = [
  { titulo: "Limite de valor por transferência", perfis: ["novo"], sistemas: ["ledgerwriter", "ledger-db"], quemAjuda: ["beatriz", "thiago"] },
];
const blob = (caminho: string) => `https://github.com/JucaGF/kota-bank/blob/main/${caminho}`;
const adr1 = mapa.adrs.find((a) => a.n === 1)!;

function jornada(nodes: object[]): string {
  const pasta = mkdtempSync(join(tmpdir(), "kota-jornada-"));
  const arquivo = join(pasta, "teste.journey.json");
  writeFileSync(arquivo, JSON.stringify({ boards: { b: { nodes, edges: [] } }, moments: [] }));
  return arquivo;
}

function repo(...caminhos: string[]): string {
  const raiz = mkdtempSync(join(tmpdir(), "kota-repo-"));
  for (const c of caminhos) {
    mkdirSync(join(raiz, c, ".."), { recursive: true });
    writeFileSync(join(raiz, c), "x");
  }
  return raiz;
}

const checar = (arquivo: string, repoKota?: string) =>
  regraJornada(TAREFAS).checar({ mapa, repo: repoKota, notionUrls: URLS, jornadas: [arquivo] } satisfies ContextoKota);

const noBom = {
  id: "ledgerwriter",
  kind: "service",
  info: {
    owner: "Thiago Nakamura",
    docs: [{ title: "ADR 1", url: blob(caminhoAdr(adr1)) }, { title: "RFC 1", url: URLS["rfc-1"] }],
    adr: { id: "ADR-0001", title: adr1.titulo, summary: "…", owner: "Thiago Nakamura" },
  },
};
const tarefa = {
  id: "task",
  kind: "task",
  info: {
    role: "Limite de valor por transferência",
    vinculo: "novo",
    bullets: ["Sistemas: ledgerwriter e ledger-db", "Quem ajuda: Beatriz Cavalcanti e Thiago Nakamura"],
  },
};

describe("regra jornada", () => {
  it("aceita nó que cita o ADR 1 e a RFC 1, com tarefa do catálogo (portão 1)", () => {
    expect(checar(jornada([noBom, tarefa]), repo(caminhoAdr(adr1)))).toEqual([]);
  });

  it("acusa doc sem url, ADR com título errado e tarefa fora do catálogo", () => {
    const erros = checar(jornada([
      { id: "a", kind: "service", info: { docs: [{ title: "README" }] } },
      { id: "b", kind: "service", info: { adr: { id: "ADR-0001", title: "Título antigo", summary: "" } } },
      { id: "c", kind: "task", info: { role: "Tarefa inventada", vinculo: "novo" } },
      { ...tarefa, id: "d", info: { ...tarefa.info, vinculo: "transicao" } },
    ]));
    expect(erros).toEqual([
      "teste.journey.json: nó a: doc \"README\" sem url",
      `teste.journey.json: nó b: ADR-0001 com título "Título antigo", no mapa "${adr1.titulo}"`,
      "teste.journey.json: nó c: tarefa \"Tarefa inventada\" fora do catálogo de primeira tarefa",
      "teste.journey.json: nó d: tarefa \"Limite de valor por transferência\" não é do vínculo transicao",
    ]);
  });

  it("acusa tarefa cujos sistemas e quem ajuda não são os da issue do catálogo", () => {
    const erros = checar(jornada([
      { ...tarefa, info: { ...tarefa.info, bullets: ["Sistemas: só o ledgerwriter", "Quem ajuda: Beatriz Cavalcanti e Gustavo Schmitt"] } },
    ]));
    expect(erros).toEqual([
      "teste.journey.json: nó task: tarefa \"Limite de valor por transferência\" sem o sistema ledger-db em \"Sistemas:\"",
      "teste.journey.json: nó task: tarefa \"Limite de valor por transferência\" sem Thiago Nakamura em \"Quem ajuda:\", como na issue",
      "teste.journey.json: nó task: tarefa \"Limite de valor por transferência\" com Gustavo Schmitt em \"Quem ajuda:\", que a issue não cita",
    ]);
  });

  it("o check:kota confere a tarefa contra o catálogo publicado", () => {
    const daKota = regras.find((r) => r.nome === "jornada")!;
    const nome = (id: string) => mapa.pessoas.find((p) => p.id === id)!.nome;
    const nos = CATALOGO.map((t) => ({
      id: t.chave,
      kind: "task",
      info: { role: t.titulo, vinculo: t.perfis[0], bullets: [`Sistemas: ${t.sistemas.join(", ")}`, `Quem ajuda: ${t.quemAjuda.map(nome).join(" e ")}`] },
    }));
    expect(daKota.checar({ mapa, notionUrls: URLS, jornadas: [jornada(nos)] })).toEqual([]);
  });

  it("acusa url fora do kit e arquivo do repo que não existe", () => {
    const erros = checar(jornada([{ id: "a", kind: "service", info: { docs: [
      { title: "Fora", url: "https://example.com/x" },
      { title: "Sumiu", url: blob("docs/runbooks/nao-existe.md") },
    ] } }]), repo());
    expect(erros).toEqual([
      "teste.journey.json: nó a: doc \"Fora\" com url fora do kit (https://example.com/x)",
      "teste.journey.json: nó a: doc \"Sumiu\" aponta para docs/runbooks/nao-existe.md, que não existe no repo",
    ]);
  });

  it("acusa ADR que não existe no mapa e responsável fora da empresa", () => {
    const erros = checar(jornada([
      { id: "a", kind: "service", info: { owner: "Fulano de Tal", adr: { id: "ADR-012", title: "x", summary: "" } } },
    ]));
    expect(erros).toEqual([
      "teste.journey.json: nó a: ADR-012 não é um ADR do mapa (ADR-0001 a ADR-0007)",
      "teste.journey.json: nó a: responsável \"Fulano de Tal\" não é uma pessoa da Kota",
    ]);
  });

  it("aceita responsável vindo do perfil ({gestor})", () => {
    expect(checar(jornada([{ id: "t", kind: "team", info: { owner: "{gestor}" } }]))).toEqual([]);
  });

  it("a jornada de demo passa, com a regra como o check:kota roda", () => {
    const daKota = regras.find((r) => r.nome === "jornada")!;
    expect(daKota.precisaRepo).toBe(false);
    expect(daKota.checar(carregarContexto(join(import.meta.dirname, "../../..")))).toEqual([]);
  });
});
