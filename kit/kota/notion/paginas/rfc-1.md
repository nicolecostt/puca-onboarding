# Separar o livro-razão do monolito

Proposta de Thiago Nakamura, tech lead do Livro-razão.

## Problema

O livro-razão roda num serviço só, o `ledgermonolith`. Gravar transação, calcular saldo e montar extrato acontecem no mesmo processo, com um cache por conta (`AccountInfo`) que guarda o saldo e as últimas transações juntos.

O site pede saldo e extrato toda vez que a página inicial abre. Transação é gravada bem menos. Para aguentar mais leitura, subimos mais cópias do monolito, e cada cópia leva a gravação junto. E qualquer mudança no extrato reinicia também o caminho da transferência.

## Proposta

Separar o monolito em três serviços:

- `ledgerwriter` valida e grava a transação. Antes de gravar, pergunta ao `balancereader`, por HTTP, o saldo de quem envia.
- `balancereader` responde o saldo de cada conta.
- `transactionhistory` responde o extrato de cada conta.

Os três leem e gravam a mesma tabela de transações, a `TRANSACTIONS`. Cada serviço tem o seu código. O que os três usam do monolito, como `JWTVerifierGenerator`, `Transaction` e `TransactionRepository`, é copiado para cada um, sem biblioteca compartilhada.

O `ledgermonolith` fica no repositório como legado. Ele deixa de subir e não recebe mudança nova.

Duas questões ficam fora desta proposta, cada uma para uma decisão própria:

- Como cada leitor mantém saldo e extrato em dia, já que os dois deixam de dividir o mesmo cache.
- Em qual Postgres a tabela de transações vai morar quando sair da máquina do monolito.

## Alternativas

**Subir mais cópias do monolito.** É o que fazemos hoje. Resolve a leitura por um tempo, mas cada cópia leva a gravação junto, e o deploy do extrato continua reiniciando a transferência.

**Separar em dois serviços, um que grava e um que lê.** Seriam menos peças para operar. Só que saldo e extrato continuariam no mesmo processo, e o saldo está no caminho da transferência, porque o `ledgerwriter` confere o saldo antes de gravar. O extrato não está. Com os dois juntos, uma mudança no extrato volta a mexer no que a transferência usa.

**Três serviços com uma biblioteca compartilhada.** Evita o código repetido. Em troca, uma mudança na biblioteca pede subir os três serviços juntos, e voltamos a ter um deploy que leva tudo.

## Discussão

**Larissa Fagundes**: Do lado do site, confirmo. A página inicial chama saldo e extrato em toda visita. Transferência é uma fração disso.

**Beatriz Cavalcanti**: Hoje o saldo vem do cache, dentro do mesmo processo. Com a separação, a transferência ganha uma chamada de rede, e o `ledgerwriter` passa a depender do `balancereader` de pé.

**Thiago Nakamura**: Verdade, e isso vai para as consequências. Se o `balancereader` cair, a transferência para. Prefiro isso a seguir com extrato e gravação no mesmo processo. Pelo menos um problema no extrato deixa de derrubar a transferência.

**Beatriz Cavalcanti**: Copiar `Transaction` e `TransactionRepository` para três lugares também me preocupa. Um bug ali vai ser corrigido em mais de um serviço.

**Thiago Nakamura**: Vai. A repetição é de propósito. Com a biblioteca compartilhada, voltamos ao deploy que leva os três juntos.

**Natália Brandão**: E o plantão? Hoje olhamos um serviço. Passamos a olhar três.

**Thiago Nakamura**: Sim, são três para olhar. Em troca, o alerta já diz qual das três partes quebrou.

**Nádia Saliba**: A tabela de transações sai da máquina do monolito junto com ele. Onde ela vai morar? Sugiro decidir à parte. Abro uma RFC só para isso.

**Thiago Nakamura**: Combinado. Deixei na lista do que fica fora.

## Resultado

Aprovada. Virou o [ADR 1: Quebrar o monolito do livro-razão em três serviços](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0001-quebrar-o-monolito-do-livro-razao-em-tres-servicos.md).

As duas questões que ficaram de fora viraram decisões próprias. O banco foi para a [RFC 2](notion:rfc-2), que virou o [ADR 3](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0003-um-banco-por-dominio.md). O cache dos leitores ficou no [ADR 4](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0004-saldo-e-extrato-com-cache-em-memoria-lidos-do-livro-razao.md).

O código antigo continua em [`src/ledgermonolith`](https://github.com/JucaGF/kota-bank/tree/main/src/ledgermonolith). Ele não sobe em nenhum ambiente, e correção no livro-razão vai nos três serviços, nunca nele.
