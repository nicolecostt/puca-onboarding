# Dados de cliente e LGPD

Cada cliente confia à Kota o próprio dinheiro e os próprios dados. A LGPD, a Lei Geral de Proteção de Dados, diz o que podemos fazer com esses dados. Esta página mostra como a lei aparece no dia a dia da engenharia. Dúvida vai para seguranca@kota.example.

## Que dados de cliente a Kota guarda

- No `accounts-db`, do time de Contas, ficam o nome, a data de nascimento, o endereço, o documento de identificação e o usuário de cada cliente. A senha fica guardada só como hash bcrypt. Os contatos que cada cliente salva para transferir, com conta e agência, ficam no mesmo banco.
- No `ledger-db`, do Livro-razão, fica cada transação, com conta e agência de origem e de destino, valor, data e hora.

Todo dado que leva a uma pessoa é dado pessoal. Isso inclui o número da conta, o saldo e o extrato.

## Para que usamos os dados

Usamos os dados para abrir a conta, autenticar o cliente, movimentar o dinheiro e cumprir o que a lei pede a um banco. Um uso novo, como uma análise, um experimento ou um e-mail para clientes, passa antes pela segurança.

## Dado real fica em produção

- O ambiente local e a homologação usam só dados de demonstração. No ambiente local, o compose carrega esses dados na subida, como conta o [ADR 7](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0007-ambiente-local-com-docker-compose-construido-do-codigo.md).
- Nunca copie dado de produção para outro ambiente, nem um pedaço para reproduzir um bug. Monte o caso com dado de demonstração.
- Se você precisa olhar um caso real, siga o pedido de acesso de [Segurança e acesso a produção](notion:seguranca-e-acesso).

## Onde dado de cliente não aparece

- No Slack, no Notion, numa issue, num PR ou numa planilha pessoal. Para falar de um caso, use o número da transação. Nunca nome, documento, saldo ou print de tela com dado de cliente.
- Em log. Não registre senha, token, documento ou endereço.
- Em ferramenta de fora, como tradutor, assistente de IA ou site que formata JSON. Dado de cliente só entra em ferramenta que a segurança aprovou.

## Transação gravada não se apaga

O `ledger-db` só aceita inserção, como explica o [ADR 3](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0003-um-banco-por-dominio.md). Uma transação gravada não muda nem some do livro-razão, e a regulação obriga o banco a guardar o registro das movimentações. Quando um cliente encerra a conta, as transações dele continuam lá.

## Quando o cliente pede os próprios dados

A LGPD dá a cada cliente o direito de saber que dados temos sobre ele, de corrigir o que estiver errado e de pedir a exclusão do que a lei não obriga a guardar. O pedido chega pelo atendimento, que o encaminha para seguranca@kota.example. A segurança responde ao cliente e, quando precisa, pede ao time dono do dado que faça a mudança.

Engenharia não altera nem apaga dado de cliente por conta própria, mesmo quando o pedido chega direto a alguém do time. Encaminhe para a segurança.

## Se um dado vazou

Escreva na hora para seguranca@kota.example, com o que você viu, onde e quando. Avise antes de apagar qualquer coisa. A segurança avalia o caso e decide se precisa comunicar a ANPD e os clientes afetados, como a lei pede. O resto do caminho está em [Incidentes](notion:incidentes).
