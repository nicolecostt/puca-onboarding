// Company brain mínimo: as páginas do Notion e o mapa da Kota em trechos, com busca de texto em memória.
// Sem banco nem embedding: BM25 simples, síncrono, em poucos ms. Quem usa: server/src/agent/ask.ts.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mapa as mapaKota } from "../../../kit/kota/mapa";
import { ARVORE, linhasDatabase } from "../../../kit/kota/notion/arvore";
import type { MapaKota } from "../../../kit/kota/tipos";

export interface Trecho { id: string; titulo: string; url: string; texto: string }

export interface Brain {
  buscar(texto: string, limite?: number): Trecho[];
  /** Quantos trechos estão na memória (para o log do boot). */
  total?: number;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const slug = (s: string) => semAcento(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const STOPWORDS = new Set(
  ("que com como para por pelo pela pelos pelas uma umas uns dos das nos nas num numa ele ela eles elas voce voces "
    + "seu sua seus suas meu minha meus minhas isso isto esse essa esses essas este esta estes estas aquele aquela "
    + "mas mais menos muito muita muitos muitas tem ter tenho temos sao ser sou somos foi era estar esta estao "
    + "qual quais quem onde quando porque pois entao tambem ainda sobre entre ate sem sob apos cada outro outra "
    + "outros outras mesmo mesma todo toda todos todas nao sim aqui ali hoje vai vou funciona fazer faz feito")
    .split(" "),
);

/** Minúsculas, sem acento, sem stopword, sem termo curto e sem o `s` do plural simples. */
export function termos(texto: string): string[] {
  return semAcento(texto)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}

/** Seções de uma página (##, ###); `#` dentro de bloco de código não conta. O que vem antes da primeira vira "Visão geral". */
function secoes(md: string): { titulo: string; texto: string }[] {
  const out: { titulo: string; linhas: string[] }[] = [{ titulo: "Visão geral", linhas: [] }];
  let codigo = false;
  for (const linha of md.split("\n")) {
    if (linha.trimStart().startsWith("```")) codigo = !codigo;
    const h = !codigo && /^(##|###)\s+(.+)$/.exec(linha);
    if (h) out.push({ titulo: h[2].trim(), linhas: [] });
    else if (!codigo && /^#\s/.test(linha)) continue; // título da página: já vem da árvore
    else out.at(-1)!.linhas.push(linha);
  }
  return out
    .map((s) => ({ titulo: s.titulo, texto: s.linhas.join("\n").trim() }))
    .filter((s) => s.texto);
}

const valor = (v: string | string[] | boolean | number) =>
  Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "sim" : "não") : String(v);

/** Páginas do Notion por título (##, ###; # dentro de bloco de código não conta) + uma linha por sistema, time e pessoa do mapa. */
export function trechosDoKit(o: { paginasDir: string; urls: Record<string, string>; mapa: MapaKota }): Trecho[] {
  const out: Trecho[] = [];
  for (const arquivo of readdirSync(o.paginasDir).filter((f) => f.endsWith(".md")).sort()) {
    const chave = arquivo.slice(0, -3);
    const pagina = ARVORE.find((n) => n.chave === chave)?.titulo ?? chave;
    const usados = new Set<string>();
    for (const s of secoes(readFileSync(join(o.paginasDir, arquivo), "utf8"))) {
      let id = slug(s.titulo) || "secao";
      for (let i = 2; usados.has(id); i++) id = `${slug(s.titulo)}-${i}`;
      usados.add(id);
      out.push({ id: `notion:${chave}#${id}`, titulo: `${pagina} · ${s.titulo}`, url: o.urls[chave] ?? "", texto: s.texto });
    }
  }
  const dbs = [["sistemas", "Sistemas"], ["times", "Times"], ["pessoas", "Pessoas"]] as const;
  for (const [db, nomeDb] of dbs) {
    for (const linha of linhasDatabase(o.mapa, db)) {
      const nome = String(linha.Nome);
      out.push({
        id: `mapa:${db}/${slug(nome)}`,
        titulo: `${nomeDb} · ${nome}`,
        url: o.urls[db] ?? "",
        texto: Object.entries(linha).map(([k, v]) => `${k}: ${valor(v)}`).join(" · "),
      });
    }
  }
  return out;
}

/** Busca de texto em memória (BM25 simples, k1 = 1,2, b = 0,75), sem dependência nova. */
export function criarBrain(trechos: Trecho[]): Brain {
  const K1 = 1.2;
  const B = 0.75;
  const docs = trechos.map((t) => {
    const tf = new Map<string, number>();
    const ts = termos(`${t.titulo} ${t.texto}`);
    for (const x of ts) tf.set(x, (tf.get(x) ?? 0) + 1);
    return { t, tf, len: ts.length };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const x of d.tf.keys()) df.set(x, (df.get(x) ?? 0) + 1);
  const n = docs.length;
  const media = docs.reduce((s, d) => s + d.len, 0) / (n || 1);

  return {
    total: n,
    buscar(texto, limite = 5) {
      const q = [...new Set(termos(texto))];
      if (!q.length) return [];
      return docs
        .map((d) => {
          let nota = 0;
          for (const x of q) {
            const f = d.tf.get(x);
            if (!f) continue;
            const nx = df.get(x)!;
            const idf = Math.log(1 + (n - nx + 0.5) / (nx + 0.5));
            nota += (idf * f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / media));
          }
          return { t: d.t, nota };
        })
        .filter((r) => r.nota > 0)
        .sort((a, b) => b.nota - a.nota)
        .slice(0, limite)
        .map((r) => r.t);
    },
  };
}

/** Lê <raiz>/kit/kota/notion/paginas, urls.json e o mapa. */
export function carregarBrain(raiz: string): Brain {
  const notion = join(raiz, "kit", "kota", "notion");
  const urls = JSON.parse(readFileSync(join(notion, "urls.json"), "utf8")) as Record<string, string>;
  return criarBrain(trechosDoKit({ paginasDir: join(notion, "paginas"), urls, mapa: mapaKota }));
}
