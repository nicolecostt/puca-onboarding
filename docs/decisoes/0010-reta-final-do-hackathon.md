# 0010 — Reta final do hackathon: fluxo da demo primeiro, cerimônia mínima

- Data: 2026-11-08 · Quem: Joaquim
- Status: valendo até a submissão (08/11, 13:00)

**Contexto:** sobram 3 h para implementar e 1 h para testar e gravar a demo. Os agentes seguiam o processo completo
(issue para cada lacuna, decisão para cada escolha, `npm run check` a cada passo, perguntas de confirmação, espera no
PR) e não sabiam do prazo.

**Decisão:** até 12:00, só o que faz um passo de `docs/demo.md` funcionar; de 12:00 às 13:00, só correção de bug que
quebra a demo, teste e gravação. O agente decide e segue sem pergunta evitável, usa simulado quando o real não fecha,
corta cerimônia (lacuna vira linha no PR, check completo só antes do PR, `acompanhar-pr` em segundo plano) e para
depois de 15 min travado. Regras em `CLAUDE.md` § Reta final; o hook `scripts/reta-final.sh` (SessionStart e
UserPromptSubmit) mostra o tempo e a fase a cada mensagem. Git seguro, segredos e os guardas de merge continuam.

**Consequências:** vale por cima das skills até a submissão. Depois das 13:00 o hook fica em silêncio; a seção do
`CLAUDE.md` e o hook podem sair num PR de limpeza. O hook só vale depois de reabrir a sessão do Claude Code.
