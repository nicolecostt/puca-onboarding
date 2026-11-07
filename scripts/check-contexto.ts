// Valida a base do sistema: PRODUCT.md e CONTEXT.md seguem o padrão descrito na skill contexto-base.
//   npx tsx scripts/check-contexto.ts           erros de estrutura (sai com 1) e avisos
//   npx tsx scripts/check-contexto.ts --termos  também avisa, nas linhas novas da branch, termos que o glossário evita
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export interface Resultado {
  erros: string[];
  avisos: string[];
}

/** Âncora que o GitHub gera para um título (mesma regra do github-slugger). */
export function slug(titulo: string): string {
  return titulo.trim().toLowerCase().replace(/[^\p{L}\p{N}\p{M} _-]/gu, "").replace(/ /g, "-");
}

/** Linhas fora de blocos de código, com o número original (1-based). */
function linhasDeTexto(md: string): { n: number; t: string }[] {
  let dentro = false;
  const out: { n: number; t: string }[] = [];
  md.split("\n").forEach((t, i) => {
    if (/^\s*```/.test(t)) dentro = !dentro;
    else if (!dentro) out.push({ n: i + 1, t });
  });
  return out;
}

// ---------- PRODUCT.md ----------

export function checarProduto(md: string): Resultado {
  const erros: string[] = [];
  const avisos: string[] = [];
  const linhas = linhasDeTexto(md);

  // âncoras de todos os títulos (o GitHub numera repetidas: -1, -2…)
  const ancoras = new Set<string>();
  const vistos = new Map<string, number>();
  for (const { t } of linhas) {
    const m = /^#{1,6} (.+)$/.exec(t);
    if (!m) continue;
    const base = slug(m[1]);
    const k = vistos.get(base) ?? 0;
    ancoras.add(k ? `${base}-${k}` : base);
    vistos.set(base, k + 1);
  }

  // seções numeradas em sequência, subseções N.M. em sequência dentro da seção
  const secoes: { num: number; titulo: string; n: number }[] = [];
  let atual = 0;
  let sub = 0;
  for (const { n, t } of linhas) {
    const h2 = /^## (.+)$/.exec(t);
    if (h2) {
      if (h2[1] === "Sumário") continue;
      const m = /^(\d+)\. (.+)$/.exec(h2[1]);
      if (!m) {
        erros.push(`PRODUCT.md:${n}: seção sem número ("## N. Título"): "${h2[1]}"`);
        continue;
      }
      const num = Number(m[1]);
      if (num !== secoes.length + 1) erros.push(`PRODUCT.md:${n}: seção ${num} fora de ordem (esperado ${secoes.length + 1})`);
      secoes.push({ num, titulo: m[2], n });
      atual = num;
      sub = 0;
      continue;
    }
    const h3 = /^### (\d+)\.(\d+)\. /.exec(t);
    if (h3) {
      const [a, b] = [Number(h3[1]), Number(h3[2])];
      if (a !== atual) erros.push(`PRODUCT.md:${n}: subseção ${a}.${b} dentro da seção ${atual}`);
      else if (b !== sub + 1) erros.push(`PRODUCT.md:${n}: subseção ${a}.${b} fora de ordem (esperado ${a}.${sub + 1})`);
      sub = b;
    }
  }

  // sumário: uma linha por seção, mesmo número, mesmo título, âncora certa
  const ini = linhas.findIndex(({ t }) => t === "## Sumário");
  if (ini < 0) {
    erros.push('PRODUCT.md: falta a seção "## Sumário"');
  } else {
    const itens: { num: number; titulo: string; ancora: string; n: number }[] = [];
    for (const { n, t } of linhas.slice(ini + 1)) {
      if (/^## /.test(t) || t === "---") break;
      const m = /^(\d+)\. \[(.+)\]\(#(.+)\)$/.exec(t);
      if (m) itens.push({ num: Number(m[1]), titulo: m[2], ancora: m[3], n });
      else if (t.trim()) erros.push(`PRODUCT.md:${n}: linha do sumário fora do formato "N. [Título](#âncora)"`);
    }
    for (const s of secoes) {
      const item = itens.find((i) => i.num === s.num);
      if (!item) {
        erros.push(`PRODUCT.md:${s.n}: seção ${s.num} ("${s.titulo}") não está no sumário`);
        continue;
      }
      if (item.titulo !== s.titulo) erros.push(`PRODUCT.md:${item.n}: sumário diz "${item.titulo}", a seção ${s.num} se chama "${s.titulo}"`);
      const esperada = slug(`${s.num}. ${s.titulo}`);
      if (item.ancora !== esperada) erros.push(`PRODUCT.md:${item.n}: âncora do sumário "#${item.ancora}", o certo é "#${esperada}"`);
    }
    for (const i of itens) if (!secoes.some((s) => s.num === i.num)) erros.push(`PRODUCT.md:${i.n}: sumário cita a seção ${i.num}, que não existe`);
  }

  // links internos apontam para títulos que existem; "§X.Y" bate com a âncora
  for (const { n, t } of linhas) {
    for (const m of t.matchAll(/\[([^\]]*)\]\(#([^)]+)\)/g)) {
      const [, texto, ancora] = m;
      if (!ancoras.has(ancora)) erros.push(`PRODUCT.md:${n}: link para "#${ancora}", que não existe`);
      const sec = /^§(\d+(?:\.\d+)?)$/.exec(texto);
      if (sec && !ancora.startsWith(sec[1].replace(".", "") + "-")) avisos.push(`PRODUCT.md:${n}: "${texto}" aponta para "#${ancora}"`);
    }
  }
  return { erros, avisos };
}

// ---------- CONTEXT.md ----------

export interface Termo {
  nome: string;
  grupo: string;
  definicao: string[];
  evitar: string[];
  /** Itens do "_Avoid_" que vêm com uma explicação entre parênteses, ex.: "lousa (é o produto)". */
  explicados: Set<string>;
  n: number;
}

/** Itens de uma linha "_Avoid_: a, b (nota)", sem as notas entre parênteses. */
function itensEvitar(linha: string): { item: string; explicado: boolean }[] {
  return linha
    .replace(/^_Avoid_:\s*/, "")
    .split(",")
    .map((s) => ({ item: s.replace(/\(.*?\)/g, "").trim().toLowerCase(), explicado: /\(.+\)/.test(s) }))
    .filter((x) => x.item);
}

export function lerGlossario(md: string): { termos: Termo[]; erros: string[]; avisos: string[] } {
  const erros: string[] = [];
  const avisos: string[] = [];
  const termos: Termo[] = [];
  let grupo = "";
  let t: Termo | null = null;
  const fecha = () => {
    if (t && !t.definicao.length) erros.push(`CONTEXT.md:${t.n}: "${t.nome}" sem definição`);
    t = null;
  };
  for (const { n, t: l } of linhasDeTexto(md)) {
    if (/^## /.test(l)) {
      fecha();
      grupo = l.slice(3).trim();
      continue;
    }
    const m = /^\*\*(.+?)\*\*:\s*$/.exec(l);
    if (m) {
      fecha();
      if (!grupo) erros.push(`CONTEXT.md:${n}: "${m[1]}" fora de um grupo ("## Grupo")`);
      t = { nome: m[1], grupo, definicao: [], evitar: [], explicados: new Set(), n };
      termos.push(t);
      continue;
    }
    if (!l.trim()) {
      fecha();
      continue;
    }
    if (!t) {
      if (grupo) avisos.push(`CONTEXT.md:${n}: texto solto dentro de "${grupo}" (o glossário só tem termos)`);
      continue;
    }
    const termo: Termo = t;
    if (/^_Avoid_:/.test(l)) {
      if (termo.evitar.length) erros.push(`CONTEXT.md:${n}: "${termo.nome}" com dois "_Avoid_"`);
      const itens = itensEvitar(l);
      termo.evitar = itens.map((x) => x.item);
      termo.explicados = new Set(itens.filter((x) => x.explicado).map((x) => x.item));
    } else {
      if (termo.evitar.length) erros.push(`CONTEXT.md:${n}: "${termo.nome}": "_Avoid_" tem que ser a última linha do termo`);
      termo.definicao.push(l);
      if (/`|\bsrc\/|\bserver\//.test(l)) avisos.push(`CONTEXT.md:${n}: "${termo.nome}" cita código; o glossário é só vocabulário`);
    }
  }
  fecha();
  return { termos, erros, avisos };
}

export function checarGlossario(md: string): Resultado {
  const { termos, erros, avisos } = lerGlossario(md);
  const porNome = new Map<string, Termo[]>();
  for (const t of termos) porNome.set(t.nome.toLowerCase(), [...(porNome.get(t.nome.toLowerCase()) ?? []), t]);
  for (const [nome, lista] of porNome) {
    if (lista.length > 1 && !lista.some((t) => /não confundir/i.test(t.definicao.join(" ")))) {
      erros.push(`CONTEXT.md:${lista[1].n}: "${lista[1].nome}" repetido (linha ${lista[0].n}); se forem conceitos diferentes, diga "Não confundir com…"`);
    }
    for (const outro of termos) {
      if (outro.evitar.includes(nome) && !outro.explicados.has(nome)) {
        erros.push(`CONTEXT.md:${outro.n}: "${outro.nome}" manda evitar "${lista[0].nome}", que é um termo do glossário; explique entre parênteses (ex.: "lousa (é o produto)")`);
      }
    }
  }
  return { erros, avisos };
}

// ---------- termos evitados em texto novo ----------

/**
 * Palavras de uso comum que o glossário evita só quando falam do conceito dele ("contexto" no lugar de Conhecimento,
 * "mudança" no lugar de Transição…). Fora disso são português normal: avisar sempre seria ruído e ninguém leria.
 */
const GENERICAS = new Set([
  "contexto", "base", "seção", "etapa", "fase", "item", "fluxo", "mudança", "documento", "referência", "mensagem",
  "certeza", "avaliação", "componente", "opção", "botão", "onboarding", "caixa", "plataforma",
]);

export interface Evitar {
  usar: string;
  /** Item explicado no glossário (ex.: "lousa (é o produto)"): só a forma em minúscula é aviso. */
  soMinuscula: boolean;
}

/** Palavra evitada → termo que o glossário usa no lugar. */
export function mapaEvitar(glossario: string): Map<string, Evitar> {
  const mapa = new Map<string, Evitar>();
  for (const t of lerGlossario(glossario).termos) {
    for (const e of t.evitar) if (!GENERICAS.has(e)) mapa.set(e, { usar: t.nome, soMinuscula: t.explicados.has(e) });
  }
  return mapa;
}

const escapa = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function termosEvitados(texto: string, mapa: Map<string, Evitar>): { palavra: string; usar: string }[] {
  if (/^\s*_Avoid_:/.test(texto)) return [];
  const achados: { palavra: string; usar: string }[] = [];
  for (const [palavra, { usar, soMinuscula }] of mapa) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapa(palavra)}(?![\\p{L}\\p{N}])`, soMinuscula ? "u" : "iu");
    if (re.test(texto)) achados.push({ palavra, usar });
  }
  return achados;
}

/** Linhas adicionadas (commits da branch + não commitadas) desde a main. */
function linhasNovas(arquivos: string[]): { arquivo: string; n: number; texto: string }[] {
  let base = "origin/main";
  try {
    base = execFileSync("git", ["merge-base", "origin/main", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    /* sem origin/main: compara com ele mesmo e não acha nada */
  }
  const diff = execFileSync("git", ["diff", "-U0", base, "--", ...arquivos], { encoding: "utf8" });
  const out: { arquivo: string; n: number; texto: string }[] = [];
  let arquivo = "";
  let n = 0;
  for (const l of diff.split("\n")) {
    if (l.startsWith("+++ ")) arquivo = l.replace(/^\+\+\+ (b\/)?/, "");
    else if (l.startsWith("@@")) n = Number(/\+(\d+)/.exec(l)?.[1] ?? 0);
    else if (l.startsWith("+")) out.push({ arquivo, n: n++, texto: l.slice(1) });
  }
  return out;
}

// ---------- CLI ----------

function main(): void {
  const produto = checarProduto(readFileSync("PRODUCT.md", "utf8"));
  const glossario = readFileSync("CONTEXT.md", "utf8");
  const contexto = checarGlossario(glossario);
  const erros = [...produto.erros, ...contexto.erros];
  const avisos = [...produto.avisos, ...contexto.avisos];

  if (process.argv.includes("--termos")) {
    const mapa = mapaEvitar(glossario);
    for (const l of linhasNovas(["PRODUCT.md", "CONTEXT.md", "CLAUDE.md", "docs", ".claude/skills", ".claude/agents"])) {
      for (const a of termosEvitados(l.texto, mapa)) {
        avisos.push(`${l.arquivo}:${l.n}: "${a.palavra}" — o glossário usa "${a.usar}" (troque se o texto fala desse conceito)`);
      }
    }
  }

  for (const a of avisos) console.log(`aviso  ${a}`);
  for (const e of erros) console.log(`erro   ${e}`);
  console.log(erros.length ? `\nBase do sistema: ${erros.length} erro(s). Padrão na skill contexto-base.` : "Base do sistema ok (PRODUCT.md e CONTEXT.md).");
  process.exit(erros.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
