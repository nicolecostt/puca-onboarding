// O que a pessoa quis dizer fora das respostas sugeridas (simulado por palavras-chave até ter um LLM):
// - pedido para mudar de assunto → pulo para o início de outro momento;
// - pergunta que o conhecimento do momento responde → a Puca responde sem sair do roteiro.
import { keywords, normalize, sameWord } from "./conditions";
import type { Journey, Moment, Step } from "./types";

// Sinais de que a pessoa quer ir para outro assunto (e não só perguntar algo).
const NAV_CUES = ["volta", "voltar", "volte", "pula", "pular", "ir para", "vamos para", "quero ver", "me mostra", "mostra", "rever", "de novo", "fala sobre", "falar sobre", "explica"];

function overlap(a: string[], b: string[]): number {
  return b.filter((k) => a.some((w) => sameWord(w, k))).length;
}

/**
 * Momento para onde a pessoa pediu para ir, pelo título e objetivo de cada momento.
 * Precisa de um sinal de navegação ("volta", "quero ver"…) para não confundir com uma pergunta.
 */
export function findJump(text: string, journey: Journey, currentMomentId?: string): Moment | null {
  const said = normalize(text);
  if (!NAV_CUES.some((c) => said.includes(c))) return null;
  const words = keywords(text);
  let best: Moment | null = null;
  let bestScore = 0;
  for (const m of journey.moments) {
    if (m.id === currentMomentId) continue;
    // o título pesa mais que o objetivo
    const score = overlap(words, keywords(m.title)) * 2 + overlap(words, keywords(m.goal));
    if (score > bestScore) {
      best = m;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : null;
}

/**
 * Responde uma pergunta com a frase do conhecimento (do passo e do momento atuais) que mais combina.
 * Devolve null quando nada combina: aí a Puca anota a dúvida para a buddy, sem chutar.
 */
export function answerFromKnowledge(question: string, step?: Step | null, moment?: Moment | null): string | null {
  const words = keywords(question);
  if (!words.length) return null;
  const sentences = [step?.knowledge, moment?.knowledge]
    .filter((k): k is string => !!k)
    .flatMap((k) => k.split(/(?<=[.!?])\s+/))
    .map((t) => t.trim())
    .filter(Boolean);
  let best: string | null = null;
  let bestScore = 0;
  for (const sentence of sentences) {
    const score = overlap(words, keywords(sentence));
    if (score > bestScore) {
      best = sentence;
      bestScore = score;
    }
  }
  // duas palavras em comum, ou metade das palavras de uma pergunta curta
  return bestScore >= 2 || (bestScore >= 1 && bestScore / words.length >= 0.5) ? best : null;
}
