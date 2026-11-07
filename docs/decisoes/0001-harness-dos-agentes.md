# 0001 — Harness dos agentes no repositório

- Data: 2026-11-07 · Quem: Joaquim
- Status: valendo

**Contexto:** quatro pessoas, cada uma com seu agente de programação, no mesmo repo durante o hackathon.
As sessões não compartilham memória, e o `.claude/` estava inteiro no `.gitignore`.

**Decisão:** o repositório é a fonte de verdade para os agentes. Regras em `CLAUDE.md`, com `AGENTS.md` como
link para ele (assim Codex e outros agentes leem o mesmo arquivo). Skills da equipe em `.claude/skills/`, um revisor em `.claude/agents/` e as
permissões comuns em `.claude/settings.json` passam a ser versionados. Coisas pessoais continuam fora do git
(`.claude/settings.local.json`, `CLAUDE.local.md`). `npm run check` é a régua de pronto e roda no CI em cada PR.
Nada de servidor ou memória compartilhada só para coordenar os agentes: o que precisa ser compartilhado vai para
commit, issue, PR ou `docs/`. Para não trabalhar em cima de código velho, `scripts/sync-check.sh` avisa quando a
`main` andou ou quando outra pessoa mexe nos mesmos arquivos, e a skill `sincronizar` traz as mudanças.

Tarefas ficam em GitHub Issues, com labels por frente. Não há dono fixo por área (todo mundo faz um pouco de tudo):
quem pega uma issue se atribui, e a branch e o PR levam o número dela.

**Consequências:** quem clona o repo já recebe as skills. Skill nova só quando um procedimento se repetir.
Mudança em contrato segue `docs/contratos.md`. Framework, banco ou serviço novo só depois de uma decisão registrada aqui.
