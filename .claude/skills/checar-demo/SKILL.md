---
name: checar-demo
description: Chame automaticamente antes da apresentação, depois de integrar PRs na main ou quando perguntarem "a demo está funcionando?", "dá pra apresentar?", "o que está quebrado?". Confere os passos de docs/demo.md e o que o PRODUCT.md exige, e diz o que está quebrado. Não corrige nada sozinho.
---

# Checar a demo

A lista de fluxos está em `docs/demo.md`. O que a demo **precisa** mostrar vem do `PRODUCT.md` (perfis em §7, o processo
e os pontos obrigatórios do desafio em §12). Se o `PRODUCT.md` pede algo que o `docs/demo.md` não lista, aponte a diferença.

## Passos

1. **Código.** `git status -sb` (avise se não estiver na `main` atualizada) e `npm run check`.
2. **Servidor.** Suba `npm run dev` em segundo plano e espere responder em `http://localhost:5173/`.
3. **Páginas respondem.** Para cada endereço da tabela de `docs/demo.md`, `curl -s -o /dev/null -w "%{http_code}"` tem que dar 200.
4. **Fluxos ao vivo.** Se houver ferramenta de navegador disponível, abra cada fluxo, siga o "o que precisa acontecer"
   e leia o console. Para a aula, use `?auto=1` e espere até o fim. Sem navegador, diga isso claramente e entregue
   a lista para uma pessoa conferir à mão: **não marque como ok o que não foi visto**.
5. **Desligue** o servidor que você subiu.

## Saída

| # | Fluxo | Resultado | Evidência |
|---|---|---|---|

Resultado é `ok`, `quebrado` (com o erro e o arquivo provável) ou `não verificado` (com o motivo).
Termine com a lista do que está quebrado em ordem de gravidade para a apresentação. Correção é outra tarefa.
