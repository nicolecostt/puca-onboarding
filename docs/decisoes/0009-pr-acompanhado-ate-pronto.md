# 0009 — PR aberto é PR acompanhado até ficar pronto para integrar

- Data: 2026-11-08 · Quem: Joaquim
- Status: valendo

**Contexto:** o agente abria o PR e parava. Comentário de revisão, CI vermelho e conflito com a `main` ficavam
esperando alguém lembrar, e o PR envelhecia enquanto a `main` andava.

**Decisão:** quem abre o PR acompanha até ele ficar **pronto para integrar** (CI verde, integra na `main`, revisado por
uma pessoa ou pelo revisor automático, nenhuma conversa de revisão aberta, nenhum comentário sem resposta, nenhum pedido
de mudança), pela skill `acompanhar-pr`. Cada comentário vira correção, resposta com motivo, issue nova (fora do
escopo) ou pergunta à pessoa (decisão). `scripts/acompanhar-pr.ts` diz o que falta e espera até algo mudar no PR; o hook
`PostToolUse` `scripts/pr-aberto.sh` avisa o agente com `[pr]` logo depois de um `gh pr create`. Abrir o PR com o ok
da pessoa vale como ok para os commits e pushes de correção na mesma branch (check verde, sem force push). Integrar fica
de fora: só com pedido da pessoa, como antes.

**Consequências:** depois de abrir o PR, o agente deixa uma espera em segundo plano e responde no GitHub pela conta de
quem abriu o PR. Comentário é pedido para avaliar, não ordem. Sem novidade por 2 h, o agente avisa e para; a pessoa
retoma com "acompanha o PR <n>". O hook só vale depois de reabrir a sessão do Claude Code; quem usa outro agente segue
pela linha no `CLAUDE.md` (Como trabalhamos, item 9).
