import { describe, expect, it, vi } from "vitest";
import { mapa } from "../../../kit/kota/mapa";
import { company, empresaDoMapa } from "../company";
import { activeProfile, profiles } from "../profiles";

const livroRazao = mapa.times.find((t) => t.id === "livro-razao")!;

describe("dados da Kota", () => {
  it("empresa é a Kota com os 4 times", () => {
    expect(company.name).toBe("Kota");
    expect(company.teams).toEqual(["Contas", "Livro-razão", "Canais", "Plataforma"]);
    expect(empresaDoMapa(mapa)).toEqual(company);
  });

  it("cada pessoa do mapa está na empresa, com slack, cargo e time", () => {
    expect(Object.keys(company.people).sort()).toEqual(mapa.pessoas.map((p) => p.id).sort());
    expect(company.people.thiago).toEqual({ id: "thiago", name: "Thiago Nakamura", handle: "Thiago Nakamura", role: "Tech lead", team: "Livro-razão" });
    expect(company.people.simone.team).toBe("People");
  });

  it("os perfis são as pessoas de mapa.perfis", () => {
    expect(Object.keys(profiles).sort()).toEqual([mapa.perfis.novo.pessoa, mapa.perfis.transicao.pessoa].sort());
    expect(profiles.ana.kind).toBe("new-hire");
    expect(profiles.bruno.kind).toBe("transfer");
    expect(profiles.ana.name).toBe("Ana Lacerda");
    expect(profiles.bruno.name).toBe("Bruno Siqueira");
  });

  it("gestor e buddy dos perfis existem e são do Livro-razão", () => {
    for (const p of Object.values(profiles)) {
      expect(p.toTeam).toBe("Livro-razão");
      expect(p.managerId).toBe(livroRazao.gestor);
      expect(livroRazao.buddies).toContain(p.buddyId);
      expect(company.people[p.managerId].team).toBe("Livro-razão");
      expect(company.people[p.buddyId].team).toBe("Livro-razão");
    }
  });

  it("transição vem de Contas", () => {
    expect(profiles.bruno.fromTeam).toBe("Contas");
    expect(profiles.ana.fromTeam).toBeUndefined();
  });

  it("sem ?perfil, a tela abre na transição", () => {
    vi.stubGlobal("location", { search: "" });
    expect(activeProfile().id).toBe(mapa.perfis.transicao.pessoa);
    vi.unstubAllGlobals();
  });
});
