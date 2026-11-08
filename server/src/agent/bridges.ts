// Falas-ponte e fallback do agente, e a lista de tudo que dá para pré-gerar no cache de TTS.
import type { FaqIntent } from "../../../src/journey/conditions";
import { buildFaqs } from "../../../src/journey/faq";
import { interpolate } from "../../../src/journey/profile";
import type { Journey, Profile } from "../../../src/journey/types";

/** Falas-ponte: tocam na hora enquanto o LLM pensa. Curtas, várias por intenção para não repetir. */
export const BRIDGES: Record<FaqIntent | "generic", string[]> = {
  why: ["Boa. Deixa eu ver a decisão por trás disso.", "Hum, deixa eu checar o registro dessa decisão."],
  owner: ["Deixa eu ver quem cuida disso.", "Boa, deixa eu conferir o responsável."],
  what: ["Deixa eu conferir nas docs.", "Boa pergunta. Deixa eu olhar aqui."],
  generic: ["Hum, deixa eu pensar um segundo.", "Boa pergunta. Só um instante.", "Deixa eu ver isso pra você."],
};

export const FALLBACK_LINE = "Não consegui confirmar isso agora. Vale perguntar pra sua buddy.";
export const FAILURE_LINE = "Tive um problema para pensar nisso agora. Pode perguntar de novo?";

const used = new Map<string, number>();
export function pickBridge(intent: FaqIntent | null): string {
  const key = intent ?? "generic";
  const list = BRIDGES[key];
  const n = used.get(key) ?? 0;
  used.set(key, n + 1);
  return list[n % list.length];
}

/** Todos os textos que dá para gerar antes da sessão (falas da jornada, FAQ, pontes) para um perfil. */
export function allScriptedTexts(journey: Journey, profile: Profile): string[] {
  const texts = new Set<string>();
  for (const m of journey.moments) {
    for (const s of m.steps) {
      for (const t of [s.line, s.expect?.on_correct, s.expect?.on_wrong, s.expect?.on_reveal]) if (t) texts.add(interpolate(t, profile));
    }
  }
  for (const f of buildFaqs(journey, profile)) texts.add(f.text);
  for (const list of Object.values(BRIDGES)) for (const t of list) texts.add(t);
  texts.add(FALLBACK_LINE);
  texts.add(FAILURE_LINE);
  return [...texts];
}
