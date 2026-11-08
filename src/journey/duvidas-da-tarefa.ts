// Dúvidas sobre a primeira tarefa durante a sessão (#79, PRODUCT.md §4.4): a resposta sai dos campos da tarefa da
// própria pessoa (problema, por que importa, sistemas, onde ler, quem ajuda), na hora e sem o LLM. O que a tarefa
// não diz vira encaminhamento (§4.5). Nenhum texto aqui é da empresa fictícia: vale para qualquer catálogo.
import { keywords, normalize, sameWord } from "./conditions";
import type { TarefaDoTime } from "./primeira-tarefa";

export type IntencaoDaTarefa = "comecar" | "quem_ajuda" | "onde_ler" | "sistemas" | "porque" | "o_que";

export type RespostaSobreTarefa =
  | { kind: "resposta"; intencao: IntencaoDaTarefa; texto: string; fontes: string[] }
  | { kind: "ainda_nao"; texto: string }
  | { kind: "sem_fonte"; motivo: string };

const AINDA_NAO = "Eu te apresento a sua primeira tarefa no fim da sessão. Se quiser ver agora, é só pedir para ver a primeira tarefa.";
const SEM_FONTE = "A tarefa não diz isso: ela traz o problema, por que importa, os sistemas, onde ler e quem ajuda.";
const PALAVRAS_DA_TAREFA = ["tarefa", "task", "ticket"];

// Na ordem: a primeira que casa decide. A frase casa no começo de uma palavra ("comec" pega "começo").
const INTENCOES: [IntencaoDaTarefa, string[], (t: TarefaDoTime) => string][] = [
  ["comecar", ["por onde comec", "como comec", "primeiro passo"], (t) => `Comece lendo ${t.onde_ler}. Sistemas: ${t.sistemas}. Se travar, fale com ${t.quem_ajuda}.`],
  ["quem_ajuda", ["quem ajuda", "quem pode ajudar", "com quem", "falar com", "quem revisa", "travar", "travei"], (t) => `Quem ajuda nessa tarefa: ${t.quem_ajuda}.`],
  ["onde_ler", ["onde leio", "onde ler", "onde acho", "onde encontro", "documentacao", "readme"], (t) => `Para essa tarefa, leia ${t.onde_ler}.`],
  ["sistemas", ["sistema", "servico", "onde mexe", "mexe em", "mexe no", "repositorio", "codigo"], (t) => `Sistemas da tarefa: ${t.sistemas}.`],
  ["porque", ["por que", "porque", "pra que", "para que", "importa", "motivo"], (t) => `Ela importa porque ${t.porque}.`],
  [
    "o_que",
    ["o que e a", "o que e minha", "qual e a", "qual a minha", "qual minha", "qual a tarefa", "qual a primeira tarefa", "do que se trata", "sobre o que"],
    (t) => `A sua primeira tarefa: ${t.titulo} O problema: ${t.problema}.`,
  ],
];

/** null = a fala não cita a tarefa, ou a pessoa não tem tarefa. Não checa se é pergunta: quem chama checa. */
export function respostaSobreTarefa(text: string, tarefa: TarefaDoTime | null, apresentada: boolean): RespostaSobreTarefa | null {
  if (!tarefa) return null;
  const citaTarefa = keywords(text).some((w) => PALAVRAS_DA_TAREFA.some((p) => sameWord(w, p)));
  if (!citaTarefa) return null;
  if (!apresentada) return { kind: "ainda_nao", texto: AINDA_NAO };
  const said = ` ${normalize(text)} `;
  for (const [intencao, frases, texto] of INTENCOES) {
    if (!frases.some((f) => said.includes(` ${f}`))) continue;
    const fontes = intencao === "comecar" || intencao === "onde_ler" ? [tarefa.onde_ler] : [`Primeira tarefa · ${tarefa.titulo}`];
    return { kind: "resposta", intencao, texto: texto(tarefa), fontes };
  }
  return { kind: "sem_fonte", motivo: SEM_FONTE };
}
