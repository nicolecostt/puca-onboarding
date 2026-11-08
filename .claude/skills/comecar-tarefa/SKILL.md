---
name: comecar-tarefa
description: Chame automaticamente, antes de qualquer edição, sempre que a pessoa for começar ou retomar um trabalho neste repo — ex.: "pega a issue 17", "bora fazer X", "vou mexer em Y", "continua de onde parei", "implementa Z". Lê a issue e a base do sistema, confere quem está atribuído, cria a branch e fecha o escopo. Não use para perguntas rápidas que não mudam arquivos.
argument-hint: "[descrição da tarefa ou número da issue]"
---

# Começar uma tarefa

Tarefa: $ARGUMENTS

> **Base do sistema:** o glossário do `CONTEXT.md` já está no seu contexto (o `CLAUDE.md` importa); use os termos dele.
> Toda tarefa começa pela seção do `PRODUCT.md` que ela toca (passo 3). Se o pedido contradiz o `PRODUCT.md`, pare e mostre a contradição. Se algo novo precisa entrar na base, use a skill `contexto-base`.

## Passos

0. **Sincronize primeiro** (skill `sincronizar`): `git fetch`, traga a `main` e veja se alguém mudou os arquivos
   que você vai mexer. Faça isso também ao retomar uma tarefa antiga.
1. **A issue.** Com número: `gh issue view <n>`. Sem número: procure uma (`gh issue list --search "<palavras>"`);
   se não houver, proponha criar uma curta com o template `tarefa`. Se já tiver outra pessoa atribuída, pare e avise.
   Sem critério de aceite claro, escreva um de 1–3 linhas, confirme com a pessoa e coloque na issue.
   Com o ok, atribua: `gh issue edit <n> --add-assignee @me`.
2. **Estado do git.** `git status -sb` e `git fetch`. Se houver alteração não commitada que não é sua, não mexa: pergunte.
   Crie a branch a partir da `main` atualizada: `git switch -c tipo/<n>-assunto-curto origin/main`.
   Se for retomar, leia `git log --oneline -10`, a issue e o PR aberto da branch (`gh pr view`) antes de qualquer coisa.
   Se a branch já tem PR aberto e falta só levá-lo até integrar, siga pela skill `acompanhar-pr`.
3. **Base do sistema e contexto mínimo.** Leia o **sumário** do `PRODUCT.md` e a(s) seção(ões) que a tarefa toca
   (cenário, funcionalidade, prioridade ou limite do hackathon). Confira se a issue bate com elas. Depois, só o que a tarefa toca:
   - tela ou componente → o `main.ts`/`.ts` dele e a seção de `docs/desenvolvimento.md`;
   - jornada ou sessão → `docs/journey-format.md` (e use a skill `nova-jornada`);
   - voz ou servidor → `src/voice/`, `server/src/app.ts`, `server/src/agent/turn.ts` e a regra "a sessão nunca fica muda" (decisão 0010);
   - decisões já tomadas → títulos em `docs/decisoes/`.
4. **Conflito com o time.** `gh pr list` e veja se algum PR aberto mexe nos mesmos arquivos. Se sim, avise antes de editar.
5. **Contratos.** Confira em `docs/contratos.md` se a tarefa muda ou cria algum (inclusive os "que vão surgir").
   Se sim, siga a skill `contrato` antes de implementar.
6. **Issue de decisão** (label `decisao`): o resultado principal é um arquivo em `docs/decisoes/` com as opções
   comparadas e a escolha; código só depois, se a issue pedir.

## Saída (curta, antes de editar)

- Issue, objetivo e critério de aceite
- Seções do `PRODUCT.md` que valem para a tarefa (ex.: §4.5, §12.2) e termos do glossário envolvidos
- Branch
- Arquivos que vai mexer (e os que **não** vai)
- Contratos afetados: nenhum | quais
- Como vai verificar (comando + tela/endereço)

Depois, implemente dentro desse escopo e termine com `npm run check`. Quando a tarefa terminar, chame a skill `handoff`.
