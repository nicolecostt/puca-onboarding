import { mapa } from "../mapa";
import { ARVORE } from "../notion/arvore";
import { resolverLinks } from "../notion/links";
import { caminhoAdr, type MapaKota, type TimeId } from "../tipos";

export type Perfil = keyof MapaKota["perfis"];

export interface TarefaKota {
  chave: string;                  // pasta dos patches em kit/kota/tarefas/<chave>/
  titulo: string;                 // título da issue; a publicação acha a issue por ele
  time: TimeId;
  perfis: Perfil[];
  servico: string;                // argumento de scripts/testar.sh
  testeQueFalha: string;          // como aparece na saída de scripts/testar.sh: Classe.metodo
  problema: string;
  porQueImporta: string;
  sistemas: string[];             // ids de SistemaKota
  ondeLer: string[];              // caminhos do kota-bank ou notion:<chave>
  quemAjuda: string[];            // ids de PessoaKota
  autor: string;                  // id de PessoaKota; assina a issue e os commits das branches
}

const adr = (n: number) => caminhoAdr(mapa.adrs.find((a) => a.n === n)!);
const codigo = (servico: string, arquivo: string) =>
  `src/ledger/${servico}/src/main/java/br/com/kota/${servico}/${arquivo}`;

export const TAREFAS: TarefaKota[] = [
  {
    chave: "limite-por-transacao",
    titulo: "Limite de R$ 10.000,00 por transação no ledgerwriter",
    time: "livro-razao",
    perfis: ["novo"],
    servico: "ledgerwriter",
    testeQueFalha: "TransactionValidatorTest.validationFail_WhenTransactionAmount_IsAboveLimit",
    problema:
      "O `ledgerwriter` aceita transação de qualquer valor positivo: hoje passaria uma transferência de mais de R$ 21 milhões, " +
      "o maior valor que cabe no campo. O Livro-razão combinou um teto de R$ 10.000,00 (1.000.000 centavos) por transação. " +
      "Acima disso, o `TransactionValidator` recusa com a mensagem `amount above limit`, e o serviço responde 400, como já faz com valor inválido.",
    porQueImporta:
      "O validador é a última barreira antes de gravar no livro-razão: um valor digitado errado ou uma conta invadida não move tudo de uma vez. " +
      "E a mudança é pequena e fica no caminho de toda transferência, do site até o banco do livro-razão.",
    sistemas: ["ledgerwriter", "frontend", "ledger-db"],
    ondeLer: [
      "src/ledger/ledgerwriter/README.md",
      codigo("ledgerwriter", "TransactionValidator.java"),
      adr(1),
      "notion:sistemas",
      "notion:onboarding-novo",
    ],
    quemAjuda: ["beatriz", "thiago"],
    autor: "thiago",
  },
  {
    chave: "extrato-de-outra-conta",
    titulo: "Extrato de outra conta responde 403, não 401",
    time: "livro-razao",
    perfis: ["transicao"],
    servico: "transactionhistory",
    testeQueFalha: "TransactionHistoryControllerTest.getTransactionsFailsWhenAccountDoesNotMatchAuthenticatedUser",
    problema:
      "Quando alguém com um JWT válido pede o extrato de uma conta que não é a dele, o `transactionhistory` responde 401, " +
      "que quer dizer \"não autenticado\". A pessoa está autenticada; falta permissão para aquela conta, e a resposta certa é 403. " +
      "O 401 continua para token ausente ou inválido.",
    porQueImporta:
      "Com 401 nos dois casos, quem lê o log ou o painel não separa um token vencido de alguém tentando ler o extrato de outro cliente. " +
      "Você conhece o JWT pelo lado de Contas, onde o `userservice` assina; aqui está o outro lado, o serviço que confere.",
    sistemas: ["transactionhistory", "userservice", "frontend"],
    ondeLer: [
      "src/ledger/transactionhistory/README.md",
      codigo("transactionhistory", "TransactionHistoryController.java"),
      adr(2),
      "notion:sistemas",
      "notion:onboarding-transicao",
    ],
    quemAjuda: ["beatriz", "gustavo"],
    autor: "gustavo",
  },
  {
    chave: "saldo-sem-livro-razao",
    titulo: "Saldo responde 503 quando o cache não consegue ler o livro-razão",
    time: "livro-razao",
    perfis: ["novo", "transicao"],
    servico: "balancereader",
    testeQueFalha: "BalanceReaderControllerTest.getBalanceFailsWhenCacheThrowsError",
    problema:
      "O `balancereader` guarda o saldo em cache e, na primeira consulta de uma conta, lê do `ledger-db`. " +
      "Se o banco não responde, o cache falha e o serviço devolve 500 com `cache error`. " +
      "500 diz que o serviço quebrou; o que aconteceu foi uma dependência fora do ar, e vale tentar de novo. A resposta certa é 503.",
    porQueImporta:
      "No plantão, 500 e 503 contam histórias diferentes: um é defeito no serviço, o outro é o banco fora. " +
      "E é uma porta de entrada para o cache de saldo, que o ADR 4 explica.",
    sistemas: ["balancereader", "ledger-db", "ledgerwriter"],
    ondeLer: [
      "src/ledger/balancereader/README.md",
      codigo("balancereader", "BalanceReaderController.java"),
      adr(4),
      "notion:sistemas",
      "notion:incidentes",
    ],
    quemAjuda: ["beatriz", "gustavo"],
    autor: "beatriz",
  },
];

export interface Saida { ok: boolean; texto: string }

export function corpoIssue(t: TarefaKota, n: number, m: MapaKota, urls: Record<string, string>): string {
  const pessoa = (id: string) => m.pessoas.find((p) => p.id === id)!;
  const time = (id: TimeId) => m.times.find((x) => x.id === id)!;
  const doTime = time(t.time);
  const gestor = pessoa(doTime.gestor);
  const autor = pessoa(t.autor);
  const paraQuem: Record<Perfil, string> = {
    novo: "quem acabou de entrar na Kota",
    transicao: `quem vem do time ${time(m.perfis.transicao.de).nome}`,
  };
  const link = (fonte: string) => {
    if (!fonte.startsWith("notion:")) return `[\`${fonte}\`](https://github.com/${m.repo}/blob/main/${fonte})`;
    const titulo = ARVORE.find((no) => `notion:${no.chave}` === fonte)?.titulo ?? fonte;
    return `[${titulo}, no Notion](${resolverLinks(fonte, urls)})`;
  };
  const sistema = (id: string) => {
    const s = m.sistemas.find((x) => x.id === id)!;
    return `- \`${s.id}\` (\`${s.pasta}\`): ${s.oQueFaz}`;
  };
  return [
    `Primeira tarefa do time ${doTime.nome}, para ${t.perfis.map((p) => paraQuem[p]).join(" ou ")}. ` +
      "Não é avaliação: é um jeito de conhecer o código com ajuda por perto.",
    "",
    `Aberta por ${autor.nome}, ${autor.cargo.toLowerCase()} do time ${doTime.nome}.`,
    "",
    "## Problema", "", t.problema, "",
    "## Por que importa", "", t.porQueImporta, "",
    "## Sistemas", "", ...t.sistemas.map(sistema), "",
    "## Onde ler", "", ...t.ondeLer.map((f) => `- ${link(f)}`), "",
    "## Quem ajuda", "",
    ...t.quemAjuda.map((id) => `- ${pessoa(id).nome}, ${pessoa(id).cargo.toLowerCase()}`),
    `- No Slack, o canal ${doTime.canalAjuda}`,
    "",
    "## Como começar", "",
    `1. Combine com ${gestor.nome}, ${gestor.cargo.toLowerCase()} do time ${doTime.nome}: o gestor aprova a primeira tarefa antes de você começar.`,
    `2. \`git switch tarefa/${n}\``,
    `3. \`scripts/testar.sh ${t.servico}\`: o teste \`${t.testeQueFalha}\` falha. A tarefa é fazê-lo passar sem quebrar os outros.`,
    `4. Quando terminar, compare o seu caminho com a branch \`solucao/${n}\` (\`git diff solucao/${n}\`).`,
    "",
  ].join("\n");
}

// Resumo do Maven no fim de cada módulo; as linhas por classe continuam com "Time elapsed" e não casam.
const RESUMO_MAVEN = /Tests run: \d+, Failures: (\d+), Errors: (\d+), Skipped: \d+$/gm;

function testesQueFalharam(texto: string): number | undefined {
  const resumos = [...texto.matchAll(RESUMO_MAVEN)];
  return resumos.length ? resumos.reduce((n, r) => n + Number(r[1]) + Number(r[2]), 0) : undefined;
}

export function conferirTarefa(saidas: { main: Saida; tarefa: Saida; solucao: Saida }, t: TarefaKota): string[] {
  const erros: string[] = [];
  const onde = `scripts/testar.sh ${t.servico}`;
  if (!saidas.main.ok) erros.push(`${t.chave}: ${onde} falha na main`);
  if (!saidas.solucao.ok) erros.push(`${t.chave}: ${onde} falha na branch solucao`);
  if (saidas.tarefa.ok) return [...erros, `${t.chave}: ${onde} passa na branch tarefa; o teste.patch não reproduz o problema`];
  if (!saidas.tarefa.texto.includes(t.testeQueFalha)) return [...erros, `${t.chave}: a branch tarefa falha sem citar ${t.testeQueFalha}`];
  const falhas = testesQueFalharam(saidas.tarefa.texto);
  if (falhas === undefined) return [...erros, `${t.chave}: a branch tarefa falha antes de rodar os testes`];
  if (falhas !== 1) return [...erros, `${t.chave}: a branch tarefa falha em ${falhas} testes, e devia falhar só em ${t.testeQueFalha}`];
  return erros;
}
