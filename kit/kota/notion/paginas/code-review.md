# Code review

Toda mudança no [kota-bank](https://github.com/JucaGF/kota-bank) entra na `main` por pull request, com pelo menos uma aprovação do time dono do código e o CI verde. Ninguém faz push direto na `main`, nem quem é tech lead.

## Quem revisa

O arquivo `CODEOWNERS` do repositório traz, para cada pasta, os e-mails do tech lead e do gestor do time dono dela. A linha de `docs/adr/` traz os e-mails dos quatro tech leads. Alguém do time dono revisa o PR. O time dono de cada pasta também está na database [Sistemas](notion:sistemas).

Mudança no que outro time usa pede também a revisão desse time. Mudar o formato do token do login, por exemplo, mexe na validação em Python e em Java, como mostra o [ADR 2](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0002-jwt-assinado-pelo-userservice-e-validado-em-cada-servico.md). Nesse caso, Contas, Canais e Livro-razão revisam.

## Antes de pedir revisão

- O PR trata de um assunto só. Se a descrição precisa de um "e também", são dois PRs.
- A descrição diz o que muda, por quê e como testar. Se a mudança vem de uma issue ou de um ADR, o link vai junto.
- Mudança de comportamento vem com teste. Os testes de um serviço rodam com [`scripts/testar.sh`](https://github.com/JucaGF/kota-bank/blob/main/scripts/testar.sh) e o nome do serviço, e só precisam do Docker.
- O lint passa. Python segue o `.pylintrc` da raiz, e cada serviço Java tem o seu `checkstyle.xml`, como diz o [ADR 5](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0005-python-em-contas-e-canais-java-no-livro-razao.md).

## O que conferir antes do merge

Além dos testes de cada serviço, o [`scripts/verificar-local.sh`](https://github.com/JucaGF/kota-bank/blob/main/scripts/verificar-local.sh) sobe o banco inteiro com o docker compose e confere o login de ponta a ponta, como um cliente faria. Com o CI vermelho, o PR não entra, mesmo aprovado.

## Como revisar

- Responda em até um dia útil. Se não der, diga no PR quem pode revisar no seu lugar.
- Deixe claro o que bloqueia e o que é sugestão. Comentário que não bloqueia começa com "sugestão".
- Prefira pergunta a veredito. "Por que aqui não usa o cache?" dá espaço para a pessoa explicar o que você não viu.
- Quando a mudança é de comportamento, rode o código. Ler o diff não basta.
- Se você aprovou com sugestões, quem abriu o PR decide se faz agora ou num PR seguinte.

## Combinados do Livro-razão

- Correção vai nos três serviços, nunca no `ledgermonolith`. O monolito é legado e não recebe mudança nova, como registra o [ADR 1](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0001-quebrar-o-monolito-do-livro-razao-em-tres-servicos.md).
- `Transaction`, `TransactionRepository` e `JWTVerifierGenerator` existem copiados nos três serviços, de propósito. Um bug ali se corrige em todas as cópias, no mesmo PR.
- Nenhuma mudança edita ou apaga transação gravada no `ledger-db`. O porquê está no [ADR 3](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0003-um-banco-por-dominio.md).

## Depois da aprovação

Quem abriu o PR faz o merge e acompanha a mudança até produção. Esse caminho está em [Deploy](notion:deploy).

O seu primeiro PR na Kota, revise junto com o seu buddy. Ele mostra os combinados do time que não cabem nesta página.
