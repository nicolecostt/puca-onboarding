import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type AdrKota, caminhoAdr } from "../../tipos";
import { existe, nomes } from "../caminhos";
import type { ContextoKota, Regra } from "../contexto";

const ONDE = "## Onde ver no código";
// Letra, dígito ou ponto antes do @ é e-mail (plataforma@kota.example), não @handle.
const HANDLE = /(?<![\p{L}\p{N}_.+-])@[\p{L}\p{N}_-]+/gu;

interface AdrLido {
  primeira: string;
  campos: Map<string, string>;   // "- Campo: valor" antes da primeira seção
  onde?: string[];               // caminhos entre crases em "## Onde ver no código"
  handles: string[];             // fora de código entre crases
}

export const regraAdrs: Regra = {
  nome: "adrs",
  precisaRepo: true,
  checar(ctx) {
    const doMapa = new Set(ctx.mapa.adrs.map(caminhoAdr));
    const fora = nomes(join(ctx.repo!, "docs/adr"))
      .map((f) => `docs/adr/${f}`)
      .filter((c) => !doMapa.has(c))
      .map((c) => `${c}: fora do mapa; ADR novo entra primeiro no mapa.ts`);
    return [...ctx.mapa.adrs.flatMap((a) => checarAdr(a, ctx).map((e) => `ADR ${a.n}: ${e}`)), ...fora];
  },
};

function checarAdr(a: AdrKota, ctx: ContextoKota): string[] {
  const caminho = caminhoAdr(a);
  if (!existe(ctx.repo!, caminho)) return [`${caminho} não existe`];
  const lido = lerAdr(readFileSync(join(ctx.repo!, caminho), "utf8"));
  return [
    ...titulo(a, lido.primeira),
    ...campos(a, lido.campos, ctx),
    ...ondeVer(a, lido.onde, ctx.repo!),
    ...lido.handles.map((h) => `cita ${h}; pessoas são citadas pelo nome`),
  ];
}

function lerAdr(texto: string): AdrLido {
  const linhas = texto.split(/\r?\n/);
  const secaoDepois = (i: number) => {
    const j = linhas.findIndex((l, k) => k > i && l.startsWith("## "));
    return j < 0 ? undefined : j;
  };
  const campos = new Map<string, string>();
  for (const l of linhas.slice(0, secaoDepois(-1))) {
    const m = /^- ([^:]+): (.*)$/.exec(l);
    if (m) campos.set(m[1], m[2].trim());
  }
  const i = linhas.findIndex((l) => l.trim() === ONDE);
  const onde = i < 0 ? undefined : [...linhas.slice(i + 1, secaoDepois(i)).join("\n").matchAll(/`([^`\n]+)`/g)]
    .map((m) => m[1].replace(/\/+$/, ""));
  const prosa = texto.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  return { primeira: linhas[0], campos, onde, handles: [...new Set(prosa.match(HANDLE))] };
}

function titulo(a: AdrKota, primeira: string): string[] {
  const prefixo = `# ADR-${String(a.n).padStart(4, "0")}: `;
  if (primeira === prefixo + a.titulo) return [];
  if (primeira.startsWith(prefixo)) return [`título "${primeira.slice(prefixo.length)}" no arquivo, "${a.titulo}" no mapa`];
  return [`primeira linha "${primeira}", esperado "${prefixo}${a.titulo}"`];
}

function campos(a: AdrKota, lidos: Map<string, string>, ctx: ContextoKota): string[] {
  const time = ctx.mapa.times.find((t) => t.id === a.time)!.nome;
  const erros = [...comparar("Status", lidos.get("Status"), a.status, "no mapa"), ...comparar("Time", lidos.get("Time"), time, "no mapa")];
  if (a.rfc === undefined) return lidos.has("RFC") ? [...erros, `linha RFC, mas o mapa não dá RFC ao ADR ${a.n}`] : erros;
  const url = ctx.notionUrls[`rfc-${a.rfc}`];
  if (!url) return [...erros, `RFC ${a.rfc} sem URL em urls.json`];
  return [...erros, ...comparar("RFC", lidos.get("RFC"), url, "em urls.json")];
}

function comparar(campo: string, lido: string | undefined, esperado: string, origem: string): string[] {
  if (lido === undefined) return [`falta a linha "- ${campo}: ${esperado}"`];
  return lido === esperado ? [] : [`${campo} "${lido}" no arquivo, "${esperado}" ${origem}`];
}

function ondeVer(a: AdrKota, caminhos: string[] | undefined, repo: string): string[] {
  if (!caminhos) return [`falta a seção "${ONDE}"`];
  return [
    ...a.ancoras.filter((c) => !caminhos.includes(c)).map((c) => `âncora ${c} do mapa falta em "Onde ver no código"`),
    ...caminhos.filter((c) => !existe(repo, c)).map((c) => `âncora ${c} não existe no repo`),
  ];
}
