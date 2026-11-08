# Stack do Orbis

O desenho técnico completo do Orbis para o hackathon: o que roda onde, por quê e como implementar cada parte. As
escolhas estão registradas em `docs/decisoes/` (0004, 0006, 0007, 0008); este documento é o guia de implementação.

> Alinhamento com Joaquim em 2026-11-08 (issue #13). O que está marcado **(proposta)** é sugestão de implementação de
> quem escreveu e pode mudar no PR de quem implementar, desde que não contradiga a decisão. Formato que outra parte do
> código usa entra em [`docs/contratos.md`](contratos.md) pela skill `contrato` antes de implementar.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Princípios](#2-princípios)
3. [App para Mac (Electron)](#3-app-para-mac-electron)
4. [Navegador de Puca (computer use)](#4-navegador-de-puca-computer-use)
5. [Servidor (Fly.io)](#5-servidor-flyio)
6. [Login e dados (Supabase)](#6-login-e-dados-supabase)
7. [LLM (Claude Haiku 5.5)](#7-llm-claude-haiku-55)
8. [Voz](#8-voz)
9. [Conhecimento (company brain)](#9-conhecimento-company-brain)
10. [Ações reais: Slack, GitHub e Notion](#10-ações-reais-slack-github-e-notion)
11. [Segurança e privacidade](#11-segurança-e-privacidade)
12. [Observabilidade e custo](#12-observabilidade-e-custo)
13. [Repositório, scripts e variáveis](#13-repositório-scripts-e-variáveis)
14. [O que muda nas regras, no produto e nos contratos](#14-o-que-muda-nas-regras-no-produto-e-nos-contratos)
15. [Ordem de implementação](#15-ordem-de-implementação)
16. [Contas e chaves](#16-contas-e-chaves)
17. [Riscos e plano B](#17-riscos-e-plano-b)

---

## 1. Visão geral

| Camada | Escolha | Onde roda | Decisão |
|---|---|---|---|
| App | Electron em volta do front atual (Vite + TypeScript sem framework), arquivos do front dentro do app | Mac do jurado | 0004 |
| Distribuição | `.zip` nos Releases do GitHub + `curl -fsSL …/instalar.sh \| bash`, sem conta da Apple | GitHub | 0004 |
| Computer use | Navegador de Puca dentro do app, controlado pelo protocolo de depuração do Chromium | Mac do jurado | 0008 |
| Servidor | O Fastify de `server/`, como **um processo sempre ligado** | Fly.io, uma máquina | 0006 |
| Login | Supabase Auth: login anônimo por instalação, com nome e perfil | Supabase | 0006 |
| Dados da pessoa | Supabase Postgres com RLS; o app grava local primeiro e sincroniza | Supabase + Mac | 0006 |
| Arquivos | Supabase Storage (cache de áudio de Puca) | Supabase | 0006 |
| LLM | Claude Haiku 5.5 sem raciocínio, pelo SDK oficial | API da Anthropic | 0007 |
| Voz | Deepgram (fala da pessoa, do app direto) e ElevenLabs Flash v2.5 (fala de Puca, pelo servidor) | provedores | — |
| Conhecimento | Cópias locais do kit da Kota (`kota-bank` e Notion) com índice de busca de texto no servidor | servidor | #25, #26 |
| Ações reais | Slack da Kota pela API, com o bot; GitHub com token de escopo mínimo | servidor | 0008 |

```
Mac do jurado                                       Nuvem
┌──────────────────────────────────────┐           ┌──────────────────────────────┐
│ Orbis.app (Electron)                 │  HTTPS    │ Fly.io: server/ (Fastify)    │
│  ├ janela do Orbis (front Vite)  ────┼──────────▶│  /api/ask   → Claude Haiku   │
│  │   motor da jornada, quadro, voz   │  SSE/PCM  │  /api/speak → ElevenLabs     │
│  ├ navegador de Puca (WebContents)   │◀──────────┼  /api/encaminhamentos → Slack│
│  │   GitHub · Notion · Slack web     │           │  índice do kit da Kota       │
│  │   camada de Puca (desenho, cursor)│           └──────────────┬───────────────┘
│  └ fila local (localStorage) ────────┼──── supabase-js ───▶ Supabase (Auth, Postgres, Storage)
│ microfone ──── WebSocket (token curto) ───────────────────▶ Deepgram
└──────────────────────────────────────┘
```

---

## 2. Princípios

1. **A resposta nunca espera o LLM** (regra do `CLAUDE.md`). Toda fala passa por `src/journey/route.ts`; o LLM é o
   último caminho e começa com uma ponte. A rede também não: o conhecimento vem de cópias locais.
2. **A sessão nunca trava por causa de infraestrutura.** Supabase fora do ar, Slack lento ou o navegador de Puca
   sem login: a sessão segue e a pendência fica na fila local, no rastro ou num aviso curto.
3. **Nenhuma chave de API no app.** O app só conhece o endereço do servidor e a chave pública do Supabase
   (feita para ficar no cliente, protegida por RLS). Toda chave paga fica no servidor.
4. **Guarda em código, não no prompt.** O que Puca pode abrir e fazer é limitado por lista e por confirmação no
   código do app e do servidor; o prompt só orienta.
5. **Tudo que Puca afirma tem fonte no kit da Kota** (`PRODUCT.md` §13). Sem fonte, encaminhamento.
6. **`npm run dev` no navegador continua funcionando** sem Electron, sem Supabase e sem servidor, com o computer
   use simulado de hoje. Cada peça nova detecta se está disponível e cai no comportamento atual se não estiver.

---

## 3. App para Mac (Electron)

Decisão: [0004](decisoes/0004-app-desktop-electron.md). MVP só para macOS (Apple Silicon e Intel).

### 3.1. Por que Electron

- O front atual roda sem mudança: é o mesmo Chromium do desenvolvimento.
- Medido em 2026-11-08 (Mac M4): a sessão gasta ~33% de um núcleo no Electron contra ~28% no Chrome; o custo é da
  página, não do Electron. A camada transparente com o cursor de Puca gasta ~6%.
- Swift exigiria reescrever ~8.900 linhas de front; Tauri usa o motor do Safari e pede Rust.

### 3.2. Estrutura **(proposta)**

```
desktop/
  main.ts            processo principal: janela, protocolo app://, IPC, permissões
  preload.ts         expõe window.orbis ao front (contextBridge), nada além disso
  navegador/
    cdp.ts           cliente do protocolo de depuração (webContents.debugger)
    camada.ts        script injetado na página: desenho, cursor, cartões
    acoes.ts         as ações de Puca (tabela da §4.3)
    fila.ts          fila de ações com cancelamento
    guarda.ts        lista de endereços permitidos e ações que pedem confirmação
    pessoa.ts        o que a pessoa faz na página (cliques, navegação)
  electron-builder.yml
  tsconfig.json
scripts/
  instalar.sh        instalador pelo terminal
```

- **Linguagem:** TypeScript, compilado com `esbuild` para `dist-desktop/` **(proposta)**. O front continua no Vite.
- **Carregamento:**
  - em desenvolvimento, a janela abre `http://localhost:5173` (`npm run dev` rodando);
  - no app empacotado, abre os arquivos de `dist/` por um protocolo próprio `app://orbis/`, registrado com
    `protocol.handle`. Assim o front tem uma origem estável para CORS e para o Supabase.
- **Ponte com o front:** o `preload.ts` expõe só isto **(proposta)**:

```ts
window.orbis = {
  versao: string,
  navegador: {
    mostrar(bounds: { x: number; y: number; width: number; height: number }): void, // onde a área do navegador fica na tela
    esconder(): void,
    executar(acoes: AcaoDaPuca[]): Promise<ResultadoDaFila>,                    // ver §4.3
    cancelar(): void,                                                            // a pessoa falou por cima
    aoAgirAPessoa(cb: (ev: AcaoDaPessoa) => void): () => void,                   // ver §4.6
  },
};
```

  O front testa `if (window.orbis)`: com o app, usa o navegador de verdade; no navegador comum, a `live-session`
  simulada de hoje. `AcaoDaPuca` e `AcaoDaPessoa` são contrato novo (seção "Computer use" de `docs/contratos.md`).
- **Segurança do Electron:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` nas duas
  `webContents`; o front não recebe Node, só a API acima. `setWindowOpenHandler` nega janelas novas e
  `will-navigate` só deixa a janela do Orbis navegar dentro de `app://orbis/` (e `localhost:5173` em dev).

### 3.3. Microfone

- `extendInfo.NSMicrophoneUsageDescription` no `electron-builder.yml` ("Puca usa o microfone para conversar com você").
- No início, `systemPreferences.askForMediaAccess("microphone")`; negado, o app mostra o caminho em Ajustes e a sessão
  segue pelo chat.
- `session.setPermissionRequestHandler` libera `media` só para a origem do Orbis, nunca para o navegador de Puca.
- O computer use dentro do app **não** pede Acessibilidade nem Gravação de tela.

### 3.4. Empacotamento e instalação

- **`electron-builder`** com `mac.target: zip` para `arm64` e `x64` (dois arquivos menores em vez de um universal),
  `appId: com.orbis.app`, `productName: Orbis`.
- **Assinatura própria (ad hoc):** `mac.identity: null` e um `afterPack` que roda
  `codesign --force --deep --sign - Orbis.app`. Sem isso o Mac com Apple Silicon recusa abrir. Sem conta da Apple,
  sem notarização.
- **Releases:** um workflow do GitHub Actions em `macos-14` roda a cada tag `v*`: `npm ci`, `npm run build`,
  `npm run build:app`, e sobe `Orbis-mac-arm64.zip` e `Orbis-mac-x64.zip`, cada um com o seu `.sha256`, no Release. O repositório é público, então
  os minutos de macOS saem de graça.
- **`scripts/instalar.sh`** (o guia de uso só pede este comando):

```bash
curl -fsSL https://raw.githubusercontent.com/nicolecostt/puca-onboarding/main/scripts/instalar.sh | bash
```

  O script:
  1. lê `uname -m` (`arm64` ou `x86_64`) e escolhe o `.zip`;
  2. baixa com `curl -fL` de `…/releases/latest/download/Orbis-mac-<arch>.zip` (arquivo baixado com `curl` não recebe
     a quarentena do macOS, conferido em 2026-11-08);
  3. baixa também o `Orbis-mac-<arch>.zip.sha256` publicado no mesmo Release e confere com `shasum -a 256 -c`; se
     não bater, para sem instalar;
  4. extrai com `ditto -x -k` em `~/Applications/Orbis.app`, substituindo a versão anterior (sem `sudo`);
  5. tira a quarentena com `xattr -dr com.apple.quarantine`, para o caso de o arquivo ter chegado por outro caminho
     (pelo `curl` ela não vem);
  6. abre com `open`.

  O guia de uso diz que o app não é notarizado pela Apple e por que o comando é seguro: o script é legível no repo,
  não pede `sudo` e só escreve em `~/Applications/Orbis.app`.

  `bash -s -- --desinstalar` apaga o app e os dados locais. O script fica no repo para o jurado ler antes de rodar.
- **Atualização:** sem assinatura da Apple não há atualização automática. Versão nova = rodar o comando de novo. Como
  o front vai dentro do app, toda mudança de tela exige release; por isso o fluxo de release precisa ser um comando.

### 3.5. Scripts **(proposta)**

| Script | O que faz |
|---|---|
| `npm run dev:app` | `npm run dev` + Electron apontando para `localhost:5173`, recarregando ao salvar |
| `npm run build:app` | `vite build` + `esbuild desktop/` + `electron-builder --mac zip` |
| `npm run release -- <versão>` | cria a tag `v<versão>` e faz push; o workflow publica |

---

## 4. Navegador de Puca (computer use)

Decisão: [0008](decisoes/0008-acoes-reais-e-navegador-da-puca.md). Issue: #123.

### 4.1. O que é

Uma área da janela do Orbis com um navegador de verdade (um `WebContentsView`), onde Puca abre o GitHub, o Notion
e o Slack da Kota na versão web e opera pelo protocolo de depuração do Chromium (`webContents.debugger`, versão
`1.3`). A pessoa vê tudo acontecer e pode mexer na mesma página quando quiser.

Provado em 2026-11-08 no `kota-bank` de verdade: cursor de Puca, círculo à mão, cartão com imagem e seta, clique real
que abriu o `README.md`, marca-texto, fila cancelada 0,2 s depois de a pessoa falar por cima, clique da pessoa
percebido (`{ texto: "Issues", confiavel: true }`).

### 4.2. Layout

- A tela `live-session` vira a casa do navegador: a barra de call, o chat e a câmera de Puca ficam **em volta** da
  área do navegador, não por cima. O `WebContentsView` é desenhado acima do HTML do Orbis, então nada do front
  consegue ficar por cima dele.
- O front mede a área reservada (`getBoundingClientRect`) e chama `orbis.navegador.mostrar(bounds)` sempre que ela
  muda (`ResizeObserver`).
- O que Puca desenha **dentro** da página (cursor, círculo, cartão) vem da camada da §4.4, então fica por cima do
  site e acompanha a rolagem.

### 4.3. As ações de Puca **(proposta de contrato)**

Cada ação é um objeto pequeno, no mesmo espírito das ações do quadro (`BoardAction`): a jornada descreve, o app
executa. O alvo é achado **pelo texto visível ou por seletor**, nunca por coordenada fixa.

| Ação | O que faz | Como (protocolo de depuração) |
|---|---|---|
| `abrir { url }` | navega | `Page.navigate` + espera `Page.frameStoppedLoading` (até 8 s) |
| `apontar { alvo }` | leva o cursor de Puca até o elemento | acha o elemento, `scrollIntoView`, move o cursor da camada |
| `circular { alvo }` | círculo à mão em volta | `path` SVG com tremido, animado com `stroke-dashoffset` |
| `seta { de, para }` | seta curva entre dois pontos ou alvos | `path` quadrático + ponta |
| `marcar { alvo }` | marca-texto | `div` amarela com `mix-blend-mode: multiply` |
| `cartao { perto_de, conteudo }` | cartão com texto, imagem ou mini-diagrama | `div` com HTML **sanitizado** (DOMPurify) |
| `clicar { alvo }` | clique de verdade | `Input.dispatchMouseEvent` (`mouseMoved`, `mousePressed`, `mouseReleased`) no centro do **link ou botão**, não do bloco em volta |
| `digitar { alvo, texto }` | preenche um campo | foco no elemento + `Input.insertText`; em React, setter nativo de `value` + evento `input` |
| `rolar { alvo }` | rola até o elemento | `scrollIntoView({ block: "center" })` |
| `limpar` | apaga os desenhos | remove a camada |

Formato **(proposta)**:

```ts
type Alvo = { texto: string; seletor?: string } | { seletor: string };
type AcaoDaPuca =
  | { tipo: "abrir"; url: string }
  | { tipo: "apontar" | "circular" | "marcar" | "rolar" | "clicar"; alvo: Alvo }
  | { tipo: "seta"; de: Alvo; para: Alvo }
  | { tipo: "cartao"; perto_de: Alvo; conteudo: { titulo?: string; texto?: string; imagem?: string; diagrama?: string } }
  | { tipo: "digitar"; alvo: Alvo; texto: string; confirmar: true }
  | { tipo: "limpar" };
// na jornada, cada ação pode ter `at` (posição na fala), como as ações do quadro
```

Regras de execução:

- **Achar o alvo:** procurar primeiro em `a, button, [role=button], input, textarea`, depois no resto; filtrar o que
  está visível (largura e altura > 0, dentro do documento); entre vários, o de texto mais curto. Rolar até o alvo
  **antes** de ler a posição (no teste, o clique sem rolar caiu fora da tela).
- **Clique:** sempre no centro do elemento clicável (`closest("a, button")`). No teste, mirar o bloco da linha
  fez o clique não abrir nada.
- **Alvo não achado:** a ação falha sem quebrar a fila, o rastro registra e Puca segue falando ("não achei o botão
  aqui, mas ele fica…").
- **Sites desenhados em canvas** (ex.: Figma) não têm elementos para achar; ficam fora do MVP.

### 4.4. A camada de Puca

- Injetada com `Runtime.evaluate` e reinjetada em toda página nova com `Page.addScriptToEvaluateOnNewDocument`.
- Uma `div` com `pointer-events: none` e `z-index` máximo, em coordenadas do **documento** (os desenhos rolam junto).
- `Page.setBypassCSP({ enabled: true })` antes de carregar: o navegador é nosso e a política de segurança da página
  não pode bloquear a camada.
- **Limpar na troca de página:** GitHub e Slack trocam de página sem recarregar. Ouvir `Page.frameNavigated` e
  `Page.navigatedWithinDocument` e limpar a camada. No teste, os desenhos ficaram da página anterior por falta disso.
- **Estilo:** traço vermelho para círculo, roxo de Puca para seta e cursor, marca-texto amarelo, cartão branco com
  borda preta (o visual do quadro). Cores em `src/styles/tokens.css`, repassadas na injeção.
- **Imagens no cartão:** SVG inline (mini-diagramas gerados a partir do quadro) ou imagem por `data:` URL. Conteúdo
  que vem do LLM passa por DOMPurify antes de entrar na página.

### 4.5. Fila, sincronia com a fala e interrupção

- **As ações seguem a fala.** Um passo da jornada pode ter ações do navegador com `at` (posição na fala), como as
  ações do quadro com o contrato Voz ↔ quadro. O mesmo `say(text, cues)` do `runner.ts` dispara as duas.
- **Não é um agente autônomo.** No caminho da demo, quem decide as ações é a jornada (passos curtos e previsíveis),
  não o LLM clique a clique. O LLM pode pedir ações de uma lista curta (`apontar`, `circular`, `abrir` dentro da lista
  permitida) quando responde uma pergunta, com no máximo 3 ações por resposta.
- **Interrupção:** quando a pessoa fala por cima (`src/voice/barge-in.ts`), o front chama
  `orbis.navegador.cancelar()`. A fila para antes da próxima ação; a ação em curso termina (todas duram menos de
  1 s); a camada é limpa; Puca diz que está ouvindo. Depois da resposta, a jornada retoma do passo.
- **Ações idempotentes:** repetir `abrir`, `apontar` ou `circular` não causa dano. Ações que publicam algo
  (`digitar` com envio) nunca repetem sozinhas.

### 4.6. A pessoa também mexe: três modos

| Modo | Puca | A pessoa | Exemplo |
|---|---|---|---|
| **Mostrar** | faz e narra | assiste | "Abro o `CODEOWNERS`… essa linha diz que o Livro-razão é o responsável." |
| **Apontar** | circula e espera | clica | "O `ledgerwriter` está aqui. Abre ele pra gente?" |
| **Acompanhar** | observa e reage | faz | "Agora procure a issue da primeira tarefa." → a pessoa abre → "Isso, essa mesma." |

Como Puca percebe a pessoa:

- `Runtime.addBinding({ name: "orbisPessoa" })` + um ouvinte de `click` em captura, injetado em toda página: manda
  `{ texto, href, confiavel }` ao app.
- Os cliques da própria Puca levam uma marca (`window.__pucaClicando`) e são ignorados.
- `Page.frameNavigated` diz para onde a pessoa foi.
- O app repassa ao front por `orbis.navegador.aoAgirAPessoa`, e a jornada trata como uma resposta do passo (um
  passo `wait` que espera "abriu a URL X" ou "clicou em Y").

### 4.7. Guarda

- **Lista de endereços permitidos** **(proposta)**: `github.com/JucaGF/kota-bank`, o Notion da Kota
  (`*.notion.site` do workspace) e o Slack da Kota (`app.slack.com`, o endereço do workspace em `*.slack.com` e
  `slack.com/signin`, por onde passa o login). `will-navigate` e
  `setWindowOpenHandler` bloqueiam o resto: a pessoa vê "fora do mundo da Kota" e um botão para abrir no navegador
  dela.
- **Confirmação:** ação que publica algo em nome de alguém (`digitar` + enviar) pede o ok da pessoa na tela.
- **Nunca** digitar senha nem guardar teclas. O login nas ferramentas é feito pela pessoa.

### 4.8. Login nas ferramentas

- O navegador de Puca usa uma partição persistente (`partition: "persist:kota"`): a pessoa entra uma vez e o login
  fica entre aberturas do app.
- GitHub e Notion da Kota são públicos e não pedem login para ler.
- O Slack da Kota pede: o jurado entra pelo convite do guia de uso, uma vez, dentro do navegador de Puca. O
  encaminhamento chega como mensagem direta do bot para ele (§10.1); sem login ou sem Slack, Puca mostra a mensagem
  num cartão em vez de abrir o Slack.

### 4.9. Fora do MVP

- Apps nativos (Slack desktop, VS Code, Terminal). Na primeira tarefa, que roda no terminal e no editor da pessoa, a
  Puca guia por voz e lê o que a pessoa colar no chat. Um terminal embutido no app fica para depois, se der tempo.
- Ver a tela por print e decidir com visão. O Claude Haiku 5.5 enxerga imagem, então dá para fazer depois sem trocar
  de modelo.

---

## 5. Servidor (Fly.io)

Decisão: [0006](decisoes/0006-infra-servidor-e-dados.md). Issue: #124 (o ambiente do jurado é a #49).

### 5.1. Por que um processo sempre ligado

O `/api/speak` cria o trabalho de áudio na memória (`server/src/voice/tts/service.ts`) e o `/api/tts/:id` busca esse
trabalho numa segunda requisição. As duas precisam cair no mesmo processo. Serverless (Vercel, Edge Functions) quebra
isso; vários processos também. Por isso: **uma máquina, sempre ligada**. O SSE do `/api/ask` e o WebSocket de saída
para a ElevenLabs também pedem processo longo.

### 5.2. Configuração **(proposta)**

`fly.toml` na raiz:

```toml
app = "orbis-puca"
primary_region = "iad"

[build]
  dockerfile = "server/Dockerfile"

[http_service]
  internal_port = 8787
  force_https = true
  auto_stop_machines = "off"
  auto_start_machines = true
  min_machines_running = 1

[[http_service.checks]]
  method = "GET"
  path = "/api/health"
  interval = "15s"
  timeout = "3s"

[[vm]]
  size = "shared-cpu-1x"
  memory = "1gb"
```

- **Região:** começar em `iad` (perto da Anthropic e da ElevenLabs) e medir `gru` (São Paulo) com `npm run bench:turn`
  rodado do Brasil. Fica a de menor p95 até o primeiro áudio. Trocar é `fly regions set`.
  **Medido em 2026-11-08 (#49), de São Paulo, ficou `iad`:** primeiro áudio p50 de 460 ms contra 600–930 ms em `gru`
  (o Storage do Supabase e a ElevenLabs estão nos EUA); ponte e primeira frase do LLM parecidas nas duas
  (`server/bench/results/turn-2026-11-08T10-2*`).
- **`server/Dockerfile`:** `node:22-slim`, `npm ci --omit=dev` mais `tsx`, `CMD ["npx", "tsx", "server/src/server.ts"]`.
  O índice do kit (§9) é gerado no build da imagem.
- **Chaves:** `fly secrets set ANTHROPIC_API_KEY=… ELEVENLABS_API_KEY=… …` (lista na §13.3). Nunca no repo.
- **Deploy:** `fly deploy` manual no começo; depois um workflow na `main` que roda `npm run check` e `fly deploy`
  **(proposta)**.

### 5.3. O que entra no servidor

- **Autenticação:** um `preHandler` do Fastify confere o token do Supabase (`Authorization: Bearer <jwt>`) contra o
  JWKS do projeto com `jose`, e põe `req.pessoa = { id, nome }`. Sem token válido, 401. `/api/health` fica aberto.
- **Limite de uso:** `@fastify/rate-limit` com chave no id da pessoa **(proposta de valores)**:

  | Rota | Limite |
  |---|---|
  | `POST /api/ask` | 30 por minuto |
  | `POST /api/speak` | 120 por minuto |
  | `POST /api/encaminhamentos` | 10 por hora |
  | `POST /api/voice/token` | 20 por minuto |

  Como a chave pública do Supabase vai no app, qualquer um cria contas anônimas, cada uma com o próprio limite. Por
  isso o que segura o custo são as **travas diárias globais**, uma por provedor pago: `LIMITE_DIARIO_LLM` (chamadas
  ao `/api/ask`), `LIMITE_DIARIO_TTS` (caracteres no `/api/speak`) e `LIMITE_DIARIO_STT` (tokens do
  `/api/voice/token`). Passou, a rota cai no comportamento sem servidor: o que iria ao LLM recebe a frase de falha, sem
  encaminhamento (as rotas locais da `route.ts`, inclusive `faq` e `tarefa`, continuam respondendo e encaminhando
  como hoje; decisão 0007), voz do navegador no lugar do TTS, chat no lugar do microfone. E o login anônimo fica com o limite por IP do Supabase e, se
  houver abuso, captcha (o Supabase Auth aceita Turnstile ou hCaptcha nesse login).
- **CORS:** só a origem `app://orbis` (e `http://localhost:5173` em dev).
- **Cache de áudio:** sai do disco e vai para o Supabase Storage, bucket privado `tts-cache`, chave = hash(texto, voz,
  modelo). Na memória, um LRU dos áudios mais usados. As falas da jornada são pré-geradas no deploy
  (`npm run precompute`), então a primeira sessão do dia já toca do cache.
- **Rotas novas:** `POST /api/encaminhamentos` (§10.1) e, se a primeira tarefa precisar, `POST /api/tarefas/:n/atribuir`
  (§10.2). Ambas entram na linha "API do servidor" de `docs/contratos.md` antes de implementar.

### 5.4. A regra do servidor muda

Hoje: "o servidor só dá voz e LLM" (`CLAUDE.md`). Passa a ser: **voz, LLM e as ações nos sistemas da Kota** (Slack e,
se precisar, GitHub). A sessão continua sendo conduzida no app; o servidor continua sem estado de sessão (o que
precisa durar vai para o Supabase). Mudança de regra pela skill `nova-regra` (§14).

---

## 6. Login e dados (Supabase)

Decisão: [0006](decisoes/0006-infra-servidor-e-dados.md). Issues: #18, #19.

### 6.1. Login básico

- **Login anônimo do Supabase por instalação** (`signInAnonymously`): cada jurado ganha um id próprio, sem e-mail nem
  senha, e os dados de um não se misturam com os de outro.
- A tela de entrada parece um login: nome, escolha do perfil (novo ou transição) e, opcional, o e-mail com que a
  pessoa entrou no Slack da Kota (só para o encaminhamento chegar a ela, §10.1). Vão para os metadados da conta no
  Supabase Auth e para a tabela `pessoas`.
- Para a apresentação, contas fixas com e-mail e senha (`ana@kota.example`, `bruno@kota.example`), criadas pelo
  painel do Supabase já confirmadas.
- A sessão do Supabase fica guardada pelo `supabase-js` no app; reabrir o app volta para onde a pessoa parou.

### 6.2. Tabelas **(proposta de contrato)**

Todas com `pessoa_id uuid references auth.users` e RLS `pessoa_id = auth.uid()` para ler e escrever.

| Tabela | O que guarda | Hoje no app |
|---|---|---|
| `pessoas` | nome, perfil, vínculo, time de destino | `puca:profile` (`sessionStorage`) |
| `calibragens` | o JSON da calibragem, versão | `puca:calibragem` (`sessionStorage`) |
| `sessoes` | onde parou (momento, passo), objetivos, tempo, tokens | `puca:sessoes` |
| `rastro` | cada decisão de Puca (`TrailEntry`) | `puca:rastro` |
| `encaminhamentos` | dúvida, destino, fontes, motivo, link da mensagem no Slack | `puca:encaminhamentos` |
| `primeiras_tarefas` | tarefa escolhida, pedido de aprovação, estado | `puca:primeiras-tarefas` |

- Ids gerados no app (`crypto.randomUUID()`), para gravar local e no Supabase com o mesmo id.
- `atualizado_em` em toda linha; conflito resolve pelo mais recente.
- Migrações em `supabase/migrations/` com a CLI do Supabase, aplicadas pelo `supabase db push`.

### 6.3. Grava local primeiro, sincroniza depois

- O app continua gravando no `localStorage` como hoje (nada da sessão espera a rede).
- Cada gravação também entra numa fila local (`puca:fila`) **(proposta)**. Um sincronizador manda a fila ao Supabase
  com `upsert` por id: ao abrir o app, a cada 10 s e no evento `online`. Falhou, tenta de novo depois; a sessão nunca
  vê o erro.
- `sessionStorage` (perfil e calibragem) passa para `localStorage`: senão some ao fechar o app e o progresso entre
  sessões (#38) não funciona.
- Ao abrir o app, o que está no Supabase é baixado para o `localStorage` (o Supabase é a fonte entre sessões).

### 6.4. Painel do buddy, do gestor e do RH (#19)

No MVP, o painel é uma tela do próprio app que lê os dados da pessoa logada, do jeito que o buddy veria: marcos,
pendências e encaminhamentos, **sem transcrições** (`PRODUCT.md` §5). Papéis de buddy e gestor vendo várias pessoas
ficam para depois do hackathon.

### 6.5. Plano

O plano grátis pausa o projeto depois de 7 dias sem uso. Durante a avaliação, plano pago (Pro). Antes disso, o
grátis serve.

---

## 7. LLM (Claude Haiku 5.5)

Decisão: [0007](decisoes/0007-llm-claude-haiku.md).

### 7.1. Medição (2026-11-08)

Mesmos 3 cenários, prompt e ferramentas de `server/bench/llm-latency.ts`, 5 rodadas cada, intercalados:

| | 1ª resposta p50 / p95 | 1ª frase p50 / p95 | Ferramenta certa | Erros |
|---|---|---|---|---|
| **Claude Haiku 5.5 sem raciocínio** | 597 / 835 ms | 817 / 1.085 ms | 10/10 | 0/15 |
| Claude Haiku 5.5 com raciocínio (esforço baixo) | 2.170 / 3.911 ms | 3.196 / 3.931 ms | 10/10 | 0/15 |
| Qwen3-32B (Featherless) sem raciocínio | 781 / 11.152 ms | 1.101 / 11.153 ms | 0/10 | 0/15 |

O Qwen3-32B nunca chamou ferramenta: dizia "vou encaminhar para a sua buddy" sem chamar `escalate_to_buddy`, então o
encaminhamento não aconteceria. Ressalvas: 15 amostras por braço, uma janela de tempo, cenários ainda da jornada da
Tail, prompt escrito para o Qwen.

### 7.2. Como implementar

- **Cliente:** `server/src/llm/anthropic.ts` com `@anthropic-ai/sdk` (o SDK oficial; nada de camada de compatibilidade
  com OpenAI), emitindo os mesmos `LlmEvent` de hoje (`text`, `tool_call`, `usage`, `done`). O resto do servidor não
  muda. O cliente da Featherless sai depois que o novo estiver na `main`.
- **Chamada:** `client.messages.stream({ model: "claude-haiku-5-5", thinking: { type: "disabled" },
  output_config: { effort: "medium" }, max_tokens: 1024, system, messages, tools })`. No Haiku 5.5, desligar o
  raciocínio só é aceito com esforço `high` ou abaixo.
- **Ferramentas:** as de `buildTools` viram `{ name, description, input_schema, eager_input_streaming: true }`. Com
  `eager_input_streaming`, o servidor não valida a entrada: validar cada ferramenta contra o esquema antes de usar
  (como `validTool` já faz no bench) e descartar a inválida.
- **System e mensagens:** as mensagens `system` de `buildMessages` vão para o campo `system`; o resto, para
  `messages`. A conversa começa sempre com `user`.
- **Cache de prompt:** a parte fixa primeiro (instruções de Puca, ferramentas, a jornada da sessão), a parte que muda
  depois (momento, passo, histórico, fala). `cache_control: { type: "ephemeral" }` no fim da parte fixa. Conferir
  `usage.cache_read_input_tokens` > 0 a partir da segunda fala.
- **Aquecimento:** ao começar a sessão, uma chamada com `max_tokens: 0` e a parte fixa, para a primeira pergunta já
  achar o cache.
- **Tempo e erros:** o limite de 8 s de hoje continua. Tentar de novo só se nada foi emitido ainda. Timeout, erro,
  `stop_reason: "refusal"` e resposta vazia **não encaminham**: Puca diz a frase de falha (não a `FALLBACK_LINE` de
  falta de fonte, `server/src/agent/bridges.ts`) e o rastro guarda o motivo da falha, num campo novo do contrato do
  Rastro (decisão 0007, #85). Erros pelas classes do SDK
  (`Anthropic.RateLimitError`, `Anthropic.APIError`), nunca por texto.
- **Bench:** `npm run bench:llm -- --provider anthropic|featherless` no repo, com os cenários trocados para a jornada
  da Kota quando ela existir (#120).

### 7.3. Outros usos

- **Checagem de entendimento:** a correção da resposta da pessoa é uma chamada separada (também Haiku 5.5), com a
  régua que Puca não vê, devolvendo `certo | parcial | errado | nao_respondeu` por ferramenta. Puca só recebe o
  resultado.
- **Visão:** quando o computer use precisar olhar a tela (§4.9), o mesmo modelo recebe o print como imagem.

### 7.4. Custo

Claude Haiku 5.5: US$ 0,10 por milhão de tokens de entrada e US$ 0,50 de saída (até 100 mil tokens de prompt). Uma
fala com ~3 mil tokens de entrada e ~150 de saída custa menos de um milésimo de dólar. O custo da sessão (#94) usa
o `usage` de cada resposta.

---

## 8. Voz

Sem troca de provedor. O que existe continua; o que muda é onde as chaves ficam e alguns ganhos de latência.

- **Fala da pessoa:** Deepgram, do app direto por WebSocket, com token curto pedido ao servidor
  (`/api/voice/token`). A chave do Deepgram precisa de papel **Member** ou acima (abaixo disso, gerar o token dá 403).
- **Fala de Puca:** ElevenLabs Flash v2.5 pelo servidor, com o áudio em PCM 24 kHz pelo `/api/tts/:id` e os tempos
  de cada palavra pelo `/api/tts/:id/words`. Vozes da biblioteca exigem plano pago (no grátis, 402).
- **Ganhos de latência (proposta):**
  - manter um WebSocket reserva já aberto com a ElevenLabs, para a próxima fala não pagar a abertura;
  - normalizador de fala em pt-BR antes do TTS ("R$ 1.500" → "mil e quinhentos reais", "ADR-003" → "ADR três", siglas e números);
  - ponte automática se nada sair em 3 s;
  - um registro de tempo por turno (`turn_timing`: fala recebida, rota escolhida, 1º token, 1º áudio) no log.
- **Interrupção:** o microfone fica aberto enquanto Puca fala, com o filtro de eco de `src/voice/barge-in.ts`. A
  mesma interrupção para o áudio, a fila do quadro e a fila do navegador de Puca (§4.5).

---

## 9. Conhecimento (company brain)

Issues: #25, #26, #27 (com Joaquim). O que está aqui é recomendação de stack para essas issues.

- **Fontes:** o `kota-bank` (clonado no build da imagem do servidor, numa versão fixa) e a cópia do Notion em
  `kit/kota/notion/` (decisão 0005). Puca não chama GitHub nem Notion na hora da sessão.
- **Pedaços:** por arquivo e por título de Markdown (README, ADR, runbook, página do Notion), e por função ou classe
  no código. Cada pedaço guarda a fonte: repositório, caminho, linhas, commit ou URL da página do Notion, título.
- **Índice:** busca de texto em memória no servidor, montada no boot a partir dos pedaços (biblioteca leve tipo
  MiniSearch, com dicionário em português) **(proposta)**. O kit é pequeno: não precisa de banco nem de embeddings.
  Vetores (pgvector no Supabase) só se a busca de texto falhar em perguntas reais.
- **Alternativa a medir:** o Claude Haiku 5.5 aceita contexto de 1 milhão de tokens. Se a cópia do Notion couber em
  algumas dezenas de milhares de tokens, ela pode ir inteira na parte fixa do prompt, com cache. Medir latência e
  acerto contra a busca antes de escolher.
- **Na fala:** a busca roda antes da chamada ao LLM, em paralelo com o resto do prompt. Os trechos entram marcados
  como dado, com a fonte (`[kota-bank/docs/adr/0003.md · L12-30]`).
- **Citação conferida:** a resposta cita a fonte com o trecho exato; se o trecho não existir na fonte, a citação é
  descartada e, sem fonte, vira encaminhamento.
- **No quadro:** a fonte de cada nó (`info.docs`, `info.adr`) é um arquivo do `kota-bank` ou uma página do Notion
  (decisão 0005), aberta no navegador de Puca quando a pessoa toca nela.

---

## 10. Ações reais: Slack, GitHub e Notion

Decisão: [0008](decisoes/0008-acoes-reais-e-navegador-da-puca.md). Issues: #118, #125, #104.

### 10.1. Encaminhamento no Slack da Kota

- **Quem envia:** o servidor, com o token do bot do app da Kota (o mesmo de #118). Não é o navegador de Puca
  digitando: a ação precisa sair sempre, mesmo sem login no Slack.
- **Para onde:** uma **mensagem direta do bot para o próprio jurado** (`conversations.open` + `chat.postMessage`),
  dizendo a quem ela iria na Kota (a buddy pelo nome, o RH ou o gestor no caso pessoal da #125). As pessoas da Kota não
  são membros reais (decisão 0005), e todos os jurados entram no mesmo workspace pelo mesmo convite: **nunca** postar
  num canal compartilhado, porque a dúvida de um jurado (às vezes um caso pessoal) apareceria para os outros (§5 do
  `PRODUCT.md`). A mensagem não leva o nome digitado no login.
- **Como achar o jurado no Slack (feito na #129):** a tela de início pede, opcional, o e-mail com que ele entrou no Slack
  da Kota; o servidor acha o id com `users.lookupByEmail`. Sem e-mail ou sem conta no Slack, nada é postado: Puca
  mostra a mensagem num cartão e o rastro registra "não enviado: sem Slack".
- **Como aparece:** `chat.postMessage` com `chat:write.customize`, `username: "Puca"` e o ícone de Puca. A mensagem
  traz a dúvida, um resumo, as fontes consultadas e o motivo de não ter respondido (§4.5 do `PRODUCT.md`).
- **Depois:** o servidor pede o link (`chat.getPermalink`) e devolve ao app. O app abre o link no navegador de Puca e
  aponta para a mensagem. Sem login no Slack, mostra a mensagem num cartão.
- **Sem duplicar:** o app manda um `id` próprio; o servidor grava em `encaminhamentos` com esse id único e, se ele já
  existir, devolve o mesmo resultado sem postar de novo (resolve a corrida da #70).
- **Contrato:** o que está valendo é a seção "Encaminhamento no Slack da Kota" de `docs/contratos.md` (#129); a proposta abaixo foi o ponto de partida.

```ts
// POST /api/encaminhamentos
{ id: string; destino: "buddy" | "gestor" | "rh"; pergunta: string; resumo: string;
  fontes_consultadas: { titulo: string; url: string }[]; motivo: "sem_fonte" | "caso_pessoal" | "acesso" }
// 201
{ enviado: true; canal: string; ts: string; link: string } | { enviado: false; motivo: "sem_slack" }
```

- **Escopos do bot:** `chat:write`, `chat:write.customize`, `im:write` (abrir a mensagem direta), `users:read` e
  `users:read.email` (achar o jurado), e `channels:manage` só para o script que preenche os canais da Kota (#118).
  Nada de ler mensagens.
- **O Slack simulado fica.** A `live-session` simulada continua: no `npm run dev` sem servidor (princípio 6), como
  plano B quando o servidor ou o Slack falham, e na **aprovação do gestor** (primeira tarefa, passo 5 do
  `docs/demo.md`, e pedido de acesso da #104). Aprovar no Slack real exigiria um botão interativo, com o recurso de
  interatividade do app do Slack apontando para o servidor; isso fica fora do MVP. Com o servidor no ar, o
  encaminhamento sai no Slack real e a aprovação continua no simulado.

### 10.2. GitHub

- Leitura: pública, pelo navegador de Puca e pela cópia no servidor. Sem token.
- Primeira tarefa (#114): se Puca precisar agir (comentar ou atribuir a issue da tarefa), um token fine-grained só
  com `issues: write` no `kota-bank`, no servidor. Se a tarefa só for aberta e mostrada, nenhum token.

### 10.3. Notion

- Leitura: cópia local (§9) e o Notion público no navegador de Puca. Sem token no servidor.
- O MCP do Notion continua sendo o caminho dos agentes de desenvolvimento para preencher o kit (#115, #116).

### 10.4. Por que não MCP na hora da sessão

- Nada da sessão precisa de chamada ao vivo ao GitHub ou ao Notion: o conhecimento vem das cópias e as ações são
  poucas e fixas.
- O MCP hospedado do Notion e o do Slack entram com login de pessoa e não servem a um servidor (decisão 0005).
- Listas grandes de ferramentas pioram a escolha do modelo e aumentam o prompt.
- Se no futuro Puca precisar consultar ao vivo, a API da Anthropic conecta direto a servidores MCP remotos, sem
  código nosso. Fica registrado como caminho, fora do MVP.

---

## 11. Segurança e privacidade

| Risco | Proteção |
|---|---|
| Chave de API vazar pelo app | Nenhuma chave paga no app; só o endereço do servidor e a chave pública do Supabase |
| Alguém gastar as chaves pelo servidor público | Travas diárias globais por provedor (LLM, TTS, STT); limite por pessoa; limite por IP e captcha no login anônimo (§5.3). O token do Supabase sozinho não basta: contas anônimas são de graça |
| Um jurado ver dados de outro | Login anônimo por instalação + RLS por `auth.uid()` no Supabase. No Slack, que todos os jurados compartilham, o encaminhamento só vai por mensagem direta ao próprio jurado, sem o nome digitado; nunca em canal (§10.1) |
| Puca agir fora do mundo da Kota | Lista de endereços permitidos no navegador de Puca (§4.7) |
| Conteúdo do LLM injetar HTML na página | DOMPurify em todo cartão (§4.4) |
| Mensagem indevida no Slack | Bot com escopos mínimos, só mensagem direta ao próprio jurado, `id` contra duplicata, limite de 10 por hora |
| Senhas | Puca nunca digita senha nem guarda teclas |
| Avaliação de desempenho | O rastro e o painel descrevem o processo, nunca dão nota à pessoa (`PRODUCT.md` §5 e §12.2) |
| Dados reais | Só dados sintéticos, e-mails em `kota.example` (decisão 0005) |

---

## 12. Observabilidade e custo

- **Logs:** Pino do Fastify, lidos com `fly logs`. Sem transcrição completa no log; só ids, rotas e tempos.
- **Tempo por turno:** `turn_timing` (§8) e os benches existentes (`bench:llm`, `bench:turn`).
- **Rastro:** cada decisão de Puca, agora com as ações no navegador e o link do encaminhamento.
- **Custo da sessão (#94):** tokens do `usage` do LLM, caracteres do TTS, minutos do Deepgram, somados por sessão.
- **Custo fixo do mês:** Fly (uma máquina pequena, poucos dólares), Supabase Pro durante a avaliação, ElevenLabs no
  plano pago; LLM e Deepgram por uso.

---

## 13. Repositório, scripts e variáveis

### 13.1. Pastas novas

| Pasta ou arquivo | O que é |
|---|---|
| `desktop/` | o app Electron (§3.2) |
| `scripts/instalar.sh` | o instalador pelo terminal |
| `server/Dockerfile`, `fly.toml` | o deploy do servidor |
| `supabase/migrations/` | as tabelas e as regras de acesso |
| `.github/workflows/release-mac.yml` | o build do app a cada tag |

### 13.2. Dependências novas

| Pacote | Onde | Para quê |
|---|---|---|
| `electron`, `electron-builder`, `esbuild` | dev | o app e o empacotamento |
| `@anthropic-ai/sdk` | servidor | o LLM |
| `@supabase/supabase-js` | front e servidor | login, dados e Storage |
| `jose` | servidor | conferir o token do Supabase |
| `@fastify/rate-limit`, `@fastify/cors` | servidor | limite de uso e origem |
| `dompurify` | app | sanitizar cartões |
| busca de texto (ex.: `minisearch`) | servidor | índice do kit (§9) |

### 13.3. Variáveis

| Variável | Onde | Pública? |
|---|---|---|
| `ANTHROPIC_API_KEY` | servidor (`fly secrets`, `server/.env`) | não |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` | servidor | não |
| `DEEPGRAM_API_KEY` | servidor | não |
| `SLACK_BOT_TOKEN` | servidor | não |
| `GITHUB_TOKEN` (só se §10.2 precisar) | servidor | não |
| `SUPABASE_URL`, `SUPABASE_JWKS_URL` | servidor | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor (Storage, idempotência dos encaminhamentos) | não |
| `LIMITE_DIARIO_LLM`, `LIMITE_DIARIO_TTS`, `LIMITE_DIARIO_STT` | servidor | — |
| `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | app (no build) | sim |
| `API_TARGET` | só o `npm run dev` no navegador: para onde o Vite repassa `/api` (padrão `http://localhost:8787`; `npm run dev:fly` usa o Fly) | sim |

`FEATHERLESS_API_KEY`, `FEATHERLESS_BASE_URL` e `LLM_MODEL` saem quando o cliente da Anthropic estiver na `main`.

---

## 14. O que muda nas regras, no produto e nos contratos

Cada mudança vai pelo caminho certo, num PR próprio:

| O quê | Onde | Como |
|---|---|---|
| "O servidor só dá voz e LLM" → "voz, LLM e as ações nos sistemas da Kota" | `CLAUDE.md` | skill `nova-regra` |
| Encaminhamento no Slack real da Kota, não no simulado; o Orbis é um app para Mac | `PRODUCT.md` §12.2 (e onde citar a `live-session`) | skill `contexto-base` |
| Computer use: `AcaoDaPuca`, `AcaoDaPessoa`, `window.orbis` | `docs/contratos.md` (sai de "Contratos que vão surgir") | skill `contrato` |
| Encaminhamento: destino, `id`, link do Slack, `POST /api/encaminhamentos` | `docs/contratos.md` | skill `contrato` (combinar com #104 e #125) |
| API do servidor: token obrigatório, rotas novas | `docs/contratos.md` | skill `contrato` |
| Progresso e memória: tabelas do Supabase e fila local | `docs/contratos.md` | skill `contrato` |
| Perfil e calibragem saem do `sessionStorage` para o `localStorage` | linhas "Perfil" e "Calibragem" de `docs/contratos.md`, `docs/journey-format.md` | skill `contrato`, com a #18 |
| Primeira tarefa: a aprovação do gestor continua no Slack simulado; se um dia for para o Slack real, muda o contrato | linha "Primeira tarefa" de `docs/contratos.md` | skill `contrato`, quando for o caso |
| Featherless sai; a chave obrigatória passa a ser a da Anthropic | `docs/desenvolvimento.md` (seção do servidor), `server/.env.example` | na #128 |
| Como rodar o app, o servidor e o deploy | `docs/desenvolvimento.md`, `docs/demo.md` | no PR de cada parte |

---

## 15. Ordem de implementação

Pela prioridade do hackathon: primeiro o que o jurado precisa para abrir o Orbis, depois o que faz a demo acontecer.

**Fase 1, fundação (em paralelo):**

| Frente | Entrega | Issue |
|---|---|---|
| App | `desktop/` abrindo o front, microfone, `npm run dev:app`, empacotamento, `instalar.sh`, release por tag | #47 |
| Servidor | Fly no ar, chaves, token do Supabase obrigatório, limite de uso, cache de áudio no Storage | #124 |
| Login e dados | projeto Supabase, login anônimo, tabelas e RLS, fila local de sincronização | #18 |
| LLM | cliente da Anthropic atrás do `LlmEvent`, bench com `--provider` | #128 |

**Fase 2, o que a demo mostra:**

| Frente | Entrega | Issue |
|---|---|---|
| Navegador de Puca | ações da §4.3, camada, fila interrompível, modos, guarda | #123 |
| Slack real | `POST /api/encaminhamentos`, mensagem de Puca no canal, link aberto no navegador de Puca | #118, #129 |
| Conhecimento | índice do kit, citação conferida | #25, #26, #27 |
| Kota | jornada, perfis e dados da Kota no Orbis | #120 |

**Fase 3, acabamento:** painel (#19), checagem com corretor separado, normalizador e WebSocket reserva da voz, guia
de uso (#119), teste de instalação em outro Mac seguindo só o guia.

---

## 16. Contas e chaves

| Conta | Estado em 2026-11-08 |
|---|---|
| Anthropic (Claude) | ok |
| Supabase | ok |
| ElevenLabs (plano pago) | Starter, 40 mil caracteres por mês, renova dia 7 (#151); a trava `LIMITE_DIARIO_TTS` do `fly.toml` segue essa cota |
| Deepgram (papel Member) | ok segundo Joaquim; a chave não estava no `server/.env` desta máquina na hora do bench |
| Slack da Kota (workspace e app) | #118 |
| Notion da Kota | ok (Kota Workspace) |
| GitHub `kota-bank` | ok (público) |
| Fly.io | sendo criada |

---

## 17. Riscos e plano B

| Risco | Sinal | Plano B |
|---|---|---|
| O app não abre no Mac do jurado | teste em outro Mac (Fase 3) | o mesmo front pelo navegador, com computer use simulado |
| Fly fora do ar ou lento | `/api/health`, `bench:turn` | trocar de região; no limite, servidor local com `npm run dev:server` para a apresentação |
| Supabase pausado ou fora | sincronização falhando | a sessão segue pelo `localStorage`; sincroniza quando voltar |
| Slack sem login no navegador de Puca | página de login no navegador | mensagem enviada pelo servidor e mostrada num cartão |
| Site muda e Puca não acha o alvo | ação falha no rastro | Puca fala onde fica sem apontar; alvos por texto, não por coordenada |
| Latência do LLM sobe | `turn_timing` | ponte + rotas locais da `route.ts` continuam respondendo; a trava diária protege o custo |
| Gasto fora do previsto | painel dos provedores | trava diária, limites por pessoa, cache de áudio |
