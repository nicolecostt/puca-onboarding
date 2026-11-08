import type { ChaveNotion } from "./arvore";

const LINK_NOTION = /\]\(notion:([^)\s]*)\)/g;

export const chavesCitadas = (md: string): ChaveNotion[] => [...md.matchAll(LINK_NOTION)].map((l) => l[1]);

export function resolverLinks(md: string, urls: Record<ChaveNotion, string>): string {
  return md.replace(LINK_NOTION, (_, chave: string) => {
    if (!Object.hasOwn(urls, chave)) throw new Error(`notion:${chave} sem URL em urls.json`);
    return `](${urls[chave]})`;
  });
}
