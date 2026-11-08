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
| API do servidor | `server/src/app.ts`: `/api/health`, `/api/speak`, `/api/tts/:id`, `/api/tts/:id/words`, `/api/ask`, `/api/voice/token`, `/api/encaminhamentos`; token do Supabase, limites e CORS — [seção abaixo](#api-do-servidor) | `src/voice/agent-voice.ts`, `src/voice/pcm-player.ts`, `screens/lesson`, `server/bench/turn-latency.ts` | `server/src/app.test.ts`, `server/src/**/*.test.ts` |
| Tipos de voz | `src/voice/types.ts` (compartilhados browser ↔ servidor) | `src/voice/*`, `server/src/voice/*` | `tsc` |
| Dados da demo e quadro | `src/data/types.ts` (pessoas, empresa, etapas, `WhiteboardSpec`) | `src/data/*.ts`, `app-header`, `whiteboard`, telas | `tsc` |
| Rastro (decisões de Puca) | `src/journey/trail.ts` (`TrailEntry`, chave `puca:rastro` no `localStorage`) | `screens/lesson` (grava), `screens/rastro` (tela de demo e JSON baixado), custo #52 (ver "Custo da sessão"), painel #19: `screens/rh` lê `puca:sessoes` e, do rastro, só `moment` e `route` para contar dúvidas por momento, nunca `utterance` nem `answer` (§5) | `__tests__/trail.test.ts` |
| Encaminhamento | `src/journey/forwarding.ts` (`Forwarding`, chave `puca:encaminhamentos` no `localStorage`) e `AskEvent` `escalate` em `server/src/agent/ask.ts` | `screens/lesson` (cria e pede o envio no Slack da Kota pelo servidor, `src/journey/slack-real.ts`), `screens/live-session` (envia no Slack simulado o que ficou pendente), rastro (`forwarding_id`, `forwarding_link`), `screens/rh` (conta os abertos pelo `status`); envio real: [seção abaixo](#encaminhamento-no-slack-da-kota) | `__tests__/forwarding.test.ts`, `__tests__/slack-real.test.ts`, `server/src/slack/encaminhar.test.ts`, `__tests__/review-fixes.test.ts`, `server/src/agent/ask.test.ts`, `server/src/agent/ask.escalate.test.ts` |
| Primeira tarefa | `src/journey/primeira-tarefa.ts` (`TarefaDoTime`, `PedidoDeAprovacao`, chave `puca:primeiras-tarefas` no `localStorage`) e os nós `kind: "task"` da jornada — [seção abaixo](#primeira-tarefa) | `screens/lesson` (cria o pedido quando o cartão da tarefa abre), `screens/live-session` (pede a aprovação ao gestor no Slack e grava a aprovação), `screens/primeira-tarefa` (página da tarefa), `screens/rh` (conta pessoas com pedido não aprovado, por `status` e `pessoa`) | `__tests__/primeira-tarefa.test.ts`, `screens/primeira-tarefa/pagina.test.ts` |
| App para Mac (`window.orbis`) | `desktop/preload.ts` + `src/orbis.d.ts` — [seção abaixo](#app-para-mac) | telas que testam `if (window.orbis)` | `tsc` |
| Computer use (`window.orbis.navegador`) | `src/lib/orbis.ts` (`AcaoDaPuca`, `ResultadoDaFila`, `OrbisNavegador`) + ação `navegador` da jornada em `src/journey/types.ts` — [seção abaixo](#computer-use) | `desktop/navegador/` (executa), `screens/lesson` (palco do navegador), quem escreve jornadas | `__tests__/validate.test.ts`, `desktop/navegador/*.test.ts`, `tsc` |
| Visual de Puca | `src/lib/agent-visual.ts` (`AgentVisual`) | `agent-cam`, `onboarding-call`, `landing`, `src/lib/puca-sphere.ts` | `tsc` |
| Opções dos componentes | a função `mount…` de cada `src/components/*/*.ts` | as telas | `tsc` |

Exemplo válido de `TrailEntry` (uma fala da pessoa e o que Puca fez com ela):

```json
{
  "id": "7f0c…", "at": "2026-11-07T22:10:03.120Z", "session": "a91e…",
  "from": "chat", "utterance": "O que é o balancereader?", "route": "faq",
  "answer": "balancereader: responde o saldo de cada conta, de um cache em memória mantido em dia pela leitura do livro-razão.",
  "sources": ["ADR 4 · Saldo e extrato com cache em memória, lidos do livro-razão", "README do balancereader"],
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
  "to": { "name": "Beatriz Cavalcanti", "role": "buddy" },
  "pessoa": "Ana", "question": "Qual vai ser o meu bônus?", "summary": "Qual vai ser o meu bônus?",
  "consulted": [],
  "reason": "Estava sem acesso ao agente e não achei isso na sessão.",
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

## API do servidor

O servidor no Fly (`https://orbis-puca.fly.dev`, decisão 0006, `docs/stack.md` §5) e o local (`npm run dev:server`)
respondem as mesmas rotas. O que muda é o que cada requisição precisa levar:

- **Endereço:** o front monta toda URL do servidor com `apiUrl(caminho)` de `src/voice/api.ts`, que põe na frente o
  `VITE_API_URL` do build. Vazio (o `npm run dev`): caminho relativo, e o Vite repassa `/api` ao servidor local. No app
  para Mac: `https://orbis-puca.fly.dev`. Vale também para o `audio_url` que o servidor devolve (`/api/tts/<id>`).
- **Token:** toda rota, menos `GET /api/health`, exige `Authorization: Bearer <access_token do Supabase>`. O servidor
  confere a assinatura pelo JWKS do projeto, o emissor (`<SUPABASE_URL>/auth/v1`) e a audiência (`authenticated`), e
  usa o `sub` como id da pessoa. Vale para o áudio também: `GET /api/tts/:id` e `/words` levam o mesmo cabeçalho.
  Sem `SUPABASE_URL` no ambiente (dev local), nenhuma rota exige token. `EXIGE_TOKEN=1` exige o token e impede o
  servidor de subir sem Supabase; `EXIGE_TOKEN=0` não exige, mesmo com Supabase. **Hoje o Fly está com `0`**: o app
  ainda não faz login, e o token volta com a #159.
- **Limite por pessoa** (pelo id do token; sem token, pelo IP), por minuto: `POST /api/ask` 30, `POST /api/speak`
  120, `POST /api/voice/token` 20.
- **Travas diárias globais** (meia-noite de São Paulo; reiniciar o servidor zera), por `LIMITE_DIARIO_*`, sem valor =
  sem trava: `LLM` conta chamadas ao `/api/ask`; `TTS` conta caracteres sintetizados de verdade (áudio que já está no
  cache não conta nem é barrado); `STT` conta tokens do `/api/voice/token`. Com a do TTS ou a do STT esgotada, o
  `/api/health` responde `tts: false` ou `stt: false`.
- **CORS:** só `app://orbis` (o app) e `http://localhost:5173` (o Vite), com `Authorization` e `Content-Type`.

Erros que o app trata como "sem servidor" (`ask()` de `src/voice/agent-voice.ts` devolve `false` e a sessão segue como
sem servidor, em `src/screens/lesson/main.ts`; o `/api/speak` fica só na legenda; o microfone dá lugar ao chat):

| Status | Corpo | Quando |
|---|---|---|
| 401 | `{"error":"unauthorized"}` | sem token, token inválido, vencido ou de outro projeto |
| 429 | `{"statusCode":429,"error":"rate_limited","retry_after_ms":41000}` | passou do limite por minuto da pessoa |
| 503 | `{"error":"limite_diario"}` | passou da trava diária do provedor da rota |

Exemplo válido (o app manda o token da sessão do Supabase; quem cria a sessão e guarda o token é a #18):

```http
POST /api/ask HTTP/1.1
Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6Ii4uLiJ9…
Content-Type: application/json

{"text":"Quem cuida do balancereader?","moment_id":"pagamentos","step_id":"pg-pergunta","perfil":"novo"}
```

## Encaminhamento no Slack da Kota

O encaminhamento sai de verdade no Slack da Kota (#129, decisão 0008, `docs/stack.md` §10.1): o servidor manda, com o
bot da Kota, uma **mensagem direta ao próprio jurado**, nunca num canal (todos os jurados entram no mesmo workspace),
dizendo a quem a dúvida iria na Kota. A mensagem não leva o nome que a pessoa digitou. O jurado é achado pelo e-mail do
Slack que ele informa, opcional, no início do Orbis (`localStorage` `puca:slack-email`).

```ts
// POST /api/encaminhamentos   (src/journey/slack-real.ts → server/src/slack/encaminhar.ts)
interface PedidoDeEncaminhamento {
  id: string;                       // o id do Forwarding: o mesmo id duas vezes não posta duas vezes
  destino: "buddy" | "gestor" | "rh"; // hoje a sessão só manda "buddy"; gestor e rh são da #104 e da #125
  para: string;                     // quem receberia na Kota (ex.: "Paula Nunes")
  pergunta: string;
  resumo: string;
  fontes_consultadas: string[];     // títulos, como em Forwarding.consulted
  motivo: string;                   // por que Puca não respondeu (Forwarding.reason)
  email?: string;                   // e-mail do jurado no Slack da Kota; sem ele, nada é postado
}
// 200
type ResultadoDoEncaminhamento =
  | { enviado: true; canal: string; ts: string; link: string }
  | { enviado: false; motivo: "sem_slack" };   // sem e-mail ou e-mail sem conta no Slack da Kota
// 400 {"error":"pedido_invalido"} · 503 {"enviado":false,"motivo":"sem_slack"} (servidor sem SLACK_BOT_TOKEN)
// 502 {"error":"slack_falhou"} (erro do Slack; o mesmo id pode ser mandado de novo, nada foi postado em duplicata)
// Limite: 10 por hora por pessoa (pelo token; sem token, pelo IP) e 5 mensagens por hora para o mesmo destinatário
// (passou: sem_slack, sem postar). O texto do app vai escapado (<, > e &): nada de menção, <!channel> ou link disfarçado.
```

Exemplo válido:

```http
POST /api/encaminhamentos HTTP/1.1
Content-Type: application/json

{"id":"544ac694-d4d5-49f0-9cd9-866dbcc7a018","destino":"buddy","para":"Paula Nunes","pergunta":"Quem cuida do tail-common?","resumo":"Quem cuida do tail-common?","fontes_consultadas":["ADR-012","README do pos-gateway"],"motivo":"Não há responsável confirmado para o tail-common nas fontes.","email":"jurado@exemplo.com"}
```

```json
{"enviado":true,"canal":"D0123ABCD","ts":"1794135025.123456","link":"https://kota.slack.com/archives/D0123ABCD/p1794135025123456"}
```

Com `enviado: true`, o app marca o encaminhamento como `enviado` e guarda o link (`Forwarding.slack_link`): ele sai
dos pendentes e o Slack simulado não envia de novo. O rastro guarda o link em `TrailEntry.forwarding_link`. Com
`enviado: false`, sem servidor ou com erro, nada muda: o Slack simulado da `live-session` envia, como antes.

## App para Mac

O app Electron (decisão 0004, `docs/stack.md` §3, #158) abre o mesmo front por `app://orbis/` e expõe ao front só
`window.orbis`. No navegador comum (`npm run dev`) ele não existe, e a tela segue com o simulado.

```ts
interface Orbis {
  /** Versão do app (a do package.json), ex.: "0.1.0". */
  versao: string;
  /** Navegador de Puca: ver "Computer use" abaixo. */
  navegador?: OrbisNavegador;
}
declare global { interface Window { orbis?: Orbis } }
```

Exemplo de uso numa tela:

```ts
if (window.orbis) console.log(`Orbis ${window.orbis.versao}`); // no app
```

## Computer use

O navegador de Puca (decisão 0008, `docs/stack.md` §4, #123): uma área da sessão com um navegador de verdade dentro do
app, onde Puca abre o mundo da Kota e aponta, circula, marca e clica no ritmo da fala. Só existe no app; sem
`window.orbis.navegador` (`npm run dev` no navegador comum), a ação `navegador` da jornada é ignorada e o simulado segue.

```ts
type Alvo = { texto: string; seletor?: string } | { seletor: string };   // texto visível, sem maiúscula nem acento
type AcaoDaPuca =
  | { tipo: "abrir"; url: string }
  | { tipo: "apontar" | "circular" | "marcar" | "rolar" | "clicar"; alvo: Alvo }
  | { tipo: "limpar" };
interface ResultadoDaFila { feitas: number; falhas: { acao: AcaoDaPuca; motivo: string }[]; cancelada: boolean }
interface OrbisNavegador {
  mostrar(bounds: { x: number; y: number; width: number; height: number }): void; // px do conteúdo da janela
  esconder(): void;
  executar(acoes: AcaoDaPuca[]): Promise<ResultadoDaFila>; // fila serial: um lote de cada vez, na ordem
  cancelar(): void; // a pessoa falou por cima: para antes da próxima ação e limpa os desenhos
}
```

- **Endereços permitidos:** `https://github.com/JucaGF/kota-bank` (e o que vem abaixo dele) e
  `https://lean-ptarmigan-dd2.notion.site/`. `abrir` fora disso falha com `"fora da Kota"`; clique que leva para fora
  não navega.
- **Falha não quebra a fila:** alvo não achado vira `falhas` e a próxima ação roda. Nenhuma ação publica nada.
- **Na jornada**, a ação é `{ type: "navegador", acao: AcaoDaPuca, at?: string }`: com `at`, sai quando a fala chega
  no trecho, como as do quadro; vale em momento sem quadro. Se a pessoa toma a vez, as ações do navegador que
  faltavam **não** rodam (as do quadro, sim).

Exemplo válido de ação num passo:

```json
{ "type": "navegador", "acao": { "tipo": "circular", "alvo": { "texto": "README.md" } }, "at": "ADR 1" }
```

## Calibragem

O que Puca concluiu na call inicial sobre o que a pessoa já sabe e o que ela quer (glossário: **calibragem**).
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
  { "tema": "falhas", "nivel": "usa", "certeza": "alta", "evidencia": "É recusada, sem gravar nada", "origem": "sessao", "checagem": "entendeu" }
  ```
- **Resultado no motor**: `RunnerIO.onCheck?(r)`, com `r = { tema, passo, entendeu, tentativas, resposta }`
  (`resposta` é o texto dito ou o id do nó tocado). Formato da checagem na jornada em `journey-format.md`.
- `conhecimentos` tem sempre um item por tema. `time_anterior`, `aproveita` e `diferencas` só existem na transição.

Exemplo (Bruno, transição; saída de `DEMO_CALIBRAGENS.transicao`):

```json
{
  "versao": 1,
  "perfil": { "nome": "Bruno", "cargo": "Engenheiro de software pleno", "time": "Livro-razão", "gestor": "Natália Brandão",
              "ferramentas": "GitHub, Slack e Jira", "aprender": "Vendo o desenho primeiro", "vinculo": "transicao" },
  "experiencia": "Em Contas eu cuidava do login e do JWT no userservice",
  "objetivos": ["Entender o caminho de uma transferência e fazer minha primeira mudança no livro-razão sozinho"],
  "conhecimentos": [
    { "tema": "empresa",    "nivel": "usa",         "certeza": "alta",  "evidencia": "", "origem": "vinculo" },
    { "tema": "rituais",    "nivel": "nao_conhece", "certeza": "media", "evidencia": "", "origem": "vinculo" },
    { "tema": "pagamentos", "nivel": "ja_ouviu",    "certeza": "alta",  "evidencia": "Pouco, só pelo lado do login; transferência e saldo eu não conheço", "origem": "call" },
    { "tema": "mensageria", "nivel": "usa",         "certeza": "alta",  "evidencia": "Sim, usei filas no emprego anterior", "origem": "call" },
    { "tema": "falhas",     "nivel": "usa",         "certeza": "alta",  "evidencia": "Já, no emprego anterior a gente tinha retry e DLQ nos consumidores", "origem": "call" }
  ],
  "time_anterior": "Contas",
  "aproveita": "JWT e o jeito de investigar um login com problema",
  "diferencas": "Saldo e extrato, Java no lugar de Python, e o time é todo novo pra mim",
  "atualizada_em": "2026-11-09T12:00:00.000Z"
}
```

A Ana (novo) sai com `empresa`, `rituais` e `pagamentos` em `nao_conhece`, `mensageria` e `falhas` em `ja_ouviu`,
e sem os campos da transição.

## Voz ↔ quadro

Cada ação do quadro acontece na palavra em que Puca fala dela (PRODUCT.md §4.1: o quadro é construído progressivamente).

- **Na jornada:** qualquer ação de `actions` aceita `at`, um trecho da `line` do passo. A ação sai quando Puca chega
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
  "objetivos": ["Entender o caminho de uma transferência e fazer minha primeira mudança no livro-razão sozinho"],
  "momentos": [
    { "id": "boas-vindas", "titulo": "Boas-vindas", "objetivo": "Cumprimentar e explicar o roteiro da sessão conforme o momento da pessoa",
      "estado": "aprender", "motivo": "", "temas": [] },
    { "id": "empresa-e-cultura", "titulo": "A Kota", "objetivo": "Apresentar missão, valores e áreas da empresa",
      "estado": "fora", "motivo": "Você já é da Kota: a sessão vai direto ao seu time.", "temas": ["empresa"] },
    { "id": "pagamentos", "titulo": "O caminho de uma transferência", "objetivo": "Mostrar o caminho de uma transferência do site até o livro-razão",
      "estado": "aprender", "motivo": "Você disse: “Pouco, só pelo lado do login; transferência e saldo eu não conheço”", "temas": ["pagamentos", "mensageria"] },
    { "id": "falha", "titulo": "Quando falha", "objetivo": "Explicar o caminho de erro e as decisões que o explicam",
      "estado": "revisar", "motivo": "Você disse: “Já, no emprego anterior a gente tinha retry e DLQ nos consumidores”", "temas": ["falhas"] }
  ]
}
```

## Custo da sessão

Tempo e tokens de cada sessão, para o time auditar a demo (#52, PRODUCT.md §12.2). **Nada disso aparece em tela.**

- **`timing` do `/api/ask`** (`AskTiming` em `server/src/agent/ask.ts`), último evento do SSE. Campos novos, aditivos:
  `tokens_in` e `tokens_out` (tokens de entrada e de saída da chamada ao LLM; `null` quando nada foi consumido: o provedor recusou antes de responder, como sem chave, 401 ou 429) e
  `tokens_estimated` (`true` quando o provedor não informou e o servidor estimou, à razão de 4 caracteres por token).
  `llm_error` é `null` quando não houve falha; senão, uma razão estável: `timeout`, `interrupted`, `provider_error`, `refusal` ou `empty_response`.
  Falha do LLM e resposta vazia usam uma frase própria e não geram `escalate`; esse evento continua reservado a falta de fonte confiável.
  ```json
  { "type": "timing", "timing": { "first_speak_ms": 2, "llm_first_token_ms": 3185, "llm_first_sentence_ms": 3333,
    "total_ms": 3584, "llm_error": null, "tokens_in": 1912, "tokens_out": 38, "tokens_estimated": false } }
  ```
- **Log do servidor:** uma linha por `/api/ask`, com `msg: "ask"`, `moment`, `step` e o `timing`, inclusive quando a
  pessoa interrompe e o navegador não recebe o `timing`. Nunca leva o texto da pessoa.
- **Rastro** (`src/journey/trail.ts`): a entrada de uma fala que foi ao agente ganha `llm_ms` (o `total_ms` do servidor),
  `tokens_in`, `tokens_out` e `tokens_estimated`, copiados do `timing`, e `llm_error` quando houve falha.
  `llm_error` é uma razão estável (`timeout`, `interrupted`, `provider_error`, `refusal` ou `empty_response`), sem mensagem
  bruta do provedor; erros ausentes não geram o campo. Sem `llm_ms` e demais campos de custo, a pergunta não foi medida no
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
Puca escreve na DM do gestor, e o gestor aprova com um clique. A página da tarefa e a sessão escutam o evento `storage`.

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
  "pessoa": "Bruno", "gestor": "Natália Brandão",
  "tarefa": {
    "no": "task-403", "titulo": "Extrato de outra conta responde 403 no transactionhistory",
    "problema": "pedir o extrato de outra conta com um token válido responde 401, como se faltasse login",
    "porque": "401 quer dizer token inválido; com o token certo e a conta errada, o certo é 403, e quem investiga um erro procura no lugar certo",
    "sistemas": "só o transactionhistory (o TransactionHistoryController e os testes dele)", "onde_ler": "ADR 2 e README do transactionhistory",
    "quem_ajuda": "Beatriz Cavalcanti e Thiago Nakamura"
  },
  "moment": "primeira-tarefa", "sessao": "a91e…", "status": "aprovada",
  "aprovada_por": "Natália Brandão", "aprovada_em": "2026-11-08T14:31:12.000Z"
}
```

## Ao mudar um contrato

1. **Compatível** (campo novo opcional, evento novo): atualize o tipo, o doc e o validador se for jornada.
2. **Quebra** (renomear, remover, mudar significado): ajuste todos os usos no mesmo PR, escreva
   `⚠️ quebra contrato` no título ou no começo da descrição do PR e avise o time.
3. Formato novo da jornada exige: tipo em `types.ts`, regra em `validate.ts`, teste, seção em `journey-format.md`
   e a demo (`kota.journey.json`) continuando válida.
