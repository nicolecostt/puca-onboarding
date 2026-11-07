# 0002 — PRODUCT.md e CONTEXT.md como base do sistema

- Data: 2026-11-07 · Quem: Joaquim
- Status: valendo

**Contexto:** insights novos estavam entrando no `PRODUCT.md` (Desafio Tako, avaliação pelos jurados) e no
`CONTEXT.md` sem chegar às issues, e os textos do time usavam termos que o glossário manda evitar. Cada agente lia
a base, ou não, do seu jeito.

**Decisão:** os dois arquivos são a base do sistema. Toda tarefa começa pela seção do `PRODUCT.md` que ela toca e todo
texto usa o glossário, que o `CLAUDE.md` importa para estar sempre no contexto. Adicionar ou mudar algo nos dois
passa pela skill `contexto-base`: onde cada coisa vai, modelos tirados do formato que já existe, validação e o passo
de propagar a mudança para issues e docs. `npm run check` (e o CI) roda `scripts/check-contexto.ts`, que confere o
sumário, as âncoras e a numeração do `PRODUCT.md` e o formato do glossário. Termos evitados em texto novo viram aviso
(`--termos`), não erro: a mesma palavra pode ter uso comum fora do conceito.

**Consequências:** seção nova no `PRODUCT.md` sem entrada no sumário, link interno quebrado ou termo do glossário fora
do formato quebram o check. O `sync-check` avisa quando a base muda na `main`.
