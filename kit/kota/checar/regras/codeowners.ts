import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gerarCodeowners } from "../../gerar/codeowners";
import type { Regra } from "../contexto";

export const regraCodeowners: Regra = {
  nome: "codeowners",
  precisaRepo: true,
  checar(ctx) {
    const arquivo = join(ctx.repo!, ".github", "CODEOWNERS");
    const gerar = `gere com npm run kota:codeowners -- ${arquivo}`;
    if (!existsSync(arquivo)) return [`${arquivo} não existe; ${gerar}`];
    return readFileSync(arquivo, "utf8") === gerarCodeowners(ctx.mapa) ? [] : [`${arquivo} difere do gerado do mapa; ${gerar}`];
  },
};
