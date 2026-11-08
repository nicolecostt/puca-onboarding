import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { isUtf8 } from "node:buffer";
import { join } from "node:path";

// O que o git rastreia ou não ignora: deixa de fora o target/ e o resto do build que fica na oficina.
// Do índice podem vir caminhos que a troca de marca já renomeou no disco; esses ficam de fora.
export function arquivosDoRepo(raiz: string): string[] {
  if (!existsSync(join(raiz, ".git"))) throw new Error(`${raiz} não é a raiz de um repo git`);
  const saida = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: raiz,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return saida
    .split("\0")
    .filter((c) => c && lstatSync(join(raiz, c), { throwIfNoEntry: false })?.isFile())
    .sort();
}

export function lerTexto(raiz: string, caminho: string): string | undefined {
  const bytes = readFileSync(join(raiz, caminho));
  return bytes.includes(0) || !isUtf8(bytes) ? undefined : bytes.toString("utf8");
}
