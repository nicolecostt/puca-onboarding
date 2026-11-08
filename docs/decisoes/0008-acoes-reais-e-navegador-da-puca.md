# 0008 — Navegador do Puca e ações reais no Slack da Kota

- Data: 2026-11-08 · Quem: Joaquim
- Status: valendo

**Contexto:** o computer use é a aposta de diferencial, e o Puca precisa agir num sistema de verdade (`PRODUCT.md`
§12.2). A pergunta era se agir dentro de um navegador tira a interatividade: a pessoa interromper, conversar e mexer
junto. A decisão 0005 deixou para a #13 se o Puca age no Slack real da Kota e se ele substitui o simulado.

**Decisão:**

- O computer use acontece no **navegador do Puca**, uma área da janela do Orbis com GitHub, Notion e Slack da Kota na
  versão web, controlada pelo protocolo de depuração do Chromium (`webContents.debugger`).
- Puca **desenha por cima da página** (cursor, círculo, seta, marca-texto, cartão com imagem), **age** (abre, clica,
  rola, preenche) e **percebe a pessoa** (cliques e navegação). Provado em 2026-11-08 no `kota-bank`.
- As ações seguem a fala e a jornada, em passos curtos, numa **fila que para quando a pessoa fala por cima**. Não é um
  agente autônomo clicando sozinho. Três modos: mostrar, apontar e acompanhar.
- **Guarda em código:** o navegador do Puca só abre o mundo da Kota; ação que publica algo pede confirmação; Puca
  nunca digita senha.
- O **encaminhamento sai no Slack real da Kota**, enviado pelo servidor com o bot da Kota, como **mensagem direta ao
  próprio jurado**, dizendo a quem iria na Kota. Nunca num canal: todos os jurados entram no mesmo workspace, e a dúvida
  de um (às vezes um caso pessoal) não pode aparecer para os outros. O app abre a mensagem no navegador do Puca e
  aponta para ela.
- O **Slack simulado da `live-session` fica**: no `npm run dev` sem servidor, como plano B quando o servidor ou o
  Slack falham, e na aprovação do gestor (primeira tarefa e pedido de acesso), que no Slack real exigiria botão
  interativo, fora do MVP.
- **Sem MCP na hora da sessão:** o conhecimento vem de cópias locais do kit e as ações são poucas e fixas.

Desenho completo: [`docs/stack.md`](../stack.md) §4 e §10.

**Consequências:**

- A regra "o servidor só dá voz e LLM" (`CLAUDE.md`) passa a ser "voz, LLM e as ações nos sistemas da Kota" (skill
  `nova-regra`). A §12.2 do `PRODUCT.md` muda para o Slack real (skill `contexto-base`).
- Contratos novos ou alterados antes de implementar (skill `contrato`): "Computer use" (`AcaoDaPuca`,
  `AcaoDaPessoa`, `window.orbis`) e "Encaminhamento" (`POST /api/encaminhamentos` com `id` para não duplicar,
  destinos buddy, gestor e RH).
- `SLACK_BOT_TOKEN` no servidor; o bot com escopos mínimos (`chat:write`, `chat:write.customize`, `im:write`, `users:read`,
  `users:read.email`; `channels:manage` só para o script que preenche os canais, #118).
- Apps nativos (Slack desktop, editor, terminal) e ver a tela por print ficam fora do MVP.
- `npm run dev` no navegador comum continua com o computer use simulado.
- Telas: a `live-session` reserva a área do navegador do Puca, com barra de call, chat e câmera em volta e nunca por
  cima (regra no `CLAUDE.md`, cobrada pela skill `nova-tela` e pelo `revisor`).
