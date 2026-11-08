import type { ChaveNotion } from "./arvore";

// Qualquer notion:<chave>, e não só [x](notion:<chave>): com título, por referência, entre <> ou como autolink, o
// Markdown também faz link, e um notion: que sobrasse sem resolver chegaria quebrado ao Notion.
const LINK_NOTION = /\bnotion:([^\s<>()[\]"'`]+)/gi;
export const URL_PUBLICA = /^https:\/\/([a-z0-9-]+)\.notion\.site\/\S+$/;

export const chavesCitadas = (md: string): ChaveNotion[] => [...md.matchAll(LINK_NOTION)].map((l) => l[1]);

export function resolverLinks(md: string, urls: Record<ChaveNotion, string>): string {
  return md.replace(LINK_NOTION, (_, chave: string) => {
    if (!Object.hasOwn(urls, chave) || !URL_PUBLICA.test(urls[chave])) throw new Error(`notion:${chave} sem URL pública em urls.json`);
    return urls[chave];
  });
}
