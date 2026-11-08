import { basename } from "node:path";

// O crédito ao código de origem fica como está: a troca não mexe e o detector não acusa.
export function linhasDaOrigem(caminho: string, linhas: string[]): Set<number> {
  if (basename(caminho) === "LICENSE") return new Set(linhas.keys());
  const origem = new Set<number>();
  let naSecao = false;
  linhas.forEach((l, i) => {
    if (caminho === "README.md" && /^#{1,2} /.test(l)) naSecao = l.trim() === "## Origem do código";
    if (naSecao || /Copyright.*Google/.test(l)) origem.add(i);
  });
  return origem;
}
