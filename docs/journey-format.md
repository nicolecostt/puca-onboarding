# Formato da jornada

A aula no quadro é conduzida por uma **jornada** em JSON (`src/journey/data/*.journey.json`).
O modelo segue a ideia de jornadas usada em agentes de demonstração por voz:
**momentos** (capítulos) feitos de **passos** (cada fala ou ação do agente). A diferença do Puca é
uma vista nova, o **quadro**, que o agente monta enquanto explica (§4.1 do [`context.md`](context.md)).

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

- `x`, `y` são o centro do nó num espaço de **1200 × 700**.
- `kind` muda a cor da faixa do nó: `frontend`, `service`, `db`, `external`, `queue`, `person`, `team`, `value`, `doc`, `task`.
- `info` alimenta o **cartão do nó** (§4.3): função, time, responsável, fontes e ADR.
- `owner_confirmed: false` faz o cartão dizer que não há responsável confirmado e indicar a buddy. É a regra de não inventar quem cuida de um sistema.
- Arestas: `{ "id", "from", "to", "label"? }`. Ids de nós e arestas não podem se repetir no mesmo quadro.
- Textos aceitam `{nome}`, `{time}`, `{gestor}`, `{cargo}`…, preenchidos com o perfil da pessoa.

## Momento

| Campo | Para quê |
|---|---|
| `id`, `title` | `title` aparece no topo da tela ("Aula · Fluxo de pagamento"). |
| `goal` | O que o momento quer alcançar. O agente não fala isso. **Não pode repetir** entre momentos. |
| `view` | `{ "mode": "logo" }` ou `{ "mode": "board", "board": "<nome>" }`. Um momento **com** `view` recomeça o quadro do zero; **sem** `view`, herda o quadro do momento anterior no estado em que ficou. |
| `knowledge` | Contexto extra que o agente só usa se perguntarem. |
| `steps` | Ao menos um passo. |

## Passo

| Campo | Para quê |
|---|---|
| `goal` | O que o passo quer alcançar (não é falado; não pode repetir dentro do momento). |
| `line` | O que o agente fala. |
| `actions` | Ações no quadro, aplicadas antes da fala (tabela abaixo). |
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
| `{ "type": "focus", "target": id \| null }` | A câmera aproxima do nó; `null` volta ao quadro inteiro. |
| `{ "type": "flow", "path": [ids de arestas] }` | Um pulso percorre o caminho. |
| `{ "type": "card", "target": id }` / `{ "type": "close_card" }` | Abre ou fecha o cartão do nó. |
| `{ "type": "reset" }` | Esconde tudo. |

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

## Perfil

`{ nome, cargo?, time?, gestor?, ferramentas?, aprender?, vinculo: "novo" | "transicao" }`.

A aula escolhe o perfil nesta ordem:
1. `?perfil=ana` (ou `novo`) e `?perfil=bruno` (ou `transicao`) na URL;
2. o perfil salvo pela call de entrevista (sessionStorage `puca:profile`);
3. o perfil de demonstração "novo".

O seletor no topo da tela troca entre os dois perfis de demonstração e reinicia a aula.

## Regras que o validador aplica

- `version` é 1; campos obrigatórios presentes; quadros com nós e arestas válidos.
- Ids de momento e de passo únicos; objetivos únicos (o agente se perde com objetivos iguais).
- O primeiro momento tem `view`; ações de quadro só em momentos com quadro.
- Ações, `expect` e `flow` citam só nós e arestas do quadro em vigor.
- Transições apontam para destinos que existem; `if.reply` está nas `suggested_replies` do passo.
- Passo `wait` com pergunta ou respostas sugeridas; passo `select` com `expect` completo.

Rode `npm test` depois de editar uma jornada: o primeiro teste valida a jornada de demo.
