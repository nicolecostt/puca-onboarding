# Roteiro da demo

O que precisa funcionar na apresentação e como conferir. A skill `checar-demo` segue este arquivo.
Quando um passo da demo mudar de estado, atualize a tabela no mesmo PR.

## Antes de apresentar

```bash
git switch main && git pull
npm ci
npm run check      # tem que estar verde
npm run dev:fly    # http://localhost:5173, usando o servidor do Fly (Claude e voz); não precisa de server/.env
```

Para testar uma mudança no servidor, troque o `dev:fly` por `npm run dev:server` (API em :8787, precisa de
`server/.env`, modelo em `server/.env.example`) e `npm run dev`. Qualquer outro servidor: `API_TARGET=<url> npm run dev`.

O `dev:fly` gasta a cota do Fly, que é de todo mundo: a trava diária de voz é baixa (#156) e o servidor está sem token
(#160). Antes de apresentar, abra `https://orbis-puca.fly.dev/api/health`: `"tts": false` é a trava de voz esgotada, e a
saída é o `dev:server` com chave própria. Sem voz (trava esgotada ou `server/.env` sem as chaves), a sessão segue com
legenda e chat; sem servidor nenhum, também.

## Fluxo da demo

A Kota, banco digital fictício do kit (§13 do [`PRODUCT.md`](../PRODUCT.md)), com **dois perfis** (§7): `ana` (Ana Lacerda), vínculo **novo**
(passa pela parte institucional), e `bruno` (Bruno Siqueira), vínculo **transição**, que vem de Contas (vai direto ao time).
Os dois entram no Livro-razão: a gestora é a Natália Brandão, o tech lead é o Thiago Nakamura e a buddy é a Beatriz Cavalcanti.

Estado em 2026-11-07: **existe** (funciona, ainda que simulado), **parcial** ou **falta**.

| # | Passo | Estado | Onde ver / o que precisa acontecer |
|---|---|---|---|
| 1 | Call inicial (onboarding cultural, cargo, time, conhecimentos, objetivos) | existe, simulada; falta o onboarding cultural (#57) | `/src/screens/onboarding-call/?perfil=ana` e `?perfil=bruno`. Na primeira abertura do app, as boas-vindas pedem a escolha: dois cartões, Ana (entrando na Kota) e Bruno (mudando de time); a escolha abre a call dessa pessoa, que não pergunta de novo o vínculo. Sessão aberta sem perfil mostra a mesma escolha. No fim da call, o app abre a sessão no quadro. Depois de concluir a sessão, “Ir para o Início” abre as tarefas e os acessos. O perfil e a calibragem coletados na call seguem para a sessão. Se o servidor ou o LLM falhar, “Ir para a sessão” permite continuar, conservando o que já foi coletado (#207) |
| 2 | Jornada com objetivos e próximos passos | existe | na sessão, o painel "Sua jornada" (canto de cima à esquerda): barra de progresso, objetivo da pessoa e os momentos numa linha do tempo, marcados pela calibragem (aprender, revisar, já conhece, pulado), com o atual ("agora") ou o próximo ("a seguir"; depois do fim, "para rever") em destaque; clicar num momento pula para ele. Com `?perfil=bruno`, "A Kota" aparece como pulado e "Quando falha" é revisão |
| 3 | Sessão no quadro, com voz | existe | `/src/screens/lesson/?perfil=ana&auto=1` (institucional) e `?perfil=bruno&auto=1` (direto ao time); voz de verdade com `dev:server` e chaves. O quadro é tela infinita: arrastar o fundo ou rolar move, `⌘` + rolar dá zoom, "Ajustar" volta a ver tudo |
| 4 | Verificação de compreensão | existe | na sessão, "Checagem rápida" (tocar no quadro, os dois perfis) e a pergunta "se o balancereader estiver fora do ar, o que acontece com uma transferência?" em "Quando falha" (responder por botão, chat ou voz). Quem precisa rever passa por um reforço no quadro; o painel "Sua jornada" muda o momento para "já conhece" ou "revisar" na hora |
| 5 | Primeira tarefa | existe, simulada | na sessão, o momento "Primeira tarefa" apresenta uma tarefa do catálogo do time: com `?perfil=ana`, "Limite de R$ 10.000,00 por transação no ledgerwriter"; com `?perfil=bruno`, "Extrato de outra conta responde 403, não 401", no `transactionhistory` (usa o que ele já sabe de JWT). Puca pede a aprovação da Natália e aparece "Pedido de aprovação enviado a Natália Brandão no Slack · Abrir Slack". No Slack (`/src/screens/live-session/`), Puca abre a DM da Natália e envia o pedido; "Aprovar tarefa" é a gestora decidindo. A página `/src/screens/primeira-tarefa/` (Notion da Kota, simulado) muda para "Aprovada por Natália Brandão…" e a sessão avisa com "Ver tarefa". Cada sessão nova (página carregada) pede de novo, então um ensaio aprovado no mesmo navegador não some com o passo. Depois da tarefa, "por onde começo a tarefa?" responde na hora com onde ler, sistemas e quem ajuda; "qual o prazo da tarefa?" vira encaminhamento à Beatriz |
| 6 | Progresso salvo | parcial | o Início fica disponível após a sessão e mostra o último pedido de aprovação da primeira tarefa. No Mac, perfil, calibragem e conclusão da sessão ficam disponíveis ao reabrir o app. |
| 7 | Pergunta que muda o rumo | existe | na sessão, por voz ou chat: pedir para mudar de assunto (pulo) ou perguntar; ordem em `src/journey/route.ts` |
| 8 | Dúvida que vira encaminhamento | existe: real no Slack da Kota com e-mail, simulado sem | a Kota é documentada, então o encaminhamento vem do caso pessoal ou do que nenhum documento cobre (`docs/kit-da-kota.md` §4). No início do Orbis, em Ferramentas, informar o e-mail com que você entrou no Slack da Kota (opcional). No momento "O caminho de uma transferência", perguntar "qual vai ser o meu bônus?" enquanto Puca explica (na pausa da pergunta final da etapa, a fala vira resposta e não encaminha). **Com servidor** (`dev:fly`, app para Mac ou `dev:server`), Puca explica a regra geral, diz que vai encaminhar para People ou para o gestor, e aparece "Encaminhado para People no Slack" (ou para a gestora). Com e-mail e `SLACK_BOT_TOKEN` no servidor, chega a você uma mensagem direta no Slack da Kota, como "Puca", dizendo a quem a dúvida iria na Kota, com até 3 fontes consultadas e o motivo; o aviso muda para "Mandei a dúvida no seu Slack da Kota · Abrir no Slack" e o rastro guarda o link (#129, #125). Uma dúvida que nenhum documento cobre (ex.: "tem convênio com academia?") vai à buddy, Beatriz Cavalcanti. **Sem e-mail, sem conta no Slack ou sem servidor**, Puca abre a DM de quem recebe (People, a gestora ou a Beatriz) no Slack simulado (`/src/screens/live-session/`), escreve a dúvida e envia; quem recebe confirma. Sem servidor, a pergunta do bônus vai à Beatriz. **Meta (`PRODUCT.md` §12.2):** Puca mostra a mensagem no navegador dele (#123) |
| 9 | Navegador de Puca (computer use) | existe no app para Mac; simulado no navegador comum | No app (`npm run dev:app`, ou o instalado), na sessão com `?perfil=ana`: no passo da missão ("A Kota"), o palco troca para o Notion da Kota, e Puca marca "Nossa missão" quando diz "a missão". No passo do saldo ("O caminho de uma transferência"), Puca abre o `kota-bank` no GitHub e circula o `README.md` quando ele diz "ADR 1". Falar por cima para as ações do navegador. As abas "Quadro" e "Navegador" (canto de cima à direita) trocam o palco. O navegador só abre o `kota-bank` e o Notion da Kota. No `npm run dev`, a sessão segue sem navegador, e `/src/screens/live-session/` continua com o Slack simulado e o cursor de Puca (aprovação do gestor, passo 5) |

Em todos: console do navegador sem erro vermelho.

## Testes antes de apresentar

Do plano do time. Cada um vale quando o passo correspondente existir.

- Fluxo completo, do 1 ao 8, com os dois perfis.
- Interrupção e retomada da fala.
- Voz e quadro em sincronia.
- Perguntas diferentes das preparadas, e perguntas sem resposta na base (tem que cair no passo 8, nunca inventar).
- Progresso e memória continuam numa sessão nova.
- Instalação e uso em outro computador, seguindo só as instruções públicas.
- Rastro: depois da sessão, abrir `/src/screens/rastro/` (**tela só para a demo**). Cada fala aparece com o caminho, a resposta e a fonte, e "Baixar JSON" gera o arquivo para auditar.
- Custo da sessão (#52, só para auditar, não aparece na demo): no JSON baixado, `sessions` traz a duração, as falas, as perguntas ao agente e os tokens de cada sessão; no log do servidor (`npm run dev:server`), cada pergunta ao agente vira uma linha `"msg":"ask"` com o `timing`, inclusive as interrompidas.

## Verificação de integração — 08/11/2026 (#207)

Ensaio local sobre a `main` até `00f675f`, com as correções da #207. Não substitui testar o app instalado e os
serviços reais antes de apresentar.

| Verificação | Resultado observado |
|---|---|
| `npm run check` | 752 testes em 79 arquivos; tipos, base, harness e build passaram |
| `npm run build:desktop` | Passou; execução do app instalado não verificada |
| Páginas da demo | As nove telas responderam HTTP 200 |
| Call pelo Fly | Bruno passou da call para a sessão com nome e objetivo coletados pelo chat |
| Sessões com `?auto=1`, no build local | Ana terminou 9/9 momentos; Bruno, 8/8; chegaram ao Início |
| Primeira tarefa e aprovação | Tarefas distintas por perfil; aprovação no Slack simulado refletida na página da tarefa e no Início |
| Pulo e encaminhamento | “Vamos para quando falha” mudou o momento; dúvida sobre bônus foi encaminhada à Beatriz e apareceu confirmada no rastro, pelo Slack simulado |
| Recuperação da call | Servidor de teste anunciou LLM disponível e falhou após coletar respostas; “Ir para a sessão” abriu o quadro preservando “Ana Teste” |
| Progresso | Início da Ana manteve tarefa aprovada após recarregar; reabrir o app instalado não verificado |
| Console | Sem erros nas sessões de Ana/Bruno e no Slack simulado durante o ensaio do build |

Ainda não verificados neste ensaio: microfone real, sincronização audível de voz/quadro, envio ao Slack real,
navegador de Puca no Electron e instalação em outro computador. O servidor local apresentou falhas intermitentes
do LLM; o health disponível, sozinho, não comprova que o provedor responderá.

## Ordem da apresentação

_A definir pelo time: quem fala, em que ordem os passos aparecem e quanto tempo cada um leva (pitch de 3 min)._
