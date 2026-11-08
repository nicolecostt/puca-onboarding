import { describe, expect, it } from "vitest";
import demo from "../data/tail.journey.json";
import { respostaSobreTarefa } from "../duvidas-da-tarefa";
import { tarefaDaPessoa, tarefaDoNo } from "../primeira-tarefa";
import { DEMO_PROFILES } from "../profile";
import type { Journey } from "../types";
import { loadJourney } from "../validate";

const journey = loadJourney(demo);
const no = (id: string) => Object.values(journey.boards).flatMap((b) => b.nodes).find((n) => n.id === id)!;
// o esperado sai dos campos da tarefa, não de texto da Tail: os testes sobrevivem à troca pela Kota (#109)
const bruno = tarefaDoNo(no("task-dlq"))!;

describe("tarefaDaPessoa", () => {
  it("tarefaDaPessoa escolhe pelo vínculo", () => {
    expect(tarefaDaPessoa(journey, DEMO_PROFILES.novo)?.no).toBe("task");
    expect(tarefaDaPessoa(journey, DEMO_PROFILES.transicao)?.no).toBe("task-dlq");
  });

  it("sem tarefa para o vínculo, devolve null", () => {
    // clonada sem passar pelo validador: os passos ainda citam os nós removidos
    const semTarefas = structuredClone(journey) as Journey;
    for (const b of Object.values(semTarefas.boards)) b.nodes = b.nodes.filter((n) => n.kind !== "task");
    expect(tarefaDaPessoa(semTarefas, DEMO_PROFILES.transicao)).toBeNull();
    expect(respostaSobreTarefa("por onde começo a tarefa?", null, true)).toBeNull();
  });

  it("um nó task sem vínculo vale para qualquer pessoa", () => {
    const umaSo = structuredClone(journey) as Journey;
    for (const b of Object.values(umaSo.boards)) {
      b.nodes = b.nodes.filter((n) => n.id !== "task-dlq").map((n) => (n.id === "task" ? { ...n, info: { ...n.info, vinculo: undefined } } : n));
    }
    expect(tarefaDaPessoa(umaSo, DEMO_PROFILES.transicao)?.no).toBe("task");
  });
});

describe("respostaSobreTarefa", () => {
  it("cada intenção responde com o campo certo", () => {
    const casos: [string, string, string][] = [
      ["por onde começo a tarefa?", "comecar", `Comece lendo ${bruno.onde_ler}. Sistemas: ${bruno.sistemas}. Se travar, fale com ${bruno.quem_ajuda}.`],
      ["quem ajuda na tarefa?", "quem_ajuda", `Quem ajuda nessa tarefa: ${bruno.quem_ajuda}.`],
      ["onde leio sobre a tarefa?", "onde_ler", `Para essa tarefa, leia ${bruno.onde_ler}.`],
      ["que sistema a tarefa mexe?", "sistemas", `Sistemas da tarefa: ${bruno.sistemas}.`],
      ["por que essa tarefa importa?", "porque", `Ela importa porque ${bruno.porque}.`],
      ["o que é a minha tarefa?", "o_que", `A sua primeira tarefa: ${bruno.titulo} O problema: ${bruno.problema}.`],
    ];
    for (const [fala, intencao, texto] of casos) {
      expect(respostaSobreTarefa(fala, bruno, true), fala).toEqual({
        kind: "resposta",
        intencao,
        texto,
        fontes: intencao === "comecar" || intencao === "onde_ler" ? [bruno.onde_ler] : [`Primeira tarefa · ${bruno.titulo}`],
      });
    }
    expect(respostaSobreTarefa("onde leio sobre a tarefa?", bruno, true)).toMatchObject({ fontes: [bruno.onde_ler] });
  });

  it("variações naturais casam a intenção certa (revisão, I1)", () => {
    const casos: [string, string][] = [
      ["por onde eu começo a tarefa?", "comecar"],
      ["como eu começo a tarefa?", "comecar"],
      ["como faço a tarefa?", "comecar"],
      ["o que faço primeiro na tarefa?", "comecar"],
      ["quem pode me ajudar com a tarefa?", "quem_ajuda"],
      ["quem me ajuda na tarefa?", "quem_ajuda"],
      ["quem vai revisar a tarefa?", "quem_ajuda"],
      ["e se eu travar na tarefa?", "quem_ajuda"],
      ["onde eu leio sobre a tarefa?", "onde_ler"],
      ["o que eu leio para a tarefa?", "onde_ler"],
      ["em que repo fica a tarefa?", "sistemas"],
      ["onde a tarefa mexe?", "sistemas"],
      ["qual o objetivo da tarefa?", "o_que"],
      ["o que eu vou fazer na tarefa?", "o_que"],
      ["o que tenho que fazer na tarefa?", "o_que"],
      ["qual é a minha tarefa?", "o_que"],
    ];
    for (const [fala, intencao] of casos) expect(respostaSobreTarefa(fala, bruno, true), fala).toMatchObject({ kind: "resposta", intencao });
  });

  it("pedir para explicar, mostrar ou repetir a tarefa é o_que (revisão, I2)", () => {
    for (const fala of ["me explica a tarefa?", "pode repetir a tarefa?", "pode me mostrar a tarefa de novo?"]) {
      expect(respostaSobreTarefa(fala, bruno, true), fala).toMatchObject({ kind: "resposta", intencao: "o_que" });
    }
  });

  it("'qual é a X da tarefa' não responde o resumo (revisão, I3)", () => {
    for (const fala of ["qual é a linguagem da tarefa?", "qual é a data de entrega da tarefa?", "o que é a dlq da tarefa?", "qual a parte mais importante da tarefa?"]) {
      expect(respostaSobreTarefa(fala, bruno, true), fala).toMatchObject({ kind: "sem_fonte" });
    }
  });

  it("fala sobre tarefas em geral não é sobre a tarefa da pessoa (revisão, I4)", () => {
    for (const fala of ["quais tarefas o time faz?", "como o time divide as tarefas?", "como abro um ticket de incidente?", "o que acontece com a task na dlq?"]) {
      expect(respostaSobreTarefa(fala, bruno, true), fala).toBeNull();
      expect(respostaSobreTarefa(fala, bruno, false), fala).toBeNull();
    }
  });

  it("fala que não cita a tarefa devolve null", () => {
    for (const fala of ["por onde começo?", "quem cuida do authorizer?"]) expect(respostaSobreTarefa(fala, bruno, true), fala).toBeNull();
  });

  it("antes de apresentar, não adianta a tarefa", () => {
    const r = respostaSobreTarefa("por onde começo a tarefa?", bruno, false);
    expect(r).toEqual({
      kind: "ainda_nao",
      texto: "Eu te apresento a sua primeira tarefa no fim da sessão. Se quiser ver agora, é só pedir para ver a primeira tarefa.",
    });
    expect(r && "texto" in r ? r.texto : "").not.toContain(bruno.titulo);
  });

  it("pergunta que a tarefa não responde vira sem_fonte", () => {
    for (const fala of ["qual o prazo da tarefa?", "qual a linguagem da tarefa?"]) {
      expect(respostaSobreTarefa(fala, bruno, true), fala).toEqual({
        kind: "sem_fonte",
        motivo: "A tarefa não diz isso: ela traz o problema, por que importa, os sistemas, onde ler e quem ajuda.",
      });
    }
  });
});
