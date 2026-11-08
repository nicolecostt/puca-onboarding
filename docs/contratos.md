# Contratos

Pontos onde uma parte do código depende do formato de outra. Quando duas pessoas trabalham em paralelo, é aqui
que a integração quebra. Mudou algum deles? Siga a skill `contrato` (ou os passos abaixo).

| Contrato | Onde está definido | Quem depende | Testado por |
|---|---|---|---|
| Jornada da aula (JSON) | `src/journey/types.ts` + [`journey-format.md`](journey-format.md) | `runner.ts`, `whiteboard/from-journey.ts`, `screens/lesson`, quem escreve jornadas | `validate.ts` + `__tests__/validate.test.ts` |
| Eventos entre componentes | `src/lib/events.ts` (`DocumentEventMap`) | telas e componentes que escutam `callbar:*`, `chatpanel:*`, `onboarding:*`, `journey:*`, `journeypanel:*`, `agentcam:*` | `tsc` |
| Perfil da pessoa | `src/journey/profile.ts` e `src/data/types.ts` | call inicial (grava `sessionStorage` `puca:profile`) → aula → `POST /api/ask` | `__tests__/validate.test.ts` |
| Calibragem | `src/journey/types.ts` (`Calibragem`) + `src/journey/calibragem.ts` (temas, regras, `sessionStorage` `puca:calibragem`) — [seção abaixo](#calibragem) | call inicial escreve (#16) → jornada (#17) e adaptação das explicações (#23) leem | `__tests__/calibragem.test.ts` |
| Voz ↔ quadro | `BoardAction.at` em `src/journey/types.ts` + `RunnerIO.say(text, cues)` + `GET /api/tts/:id/words` — [seção abaixo](#voz--quadro) | `runner.ts`, `screens/lesson` (`io.say`), `src/voice/agent-voice.ts`, quem escreve jornadas | `validate.test.ts`, `runner.test.ts`, `server/src/voice/tts/service.test.ts` |
| Jornada da pessoa | `src/journey/types.ts` (`JornadaDaPessoa`) + `src/journey/jornada-da-pessoa.ts` (`montarJornadaDaPessoa`, `proximosPassos`) — [seção abaixo](#jornada-da-pessoa) | aula, painel "Sua jornada" (#17) → progresso (#18), painel do buddy (#19), checagem (#24) | `__tests__/jornada-da-pessoa.test.ts` |
| Rota da fala | `src/journey/route.ts` (`Route`: jump → reply → select → knowledge → faq → ask) | `screens/lesson`, voz e chat | `__tests__/route.test.ts` |
| API do servidor | `server/src/app.ts`: `/api/health`, `/api/speak`, `/api/tts/:id`, `/api/tts/:id/words`, `/api/ask`, `/api/voice/token` | `src/voice/agent-voice.ts`, `screens/lesson` | `server/src/**/*.test.ts` |
| Tipos de voz | `src/voice/types.ts` (compartilhados browser ↔ servidor) | `src/voice/*`, `server/src/voice/*` | `tsc` |
| Dados da demo e quadro | `src/data/types.ts` (pessoas, empresa, etapas, `WhiteboardSpec`) | `src/data/*.ts`, `app-header`, `whiteboard`, telas | `tsc` |
| Rastro (decisões da Puca) | `src/journey/trail.ts` (`TrailEntry`, chave `puca:rastro` no `localStorage`) | `screens/lesson` (grava), `screens/rastro` (tela de demo), custo #52, painel #19 (só totais e encaminhamentos, nunca `utterance` nem `answer`: §5) | `__tests__/trail.test.ts` |
| Encaminhamento | `src/journey/forwarding.ts` (`Forwarding`, chave `puca:encaminhamentos` no `localStorage`) e `AskEvent` `escalate` em `server/src/agent/ask.ts` | `screens/lesson` (cria), `screens/live-session` (envia no Slack), rastro (`forwarding_id`) | `__tests__/forwarding.test.ts`, `__tests__/review-fixes.test.ts`, `server/src/agent/ask.test.ts`, `server/src/agent/ask.escalate.test.ts` |
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
  `baixa` (palpite: a aula confirma na checagem).
- **Origem**: `call` (respondeu na call), `vinculo` (deduzido de ser novo ou de transição), `aula` (atualizado na checagem).
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
- **Estado** (`EstadoMomento`), nesta ordem de checagem:
  - `fora`: vínculo `transicao` e momento do tema `empresa` (é o desvio que o passo `bv-oi` já faz).
  - `ja_conhece`: nível `domina` com certeza `alta`.
  - `revisar`: nível `usa`, ou `domina` com certeza menor.
  - `aprender`: `nao_conhece` ou `ja_ouviu`, e todo momento sem tema (boas-vindas, quem cuida, checagem…).
- Momento com mais de um tema (`pagamentos` cobre pagamentos e mensageria): vale o **menor** nível, para não
  marcar como revisão o que a pessoa ainda não sabe.
- **Motivo**: a frase da pessoa na call (`evidencia` do tema que decidiu) quando existe; senão, uma frase fixa por estado.
- `proximosPassos(jornada, visitados, atual)`: os momentos que faltam, sem os `fora`, na ordem.

Exemplo (Bruno, transição; saída de `montarJornadaDaPessoa(journey, DEMO_CALIBRAGENS.transicao)`, momentos cortados):

```json
{
  "versao": 1,
  "objetivos": ["Entender o caminho da transação e fazer minha primeira mudança no terminal-config sozinho"],
  "momentos": [
    { "id": "boas-vindas", "titulo": "Boas-vindas", "objetivo": "Cumprimentar e explicar o roteiro da aula conforme o momento da pessoa",
      "estado": "aprender", "motivo": "", "temas": [] },
    { "id": "empresa-e-cultura", "titulo": "A Tail", "objetivo": "Apresentar missão, valores e áreas da empresa",
      "estado": "fora", "motivo": "Você já é da Tail: a aula vai direto ao seu time.", "temas": ["empresa"] },
    { "id": "pagamentos", "titulo": "O caminho de uma transação", "objetivo": "Mostrar o caminho de uma transação da maquininha até a liquidação",
      "estado": "aprender", "motivo": "Você disse: “Um pouco, pelo lado da fraude, mas adquirência eu não conheço”", "temas": ["pagamentos", "mensageria"] },
    { "id": "falha", "titulo": "Quando falha", "objetivo": "Explicar o caminho de erro e o que ainda não está confirmado",
      "estado": "revisar", "motivo": "Você disse: “Já, a gente tinha retry e DLQ nos consumidores”", "temas": ["falhas"] }
  ]
}
```

## Ao mudar um contrato

1. **Compatível** (campo novo opcional, evento novo): atualize o tipo, o doc e o validador se for jornada.
2. **Quebra** (renomear, remover, mudar significado): ajuste todos os usos no mesmo PR, escreva
   `⚠️ quebra contrato` no título ou no começo da descrição do PR e avise o time.
3. Formato novo da jornada exige: tipo em `types.ts`, regra em `validate.ts`, teste, seção em `journey-format.md`
   e a demo (`tail.journey.json`) continuando válida.
