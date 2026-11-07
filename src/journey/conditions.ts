// Avalia as condições estruturadas das transições e compara respostas livres
// com as respostas sugeridas do passo.
import type { Condition, Profile } from "./types";

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

function keywords(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Prefixo comum de 4+ letras conta como a mesma palavra ("falhar" ≈ "falha", "cuida" ≈ "cuidam"). */
function sameWord(a: string, b: string): boolean {
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

export interface ConditionContext {
  profile: Profile;
  /** Resposta sugerida escolhida (ou reconhecida no texto) no passo atual. */
  reply: string | null;
}

export function evaluate(cond: Condition, ctx: ConditionContext): boolean {
  if ("reply" in cond) return ctx.reply !== null && normalize(ctx.reply) === normalize(cond.reply);
  const value = ctx.profile[cond.profile];
  return value !== undefined && normalize(String(value)) === normalize(cond.eq);
}
