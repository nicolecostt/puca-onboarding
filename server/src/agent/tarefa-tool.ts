// Ferramenta assign_task, a mesma na call inicial e na sessão (contrato "Tarefas do agente" em docs/contratos.md).
// Fixa: mudar a lista de ferramentas por turno quebraria o cache do prompt.
import type { ToolSpec } from "../llm";

export const ASSIGN_TASK: ToolSpec = {
  type: "function",
  function: {
    name: "assign_task",
    description: "Passa uma tarefa prática e pequena para a pessoa fazer depois da conversa. Ela aparece na tela de tarefas.",
    parameters: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "O que fazer, começando por um verbo (ex.: Rodar o ledgerwriter na sua máquina)." },
        porque: { type: "string", description: "Por que isso importa no trabalho dela, em uma frase." },
        passos: { type: "array", items: { type: "string" }, description: "De 1 a 5 passos curtos." },
        onde: { type: "string", description: "Onde fazer ou ler: repo, página do Notion ou canal." },
      },
      required: ["titulo", "porque", "passos"],
    },
  },
};
