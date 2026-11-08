// Dados sintéticos do início para a demo (mundo fictício da Kota): ferramentas do time, acessos e tarefas.
// Só esta tela usa. A primeira tarefa vem do catálogo da jornada, escolhida pelo vínculo da pessoa (tarefaDaPessoa).
import type { PedidoDeAprovacao, TarefaDoTime } from "../../journey/primeira-tarefa";

export type AccessStatus = "ok" | "pending" | "missing";

export interface Tool {
  id: string;
  name: string;
  /** Para que a pessoa usa no time. */
  use: string;
  status: AccessStatus;
}

/** Ferramentas do time de Livro-razão. A que está "missing" Puca percebe ao abrir o início e pede ao gestor. */
export const TOOLS: Tool[] = [
  { id: "github", name: "GitHub", use: "Código do kota-bank", status: "ok" },
  { id: "slack", name: "Slack", use: "Canal #livro-razao", status: "ok" },
  { id: "notion", name: "Notion", use: "Jeito de trabalhar e RFCs", status: "ok" },
  { id: "docker", name: "Docker", use: "Subir o banco na sua máquina", status: "pending" },
  { id: "producao", name: "Ambiente de produção", use: "Sistemas do Livro-razão", status: "missing" },
];

export type TaskState = "done" | "now" | "next";

export interface Task {
  title: string;
  detail: string;
  state: TaskState;
  action?: { label: string; href: string };
}

/** Tarefas do início. A primeira tarefa é a do vínculo da pessoa; sem tarefa no catálogo, a linha não aparece. */
export function tasksFor(
  tarefa: TarefaDoTime | null,
  nome: string | undefined,
  pedido: PedidoDeAprovacao | null,
): Task[] {
  const task: Task | null = tarefa ? {
    title: `Primeira tarefa: ${nome ?? tarefa.titulo}`,
    detail: pedido
      ? pedido.status === "aprovada" ? "Aprovada pela gestão." : `Aguardando aprovação de ${pedido.gestor}.`
      : tarefa.problema,
    state: pedido ? "now" : "next",
    action: pedido ? {
      label: "Ver primeira tarefa",
      href: `../primeira-tarefa/?id=${encodeURIComponent(pedido.id)}`,
    } : undefined,
  } : null;
  return [
    ...(task ? [task] : []),
    {
      title: "Dar oi no #livro-razao",
      detail: "Se apresentar para o time no canal do Slack.",
      state: pedido ? "next" : "now",
      action: { label: "Abrir Slack da Kota", href: "../live-session/" },
    },
  ];
}
