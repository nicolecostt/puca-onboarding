# puca-onboarding

Front da **Lousa**, produto de onboarding e transição entre equipes. A agente que conversa com a pessoa é a **Puca**.
Visão do produto em [`PRODUCT.md`](PRODUCT.md); glossário em [`CONTEXT.md`](CONTEXT.md).

Vite + TypeScript, sem framework.

## Rodar

```bash
npm install
npm run dev        # servidor local; abre a lista de telas
npm run typecheck  # checa os tipos
npm test           # testes (validador e motor da jornada)
npm run build      # build de produção em dist/
npm run check      # typecheck + testes + build (o que o CI roda em cada PR)
```

Trabalhando com agentes de programação (Claude Code, Codex…): regras do time em [`AGENTS.md`](AGENTS.md).

## Estrutura

```
index.html               lista das telas (página inicial do npm run dev)
docs/
  journey-format.md      formato da jornada (momentos, passos, quadro, transições)
src/
  styles/
    tokens.css           cores, fontes, raios e sombras (tirados do Figma); mude aqui
    base.css             tokens + reset; importado por toda tela
  data/                  dados de exemplo da demo (depois podem vir de uma API)
    types.ts             formatos: perfil, empresa, jornada, aula, quadro
    company.ts           Tail, pessoas e etapas da jornada
    profiles.ts          os dois perfis: ?perfil=bruno (transição) | ?perfil=ana (recém-contratada)
    lessons/             aulas do quadro (nós, setas, falas por trecho, perguntas)
  screens/               uma pasta por tela: index.html + main.ts + style.css
    onboarding-call/     call inicial: o agente entrevista a pessoa e grava a calibragem
    lesson/              aula no quadro: o quadro se monta junto com a fala
    live-session/        tela de auxílio: barra de call, chat e câmera por cima de uma tela
  components/            peças reutilizáveis (cada uma com .ts, .css e icons/)
    app-header/          topo do app: logo, empresa, etapas da jornada, pessoa
    whiteboard/          quadro da aula (visual do Figma), desenhado a partir da jornada
    call-bar/            barra de call flutuante (Figma: "Session control bar")
    chat-panel/          chat flutuante (Figma: "Chat (floating window)")
    agent-cam/           "câmera" do agente no canto da tela
    agent-cursor/        cursor da Puca (seta + "Puca") mexendo na tela, por enquanto simulado
  journey/               jornada da aula em JSON: tipos, validador, motor, perfil, calibragem e intenções (pulo, perguntas)
    data/                jornadas em JSON (tail.journey.json é a demo)
  lib/                   código compartilhado
    events.ts            eventos tipados (callbar:*, chatpanel:*, onboarding:*)
    draggable.ts         arrastar elementos fixos pela tela
    agent-visual.ts      contrato do visual do agente + carregador opcional
    dom.ts               utilitários de DOM
sandbox/                 testes locais, fora do git (ex.: visual da Puca)
```

## Mudar o visual

- **Cores, fontes, raios, sombras:** `src/styles/tokens.css`. Tudo usa essas variáveis.
- **Um componente ou tela:** o `.css` ao lado do `.ts`. Pode reescrever à vontade.
- **Conteúdo** (falas, perguntas, pessoas, perfis): `src/data/`.

## Agente (servidor)

A aula (`src/screens/lesson/`) continua conduzindo a jornada no browser. O servidor em `server/` (Fastify + TS, sem estado)
dá a voz e o LLM: `POST /api/speak` (fala → áudio ElevenLabs, com cache), `POST /api/ask` (pergunta → ponte na hora + LLM por SSE)
e `POST /api/voice/token` (microfone via Deepgram). Sem o servidor, a aula segue só com legenda e chat.

```bash
cp server/.env.example server/.env   # chaves: Featherless (obrigatória), Deepgram e ElevenLabs (voz, opcionais)
npm run dev:server   # API em :8787 (o Vite repassa /api)
npm run dev          # abre a lista de telas → "Aula no quadro" → "Começar aula com voz"
npm run precompute -- --only pontes   # pré-gera áudio (pontes|faq|roteiro; --dry mostra o custo em caracteres)
npm run bench:llm    # latência do LLM por modelo/config → server/bench/results/
npm run bench:turn   # tempo até a Puca começar a responder, por caminho (--tts mede o áudio também)
```

Regra: a resposta nunca espera o LLM. Cada fala (voz ou chat) passa por `src/journey/route.ts`, nesta ordem:
pulo de assunto → resposta sugerida → nome de um item do quadro → FAQ do nó (nó + intenção) → conhecimento da aula →
FAQ só pelo nome → agente (`/api/ask`: fala-ponte na hora + LLM em streaming, frase a frase para o TTS).

Sem chave de TTS, a tela usa a voz do browser. Sem chave de STT, use o campo de texto.

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
carregada por `loadAgentVisual()` em todas as telas: call inicial, aula e sessão ao vivo. Ela inclina na direção
do mouse, os pontos perto do cursor crescem e um clique solta uma ondulação. Os estados `idle`/`think`/`talk`
mudam a velocidade e a forma da onda. As cores ficam em `tokens.css` (`--puca-sphere-*`). Se o visual não carregar, fica um círculo neutro.

## Aula no quadro

A tela `src/screens/lesson/` roda a jornada em JSON (`src/journey/data/tail.journey.json`): a Puca fala, o quadro
(`src/components/whiteboard/`) vai se montando e a pessoa responde pelas respostas sugeridas, pelo chat ou tocando no quadro.
Pelo chat ela também pode pedir para mudar de assunto ou fazer perguntas, que a Puca responde com o conhecimento da aula.
A conversa ainda é simulada (sem LLM nem voz); o motor (`src/journey/runner.ts`) não depende da tela.

- O perfil vem da call de entrevista: o link "Começar a aula →" no fim dela abre a aula.
- `?perfil=ana` (recém-contratada: passa pela parte institucional) ou `?perfil=bruno` (mudando de time: vai direto ao time).
- `?auto=1` responde sozinho, para apresentar sem mexer no mouse.

Para uma aula nova, crie outro `*.journey.json` em `src/journey/data/`. Formato em [`docs/journey-format.md`](docs/journey-format.md).
