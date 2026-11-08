// Dados sintéticos do início para a demo (mundo fictício da Tail): ferramentas do time, acessos e tarefas.
// Só esta tela usa. A primeira tarefa vem do catálogo da jornada, escolhida pelo vínculo da pessoa (tarefaDaPessoa).
import type { TarefaDoTime } from "../../journey/primeira-tarefa";

export type AccessStatus = "ok" | "pending" | "missing";

export interface Tool {
  id: string;
  name: string;
  /** Para que a pessoa usa no time. */
  use: string;
  status: AccessStatus;
}

/** Ferramentas do time Terminais. A que está "missing" o Puca percebe ao abrir o início e pede ao gestor. */
export const TOOLS: Tool[] = [
  { id: "github", name: "GitHub", use: "Código do terminal-config-api", status: "ok" },
  { id: "slack", name: "Slack", use: "Canal #time-terminais", status: "ok" },
  { id: "jira", name: "Jira", use: "Tickets do time", status: "ok" },
  { id: "grafana", name: "Grafana", use: "Painéis das maquininhas", status: "pending" },
  { id: "kafka", name: "Kafka UI", use: "Fila terminal.config.updated", status: "missing" },
];

export type TaskState = "done" | "now" | "next";

export interface Task {
  title: string;
  detail: string;
  state: TaskState;
  action?: { label: string; href: string };
}

/** Tarefas do início. A primeira tarefa é a do vínculo da pessoa; sem tarefa no catálogo, a linha não aparece. */
export function tasksFor(tarefa: TarefaDoTime | null, nome: string | undefined): Task[] {
  return [
    { title: "Call inicial com o Puca", detail: "O Puca já sabe o que você conhece e o que quer aprender.", state: "done" },
    {
      title: "Sua primeira sessão",
      detail: "O caminho de uma transação, quando falha e quem cuida de cada parte.",
      state: "now",
      action: { label: "Começar a sessão", href: "../lesson/" },
    },
    ...(tarefa ? [{ title: `Primeira tarefa: ${nome ?? tarefa.titulo}`, detail: tarefa.problema, state: "next" as const }] : []),
    { title: "Dar oi no #time-terminais", detail: "Se apresentar para o time no canal do Slack.", state: "next" },
  ];
}

/** Etapas do progresso (topo) e onde a pessoa está. */
export const TRAIL: { label: string; state: TaskState }[] = [
  { label: "Acessos", state: "now" },
  { label: "Sessão", state: "next" },
  { label: "Primeira tarefa", state: "next" },
  { label: "Pronto para contribuir", state: "next" },
];
