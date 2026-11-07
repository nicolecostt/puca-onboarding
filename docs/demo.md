# Roteiro da demo

O que precisa funcionar na apresentação e como conferir. A skill `checar-demo` segue este arquivo.
Quando um passo da demo mudar de estado, atualize a tabela no mesmo PR.

## Antes de apresentar

```bash
git switch main && git pull
npm ci
npm run check      # tem que estar verde
npm run dev:server # API em :8787; precisa de server/.env (modelo em server/.env.example)
npm run dev        # http://localhost:5173
```

Sem as chaves de voz no `server/.env`, a aula usa texto e a voz do browser. Sem o servidor, segue só com legenda e chat.

## Fluxo da demo

Uma empresa fictícia (Tail) com **dois perfis** (§7 do [`PRODUCT.md`](../PRODUCT.md)): `ana`, vínculo **novo**
(passa pela parte institucional), e `bruno`, vínculo **transição** (vai direto ao time).

Estado em 2026-11-07: **existe** (funciona, ainda que simulado), **parcial** ou **falta**.

| # | Passo | Estado | Onde ver / o que precisa acontecer |
|---|---|---|---|
| 1 | Call inicial (cargo, time, conhecimentos, objetivos) | existe, simulada | `/src/screens/onboarding-call/?perfil=ana` e `?perfil=bruno`; no fim, "Começar a aula →" leva à aula |
| 2 | Jornada com metas e próximos passos | parcial | hoje só as etapas no cabeçalho (`src/data/company.ts`) |
| 3 | Aula no quadro, com voz | existe | `/src/screens/lesson/?perfil=ana&auto=1` (institucional) e `?perfil=bruno&auto=1` (direto ao time); voz de verdade com `dev:server` e chaves |
| 4 | Verificação de compreensão | parcial | passos `wait`/`select` da jornada: responder e tocar no nó certo |
| 5 | Task | falta | — |
| 6 | Progresso salvo | falta | hoje só o perfil, em `sessionStorage` |
| 7 | Pergunta que muda o rumo | existe | na aula, por voz ou chat: pedir para mudar de assunto (pulo) ou perguntar; ordem em `src/journey/route.ts` |
| 8 | Dúvida que vira encaminhamento | parcial | na aula, perguntar algo sem fonte: a Puca diz que não confirmou e que anotou para a buddy (nada é enviado ainda) |
| 9 | Tela de auxílio (computer use) | existe, simulada | `/src/screens/live-session/`: barra de call, chat, câmera e cursor da Puca no Slack |

Em todos: console do navegador sem erro vermelho.

## Testes antes de apresentar

Do plano do time. Cada um vale quando o passo correspondente existir.

- Fluxo completo, do 1 ao 8, com os dois perfis.
- Interrupção e retomada da fala.
- Voz e quadro em sincronia.
- Perguntas diferentes das preparadas, e perguntas sem resposta na base (tem que cair no passo 8, nunca inventar).
- Progresso e memória continuam numa sessão nova.
- Instalação e uso em outro computador, seguindo só as instruções públicas.

## Ordem da apresentação

_A definir pelo time: quem fala, em que ordem os passos aparecem e quanto tempo cada um leva (pitch de 3 min)._
