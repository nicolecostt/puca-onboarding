import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_CALIBRAGENS, resolveCalibragem } from "../calibragem";
import { ID_DO_VINCULO, escolherPerfil } from "../escolha";
import { DEMO_PROFILES, loadSavedProfile, profileFromAnswers, resolveProfile, saveProfile } from "../profile";

/** localStorage de mentira: o que o app grava e lê de uma abertura para outra. */
function instalarLocalStorage(): Map<string, string> {
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
  return dados;
}

describe("escolha do perfil", () => {
  let dados: Map<string, string>;
  beforeEach(() => {
    dados = instalarLocalStorage();
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("a escolha fica no localStorage e vale numa nova abertura", () => {
    escolherPerfil("novo");
    expect(dados.has("puca:profile")).toBe(true);
    expect(loadSavedProfile()).toEqual(DEMO_PROFILES.novo);
    expect(resolveProfile("")).toEqual({ profile: DEMO_PROFILES.novo, source: "entrevista" });
  });

  it("sem escolha nem ?perfil=, a sessão sabe que ninguém escolheu", () => {
    expect(resolveProfile("").source).toBe("demo");
  });

  it("?perfil= vence o perfil escolhido", () => {
    escolherPerfil("novo");
    expect(resolveProfile("?perfil=bruno").profile).toEqual(DEMO_PROFILES.transicao);
  });

  it("a escolha leva a calibragem da mesma pessoa", () => {
    escolherPerfil("novo");
    expect(resolveCalibragem("").calibragem).toEqual(JSON.parse(JSON.stringify(DEMO_CALIBRAGENS.novo)));
  });

  it("perfil salvo sem calibragem: a calibragem segue o vínculo do perfil, não a do Bruno", () => {
    saveProfile(DEMO_PROFILES.novo);
    expect(resolveCalibragem("").calibragem).toEqual(DEMO_CALIBRAGENS.novo);
  });

  it("cada vínculo é um perfil da demo", () => {
    expect(ID_DO_VINCULO).toEqual({ novo: "ana", transicao: "bruno" });
    expect(escolherPerfil("transicao")).toEqual(DEMO_PROFILES.transicao);
  });
});

describe("call inicial depois da escolha", () => {
  it("o vínculo escolhido vence a resposta livre", () => {
    expect(profileFromAnswers({ nome: "Ana", vinculo: "estou mudando de time" }, "novo").vinculo).toBe("novo");
    expect(profileFromAnswers({ nome: "Bruno" }, "transicao").vinculo).toBe("transicao");
  });

  it("sem escolha, o vínculo continua vindo da resposta", () => {
    expect(profileFromAnswers({ nome: "Bruno", vinculo: "estou mudando de time" }).vinculo).toBe("transicao");
  });
});
