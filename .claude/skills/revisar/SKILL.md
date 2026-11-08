---
name: revisar
description: Chame automaticamente para revisar uma mudança antes de integrar — ex.: "revisa o PR 30", "dá uma olhada no que eu fiz", "tá bom pra subir?", "pode aprovar?", "dá pra mergear?", ou a branch atual antes do handoff. Junta os fatos (merge, conflitos, CI) e faz uma leitura independente pelo subagente revisor, com os critérios do hackathon. Não use para escrever código.
argument-hint: "[número do PR | branch | vazio = branch atual]"
---

# Revisar uma mudança

Alvo: $ARGUMENTS

> **Base do sistema:** o glossário do `CONTEXT.md` já está no seu contexto (o `CLAUDE.md` importa); use os termos dele.
> A revisão confere a mudança contra as regras do `PRODUCT.md` e os termos do glossário, além de bugs. Se o pedido contradiz o `PRODUCT.md`, pare e mostre a contradição. Se algo novo precisa entrar na base, use a skill `contexto-base`.

A pergunta da revisão, no hackathon, é uma só: **dá para integrar sem quebrar nada nem atrapalhar ninguém?**
Não é deixar o código perfeito.

## Passos

1. **Fatos primeiro.** PR: `scripts/pr-check.sh <n>` (se o aviso `[pr-check]` já veio no contexto, use ele).
   Branch sem PR: `scripts/pr-check.sh --conflitos origin/main HEAD`. Esses fatos (merge com a `main`, conflitos reais
   com outros PRs, CI, base do sistema depois do merge) já foram verificados: não suponha nada diferente deles.
2. **O que a mudança diz fazer.** `gh pr view <n>` (descrição, issue ligada, o que a pessoa diz ter testado) e `gh pr diff <n>`;
   ou `git diff origin/main...HEAD` para a branch atual.
3. **Delegue ao subagente `revisor`** (só leitura) passando: o alvo, os fatos do passo 1 e o que a mudança diz fazer —
   não a sua opinião sobre ela. A revisão vale mais quando não parte das suas conclusões.
4. **Confira cada achado** antes de repassar: abra o `arquivo:linha` e descarte o que não se confirma (regras abaixo).
5. **Conflitos** (só os que o `pr-check` mostrou):
   - **com a `main`, mecânico:** diga a resolução exata (ex.: "manter as duas linhas da tabela", "renumerar a sua seção
     para §14 e ajustar sumário"). Com o ok do autor, você pode resolver na branch dele: `git merge origin/main`, resolver,
     `npm run check`, push. Nunca force push.
   - **com a `main`, de decisão** (os dois lados mudaram o mesmo trecho): mostre os dois lados lado a lado e diga quem
     precisa decidir. Não escolha por conta própria.
   - **com outro PR aberto:** não é defeito deste PR. Sugira a ordem de integração (o menor ou o mais pronto primeiro)
     e diga o que o segundo vai precisar ajustar.
6. **Mostre** o resultado no formato abaixo. Num PR de outra pessoa, só comente no GitHub (`gh pr review`/`gh pr comment`)
   se a pessoa pedir. Aprovar ou integrar passa pelo hook que barra conflito com a `main` e CI vermelho.

## O que bloqueia, o que não bloqueia

| Bloqueia (não integrar ainda) | Corrigir antes, se for barato | Não bloqueia (no máximo uma nota) |
|---|---|---|
| Não funciona: CI vermelho, erro no fluxo que a mudança toca, quebra um passo de `docs/demo.md` | Conflito mecânico com a `main` | Estilo, nomes, formatação |
| Não integra: conflito com a `main` sem resolução, base fora do padrão depois do merge | Falta `Closes #<issue>` ou o "como testar" | Refatoração ou abstração que "seria melhor" |
| Quebra contrato (`docs/contratos.md`) sem ajustar os usos | Texto de interface com termo que o glossário evita | Falta de teste em tela ou dado de demo fixo (Kota) |
| Viola regra do produto: inventar fonte ou responsável, privacidade do §5, chave de API no browser | Doc que ficou desatualizado pela mudança | Duplicação pequena, TODO, código simples demais |
| Segredo ou `.env` commitado | | Coisa fora do escopo do PR que já estava assim |

## Contra falso positivo

- **Todo achado tem evidência** (`arquivo:linha` do diff ou saída de um comando que você rodou) **e um cenário concreto**:
  o que a pessoa faz → o que dá errado. Sem isso, não é achado.
- **Conflito só é o que o `pr-check` mostrou.** "Mexe no mesmo arquivo" não é conflito.
- **Não repita o que os fatos já resolveram** (ex.: "pode ter conflito" quando o `pr-check` diz que integra).
- **"Não verifiquei" não vira problema.** Diga o que não deu para verificar e por quê, separado dos achados.
- **Dúvida sobre a intenção é pergunta ao autor**, não defeito.
- **Sem achados, diga em uma linha.** Não complete a lista para parecer revisão completa.

## Saída

- **Veredito:** `pode integrar` | `pode integrar depois de <ação mecânica>` | `não integrar ainda: <bloqueio>`
- **Fatos:** merge com a `main`, CI, base do sistema (do `pr-check`)
- **Achados** confirmados, do mais grave ao menos grave: `arquivo:linha` · problema · cenário · bloqueia/corrigir antes/nota
- **Conflitos e como resolver** (com a `main` e com outros PRs, e a ordem sugerida de integração)
- **Não verificado** (se houver)
