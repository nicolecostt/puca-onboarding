# puca-onboarding

Front do **Orbis**, produto de onboarding e transição entre equipes. A agente que conversa com a pessoa é a **Puca**.
Visão do produto em [`PRODUCT.md`](PRODUCT.md); glossário em [`CONTEXT.md`](CONTEXT.md).

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

Trabalhando com agentes de programação (Claude Code, Codex…): regras do time em [`AGENTS.md`](AGENTS.md).

## Estrutura

```
index.html               lista das telas (página inicial do npm run dev)
DESIGN.md                sistema visual: preto, branco e a cor da Puca; tipos, componentes e regras
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
    landing/             apresentação do Orbis e da Puca (só preto, branco e a cor da Puca)
    onboarding-call/     call inicial: a Puca conversa com a pessoa e grava a calibragem; no fim, abre as boas-vindas
    boas-vindas/         "Oi, {nome}": ir para o início ou refazer a call inicial
    inicio/              início do Orbis: progresso, perfil, tarefas, acessos e ligar para a Puca
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
    agent-cursor/        cursor da Puca (seta + "Puca") mexendo na tela, por enquanto simulado
    journey-panel/       painel "Sua jornada" da sessão: objetivo, momentos marcados pela calibragem e próximos passos
  journey/               jornada da sessão em JSON: tipos, validador, motor, perfil, calibragem, jornada da pessoa e intenções (pulo, perguntas)
    data/                jornadas em JSON (kota.journey.json é a demo)
  lib/                   código compartilhado
    events.ts            eventos tipados (callbar:*, chatpanel:*, onboarding:*)
    draggable.ts         arrastar elementos fixos pela tela
    agent-visual.ts      contrato do visual do agente + carregador opcional
    dom.ts               utilitários de DOM
kit/kota/                kit da Kota (docs/kit-da-kota.md): o mapa (pessoas, times, sistemas, ADRs e RFCs), os
                         geradores do CODEOWNERS e dos READMEs de serviço e o check:kota (npm run check:kota -- --repo <checkout do Kota>)
sandbox/                 testes locais, fora do git (ex.: visual da Puca)
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
cp server/.env.example server/.env   # chaves: Featherless (obrigatória), Deepgram e ElevenLabs (voz, opcionais)
npm run dev:server   # API em :8787 (o Vite repassa /api)
npm run dev          # abre a lista de telas → "Sessão no quadro" → "Começar sessão com voz"
npm run precompute -- --only pontes   # pré-gera áudio (pontes|faq|roteiro; --dry mostra o custo em caracteres)
npm run bench:llm    # latência do LLM por modelo/config → server/bench/results/
npm run bench:turn   # tempo até a Puca começar a responder, por caminho (--tts mede o áudio também)
```

Regra: a resposta nunca espera o LLM. Cada fala (voz ou chat) passa por `src/journey/route.ts`, nesta ordem:
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
fly deploy           # gera a imagem, pré-gera o áudio da jornada no Supabase Storage (release_command) e sobe
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

## Visual da Puca

A Puca aparece como uma esfera de pontos com uma faixa em onda, sem rosto (`src/lib/puca-sphere.ts`),
carregada por `loadAgentVisual()` em todas as telas: landing, call inicial, sessão e tela de auxílio. Ela inclina na direção
do mouse, os pontos perto do cursor crescem e um clique solta uma ondulação. Os estados `idle`/`think`/`talk`
mudam a velocidade e a forma da onda. A faixa é um arco-íris metálico gerado no canvas; a cor dos pontos de fundo fica em `tokens.css` (`--puca-sphere-dot`) e o arco-íris usado fora da esfera em `--puca-holo-stops`. A esfera só anima quando está na tela. Se o visual não carregar, fica um círculo neutro.

## Sessão no quadro

A tela `src/screens/lesson/` roda a jornada em JSON (`src/journey/data/kota.journey.json`): a Puca fala, o quadro
(`src/components/whiteboard/`) vai se montando e a pessoa responde pelas respostas sugeridas, pelo chat ou tocando no quadro.
Pelo chat ela também pode pedir para mudar de assunto ou fazer perguntas, que a Puca responde com o conhecimento da sessão.
A conversa ainda é simulada (sem LLM nem voz); o motor (`src/journey/runner.ts`) não depende da tela.

- O perfil vem da call inicial: no fim dela, as boas-vindas levam ao início, e "Começar a sessão" abre a sessão.
- `?perfil=ana` (recém-contratada: passa pela parte institucional) ou `?perfil=bruno` (mudando de time: vai direto ao time).
- `?auto=1` responde sozinho, para apresentar sem mexer no mouse.

Para uma sessão nova, crie outro `*.journey.json` em `src/journey/data/`. Formato em [`docs/journey-format.md`](docs/journey-format.md).
