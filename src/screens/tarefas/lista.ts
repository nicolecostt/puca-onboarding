// A parte da tela de tarefas que não mexe no DOM: agrupar, ordenar e dizer de onde veio cada tarefa.
import type { TarefaAtribuida } from "../../journey/tarefas";

const recentes = (a: TarefaAtribuida, b: TarefaAtribuida) => b.at.localeCompare(a.at);

export function grupos(tarefas: TarefaAtribuida[]): { aFazer: TarefaAtribuida[]; feitas: TarefaAtribuida[] } {
  return {
    aFazer: tarefas.filter((t) => t.status === "a-fazer").sort(recentes),
    feitas: tarefas.filter((t) => t.status === "feita").sort(recentes),
  };
}

export function origemDaTarefa(t: TarefaAtribuida): string {
  if (t.origem === "call") return "Da call inicial";
  return t.momento ? `Da sessão · ${t.momento}` : "Da sessão";
}
