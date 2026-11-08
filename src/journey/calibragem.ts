// Calibragem: o que o Puca concluiu na call inicial sobre o que a pessoa já sabe e o que ela quer.
// A call inicial escreve; a jornada e a adaptação das explicações leem. Formato em docs/contratos.md.
// Por enquanto o nível sai de regras por palavras (funciona sem servidor e é sempre igual na demo).
import { onboardingStore } from "./storage";
import { normalize } from "./conditions";
import { DEMO_PROFILES, loadSavedProfile } from "./profile";
import { callAnswers } from "../data/call-answers";
import type { Calibragem, Certeza, ItemCalibragem, Nivel, Profile, ResultadoChecagem, Tema, Vinculo } from "./types";

const STORAGE_KEY = "puca:calibragem";

/** Os temas e os momentos da jornada que cada um controla (ids de kota.journey.json). */
export const CALIBRAGEM_TEMAS: Record<Tema, { nome: string; momentos: string[] }> = {
  empresa: { nome: "A empresa e a cultura", momentos: ["empresa-e-cultura"] },
  rituais: { nome: "Rituais e pessoas do time", momentos: ["seu-time"] },
  pagamentos: { nome: "Pagamentos e o caminho de uma transação", momentos: ["pagamentos"] },
  mensageria: { nome: "Mensageria (filas e eventos)", momentos: ["pagamentos"] },
  falhas: { nome: "Falhas: retry e fila de erro", momentos: ["falha"] },
};

/** Respostas da call que a calibragem usa (as chaves são as das perguntas da call inicial). */
export interface RespostasCalibragem {
  experiencia?: string;
  time_anterior?: string;
  aproveita?: string;
  diferencas?: string;
  pagamentos?: string;
  mensageria?: string;
  falhas?: string;
  objetivos?: string;
}

// Frases, já normalizadas (sem acento, minúsculas). A ordem de checagem importa: "não muito" é "já ouviu".
const JA_OUVIU = ["pouco", "por cima", "ja ouvi", "ouvi falar", "so ouvi", "estudei", "curso", "teoria", "nao muito", "superficial", "mais ou menos", "basico"];
const NAO_CONHECE = ["nunca", "nao", "nada", "zero", "nenhum", "nenhuma", "jamais", "nao conheco", "nao sei"];
const DOMINA = ["domino", "especialista", "expert", "anos", "liderei", "referencia", "sei bem", "conheco bem", "muita experiencia"];
const USA = ["sim", "uso", "usei", "usava", "trabalho", "trabalhei", "trabalhava", "todo dia", "dia a dia", "ja", "claro", "bastante", "tinha", "tenho"];

/** Palavras que mostram o tema na experiência que a pessoa contou (usadas quando a resposta direta não diz o nível). */
const TEMA_PALAVRAS: Partial<Record<Tema, string[]>> = {
  pagamentos: ["pagamento", "pagamentos", "transferencia", "transferencias", "saldo", "extrato", "fintech", "banco", "transacao", "transacoes"],
  mensageria: ["kafka", "fila", "filas", "mensageria", "rabbitmq", "sqs", "topico", "eventos"],
  falhas: ["retry", "dlq", "fila de erro", "incidente", "incidentes", "plantao"],
};

function has(text: string, phrases: string[]): boolean {
  const t = ` ${text} `;
  return phrases.some((p) => t.includes(` ${p} `));
}

/** Traduz uma resposta livre ("uso Kafka todo dia") em nível. null quando a resposta não diz. */
export function nivelFromAnswer(answer: string | undefined): Nivel | null {
  const t = normalize(answer ?? "");
  if (!t) return null;
  if (has(t, JA_OUVIU)) return "ja_ouviu";
  const sim = /^(sim|ja)\b/.test(t); // "sim, mas não tinha retry" continua sendo sim
  if (!sim && has(t, NAO_CONHECE)) return "nao_conhece";
  if (has(t, DOMINA)) return "domina";
  if (has(t, USA)) return "usa";
  return null;
}

/** Um tema perguntado na call: a resposta direta vale mais; senão, a experiência que a pessoa contou; senão, palpite. */
function itemPerguntado(tema: Tema, resposta: string | undefined, experiencia: string | undefined): ItemCalibragem {
  const nivel = nivelFromAnswer(resposta);
  if (nivel) return { tema, nivel, certeza: "alta", evidencia: resposta!.trim(), origem: "call" };
  const exp = normalize(experiencia ?? "");
  if (exp && has(exp, TEMA_PALAVRAS[tema] ?? [])) {
    return { tema, nivel: "usa", certeza: "media", evidencia: experiencia!.trim(), origem: "call" };
  }
  // não deu para saber: nível do meio, para a sessão confirmar na checagem
  return { tema, nivel: "ja_ouviu", certeza: "baixa", evidencia: resposta?.trim() ?? "", origem: "call" };
}

function itemDoVinculo(tema: Tema, nivel: Nivel, certeza: Certeza): ItemCalibragem {
  return { tema, nivel, certeza, evidencia: "", origem: "vinculo" };
}

/** Monta a calibragem a partir do perfil e das respostas da call inicial. */
export function calibragemFromAnswers(perfil: Profile, r: RespostasCalibragem, agora = new Date()): Calibragem {
  const transicao = perfil.vinculo === "transicao";
  const objetivo = r.objetivos?.trim();
  return {
    versao: 1,
    perfil,
    ...(r.experiencia?.trim() ? { experiencia: r.experiencia.trim() } : {}),
    objetivos: objetivo ? [objetivo] : [],
    conhecimentos: [
      // quem já é da empresa conhece a cultura; o time é que é novo para os dois perfis
      transicao ? itemDoVinculo("empresa", "usa", "alta") : itemDoVinculo("empresa", "nao_conhece", "alta"),
      transicao ? itemDoVinculo("rituais", "nao_conhece", "media") : itemDoVinculo("rituais", "nao_conhece", "alta"),
      itemPerguntado("pagamentos", r.pagamentos, r.experiencia),
      itemPerguntado("mensageria", r.mensageria, r.experiencia),
      itemPerguntado("falhas", r.falhas, r.experiencia),
    ],
    ...(transicao
      ? {
          ...(r.time_anterior?.trim() ? { time_anterior: r.time_anterior.trim() } : {}),
          ...(r.aproveita?.trim() ? { aproveita: r.aproveita.trim() } : {}),
          ...(r.diferencas?.trim() ? { diferencas: r.diferencas.trim() } : {}),
        }
      : {}),
    atualizada_em: agora.toISOString(),
  };
}

/** O item de um tema (sempre existe numa calibragem válida). */
export function itemDoTema(c: Calibragem, tema: Tema): ItemCalibragem | undefined {
  return c.conhecimentos.find((i) => i.tema === tema);
}

const ORDEM_NIVEL: Record<Nivel, number> = { nao_conhece: 0, ja_ouviu: 1, usa: 2, domina: 3 };

/**
 * A checagem da sessão atualiza o tema conferido (função pura; quem grava é a tela, com saveCalibragem).
 * Entendeu: nível pelo menos "usa". Rever: o nível não muda (não é nota), o tema só fica marcado para rever.
 */
export function atualizarCalibragem(c: Calibragem, r: ResultadoChecagem, agora = new Date()): Calibragem {
  const conhecimentos = c.conhecimentos.map((item): ItemCalibragem => {
    if (item.tema !== r.tema) return item;
    const nivel = r.entendeu && ORDEM_NIVEL[item.nivel] < ORDEM_NIVEL.usa ? "usa" : item.nivel;
    return { tema: item.tema, nivel, certeza: "alta", evidencia: r.resposta.trim(), origem: "sessao", checagem: r.entendeu ? "entendeu" : "rever" };
  });
  return { ...c, conhecimentos, atualizada_em: agora.toISOString() };
}

export function saveCalibragem(c: Calibragem): void {
  try {
    onboardingStore().setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    // sem storage (aba privada, preview): quem lê cai no exemplo da demo
  }
}

export function loadCalibragem(): Calibragem | null {
  try {
    const raw = onboardingStore().getItem(STORAGE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<Calibragem>;
    if (c.versao !== 1 || !c.perfil || !Array.isArray(c.conhecimentos) || !Array.isArray(c.objetivos)) return null;
    return c as Calibragem;
  } catch {
    return null;
  }
}

/** Calibragens de exemplo (Ana = novo, Bruno = transição): servem de mock para quem lê a calibragem. */
export const DEMO_CALIBRAGENS: Record<Vinculo, Calibragem> = {
  novo: calibragemFromAnswers(DEMO_PROFILES.novo, callAnswers.ana, new Date("2026-11-09T09:00:00-03:00")),
  transicao: calibragemFromAnswers(DEMO_PROFILES.transicao, callAnswers.bruno, new Date("2026-11-09T09:00:00-03:00")),
};

const URL_VINCULO: Record<string, Vinculo> = { novo: "novo", transicao: "transicao", ana: "novo", bruno: "transicao" };

/**
 * Mesma ordem do perfil: ?perfil= na URL → calibragem salva (call ou escolha) → exemplo do vínculo do perfil salvo →
 * demo do Bruno. Assim quem escolheu a Ana nunca cai na calibragem do Bruno.
 */
export function resolveCalibragem(search: string): { calibragem: Calibragem; source: "url" | "call" | "demo" } {
  const fromUrl = URL_VINCULO[new URLSearchParams(search).get("perfil") ?? ""];
  if (fromUrl) return { calibragem: DEMO_CALIBRAGENS[fromUrl], source: "url" };
  const saved = loadCalibragem();
  if (saved) return { calibragem: saved, source: "call" };
  return { calibragem: DEMO_CALIBRAGENS[loadSavedProfile()?.vinculo ?? "transicao"], source: "demo" };
}
