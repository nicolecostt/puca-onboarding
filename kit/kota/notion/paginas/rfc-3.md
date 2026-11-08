# Fila de eventos de transação

Proposta de Gustavo Schmitt, do time de Livro-razão.

## Problema

Cada instância do `balancereader` e do `transactionhistory` pergunta ao `ledger-db` o maior `transactionId` a cada 100 ms, como decidimos no [ADR 4](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0004-saldo-e-extrato-com-cache-em-memoria-lidos-do-livro-razao.md). Quando aparece transação nova, a instância lê as que vieram depois da última que viu e atualiza o cache.

Isso tem dois custos. O banco recebe uma consulta a cada 100 ms por instância, mesmo quando nada mudou. E o saldo pode estar até um ciclo atrasado em relação ao livro-razão.

## Proposta

O `ledgerwriter` publica um evento numa fila para cada transação que grava. O `balancereader` e o `transactionhistory` consomem a fila e atualizam o cache assim que o evento chega. A consulta periódica sai.

A mesma fila serviria a quem mais precisar saber de transação nova, como uma notificação para o cliente. A escolha do broker fica para depois, se a ideia passar.

## Alternativas

**Deixar como está.** A consulta periódica funciona e é simples. Os dois custos continuam.

**Aumentar o intervalo da consulta.** Tira carga do banco, mas atrasa mais o saldo e o extrato.

## Discussão

**Beatriz Cavalcanti**: A `TRANSACTIONS` já funciona como fila. Ela só aceita inserção, e o `TRANSACTION_ID` só cresce. O leitor retoma de onde parou pedindo as transações com id maior que o último que viu. É o que um consumidor de fila faria.

**Thiago Nakamura**: O que me pega é a escrita dupla. O `ledgerwriter` teria que gravar no banco e publicar na fila. Se uma das duas falhar, o cache diverge do livro-razão, e saldo errado é o pior erro que a gente pode mostrar ao cliente. Para fazer isso direito, precisaríamos de uma tabela de saída lida por consulta periódica. É o que já temos.

**Nádia Saliba**: Do lado de Plataforma, o broker é mais uma peça para subir no ambiente local de todo mundo e para operar em produção.

**Natália Brandão**: E mais uma peça no plantão de 24 horas do time. Tudo isso para tirar um `MAX` sobre a chave primária, que o Postgres responde pelo índice.

**Gustavo Schmitt**: A escrita dupla me convenceu. O atraso de um ciclo continua, e o time já tinha aceitado esse risco no ADR 4. Concordo em não seguir agora. Deixo anotado quando vale reabrir: se aparecer um terceiro consumidor de transações, como a notificação para o cliente, ou se a consulta periódica começar a pesar no `ledger-db`.

## Resultado

Rejeitada. O time decidiu não seguir com a fila. O [ADR 6: Fila entre o ledgerwriter e os leitores](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0006-fila-entre-o-ledgerwriter-e-os-leitores.md) registra a decisão e o que pesou:

- A `TRANSACTIONS` já funciona como fila.
- A fila criaria uma escrita dupla. Se a gravação no banco ou a publicação na fila falhasse, o cache ficaria diferente do livro-razão.
- O broker seria mais uma peça no plantão de 24 horas do Livro-razão e no ambiente local.

Os leitores continuam com a consulta periódica do ADR 4. A discussão volta se aparecer um terceiro consumidor de transações ou se a consulta pesar no `ledger-db`.
