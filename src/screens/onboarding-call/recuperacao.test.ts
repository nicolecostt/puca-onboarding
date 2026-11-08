import { describe, expect, it } from "vitest";
import { DEMO_CALIBRAGENS } from "../../journey/calibragem";
import { DEMO_PROFILES } from "../../journey/profile";
import { dadosParaSessao } from "./recuperacao";

describe("passagem para a sessão depois de falha na call", () => {
  it("call aberta sem escolha conserva o vínculo informado na conversa", () => {
    expect(dadosParaSessao({ nome: "Bruno", vinculo: "transicao" }, null).perfil.vinculo).toBe("transicao");
  });

  it.each(["novo", "transicao"] as const)("sem respostas, conserva a demo do vínculo %s", (vinculo) => {
    const dados = dadosParaSessao({ vinculo }, vinculo);
    expect(dados.perfil).toEqual(DEMO_PROFILES[vinculo]);
    expect(dados.calibragem).toEqual(DEMO_CALIBRAGENS[vinculo]);
  });

  it("preserva o nome e a calibragem coletados, completando só a admissão que faltou", () => {
    const dados = dadosParaSessao({ nome: "Bia", pagamentos: "nunca", objetivos: "Entender o saldo" }, "transicao");
    expect(dados.perfil).toMatchObject({ nome: "Bia", vinculo: "transicao", time: DEMO_PROFILES.transicao.time });
    expect(dados.calibragem.perfil).toEqual(dados.perfil);
    expect(dados.calibragem.objetivos).toEqual(["Entender o saldo"]);
    expect(dados.calibragem.conhecimentos).toContainEqual(expect.objectContaining({ tema: "pagamentos", nivel: "nao_conhece", certeza: "alta" }));
  });
});
