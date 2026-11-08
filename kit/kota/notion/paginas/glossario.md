# Glossário do banco

As palavras que usamos todo dia na Kota, com o nome que cada uma tem no código. A maior parte vem do Livro-razão, porque é lá que o dinheiro é registrado. Se faltar alguma palavra, pergunte no canal de ajuda do time responsável pelo assunto.

## Dinheiro e contas

**Número da conta.** Os 10 dígitos de cada conta. O userservice sorteia o número no cadastro e confere que nenhuma outra conta tem o mesmo. Ele vai no token do login como `acct`.

**Número de agência.** Os 9 dígitos que, junto com o número da conta, identificam uma conta. Toda conta da Kota tem o mesmo número de agência, e no ambiente local o compose usa `883745000`. Uma conta com outro número de agência é de fora da Kota. No código, a agência aparece como routing, em `FROM_ROUTE`, `TO_ROUTE` e `LOCAL_ROUTING_NUM`.

**Transação.** Uma linha na tabela `TRANSACTIONS` do ledger-db, com a conta e a agência de origem, a conta e a agência de destino, o valor e a data e hora. Quem grava é o ledgerwriter. Antes de gravar, o `TransactionValidator` confere o formato da conta e da agência, se a origem é a conta do token quando ela é da Kota, se origem e destino são diferentes e se o valor é positivo. Quando a origem é uma conta da Kota, o ledgerwriter também pergunta o saldo ao balancereader e recusa a transação se ele não cobre o valor. Depois de gravada, a transação não muda.

**Transferência.** Uma transação entre duas contas da Kota. No site, ela sai da conta de quem está logado para um contato ou para um número de conta digitado na hora.

**Depósito.** Uma transação que vem de uma conta de outra agência para a conta do cliente na Kota. O ledgerwriter não confere o saldo da origem, porque o saldo dela não está na Kota.

**Contato.** Uma conta que o cliente salva para usar de novo. Contato da Kota serve para transferir, e contato de outra agência serve de origem para depósito. Quem guarda os contatos é o contacts, do time de Contas.

**Valor.** Sempre em centavos, como número inteiro, na coluna `AMOUNT`. 2500 no banco são 25,00 no site. O valor gravado é sempre positivo. Quem diz se o dinheiro entrou ou saiu é o lado da conta na transação: no destino, é entrada, e na origem, é saída.

**Livro-razão.** O registro de todas as transações da Kota, na tabela `TRANSACTIONS` do ledger-db. Ele só cresce. As regras `PREVENT_UPDATE` e `PREVENT_DELETE` ignoram em silêncio qualquer `UPDATE` ou `DELETE`, então uma correção entra como transação nova. Livro-razão também é o nome do time que cuida dele. No código, é ledger.

**Saldo.** O que entrou na conta menos o que saiu, somando todas as transações dela no livro-razão. O saldo não fica gravado em nenhuma tabela, é sempre essa soma. Quem responde é o balancereader, a partir de um cache em memória, e por isso ele pode estar até um ciclo de leitura atrasado. O desenho está no [ADR 4](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0004-saldo-e-extrato-com-cache-em-memoria-lidos-do-livro-razao.md).

**Extrato.** As transações de uma conta, de entrada e de saída, da mais recente para a mais antiga. Quem responde é o transactionhistory, que guarda em cache as últimas 100 de cada conta. Uma transferência que acabou de sair pode faltar na página que abre logo depois dela, se o próximo ciclo de leitura ainda não passou. Ela aparece quando a página carrega de novo, o que para quem usa o site parece alguns segundos. É o cache, e é esperado.

## No código do Livro-razão

**Cache em memória.** Cada instância do balancereader e do transactionhistory guarda saldo e extrato na própria memória. Na primeira consulta de uma conta, ela carrega do ledger-db. Ao reiniciar, a instância começa vazia. O extrato em cache expira em 60 minutos, e o saldo não expira.

**Ciclo de leitura.** A cada 100 ms, o `LedgerReader` pergunta ao ledger-db o maior `transactionId` e lê só as transações que vieram depois da última que viu. O intervalo é o `POLL_MS`. Se o maior id diminuir, como num banco restaurado de backup, o leitor para e o serviço precisa ser reiniciado.

**Identificador do pedido.** O `uuid` que o site manda com cada transferência e cada depósito. O ledgerwriter guarda por uma hora os que já viu e recusa um repetido. Assim, um clique duplo não grava a mesma transação duas vezes.

**Domínio.** Uma parte do banco com dados próprios. Contas cuida de clientes e contatos, no accounts-db, e o Livro-razão cuida das transações, no ledger-db. Nenhum serviço lê o banco de outro domínio. Quem precisa de um dado de fora pede pela API, como diz o [ADR 3](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0003-um-banco-por-dominio.md).

**JWT.** O token que o userservice assina no login, com a chave privada. Ele leva o login, a conta e o nome do cliente e vale uma hora. Cada serviço confere a assinatura sozinho, com a chave pública, como decidido no [ADR 2](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0002-jwt-assinado-pelo-userservice-e-validado-em-cada-servico.md). Trocar o par de chaves derruba as sessões, e o passo a passo está no runbook de [troca da chave do JWT](https://github.com/JucaGF/kota-bank/blob/main/docs/runbooks/trocar-chave-jwt.md).

**Monolito.** O ledgermonolith, a versão antiga do livro-razão num serviço só. Ele fica no repositório como legado, não sobe em nenhum ambiente e não recebe mudança. A história está no [ADR 1](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0001-quebrar-o-monolito-do-livro-razao-em-tres-servicos.md).

## No dia a dia

**Ambiente local.** O banco inteiro na sua máquina, com `docker compose up --build`, construído do código da sua branch. O site abre em `http://localhost:8080`. O porquê está no [ADR 7](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0007-ambiente-local-com-docker-compose-construido-do-codigo.md).

**Homologação.** O ambiente por onde cada versão passa antes de produção. É lá que testamos com outros times e rodamos o teste de carga com o loadgenerator. O caminho até produção está em [Deploy](notion:deploy).

**Plantão.** A pessoa do time que atende os alertas dos sistemas dele naquela semana, em rodízio. No Livro-razão, o plantão é 24 horas por dia, e quem chega acompanha um plantão antes de entrar na escala. O plantão de cada time está em [Times](notion:times), e o que fazer quando um alerta toca está em [Incidentes](notion:incidentes).

**RFC.** A proposta escrita de uma mudança, discutida com o time antes da decisão. As da Kota estão em [RFCs](notion:rfcs).

**ADR.** O registro de uma decisão técnica e do porquê dela, em [`docs/adr`](https://github.com/JucaGF/kota-bank/tree/main/docs/adr). Uma RFC pode virar um ADR aceito ou rejeitado, e o caminho está em [De RFC a ADR](notion:de-rfc-a-adr).
