# Instruções para agentes

Front da Lousa + servidor da Puca (agente de onboarding por voz). Vite + TypeScript sem framework; servidor Fastify sem estado em `server/`.

Somos 4 pessoas, cada uma com seu agente, e todo mundo mexe um pouco em tudo. Sessões não compartilham memória:
o que não estiver no código, numa issue, num PR ou nestes docs, os outros agentes não sabem.

- Vocabulário do domínio: [`CONTEXT.md`](CONTEXT.md). Use esses termos no código, nos commits e nas conversas; respeite os `_Avoid_`.
  O glossário inteiro está no fim deste arquivo.
- Visão de produto (cenários, funcionalidades, prioridades do hackathon): [`PRODUCT.md`](PRODUCT.md).
- Formato da jornada: [`docs/journey-format.md`](docs/journey-format.md).
- Como rodar e a estrutura de pastas: [`README.md`](README.md).
- Contratos entre partes do sistema: [`docs/contratos.md`](docs/contratos.md).
- Decisões técnicas: [`docs/decisoes/`](docs/decisoes/).
- Roteiro e testes da demo: [`docs/demo.md`](docs/demo.md).
- Tarefas: GitHub Issues, por label (`app`, `voz`, `company-brain`, `demo`, `teste`, `negocio`, `acesso`).

## Base do sistema

`PRODUCT.md` (o quê e por quê do produto) e `CONTEXT.md` (o vocabulário) são a base de tudo:

- **Toda tarefa começa pela seção do `PRODUCT.md` que ela toca** (o sumário fica no topo). Se a tarefa contradiz o
  `PRODUCT.md`, pare e mostre a contradição antes de implementar.
- **Todo texto usa os termos do glossário**: código, interface, commits, issues, PRs e docs.
- **Adicionar ou mudar algo nos dois só pela skill `/contexto-base`**: ela diz onde cada coisa vai, segue o modelo,
  valida (`npm run check:contexto`) e leva a mudança para as issues e os docs afetados.

## Comandos

```bash
npm run dev          # telas (Vite)
npm run dev:server   # API em :8787 (o Vite repassa /api)
npm run typecheck
npm test             # valida a jornada de demo e o motor
npm run check        # typecheck + testes + base do sistema + build (o que o CI roda em cada PR)
npm run check:contexto  # só a base: sumário e âncoras do PRODUCT.md, formato do CONTEXT.md
```

Antes de dizer que terminou: `npm run check` (ou, no mínimo, `npm run typecheck && npm test`). Nunca diga que passou sem ter rodado.

## Prioridade no hackathon

O critério de tudo é a demo: call inicial → jornada → aula no quadro → verificação de compreensão → primeira tarefa → progresso,
mais uma pergunta que muda o rumo e uma dúvida que vira encaminhamento ([`docs/demo.md`](docs/demo.md)).
Entre polir o que já funciona e fazer um passo desse fluxo funcionar, escolha o fluxo. Label `se-der-tempo` fica por último.

## Regras do projeto

- A resposta nunca espera o LLM. Toda fala passa por `src/journey/route.ts`, do caminho mais barato ao mais caro; o LLM é o último.
- A aula (`src/screens/lesson/`) conduz a jornada no browser; o servidor só dá voz e LLM.
- Sem fonte confiável, a Puca diz que não confirmou e encaminha para a buddy. Nunca inventar responsável por um sistema.
- Textos de interface, comentários e docs em português.
- Framework, banco, serviço externo ou mudança de stack: registre a decisão em `docs/decisoes/` antes de implementar.

## Como trabalhamos

1. **Pegue uma issue e se atribua antes de começar** (`gh issue edit <n> --add-assignee @me`). Issue com outra pessoa
   atribuída: combine antes de mexer. Trabalho sem issue? Crie uma curta primeiro.
2. **Uma issue = uma branch = um PR.** Nada direto na `main`. Branch `tipo/<n>-assunto-curto`; no PR, `Closes #<n>`.
3. **Sempre sincronize antes de mexer** (skill `/sincronizar`): antes de editar, de commitar e de abrir PR, traga a
   `main` e veja se alguém mudou (na `main` ou num PR aberto) os arquivos que você está mexendo. Um hook roda
   `scripts/sync-check.sh` a cada mensagem e avisa com `[sync]`: quando aparecer, pare e sincronize antes de seguir.
4. **Escopo pequeno, merge cedo.** Não reformate nem "melhore" o que a issue não pede.
5. **Contratos** ([`docs/contratos.md`](docs/contratos.md)): formato novo ou alterado entra no doc antes de implementar
   os dois lados; quebra de compatibilidade vai marcada no PR.
6. **Decisão que afeta os outros** vira um arquivo em `docs/decisoes/`. Conversa do dia a dia não vira documento.
7. **Git seguro:** sem `push --force`, `reset --hard`, `checkout -- .` ou `clean` sem a pessoa pedir; não descarte
   alteração não commitada que você não fez. Nunca commite `.env`, chaves de API, `sandbox/` ou `dist/`.
8. **Material que não é código** (negócio, pitch, TAM/SAM/SOM, ferramentas da submissão) vai em `docs/negocio/`.

## Skills da equipe (Claude Code)

Em `.claude/skills/`, chame com `/nome`: `/sincronizar` (antes de tudo), `/comecar-tarefa` (início ou retomada),
`/contexto-base` (mudar `PRODUCT.md` ou `CONTEXT.md`), `/nova-tela`, `/nova-jornada`,
`/contrato`, `/revisar` (usa o subagente `revisor`), `/handoff` (check + PR; só roda quando você chama) e `/checar-demo`.
Duas sessões na mesma máquina: `claude -w <nome-da-tarefa>` cria um worktree separado.
Preferências pessoais: `CLAUDE.local.md` ou `.claude/settings.local.json` (fora do git).

## Commits

Formato: `tipo(escopo): mensagem`

- `tipo`: `feat`, `fix`, `style`, `refactor`, `docs`, `test`, `chore`, `perf`.
- `escopo`: a parte tocada, em kebab-case: componente, tela ou módulo (`voice`, `journey`, `lesson`, `call-bar`, `server`…).
- `mensagem`: em português, minúscula, curta, dizendo o que muda para quem usa. Sem ponto final.

Exemplos:

```
fix(voice): arruma respostas
feat(journey): pelo chat, a pessoa pode pedir para mudar de assunto
style(call-bar): status numa pílula branca
docs(context): glossário do domínio em CONTEXT.md
```

**Nunca** adicione `Co-Authored-By`, "Generated with Claude Code" ou qualquer outra linha de coautoria/atribuição, nem em commits nem em PRs.

## Glossário (CONTEXT.md)

Importado para estar sempre no contexto. Para mudar, use `/contexto-base`.

@CONTEXT.md
