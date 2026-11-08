# Deploy

O deploy é do time dono do serviço. Quem fez a mudança acompanha o que acontece depois, mesmo quando outra pessoa do time faz o deploy. Esta página mostra o caminho de uma mudança da sua máquina até o cliente.

## Os ambientes

- **Local**, na sua máquina. O `docker compose up --build` sobe o banco inteiro a partir do código da sua branch, com o site em `http://localhost:8080`, como decidido no [ADR 7](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0007-ambiente-local-com-docker-compose-construido-do-codigo.md). Se o ambiente local quebrar depois de uma atualização, siga o runbook [subir do zero](https://github.com/JucaGF/kota-bank/blob/main/docs/runbooks/subir-do-zero.md).
- **Homologação**, por onde cada versão da `main` passa antes de produção. É lá que testamos com outros times e rodamos o teste de carga com o `loadgenerator`.
- **Produção**, onde estão os clientes.

A partir do `kota-bank`, você sobe só o ambiente local. A configuração da homologação e de produção é de Plataforma.

## Do merge à produção

1. O PR entra na `main` com aprovação e CI verde, como manda o [Code review](notion:code-review).
2. A versão nova vai para a homologação. Confira lá o que mudou.
3. Avise no canal do time, com antecedência, o serviço, a hora do deploy e o que muda para o cliente. Quem tiver algo para entrar junto responde no mesmo aviso.
4. Faça o deploy de um serviço por vez.
5. Acompanhe os erros e o tempo de resposta do serviço durante uma hora.
6. Avise no canal que terminou e o que viu nos números.

Um aviso no #livro-razao, por exemplo, fica assim: "Deploy do ledgerwriter hoje às 14h, com a validação nova de limite por transferência. Quem tiver algo para entrar junto, avisa aqui até o meio-dia."

## Quando fazer

Deploy em produção só em dia útil, começando entre 10h e 16h. Na sexta depois do meio-dia e na véspera de feriado, não. Assim, a hora de acompanhamento ainda cai no horário comercial, e se algo der errado o time está por perto para resolver. Fora dessa janela, só correção de incidente, com o plantão e o tech lead do time sabendo.

## Quando algo dá errado

Se os erros ou o tempo de resposta pioram depois do deploy, volte para a versão anterior primeiro e investigue depois. Avise no canal do time. Se o cliente sentiu, é um incidente, e o caminho está em [Incidentes](notion:incidentes).

## Mudanças que o cliente sente

Algumas mudanças afetam o cliente mesmo quando dão certo. Trocar o par de chaves do JWT derruba todas as sessões abertas e exige reiniciar todos os serviços, como explica o [ADR 2](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0002-jwt-assinado-pelo-userservice-e-validado-em-cada-servico.md). Numa mudança assim, siga o runbook de [troca da chave do JWT](https://github.com/JucaGF/kota-bank/blob/main/docs/runbooks/trocar-chave-jwt.md), avise o atendimento antes e anuncie a data no canal do time com alguns dias de antecedência.

## Quem pode fazer deploy em produção

O acesso a produção segue a política de [Segurança e acesso a produção](notion:seguranca-e-acesso). Enquanto você não tem esse acesso, faça o deploy junto com alguém do time que tenha.
