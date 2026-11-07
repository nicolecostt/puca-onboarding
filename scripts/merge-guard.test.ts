import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Só os caminhos que não dependem do GitHub: push, comandos comuns e o que o parser não entende.
const script = resolve("scripts/merge-guard.sh");
let naMain = "";
let naBranch = "";

function guarda(comando: string, cwd: string): { codigo: number | null; motivo: string } {
  const r = spawnSync("bash", [script], { cwd, input: JSON.stringify({ tool_name: "Bash", tool_input: { command: comando } }), encoding: "utf8" });
  return { codigo: r.status, motivo: r.stderr };
}

function repo(branch: string): string {
  const dir = mkdtempSync(join(tmpdir(), "merge-guard-"));
  const git = (...a: string[]) => spawnSync("git", a, { cwd: dir });
  git("init", "-q", "-b", branch);
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "x");
  return dir;
}

beforeAll(() => {
  naMain = repo("main");
  naBranch = repo("feat/1-algo");
});
afterAll(() => [naMain, naBranch].forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("merge-guard", () => {
  it("deixa passar comandos comuns e push da própria branch", () => {
    for (const c of ["ls -la", "git status", "git push -u origin feat/1-algo", "git push", "git push origin HEAD"]) {
      expect(guarda(c, naBranch).codigo, c).toBe(0);
    }
  });
  it("deixa passar comentário de PR, mesmo com texto de merge dentro", () => {
    expect(guarda("gh pr review 58 --comment -b 'gh pr merge 58'", naBranch).codigo).toBe(0);
  });
  it("barra push direto na main, por nome, por refspec ou estando nela", () => {
    for (const c of ["git push origin main", "git push origin HEAD:main", "git push origin +refs/heads/main"]) {
      expect(guarda(c, naBranch).codigo, c).toBe(2);
    }
    for (const c of ["git push", "git push origin HEAD"]) expect(guarda(c, naMain).codigo, c).toBe(2);
  });
  it("barra push --all/--mirror", () => {
    expect(guarda("git push --all origin", naBranch).codigo).toBe(2);
    expect(guarda("git push --mirror origin", naBranch).codigo).toBe(2);
  });
  it("barra merge que não dá para entender (falha fechada)", () => {
    const r = guarda('eval "gh pr merge 58"', naBranch);
    expect(r.codigo).toBe(2);
    expect(r.motivo).toMatch(/Não entendi/);
  });
  it("cada trecho é verificado: um push entendido não libera um merge escondido no trecho seguinte", () => {
    expect(guarda('git push origin feat/1-algo && eval "gh pr merge 58"', naBranch).codigo).toBe(2);
  });
  it("prefixos com flags não escondem push na main", () => {
    expect(guarda("sudo -E git push origin main", naBranch).codigo).toBe(2);
    expect(guarda("sudo -u bob git push origin main", naBranch).codigo).toBe(2);
    expect(guarda("env -i git push origin feat/1-algo", naBranch).codigo).toBe(0);
  });
  it("não barra commit cuja mensagem fala de push", () => {
    expect(guarda('git commit -m "fix push do áudio"', naBranch).codigo).toBe(0);
  });
});
