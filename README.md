# puca-onboarding

Front do **Puca**, agente de IA para onboarding e transição entre equipes.
Contexto do produto em [`docs/context.md`](docs/context.md).

Vite + TypeScript, sem framework.

## Rodar

```bash
npm install
npm run dev        # servidor local; abre a lista de telas
npm run typecheck  # checa os tipos
npm run build      # build de produção em dist/
```

## Estrutura

```
index.html               lista das telas (página inicial do npm run dev)
docs/
  context.md             visão do produto
src/
  styles/
    tokens.css           cores, fontes, raios e sombras (tirados do Figma); mude aqui
    base.css             tokens + reset; importado por toda tela
  data/                  dados de exemplo da demo (depois podem vir de uma API)
    types.ts             formatos: perfil, empresa, jornada, aula, quadro
    company.ts           Maré Pagamentos, pessoas e etapas da jornada
    profiles.ts          os dois perfis: ?perfil=bruno (transição) | ?perfil=ana (recém-contratada)
    lessons/             aulas do quadro (nós, setas, falas por trecho, perguntas)
  screens/               uma pasta por tela: index.html + main.ts + style.css
    onboarding-call/     call inicial: o agente entrevista a pessoa
    lesson/              aula no quadro: o quadro se monta junto com a fala
    live-session/        tela de auxílio: barra de call, chat e câmera por cima de uma tela
  components/            peças reutilizáveis (cada uma com .ts, .css e icons/)
    app-header/          topo do app: logo, empresa, etapas da jornada, pessoa
    whiteboard/          quadro da aula, desenhado a partir dos dados
    call-bar/            barra de call flutuante (Figma: "Session control bar")
    chat-panel/          chat flutuante (Figma: "Chat (floating window)")
    agent-cam/           "câmera" do agente no canto da tela
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

## Nova aula no quadro

Crie um arquivo em `src/data/lessons/` no formato de `transaction-path.ts`:
nós (posição no quadro de 1440×844), setas, e os trechos com o que o agente fala
(`say`), o que aparece (`reveal`) e o que fica em foco (`focus`).

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

O visual da Puca (o agente) ainda está em definição. As telas usam um círculo neutro.
Se existir `sandbox/puca-teste.ts` (local, fora do git), ele é carregado no lugar.
