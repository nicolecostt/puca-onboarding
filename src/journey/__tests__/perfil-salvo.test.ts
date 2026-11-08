import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_CALIBRAGENS, resolveCalibragem, saveCalibragem } from "../calibragem";
import { DEMO_PROFILES, loadSavedProfile, profileFromAnswers, resolveProfile, saveProfile } from "../profile";
import type { Vinculo } from "../types";

/** O que o fim da call (ou a saída sem LLM) grava: perfil e calibragem da pessoa. */
function gravar(vinculo: Vinculo): void {
  saveProfile(DEMO_PROFILES[vinculo]);
  saveCalibragem(DEMO_CALIBRAGENS[vinculo]);
}

/** Storage de mentira no lugar do sessionStorage (navegador) e do localStorage (app para Mac): onboardingStore(). */
function instalarStorage(): Map<string, string> {
  const dados = new Map<string, string>();
  const store = {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, String(v)),
    removeItem: (k: string) => void dados.delete(k),
    clear: () => dados.clear(),
    key: (i: number) => [...dados.keys()][i] ?? null,
    get length() {
      return dados.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: store, configurable: true });
  return dados;
}

describe("perfil salvo depois da call", () => {
  let dados: Map<string, string>;
  beforeEach(() => {
    dados = instalarStorage();
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "sessionStorage");
  });

  it("o perfil gravado fica salvo e a sessão abre com ele", () => {
    gravar("novo");
    expect(dados.has("puca:profile")).toBe(true);
    expect(loadSavedProfile()).toEqual(DEMO_PROFILES.novo);
    expect(resolveProfile("")).toEqual({ profile: DEMO_PROFILES.novo, source: "entrevista" });
  });

  it("sem call nem ?perfil=, a sessão sabe que ninguém passou pela call", () => {
    expect(resolveProfile("").source).toBe("demo");
  });

  it("?perfil= vence o perfil salvo", () => {
    gravar("novo");
    expect(resolveProfile("?perfil=bruno").profile).toEqual(DEMO_PROFILES.transicao);
  });

  it("o perfil salvo leva a calibragem da mesma pessoa", () => {
    gravar("novo");
    expect(resolveCalibragem("").calibragem).toEqual(JSON.parse(JSON.stringify(DEMO_CALIBRAGENS.novo)));
  });

  it("perfil salvo sem calibragem: a calibragem segue o vínculo do perfil, não a do Bruno", () => {
    saveProfile(DEMO_PROFILES.novo);
    expect(resolveCalibragem("").calibragem).toEqual(DEMO_CALIBRAGENS.novo);
  });
});

describe("call inicial com o vínculo já conhecido (?perfil=)", () => {
  it("o vínculo conhecido vence a resposta livre", () => {
    expect(profileFromAnswers({ nome: "Ana", vinculo: "estou mudando de time" }, "novo").vinculo).toBe("novo");
    expect(profileFromAnswers({ nome: "Bruno" }, "transicao").vinculo).toBe("transicao");
  });

  it("sem ?perfil=, o vínculo vem da resposta na call", () => {
    expect(profileFromAnswers({ nome: "Bruno", vinculo: "estou mudando de time" }).vinculo).toBe("transicao");
  });
});
