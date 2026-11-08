import { mapa } from "../mapa";
import { caminhoAdr } from "../tipos";

export interface MensagemKota { canal: `#${string}`; autor: string; texto: string }   // autor = id de PessoaKota

const noRepo = (caminho: string) => `https://github.com/${mapa.repo}/blob/main/${caminho}`;
const adr = (n: number) => noRepo(caminhoAdr(mapa.adrs.find((a) => a.n === n)!));
const runbookLedgerDbCheio = noRepo("docs/runbooks/ledger-db-cheio.md");

const conversa = (canal: `#${string}`, falas: [autor: string, texto: string][]): MensagemKota[] =>
  falas.map(([autor, texto]) => ({ canal, autor, texto }));

export const HISTORICO: MensagemKota[] = [
  ...conversa("#geral", [
    ["simone", "Bom dia, Kota! Lembrete de onde as coisas ficam: política, benefício e carreira saem no #people; dúvida técnica vai no canal de ajuda de cada time."],
    ["jonas", "Lembrete da segurança: senha, token e chave de API nunca vão em mensagem do Slack, nem em mensagem direta. Se algo vazou, escreva na hora para seguranca@kota.example, que a gente troca junto."],
    ["eduardo", "A homologação fica fora do ar no sábado, das 8h às 12h, para a troca de versão do Postgres. Produção não muda."],
    ["natalia", "O alerta de disco do ledger-db de hoje cedo foi resolvido sem impacto para cliente. O resumo está no #livro-razao."],
    ["priscila", "A tela nova de depósito está no ar. Obrigada a todo mundo que testou na homologação."],
  ]),

  ...conversa("#people", [
    ["simone", "Lembrete: o processo do ciclo de desempenho e os critérios gerais estão na página Ciclo de desempenho, no Kota People do Notion. Trilha de carreira, promoção, bônus e revisão salarial têm página própria lá também."],
    ["simone", "Dúvida sobre férias, benefícios ou carreira: pergunte aqui se servir para todo mundo. Se for um caso seu, fale com seu gestor ou com People em people@kota.example."],
    ["simone", "A pesquisa de clima fica aberta até sexta. É anônima e leva uns 10 minutos."],
  ]),

  ...conversa("#contas", [
    ["rodrigo", "Deploy do userservice amanhã às 10h, com a atualização das bibliotecas de criptografia. Nada muda no login para o cliente."],
    ["bruno", "Deploy do contacts feito em produção: o cliente não consegue mais salvar a mesma conta de destino duas vezes. Sigo olhando os erros na próxima hora."],
    ["camila", "Planejamento do ciclo na segunda às 14h. Tragam o que ficou de fora do último."],
    ["rodrigo", "Deploy do userservice concluído. Logins com sucesso no mesmo patamar de ontem."],
    ["raissa", "Semana que vem tem a troca programada da chave do JWT. Vou seguir o runbook de troca de chave: as sessões abertas caem e o cliente entra de novo. Já avisei o atendimento."],
    ["rodrigo", "Plantão desta semana comigo; na próxima, Raíssa."],
  ]),

  ...conversa("#contas-ajuda", [
    ["larissa", "O token que o site recebe no login vale por quanto tempo?"],
    ["rodrigo", `Uma hora. Depois disso o site precisa pedir login de novo. Cada serviço confere o token sozinho, com a chave pública; o porquê está no ADR 2: ${adr(2)}`],
    ["larissa", "Era isso. Obrigada!"],
    ["gustavo", "No ambiente local, achei um contato salvo com a conta de destino errada. Quem cuida do contacts?"],
    ["raissa", "O contacts é nosso, de Contas. Manda os passos aqui no canal que eu olho hoje à tarde."],
  ]),

  ...conversa("#livro-razao", [
    ["thiago", "Deploy do ledgerwriter hoje às 14h, com a validação nova de limite por transferência. Quem tiver algo para entrar junto, avisa aqui até o meio-dia."],
    ["thiago", "Deploy do ledgerwriter concluído. Erros e tempo de resposta iguais aos de antes; sigo de olho até o fim da tarde."],
    ["gustavo", `Alerta de disco no ledger-db: 85% e subindo. Estou de plantão e vou seguir o runbook: ${runbookLedgerDbCheio}`],
    ["beatriz", "Gustavo, se quiser eu acompanho. O passo de medir o tamanho com o psql dentro do ledger-db mostra o que cresceu; começa por ele."],
    ["gustavo", "Valeu, Beatriz. Cresceu com o volume do dia de pagamento. Fiz o que o runbook manda e o disco voltou para 60%. Nenhum cliente afetado."],
    ["beatriz", "Combinado. Quando der, anota no runbook o tamanho que apareceu hoje: ajuda quem pegar o próximo alerta."],
    ["natalia", "Obrigada aos dois. Como foi leve e sem impacto, fica só o registro no histórico de incidentes do time."],
    ["natalia", "Retro da quinzena na quinta às 16h. A pauta está aberta."],
  ]),

  ...conversa("#livro-razao-ajuda", [
    ["igor", "Pergunta de quem cuida do site: o extrato às vezes leva alguns segundos para mostrar uma transferência que acabou de sair. É esperado?"],
    ["beatriz", `É esperado. O transactionhistory guarda o extrato em cache em memória e lê o livro-razão de tempos em tempos; o balancereader faz o mesmo com o saldo. A decisão e o porquê estão no ADR 4: ${adr(4)}`],
    ["igor", "Faz sentido. Vou colocar um aviso no extrato de que pode levar alguns segundos. Obrigado!"],
    ["larissa", "Curiosidade: por que o saldo não é atualizado por uma fila de eventos depois de cada transação?"],
    ["thiago", `Isso já foi proposto numa RFC e o time decidiu não seguir por agora. O ADR 6 conta o que pesou: ${adr(6)}`],
    ["vinicius", "Para subir só o livro-razão no ambiente local, preciso do userservice de pé?"],
    ["gustavo", "Para os três serviços, não: eles só precisam da chave pública do JWT, que o compose já entrega. Mas sem o userservice você não consegue entrar pelo site."],
  ]),

  ...conversa("#canais", [
    ["larissa", "Deploy do frontend hoje às 16h: tela nova de depósito, com valores sugeridos. Se aparecer algo estranho no site, avisa aqui."],
    ["igor", "Deploy do frontend feito. Erros do site estáveis, sigo acompanhando."],
    ["priscila", "A pesquisa com clientes sobre a transferência terminou. Trago o resumo na retro de sexta."],
    ["larissa", "Lembrete do plantão: fora do horário comercial e no fim de semana, quem cobre o site é o plantão de Plataforma. Problema nesse horário vai para o #plataforma-ajuda."],
    ["igor", "Coloquei no extrato o aviso de que uma transferência nova pode levar alguns segundos para aparecer. Conversei com Livro-razão no canal deles: é o cache do extrato."],
    ["priscila", "Retro da quinzena na sexta às 11h."],
  ]),

  ...conversa("#canais-ajuda", [
    ["vinicius", "A campanha de sexta vai trazer mais gente para o site? Quero saber se ajusto o teste de carga."],
    ["priscila", "Deve dobrar o acesso entre 18h e 20h. Vale rodar o loadgenerator com o dobro de usuários antes."],
    ["vinicius", "Combinado. Rodo na quinta na homologação e posto o resultado no #plataforma."],
    ["raissa", "Por que o site é em Python e o livro-razão em Java? Fiquei curiosa olhando o repositório."],
    ["larissa", `É uma decisão antiga: Python em Contas e Canais, Java no Livro-razão. O ADR 5 explica: ${adr(5)}`],
  ]),

  ...conversa("#plataforma", [
    ["nadia", `Mudamos o docker compose: agora todo serviço é construído direto do código, sem imagem pronta. Quem já tinha o ambiente local, suba do zero pelo runbook subir-do-zero. O porquê está no ADR 7: ${adr(7)}`],
    ["vinicius", "Deploy da nova versão do CI hoje às 15h. Os builds podem ficar uns minutos na fila."],
    ["vinicius", "CI atualizado, builds de volta ao normal."],
    ["eduardo", "Planejamento do trimestre na quarta. A prioridade continua sendo o ambiente local subir em menos de dez minutos numa máquina nova."],
    ["nadia", "Plantão desta semana: Vinícius. Lembrando que fora do horário comercial a gente cobre o site também."],
    ["vinicius", "Rodei o loadgenerator na homologação com o dobro de usuários, para a campanha de sexta. O site aguentou e o tempo de resposta ficou dentro do esperado."],
  ]),

  ...conversa("#plataforma-ajuda", [
    ["bruno", "Depois de atualizar o compose, meu ledger-db não sobe no ambiente local. Alguém já viu?"],
    ["vinicius", "Já. O volume antigo ficou de uma versão anterior. Rode docker compose down -v e suba de novo, como no runbook subir-do-zero. Isso apaga os dados locais, só os locais."],
    ["bruno", "Resolveu, obrigado."],
    ["gustavo", "Por que cada domínio tem o próprio Postgres? No ambiente local seria mais leve ter um só."],
    ["nadia", `Para nenhum serviço ler direto o banco de outro time, e no local também, para ninguém criar uma dependência que só existe na máquina. Está no ADR 3: ${adr(3)}`],
  ]),
];
