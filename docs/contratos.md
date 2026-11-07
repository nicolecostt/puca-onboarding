# Contratos

Pontos onde uma parte do código depende do formato de outra. Quando duas pessoas trabalham em paralelo, é aqui
que a integração quebra. Mudou algum deles? Siga a skill `contrato` (ou os passos abaixo).

| Contrato | Onde está definido | Quem depende | Testado por |
|---|---|---|---|
| Jornada da aula (JSON) | `src/journey/types.ts` + [`journey-format.md`](journey-format.md) | `runner.ts`, `whiteboard/from-journey.ts`, `screens/lesson`, quem escreve jornadas | `validate.ts` + `__tests__/validate.test.ts` |
| Eventos entre componentes | `src/lib/events.ts` (`DocumentEventMap`) | telas e componentes que escutam `callbar:*`, `chatpanel:*`, `onboarding:*`, `journey:*`, `agentcam:*` | `tsc` |
| Perfil da pessoa | `src/journey/profile.ts` e `src/data/types.ts` | call inicial (grava `sessionStorage` `puca:profile`) → aula → `POST /api/ask` | `__tests__/validate.test.ts` |
| Rota da fala | `src/journey/route.ts` (`Route`: jump → reply → select → knowledge → faq → ask) | `screens/lesson`, voz e chat | `__tests__/route.test.ts` |
| API do servidor | `server/src/app.ts`: `/api/health`, `/api/speak`, `/api/tts/:id`, `/api/ask`, `/api/voice/token` | `src/voice/agent-voice.ts`, `screens/lesson` | `server/src/**/*.test.ts` |
| Tipos de voz | `src/voice/types.ts` (compartilhados browser ↔ servidor) | `src/voice/*`, `server/src/voice/*` | `tsc` |
| Dados da demo e quadro | `src/data/types.ts` (pessoas, empresa, etapas, `WhiteboardSpec`) | `src/data/*.ts`, `app-header`, `whiteboard`, telas | `tsc` |
| Rastro (decisões da Puca) | `src/journey/trail.ts` (`TrailEntry`, chave `puca:rastro` no `localStorage`) | `screens/lesson` (grava), `screens/rastro` (tela de demo), custo #52, painel #19 | `__tests__/trail.test.ts` |
| Encaminhamento | `src/journey/forwarding.ts` (`Forwarding`, chave `puca:encaminhamentos` no `localStorage`) e `AskEvent` `escalate` em `server/src/agent/ask.ts` | `screens/lesson` (cria), `screens/live-session` (envia no Slack), rastro (`forwarding_id`) | `__tests__/forwarding.test.ts`, `server/src/agent/ask.test.ts` |
| Visual da Puca | `src/lib/agent-visual.ts` (`AgentVisual`) | `agent-cam`, `sandbox/puca-teste.ts` (local) | `tsc` |
| Opções dos componentes | a função `mount…` de cada `src/components/*/*.ts` | as telas | `tsc` |

Exemplo válido de `TrailEntry` (uma fala da pessoa e o que a Puca fez com ela):

```json
{
  "id": "7f0c…", "at": "2026-11-07T22:10:03.120Z", "session": "a91e…",
  "from": "chat", "utterance": "Quem cuida do authorizer?", "route": "faq",
  "answer": "Quem cuida do authorizer é Júlia Paiva, do time Autorização.",
  "sources": ["ADR-019 · Cálculo de MDR por plano", "fees/mdr.go"],
  "moment": "pagamentos", "step": "pg-pergunta"
}
```

`forwarding_id` aparece quando a fala virou encaminhamento; `ms` é o tempo da resposta do agente (`route: "ask"`).

Exemplo válido de `Forwarding` (status: `pendente` → `enviando` → `enviado` → `confirmado`; `claimed_by` é a aba do Slack que pegou o envio, para duas abas não mandarem duas vezes):

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
| Voz ↔ quadro | fala da Puca (interrupção e retomada) em sincronia com as ações no quadro | ações dos passos, eventos `journey:*`, `WordTiming` e `src/voice/barge-in.ts` |
| Company brain | pergunta → trechos com **fonte** (ADR, código, doc cultural) | `knowledge` dos passos e `info.docs`/`info.adr` dos nós |
| Progresso e memória | o que a pessoa estudou, dúvidas e onde parou, entre sessões | perfil em `sessionStorage` (`puca:profile`) |
| Painel buddy/gestor/RH | marcos, pendências e pedidos de suporte | etapas da jornada em `src/data/company.ts` |
| Computer use | o agente mexendo nas ferramentas | cursor em `components/agent-cursor`; primeiro uso real: o envio do encaminhamento no Slack (`screens/live-session/slack-dm.ts`) |

## Ao mudar um contrato

1. **Compatível** (campo novo opcional, evento novo): atualize o tipo, o doc e o validador se for jornada.
2. **Quebra** (renomear, remover, mudar significado): ajuste todos os usos no mesmo PR, escreva
   `⚠️ quebra contrato` no título ou no começo da descrição do PR e avise o time.
3. Formato novo da jornada exige: tipo em `types.ts`, regra em `validate.ts`, teste, seção em `journey-format.md`
   e a demo (`tail.journey.json`) continuando válida.
