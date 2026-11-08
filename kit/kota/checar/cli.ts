import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { checarKota } from "./checar";
import { carregarContexto } from "./contexto";
import { regras } from "./regras";

function lerRepo(): string | undefined {
  try {
    return parseArgs({ options: { repo: { type: "string" } } }).values.repo;
  } catch {
    console.error("uso: npm run check:kota -- [--repo <caminho>]");
    process.exit(1);
  }
}

const repo = lerRepo();
if (repo !== undefined && !existsSync(repo)) {
  console.error(`repo ${repo} não existe`);
  process.exit(1);
}

const raiz = fileURLToPath(new URL("../../..", import.meta.url));
const { erros, pulas } = checarKota(carregarContexto(raiz, repo && resolve(repo)), regras);
for (const p of pulas) console.log(`aviso  regra ${p.replace(": ", " pulada: ")}`);
for (const e of erros) console.log(`erro   ${e}`);
console.log(erros.length ? `\nKit da Kota: ${erros.length} erro(s).` : "Kit da Kota ok.");
process.exit(erros.length ? 1 : 0);
