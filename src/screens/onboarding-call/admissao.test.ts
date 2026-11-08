import { describe, expect, it } from "vitest";
import { profiles } from "../../data";
import { admissaoDaCall } from "./admissao";

describe("admissão que Puca confirma na call", () => {
  it("antes de saber o vínculo, o cargo não presume gênero", () => {
    const a = admissaoDaCall(null);
    expect(a.cargo).toBe("Engenharia de software, nível pleno");
    expect(a.cargo).not.toMatch(/Engenheir[ao]/);
  });

  it("com o vínculo, é a admissão da pessoa da demo", () => {
    expect(admissaoDaCall("novo").cargo).toBe(profiles.ana.role);
    expect(admissaoDaCall("transicao").cargo).toBe(profiles.bruno.role);
  });

  it("time e gestor são os do destino nos dois casos", () => {
    const [nenhum, novo, transicao] = [admissaoDaCall(null), admissaoDaCall("novo"), admissaoDaCall("transicao")];
    expect(nenhum.time).toBe(profiles.ana.toTeam);
    expect(transicao.time).toBe(nenhum.time);
    expect(novo.gestor).toBeTruthy();
    expect(transicao.gestor).toBe(nenhum.gestor);
  });
});
