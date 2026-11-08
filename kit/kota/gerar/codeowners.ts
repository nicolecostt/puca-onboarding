import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { mapa } from "../mapa";
import type { MapaKota, TimeId } from "../tipos";

export function gerarCodeowners(m: MapaKota): string {
  const email = (id: string) => m.pessoas.find((p) => p.id === id)!.email;
  const responsaveis = (id: TimeId) => {
    const t = m.times.find((t) => t.id === id)!;
    return `${email(t.techLead)} ${email(t.gestor)}`;
  };
  // No CODEOWNERS do GitHub vale o último padrão que casa: o geral vem antes das pastas.
  return [
    "# Gerado do mapa da Kota. Não edite à mão: mude o mapa e gere de novo.",
    `* ${responsaveis("plataforma")}`,
    ...m.sistemas.map((s) => `/${s.pasta}/ ${responsaveis(s.time)}`),
    `/docs/adr/ ${m.times.map((t) => email(t.techLead)).join(" ")}`,
    "",
  ].join("\n");
}

function main() {
  const saida = process.argv[2];
  if (!saida) {
    console.error("uso: npm run kota:codeowners -- <arquivo de saída>");
    process.exit(1);
  }
  mkdirSync(dirname(saida), { recursive: true });
  writeFileSync(saida, gerarCodeowners(mapa));
  console.log(`CODEOWNERS gravado em ${saida}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
