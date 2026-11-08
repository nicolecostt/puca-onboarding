# Contratos

Pontos onde uma parte do código depende do formato de outra. Quando duas pessoas trabalham em paralelo, é aqui
que a integração quebra. Mudou algum deles? Siga a skill `contrato` (ou os passos abaixo).

| Contrato | Onde está definido | Quem depende | Testado por |
|---|---|---|---|
| Jornada da sessão (JSON) | `src/journey/types.ts` + [`journey-format.md`](journey-format.md) | `runner.ts`, `whiteboard/from-journey.ts`, `screens/lesson`, quem escreve jornadas | `validate.ts` + `__tests__/validate.test.ts` |
| Eventos entre componentes | `src/lib/events.ts` (`DocumentEventMap`) | telas e componentes que escutam `callbar:*`, `chatpanel:*`, `onboarding:*`, `journey:*`, `journeypanel:*`, `agentcam:*` | `tsc` |
| Perfil da pessoa | `src/journey/profile.ts` e `src/data/types.ts` | call inicial (grava `sessionStorage` `puca:profile`) → sessão → `POST /api/ask` | `__tests__/validate.test.ts` |
| Calibragem | `src/journey/types.ts` (`Calibragem`) + `src/journey/calibragem.ts` (temas, regras, `sessionStorage` `puca:calibragem`) — [seção abaixo](#calibragem) | call inicial escreve (#16) e a checagem da sessão atualiza (#24) → jornada (#17) e adaptação das explicações (#23) leem | `__tests__/calibragem.test.ts` |
| Voz ↔ quadro | `BoardAction.at` em `src/journey/types.ts` + `RunnerIO.say(text, cues)` + `GET /api/tts/:id/words` — [seção abaixo](#voz--quadro) | `runner.ts`, `screens/lesson` (`io.say`), `src/voice/agent-voice.ts`, quem escreve jornadas | `validate.test.ts`, `runner.test.ts`, `server/src/voice/tts/service.test.ts` |
| Jornada da pessoa | `src/journey/types.ts` (`JornadaDaPessoa`) + `src/journey/jornada-da-pessoa.ts` (`montarJornadaDaPessoa`, `proximosPassos`) — [seção abaixo](#jornada-da-pessoa) | sessão, painel "Sua jornada" (#17) → progresso (#18), painel do buddy (#19), checagem (#24) | `__tests__/jornada-da-pessoa.test.ts` |
| Rota da fala | `src/journey/route.ts` (`Route`: jump → reply → tarefa → select → knowledge → faq → ask; numa checagem, `waiting.check`: o que não é pergunta nem pulo é `reply`; `tarefa`: pergunta que cita a primeira tarefa, respondida pelos campos dela em `src/journey/duvidas-da-tarefa.ts`, com `RouteContext.tarefa`/`tarefaApresentada` opcionais) | `screens/lesson`, voz e chat | `__tests__/route.test.ts` |
| API do servidor | `server/src/app.ts`: `/api/health`, `/api/speak`, `/api/tts/:id`, `/api/tts/:id/words`, `/api/ask`, `/api/voice/token` | `src/voice/agent-voice.ts`, `screens/lesson` | `server/src/**/*.test.ts` |
| Tipos de voz | `src/voice/types.ts` (compartilhados browser ↔ servidor) | `src/voice/*`, `server/src/voice/*` | `tsc` |
| Dados da demo e quadro | `src/data/types.ts` (pessoas, empresa, etapas, `WhiteboardSpec`) | `src/data/*.ts`, `app-header`, `whiteboard`, telas | `tsc` |
| Rastro (decisões da Puca) | `src/journey/trail.ts` (`TrailEntry`, chave `puca:rastro` no `localStorage`) | `screens/lesson` (grava), `screens/rastro` (tela de demo e JSON baixado), custo #52 (ver "Custo da sessão"), painel #19: `screens/rh` lê `puca:sessoes` e, do rastro, só `moment` e `route` para contar dúvidas por momento, nunca `utterance` nem `answer` (§5) | `__tests__/trail.test.ts` |
| Encaminhamento | `src/journey/forwarding.ts` (`Forwarding`, chave `puca:encaminhamentos` no `localStorage`) e `AskEvent` `escalate` em `server/src/agent/ask.ts` | `screens/lesson` (cria), `screens/live-session` (envia no Slack), rastro (`forwarding_id`), `screens/rh` (conta os abertos pelo `status`) | `__tests__/forwarding.test.ts`, `__tests__/review-fixes.test.ts`, `server/src/agent/ask.test.ts`, `server/src/agent/ask.escalate.test.ts` |
| Primeira tarefa | `src/journey/primeira-tarefa.ts` (`TarefaDoTime`, `PedidoDeAprovacao`, chave `puca:primeiras-tarefas` no `localStorage`) e os nós `kind: "task"` da jornada — [seção abaixo](#primeira-tarefa) | `screens/lesson` (cria o pedido quando o cartão da tarefa abre), `screens/live-session` (pede a aprovação ao gestor no Slack e grava a aprovação), `screens/primeira-tarefa` (página da tarefa), `screens/rh` (conta pessoas com pedido não aprovado, por `status` e `pessoa`) | `__tests__/primeira-tarefa.test.ts`, `screens/primeira-tarefa/pagina.test.ts` |
| Visual da Puca | `src/lib/agent-visual.ts` (`AgentVisual`) | `agent-cam`, `onboarding-call`, `landing`, `src/lib/puca-sphere.ts` | `tsc` |
| Opções dos componentes | a função `mount…` de cada `src/components/*/*.ts` | as telas | `tsc` |

Exemplo válido de `TrailEntry` (uma fala da pessoa e o que a Puca fez com ela):

```json
{
  "id": "7f0c…", "at": "2026-11-07T22:10:03.120Z", "session": "a91e…",
  "from": "chat", "utterance": "O que é o authorizer?", "route": "faq",
  "answer": "authorizer: decide se a transação é aprovada e calcula o MDR, a taxa cobrada do lojista.",
  "sources": ["ADR-019 · Cálculo de MDR por plano", "fees/mdr.go"],
  "moment": "pagamentos", "step": "pg-pergunta"
}
```

`sources` só lista o que sustenta a resposta, para o jurado achar no kit (PRODUCT.md §13.2): "o que é" traz as docs do nó,
"por que existe" traz só o ADR, e "quem cuida" fica `[]`, porque as docs do nó não dizem quem cuida.

`forwarding_id` aparece quando a fala virou encaminhamento; `ms` é o tempo da resposta do agente (`route: "ask"`).

Exemplo válido de `Forwarding` (status: `pendente` → `enviando` → `enviado` → `confirmado`; `claimed_by` é a aba do Slack que pegou o envio, para duas abas não mandarem duas vezes, e `claimed_at` é quando ela pegou: um envio em `enviando` há mais de 30 s está preso, e outra aba pode pegar):

```json
{
  "id": "c2d1…", "at": "2026-11-07T22:14:10.000Z",
  "to": { "name": "Paula Nunes", "role": "buddy" },
  "pessoa": "Ana", "question": "Quem cuida do tail-common?", "summary": "Quem cuida do tail-common?",
  "consulted": ["ADR-012", "README do pos-gateway"],
  "reason": "Não há responsável confirmado para o tail-common nas fontes da Tail.",
  "moment": "pagamentos", "status": "pendente"
}
```

## Contratos que vão surgir

Pelas tarefas do hackathon, estes formatos vão ligar partes feitas por pessoas diferentes. Quem chegar primeiro
escreve o formato aqui (tipo + um exemplo válido) **antes** de implementar; o outro lado usa o exemplo como mock.

| Contrato | Liga | Ponto de partida hoje |
|---|---|---|
| Company brain | pergunta → trechos com **fonte** (ADR, código, doc cultural) | `knowledge` dos passos e `info.docs`/`info.adr` dos nós |
| Progresso e memória | o que a pessoa estudou, dúvidas e onde parou, entre sessões | perfil em `sessionStorage` (`puca:profile`) |
| Painel buddy/gestor/RH | marcos, pendências e pedidos de suporte | etapas da jornada em `src/data/company.ts` |
| Computer use | o agente mexendo nas ferramentas | cursor em `components/agent-cursor`; primeiro uso real: o envio do encaminhamento no Slack (`screens/live-session/slack-dm.ts`) |

## Calibragem

O que a Puca concluiu na call inicial sobre o que a pessoa já sabe e o que ela quer (glossário: **calibragem**).
A call inicial grava no fim da conversa; quem lê usa `resolveCalibragem(location.search)`
(`?perfil=` → calibragem salva pela call → demo do Bruno), no mesmo padrão do perfil.
Enquanto a sua parte não lê de verdade, use `DEMO_CALIBRAGENS.novo` (Ana) e `DEMO_CALIBRAGENS.transicao` (Bruno) como mock.

- **Temas** (lista fechada, `Tema`): `empresa`, `rituais`, `pagamentos`, `mensageria`, `falhas`. Cada um aponta para os
  momentos da jornada que controla em `CALIBRAGEM_TEMAS` (ex.: `falhas` → `falha`). Tema novo entra nos dois lugares.
- **Nível** (`Nivel`): `nao_conhece` → `ja_ouviu` → `usa` → `domina`. É ponto de partida, não nota.
- **Certeza** (`Certeza`): `alta` (a pessoa disse com clareza), `media` (deduzido do que ela contou),
  `baixa` (palpite: a sessão confirma na checagem).
- **Origem**: `call` (respondeu na call), `vinculo` (deduzido de ser novo ou de transição), `sessao` (atualizado na checagem).
- **Checagem** (`checagem?`, só com origem `sessao`): `entendeu` ou `rever`, o resultado da última checagem do tema na sessão.
  Quem escreve é `atualizarCalibragem(calibragem, resultado)`, uma função pura (a tela grava com `saveCalibragem`):
  - `entendeu`: nível pelo menos `usa`, certeza `alta`, evidência = o que a pessoa respondeu ou tocou.
  - `rever`: o nível **não muda** (não é nota); a certeza vira `alta` e o tema fica marcado para rever.
  ```json
  { "tema": "falhas", "nivel": "usa", "certeza": "alta", "evidencia": "Para a settlement.dlq", "origem": "sessao", "checagem": "entendeu" }
  ```
- **Resultado no motor**: `RunnerIO.onCheck?(r)`, com `r = { tema, passo, entendeu, tentativas, resposta }`
  (`resposta` é o texto dito ou o id do nó tocado). Formato da checagem na jornada em `journey-format.md`.
- `conhecimentos` tem sempre um item por tema. `time_anterior`, `aproveita` e `diferencas` só existem na transição.

Exemplo (Bruno, transição; saída de `DEMO_CALIBRAGENS.transicao`):

```json
{
  "versao": 1,
  "perfil": { "nome": "Bruno", "cargo": "Engenheiro de backend", "time": "Terminais", "gestor": "Marcos Vidal",
              "ferramentas": "GitHub, Slack e Jira", "aprender": "Vendo o desenho primeiro", "vinculo": "transicao" },
  "experiencia": "No Antifraude eu cuidava dos consumidores Kafka que analisam as transações",
  "objetivos": ["Entender o caminho da transação e fazer minha primeira mudança no terminal-config sozinho"],
  "conhecimentos": [
    { "tema": "empresa",    "nivel": "usa",         "certeza": "alta",  "evidencia": "", "origem": "vinculo" },
    { "tema": "rituais",    "nivel": "nao_conhece", "certeza": "media", "evidencia": "", "origem": "vinculo" },
    { "tema": "pagamentos", "nivel": "ja_ouviu",    "certeza": "alta",  "evidencia": "Um pouco, pelo lado da fraude, mas adquirência eu não conheço", "origem": "call" },
    { "tema": "mensageria", "nivel": "usa",         "certeza": "alta",  "evidencia": "Sim, uso Kafka todo dia", "origem": "call" },
    { "tema": "falhas",     "nivel": "usa",         "certeza": "alta",  "evidencia": "Já, a gente tinha retry e DLQ nos consumidores", "origem": "call" }
  ],
  "time_anterior": "Antifraude",
  "aproveita": "Kafka e o jeito de investigar uma transação com problema",
  "diferencas": "A parte de terminais e configuração, e o time é todo novo pra mim",
  "atualizada_em": "2026-11-09T12:00:00.000Z"
}
```

A Ana (novo) sai com `empresa`, `rituais` e `pagamentos` em `nao_conhece`, `mensageria` e `falhas` em `ja_ouviu`,
e sem os campos da transição.

## Voz ↔ quadro

Cada ação do quadro acontece na palavra em que a Puca fala dela (PRODUCT.md §4.1: o quadro é construído progressivamente).

- **Na jornada:** qualquer ação de `actions` aceita `at`, um trecho da `line` do passo. A ação sai quando a Puca chega
  nesse trecho; sem `at`, sai antes da fala (como sempre foi). O validador exige que o trecho exista na fala.
  ```json
  { "type": "reveal", "targets": ["valor-dono", "m-dono"], "at": "dono do problema" }
  ```
- **No motor:** `RunnerIO.say(text, cues?)`. `cues` são `{ at, action }`, com `at` = posição (em caracteres) do trecho
  no texto já com o perfil preenchido. Quem implementa o `say` dispara cada cue quando a fala passa dessa posição e,
  se a fala for cortada (pulo, áudio que falhou), aplica as que faltaram antes de devolver: o quadro nunca fica pela metade.
- **No servidor:** `GET /api/tts/:id/words` → `{ "words": WordTiming[] }` (`src/voice/types.ts`), em ms desde o início
  daquele áudio e com as palavras do texto escrito. Responde quando a síntese termina (na hora se veio do cache);
  `404` se o id não existe, `503` sem TTS. Com voz, a legenda e as cues seguem esses tempos; sem voz, ou enquanto
  eles não chegam, seguem a estimativa da legenda.
- **Ações do agente** (`action` no SSE do `/api/ask`): saem quando a frase seguinte começa a tocar, ou no fim da resposta
  se não vier frase depois.

## Jornada da pessoa

A jornada como a pessoa vê, montada a partir da calibragem: os objetivos dela e cada momento marcado.
Quem lê chama `montarJornadaDaPessoa(journey, calibragem)`, uma função pura que não grava nada. O progresso
(feito, agora, a seguir) é estado da tela; salvar o progresso é a #18.

- **Nenhum momento sai da jornada.** O estado só marca; o runner segue o mesmo JSON.
- **Estado** (`EstadoMomento`), nesta ordem:
  - `fora`: vínculo `transicao` e momento do tema `empresa` (é o desvio que o passo `bv-oi` já faz).
  - Resultado da checagem na sessão (`checagem` de algum tema do momento): `rever` → `revisar` (e `rever: true`); senão,
    `entendeu` → `ja_conhece`. A checagem vale mais que a regra do menor nível abaixo: ela confere o momento como um
    todo (ex.: a Ana acerta a checagem de `pagamentos` e o momento fica "já conhece", mesmo com `mensageria` em `nao_conhece`).
  - `ja_conhece`: nível `domina` com certeza `alta`.
  - `revisar`: nível `usa`, ou `domina` com certeza menor.
  - `aprender`: `nao_conhece` ou `ja_ouviu`, e todo momento sem tema (boas-vindas, quem cuida, checagem…).
- Momento com mais de um tema (`pagamentos` cobre pagamentos e mensageria): vale o **menor** nível, para não
  marcar como revisão o que a pessoa ainda não sabe.
- **Motivo**: depois de uma checagem, uma frase fixa sobre ela ("Na checagem da sessão, ficou claro." / "Na checagem da sessão,
  vale rever este assunto."); senão, a frase da pessoa na call (`evidencia` do tema que decidiu) quando existe; senão, uma frase fixa por estado.
- O painel "Sua jornada" remonta com `JourneyPanel.setJornada(jornada)` quando a calibragem muda, mantendo o progresso.
- `proximosPassos(jornada, visitados, atual)`: os momentos que faltam, sem os `fora`, na ordem. Um momento com
  `rever: true` volta a faltar mesmo já visto (§12.1: a checagem atualiza o que ainda falta).

Exemplo (Bruno, transição; saída de `montarJornadaDaPessoa(journey, DEMO_CALIBRAGENS.transicao)`, momentos cortados):

```json
{
  "versao": 1,
  "objetivos": ["Entender o caminho da transação e fazer minha primeira mudança no terminal-config sozinho"],
  "momentos": [
    { "id": "boas-vindas", "titulo": "Boas-vindas", "objetivo": "Cumprimentar e explicar o roteiro da sessão conforme o momento da pessoa",
      "estado": "aprender", "motivo": "", "temas": [] },
    { "id": "empresa-e-cultura", "titulo": "A Tail", "objetivo": "Apresentar missão, valores e áreas da empresa",
      "estado": "fora", "motivo": "Você já é da Tail: a sessão vai direto ao seu time.", "temas": ["empresa"] },
    { "id": "pagamentos", "titulo": "O caminho de uma transação", "objetivo": "Mostrar o caminho de uma transação da maquininha até a liquidação",
      "estado": "aprender", "motivo": "Você disse: “Um pouco, pelo lado da fraude, mas adquirência eu não conheço”", "temas": ["pagamentos", "mensageria"] },
    { "id": "falha", "titulo": "Quando falha", "objetivo": "Explicar o caminho de erro e o que ainda não está confirmado",
      "estado": "revisar", "motivo": "Você disse: “Já, a gente tinha retry e DLQ nos consumidores”", "temas": ["falhas"] }
  ]
}
```

## Custo da sessão

Tempo e tokens de cada sessão, para o time auditar a demo (#52, PRODUCT.md §12.2). **Nada disso aparece em tela.**

- **`timing` do `/api/ask`** (`AskTiming` em `server/src/agent/ask.ts`), último evento do SSE. Campos novos, aditivos:
  `tokens_in` e `tokens_out` (tokens de entrada e de saída da chamada ao LLM; `null` quando nada foi consumido: o provedor recusou antes de responder, como sem chave, 401 ou 429) e
  `tokens_estimated` (`true` quando o provedor não informou e o servidor estimou, à razão de 4 caracteres por token).
  ```json
  { "type": "timing", "timing": { "first_speak_ms": 2, "llm_first_token_ms": 3185, "llm_first_sentence_ms": 3333,
    "total_ms": 3584, "llm_error": null, "tokens_in": 1912, "tokens_out": 38, "tokens_estimated": false } }
  ```
- **Log do servidor:** uma linha por `/api/ask`, com `msg: "ask"`, `moment`, `step` e o `timing`, inclusive quando a
  pessoa interrompe e o navegador não recebe o `timing`. Nunca leva o texto da pessoa.
- **Rastro** (`src/journey/trail.ts`): a entrada de uma fala que foi ao agente ganha `llm_ms` (o `total_ms` do servidor)
  e `tokens_in`, `tokens_out` e `tokens_estimated`, copiados do `timing`. Sem esses campos, a pergunta não foi medida no
  navegador (a pessoa interrompeu); o log do servidor tem o número.
- **Sessão** (`TrailSession`, chave `puca:sessoes` no `localStorage`): `{ session, started_at, ended_at }`, com o mesmo
  `session` das entradas. A tela da sessão grava o início quando ela começa e o fim quando a call é encerrada ou a sessão termina;
  recomeçar a sessão ou retomar a call na mesma página mantém o início e reabre a sessão. "Limpar", na tela de rastro, apaga as falas e as sessões.
- **JSON baixado** na tela de rastro (`exportJson()`), ⚠️ **quebra só no arquivo baixado**: era a lista de entradas,
  agora é `{ "sessions": SessionSummary[], "entries": TrailEntry[] }`. O resumo é calculado por `summarizeSessions`;
  a duração vai do início ao fim da sessão, ou até a última fala se ela não terminou. `llm_calls` conta só as
  perguntas que chegaram ao servidor, e `llm_calls_unmeasured`, as que chegaram mas cujo `timing` não voltou.
  ```json
  { "session": "a91e…", "started_at": "2026-11-07T22:00:00.000Z", "ended_at": "2026-11-07T22:14:30.000Z",
    "duration_ms": 870000, "utterances": 6, "llm_calls": 2, "llm_calls_unmeasured": 1, "llm_ms": 3561,
    "tokens_in": 1676, "tokens_out": 18, "tokens_estimated": false }
  ```

## Primeira tarefa

A primeira tarefa (PRODUCT.md §4.4 e §12.1, passo 5) sai do catálogo que o time aprovou: os nós `kind: "task"` da jornada.
O momento `primeira-tarefa` escolhe uma pelo vínculo e abre o cartão dela. Cada nó `task` tem `info.role` (o título) e
exatamente estes `bullets`, nesta forma, que viram a `TarefaDoTime` (`tarefaDoNo`). O `info.vinculo` de cada nó diz de quem
ele é, para o FAQ e o agente não falarem da tarefa do outro perfil:

`Problema: …` · `Por que importa: …` · `Sistemas: …` · `Onde ler: …` · `Quem ajuda: …`

Quando o cartão de um nó `task` abre, a sessão cria um **pedido de aprovação** para o gestor. A tela do Slack pega o pedido,
a Puca escreve na DM do gestor, e o gestor aprova com um clique. A página da tarefa e a sessão escutam o evento `storage`.

- Status: `pendente` (a sessão criou) → `enviando` (uma aba do Slack pegou; `claimed_by`/`claimed_at`, com a mesma regra de 30 s
  do encaminhamento) → `aguardando` (mensagem enviada na DM do gestor) → `aprovada` (o gestor clicou; `aprovada_por` e `aprovada_em`).
- A sessão só escreve `pendente`; o Slack escreve o resto.
- `sessao` (opcional) é o id da sessão da tela que criou o pedido, o mesmo do rastro. A mesma pessoa, a mesma tarefa e a
  mesma sessão geram um pedido só: recomeçar ou voltar ao momento devolve o pedido que já existe, mesmo aprovado. Página
  nova é sessão nova e pede de novo, para um ensaio aprovado no mesmo navegador não apagar o passo 5 da apresentação.

Exemplo válido de `PedidoDeAprovacao`:

```json
{
  "id": "5b7e…", "at": "2026-11-08T14:30:00.000Z",
  "pessoa": "Bruno", "gestor": "Marcos Vidal",
  "tarefa": {
    "no": "task-dlq", "titulo": "Fazer a publicação de configuração tentar de novo e, se continuar falhando, ir para uma DLQ.",
    "problema": "se o terminal.config.updated fica fora do ar, a configuração publicada se perde sem aviso",
    "porque": "a maquininha fica com a configuração antiga e ninguém sabe",
    "sistemas": "terminal-config-api e terminal.config.updated", "onde_ler": "README do terminal-config-api",
    "quem_ajuda": "Lucas Melo e Paula Nunes"
  },
  "moment": "primeira-tarefa", "sessao": "a91e…", "status": "aprovada",
  "aprovada_por": "Marcos Vidal", "aprovada_em": "2026-11-08T14:31:12.000Z"
}
```

## Ao mudar um contrato

1. **Compatível** (campo novo opcional, evento novo): atualize o tipo, o doc e o validador se for jornada.
2. **Quebra** (renomear, remover, mudar significado): ajuste todos os usos no mesmo PR, escreva
   `⚠️ quebra contrato` no título ou no começo da descrição do PR e avise o time.
3. Formato novo da jornada exige: tipo em `types.ts`, regra em `validate.ts`, teste, seção em `journey-format.md`
   e a demo (`tail.journey.json`) continuando válida.
