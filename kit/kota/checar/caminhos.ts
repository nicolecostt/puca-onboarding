import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// O GitHub diferencia maiúsculas no caminho; o disco padrão do macOS, não, e existsSync aceitaria src/Ledger.
export function existe(raiz: string, caminho: string): boolean {
  const partes = caminho.split("/");
  return partes.every((parte, i) => nomes(join(raiz, ...partes.slice(0, i))).includes(parte));
}

export function nomes(pasta: string): string[] {
  return existsSync(pasta) && statSync(pasta).isDirectory() ? readdirSync(pasta) : [];
}
