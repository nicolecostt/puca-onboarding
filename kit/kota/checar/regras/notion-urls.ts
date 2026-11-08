import { ARVORE } from "../../notion/arvore";
import { URL_PUBLICA } from "../../notion/links";
import type { Regra } from "../contexto";

export const regraNotionUrls: Regra = {
  nome: "notion-urls",
  precisaRepo: false,
  checar({ notionUrls }) {
    const erros: string[] = [];
    const dominios = new Set<string>();
    for (const { chave } of ARVORE) {
      if (!Object.hasOwn(notionUrls, chave)) {
        erros.push(`chave ${chave}: sem URL em kit/kota/notion/urls.json`);
        continue;
      }
      const dominio = URL_PUBLICA.exec(notionUrls[chave])?.[1];
      if (dominio) dominios.add(dominio);
      else erros.push(`chave ${chave}: "${notionUrls[chave]}" não é URL pública https://<domínio>.notion.site/...`);
    }
    if (dominios.size > 1) erros.push(`URLs em mais de um domínio: ${[...dominios].map((d) => `${d}.notion.site`).join(", ")}`);
    return erros;
  },
};
