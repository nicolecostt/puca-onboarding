# Segurança e acesso a produção

A Kota guarda o dinheiro e os dados dos clientes. Esta página diz quem acessa cada ambiente, como pedir acesso e o que fazer quando algo parece errado. Quem cuida da segurança da informação, inclusive das regras de acesso, é o Jonas Ferraz. Dúvida ou alerta vai para seguranca@kota.example.

## Segredo não vai para o Slack nem para o repositório

- Senha, token e chave de API nunca vão em mensagem do Slack, nem em mensagem direta. Também não vão para o Notion, para uma issue ou para um commit.
- Nenhum ambiente usa uma chave privada do JWT tirada do repositório. Cada ambiente gera o próprio par de chaves.
- No ambiente local, o `docker compose` gera o par na primeira subida e o guarda num volume da sua máquina, como decidido no [ADR 7](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0007-ambiente-local-com-docker-compose-construido-do-codigo.md).
- As senhas dos bancos que aparecem no [`docker-compose.yml`](https://github.com/JucaGF/kota-bank/blob/main/docker-compose.yml) valem só na máquina de quem desenvolve. Homologação e produção têm senhas próprias, e ninguém as copia para um arquivo local.

Se um segredo vazou, escreva na hora para seguranca@kota.example, e a gente troca junto. Avisar cedo importa mais do que saber de quem foi o erro.

## Como o login protege os serviços

O [ADR 2](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0002-jwt-assinado-pelo-userservice-e-validado-em-cada-servico.md) registra a decisão. Em resumo:

- Só o `userservice` emite token. No login, ele confere a senha e assina um JWT com a chave privada. O token vale uma hora.
- Cada serviço confere o token sozinho, com a chave pública. Depois, confere se o que foi pedido é do dono do token. O `balancereader`, por exemplo, só devolve o saldo da conta que está no token.
- Serviço novo que atende cliente faz as duas conferências. Fora o cadastro e o login, por onde o cliente chega ao token, nenhuma rota que devolve ou muda dado de cliente atende sem token, nem em homologação.

Duas consequências valem para todo mundo:

1. Não dá para revogar um token. O logout do site só apaga o cookie, e o token continua valendo até vencer. Por isso, token vazado é motivo para avisar a segurança na hora.
2. Trocar o par de chaves derruba todas as sessões e exige reiniciar todos os serviços. Quem faz a troca é o time de Contas, com data marcada, aviso antes no #contas e o runbook de [troca da chave do JWT](https://github.com/JucaGF/kota-bank/blob/main/docs/runbooks/trocar-chave-jwt.md).

## Quem acessa cada ambiente

| Ambiente | Quem acessa | Que dados tem |
|---|---|---|
| Local | Todo mundo, desde o primeiro dia | Dados de demonstração, que o compose carrega |
| Homologação | Toda a engenharia, com o ok do gestor | Dados de teste, nunca dado de cliente |
| Produção | Cada pessoa, só nos sistemas do próprio time | Dados reais de clientes |

## Acesso a produção

O acesso a produção é por time e tem três níveis.

- **Deploy.** Fazer deploy dos serviços do time e acompanhar os erros e o tempo de resposta deles. O tech lead libera esse acesso depois das primeiras semanas. Até lá, faça o deploy junto com alguém do time que tenha o acesso, como manda a página [Deploy](notion:deploy).
- **Plantão.** Quem está na escala de plantão também lê os logs dos sistemas que o plantão cobre. O plantão de Plataforma, por exemplo, lê os logs do site à noite e no fim de semana. As escalas estão na database [Times](notion:times).
- **Banco.** Consultar direto o `accounts-db` ou o `ledger-db` de produção. Ninguém tem esse acesso de forma permanente. Ele existe durante um incidente ou com um pedido aprovado, e vence no fim do dia.

Código e configuração só chegam a produção pelo deploy. Ninguém altera produção à mão.

Para consultar o banco de produção fora de um incidente:

1. Peça ao tech lead do time dono do sistema. Diga o que você precisa consultar e por quê. O time dono de cada sistema está na database [Sistemas](notion:sistemas).
2. Com o ok do tech lead, peça a liberação no #plataforma-ajuda.
3. Faça a consulta no mesmo dia. O acesso vence sozinho.

Quem acabou de chegar não entra na escala de plantão de cara. No Livro-razão, você acompanha a semana de plantão de alguém do time antes de entrar na escala.

Todo trimestre, a segurança revisa com cada gestor quem do time tem qual acesso.

## Outros acessos

O seu gestor pede e aprova os outros acessos, como Slack, Notion, GitHub e homologação. Se faltar algum, avise o gestor. A lista da primeira semana está em [Novo na Kota](notion:onboarding-novo) e, para quem muda de time, em [Mudando de time](notion:onboarding-transicao).

## Quando você muda de time

Quando você muda de time, sai da escala de plantão do time antigo e perde o acesso de produção aos sistemas dele. A sua última semana na escala antiga você combina com o gestor atual. No time novo, o caminho é o mesmo de quem acabou de chegar. Quem vai de Contas para o Livro-razão, por exemplo, deixa o plantão do `userservice` e acompanha uma semana de plantão do Livro-razão antes de entrar na escala.

## O que nunca fazer

- Consultar dado de cliente por curiosidade ou para testar. As regras estão em [Dados de cliente e LGPD](notion:dados-de-cliente-e-lgpd).
- Copiar dado de produção para a sua máquina ou para a homologação.
- Ler o banco de outro time. Quem precisa de dado de outro domínio pede pela API, com o JWT do cliente, como explica o [ADR 3](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0003-um-banco-por-dominio.md).
- Deixar o computador desbloqueado longe de você. Os cuidados de quem trabalha de casa estão em [Home office](notion:home-office).

## Quando algo parece errado

Escreva na hora para seguranca@kota.example se um segredo vazou, se você viu um acesso que não reconhece ou se recebeu uma mensagem pedindo senha. Conte o que viu, onde e quando. Se o problema afeta cliente, siga também a página [Incidentes](notion:incidentes).
