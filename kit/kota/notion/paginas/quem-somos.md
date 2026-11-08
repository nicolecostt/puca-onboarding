# Quem somos

A Kota é um banco digital. Pelo site, o cliente abre a conta, entra com usuário e senha, vê o saldo e o extrato, transfere para os contatos que salvou e deposita.

## Nossa missão

Cuidar do dinheiro de cada cliente sem erro e sem susto. Abrir a conta, ver o saldo certo e transferir para quem quiser tem que ser simples. Por trás dessa simplicidade, cada centavo tem que estar no lugar.

## Como estamos organizados

A engenharia tem quatro times. Cada um tem gestor, tech lead, buddy, canal no Slack e plantão, e tudo isso está na database [Times](notion:times).

- **Contas** cuida do cadastro, do login e dos contatos de cada cliente.
- **Livro-razão** registra cada centavo que entra e sai das contas e mostra saldo e extrato corretos.
- **Canais** cuida do site, que é por onde o cliente usa o banco.
- **Plataforma** dá aos outros times um jeito confiável de subir, testar e operar os serviços, do ambiente local à produção.

Fora da engenharia, People cuida de carreira, benefícios e políticas, e a segurança da informação cuida de acessos e de vazamentos. Quem é quem está em [Pessoas](notion:pessoas). O que cada serviço faz e qual time cuida dele está em [Sistemas](notion:sistemas).

## Nossos valores

### Cada centavo confere

Saldo errado não é bug pequeno. Antes de discutir velocidade, conferimos se o número fecha.

Na prática, uma transação gravada não muda mais. O `ledger-db` ignora qualquer `UPDATE` ou `DELETE` na tabela de transações, como conta o [ADR 3](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0003-um-banco-por-dominio.md). Se um valor saiu errado, a correção é uma transação nova, e as duas aparecem no extrato.

### O porquê fica escrito

Decisão que só existe na cabeça de alguém se perde quando essa pessoa sai de férias ou muda de time. Por isso, toda decisão técnica que importa vira um ADR no repositório, e as maiores passam antes por uma RFC aqui no Notion.

Na prática, quando a Larissa Fagundes perguntou no #livro-razao-ajuda por que o saldo não é atualizado por uma fila de eventos, o Thiago Nakamura respondeu com um link. A ideia tinha sido proposta na [RFC 3](notion:rfc-3) e rejeitada, e o [ADR 6](https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0006-fila-entre-o-ledgerwriter-e-os-leitores.md) conta o que pesou.

### Perguntamos em público

Dúvida técnica vai no canal de ajuda do time que cuida do assunto, e não em mensagem direta. Assim a resposta fica para a próxima pessoa com a mesma dúvida, e quem sabe responder não vira gargalo. Ninguém aqui acha pergunta boba, muito menos de quem acabou de chegar.

Na prática, o Gustavo Schmitt achou no ambiente local um contato salvo com a conta de destino errada e perguntou no #contas-ajuda quem cuidava do `contacts`. A Raíssa Bentes respondeu ali mesmo que o serviço é de Contas e pediu os passos no canal, para olhar naquela tarde.

### Quem muda, acompanha

Quem sobe uma mudança cuida do efeito dela no cliente, antes e depois do deploy.

Na prática, depois do deploy do `contacts`, o Bruno Siqueira ficou olhando os erros por uma hora antes de dar o assunto por encerrado. E antes da troca programada da chave do JWT, que derruba as sessões abertas, a Raíssa Bentes avisou o atendimento.

## Para continuar

Como trabalhamos no dia a dia está em [Jeito de trabalhar](notion:jeito-de-trabalhar). Se você acabou de entrar na Kota, siga para [Novo na Kota](notion:onboarding-novo). Se veio de outro time, siga para [Mudando de time](notion:onboarding-transicao).
