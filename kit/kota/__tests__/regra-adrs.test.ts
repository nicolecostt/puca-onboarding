import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checarKota } from "../checar/checar";
import type { ContextoKota } from "../checar/contexto";
import { regras } from "../checar/regras";
import { regraAdrs } from "../checar/regras/adrs";
import { mapa } from "../mapa";
import { type AdrKota, caminhoAdr } from "../tipos";

const URLS = {
  "rfc-1": "https://kota.notion.site/rfc-1-separar-o-livro-razao",
  "rfc-2": "https://kota.notion.site/rfc-2-banco-de-contas",
  "rfc-3": "https://kota.notion.site/rfc-3-fila-de-eventos",
};
const PASTAS = ["src/ledgermonolith", "src/ledger/balancereader", "src/ledger/transactionhistory", "src/ledger/ledger-db", "src/accounts/userservice", "src/accounts/accounts-db"];

const adr = (n: number) => mapa.adrs.find((a) => a.n === n)!;
const nomeDoTime = (a: AdrKota) => mapa.times.find((t) => t.id === a.time)!.nome;

function textoAdr(a: AdrKota, rfc = a.rfc && URLS[`rfc-${a.rfc}` as keyof typeof URLS]): string {
  return [
    `# ADR-${String(a.n).padStart(4, "0")}: ${a.titulo}`,
    "",
    `- Status: ${a.status}`,
    "- Data: 2024-03",
    `- Time: ${nomeDoTime(a)}`,
    ...(rfc ? [`- RFC: ${rfc}`] : []),
    "",
    "## Contexto",
    "",
    "## Decisão",
    "",
    "## Consequências",
    "",
    "## Onde ver no código",
    "",
    ...a.ancoras.map((c) => `- \`${c}\``),
    "",
  ].join("\n");
}

function repoKota(troca: Record<number, string> = {}): string {
  const repo = mkdtempSync(join(tmpdir(), "kota-adrs-"));
  for (const p of PASTAS) mkdirSync(join(repo, p), { recursive: true });
  writeFileSync(join(repo, "docker-compose.yml"), "services: {}\n");
  mkdirSync(join(repo, "docs/adr"), { recursive: true });
  for (const a of mapa.adrs) writeFileSync(join(repo, caminhoAdr(a)), troca[a.n] ?? textoAdr(a));
  return repo;
}

const checar = (repo: string, notionUrls: Record<string, string> = URLS) =>
  regraAdrs.checar({ mapa, repo, notionUrls, jornadas: [] } satisfies ContextoKota);

it("aceita os ADRs iguais ao mapa", () => expect(checar(repoKota())).toEqual([]));

it("roda no check:kota só com --repo", () =>
  expect(checarKota({ mapa, notionUrls: URLS, jornadas: [] }, regras).pulas).toContain("adrs: sem --repo"));

describe("arquivos", () => {
  it("acusa ADR do mapa sem arquivo", () => {
    const repo = repoKota();
    rmSync(join(repo, "docs/adr/0007-ambiente-local-com-docker-compose-construido-do-codigo.md"));
    expect(checar(repo)).toEqual(["ADR 7: docs/adr/0007-ambiente-local-com-docker-compose-construido-do-codigo.md não existe"]);
  });

  it("acusa arquivo de ADR fora do mapa", () => {
    const repo = repoKota();
    writeFileSync(join(repo, "docs/adr/0008-nova-decisao.md"), "# ADR-0008: Nova decisão\n");
    expect(checar(repo)).toEqual(["docs/adr/0008-nova-decisao.md: fora do mapa; ADR novo entra primeiro no mapa.ts"]);
  });
});

describe("cabeçalho", () => {
  it("acusa título diferente do mapa", () => {
    const repo = repoKota({ 1: textoAdr(adr(1)).replace("Quebrar o monolito do livro-razão em três serviços", "X") });
    expect(checar(repo)).toEqual(['ADR 1: título "X" no arquivo, "Quebrar o monolito do livro-razão em três serviços" no mapa']);
  });

  it("acusa primeira linha fora do formato", () => {
    const repo = repoKota({ 1: textoAdr(adr(1)).replace("# ADR-0001: ", "# ") });
    expect(checar(repo)).toEqual([
      'ADR 1: primeira linha "# Quebrar o monolito do livro-razão em três serviços", esperado "# ADR-0001: Quebrar o monolito do livro-razão em três serviços"',
    ]);
  });

  it("acusa status diferente e time faltando", () => {
    const repo = repoKota({ 6: textoAdr(adr(6)).replace("- Status: rejeitado", "- Status: aceito").replace("- Time: Livro-razão\n", "") });
    expect(checar(repo)).toEqual(['ADR 6: Status "aceito" no arquivo, "rejeitado" no mapa', 'ADR 6: falta a linha "- Time: Livro-razão"']);
  });
});

describe("RFC", () => {
  it("acusa RFC sem URL, mesmo com a marca notion:rfc-n no lugar da URL", () => {
    const repo = repoKota({ 1: textoAdr(adr(1), "notion:rfc-1"), 3: textoAdr(adr(3), "notion:rfc-2") });
    expect(checar(repo, {})).toEqual(["ADR 1: RFC 1 sem URL em urls.json", "ADR 3: RFC 2 sem URL em urls.json", "ADR 6: RFC 3 sem URL em urls.json"]);
  });

  it("acusa RFC com URL diferente", () => {
    const repo = repoKota({ 1: textoAdr(adr(1), "notion:rfc-1") });
    expect(checar(repo)).toEqual([`ADR 1: RFC "notion:rfc-1" no arquivo, "${URLS["rfc-1"]}" em urls.json`]);
  });

  it("acusa linha RFC faltando quando o mapa tem RFC", () => {
    const repo = repoKota({ 3: textoAdr(adr(3), "") });
    expect(checar(repo)).toEqual([`ADR 3: falta a linha "- RFC: ${URLS["rfc-2"]}"`]);
  });

  it("acusa linha RFC em ADR que não tem RFC no mapa", () => {
    const repo = repoKota({ 2: textoAdr(adr(2), "https://kota.notion.site/rfc-inventado") });
    expect(checar(repo)).toEqual(["ADR 2: linha RFC, mas o mapa não dá RFC ao ADR 2"]);
  });
});

describe("onde ver no código", () => {
  it("acusa âncora que não existe no repo", () => {
    const repo = repoKota();
    rmSync(join(repo, "src/ledger/balancereader"), { recursive: true });
    expect(checar(repo)).toEqual(["ADR 4: âncora src/ledger/balancereader não existe no repo", "ADR 6: âncora src/ledger/balancereader não existe no repo"]);
  });

  it("acusa caminho de pacote Java que a troca de marca renomeou", () => {
    const repo = repoKota({ 4: `${textoAdr(adr(4))}- \`src/ledger/balancereader/src/main/java/pacote/antigo/BalanceReader.java\`\n` });
    mkdirSync(join(repo, "src/ledger/balancereader/src/main/java/br/com/kota"), { recursive: true });
    writeFileSync(join(repo, "src/ledger/balancereader/src/main/java/br/com/kota/BalanceReader.java"), "");
    expect(checar(repo)).toEqual(["ADR 4: âncora src/ledger/balancereader/src/main/java/pacote/antigo/BalanceReader.java não existe no repo"]);
  });

  it("acusa caminho com outra caixa, como o GitHub, mesmo em disco que não diferencia", () => {
    const repo = repoKota({ 4: `${textoAdr(adr(4))}- \`src/ledger/BalanceReader\`\n` });
    expect(checar(repo)).toEqual(["ADR 4: âncora src/ledger/BalanceReader não existe no repo"]);
  });

  it("acusa âncora do mapa que falta na seção", () => {
    const repo = repoKota({ 1: textoAdr(adr(1)).replace("- `src/ledgermonolith`\n", "") });
    expect(checar(repo)).toEqual(['ADR 1: âncora src/ledgermonolith do mapa falta em "Onde ver no código"']);
  });

  it("aceita pasta escrita com barra no fim e texto depois do caminho", () => {
    const repo = repoKota({ 5: textoAdr(adr(5)).replace("- `src/ledger`", "- `src/ledger/`: os serviços em Java") });
    expect(checar(repo)).toEqual([]);
  });

  it("acusa ADR sem a seção", () => {
    const repo = repoKota({ 7: textoAdr(adr(7)).replace(/## Onde ver no código[\s\S]*/, "") });
    expect(checar(repo)).toEqual(['ADR 7: falta a seção "## Onde ver no código"']);
  });
});

describe("@handle", () => {
  it("acusa @handle", () => {
    const repo = repoKota({ 2: textoAdr(adr(2)).replace("## Decisão\n", "## Decisão\n\nCombinado com @thiago e (@nadia).\n") });
    expect(checar(repo)).toEqual([
      "ADR 2: cita @thiago; pessoas são citadas pelo nome",
      "ADR 2: cita @nadia; pessoas são citadas pelo nome",
    ]);
  });

  it("não confunde e-mail nem código entre crases com @handle", () => {
    const corpo = "## Decisão\n\nDúvidas para plataforma@kota.example. O `@Scheduled` relê o banco.\n\n```java\n@RestController\nclass X {}\n```\n";
    const repo = repoKota({ 4: textoAdr(adr(4)).replace("## Decisão\n", corpo) });
    expect(checar(repo)).toEqual([]);
  });
});
