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

Sem as chaves de voz no `server/.env`, a sessão usa texto e a voz do browser. Sem o servidor, segue só com legenda e chat.

## Fluxo da demo

Uma empresa fictícia (Tail) com **dois perfis** (§7 do [`PRODUCT.md`](../PRODUCT.md)): `ana`, vínculo **novo**
(passa pela parte institucional), e `bruno`, vínculo **transição** (vai direto ao time).

Estado em 2026-11-07: **existe** (funciona, ainda que simulado), **parcial** ou **falta**.

| # | Passo | Estado | Onde ver / o que precisa acontecer |
|---|---|---|---|
| 1 | Call inicial (onboarding cultural, cargo, time, conhecimentos, objetivos) | existe, simulada; falta o onboarding cultural (#57) | `/src/screens/onboarding-call/?perfil=ana` e `?perfil=bruno`; no fim, a tela vai sozinha para as boas-vindas ("Oi, {nome}."); "Ir para o início" abre o início do Orbis (progresso, tarefas, acessos) e "Começar a sessão" leva à sessão. O `?perfil=` vai junto em todo o caminho |
| 2 | Jornada com objetivos e próximos passos | existe | na sessão, o painel "Sua jornada" (canto de cima à esquerda): barra de progresso, objetivo da pessoa e os momentos numa linha do tempo, marcados pela calibragem (aprender, revisar, já conhece, pulado), com o atual ("agora") ou o próximo ("a seguir"; depois do fim, "para rever") em destaque; clicar num momento pula para ele. Com `?perfil=bruno`, "A Tail" aparece como pulado e "Quando falha" é revisão |
| 3 | Sessão no quadro, com voz | existe | `/src/screens/lesson/?perfil=ana&auto=1` (institucional) e `?perfil=bruno&auto=1` (direto ao time); voz de verdade com `dev:server` e chaves |
| 4 | Verificação de compreensão | existe | na sessão, "Checagem rápida" (tocar no quadro, os dois perfis) e a pergunta da fila de erro em "Quando falha" (responder por botão, chat ou voz). Quem precisa rever passa por um reforço no quadro; o painel "Sua jornada" muda o momento para "já conhece" ou "revisar" na hora |
| 5 | Primeira tarefa | existe, simulada | na sessão, o momento "Primeira tarefa" apresenta uma tarefa do catálogo do time: com `?perfil=ana`, validar a versão mínima de firmware (com a Paula em par); com `?perfil=bruno`, retry e DLQ na publicação de configuração. A Puca pede a aprovação do Marcos e aparece "Pedido de aprovação enviado a Marcos Vidal no Slack · Abrir Slack". No Slack (`/src/screens/live-session/`), a Puca abre a DM do Marcos e envia o pedido; "Aprovar tarefa" é o gestor decidindo. A página `/src/screens/primeira-tarefa/` (Notion da Tail) muda para "Aprovada por Marcos Vidal…" e a sessão avisa com "Ver tarefa". Cada sessão nova (página carregada) pede de novo, então um ensaio aprovado no mesmo navegador não some com o passo. Depois da tarefa, "por onde começo a tarefa?" responde na hora com onde ler, sistemas e quem ajuda; "qual o prazo da tarefa?" vira encaminhamento à Paula |
| 6 | Progresso salvo | falta | hoje só o perfil, em `sessionStorage` |
| 7 | Pergunta que muda o rumo | existe | na sessão, por voz ou chat: pedir para mudar de assunto (pulo) ou perguntar; ordem em `src/journey/route.ts` |
| 8 | Dúvida que vira encaminhamento | existe, simulado | no momento "O caminho de uma transação", perguntar "quem cuida do tail-common?": a Puca diz que não há responsável confirmado e aparece "Encaminhado à Paula Nunes no Slack · Abrir Slack". No Slack, a Puca abre a DM da Paula, escreve a dúvida com o que consultou e o motivo, e envia; a Paula confirma. Com `dev:server`, uma pergunta sem fonte (ex.: "qual a política de home office do time?") também encaminha, pelo agente. **Meta (`PRODUCT.md` §12.2):** o envio sai no Slack real da Kota, pelo servidor (#129), e a Puca mostra a mensagem no navegador dela (#123) |
| 9 | Tela de auxílio (computer use) | existe, simulada | `/src/screens/live-session/`: barra de call, chat, câmera e cursor da Puca no Slack; o cursor opera de verdade o envio do pedido de aprovação (passo 5) e do encaminhamento (passo 8). **Meta (`PRODUCT.md` §12.2):** no app para Mac, a `live-session` vira a casa do navegador da Puca, com GitHub, Notion e Slack da Kota de verdade (#123); no `npm run dev`, continua o simulado |

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

## Ordem da apresentação

_A definir pelo time: quem fala, em que ordem os passos aparecem e quanto tempo cada um leva (pitch de 3 min)._
