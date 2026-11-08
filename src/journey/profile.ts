// Perfil da pessoa: vem da call de entrevista, da URL (?perfil=, que a escolha nas boas-vindas manda para a call), da
// escolha por cima da sessão ou de um dos dois perfis da demo (src/data/profiles.ts).
import { onboardingStore } from "./storage";
import { normalize } from "./conditions";
import { company } from "../data/company";
import { profiles } from "../data/profiles";
import type { Profile as DemoProfile } from "../data/types";
import type { Profile, Vinculo } from "./types";

const STORAGE_KEY = "puca:profile";

/** Os perfis da demo (src/data/profiles.ts) no formato da jornada. */
export function fromDemoProfile(p: DemoProfile): Profile {
  return {
    nome: p.nickname,
    cargo: p.role,
    time: p.toTeam,
    gestor: company.people[p.managerId]?.name,
    ferramentas: p.tools,
    aprender: p.learningStyle,
    vinculo: p.kind === "transfer" ? "transicao" : "novo",
  };
}

/** novo = Ana (recém-contratada) · transicao = Bruno (mudando de time). */
export const DEMO_PROFILES: Record<Vinculo, Profile> = {
  novo: fromDemoProfile(profiles.ana),
  transicao: fromDemoProfile(profiles.bruno),
};

/** Traduz a resposta livre "é sua primeira vez ou está mudando de time?" para o vínculo. */
export function vinculoFromAnswer(answer: string | undefined): Vinculo {
  const t = normalize(answer ?? "");
  const transicao = ["mudando", "mudei", "outro time", "outra equipe", "outra area", "ja trabalho", "ja sou", "transicao", "trocando", "troquei", "vindo do", "vim do", "vim da"];
  return transicao.some((k) => t.includes(k)) ? "transicao" : "novo";
}

/**
 * Monta o perfil a partir das respostas da call de entrevista. Com o vínculo já escolhido antes da call
 * (nas boas-vindas), ele vale e a call não pergunta de novo.
 */
export function profileFromAnswers(answers: Partial<Record<string, string>>, vinculo?: Vinculo): Profile {
  return {
    nome: answers.nome?.trim() || "você",
    cargo: answers.cargo,
    time: answers.time,
    gestor: answers.gestor,
    ferramentas: answers.ferramentas,
    aprender: answers.aprender,
    vinculo: vinculo ?? vinculoFromAnswer(answers.vinculo),
  };
}

export function saveProfile(p: Profile): void {
  try {
    onboardingStore().setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // sem storage (aba privada, preview): a sessão cai no perfil de demo
  }
}

export function loadSavedProfile(): Profile | null {
  try {
    const raw = onboardingStore().getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Profile>;
    if (typeof p.nome !== "string" || (p.vinculo !== "novo" && p.vinculo !== "transicao")) return null;
    return p as Profile;
  } catch {
    return null;
  }
}

/** Identifica o mesmo perfil nos registros locais de andamento e conversas. */
export function escopoDoPerfil(profile: Profile): string {
  return JSON.stringify([profile.vinculo, profile.nome, profile.time, profile.cargo]);
}

/** ?perfil= aceita o vínculo (novo | transicao) ou o perfil da demo (ana | bruno). */
const URL_PROFILES: Record<string, Vinculo> = { novo: "novo", transicao: "transicao", ana: "novo", bruno: "transicao" };

/**
 * Ordem: ?perfil= na URL → perfil salvo (escolha ou call) → demo do Bruno (mesmo padrão das outras telas).
 * `source: "demo"` quer dizer que ninguém escolheu: a sessão pede a escolha antes de começar.
 */
export function resolveProfile(search: string): { profile: Profile; source: "url" | "entrevista" | "demo" } {
  const fromUrl = URL_PROFILES[new URLSearchParams(search).get("perfil") ?? ""];
  if (fromUrl) return { profile: DEMO_PROFILES[fromUrl], source: "url" };
  const saved = loadSavedProfile();
  if (saved) return { profile: saved, source: "entrevista" };
  return { profile: DEMO_PROFILES.transicao, source: "demo" };
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
