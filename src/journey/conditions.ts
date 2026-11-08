// Avalia as condições estruturadas das transições e compara respostas livres
// com as respostas sugeridas do passo.
import type { Condition, Profile, ResultadoDaChecagem } from "./types";

/** Minúsculas, sem acento, sem pontuação, espaços simples. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Palavras que não ajudam a distinguir uma resposta da outra.
const STOPWORDS = new Set([
  "a", "o", "as", "os", "e", "de", "da", "do", "das", "dos", "um", "uma", "se", "que", "quem",
  "eu", "voce", "me", "pode", "por", "favor", "pra", "para", "em", "no", "na", "nos", "nas", "cada", "qual", "quais",
]);

export function keywords(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Prefixo comum de 4+ letras conta como a mesma palavra ("falhar" ≈ "falha", "cuida" ≈ "cuidam"). */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const n = Math.min(a.length, b.length);
  return n >= 4 && a.slice(0, Math.max(4, n - 1)) === b.slice(0, Math.max(4, n - 1));
}

/**
 * Escolhe a resposta sugerida que mais se parece com o texto livre.
 * Devolve null quando nenhuma tem palavra-chave em comum.
 */
export function matchReply(text: string, replies: readonly string[]): string | null {
  const said = normalize(text);
  const exact = replies.find((r) => normalize(r) === said);
  if (exact) return exact;
  const words = keywords(text);
  let best: string | null = null;
  let bestScore = 0;
  for (const r of replies) {
    const rk = keywords(r);
    if (!rk.length) continue;
    const hits = rk.filter((k) => words.some((w) => sameWord(w, k))).length;
    const score = hits / rk.length;
    if (hits > 0 && score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

/** Igual a matchReply, mas devolve a confiança (0..1): 1 = igual, fração de palavras-chave da resposta encontradas. */
export function scoreReply(text: string, replies: readonly string[]): { reply: string | null; score: number } {
  const said = normalize(text);
  const exact = replies.find((r) => normalize(r) === said);
  if (exact) return { reply: exact, score: 1 };
  const words = keywords(text);
  let best: string | null = null;
  let bestScore = 0;
  for (const r of replies) {
    const rk = keywords(r);
    if (!rk.length) continue;
    const score = rk.filter((k) => words.some((w) => sameWord(w, k))).length / rk.length;
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return { reply: best, score: bestScore };
}

export type FaqIntent = "what" | "owner" | "why";

// "quem", "que" e "por" são stopwords em keywords(), então a intenção é lida por frase.
const INTENTS: [FaqIntent, string[]][] = [
  ["owner", ["quem cuida", "quem e o dono", "quem e dono", "dono", "responsavel", "quem mantem", "falar com quem", "com quem eu falo"]],
  ["why", ["por que", "porque", "pra que", "para que serve", "motivo", "decisao", "decidiram", "adr"]],
  ["what", ["o que e", "o que faz", "como funciona", "explica", "me fala", "serve"]],
];

export function detectIntent(text: string): FaqIntent | null {
  const t = ` ${normalize(text)} `;
  for (const [intent, phrases] of INTENTS) if (phrases.some((p) => t.includes(` ${p} `))) return intent;
  return null;
}

/**
 * Acha a resposta pré-computada para "o que é / quem cuida / por que existe" de um nó do quadro.
 * score 1 = cita o nó e a intenção; 0.5 = cita só o nó (vale "what"); 0 = não cita nó nenhum.
 */
export function matchFaq<T extends { node: string; label: string; intent: FaqIntent }>(
  text: string,
  faqs: readonly T[],
): { faq: T | null; score: number } {
  const said = ` ${normalize(text)} `;
  const words = keywords(text);
  const intent = detectIntent(text);
  // Tamanho do trecho da fala que cita o nó (0 = não cita). Vale o nó citado pelo trecho mais longo:
  // "ledger-db" cita o nó ledger-db, e não o nó "db", cujo id está dentro do nome. A citação exata vence a que só se
  // parece com a palavra: "ledger" lembra "ledgermonolith", mas quem disse "ledger-db" falou do ledger-db.
  const EXATA = 1000;
  const mention = (f: T): number => {
    const label = normalize(f.label);
    const node = normalize(f.node);
    const exact = Math.max(said.includes(` ${label} `) ? label.length : 0, said.includes(` ${node} `) ? node.length : 0);
    if (exact) return EXATA + exact;
    const lk = keywords(f.label);
    return lk.length > 0 && lk.every((k) => words.some((w) => sameWord(w, k))) ? label.length : 0;
  };
  const sizes = faqs.map(mention);
  const longest = Math.max(0, ...sizes);
  if (!longest) return { faq: null, score: 0 };
  const hit = faqs.filter((_, i) => sizes[i] === longest);
  const exact = intent && hit.find((f) => f.intent === intent);
  if (exact) return { faq: exact, score: 1 };
  return { faq: hit.find((f) => f.intent === "what") ?? null, score: intent ? 0.3 : 0.5 };
}

export interface ConditionContext {
  profile: Profile;
  /** Resposta sugerida escolhida (ou reconhecida no texto) no passo atual. */
  reply: string | null;
  /** Resultado da checagem do passo atual (null se o passo não é checagem). */
  checagem?: ResultadoDaChecagem | null;
}

export function evaluate(cond: Condition, ctx: ConditionContext): boolean {
  if ("checagem" in cond) return ctx.checagem === cond.checagem;
  if ("reply" in cond) return ctx.reply !== null && normalize(ctx.reply) === normalize(cond.reply);
  const value = ctx.profile[cond.profile];
  return value !== undefined && normalize(String(value)) === normalize(cond.eq);
}
