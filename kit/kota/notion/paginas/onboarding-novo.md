# Novo na Kota

Que bom ter você aqui. Esta página é o roteiro de quem acabou de entrar na Kota, com os acessos que você precisa ter e o que fazer na primeira semana. Se você já é da Kota e está mudando de time, o seu roteiro é [Mudando de time](notion:onboarding-transicao).

Ninguém espera que você saiba tudo no fim da semana. A ideia é que você tenha os acessos, conheça as pessoas do seu time, suba o banco na sua máquina e comece uma tarefa pequena.

## Quem está com você

- **Gestor.** Cuida da sua chegada. Pede e aprova os seus acessos, combina os seus primeiros objetivos e aprova a sua primeira tarefa.
- **Buddy.** Uma pessoa do seu time que você procura primeiro para a dúvida do dia a dia. Pergunte à vontade. Ele está lá para isso.
- **Tech lead.** Responde pelas decisões técnicas do time e revisa os PRs nas pastas dele.
- **People.** Simone Araújo, nossa people partner, cuida de contrato, benefícios e documentos. O e-mail é people@kota.example.
- **Segurança.** Jonas Ferraz cuida da segurança da informação. Se uma senha, um token ou uma chave vazar, escreva na hora para seguranca@kota.example.

O gestor, o tech lead e o buddy de cada time estão na database [Times](notion:times). O que cada papel faz, em detalhe, está em [Papéis de buddy, gestor e RH](notion:papeis-buddy-gestor-rh).

## Acessos

Você pede os acessos ao seu gestor, que aprova cada um. Se no fim do segundo dia ainda faltar algum, avise o gestor.

- [ ] E-mail da Kota. É o login de todo o resto, e People cria antes do seu primeiro dia.
- [ ] Slack da Kota, nos canais #geral e #people e nos dois canais do seu time, o principal e o de ajuda. Os canais de cada time estão em [Times](notion:times), e o que vai em cada canal está em [Comunicação](notion:comunicacao).
- [ ] Notion da Kota. Todo mundo lê todas as páginas.
- [ ] GitHub, no repositório [kota-bank](https://github.com/JucaGF/kota-bank). Lá estão o código, os ADRs, os runbooks e as issues.
- [ ] Homologação. Toda a engenharia tem acesso, sempre com dados de teste.
- [ ] Docker na sua máquina. É o único requisito para subir o banco e rodar os testes.
- [ ] Convites dos rituais do seu time, que o gestor manda. Quais são e para que servem está em [Rituais](notion:rituais).
- [ ] Orbis, onde a Puca conduz a sua call inicial e as suas sessões.

O acesso a produção não entra nesta lista. Ninguém precisa dele na primeira semana, e as regras estão em [Segurança e acesso a produção](notion:seguranca-e-acesso).

## Primeira semana

### Primeiro dia

- Conversa de boas-vindas com o gestor. Ele conta o que o time faz, o que vem nas primeiras semanas e quem é o seu buddy.
- Conversa com o buddy. Combinem um horário fixo para as dúvidas dos primeiros dias.
- Call inicial com a Puca, no Orbis. Ela conta como a Kota funciona, pergunta o que você já sabe e monta as suas sessões sobre o time.
- Os acessos da lista acima.
- [Quem somos](notion:quem-somos) e [Jeito de trabalhar](notion:jeito-de-trabalhar), com calma.

### Segundo e terceiro dias

- Suba o banco na sua máquina com `docker compose up --build`, seguindo o runbook [subir do zero](https://github.com/JucaGF/kota-bank/blob/main/docs/runbooks/subir-do-zero.md). O site abre em `http://localhost:8080`. A primeira subida demora, porque o Maven baixa as dependências dos serviços Java.
- Rode os testes do seu time com [`scripts/testar.sh`](https://github.com/JucaGF/kota-bank/blob/main/scripts/testar.sh) e o nome do serviço. Os testes rodam dentro de containers.
- Leia os ADRs do seu time em [`docs/adr`](https://github.com/JucaGF/kota-bank/tree/main/docs/adr). Cada um conta uma decisão e o porquê dela. Os sistemas e o time responsável por cada um estão em [Sistemas](notion:sistemas).
- Leia [Segurança e acesso a produção](notion:seguranca-e-acesso) e [Dados de cliente e LGPD](notion:dados-de-cliente-e-lgpd). Somos um banco, e essas duas valem para todo mundo, de qualquer time.
- Participe dos rituais do time, mesmo que só para ouvir.
- Acompanhe alguns code reviews do time antes de abrir o seu primeiro PR. O combinado está em [Code review](notion:code-review).

### Quarto e quinto dias

- Pegue a primeira tarefa. É uma das [issues com o label `primeira-tarefa`](https://github.com/JucaGF/kota-bank/issues?q=label%3Aprimeira-tarefa), pequena e com um teste que falha até a tarefa ficar pronta. A Puca escolhe uma do catálogo do time conforme o que você já sabe, e o gestor aprova antes de você começar.
- Abra o PR quando o teste passar. Não precisa terminar na primeira semana.
- No fim da semana, uma conversa curta com o gestor sobre o que ficou confuso, o acesso que ainda falta e o que vem na semana seguinte. A conversa é sobre a sua chegada.

## No Livro-razão

O time de Livro-razão cuida do registro de cada transação, do saldo e do extrato. Se você entrou nele:

- Natália Brandão é a gestora, Thiago Nakamura é o tech lead e Beatriz Cavalcanti é a buddy.
- O time conversa no #livro-razao. No #livro-razao-ajuda, qualquer pessoa da Kota pergunta sobre os serviços do time.
- Os serviços são o ledgerwriter, o balancereader, o transactionhistory e o banco ledger-db, em [`src/ledger`](https://github.com/JucaGF/kota-bank/tree/main/src/ledger). O [`ledgermonolith`](https://github.com/JucaGF/kota-bank/tree/main/src/ledgermonolith) é a versão antiga e não recebe mudança.
- Os serviços são Java 17 com Spring Boot. Os testes de um deles rodam com `scripts/testar.sh balancereader`, por exemplo.
- Comece pelos ADRs [1](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0001-quebrar-o-monolito-do-livro-razao-em-tres-servicos.md), [4](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0004-saldo-e-extrato-com-cache-em-memoria-lidos-do-livro-razao.md) e [6](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0006-fila-entre-o-ledgerwriter-e-os-leitores.md), que contam como o livro-razão chegou ao desenho de hoje. O 6 é uma proposta que o time recusou.
- O plantão é um rodízio semanal, 24 horas por dia. Quem chega acompanha um plantão antes de entrar na escala. O que fazer quando um alerta toca está em [Incidentes](notion:incidentes).
- As palavras do dia a dia do time estão no [Glossário do banco](notion:glossario).

## Dúvidas

- Dúvida técnica vai no canal de ajuda do time responsável pelo sistema. O time de cada sistema está em [Sistemas](notion:sistemas).
- Dúvida sobre política, benefício ou carreira que sirva para todo mundo vai no #people.
- Caso seu, como férias, salário ou bônus, fale com o seu gestor ou com People em people@kota.example.
- Se não souber a quem perguntar, comece pelo buddy.

## No primeiro mês

Sem pressa, leia as [Políticas](notion:politicas) e o [Kota People](notion:kota-people). O Kota People explica o ciclo de desempenho, a trilha de carreira, a promoção, o bônus e a revisão salarial. Se a dúvida for sobre tirar férias logo no começo, a regra está em [Férias](notion:ferias).
