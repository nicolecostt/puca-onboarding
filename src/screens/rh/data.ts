// Dados de exemplo do painel do RH (PRODUCT.md §5): as integrações em andamento na empresa da demo.
// Só esta tela usa. Tudo aqui descreve o PROCESSO de integração (etapas, pendências, tempo até os marcos),
// nunca o desempenho da pessoa: não há nota, avaliação nem produtividade (§5, privacidade e confiança).
import type { Vinculo } from "../../journey/types";
import { profiles } from "../../data";

/** Etapas da integração, na ordem (as mesmas do progresso no início). */
export const ETAPAS = ["Acessos", "Sessão", "Primeira tarefa", "Pronto para contribuir"] as const;

/** Etapas obrigatórias que o RH acompanha. A cultura só vale para quem é novo na empresa. */
export const OBRIGATORIAS = [
  { id: "contrato", label: "Contrato e documentos", so: null },
  { id: "cultura", label: "Onboarding cultural", so: "novo" },
  { id: "acessos", label: "Acessos das ferramentas", so: null },
  { id: "sessao", label: "Primeira sessão com o Puca", so: null },
  { id: "tarefa", label: "Primeira tarefa aprovada", so: null },
] as const;
export type Obrigatoria = (typeof OBRIGATORIAS)[number]["id"];

export interface Pendencia {
  label: string;
  /** Quem resolve (gestor, TI, RH). */
  quem: string;
}

export interface Integracao {
  nome: string;
  cargo: string;
  time: string;
  vinculo: Vinculo;
  /** Dias desde o início da integração. */
  dia: number;
  /** Índice da etapa atual em ETAPAS. */
  etapa: number;
  feitas: Obrigatoria[];
  pendencias: Pendencia[];
  sessoes: number;
  /** Dúvidas encaminhadas ao buddy que ainda não foram respondidas. */
  encaminhamentosAbertos: number;
  /** Dias até a primeira tarefa aprovada (só de quem já chegou lá). */
  diasAtePrimeiraTarefa?: number;
  buddy: string;
}

export const RH_PESSOA = { nome: "Renata Alves", papel: "Pessoas e cultura" };

export const INTEGRACOES: Integracao[] = [
  {
    nome: profiles.ana.name, cargo: profiles.ana.role, time: "Terminais", vinculo: "novo", dia: 3, etapa: 1,
    feitas: ["contrato", "cultura", "acessos"], pendencias: [{ label: "Acesso ao Kafka UI", quem: "Gestor" }],
    sessoes: 1, encaminhamentosAbertos: 1, buddy: "Paula Nunes",
  },
  {
    nome: profiles.bruno.name, cargo: profiles.bruno.role, time: "Terminais", vinculo: "transicao", dia: 2, etapa: 1,
    feitas: ["contrato", "acessos"], pendencias: [{ label: "Acesso ao Grafana", quem: "TI" }],
    sessoes: 1, encaminhamentosAbertos: 0, buddy: "Paula Nunes",
  },
  {
    nome: "Camila Rocha", cargo: "Analista de dados", time: "Liquidação", vinculo: "novo", dia: 9, etapa: 2,
    feitas: ["contrato", "cultura", "acessos", "sessao"], pendencias: [],
    sessoes: 3, encaminhamentosAbertos: 1, buddy: "Rafael Lins",
  },
  {
    nome: "Davi Moreira", cargo: "Engenheiro de software", time: "Autorização", vinculo: "novo", dia: 16, etapa: 3,
    feitas: ["contrato", "cultura", "acessos", "sessao", "tarefa"], pendencias: [],
    sessoes: 5, encaminhamentosAbertos: 0, diasAtePrimeiraTarefa: 11, buddy: "Júlia Paiva",
  },
  {
    nome: "Elisa Fonseca", cargo: "Engenheira de plataforma", time: "Terminais", vinculo: "transicao", dia: 7, etapa: 3,
    feitas: ["contrato", "acessos", "sessao", "tarefa"], pendencias: [],
    sessoes: 2, encaminhamentosAbertos: 0, diasAtePrimeiraTarefa: 5, buddy: "Lucas Melo",
  },
  {
    nome: "Felipe Araújo", cargo: "Engenheiro de software", time: "Liquidação", vinculo: "novo", dia: 1, etapa: 0,
    feitas: ["contrato"], pendencias: [
      { label: "Exame admissional", quem: "RH" },
      { label: "Acesso ao GitHub", quem: "TI" },
      { label: "Acesso ao Kafka UI", quem: "Gestor" },
    ],
    sessoes: 0, encaminhamentosAbertos: 0, buddy: "Carla Mendes",
  },
  {
    nome: "Gabriela Lima", cargo: "Engenheira de software", time: "Autorização", vinculo: "transicao", dia: 12, etapa: 2,
    feitas: ["contrato", "acessos", "sessao"], pendencias: [{ label: "Aprovação da primeira tarefa", quem: "Gestor" }],
    sessoes: 4, encaminhamentosAbertos: 2, buddy: "Diego Ramos",
  },
  {
    nome: "Heitor Prado", cargo: "Analista de suporte", time: "Terminais", vinculo: "novo", dia: 21, etapa: 3,
    feitas: ["contrato", "cultura", "acessos", "sessao", "tarefa"], pendencias: [],
    sessoes: 6, encaminhamentosAbertos: 0, diasAtePrimeiraTarefa: 14, buddy: "Paula Nunes",
  },
];

/** Dúvidas por momento da sessão nos últimos 90 dias, por vínculo (só a contagem; o texto das perguntas não vem para o RH).
 *  Quem está em transição já conhece a empresa e pula a parte institucional. */
export const DUVIDAS_POR_MOMENTO: Record<Vinculo, Record<string, number>> = {
  novo: { "pagamentos": 22, "falha": 15, "quem-cuida": 12, "seu-time": 9, "primeira-tarefa": 6, "empresa-e-cultura": 6 },
  transicao: { "pagamentos": 12, "falha": 12, "quem-cuida": 7, "seu-time": 3, "primeira-tarefa": 3 },
};

/** Integrações que começaram nos últimos 90 dias e quantas terminaram com a saída da pessoa (turnover de 90 dias). */
export const NOVENTA_DIAS = { comecaram: 14, sairam: 1 };

/** Respostas da pergunta de fim de integração: "de 0 a 10, quanto você recomendaria a integração daqui?". */
export const FEEDBACK = { promotores: 9, neutros: 3, detratores: 1 };
