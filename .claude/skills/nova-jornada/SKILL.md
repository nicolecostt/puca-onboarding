---
name: nova-jornada
description: Use para criar ou editar uma jornada da aula no quadro (arquivos src/journey/data/*.journey.json) — momentos, passos, falas, quadro, nós, setas, transições, perguntas e conhecimento. Não use para mudar o motor ou o formato em si (isso é a skill contrato).
argument-hint: "[assunto da aula ou o que mudar na jornada]"
---

# Criar ou editar uma jornada

Pedido: $ARGUMENTS

> **Base do sistema:** o glossário do `CONTEXT.md` já está no seu contexto (o `CLAUDE.md` importa); use os termos dele.
> Uma jornada é conteúdo de produto: leia no `PRODUCT.md` a aula (§4.1–4.3), os perfis (§7) e o que a demo precisa mostrar. Falas, títulos e `goal` usam os termos do glossário (momento, passo, nó, fonte, encaminhamento). Se o pedido contradiz o `PRODUCT.md`, pare e mostre a contradição. Se algo novo precisa entrar na base, use a skill `contexto-base`.

O formato completo está em `docs/journey-format.md`. Leia antes de escrever. Use `src/journey/data/tail.journey.json`
como exemplo do que já funciona.

## Passos

1. **Esboce antes do JSON:** a lista de momentos (título + `goal` único de cada um), o que o quadro mostra em cada um
   e onde a pessoa responde (`wait`) ou toca num nó (`select`). Confirme o esboço com a pessoa.
2. **Escreva o quadro** (`boards`): nós com `id`, `label`, `x`, `y` (quadro de 1440 × 844) e `kind`; arestas com `from`/`to`.
3. **Escreva os momentos e passos.** `line` é orientação de fala, não texto decorado. Use `{nome}`, `{time}`, `{gestor}`
   para personalizar. Coloque o que a Puca só diz se perguntarem em `knowledge`.
4. **Valide.** O teste valida só a demo. Para um arquivo novo, valide assim:
   ```bash
   npx vitest run src/journey   # demo continua válida
   ```
   e adicione um caso em `src/journey/__tests__/validate.test.ts` que importa o arquivo novo e espera `errorsOf(...)` igual a `[]`.
5. **Veja rodando.** A tela `src/screens/lesson/main.ts` importa `tail.journey.json` direto. Para ver outra jornada,
   troque o import localmente ou combine com o time como escolher a jornada (isso muda contrato: skill `contrato`).
   Abra `/src/screens/lesson/?perfil=ana&auto=1` e `?perfil=bruno&auto=1`.

## Armadilhas (o validador recusa)

- `goal` repetido entre momentos, ou entre passos do mesmo momento.
- O primeiro momento sem `view`; ação de quadro em momento sem quadro.
- Ação, `expect` ou `flow` citando nó ou aresta que não existe no quadro em vigor (lembre: momento sem `view` herda o quadro anterior).
- `if.reply` que não está nas `suggested_replies` do passo.
- Passo `wait` sem pergunta e sem `suggested_replies`; passo `select` sem `expect` completo.
- `{ "step": … }` só aponta para passo do mesmo momento.

Regra do produto: sem fonte confirmada, use `owner_confirmed: false`. A Puca não inventa responsável.
