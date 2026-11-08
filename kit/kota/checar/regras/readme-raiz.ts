import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FIM, INICIO, trocarSistemas } from "../../gerar/readme-raiz";
import type { Regra } from "../contexto";

export const regraReadmeRaiz: Regra = {
  nome: "readme-raiz",
  precisaRepo: true,
  checar(ctx) {
    const arquivo = join(ctx.repo!, "README.md");
    if (!existsSync(arquivo)) return [`${arquivo} não existe`];
    const texto = readFileSync(arquivo, "utf8");
    const gerado = trocarSistemas(texto, ctx.mapa);
    if (gerado === undefined) return [`${arquivo} não tem ${INICIO} e ${FIM}; ponha os dois onde a tabela de serviços fica`];
    return gerado === texto ? [] : [`tabela de serviços de ${arquivo} difere da gerada do mapa; gere com npm run kota:readme-raiz -- ${ctx.repo}`];
  },
};
