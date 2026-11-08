import { ARVORE } from "../../notion/arvore";
import { URL_PUBLICA } from "../../notion/links";
import type { Regra } from "../contexto";

export const regraNotionUrls: Regra = {
  nome: "notion-urls",
  precisaRepo: false,
  checar({ notionUrls }) {
    const entradas = Object.entries(notionUrls);
    const chavesPorUrl = new Map<string, string[]>();
    for (const [chave, url] of entradas) chavesPorUrl.set(url, [...(chavesPorUrl.get(url) ?? []), chave]);
    const dominios = new Set(entradas.flatMap(([, url]) => URL_PUBLICA.exec(url)?.[1] ?? []));
    return [
      ...ARVORE.filter((n) => !Object.hasOwn(notionUrls, n.chave)).map((n) => `chave ${n.chave}: sem URL em kit/kota/notion/urls.json`),
      ...entradas.filter(([, url]) => !URL_PUBLICA.test(url))
        .map(([chave, url]) => `chave ${chave}: "${url}" não é URL pública https://<domínio>.notion.site/...`),
      ...[...chavesPorUrl].filter(([, chaves]) => chaves.length > 1)
        .map(([url, chaves]) => `chaves ${chaves.sort().join(", ")} com a mesma URL ${url}`),
      ...(dominios.size > 1 ? [`URLs em mais de um domínio: ${[...dominios].map((d) => `${d}.notion.site`).join(", ")}`] : []),
    ];
  },
};
