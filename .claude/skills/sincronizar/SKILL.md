---
name: sincronizar
description: Chame automaticamente antes de editar, antes de commitar e antes de abrir PR, quando aparecer um aviso "[sync]" e quando a pessoa perguntar "alguém mexeu na main?", "tem algo novo?", "atualiza aí". Traz a main e mostra se outra pessoa mudou (na main ou num PR aberto) os arquivos que você está mexendo.
---

# Sincronizar com o time

## Passos

1. **Veja o estado.** `scripts/sync-check.sh --agora` (faz `git fetch` e lista o que cruza) e `git status -sb`.
2. **Na `main`:** `git pull --ff-only`. Se houver alteração não commitada, ela continua no lugar; se o pull recusar,
   pare e mostre o motivo. Não vá trabalhar na `main`: crie a branch depois (skill `comecar-tarefa`).
3. **Numa branch sua:** se a `main` andou, traga com `git merge origin/main`.
   - Antes, se houver alteração não commitada, commite o que já está pronto (com o ok da pessoa) ou use `git stash`
     e depois `git stash pop`. Nunca descarte nada.
   - Conflito: resolva mantendo as **duas** intenções. Se não estiver claro o que a outra pessoa queria, pare e pergunte.
   - Depois do merge, rode `npm run check`.
4. **Se a main mudou arquivo que você está mexendo**, leia o que mudou antes de seguir:
   `git log --oneline HEAD..origin/main -- <arquivo>` e `git diff HEAD...origin/main -- <arquivo>`.
   Conte para a pessoa em 1–2 frases o que mudou e se afeta o que vocês estão fazendo (contrato, função renomeada,
   comportamento novo).
5. **Se a base do sistema mudou** (`PRODUCT.md` ou `CONTEXT.md` na `main`), leia o que mudou
   (`git diff HEAD...origin/main -- PRODUCT.md CONTEXT.md`) e diga se muda a tarefa atual: regra nova, prioridade, termo renomeado.
6. **Se um PR aberto mexe nos mesmos arquivos**, não siga editando esses arquivos sem avisar: diga qual PR, de quem,
   e sugira combinar (quem integra primeiro, ou dividir o trabalho).

## Saída

- Branch e quantos commits estava atrás
- O que foi trazido (merge ou pull) e o resultado do `npm run check`
- Arquivos que cruzam com a main ou com PRs abertos, e o que muda para a tarefa atual

Nunca use `push --force`, `reset --hard` ou `rebase` em branch que outra pessoa usa sem pedir.
