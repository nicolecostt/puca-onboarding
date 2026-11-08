# Mudando de time

Esta página é para quem já é da Kota e está mudando de time. Você já conhece a empresa, então pula a parte institucional. [Quem somos](notion:quem-somos), as [Políticas](notion:politicas) e o [Kota People](notion:kota-people) valem igual em qualquer time.

Aqui fica só o que muda com o time novo: pessoas, sistemas, rituais e acessos. Quem acabou de entrar na Kota segue o roteiro [Novo na Kota](notion:onboarding-novo).

## Antes da data da transição

- A transição é combinada entre você, o gestor atual e o gestor novo. People registra a data, e a database [Pessoas](notion:pessoas) passa a mostrar o time novo.
- Combine com o gestor atual o que você tem em andamento e quem assume cada coisa.
- No dia da transição, você sai da escala de plantão do time atual e perde o acesso de produção aos sistemas dele.
- O gestor novo combina com você os primeiros objetivos. Férias já combinadas com o gestor atual continuam valendo, e o gestor novo precisa saber delas na primeira semana.

## Acessos

E-mail, Slack, Notion, GitHub, homologação e o ambiente local continuam iguais. O que muda, você pede ao gestor novo, que aprova:

- [ ] Entrar no canal e no canal de ajuda do time novo, que estão em [Times](notion:times). Pode continuar nos canais do time antigo, porque nas primeiras semanas é normal alguém de lá ainda te procurar.
- [ ] Receber os convites dos [rituais](notion:rituais) do time novo e sair dos rituais do time antigo.
- [ ] Acesso a produção do time novo. Ele não vem junto com a transição e segue o mesmo caminho de quem acabou de chegar, em [Segurança e acesso a produção](notion:seguranca-e-acesso).
- [ ] Entrar na escala de plantão do time novo, quando o gestor novo combinar com você.
- [ ] Rodar os testes do time novo na sua máquina com [`scripts/testar.sh`](https://github.com/JucaGF/kota-bank/blob/main/scripts/testar.sh) e o nome do serviço.

## Primeira semana no time novo

- Conversa com o gestor novo sobre o que o time faz e o que vem nas primeiras semanas.
- Conversa com o buddy do time novo. Mesmo para quem conhece a Kota, os combinados de cada time são outros.
- Call inicial com Puca, no Orbis. Ela sabe que você já é da Kota, então pula a parte institucional e vai direto ao time novo, aos sistemas dele e às decisões que ele tomou.
- Leia os ADRs do time novo e as [RFCs](notion:rfcs) que levaram a eles.
- Acompanhe os rituais e alguns code reviews do time novo antes de abrir PR. O arquivo `CODEOWNERS` mostra o time dono de cada pasta, e é esse time que revisa os seus PRs, como conta o [Code review](notion:code-review).
- Pegue a primeira tarefa no time novo. É uma das [issues com o label `primeira-tarefa`](https://github.com/JucaGF/kota-bank/issues?q=label%3Aprimeira-tarefa), escolhida conforme o que você já sabe. O gestor novo aprova antes de você começar.
- No fim da semana, uma conversa curta com o gestor novo sobre o que ficou confuso e o acesso que ainda falta.

## De Contas para o Livro-razão

Quem vem de Contas já conhece o login, o JWT e o accounts-db. No Livro-razão, o assunto é dinheiro: cada transação, o saldo e o extrato.

### Pessoas e canais

- Natália Brandão é a gestora, Thiago Nakamura é o tech lead e Beatriz Cavalcanti é a buddy. Gustavo Schmitt e Ana Lacerda completam o time.
- O time conversa no #livro-razao, e as dúvidas de outros times chegam no #livro-razao-ajuda.
- O `CODEOWNERS` liga as pastas do livro-razão ao Thiago e à Natália.

### Linguagem e testes

- Contas é Python, e o Livro-razão é Java 17 com Spring Boot. O [ADR 5](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0005-python-em-contas-e-canais-java-no-livro-razao.md) conta por quê.
- O `uv run pytest` vira `./mvnw test`. O jeito mais simples é `scripts/testar.sh balancereader`, que roda dentro de um container e só pede o Docker.
- O lint é o `checkstyle.xml` de cada serviço, no lugar do `.pylintrc`.
- A primeira subida do banco demora mais, porque o Maven baixa as dependências dos serviços Java.

### O que continua valendo

- O token é o mesmo que o userservice assina. Cada serviço do livro-razão valida o JWT sozinho, com a chave pública, no `JWTVerifierGenerator`. O balancereader confere se a conta da URL é a do `acct` do token. Está no [ADR 2](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0002-jwt-assinado-pelo-userservice-e-validado-em-cada-servico.md).
- Mudar o formato do token mexe nos dois lados, no `pyjwt` de Contas e Canais e no `java-jwt` do Livro-razão. Uma mudança assim passa pela revisão dos três times.

### O que é diferente

- O ledger-db só aceita inserção. As regras `PREVENT_UPDATE` e `PREVENT_DELETE` ignoram em silêncio qualquer `UPDATE` ou `DELETE` na tabela `TRANSACTIONS`. No accounts-db você atualizava cadastro, e aqui nada que foi gravado muda. O porquê está no [ADR 3](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0003-um-banco-por-dominio.md).
- O livro-razão não enxerga o accounts-db. Por isso o ledgerwriter não confere se a conta de destino existe, só o formato da conta e da agência.
- Saldo e extrato saem de um cache em memória, que um leitor em segundo plano atualiza a cada 100 ms lendo o ledger-db. O [ADR 4](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0004-saldo-e-extrato-com-cache-em-memoria-lidos-do-livro-razao.md) explica o desenho e o risco que o time aceitou.
- O ledgermonolith continua no repositório, mas não sobe e não recebe mudança. Correção vai nos três serviços, como diz o [ADR 1](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0001-quebrar-o-monolito-do-livro-razao-em-tres-servicos.md).
- Pôr uma fila entre o ledgerwriter e os leitores já foi proposto na [RFC 3](notion:rfc-3) e recusado no [ADR 6](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0006-fila-entre-o-ledgerwriter-e-os-leitores.md).

### Plantão

Contas e Livro-razão têm plantão 24 horas por dia, em rodízio semanal. No Livro-razão, quem chega acompanha um plantão antes de entrar na escala. Disco cheio no ledger-db tem runbook próprio, o [ledger-db cheio](https://github.com/JucaGF/kota-bank/blob/main/docs/runbooks/ledger-db-cheio.md), e o resto está em [Incidentes](notion:incidentes).

### Por onde começar

1. A [RFC 1](notion:rfc-1) e o ADR 1, para entender por que o livro-razão virou três serviços.
2. O ADR 4, para saber de onde vêm o saldo e o extrato.
3. O ADR 3 e o ADR 6, para entender o banco do livro-razão e o que o time decidiu não fazer.
4. O [Glossário do banco](notion:glossario), com as palavras do dia a dia do time.
