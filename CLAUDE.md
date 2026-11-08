# Instruções para agentes

Front do Orbis + servidor da Puca (agente de onboarding por voz). Vite + TypeScript sem framework; servidor Fastify sem estado em `server/`.

Somos 4 pessoas, cada uma com seu agente, e todo mundo mexe um pouco em tudo. Sessões não compartilham memória:
o que não estiver no código, numa issue, num PR ou nestes docs, os outros agentes não sabem.

- Vocabulário do domínio: [`CONTEXT.md`](CONTEXT.md). Use esses termos no código, nos commits e nas conversas; respeite os `_Avoid_`.
  O glossário inteiro está no fim deste arquivo.
- Visão de produto (cenários, funcionalidades, prioridades do hackathon): [`PRODUCT.md`](PRODUCT.md).
- Formato da jornada: [`docs/journey-format.md`](docs/journey-format.md).
- Como rodar e a estrutura de pastas: [`docs/desenvolvimento.md`](docs/desenvolvimento.md); o produto em poucas linhas: [`README.md`](README.md).
- Contratos entre partes do sistema: [`docs/contratos.md`](docs/contratos.md).
- Decisões técnicas: [`docs/decisoes/`](docs/decisoes/). Stack e guia de implementação: [`docs/stack.md`](docs/stack.md).
- Roteiro e testes da demo: [`docs/demo.md`](docs/demo.md).
- Tarefas: GitHub Issues, por label (`app`, `voz`, `company-brain`, `demo`, `teste`, `negocio`, `acesso`).

## Base do sistema

`PRODUCT.md` (o quê e por quê do produto) e `CONTEXT.md` (o vocabulário) são a base de tudo:

- **Toda tarefa começa pela seção do `PRODUCT.md` que ela toca** (o sumário fica no topo). Se a tarefa contradiz o
  `PRODUCT.md`, pare e mostre a contradição antes de implementar.
- **Todo texto usa os termos do glossário**: código, interface, commits, issues, PRs e docs.
- **Adicionar ou mudar algo nos dois só pela skill `/contexto-base`**: ela diz onde cada coisa vai, segue o modelo,
  valida (`npm run check:contexto`) e leva a mudança para as issues e os docs afetados.
- **Regra nova para os agentes só pela skill `/nova-regra`** ("a partir de agora…", "sempre que…", skill, hook,
  permissão, CI): ela escolhe o lugar mais leve que resolve, evita regra duplicada ou contraditória, valida
  (`npm run check:harness`) e registra a decisão. Preferência só sua vai em `CLAUDE.local.md`.

## Comandos

```bash
npm run dev          # telas (Vite)
npm run dev:fly      # telas usando o servidor do Fly (Claude e voz), sem dev:server nem chaves
npm run dev:server   # API em :8787 (o Vite repassa /api)
npm run typecheck
npm test             # valida a jornada de demo e o motor
npm run check        # typecheck + testes + base do sistema + harness + build (o que o CI roda em cada PR)
npm run check:contexto  # só a base: sumário e âncoras do PRODUCT.md, formato do CONTEXT.md
npm run check:harness   # só o harness: skills na tabela abaixo, revisor, scripts dos hooks executáveis
```

Antes de dizer que terminou: `npm run check` (ou, no mínimo, `npm run typecheck && npm test`). Nunca diga que passou sem ter rodado.

## Prioridade no hackathon

O critério de tudo é a demo: call inicial → jornada → sessão no quadro → verificação de compreensão → primeira tarefa → progresso,
mais uma pergunta que muda o rumo e uma dúvida que vira encaminhamento ([`docs/demo.md`](docs/demo.md)).
Entre polir o que já funciona e fazer um passo desse fluxo funcionar, escolha o fluxo. Label `se-der-tempo` fica por último.

### Reta final (08/11: implementação até 12:00, submissão às 13:00)

O hook `scripts/reta-final.sh` diz a cada mensagem quanto falta e a fase (`[reta-final]`). Até a submissão, estas regras
valem por cima do resto deste arquivo e das skills (decisão 0010). Git seguro, segredos e os guardas de merge continuam.

- **Só o fluxo da demo.** Trabalhe só no que faz um passo de [`docs/demo.md`](docs/demo.md) funcionar ou deixar de quebrar.
  Polimento, refatoração, `se-der-tempo` e doc que não é da demo ficam para depois.
- **Decida e siga.** Sem pergunta que dá para resolver sozinho: escolha o caminho mais simples que funciona e diga no fim
  o que escolheu. Pergunte só se muda o que a demo mostra ou se for destrutivo.
- **Simulado vale.** Se o real (API externa, app, integração) não fecha a tempo, mantenha o fluxo de pé com dado fixo ou
  o simulado que já existe, e diga isso no PR.
- **Cerimônia mínima:** em `comecar-tarefa`, leia só o que a tarefa toca; lacuna fora do escopo vira uma linha no PR, não
  issue (item 4); `docs/decisoes/` só se mudar a stack; no meio do trabalho, `npm run typecheck` e o teste do que mudou,
  `npm run check` só antes do PR; `acompanhar-pr` em segundo plano, sem travar a próxima tarefa.
- **Travou 15 min no mesmo problema?** Pare, diga o que tentou e proponha cortar ou simular.
- **Paralelize** tarefas independentes (subagentes, `claude -w <nome>`). Respostas curtas: o que mudou, o que rodou, o que falta.
- **Depois das 12:00:** nada de feature; só correção de bug que quebra a demo e a skill `checar-demo` depois de cada merge.

## Regras do projeto

- A resposta nunca espera o LLM. Toda fala passa por `src/journey/route.ts`, do caminho mais barato ao mais caro; o LLM é o último.
- A sessão (`src/screens/lesson/`) conduz a jornada no app; o servidor dá voz, LLM e as ações nos sistemas da Kota
  (Slack, GitHub), sem guardar estado de sessão: o que precisa durar vai para o Supabase ([`docs/stack.md`](docs/stack.md) §5).
- Telas rodam no app para Mac (Electron, decisões 0004 e 0008). A `live-session` é a casa do navegador da Puca, que fica
  por cima do HTML: barra de call, chat e câmera vão **em volta** da área dele, nunca por cima (vale para o navegador
  de verdade; o Slack simulado de hoje continua com os controles por cima e não sai). Recurso do app só com
  `window.orbis`, depois de o formato estar em `docs/contratos.md`; sem ele (`npm run dev` no navegador), a tela segue
  com o simulado ([`docs/stack.md`](docs/stack.md) §3.2 e §4.2).
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
   - **Faltou algo ou ficou dúvida? Vira issue nova.** Resolvendo uma issue, achou algo faltando (dado, tela, contrato,
     doc, teste), algo que você não tem certeza de como deve ser, ou algo que sobra (código morto, duplicado)? Não
     resolva por fora do escopo nem deixe só na conversa: crie uma issue curta (template `tarefa`, label da área), cite a
     atual (`Relacionada a #<n>`) e diga no PR quais issues abriu. Antes, veja se já não existe uma (`gh issue list --search`).
     Se a dúvida trava a issue atual, pergunte à pessoa em vez de supor.
5. **Contratos** ([`docs/contratos.md`](docs/contratos.md)): formato novo ou alterado entra no doc antes de implementar
   os dois lados; quebra de compatibilidade vai marcada no PR.
6. **Decisão que afeta os outros** vira um arquivo em `docs/decisoes/`. Conversa do dia a dia não vira documento.
7. **Git seguro:** sem `push --force`, `reset --hard`, `checkout -- .` ou `clean` sem a pessoa pedir; não descarte
   alteração não commitada que você não fez. Nunca commite `.env`, chaves de API, `sandbox/` ou `dist/`.
8. **Revisão e merge de PR** seguem a skill `revisar`: a pergunta é "dá para integrar sem quebrar nada nem atrapalhar
   ninguém?", e só conta problema com evidência e cenário concreto. `scripts/pr-check.sh <n>` dá os fatos (merge com a
   `main`, conflitos reais com outros PRs e se são mecânicos, CI, base depois do merge). Hooks: pedido de revisão traz
   esses fatos sozinho; `gh pr merge` e aprovar são barrados com conflito com a `main`, CI vermelho ou base quebrada.
9. **PR aberto é PR acompanhado** (skill `acompanhar-pr`): quem abre o PR fica de olho no CI, nos comentários e no merge
   com a `main` e resolve cada item (corrige, responde com o motivo, abre issue ou pergunta à pessoa) até o PR ficar
   pronto para integrar. Pronto não é integrar: só integre se a pessoa pedir.
10. **Material que não é código** (negócio, pitch, TAM/SAM/SOM, ferramentas da submissão) vai em `docs/negocio/`.

## Skills da equipe: chame sozinho, ninguém vai pedir

As pessoas **não** digitam `/nome`. Quando a situação aparecer, **chame a skill com a ferramenta Skill antes de agir**.
Não faça o procedimento de memória nem leia o `SKILL.md` com `cat`: chamar a skill é o que garante o passo a passo.
Mais de uma situação ao mesmo tempo? Chame na ordem da tabela.

| Situação (exemplos do que a pessoa fala) | Skill |
|---|---|
| Vai editar, commitar ou abrir PR; apareceu `[sync]`; "alguém mexeu na main?" | `sincronizar` |
| Começar ou retomar trabalho: "pega a issue 17", "bora fazer X", "implementa Y", "continua" | `comecar-tarefa` |
| Algo entra ou muda no `PRODUCT.md`/`CONTEXT.md`: "anota no PRODUCT", "novo insight", "alinhamos que…", termo novo | `contexto-base` |
| Regra nova para os agentes: "a partir de agora…", "sempre que…", "coloca no CLAUDE.md", "cria um hook/skill", "bloqueia X" | `nova-regra` |
| Mudar um formato que outra parte usa: campo de API, tipo, evento, payload | `contrato` |
| Criar ou editar sessão/jornada (`*.journey.json`) | `nova-jornada` |
| Criar tela ou componente | `nova-tela` |
| "Revisa", "tá bom pra subir?", "pode aprovar?", "dá pra mergear?", revisar PR de alguém | `revisar` (usa o subagente `revisor`) |
| Acabou de abrir um PR (apareceu `[pr]`); "acompanha o PR", "tem comentário no PR?", "resolve os comentários" | `acompanhar-pr` |
| "Terminei", "pronto", "pode subir", "abre o PR" | `handoff` |
| "A demo funciona?", antes de apresentar, depois de merges | `checar-demo` |

A pessoa também pode chamar qualquer uma com `/nome`.
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
