# 0003 — Regra nova para os agentes entra pela skill `nova-regra`

- Data: 2026-11-07 · Quem: Joaquim
- Status: valendo

**Contexto:** as regras dos agentes estão espalhadas entre `CLAUDE.md`, skills, o revisor, hooks, permissões e o CI
([0001](0001-harness-dos-agentes.md)). Cada pessoa punha regra nova onde achava melhor, e nada conferia se o conjunto
continuava coerente: skill fora da tabela do `CLAUDE.md` não é chamada sozinha, e script de hook sem bit de execução
no git não roda na máquina dos outros.

**Decisão:** regra nova (ou mudança de regra) para os agentes passa pela skill `nova-regra`. Ela escolhe o lugar mais
leve que resolve (texto no `CLAUDE.md` → skill → hook → permissão ou CI; texto pede, hook avisa, permissão e CI
garantem), procura regra igual ou contraditória antes de escrever, segue o padrão de cada lugar e registra a decisão
quando muda o trabalho dos outros. Regra do produto e termos continuam na `contexto-base`; preferência pessoal fica em
`CLAUDE.local.md` ou `.claude/settings.local.json`. `npm run check` (e o CI) roda `scripts/check-harness.ts`, que confere
`name` e `description` das skills e do revisor, a tabela de skills do `CLAUDE.md`, as referências entre skills e se os
scripts chamados pelos hooks existem e são executáveis no git.

**Consequências:** skill nova sem linha na tabela do `CLAUDE.md`, skill citada que não existe ou hook apontando para um
script ausente ou sem `+x` quebram o check. Hook ou permissão nova só vale depois de reabrir a sessão do Claude Code.
Quem usa outro agente (Codex pelo `AGENTS.md`) não recebe skills nem hooks: regra que precisa valer para todos tem uma
linha no `CLAUDE.md` ou um check no CI.
