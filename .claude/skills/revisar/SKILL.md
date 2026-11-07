---
name: revisar
description: Chame automaticamente para revisar uma mudança antes de integrar — ex.: "revisa o PR 30", "dá uma olhada no que eu fiz", "tá bom pra subir?", ou a branch atual antes do handoff. Leitura independente pelo subagente revisor: bugs, quebra de contrato, regras do produto. Não use para escrever código.
argument-hint: "[número do PR | branch | vazio = branch atual]"
---

# Revisar uma mudança

Alvo: $ARGUMENTS

> **Base do sistema:** o glossário do `CONTEXT.md` já está no seu contexto (o `CLAUDE.md` importa); use os termos dele.
> A revisão confere a mudança contra as regras do `PRODUCT.md` e os termos do glossário, além de bugs. Se o pedido contradiz o `PRODUCT.md`, pare e mostre a contradição. Se algo novo precisa entrar na base, use a skill `contexto-base`.

1. **Monte o diff.**
   - vazio → `git diff origin/main...HEAD` mais o que não foi commitado;
   - número de PR → `gh pr diff <n>` e `gh pr view <n>` (descrição e o que a pessoa diz ter testado);
   - branch → `git diff origin/main...<branch>`.
2. **Se o diff mexe em `PRODUCT.md` ou `CONTEXT.md`**, rode `npm run check:contexto` e `npx tsx scripts/check-contexto.ts --termos`
   e confira o passo "Propagar" da skill `contexto-base` (issues e docs acompanharam?).
3. **Delegue ao subagente `revisor`** (só leitura), passando o alvo e o que a mudança diz fazer — não a sua opinião
   sobre ela. A revisão vale mais quando não parte das suas conclusões.
4. **Confira os achados** antes de repassar: abra o `arquivo:linha` de cada um e descarte o que não se confirma.
5. **Mostre** os achados confirmados, do mais grave ao menos grave, e o veredito.
   Num PR de outra pessoa, só comente no GitHub (`gh pr review`/`gh pr comment`) se a pessoa pedir.
