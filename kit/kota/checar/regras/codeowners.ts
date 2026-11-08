import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gerarCodeowners } from "../../gerar/codeowners";
import type { Regra } from "../contexto";

// O GitHub diferencia maiúsculas no caminho; o disco padrão do macOS, não, e existsSync acharia .github/codeowners.
const ehArquivo = (raiz: string, partes: string[]) =>
  partes.every((parte, i) =>
    readdirSync(join(raiz, ...partes.slice(0, i)), { withFileTypes: true })
      .some((d) => d.name === parte && (i === partes.length - 1 ? d.isFile() : d.isDirectory())));

export const regraCodeowners: Regra = {
  nome: "codeowners",
  precisaRepo: true,
  checar(ctx) {
    const arquivo = join(ctx.repo!, ".github", "CODEOWNERS");
    const gerar = `gere com npm run kota:codeowners -- ${arquivo}`;
    if (!ehArquivo(ctx.repo!, [".github", "CODEOWNERS"])) return [`${arquivo} não existe; ${gerar}`];
    return readFileSync(arquivo, "utf8") === gerarCodeowners(ctx.mapa) ? [] : [`${arquivo} difere do gerado do mapa; ${gerar}`];
  },
};
