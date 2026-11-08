# 0007 — O LLM de Puca é o Claude Haiku 5.5, sem raciocínio

- Data: 2026-11-08 · Quem: Joaquim
- Status: valendo

**Contexto:** Puca usava o Qwen3-32B pela Featherless. O encaminhamento depende de o modelo chamar a ferramenta
`escalate_to_buddy`, e a fala depende de a primeira frase sair rápido. O plano Basic da Featherless aceita 2
conexões ao mesmo tempo, e o modelo não enxerga imagem.

**Decisão:**

- O `/api/ask` passa a usar o **Claude Haiku 5.5** (`claude-haiku-5-5`) com o raciocínio desligado
  (`thinking: { type: "disabled" }`, esforço `medium`), pelo **SDK oficial** (`@anthropic-ai/sdk`), atrás da mesma
  interface de eventos de `server/src/llm.ts`.
- Medição de 2026-11-08 (mesmos cenários, prompt e ferramentas do `bench:llm`, 15 amostras por braço):

  | | 1ª frase p50 / p95 | Ferramenta certa |
  |---|---|---|
  | Claude Haiku 5.5 sem raciocínio | 817 / 1.085 ms | 10/10 |
  | Claude Haiku 5.5 com raciocínio (esforço baixo) | 3.196 / 3.931 ms | 10/10 |
  | Qwen3-32B sem raciocínio | 1.101 / 11.153 ms | 0/10 |

  O Qwen3-32B dizia que ia encaminhar, mas nunca chamou a ferramenta.
- Cache de prompt na parte fixa (instruções, ferramentas, jornada) e aquecimento no início da sessão.
- A correção da checagem de entendimento usa o mesmo modelo, numa chamada separada.

Detalhes: [`docs/stack.md`](../stack.md) §7.

**Consequências:**

- `ANTHROPIC_API_KEY` no servidor. `FEATHERLESS_API_KEY`, `FEATHERLESS_BASE_URL` e `LLM_MODEL` saem quando o cliente
  novo estiver na `main`.
- O `bench:llm` ganha `--provider anthropic|featherless`; os cenários passam para a jornada da Kota com a #120.
- O raciocínio fica desligado no caminho da voz: ligado, a primeira frase passou de 3 s.
- Timeout de 8 s, erro do modelo, `stop_reason: "refusal"` e resposta vazia **não viram encaminhamento**. Puca diz
  uma frase curta de falha, diferente da de falta de fonte (que manda perguntar à buddy), como "Tive um problema para
  pensar nisso agora. Pode perguntar de novo?", e o rastro guarda o motivo da falha (campo novo no contrato do Rastro,
  #85). Encaminhamento é só para falta de fonte confiável: falha do LLM não é falta de fonte, e no Slack real da Kota
  viraria uma mensagem falsa. Na trava diária do LLM vale o mesmo para o que iria ao LLM; as rotas locais da
  `route.ts` (`faq`, `tarefa`) continuam encaminhando como hoje. (Ajuste de 2026-11-08, #85.)
- O modelo enxerga imagem, o que deixa aberto o computer use com visão sem trocar de modelo.
