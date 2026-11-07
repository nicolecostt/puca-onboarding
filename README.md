# puca-onboarding

Front do **Puca**, agente de IA para onboarding e transição entre equipes.
Contexto do produto em [`docs/context.md`](docs/context.md).

Vite + TypeScript, sem framework.

## Rodar

```bash
npm install
npm run dev        # servidor local; abre a lista de telas
npm run typecheck  # checa os tipos
npm test           # testes (validador e motor da jornada)
npm run build      # build de produção em dist/
```

## Estrutura

```
index.html               lista das telas (página inicial do npm run dev)
docs/
  context.md             visão do produto
  journey-format.md      formato da jornada (momentos, passos, quadro, transições)
src/
  screens/               uma pasta por tela: index.html + main.ts + style.css
    onboarding-call/     call inicial: o agente entrevista a pessoa
    live-session/        tela de auxílio: barra de call, chat e câmera por cima de uma tela
    aula-quadro/         aula visual: o agente conduz a jornada e monta o quadro
  components/            peças reutilizáveis (cada uma com .ts, .css e icons/)
    call-bar/            barra de call flutuante (Figma: "Session control bar")
    chat-panel/          chat flutuante (Figma: "Chat (floating window)")
    agent-cam/           "câmera" do agente no canto da tela
  journey/               jornada da aula: tipos, validador, motor, perfil e quadro (SVG)
    data/                jornadas em JSON (orla-pagamentos.journey.json é a demo)
    board/               renderizador do quadro
  lib/                   código compartilhado
    events.ts            eventos tipados (callbar:*, chatpanel:*, onboarding:*)
    draggable.ts         arrastar elementos fixos pela tela
    agent-visual.ts      contrato do visual do agente + carregador opcional
    dom.ts               utilitários de DOM
sandbox/                 testes locais, fora do git (ex.: visual da Iris)
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

## Visual do agente

O visual do agente ainda está em definição. As telas usam um círculo neutro.
Se existir `sandbox/iris-teste.ts` (local, fora do git), ele é carregado no lugar.

## Aula no quadro

A tela `src/screens/aula-quadro/` roda uma jornada em JSON (`src/journey/data/`): o agente fala,
o quadro vai sendo montado e a pessoa responde pelos botões, pelo chat ou tocando no quadro.
A conversa ainda é simulada (sem LLM nem voz), e o motor (`src/journey/runner.ts`) não depende da tela.

- O perfil vem da call de entrevista: o link "Começar a aula →" no fim dela abre a aula.
- `?perfil=novo` ou `?perfil=transicao` força um dos perfis de demo; o seletor no topo troca entre eles.
  O recém-contratado passa pela parte institucional; quem está mudando de time pula direto para o time.
- `?auto=1` responde sozinho, para apresentar sem mexer no mouse.

Formato completo em [`docs/journey-format.md`](docs/journey-format.md).
