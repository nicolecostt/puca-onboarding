# Desenvolvimento

Como rodar, a estrutura de pastas e onde mexer. O que é o produto está no [`README.md`](../README.md) e no
[`PRODUCT.md`](../PRODUCT.md); o glossário, no [`CONTEXT.md`](../CONTEXT.md).

Vite + TypeScript, sem framework.

## Rodar

```bash
npm install
npm run dev        # servidor local; abre a lista de telas
npm run typecheck  # checa os tipos
npm test           # testes (validador e motor da jornada)
npm run build      # build de produção em dist/
npm run check      # typecheck + testes + base do sistema + harness + build (o que o CI roda em cada PR)
```

Trabalhando com agentes de programação (Claude Code, Codex…): regras do time em [`AGENTS.md`](../AGENTS.md).

## App para Mac

Decisão 0004, `docs/stack.md` §3. O app (`desktop/`) abre o mesmo front por `app://orbis/`; no build, o front chama o
servidor do Fly pelo `VITE_API_URL`.

```bash
npm run dev:fly       # terminal 1: o front, usando o servidor do Fly
npm run dev:app       # terminal 2: o app Electron abrindo o Vite
npm run build:app     # Orbis-mac-arm64.zip e Orbis-mac-x64.zip em release/
```

Em `npm run dev:app`, o macOS pede o microfone em nome do terminal que abriu o app (no VS Code, libere o Visual Studio
Code em Ajustes → Privacidade e Segurança → Microfone). Versão nova do app: com a `main` atualizada, `npm run publicar-app -- 0.1.2` gera os
`.zip`, assina, cria a tag `v0.1.2` e sobe o Release; quem já tem o app roda o comando de instalar de novo.
Sem Mac à mão: no GitHub, Actions → **Publicar o app** → **Run workflow** (branch `main`). Ele roda o `npm run check`
num Mac do GitHub e, se passar, publica a versão `0.2.<n>`. Nada sai sozinho a cada merge. Testar o instalador sem Release: sirva `release/`
(`python3 -m http.server 8000`) e rode `ORBIS_BASE_URL=http://localhost:8000 bash scripts/instalar.sh`.

## Estrutura

```
index.html               lista das telas (página inicial do npm run dev)
DESIGN.md                sistema visual: preto, branco e a cor de Puca; tipos, componentes e regras
docs/
  journey-format.md      formato da jornada (momentos, passos, quadro, transições)
src/
  styles/
    tokens.css           cores, fontes, raios e sombras (tirados do Figma); mude aqui
  assets/fonts/          Creato Display (títulos da landing), com a licença OFL
    base.css             tokens + reset; importado por toda tela
  data/                  dados de exemplo da demo (depois podem vir de uma API)
    types.ts             formatos: perfil, empresa, jornada, sessão, quadro
    company.ts           a Kota (lida do mapa do kit), pessoas e etapas da jornada
    profiles.ts          os dois perfis: ?perfil=bruno (transição) | ?perfil=ana (recém-contratada)
    lessons/             sessões do quadro (nós, setas, falas por trecho, perguntas)
  screens/               uma pasta por tela: index.html + main.ts + style.css
    landing/             apresentação do Orbis e de Puca (só preto, branco e a cor de Puca)
    onboarding-call/     call inicial: Puca conversa com a pessoa e grava a calibragem; no fim, abre as boas-vindas
    boas-vindas/         "Oi, {nome}": ir para o início ou refazer a call inicial
    inicio/              início do Orbis: progresso, perfil, tarefas, acessos e ligar para Puca
    rh/                  painel do RH: indicadores agregados das integrações e pendências (§5)
    lesson/              sessão no quadro: o quadro se monta junto com a fala
    live-session/        tela de auxílio: barra de call, chat e câmera por cima de uma tela
    primeira-tarefa/     página da primeira tarefa (estilo Notion): o que é, quem ajuda e a aprovação do gestor
  components/            peças reutilizáveis (cada uma com .ts, .css e icons/)
    app-header/          topo do app: logo, empresa, etapas da jornada, pessoa
    whiteboard/          quadro da sessão (visual do Figma), desenhado a partir da jornada
    call-bar/            barra de call flutuante (Figma: "Session control bar")
    chat-panel/          chat flutuante (Figma: "Chat (floating window)")
    agent-cam/           "câmera" do agente no canto da tela
    agent-cursor/        cursor de Puca (seta + "Puca") mexendo na tela, por enquanto simulado
    journey-panel/       painel "Sua jornada" da sessão: objetivo, momentos marcados pela calibragem e próximos passos
    escolha-perfil/      os dois cartões da escolha do perfil (nas boas-vindas e por cima da sessão quando ninguém escolheu)
  journey/               jornada da sessão em JSON: tipos, validador, motor, perfil, calibragem, jornada da pessoa e intenções (pulo, perguntas)
    data/                jornadas em JSON (kota.journey.json é a demo)
  lib/                   código compartilhado
    events.ts            eventos tipados (callbar:*, chatpanel:*, onboarding:*)
    draggable.ts         arrastar elementos fixos pela tela
    agent-visual.ts      contrato do visual do agente + carregador opcional
    dom.ts               utilitários de DOM
desktop/                 app para Mac (Electron): janela, app://orbis, microfone, ícone e empacotamento (docs/stack.md §3)
kit/kota/                kit da Kota (docs/kit-da-kota.md): o mapa (pessoas, times, sistemas, ADRs e RFCs), os
                         geradores do CODEOWNERS e dos READMEs de serviço e o check:kota (npm run check:kota -- --repo <checkout do Kota>)
sandbox/                 testes locais, fora do git (ex.: visual de Puca)
```

## Mudar o visual

- **Cores, fontes, raios, sombras:** `src/styles/tokens.css`. Tudo usa essas variáveis.
- **Um componente ou tela:** o `.css` ao lado do `.ts`. Pode reescrever à vontade.
- **Conteúdo** (falas, perguntas, pessoas, perfis): `src/data/`.

## Agente (servidor)

A sessão (`src/screens/lesson/`) continua conduzindo a jornada no browser. O servidor em `server/` (Fastify + TS, sem estado)
dá a voz e o LLM: `POST /api/speak` (fala → áudio ElevenLabs, com cache), `POST /api/ask` (pergunta → ponte na hora + LLM por SSE)
e `POST /api/voice/token` (microfone via Deepgram). Sem o servidor, a sessão segue só com legenda e chat.

```bash
cp server/.env.example server/.env   # chaves: Anthropic (LLM, decisão 0007; sem ela, Featherless), Deepgram e ElevenLabs (voz, opcionais)
npm run dev:server   # API em :8787 (o Vite repassa /api)
npm run dev          # abre a lista de telas → "Sessão no quadro" → "Começar sessão com voz"
npm run dev:fly      # só o front: o Vite repassa /api para o servidor do Fly, sem dev:server nem server/.env
npm run precompute -- --only pontes   # pré-gera áudio (pontes|faq|roteiro; --dry mostra o custo em caracteres)
npm run bench:llm    # latência do LLM por modelo/config → server/bench/results/
npm run bench:turn   # tempo até Puca começar a responder, por caminho (--tts mede o áudio também)
```

Regra: a sessão nunca fica muda (decisão 0012). Com LLM no servidor, cada turno vai ao `/api/turn` e o LLM conduz,
com a jornada como pauta e o Notion da Kota como fonte. Sem LLM (ou com `?modo=roteiro`, `?auto=1`), cada fala (voz ou chat)
passa por `src/journey/route.ts`, nesta ordem:
pulo de assunto → resposta sugerida → dúvida da primeira tarefa (campos da tarefa da pessoa) → nome de um item do quadro →
FAQ do nó (nó + intenção) → conhecimento da sessão → FAQ só pelo nome → agente (`/api/ask`: fala-ponte na hora + LLM em streaming, frase a frase para o TTS).

Sem chave de TTS, a tela usa a voz do browser. Sem chave de STT, use o campo de texto.

### Servidor no Fly.io

Para o jurado, o servidor fica em `https://orbis-puca.fly.dev`: uma máquina sempre ligada (`fly.toml`, `server/Dockerfile`,
`docs/stack.md` §5). Lá toda rota, menos `/api/health`, exige o token do Supabase, com limite por pessoa e trava
diária por provedor (contrato "API do servidor" em `docs/contratos.md`). Localmente, sem `SUPABASE_URL` no `server/.env`,
nada disso vale e tudo continua como acima.

```bash
fly secrets import -a orbis-puca < <(grep -E '^[A-Z_]+=.' server/.env)   # chaves só por fly secrets, nunca no repo
fly deploy           # à mão; a main já sobe sozinha (deploy-servidor.yml). Gera a imagem, pré-gera o áudio da jornada (release_command) e sobe
fly logs             # logs (só ids, rotas e tempos)
npm run bench:turn -- --url https://orbis-puca.fly.dev --token <access_token>   # mede o servidor no ar
npm run contas-demo  # cria ou atualiza as contas fixas da apresentação no Supabase (senha em SENHA_DEMO)
```

## Nova tela

1. Criar `src/screens/<nome>/` com `index.html`, `main.ts` e `style.css`.
2. Adicionar a entrada em `vite.config.ts` e o link em `index.html`.
3. Reaproveitar os componentes:

```ts
import { mountChatPanel } from "../../components/chat-panel/chat-panel";
import { mountCallBar } from "../../components/call-bar/call-bar";

const chat = mountChatPanel({ title: "Transcrição da call", messages: [] });
const call = mountCallBar({ status: "Agente falando…", chat });

document.addEventListener("callbar:pause", (e) => console.log(e.detail.on));
```

## Visual de Puca

Puca aparece como uma esfera de pontos com uma faixa em onda, sem rosto (`src/lib/puca-sphere.ts`),
carregada por `loadAgentVisual()` em todas as telas: landing, call inicial, sessão e tela de auxílio. Ela inclina na direção
do mouse, os pontos perto do cursor crescem e um clique solta uma ondulação. Os estados `idle`/`think`/`talk`
mudam a velocidade e a forma da onda. A faixa é um arco-íris metálico gerado no canvas; a cor dos pontos de fundo fica em `tokens.css` (`--puca-sphere-dot`) e o arco-íris usado fora da esfera em `--puca-holo-stops`. A esfera só anima quando está na tela. Se o visual não carregar, fica um círculo neutro.

## Sessão no quadro

A tela `src/screens/lesson/` roda a jornada em JSON (`src/journey/data/kota.journey.json`): Puca fala, o quadro
(`src/components/whiteboard/`) vai se montando e a pessoa responde pelas respostas sugeridas, pelo chat ou tocando no quadro.
Pelo chat ela também pode pedir para mudar de assunto ou fazer perguntas, que Puca responde com o conhecimento da sessão.
A conversa ainda é simulada (sem LLM nem voz); o motor (`src/journey/runner.ts`) não depende da tela.

O quadro é uma tela infinita, como no Excalidraw (`src/components/whiteboard/camera.ts`): roda ou dois dedos no trackpad
movem; `⌘`/`ctrl` + roda ou pinça dão zoom no cursor; arrastar o fundo, espaço + arrastar ou o botão do meio também
movem. Os controles no canto do quadro (−, zoom, +, Ajustar) e os atalhos `Shift 1` (ver tudo) e `⌘ 0` (100%) fazem o
resto. Clicar num nó continua abrindo o cartão e valendo como toque na checagem; o clique que encerra um arraste não
conta. Se a pessoa afastar o quadro e Puca falar de algo fora da tela, o quadro centra no que ele está mostrando.

- O perfil vem da escolha nas boas-vindas (dois cartões, que mandam `?perfil=` para a call) e da call inicial, que o
  salva (`onboardingStore()`: `localStorage` no app para Mac, `sessionStorage` no navegador); no fim da call, o app abre
  o Início, com a sessão como próximo passo. Aberta sem perfil salvo e sem `?perfil=`, a sessão mostra a mesma escolha antes de o Puca começar. Sem LLM, a call mostra "Seguir para o Início", que segue com o perfil de exemplo de quem foi escolhido.
- `?perfil=ana` (recém-contratada: passa pela parte institucional) ou `?perfil=bruno` (mudando de time: vai direto ao time).
- `?auto=1` responde sozinho, para apresentar sem mexer no mouse.

Para uma sessão nova, crie outro `*.journey.json` em `src/journey/data/`. Formato em [`docs/journey-format.md`](journey-format.md).
