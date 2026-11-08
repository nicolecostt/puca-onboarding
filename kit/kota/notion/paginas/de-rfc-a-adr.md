# De RFC a ADR

Decisão técnica que importa fica escrita em dois lugares. A RFC, aqui no Notion, é onde a proposta é discutida. O ADR, no repositório, registra o que decidimos e por quê, perto do código que a decisão afeta.

## Quando escrever uma RFC

Escreva uma RFC quando a decisão afeta mais de um time, quando é difícil de desfazer ou quando traz uma peça nova para operar. Mudar onde um dado mora, mudar como os serviços conversam e adotar um banco, uma fila ou uma linguagem nova são exemplos. Para linguagem, o [ADR 5](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0005-python-em-contas-e-canais-java-no-livro-razao.md) é explícito. Um time que queira uma terceira linguagem abre uma RFC antes.

Decisão que fica dentro de um time e se desfaz com facilidade vai direto para um ADR, sem RFC. Foi assim com o cache de saldo e extrato, no [ADR 4](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0004-saldo-e-extrato-com-cache-em-memoria-lidos-do-livro-razao.md). Também vai direto o registro de algo que já funciona de um jeito e nunca foi escrito, como a validação do JWT em cada serviço, no [ADR 2](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0002-jwt-assinado-pelo-userservice-e-validado-em-cada-servico.md). Por fim, vai direto o que muda só a máquina de quem desenvolve, mesmo que todos os times usem. Não chega a produção, não dá trabalho ao plantão e se desfaz com um PR. Foi assim com o ambiente local, no [ADR 7](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0007-ambiente-local-com-docker-compose-construido-do-codigo.md), que a Plataforma registrou e avisou no #plataforma.

## Como uma RFC anda

1. Crie a página na database [RFCs](notion:rfcs), com o próximo número. A RFC tem o problema, a proposta, as alternativas que você pesou, a discussão e o resultado.
2. Avise no canal dos times afetados e chame os tech leads deles para comentar.
3. Deixe a RFC aberta para comentários por pelo menos uma semana. O que muda na proposta, você atualiza no texto. No fim, resuma na seção "Discussão" quem disse o quê.
4. O time dono do assunto decide, com a palavra final do tech lead, depois de ouvir os times afetados. Se os tech leads não chegam a um acordo, os gestores dos times decidem juntos.
5. Escreva o resultado no fim da RFC, com o link do ADR.

Uma questão que a RFC não precisa resolver fica listada como fora da proposta, para virar uma decisão própria. Na [RFC 1](notion:rfc-1), onde a tabela de transações ia morar ficou para a [RFC 2](notion:rfc-2).

## Do resultado ao ADR

Toda RFC decidida vira um ADR em [`docs/adr/`](https://github.com/JucaGF/kota-bank/tree/main/docs/adr), aceita ou rejeitada. O ADR entra por pull request, como qualquer mudança, e o time dono revisa, como manda o [Code review](notion:code-review).

Todo ADR tem as mesmas partes. No topo, o status, a data, o time e a RFC de origem, quando existe. Depois, o contexto, a decisão, as consequências e onde ver no código. O número é o próximo da pasta e nunca se reaproveita.

ADR aceito não se reescreve. Se a decisão mudar, escreva um ADR novo que diga qual ele substitui.

## RFC rejeitada também vira ADR

Uma proposta rejeitada continua útil. Quando alguém perguntar de novo por que não fazemos daquele jeito, a resposta já está escrita. A fila de eventos de transação foi proposta na [RFC 3](notion:rfc-3) e rejeitada. O [ADR 6](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0006-fila-entre-o-ledgerwriter-e-os-leitores.md) conta o que pesou e em que caso a discussão volta.

## As RFCs que temos

| RFC | Autor | Resultado |
|---|---|---|
| [RFC 1, Separar o livro-razão do monolito](notion:rfc-1) | Thiago Nakamura | Virou o [ADR 1](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0001-quebrar-o-monolito-do-livro-razao-em-tres-servicos.md) |
| [RFC 2, Banco de contas separado do livro-razão](notion:rfc-2) | Nádia Saliba | Virou o [ADR 3](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0003-um-banco-por-dominio.md) |
| [RFC 3, Fila de eventos de transação](notion:rfc-3) | Gustavo Schmitt | Rejeitada, registrada no [ADR 6](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0006-fila-entre-o-ledgerwriter-e-os-leitores.md) |
