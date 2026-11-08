import { describe, expect, it } from "vitest";
import { criarRegistro, listarConversas, salvarResumo } from "../conversas";
import { DEMO_PROFILES } from "../profile";
import { memoryStore } from "../storage";

const ana = DEMO_PROFILES.novo;
const bruno = DEMO_PROFILES.transicao;

describe("histórico das conversas", () => {
  it("guarda a call inicial e a sessão separadas por perfil, com falas em ordem", () => {
    const store = memoryStore();
    const call = criarRegistro("call-inicial");
    const sessao = criarRegistro("sessao");
    call.anotar("assistant", "Como posso te chamar?");
    call.anotar("user", "Ana");
    sessao.anotar("assistant", "Vamos abrir o quadro.");
    expect(call.salvar(ana, store)).toBe(true);
    expect(sessao.salvar(bruno, store)).toBe(true);
    expect(listarConversas(ana, store)).toMatchObject([{
      tipo: "call-inicial",
      falas: [
        { role: "assistant", content: "Como posso te chamar?" },
        { role: "user", content: "Ana" },
      ],
    }]);
    expect(listarConversas(bruno, store)).toMatchObject([{ tipo: "sessao" }]);
  });

  it("mantém o mesmo ID ao retomar, invalida o resumo e rejeita resultados antigos", () => {
    const store = memoryStore();
    const sessao = criarRegistro("sessao");
    sessao.anotar("assistant", "Vamos abrir o quadro.");
    sessao.salvar(ana, store);
    const [primeira] = listarConversas(ana, store);
    expect(salvarResumo(ana, primeira, ["O Puca abriu o quadro."], store)).toBe(true);
    sessao.salvar(ana, store);
    expect(listarConversas(ana, store)[0].topicos).toEqual(["O Puca abriu o quadro."]);
    sessao.anotar("user", "Onde vejo minha primeira tarefa?");
    sessao.salvar(ana, store);
    const atual = listarConversas(ana, store);
    expect(atual).toHaveLength(1);
    expect(atual[0].id).toBe(primeira.id);
    expect(atual[0].topicos).toBeUndefined();
    expect(salvarResumo(ana, primeira, ["Resposta atrasada"], store)).toBe(false);
  });

  it("ignora registros vazios e informa quando a gravação falha", () => {
    const store = { ...memoryStore(), setItem() { throw new Error("cota cheia"); } };
    const sessao = criarRegistro("sessao");
    sessao.anotar("user", " ");
    expect(sessao.salvar(ana, store)).toBe(true);
    expect(listarConversas(ana, store)).toEqual([]);
    sessao.anotar("user", "Oi!");
    expect(sessao.salvar(ana, store)).toBe(false);
  });
});
