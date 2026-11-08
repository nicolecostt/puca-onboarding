# Comece aqui

Este é o guia de quem vai avaliar o Orbis. A Kota é um banco digital de mentira, mas o código roda, as decisões estão escritas e as pessoas têm nome, time e canal. Puca, agente do Orbis, usa esses materiais para fazer o seu onboarding. Tudo o que ela disser, você pode conferir aqui.

## Quem você é na história

Você entra no time **Livro-razão**, que registra cada centavo que entra e sai das contas. A sua gestora é a Natália Brandão, e a sua buddy é a Beatriz Cavalcanti. Escolha um dos dois perfis:

- **Novo na Kota.** Você é a Ana Lacerda, engenheira de software pleno, e acabou de entrar na empresa. O Puca começa pela parte institucional (cultura, políticas e acessos) e depois vai para o time. O seu roteiro é [Novo na Kota](notion:onboarding-novo).
- **Mudando de time.** Você é o Bruno Siqueira, engenheiro de software pleno, e vem do time Contas. O Puca pula a parte institucional, compara o time novo com o que você já conhece e vai direto ao Livro-razão. O seu roteiro é [Mudando de time](notion:onboarding-transicao).

Na call inicial, o Puca pergunta se é a sua primeira vez na empresa ou se você está mudando de time. A sua resposta escolhe o caminho. No navegador, você também pode abrir o Orbis com `?perfil=ana` ou `?perfil=bruno` no endereço.

## Onde estão as coisas

- **Orbis.** Num Mac, instale com um comando, sem senha: `curl -fsSL https://raw.githubusercontent.com/nicolecostt/puca-onboarding/main/scripts/instalar.sh | bash`. O app abre sozinho no fim.
- **Código da Kota.** O repositório [JucaGF/kota-bank](https://github.com/JucaGF/kota-bank) tem os serviços, os ADRs em `docs/adr/`, os runbooks em `docs/runbooks/` e as issues de primeira tarefa.
- **Notion da Kota.** Você está nele. A página [Kota](notion:kota) leva à cultura, às políticas, aos processos de engenharia, aos RFCs e à database de [Pessoas](notion:pessoas).
- **Slack da Kota.** Entre pelo convite: https://join.slack.com/t/kotaworkspacegrupo/shared_invite/zt-4ftdue54n-ISqm0Uu~1mqeLvuxz7Ex6A. Os canais dos times têm histórico, e é lá que chegam as dúvidas que o Puca encaminha.

## Como subir o banco

Com o Docker rodando, siga o README do [kota-bank](https://github.com/JucaGF/kota-bank). Em resumo, rode `docker compose up --build` na raiz do repositório e abra http://localhost:8080. Para entrar, use o usuário `cliente.demo` e a senha `kota-demo`. A primeira subida leva alguns minutos, porque o compose constrói os serviços a partir do código.

## O que vale tentar

1. **Clique na fonte de um nó.** Numa sessão, abra o cartão de um nó do quadro e clique na fonte. Você cai no ADR do repositório ou na página do Notion que diz a mesma coisa que o Puca disse.
2. **Faça uma pergunta fora do roteiro.** Pergunte sobre o código ou sobre uma política, por voz ou pelo chat. O Puca responde citando de onde tirou a resposta. Se ela não achar uma fonte confiável, diz que não confirmou.
3. **Faça uma pergunta pessoal.** Por exemplo, "qual vai ser o meu bônus?", enquanto o Puca explica, e não quando ela espera a sua resposta. O Puca diz o que não pode confirmar e encaminha a dúvida para quem responde por ela. Se você informar, no início do Orbis, em Ferramentas, o e-mail com que entrou no Slack da Kota, o Puca te manda uma mensagem direta lá, dizendo a quem a dúvida iria e com o que ela consultou.
4. **Pegue a primeira tarefa.** No fim da sessão, o Puca propõe uma tarefa do catálogo do time, e a Natália aprova. Ache a issue no [kota-bank](https://github.com/JucaGF/kota-bank/issues), rode o teste que a issue indica e veja ele falhar. Depois da correção, ele passa.
5. **Suba o banco e veja "Kota".** Siga o passo acima e confira o nome Kota no site, o saldo e o extrato do `cliente.demo`.

Algo travou ou ficou confuso? Isso também nos interessa. Conte para quem te mandou este link.
