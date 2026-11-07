// Perfil da pessoa: vem da call de entrevista (sessionStorage), da URL (?perfil=)
// ou de um dos dois perfis de demonstração (§7 do context.md).
import { normalize } from "./conditions";
import type { Profile, Vinculo } from "./types";

const STORAGE_KEY = "puca:profile";

export const DEMO_PROFILES: Record<Vinculo, Profile> = {
  novo: {
    nome: "Bruno",
    cargo: "Engenheiro de backend",
    time: "TMS — fraud-score",
    gestor: "Marcos Vidal",
    ferramentas: "GitHub, Slack e Jira",
    aprender: "Fazendo junto com alguém",
    vinculo: "novo",
  },
  transicao: {
    nome: "Camila",
    cargo: "Engenheira de backend",
    time: "TMS — fraud-score",
    gestor: "Marcos Vidal",
    ferramentas: "GitHub, Slack, Jira e Datadog",
    aprender: "Vendo alguém fazer",
    vinculo: "transicao",
  },
};

/** Traduz a resposta livre "é sua primeira vez ou está mudando de time?" para o vínculo. */
export function vinculoFromAnswer(answer: string | undefined): Vinculo {
  const t = normalize(answer ?? "");
  const transicao = ["mudando", "mudei", "outro time", "outra equipe", "outra area", "ja trabalho", "ja sou", "transicao", "trocando", "troquei", "vindo do", "vim do", "vim da"];
  return transicao.some((k) => t.includes(k)) ? "transicao" : "novo";
}

/** Monta o perfil a partir das respostas da call de entrevista. */
export function profileFromAnswers(answers: Partial<Record<string, string>>): Profile {
  return {
    nome: answers.nome?.trim() || "você",
    cargo: answers.cargo,
    time: answers.time,
    gestor: answers.gestor,
    ferramentas: answers.ferramentas,
    aprender: answers.aprender,
    vinculo: vinculoFromAnswer(answers.vinculo),
  };
}

export function saveProfile(p: Profile): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // sem storage (aba privada, preview): a aula cai no perfil de demo
  }
}

export function loadSavedProfile(): Profile | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Profile>;
    if (typeof p.nome !== "string" || (p.vinculo !== "novo" && p.vinculo !== "transicao")) return null;
    return p as Profile;
  } catch {
    return null;
  }
}

/** Ordem: ?perfil= na URL → perfil salvo pela entrevista → demo "novo". */
export function resolveProfile(search: string): { profile: Profile; source: "url" | "entrevista" | "demo" } {
  const fromUrl = new URLSearchParams(search).get("perfil");
  if (fromUrl === "novo" || fromUrl === "transicao") return { profile: DEMO_PROFILES[fromUrl], source: "url" };
  const saved = loadSavedProfile();
  if (saved) return { profile: saved, source: "entrevista" };
  return { profile: DEMO_PROFILES.novo, source: "demo" };
}

/** Aplica `interpolate` em todas as strings de um objeto (ex.: rótulos e cartões de um quadro). */
export function interpolateDeep<T>(value: T, p: Profile): T {
  if (typeof value === "string") return interpolate(value, p) as T;
  if (Array.isArray(value)) return value.map((v) => interpolateDeep(v, p)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolateDeep(v, p)])) as T;
  }
  return value;
}

/** Troca {nome}, {time}… pelos dados do perfil (campo vazio vira texto neutro). */
export function interpolate(text: string, p: Profile, extra: Record<string, string> = {}): string {
  const values: Record<string, string | undefined> = { ...p, ...extra };
  const fallback: Record<string, string> = { time: "seu time", gestor: "sua gestão", cargo: "sua função" };
  return text.replace(/\{(\w+)\}/g, (_, key: string) => values[key]?.trim() || fallback[key] || "");
}
