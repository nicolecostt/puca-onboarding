---
name: handoff
description: Chame automaticamente quando a pessoa der a tarefa por terminada ou quiser entregar — ex.: "terminei", "pronto", "pode subir", "sobe isso", "abre o PR", "manda pra revisão". Sincroniza, roda o check, registra decisões e monta o PR. Commit e push só com o ok da pessoa; depois do PR aberto, as correções da revisão seguem a skill acompanhar-pr.
argument-hint: "[--abrir para já abrir o PR]"
---

# Handoff

Opções: $ARGUMENTS

## Passos

0. **Sincronize** (skill `sincronizar`): traga a `main` para a branch e resolva conflitos **antes** de verificar,
   para o check rodar sobre o código que vai ser integrado.
1. **O que mudou.** `git status -sb`, `git diff origin/main...HEAD --stat` e o diff do que não foi commitado.
   Se houver arquivo alterado fora do escopo da tarefa, aponte e pergunte se fica ou sai.
2. **Verifique de verdade.** Rode `npm run check` e guarde o resumo da saída (testes passando, build ok).
   Se falhar, pare e mostre o erro: não faça handoff com check vermelho.
   Diga se a tela afetada foi testada no `npm run dev` ou não.
3. **Contratos.** Algum item de `docs/contratos.md` mudou? Se sim, o doc foi atualizado e a quebra está marcada?
4. **Decisões.** Alguma escolha nesta tarefa muda o trabalho dos outros? Registre em `docs/decisoes/NNNN-assunto.md`
   (modelo em `docs/decisoes/README.md`). Se não houver, não crie nada.
5. **Docs.** README, `journey-format.md` ou `demo.md` precisam refletir a mudança?
6. **Commit.** Mostre a mensagem no padrão `tipo(escopo): o que mudou` e só commite com o ok da pessoa.
   Se o pedido já foi "pode subir", "sobe isso" ou "abre o PR", isso é o ok para commit, push e PR (desde que o check esteja verde).
7. **Base do sistema.** A mudança altera algo descrito no `PRODUCT.md` ou cria/renomeia um termo? Atualize pela skill
   `contexto-base` (padrão + propagar para issues). Código novo, textos e o PR usam os termos do glossário.
8. **Demo.** Se a mudança mexe num passo de `docs/demo.md`, atualize o estado dele na tabela.
9. **PR.** Escreva a descrição seguindo `.github/pull_request_template.md`, com `Closes #<n>` da issue (o número
   costuma estar no nome da branch). Com `--abrir` ou um pedido de subir/abrir PR, faça
   `git push -u origin HEAD` e `gh pr create --base main --title "…" --body-file <arquivo>`. Sem `--abrir`, só mostre o texto.
10. **Acompanhe.** Com o PR aberto, chame a skill `acompanhar-pr`: o PR fica com você até estar pronto para integrar.
    Abrir o PR com o ok da pessoa já vale como ok para os commits e pushes na mesma branch que respondem à revisão ou
    ao CI ([decisão 0009](../../../docs/decisoes/0009-pr-acompanhado-ate-pronto.md)).

## Saída

- Resumo do que mudou e por quê
- Arquivos e contratos afetados
- Verificação: comandos rodados e resultado real
- Limitações e o que não foi testado
- Próximos passos / quem precisa saber

Nunca diga que um teste passou sem ter rodado. Nunca commite segredo, `.env`, `sandbox/` ou `dist/`.
