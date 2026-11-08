import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { carregarContexto, type ContextoKota } from "../checar/contexto";
import { regras } from "../checar/regras";
import { regraJornada, type TarefaDaJornada } from "../checar/regras/jornada";
import { mapa } from "../mapa";
import { caminhoAdr } from "../tipos";

const URLS = { "rfc-1": "https://kota.notion.site/rfc-1", "quem-somos": "https://kota.notion.site/quem-somos" };
const TAREFAS: TarefaDaJornada[] = [{ titulo: "Limite de valor por transferência", perfis: ["novo"] }];
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
const tarefa = { id: "task", kind: "task", info: { role: "Limite de valor por transferência", vinculo: "novo" } };

describe("regra jornada", () => {
  it("aceita nó que cita o ADR 1 e a RFC 1, com tarefa do catálogo (portão 1)", () => {
    expect(checar(jornada([noBom, tarefa]), repo(caminhoAdr(adr1)))).toEqual([]);
  });

  it("acusa doc sem url, ADR com título errado e tarefa fora do catálogo", () => {
    const erros = checar(jornada([
      { id: "a", kind: "service", info: { docs: [{ title: "README" }] } },
      { id: "b", kind: "service", info: { adr: { id: "ADR-0001", title: "Título antigo", summary: "" } } },
      { id: "c", kind: "task", info: { role: "Tarefa inventada", vinculo: "novo" } },
      { id: "d", kind: "task", info: { role: "Limite de valor por transferência", vinculo: "transicao" } },
    ]));
    expect(erros).toEqual([
      "teste.journey.json: nó a: doc \"README\" sem url",
      `teste.journey.json: nó b: ADR-0001 com título "Título antigo", no mapa "${adr1.titulo}"`,
      "teste.journey.json: nó c: tarefa \"Tarefa inventada\" fora do catálogo de primeira tarefa",
      "teste.journey.json: nó d: tarefa \"Limite de valor por transferência\" não é do vínculo transicao",
    ]);
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
