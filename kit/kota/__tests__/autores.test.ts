import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { regraAutores } from "../checar/regras/autores";
import { mapa } from "../mapa";

const git = (raiz: string, ...args: string[]) => execFileSync("git", args, { cwd: raiz, encoding: "utf8" }).trim();
const ctx = (repo: string) => ({ mapa, repo, notionUrls: {}, jornadas: [] });

function repoCom(origem: string | undefined, ...emails: string[]) {
  const raiz = mkdtempSync(join(tmpdir(), "autores-"));
  git(raiz, "init", "-q");
  if (origem) git(raiz, "remote", "add", "origin", origem);
  for (const email of ["noreply@github.com", ...emails]) {
    execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-q", "--allow-empty", "-m", email], {
      cwd: raiz,
      env: { ...process.env, GIT_AUTHOR_NAME: "x", GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: "x", GIT_COMMITTER_EMAIL: email },
    });
  }
  return raiz;
}

describe("regra autores fora do kota-bank público", () => {
  it("não acusa nada na oficina, que recebe commits do time pelo GitHub", () => {
    const repo = repoCom("git@github.com:JucaGF/kota-bank-oficina.git", "juca@users.noreply.github.com");
    expect(regraAutores.checar(ctx(repo))).toEqual([]);
  });

  it("no kota-bank acusa e-mail @kota.example de quem não está no mapa", () => {
    const repo = repoCom("https://github.com/JucaGF/kota-bank.git", "qualquer@kota.example");
    const h = git(repo, "rev-parse", "--short", "HEAD");
    expect(regraAutores.checar(ctx(repo))).toEqual([
      `commit ${h}: autor qualquer@kota.example não é de uma pessoa do mapa`,
      `commit ${h}: committer qualquer@kota.example não é de uma pessoa do mapa`,
    ]);
  });

  it("no kota-bank aceita quem está no mapa", () => {
    const repo = repoCom("https://github.com/JucaGF/kota-bank.git", mapa.pessoas[0].email);
    expect(regraAutores.checar(ctx(repo))).toEqual([]);
  });
});
