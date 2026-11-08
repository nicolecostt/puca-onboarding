# Formato da jornada

A aula no quadro é conduzida por uma **jornada** em JSON (`src/journey/data/*.journey.json`).
O modelo segue a ideia de jornadas usada em agentes de demonstração por voz:
**momentos** (capítulos) feitos de **passos** (cada fala ou ação do agente). A diferença do Puca é
uma vista nova, o **quadro**, que o agente monta enquanto explica.

Tipos: [`src/journey/types.ts`](../src/journey/types.ts). Validação: [`src/journey/validate.ts`](../src/journey/validate.ts).
Jornada de exemplo: [`tail.journey.json`](../src/journey/data/tail.journey.json).

## Estrutura

```jsonc
{
  "version": 1,
  "id": "tail-terminais",
  "title": "Primeira semana — time fraud-score",
  "company": "Tail",
  "agent": { "name": "Puca", "guidelines": { "core_identity": "…", "personality_and_tone": "…", "safety_and_escalation": "…" } },
  "boards": { "<nome>": { "title": "…", "nodes": [ … ], "edges": [ … ] } },
  "moments": [ … ]
}
```

| Campo | Para quê |
|---|---|
| `agent.guidelines` | Três instruções sempre ativas: quem o agente é, como fala e quando encaminhar para uma pessoa. Hoje só documentam o tom; viram prompt de sistema quando um LLM conduzir a aula. |
| `boards` | Os quadros, declarados uma vez. Todos os nós começam ocultos e aparecem pelas ações dos passos. |
| `moments` | A aula, na ordem. Sem transição explícita, um momento segue para o próximo. |

## Quadro

```jsonc
{ "id": "fraud-score", "label": "fraud-score", "sublabel": "seu time", "kind": "service", "x": 780, "y": 160,
  "info": { "role": "…", "team": "{time}", "owner": "{gestor}", "owner_confirmed": true,
            "docs": [{ "title": "Notion · Visão do fraud-score" }],
            "adr": { "id": "ADR-012", "title": "…", "summary": "…", "owner": "…" },
            "bullets": ["…"] } }
```

- `x`, `y` são o centro do nó no quadro, que tem **1440 × 844** (o tamanho do Figma).
- `kind` diz o que o nó é: `frontend`, `service`, `db`, `external`, `queue`, `person`, `team`, `value`, `doc`, `task`. No quadro, `queue` vira pílula azul; o resto, caixa desenhada.
- Opcionais de desenho: `w` (largura; sem ela, sai do tamanho do rótulo), `look` (`"blackbox"` = caixa preta tracejada, `"dlq"` = fila de erro vermelha), `note` (selo embaixo do nó). O rótulo aceita `\n` para quebrar linha.
- `info` alimenta o **cartão do nó** (§4.3): função, time, responsável, fontes e ADR.
- `owner_confirmed: false` faz o cartão dizer que não há responsável confirmado e indicar a buddy. É a regra de não inventar quem cuida de um sistema.
- Arestas: `{ "id", "from", "to", "label"? }`. Ids de nós e arestas não podem se repetir no mesmo quadro.
  Opcionais: `style` (`"inferred"` tracejada cinza, `"retry"` tracejada vermelha), `path`/`head` (desenho exato da linha e da ponta em SVG; sem eles, a seta é calculada), `label_at` e `label_font` (`"hand"` ou `"mono"`), `evidence` (`{ "kind": "proven" | "inferred", "x", "y" }`: selo "✓ provado" ou "inferido").
- No quadro: `upcoming` (ids que já aparecem apagados desde o começo, como "ainda não explicado") e `labels` (textos soltos `{ "id", "text", "x", "y" }`).
- Textos aceitam `{nome}`, `{time}`, `{gestor}`, `{cargo}`…, preenchidos com o perfil da pessoa.

## Momento

| Campo | Para quê |
|---|---|
| `id`, `title` | `title` aparece no topo da tela ("Aula · Fluxo de pagamento"). |
| `goal` | O que o momento quer alcançar. O agente não fala isso. **Não pode repetir** entre momentos. |
| `view` | `{ "mode": "logo" }` ou `{ "mode": "board", "board": "<nome>" }`. Um momento **com** `view` recomeça o quadro do zero; **sem** `view`, herda o quadro do momento anterior no estado em que ficou. |
| `knowledge` | Contexto extra que o agente só usa se perguntarem (ver "Perguntas e pulos"). |
| `steps` | Ao menos um passo. |

## Passo

| Campo | Para quê |
|---|---|
| `goal` | O que o passo quer alcançar (não é falado; não pode repetir dentro do momento). |
| `line` | O que o agente fala. É uma orientação, não um texto decorado: com um LLM, a Puca adapta as palavras à conversa. |
| `highlight` | Trecho da fala que fica destacado em amarelo na legenda. |
| `knowledge` | Contexto extra do passo, como o do momento. |
| `actions` | Ações no quadro: antes da fala, ou no trecho marcado em `at` (tabela abaixo). |
| `decision` | `auto` (padrão: segue sozinho), `wait` (espera resposta) ou `select` (espera um toque num nó). |
| `suggested_replies` | Botões de resposta para passos `wait`. O texto livre do chat é comparado com eles por palavras-chave. |
| `expect` | Para `select`: `{ nodes, on_correct, on_wrong, retries?, on_reveal? }`. Errou: fala `on_wrong` e deixa tentar de novo; esgotou as tentativas: destaca a resposta e fala `on_reveal`. |
| `transitions` | Para onde ir depois do passo (abaixo). |

Um passo `wait` precisa terminar em pergunta ou ter `suggested_replies`, senão a pessoa fica sem saber que é a vez dela.

### Ações no quadro

| Ação | Efeito |
|---|---|
| `{ "type": "reveal", "targets": [ids] }` | Nós aparecem; arestas se desenham. |
| `{ "type": "highlight", "targets": [ids], "tone": "focus" \| "warn" \| "ok" }` | Destaca e esmaece o resto. |
| `{ "type": "clear_highlight" }` | Volta tudo ao normal. |
| `{ "type": "focus", "target": id \| null }` | Anel amarelo no nó que a Puca está explicando; `null` tira. |
| `{ "type": "flow", "path": [ids de arestas] }` | Um pulso percorre o caminho. |
| `{ "type": "card", "target": id }` / `{ "type": "close_card" }` | Abre ou fecha o cartão do nó. |
| `{ "type": "reset" }` | Esconde tudo. |

Qualquer ação aceita `at`: um trecho da `line` do passo. A ação acontece quando a Puca chega nesse trecho da fala,
para o quadro acompanhar a explicação; sem `at`, ela acontece antes da fala. O trecho precisa estar na `line`.

```jsonc
"line": "Os valores são três: cliente no centro, dono do problema e simples primeiro.",
"actions": [
  { "type": "reveal", "targets": ["valor-cliente"], "at": "cliente no centro" },
  { "type": "reveal", "targets": ["valor-dono"], "at": "dono do problema" },
  { "type": "reveal", "targets": ["valor-simples"], "at": "simples primeiro" }
]
```

### Transições

```jsonc
"transitions": [
  { "to": { "moment": "falha" }, "when": "a pessoa quer entender a falha", "if": { "reply": "E se o pagamento falhar?" } },
  { "to": { "step": "bv-transicao" }, "if": { "profile": "vinculo", "eq": "transicao" } },
  { "to": { "moment": "checagem" } }
]
```

- Vale a **primeira** transição cuja condição for verdadeira; sem `if`, ela sempre vale.
- Sem nenhuma transição válida, o passo segue para o próximo passo e, no fim do momento, para o próximo momento.
- `{ "step": … }` só aponta para passos do mesmo momento. `{ "moment": … }` sempre entra pelo **primeiro passo** do momento de destino, porque passos se apoiam uns nos outros.
- `if` é o que o motor local avalia: `{ "reply": "<uma das suggested_replies>" }` ou `{ "profile": "<campo>", "eq": "<valor>" }`.
- `when` é a mesma condição em linguagem natural. Hoje é documentação; quando um LLM conduzir a aula, é o que ele vai ler.

## Perguntas e pulos

Além das respostas sugeridas, a pessoa pode escrever qualquer coisa no chat a qualquer momento:

- **Pedir para mudar de assunto** ("volta pro caminho da transação", "quero ver a primeira tarefa"): a Puca vai para o
  **início** do momento pedido. Não é preciso escrever transições para isso; os títulos e objetivos dos momentos são o
  que ela usa para se localizar, por isso precisam ser únicos.
- **Perguntar algo** ("onde está o cálculo do MDR?"): a Puca responde com o `knowledge` do passo e do momento atuais
  (ou de outro momento da aula) e continua de onde estava.
- **Sem fonte confiável**: ela diz que não achou confirmado e anota a dúvida para a buddy, sem chutar.

Hoje isso é simulado por palavras-chave (`src/journey/intent.ts`). Com um LLM, vale o mesmo contrato: `goal` para se
localizar, `knowledge` para responder, pulo sempre pelo primeiro passo de um momento.

## Perfil

`{ nome, cargo?, time?, gestor?, ferramentas?, aprender?, vinculo: "novo" | "transicao" }`.

A aula escolhe o perfil nesta ordem:
1. `?perfil=ana` (ou `novo`) e `?perfil=bruno` (ou `transicao`) na URL;
2. o perfil salvo pela call de entrevista (sessionStorage `puca:profile`);
3. o perfil de demonstração do Bruno (mudando de time).

## Regras que o validador aplica

- `version` é 1; campos obrigatórios presentes; quadros com nós e arestas válidos.
- Ids de momento e de passo únicos; objetivos únicos (o agente se perde com objetivos iguais).
- O primeiro momento tem `view`; ações de quadro só em momentos com quadro.
- Ações, `expect` e `flow` citam só nós e arestas do quadro em vigor; o `at` de uma ação é trecho da `line` do passo.
- Transições apontam para destinos que existem; `if.reply` está nas `suggested_replies` do passo.
- Passo `wait` com pergunta ou respostas sugeridas; passo `select` com `expect` completo.

Rode `npm test` depois de editar uma jornada: o primeiro teste valida a jornada de demo.
