import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const git = (raiz: string, ...args: string[]) => execFileSync("git", args, { cwd: raiz, stdio: "ignore" });

export function repoGit(arquivos: Record<string, string | Uint8Array>): string {
  const raiz = mkdtempSync(join(tmpdir(), "kota-repo-"));
  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    mkdirSync(dirname(join(raiz, caminho)), { recursive: true });
    writeFileSync(join(raiz, caminho), conteudo);
  }
  git(raiz, "init", "-q");
  return raiz;
}

// Tudo no índice, como a oficina depois do git rm: o que a troca renomeia continua lá com o nome antigo.
export function copiaGit(origem: string): string {
  const raiz = mkdtempSync(join(tmpdir(), "kota-repo-"));
  cpSync(origem, raiz, { recursive: true });
  git(raiz, "init", "-q");
  git(raiz, "add", "-A");
  return raiz;
}
