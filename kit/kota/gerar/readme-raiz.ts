import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { mapa } from "../mapa";
import type { MapaKota } from "../tipos";

export const INICIO = "<!-- kota:sistemas:inicio -->";
export const FIM = "<!-- kota:sistemas:fim -->";

export function tabelaSistemas(m: MapaKota): string {
  const time = (id: string) => m.times.find((t) => t.id === id)!.nome;
  return [
    "| Serviço | Linguagem | O que faz | Time |",
    "|---|---|---|---|",
    ...m.sistemas.map((s) => `| [${s.id}](${s.pasta}) | ${s.linguagem} | ${s.oQueFaz} | ${time(s.time)} |`),
  ].join("\n");
}

export function trocarSistemas(readme: string, m: MapaKota): string | undefined {
  const inicio = readme.indexOf(INICIO);
  const fim = readme.indexOf(FIM, inicio);
  if (inicio < 0 || fim < 0) return undefined;
  return `${readme.slice(0, inicio)}${INICIO}\n\n${tabelaSistemas(m)}\n\n${readme.slice(fim)}`;
}

function main() {
  const raiz = process.argv[2];
  if (!raiz) {
    console.error("uso: npm run kota:readme-raiz -- <raiz do repo>");
    process.exit(1);
  }
  const arquivo = join(raiz, "README.md");
  const novo = existsSync(arquivo) ? trocarSistemas(readFileSync(arquivo, "utf8"), mapa) : undefined;
  if (novo === undefined) {
    console.error(`${arquivo} não existe ou não tem ${INICIO} e ${FIM}; ponha os dois onde a tabela fica`);
    process.exit(1);
  }
  writeFileSync(arquivo, novo);
  console.log(`tabela de serviços gravada em ${arquivo}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
