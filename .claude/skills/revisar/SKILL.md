---
name: revisar
description: Use para revisar uma mudança antes de integrar — a branch atual, um PR do time (número) ou um diff. Procura bugs, quebra de contrato e problemas de integração com uma leitura independente. Não use para escrever código.
argument-hint: "[número do PR | branch | vazio = branch atual]"
---

# Revisar uma mudança

Alvo: $ARGUMENTS

1. **Monte o diff.**
   - vazio → `git diff origin/main...HEAD` mais o que não foi commitado;
   - número de PR → `gh pr diff <n>` e `gh pr view <n>` (descrição e o que a pessoa diz ter testado);
   - branch → `git diff origin/main...<branch>`.
2. **Delegue ao subagente `revisor`** (só leitura), passando o alvo e o que a mudança diz fazer — não a sua opinião
   sobre ela. A revisão vale mais quando não parte das suas conclusões.
3. **Confira os achados** antes de repassar: abra o `arquivo:linha` de cada um e descarte o que não se confirma.
4. **Mostre** os achados confirmados, do mais grave ao menos grave, e o veredito.
   Num PR de outra pessoa, só comente no GitHub (`gh pr review`/`gh pr comment`) se a pessoa pedir.
