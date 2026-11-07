# Instruções para agentes

Front da Lousa + servidor da Puca (agente de onboarding por voz). Vite + TypeScript sem framework; servidor Fastify sem estado em `server/`.

- Vocabulário do domínio: [`CONTEXT.md`](CONTEXT.md). Use esses termos no código, nos commits e nas conversas; respeite os `_Avoid_`.
- Visão de produto (cenários, funcionalidades, prioridades do hackathon): [`PRODUCT.md`](PRODUCT.md).
- Formato da jornada: [`docs/journey-format.md`](docs/journey-format.md).
- Como rodar e a estrutura de pastas: [`README.md`](README.md).

## Comandos

```bash
npm run dev          # telas (Vite)
npm run dev:server   # API em :8787 (o Vite repassa /api)
npm run typecheck
npm test             # valida a jornada de demo e o motor
```

Antes de dizer que terminou: `npm run typecheck && npm test`.

## Regras do projeto

- A resposta nunca espera o LLM. Toda fala passa por `src/journey/route.ts`, do caminho mais barato ao mais caro; o LLM é o último.
- A aula (`src/screens/lesson/`) conduz a jornada no browser; o servidor só dá voz e LLM.
- Sem fonte confiável, a Puca diz que não confirmou e encaminha para a buddy. Nunca inventar responsável por um sistema.
- Textos de interface, comentários e docs em português.

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
