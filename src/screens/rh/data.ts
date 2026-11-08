// Dados de exemplo do painel do RH (PRODUCT.md §5): as integrações em andamento na empresa da demo.
// Só esta tela usa. Tudo aqui descreve o PROCESSO de integração (etapas, pendências, tempo até os marcos),
// nunca o desempenho da pessoa: não há nota, avaliação nem produtividade (§5, privacidade e confiança).
import type { Vinculo } from "../../journey/types";
import { mapa } from "../../../kit/kota/mapa";
import { profiles } from "../../data";

/** Etapas da integração, na ordem (as mesmas do progresso no início). */
export const ETAPAS = ["Acessos", "Sessão", "Primeira tarefa", "Pronto para contribuir"] as const;

/** Etapas obrigatórias que o RH acompanha. A cultura só vale para quem é novo na empresa. */
export const OBRIGATORIAS = [
  { id: "contrato", label: "Contrato e documentos", so: null },
  { id: "cultura", label: "Onboarding cultural", so: "novo" },
  { id: "acessos", label: "Acessos das ferramentas", so: null },
  { id: "sessao", label: "Primeira sessão com Puca", so: null },
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

// As integrações são as dos dois perfis do mapa da Kota: ninguém fora do mapa aparece no painel.
const people = mapa.pessoas.find((p) => p.area === "people")!;
const livroRazao = mapa.times.find((t) => t.id === "livro-razao")!;
const buddy = mapa.pessoas.find((p) => p.id === livroRazao.buddies[0])!.nome;

export const RH_PESSOA = { nome: people.nome, papel: people.cargo };

export const INTEGRACOES: Integracao[] = [
  {
    nome: profiles.ana.name, cargo: profiles.ana.role, time: profiles.ana.toTeam, vinculo: "novo", dia: 3, etapa: 1,
    feitas: ["contrato", "cultura", "acessos"], pendencias: [{ label: "Acesso a produção do Livro-razão", quem: "Gestor" }],
    sessoes: 1, encaminhamentosAbertos: 1, buddy,
  },
  {
    nome: profiles.bruno.name, cargo: profiles.bruno.role, time: profiles.bruno.toTeam, vinculo: "transicao", dia: 2, etapa: 1,
    feitas: ["contrato", "acessos"], pendencias: [{ label: "Entrar na escala de plantão do Livro-razão", quem: "Gestor" }],
    sessoes: 1, encaminhamentosAbertos: 0, buddy,
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
