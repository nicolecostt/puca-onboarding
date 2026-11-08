import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checarKota } from "../checar/checar";
import { regras } from "../checar/regras";
import { regraAutores } from "../checar/regras/autores";
import { arquivosSemPasso, PLANO_HISTORIA, type PassoHistoria } from "../historia/plano";
import { publicarHistoria } from "../historia/publicar";
import { mapa } from "../mapa";
import { arquivosDoRepo } from "../repo";
import { caminhoAdr } from "../tipos";
import { repoGit } from "./repo-git";

const git = (raiz: string, ...args: string[]) => execFileSync("git", args, { cwd: raiz, encoding: "utf8" }).trim();
const pessoa = (id: string) => mapa.pessoas.find((p) => p.id === id)!;
const assinatura = (id: string) => `${pessoa(id).nome} <${pessoa(id).email}>`;

function commitar(raiz: string, autor: string, committer = autor) {
  const [an, ae] = /^(.*) <(.*)>$/.exec(autor)!.slice(1);
  const [cn, ce] = /^(.*) <(.*)>$/.exec(committer)!.slice(1);
  git(raiz, "add", "-A");
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-q", "--allow-empty", "-m", `commit de ${an}`], {
    cwd: raiz,
    env: { ...process.env, GIT_AUTHOR_NAME: an, GIT_AUTHOR_EMAIL: ae, GIT_COMMITTER_NAME: cn, GIT_COMMITTER_EMAIL: ce },
  });
}

const GITHUB = "GitHub <noreply@github.com>";

function oficina(extra: Record<string, string> = {}): string {
  const raiz = repoGit({
    "LICENSE": "licença\n",
    "README.md": "# Kota\n",
    "scripts/testar.sh": "#!/bin/sh\n",
    "src/a/app.py": "print(1)\n",
    "src/a/README.md": "# a\n",
    "docs/adr/0001-x.md": "# ADR-0001: x\n",
    ...extra,
  });
  chmodSync(join(raiz, "scripts/testar.sh"), 0o755);
  commitar(raiz, GITHUB);
  return raiz;
}

function publico(arquivos: Record<string, string> = { "README.md": "# kota-bank\n", "LICENSE": "licença\n" }): string {
  const raiz = repoGit(arquivos);
  commitar(raiz, GITHUB);
  return raiz;
}

const PLANO: PassoHistoria[] = [
  { autor: "nadia", mensagem: "chore(plataforma): licença", caminhos: ["LICENSE"] },
  { autor: "vinicius", mensagem: "feat(plataforma): scripts", caminhos: ["scripts/**"] },
  { autor: "rodrigo", mensagem: "feat(contas): serviço a", caminhos: ["src/a", "!**/README.md"] },
  { autor: "thiago", mensagem: "docs(livro-razao): adr 1", caminhos: ["docs/adr/*.md"] },
  { autor: "nadia", mensagem: "docs(plataforma): readmes", caminhos: ["**/README.md"] },
];

const depoisDaRaiz = (raiz: string) =>
  git(raiz, "log", "--reverse", "--format=%an <%ae>|%cn <%ce>|%s").split("\n").slice(1);

describe("publicarHistoria", () => {
  it("lista arquivos sem passo e não commita nada", () => {
    const of = oficina({ "Makefile": "all:\n", "src/b/x.py": "" });
    const pub = publico();
    expect(arquivosSemPasso(arquivosDoRepo(of), PLANO)).toEqual(["Makefile", "src/b/x.py"]);
    expect(() => publicarHistoria(of, pub, PLANO, mapa)).toThrow(/Makefile[\s\S]*src\/b\/x\.py/);
    expect(git(pub, "rev-list", "--count", "HEAD")).toBe("1");
    expect(git(pub, "status", "--porcelain")).toBe("");
  });

  it("para antes do primeiro commit se um autor não está no mapa", () => {
    const pub = publico();
    expect(() => publicarHistoria(oficina(), pub, [...PLANO, { autor: "fulano", mensagem: "x", caminhos: [] }], mapa)).toThrow(/fulano/);
    expect(git(pub, "rev-list", "--count", "HEAD")).toBe("1");
  });

  it("para antes do primeiro commit se a oficina tem alteração fora de commit", () => {
    const of = oficina();
    writeFileSync(join(of, "docs/adr/0002-y.md"), "# ADR-0002: y\n");
    writeFileSync(join(of, "LICENSE"), "licença nova\n");
    const pub = publico();
    expect(() => publicarHistoria(of, pub, PLANO, mapa)).toThrow(/LICENSE[\s\S]*docs\/adr\/0002-y\.md/);
    expect(git(pub, "rev-list", "--count", "HEAD")).toBe("1");
  });

  it("diz a branch e o commit da oficina publicados e as branches locais que ficaram de fora", () => {
    const of = oficina();
    git(of, "checkout", "-q", "-b", "onda");
    git(of, "branch", "integrada");
    git(of, "checkout", "-q", "-b", "fix");
    commitar(of, GITHUB);
    git(of, "checkout", "-q", "onda");
    const { oficina: origem } = publicarHistoria(of, publico(), PLANO, mapa);
    expect(origem).toEqual({ branch: "onda", commit: git(of, "rev-parse", "HEAD"), branchesFora: ["fix"] });
  });

  it("um commit por passo com diferença, com autor e committer do mapa", () => {
    const pub = publico();
    const { commits } = publicarHistoria(oficina(), pub, PLANO, mapa);
    expect(depoisDaRaiz(pub)).toEqual(
      PLANO.slice(1).map((p) => `${assinatura(p.autor)}|${assinatura(p.autor)}|${p.mensagem}`),
    );
    expect(commits).toEqual(git(pub, "rev-list", "--reverse", "HEAD").split("\n").slice(1));
  });

  it("a árvore final é igual à da oficina", () => {
    const of = oficina();
    const pub = publico({ "README.md": "# kota-bank\n", "velho.txt": "some\n" });
    publicarHistoria(of, pub, PLANO, mapa);
    expect(git(pub, "status", "--porcelain")).toBe("");
    expect(git(pub, "ls-files").split("\n").sort()).toEqual(arquivosDoRepo(of));
    for (const a of arquivosDoRepo(of)) expect(readFileSync(join(pub, a), "utf8")).toBe(readFileSync(join(of, a), "utf8"));
    expect(git(pub, "ls-files", "-s", "scripts/testar.sh")).toMatch(/^100755 /);
  });

  it("rodar de novo não cria commit", () => {
    const of = oficina();
    const pub = publico();
    publicarHistoria(of, pub, PLANO, mapa);
    const antes = git(pub, "rev-parse", "HEAD");
    expect(publicarHistoria(of, pub, PLANO, mapa).commits).toEqual([]);
    expect(git(pub, "rev-parse", "HEAD")).toBe(antes);
  });

  it("passo novo no fim gera só o commit novo", () => {
    const of = oficina();
    const pub = publico();
    publicarHistoria(of, pub, PLANO, mapa);
    writeFileSync(join(of, "CODEOWNERS"), "* plataforma@kota.example\n");
    commitar(of, GITHUB);
    const novo: PassoHistoria = { autor: "eduardo", mensagem: "chore(plataforma): codeowners", caminhos: ["CODEOWNERS"] };
    expect(publicarHistoria(of, pub, [...PLANO, novo], mapa).commits).toHaveLength(1);
    expect(depoisDaRaiz(pub).at(-1)).toBe(`${assinatura("eduardo")}|${assinatura("eduardo")}|${novo.mensagem}`);
  });
});

describe("PLANO_HISTORIA", () => {
  const mensagem = /^(feat|fix|docs|chore|ci|build|refactor|test)\((contas|livro-razao|canais|plataforma)\): [a-zà-ú0-9]/;

  it("tem 15 a 25 passos, de pessoas do mapa, com mensagem tipo(área): texto", () => {
    expect(PLANO_HISTORIA.length).toBeGreaterThanOrEqual(15);
    expect(PLANO_HISTORIA.length).toBeLessThanOrEqual(25);
    for (const p of PLANO_HISTORIA) {
      expect(pessoa(p.autor), p.autor).toBeDefined();
      expect(p.mensagem).toMatch(mensagem);
    }
  });

  it("a pessoa do perfil novo não aparece no histórico", () =>
    expect(PLANO_HISTORIA.map((p) => p.autor)).not.toContain(mapa.perfis.novo.pessoa));

  it("o ledgermonolith vem antes dos três serviços do livro-razão", () => {
    const passo = (arquivo: string) => PLANO_HISTORIA.findIndex((p) => arquivosSemPasso([arquivo], [p]).length === 0);
    const monolito = passo("src/ledgermonolith/pom.xml");
    for (const s of ["ledgerwriter", "balancereader", "transactionhistory"]) expect(monolito).toBeLessThan(passo(`src/ledger/${s}/pom.xml`));
  });

  it("cada ADR é do tech lead do time dele", () => {
    for (const a of mapa.adrs) {
      const passo = PLANO_HISTORIA.find((p) => arquivosSemPasso([caminhoAdr(a)], [p]).length === 0);
      expect(passo?.autor, caminhoAdr(a)).toBe(mapa.times.find((t) => t.id === a.time)!.techLead);
    }
  });
});

describe("regra autores", () => {
  const ctx = (repo?: string) => ({ mapa, repo, notionUrls: {}, jornadas: [] });

  it("aceita autores @kota.example depois de um commit raiz de fora", () => {
    const repo = publico();
    commitar(repo, assinatura("thiago"));
    expect(regraAutores.checar(ctx(repo))).toEqual([]);
  });

  it("acusa e-mail fora de kota.example depois do commit raiz", () => {
    const repo = publico();
    commitar(repo, "Fulano <fulano@gmail.com>");
    commitar(repo, assinatura("thiago"), "Joaquim <joaquim@exemplo.com>");
    const [fulano, joaquim] = git(repo, "rev-list", "--reverse", "--abbrev-commit", "HEAD").split("\n").slice(1);
    expect(regraAutores.checar(ctx(repo))).toEqual([
      `commit ${joaquim}: committer joaquim@exemplo.com fora de @kota.example`,
      `commit ${fulano}: autor fulano@gmail.com fora de @kota.example`,
      `commit ${fulano}: committer fulano@gmail.com fora de @kota.example`,
    ]);
  });

  it("roda no check:kota só com --repo", () =>
    expect(checarKota(ctx(), regras).pulas).toContain("autores: sem --repo"));
});
