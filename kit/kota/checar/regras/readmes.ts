import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { blocoServico, readmeServico } from "../../gerar/readme-servico";
import type { Regra } from "../contexto";

export const regraReadmes: Regra = {
  nome: "readmes",
  precisaRepo: true,
  checar(ctx) {
    const gerar = `gere com npm run kota:readmes -- ${ctx.repo}`;
    return ctx.mapa.sistemas.flatMap((s) => {
      const caminho = `${s.pasta}/README.md`;
      const arquivo = join(ctx.repo!, caminho);
      if (!existsSync(arquivo)) return [`${caminho} não existe; ${gerar}`];
      const texto = readFileSync(arquivo, "utf8");
      const cabeca = !texto.includes(blocoServico(ctx.mapa, s.id)) ? [`${caminho}: bloco difere do gerado do mapa; ${gerar}`]
        : readmeServico(texto, ctx.mapa, s.id) !== texto ? [`${caminho}: não abre com "# ${s.id}" e o bloco do mapa; ${gerar}`]
        : [];
      const oQueFaz = texto.split(/\r?\n/).includes("## O que faz") ? [] : [`${caminho}: falta a seção "## O que faz"`];
      return [...cabeca, ...oQueFaz];
    });
  },
};
