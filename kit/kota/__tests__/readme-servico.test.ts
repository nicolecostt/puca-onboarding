import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checarKota } from "../checar/checar";
import type { ContextoKota } from "../checar/contexto";
import { regras } from "../checar/regras";
import { regraCodeowners } from "../checar/regras/codeowners";
import { regraReadmes } from "../checar/regras/readmes";
import { gerarCodeowners } from "../gerar/codeowners";
import { aplicarBlocos, blocoServico } from "../gerar/readme-servico";
import { mapa } from "../mapa";
import type { MapaKota } from "../tipos";

const BLOCO_LEDGERWRITER = [
  "<!-- kota:servico:inicio -->",
  "",
  "**Time:** Livro-razão (#livro-razao)",
  "",
  "**Responsáveis:** Thiago Nakamura (tech lead), Natália Brandão (gestor)",
  "",
  "**Depende de:** balancereader, ledger-db",
  "",
  "**Como rodar:** `docker compose up --build ledgerwriter`",
  "",
  "**Como testar:** `scripts/testar.sh ledgerwriter`",
  "",
  "<!-- kota:servico:fim -->",
].join("\n");

const BLOCO_ACCOUNTS_DB = [
  "<!-- kota:servico:inicio -->",
  "",
  "**Time:** Contas (#contas)",
  "",
  "**Responsáveis:** Rodrigo Queiroz (tech lead), Camila Azevedo (gestor)",
  "",
  "**Depende de:** nada",
  "",
  "**Como rodar:** `docker compose up --build accounts-db`",
  "",
  "**Como testar:** sem testes automatizados",
  "",
  "<!-- kota:servico:fim -->",
].join("\n");

const README_LEDGERWRITER = "src/ledger/ledgerwriter/README.md";

function repoKota(): string {
  const repo = mkdtempSync(join(tmpdir(), "kota-readmes-"));
  for (const s of mapa.sistemas) mkdirSync(join(repo, s.pasta), { recursive: true });
  return repo;
}

const ler = (repo: string, caminho: string) => readFileSync(join(repo, caminho), "utf8");
const lerTodos = (repo: string) => mapa.sistemas.map((s) => ler(repo, `${s.pasta}/README.md`));

function repoComReadmes(): string {
  const repo = repoKota();
  aplicarBlocos(repo, mapa);
  for (const s of mapa.sistemas) appendFileSync(join(repo, s.pasta, "README.md"), `\n## O que faz\n\n${s.oQueFaz}\n`);
  return repo;
}

describe("blocoServico", () => {
  it("bloco com time, canal, responsáveis e dependências do mapa", () =>
    expect(blocoServico(mapa, "ledgerwriter")).toBe(BLOCO_LEDGERWRITER));

  it("sistema sem testes diz 'sem testes automatizados'", () =>
    expect(blocoServico(mapa, "accounts-db")).toBe(BLOCO_ACCOUNTS_DB));

  it("sistema legado não manda subir pelo docker compose, que não tem ele", () =>
    expect(blocoServico(mapa, "ledgermonolith").split("\n")).toContain("**Como rodar:** legado, fora do docker compose"));
});

describe("aplicarBlocos", () => {
  it("cria README que não existe com título e bloco", () => {
    const repo = repoKota();
    expect(aplicarBlocos(repo, mapa)).toEqual(mapa.sistemas.map((s) => `${s.pasta}/README.md`));
    expect(ler(repo, README_LEDGERWRITER)).toBe(`# ledgerwriter\n\n${BLOCO_LEDGERWRITER}\n`);
  });

  it("troca só o bloco e mantém o texto escrito à mão", () => {
    const repo = repoKota();
    const velho = "<!-- kota:servico:inicio -->\n\n**Time:** Contas (#contas)\n\n<!-- kota:servico:fim -->";
    writeFileSync(join(repo, README_LEDGERWRITER), `# ledgerwriter\n\n${velho}\n\n## O que faz\n\nGrava as transações.\n\n- \`src/ledger/ledgerwriter\`\n`);
    aplicarBlocos(repo, mapa);
    expect(ler(repo, README_LEDGERWRITER)).toBe(`# ledgerwriter\n\n${BLOCO_LEDGERWRITER}\n\n## O que faz\n\nGrava as transações.\n\n- \`src/ledger/ledgerwriter\`\n`);
  });

  it("README do upstream ganha o id no título e o bloco embaixo, sem perder o texto", () => {
    const repo = repoKota();
    writeFileSync(join(repo, README_LEDGERWRITER), "# Ledger Writer Service\n\nThe ledger writer service accepts transactions.\n");
    aplicarBlocos(repo, mapa);
    expect(ler(repo, README_LEDGERWRITER)).toBe(`# ledgerwriter\n\n${BLOCO_LEDGERWRITER}\n\nThe ledger writer service accepts transactions.\n`);
  });

  it("rodar de novo não muda nada", () => {
    const repo = repoComReadmes();
    const antes = lerTodos(repo);
    expect(aplicarBlocos(repo, mapa)).toEqual([]);
    expect(lerTodos(repo)).toEqual(antes);
  });

  it("trocar o tech lead no mapa atualiza os READMEs do time e o CODEOWNERS sem tocar no texto à mão", () => {
    const repo = repoComReadmes();
    mkdirSync(join(repo, ".github"));
    writeFileSync(join(repo, ".github/CODEOWNERS"), gerarCodeowners(mapa));
    const novo: MapaKota = { ...mapa, times: mapa.times.map((t) => (t.id === "livro-razao" ? { ...t, techLead: "beatriz" } : t)) };
    const ctx: ContextoKota = { mapa: novo, repo, notionUrls: {}, jornadas: [] };
    expect(checarKota(ctx, [regraReadmes, regraCodeowners]).erros).toHaveLength(6);

    expect(aplicarBlocos(repo, novo)).toEqual([
      "src/ledger/ledgerwriter/README.md",
      "src/ledger/balancereader/README.md",
      "src/ledger/transactionhistory/README.md",
      "src/ledger/ledger-db/README.md",
      "src/ledgermonolith/README.md",
    ]);
    writeFileSync(join(repo, ".github/CODEOWNERS"), gerarCodeowners(novo));
    expect(checarKota(ctx, [regraReadmes, regraCodeowners]).erros).toEqual([]);
    expect(ler(repo, README_LEDGERWRITER)).toBe(
      `# ledgerwriter\n\n${BLOCO_LEDGERWRITER.replace("Thiago Nakamura", "Beatriz Cavalcanti")}\n\n## O que faz\n\nValida e grava as transações no livro-razão.\n`,
    );
  });

  it("não cria a pasta de um sistema que falta no repo nem grava os outros READMEs", () => {
    const repo = repoKota();
    rmSync(join(repo, "src/ledgermonolith"), { recursive: true });
    expect(() => aplicarBlocos(repo, mapa)).toThrow(/src\/ledgermonolith/);
    expect(existsSync(join(repo, "src/ledgermonolith"))).toBe(false);
    expect(existsSync(join(repo, README_LEDGERWRITER))).toBe(false);
  });
});

describe("regra readmes", () => {
  const checar = (repo: string) => regraReadmes.checar({ mapa, repo, notionUrls: {}, jornadas: [] });
  const gerar = (repo: string) => `gere com npm run kota:readmes -- ${repo}`;

  it("aceita os READMEs gerados com a seção 'O que faz'", () => expect(checar(repoComReadmes())).toEqual([]));

  it("roda no check:kota só com --repo", () =>
    expect(checarKota({ mapa, notionUrls: {}, jornadas: [] }, regras).pulas).toContain("readmes: sem --repo"));

  it("regra acusa bloco editado à mão", () => {
    const repo = repoComReadmes();
    writeFileSync(join(repo, README_LEDGERWRITER), ler(repo, README_LEDGERWRITER).replace("Thiago Nakamura (tech lead)", "Thiago (tech lead)"));
    expect(checar(repo)).toEqual([`${README_LEDGERWRITER}: bloco difere do gerado do mapa; ${gerar(repo)}`]);
  });

  it("acusa README que não abre com o título do id e o bloco", () => {
    const repo = repoComReadmes();
    writeFileSync(join(repo, README_LEDGERWRITER), ler(repo, README_LEDGERWRITER).replace("# ledgerwriter", "# Ledger Writer Service"));
    expect(checar(repo)).toEqual([`${README_LEDGERWRITER}: não abre com "# ledgerwriter" e o bloco do mapa; ${gerar(repo)}`]);
  });

  it("acusa README que falta e seção 'O que faz' que falta", () => {
    const repo = repoComReadmes();
    rmSync(join(repo, "src/frontend/README.md"));
    writeFileSync(join(repo, README_LEDGERWRITER), ler(repo, README_LEDGERWRITER).replace("## O que faz", "## Visão geral"));
    expect(checar(repo)).toEqual([
      `src/frontend/README.md não existe; ${gerar(repo)}`,
      `${README_LEDGERWRITER}: falta a seção "## O que faz"`,
    ]);
  });
});

describe("CLI", () => {
  const rodar = (...args: string[]) =>
    spawnSync("node_modules/.bin/tsx", ["kit/kota/gerar/readme-servico.ts", ...args], { cwd: fileURLToPath(new URL("../../..", import.meta.url)), encoding: "utf8" });

  it("grava os blocos no repo pedido e lista os READMEs que mudaram", () => {
    const repo = repoKota();
    const r = rodar(repo);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(README_LEDGERWRITER);
    expect(ler(repo, README_LEDGERWRITER)).toBe(`# ledgerwriter\n\n${BLOCO_LEDGERWRITER}\n`);
    expect(rodar(repo).stdout).not.toContain(README_LEDGERWRITER);
  });

  it("sem repo ou com repo que não existe, falha e diz por quê", () => {
    expect(rodar()).toMatchObject({ status: 1, stderr: expect.stringMatching(/uso: npm run kota:readmes -- <raiz do repo>/) });
    expect(rodar(join(repoKota(), "nada"))).toMatchObject({ status: 1, stderr: expect.stringMatching(/não existe/) });
  });
});
