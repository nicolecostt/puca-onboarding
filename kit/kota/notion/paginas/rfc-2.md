# Banco de contas separado do livro-razão

Proposta de Nádia Saliba, tech lead de Plataforma.

## Problema

Com a separação do monolito ([RFC 1](notion:rfc-1)), a tabela de transações precisa de um banco novo. Hoje ela mora na máquina do `ledgermonolith`, num Postgres instalado ali mesmo.

O caminho mais curto é criar a tabela no Postgres que Contas já usa para cadastro e contatos. Seria uma instância só para fazer backup, monitorar e atualizar. Esta RFC propõe o contrário.

## Proposta

Cada domínio tem o seu Postgres, e só os serviços do domínio conectam nele.

- `accounts-db`, de Contas, com as tabelas `users` e `contacts`. Só o `userservice` e o `contacts` conectam, pelo `ACCOUNTS_DB_URI`.
- `ledger-db`, do Livro-razão, com a tabela `TRANSACTIONS`. Só os serviços do livro-razão conectam, pelo `SPRING_DATASOURCE_URL`.

Quem precisa de dado de outro domínio pede pela API, com o JWT do cliente. Nenhum serviço lê o banco de outro time.

Por que separar:

- Os dois bancos seguem regras diferentes. O livro-razão só aceita inserção, e as regras `PREVENT_UPDATE` e `PREVENT_DELETE` ignoram qualquer `UPDATE` ou `DELETE` em `TRANSACTIONS`. O cadastro de Contas muda o tempo todo.
- O livro-razão só cresce. Numa instância dividida, um disco cheio no livro-razão derruba o login junto.
- Com um banco só, ler a tabela do outro time é a saída mais fácil, e a dependência fica escondida. Pela API, ela aparece para os dois times.

## Alternativas

**Uma instância só, com as tabelas dos dois domínios.** Um backup, um monitoramento, uma atualização de versão. É o mais simples de operar e foi a primeira ideia. Perde nos três motivos acima.

**Uma instância só, com um banco para cada domínio e usuários separados.** Resolve quem lê o quê. Mas disco, memória e atualização de versão continuam juntos, e o livro-razão cheio continua derrubando o login.

## Discussão

**Rodrigo Queiroz**: Do lado de Contas, muda pouco. O `accounts-db` fica com `users` e `contacts`, e o cadastro continua atualizando normalmente. Gosto de o login não depender do disco do livro-razão.

**Thiago Nakamura**: Uma consequência para o Livro-razão. O `ledgerwriter` não vai ter como conferir se a conta de destino existe, porque não enxerga o `accounts-db`. A validação fica no formato da conta e da agência, em quem envia ser o dono do token, em origem diferente do destino e em valor positivo. Acho aceitável, mas quero isso escrito.

**Nádia Saliba**: Fica escrito. Se um dia precisar conferir, o caminho é perguntar à API de Contas com o JWT do cliente, e não ler o banco.

**Jonas Ferraz**: Do lado de segurança, apoio. O cadastro dos clientes fica num banco que só dois serviços acessam, e fica mais fácil responder quem lê dado pessoal.

**Eduardo Kaminski**: São dois bancos para fazer backup, monitorar e migrar, e quem opera somos nós, de Plataforma. Topo o custo. Peço só que os dois tenham o mesmo backup e o mesmo alerta desde o primeiro dia.

**Vinícius Pires**: Como o `ledger-db` só cresce, o alerta que mais importa nele é o de disco.

**Natália Brandão**: Esse alerta fica com o plantão do Livro-razão.

## Resultado

Aprovada. Virou o [ADR 3: Um banco por domínio](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0003-um-banco-por-dominio.md).

O nome do ADR ficou mais amplo que o da RFC porque a regra vale para qualquer domínio, não só para Contas e Livro-razão.
