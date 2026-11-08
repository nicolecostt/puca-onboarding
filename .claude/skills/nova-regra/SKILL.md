---
name: nova-regra
description: Chame automaticamente quando alguém quiser colocar uma regra nova (ou mudar uma) no jeito como os agentes trabalham neste repo — ex.: "a partir de agora…", "sempre que…", "o agente nunca deve…", "coloca no CLAUDE.md", "cria uma skill pra…", "cria um hook que…", "bloqueia o comando X", "libera o comando Y", "o CI tem que pegar…". Escolhe onde a regra vai (CLAUDE.md, skill, hook, permissão, CI), confere duplicidade e contradição, valida e avisa o time. Não use para regra do produto ou termo do glossário (skill contexto-base) nem para escolha técnica do código (docs/decisoes/).
argument-hint: "[a regra, como a pessoa disse]"
---

# Regra nova para os agentes

Regra: $ARGUMENTS

> **Base do sistema:** o glossário do `CONTEXT.md` já está no seu contexto (o `CLAUDE.md` importa); use os termos dele.
> Se a regra contradiz o `PRODUCT.md`, pare e mostre a contradição. Se ela é sobre o produto (o que Puca faz) ou é um termo, use a skill `contexto-base`.

O harness são as regras que todo agente do time segue: `CLAUDE.md` (que o `AGENTS.md` espelha), as skills e o revisor
em `.claude/`, os hooks e as permissões do `.claude/settings.json` e o que o `npm run check` confere no CI.
Quatro pessoas, cada uma com seu agente, sem memória compartilhada: regra que não está no repo não existe para os outros.

## 1. Onde a regra vai

Escolha o lugar **mais leve que resolve**. Texto pede, hook avisa, permissão e CI garantem.
Se a regra já existia escrita e foi quebrada mesmo assim, suba um degrau.

| A regra é… | Vai em |
|---|---|
| Preferência só sua (tom, atalhos, comando liberado só para você) | `CLAUDE.local.md` ou `.claude/settings.local.json` (fora do git). Pare aqui. |
| Sobre o produto, Puca ou um termo | skill `contexto-base` (não aqui) |
| Escolha técnica do código (biblioteca, formato, onde guardar dados) | `docs/decisoes/` (não aqui) |
| Curta e vale em toda tarefa | `CLAUDE.md`: código e produto em **Regras do projeto**; issue, branch, PR e git em **Como trabalhamos** |
| Um procedimento de vários passos que vale numa situação | skill nova ou passo numa skill que já existe, e a linha na tabela de skills do `CLAUDE.md` |
| Tem que acontecer sem depender do agente lembrar (avisar, trazer fatos) | hook no `.claude/settings.json` chamando um script em `scripts/` |
| Não pode acontecer nunca (comando perigoso, ler segredo) | `deny` no `.claude/settings.json`; se precisa de lógica, hook `PreToolUse` que barra com motivo |
| Tem que ser verdade no código antes do merge | teste ou script dentro do `npm run check` (o CI roda em cada PR) |
| A revisão tem que cobrar | skill `revisar` e o subagente `revisor` |

Skills e hooks só existem no Claude Code. Quem usa outro agente (Codex lê o `AGENTS.md`) só recebe o texto do `CLAUDE.md`
e o CI. Se a regra tem que valer para todo mundo, ela precisa de uma linha no `CLAUDE.md` ou de um check no CI, além da skill ou do hook.

## 2. Antes de escrever

1. **Sincronize** (skill `sincronizar`) e veja se algum PR aberto mexe no harness:
   `gh pr list --json number,files --jq '.[] | select(any(.files[].path; test("^(CLAUDE.md|.claude/|scripts/|.github/)"))) | .number'`.
   Se sim, combine com quem abriu e escreva longe dos trechos que o PR muda.
2. **Procure se já existe**: `grep -rn -i "<palavra>" CLAUDE.md .claude/skills .claude/agents .claude/settings.json docs/decisoes scripts`.
   - Já existe: **atualize no lugar**. Nunca deixe duas versões da mesma regra.
   - Contradiz outra regra: mostre as duas para a pessoa e pergunte qual vale. A nova substitui a antiga no texto.
3. **Regra que muda o trabalho dos outros** (quase toda) vira também um arquivo em `docs/decisoes/` (modelo no README de lá).

## 3. Escrever no padrão

- **`CLAUDE.md`:** 1 a 3 linhas, no imperativo, com o porquê quando não for óbvio. Ele entra em toda sessão de todo mundo:
  cada linha custa. Em português. Item numerado na seção certa; não crie seção nova para uma regra só.
- **Skill:** `.claude/skills/<nome>/SKILL.md`, com `name` igual ao nome da pasta e `description` começando por
  "Chame automaticamente quando…", com frases de exemplo e um "Não use para…". Corpo com **Passos** e **Saída**, como as outras.
  Linha nova na tabela "Skills da equipe" do `CLAUDE.md`. Se outra skill deve chamá-la, cite nela (`skill \`<nome>\``).
- **Hook:** script em `scripts/`, chamado como `"$CLAUDE_PROJECT_DIR"/scripts/<nome>.sh`, com `timeout`.
  - Executável no git: `git add --chmod=+x scripts/<nome>.sh`.
  - Rápido, só lê, e nunca derruba a sessão: sai com 0; só sai com 2 (e o motivo no stderr) quando barrar é a intenção.
  - A saída vai para o contexto do agente: só texto que o script controla (números, caminhos), nunca título ou corpo
    de PR/issue de terceiros (veja `scripts/sync-check.sh`).
  - Roda em macOS e Linux com bash, git e perl; `gh` é opcional (sem ele, o script segue sem essa parte).
- **Permissão:** `allow` só para comando que só lê ou que o time inteiro roda sempre; `deny` para o que não pode nunca.
  Nada pessoal no arquivo compartilhado.
- **CI:** teste com `vitest` ao lado do script (`scripts/*.test.ts`) ou um passo novo no `check` do `package.json`.

## 4. Validar

```bash
npm run check:harness   # skills na tabela do CLAUDE.md, name e description, referências entre skills, hooks existem e são executáveis
npm run check           # o que o CI roda
```

- **Hook:** rode o script à mão nos dois casos, o que dispara e o que não dispara, e mostre a saída e o código de saída:
  `echo '{"prompt":"<exemplo>"}' | scripts/<nome>.sh; echo $?` (para `PreToolUse`: `{"tool_input":{"command":"<comando>"}}`).
- **Skill:** numa sessão nova, diga uma das frases de exemplo sem citar a skill e confira se ela foi chamada sozinha.
  Se não deu para testar, diga isso no PR.

## 5. Propagar

1. **Skills e docs que dependem:** a regra muda algum passo de outra skill, do `revisor`, do template de PR ou do `README`? Ajuste no mesmo PR.
2. **Issues:** trabalho que a regra cria e não cabe neste PR vira issue curta (template `tarefa`), citando a atual.
3. **O time:** hook ou permissão nova só vale depois de reabrir a sessão do Claude Code (e aceitar o aviso de confiança do repo). Diga isso no PR.

## 6. Entregar

PR só com a regra e o que foi propagado, título `chore(agents): …` (ou `docs(agents): …` se for só texto). Use a skill `handoff`.

## Saída

- A regra em uma frase e onde entrou (arquivo e seção), e por que ali e não num lugar mais leve
- Regra parecida ou contraditória encontrada, e como ficou
- Validação: `check:harness`, `check` e o teste do hook ou da skill (o que rodou e o resultado)
- Decisão registrada, skills, docs e issues atualizados
