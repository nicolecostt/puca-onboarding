// Dúvidas sobre a primeira tarefa durante a sessão (#79, PRODUCT.md §4.4): a resposta sai dos campos da tarefa da
// própria pessoa (problema, por que importa, sistemas, onde ler, quem ajuda), na hora e sem o LLM. O que a tarefa
// não diz vira encaminhamento (§4.5). Nenhum texto aqui é da empresa fictícia: vale para qualquer catálogo.
import { normalize } from "./conditions";
import type { TarefaDoTime } from "./primeira-tarefa";

export type IntencaoDaTarefa = "comecar" | "quem_ajuda" | "onde_ler" | "sistemas" | "porque" | "o_que";

export type RespostaSobreTarefa =
  | { kind: "resposta"; intencao: IntencaoDaTarefa; texto: string; fontes: string[] }
  | { kind: "ainda_nao"; texto: string }
  | { kind: "sem_fonte"; motivo: string };

const AINDA_NAO = "Eu te apresento a sua primeira tarefa no fim da sessão. Se quiser ver agora, é só pedir para ver a primeira tarefa.";
const SEM_FONTE = "A tarefa não diz isso: ela traz o problema, por que importa, os sistemas, onde ler e quem ajuda.";
// A fala é sobre a tarefa DA PESSOA: "a tarefa", "minha tarefa", "primeira tarefa", no singular. "As tarefas do time",
// "ticket de incidente" e "task na dlq" falam de outra coisa e seguem o caminho de sempre.
const TAREFA_DA_PESSOA = / (a|essa|esta|da|na|pela|minha|sua|dessa|nessa|desta|nesta|primeira) (minha |sua )?(primeira )?tarefa /;
// "o que é" só quando a tarefa vem logo depois: "qual é a linguagem da tarefa?" não é o resumo da tarefa.
const O_QUE_E_A_TAREFA = / (o que e|qual e|qual|qual o|qual a) (a |o )?(minha |sua )?(primeira )?tarefa /;

/** Palavras inteiras da fala e testes por radical ("ajud" pega "ajuda", "ajudar"); pronomes no meio não atrapalham. */
function leitor(text: string) {
  const said = ` ${normalize(text)} `;
  const words = said.trim().split(" ");
  return {
    said,
    tem: (...radicais: string[]) => words.some((w) => radicais.some((r) => w.startsWith(r))),
    palavra: (...ps: string[]) => words.some((w) => ps.includes(w)),
    frase: (...fs: string[]) => fs.some((f) => said.includes(` ${f} `)),
  };
}

// Na ordem: a primeira que casa decide.
const INTENCOES: [IntencaoDaTarefa, (l: ReturnType<typeof leitor>) => boolean, (t: TarefaDoTime) => string][] = [
  ["quem_ajuda", (l) => l.tem("ajud", "revis", "trav") || l.frase("com quem", "falar com"), (t) => `Quem ajuda nessa tarefa: ${t.quem_ajuda}.`],
  [
    "onde_ler",
    (l) => l.tem("leio", "leitura", "document", "readme") || l.palavra("ler") || l.frase("onde acho", "onde encontro"),
    (t) => `Para essa tarefa, leia ${t.onde_ler}.`,
  ],
  [
    "comecar",
    (l) => l.tem("comec") || l.palavra("primeiro") || (l.palavra("como") && l.palavra("faco", "fazer", "faz")),
    (t) => `Comece lendo ${t.onde_ler}. Sistemas: ${t.sistemas}. Se travar, fale com ${t.quem_ajuda}.`,
  ],
  ["sistemas", (l) => l.tem("sistema", "servic", "repo", "codigo", "mexe"), (t) => `Sistemas da tarefa: ${t.sistemas}.`],
  [
    "porque",
    (l) => l.frase("por que", "pra que", "para que") || l.palavra("porque", "importa", "motivo"),
    (t) => `Ela importa porque ${t.porque}.`,
  ],
  [
    "o_que",
    (l) =>
      l.tem("explic", "mostr", "repet") ||
      l.palavra("objetivo") ||
      l.frase("de novo", "do que se trata", "sobre o que") ||
      (l.frase("o que") && l.palavra("fazer", "faco")) ||
      O_QUE_E_A_TAREFA.test(l.said),
    (t) => `A sua primeira tarefa: ${t.titulo} O problema: ${t.problema}.`,
  ],
];

/** A fala sem a palavra "tarefa": para o conhecimento da sessão casar pelo resto da pergunta (route.ts). */
export function semPalavraTarefa(text: string): string {
  return text.replace(/\btarefas?\b/gi, " ");
}

/** null = a fala não fala da tarefa da pessoa, ou a pessoa não tem tarefa. Não checa se é pergunta: quem chama checa. */
export function respostaSobreTarefa(text: string, tarefa: TarefaDoTime | null, apresentada: boolean): RespostaSobreTarefa | null {
  if (!tarefa) return null;
  const l = leitor(text);
  if (!TAREFA_DA_PESSOA.test(l.said)) return null;
  if (!apresentada) return { kind: "ainda_nao", texto: AINDA_NAO };
  for (const [intencao, casa, texto] of INTENCOES) {
    if (!casa(l)) continue;
    const fontes = intencao === "comecar" || intencao === "onde_ler" ? [tarefa.onde_ler] : [`Primeira tarefa · ${tarefa.titulo}`];
    return { kind: "resposta", intencao, texto: texto(tarefa), fontes };
  }
  return { kind: "sem_fonte", motivo: SEM_FONTE };
}
