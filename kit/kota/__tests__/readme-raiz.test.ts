import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checarKota } from "../checar/checar";
import type { ContextoKota } from "../checar/contexto";
import { regras } from "../checar/regras";
import { regraReadmeRaiz } from "../checar/regras/readme-raiz";
import { tabelaSistemas, trocarSistemas } from "../gerar/readme-raiz";
import { mapa } from "../mapa";
import type { MapaKota } from "../tipos";

const m: MapaKota = {
  ...mapa,
  sistemas: [
    { id: "frontend", pasta: "src/frontend", time: "canais", linguagem: "Python", oQueFaz: "Site do banco.", dependeDe: [] },
    { id: "ledger-db", pasta: "src/ledger/ledger-db", time: "livro-razao", linguagem: "Postgres", oQueFaz: "Banco do livro-razão.", dependeDe: [] },
  ],
};
const TABELA = [
  "| Serviço | Linguagem | O que faz | Time |",
  "|---|---|---|---|",
  "| [frontend](src/frontend) | Python | Site do banco. | Canais |",
  "| [ledger-db](src/ledger/ledger-db) | Postgres | Banco do livro-razão. | Livro-razão |",
].join("\n");
const README = "# Kota\n\nAntes.\n\n<!-- kota:sistemas:inicio -->\ntabela velha\n<!-- kota:sistemas:fim -->\n\nDepois.\n";

const ctx = (repo?: string): ContextoKota => ({ mapa, repo, notionUrls: {}, jornadas: [] });
function repoComReadme(texto?: string): string {
  const repo = mkdtempSync(join(tmpdir(), "kota-readme-"));
  if (texto !== undefined) writeFileSync(join(repo, "README.md"), texto);
  return repo;
}

it("uma linha por sistema com o nome do time", () => expect(tabelaSistemas(m)).toBe(TABELA));

it("troca só o que está entre os marcadores", () =>
  expect(trocarSistemas(README, m)).toBe(
    `# Kota\n\nAntes.\n\n<!-- kota:sistemas:inicio -->\n\n${TABELA}\n\n<!-- kota:sistemas:fim -->\n\nDepois.\n`,
  ));

it("sem os dois marcadores, não troca", () => {
  expect(trocarSistemas("# Kota\n", m)).toBeUndefined();
  expect(trocarSistemas("<!-- kota:sistemas:inicio -->\n", m)).toBeUndefined();
});

describe("regra readme-raiz", () => {
  it("aceita a tabela gerada do mapa", () =>
    expect(regraReadmeRaiz.checar(ctx(repoComReadme(trocarSistemas(README, mapa))))).toEqual([]));

  it("acusa tabela desatualizada", () => {
    const erros = regraReadmeRaiz.checar(ctx(repoComReadme(README)));
    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/npm run kota:readme-raiz -- /);
  });

  it("acusa README sem os marcadores e README que não existe", () => {
    expect(regraReadmeRaiz.checar(ctx(repoComReadme("# Kota\n")))).toHaveLength(1);
    expect(regraReadmeRaiz.checar(ctx(repoComReadme()))).toHaveLength(1);
  });

  it("roda no check:kota só com --repo", () => expect(checarKota(ctx(), regras).pulas).toContain("readme-raiz: sem --repo"));
});

describe("CLI", () => {
  const rodar = (...args: string[]) =>
    spawnSync("node_modules/.bin/tsx", ["kit/kota/gerar/readme-raiz.ts", ...args], {
      cwd: fileURLToPath(new URL("../../..", import.meta.url)),
      encoding: "utf8",
    });

  it("grava a tabela do mapa no README da raiz", () => {
    const repo = repoComReadme(README);
    expect(rodar(repo).status).toBe(0);
    expect(regraReadmeRaiz.checar(ctx(repo))).toEqual([]);
    expect(readFileSync(join(repo, "README.md"), "utf8")).toMatch(/^# Kota\n\nAntes\.\n\n<!-- kota:sistemas:inicio -->\n\n\| Serviço /);
  });

  it("sem os marcadores, falha e não mexe no README", () => {
    const repo = repoComReadme("# Kota\n");
    const r = rodar(repo);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/<!-- kota:sistemas:inicio -->/);
    expect(readFileSync(join(repo, "README.md"), "utf8")).toBe("# Kota\n");
  });

  it("sem raiz, falha e diz como usar", () => {
    const r = rodar();
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/kota:readme-raiz -- <raiz do repo>/);
  });
});
