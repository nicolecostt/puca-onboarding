---
name: Orbis
description: A Puca conduz sessões no quadro para quem chega no time; preto no branco, e a única cor é a dela.
colors:
  ink: "#0a0a0a"
  ink-button: "#171717"
  sketch: "#1e1e1e"
  paper: "#ffffff"
  grey-text: "#737373"
  grey-dim: "#949494"
  grey-subtle: "#a3a3a3"
  rule: "#e5e5e5"
  surface-muted: "#f5f5f5"
  app-bg: "#f6f6f6"
  board: "#fcfcfa"
  board-dot: "rgba(0, 0, 0, 0.07)"
  puca-sphere-dot: "#c9c9c9"
  danger: "#e40014"
  danger-soft: "#d12d26"
  danger-text: "#b91c1c"
  danger-bg: "#fef2f2"
typography:
  display:
    fontFamily: "Creato Display, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(44px, 6.6vw, 92px)"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Creato Display, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(32px, 3.6vw, 52px)"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Creato Display, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(19px, 1.7vw, 24px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  lead:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
  node:
    fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  node-pill: "22px"
  pill: "999px"
spacing:
  mobile-side: "16px"
  gutter: "24px"
  side: "40px"
  section: "clamp(96px, 12vw, 168px)"
  container: "1280px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-primary-sm:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "38px"
  node:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.node}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  node-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
  node-black-box:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.grey-text}"
    rounded: "{rounded.lg}"
  node-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
---

# Design System: Orbis

## Overview

**Creative North Star: "O cartaz e a única cor"**

Um cartaz tipográfico suíço: papel branco, tinta preta, cinzas só para o que é secundário ou inativo, fios de 1px marcando a grade, e um único objeto colorido: a Puca. Tudo o que não é a Puca é monocromático; o arco-íris metálico dela (a faixa da esfera de pontos, o anel `--puca-holo`, as partículas) aparece em poucos pontos, e é justamente essa raridade que faz o olho achar a Puca na tela.

Na landing o mundo é plano e editorial: Creato Display grande alinhada à esquerda numa grade de 12 colunas, listas separadas por fios, nenhum fundo colorido, nenhuma sombra. Nas telas do app (sessão, call) o mesmo mundo vale para cor e acabamento, com uma densidade de ferramenta: quadro pontilhado, nós contornados em tinta, e sombras suaves só nos componentes que flutuam sobre o quadro.

O estado nunca depende de cor: lê-se pela marca. Nó cheio é o escolhido pela pessoa, contorno sólido é provado, tracejado é caixa preta ou selo inferido, contorno grosso com visto é acerto, contorno duplo cinza é alerta, e o anel arco-íris é o que a Puca está explicando agora. Vermelho fica reservado para erro e para encerrar a call.

**Key Characteristics:**
- Preto, branco e cinza; a cor é só a da Puca, em poucos pontos.
- Estado pela marca (cheio, vazado, tracejado), nunca pela cor.
- Grade de 12 colunas com fios de 1px; tipo display grande alinhado à esquerda.
- Títulos em Creato Display (self-hosted), corpo em Inter, nomes de sistema em JetBrains Mono.
- Superfícies da landing planas; sombras suaves só em componentes flutuantes do app.

## Colors

Monocromático com uma única voz colorida: a Puca.

### Primary
- **Tinta** (ink): texto, títulos, botões, contorno e preenchimento dos nós, fios fortes (topo das listas e colunas). Na landing é a tinta de tudo.
- **Tinta de botão** (ink-button): o preto dos botões escuros, do logo e do cursor da Puca nas telas do app (`--color-ink`).

### Secondary
- **Arco-íris da Puca** (`--puca-holo-stops`, usado num gradiente cônico em HSL de 330° a 270° com saturação 60–80% e luminosidade 52–68%, girando com `holo-spin` em 6s): a esfera de pontos (faixa gerada no canvas em `hsl(h, 0.75, 0.64)`), o anel de foco do nó que a Puca está explicando, o anel da orbe pequena e as partículas do fundo (`hsla(h, 75%, 62%, 0.25–0.75)`). Não é um valor sólido: é sempre o gradiente ou o tom girando. Os stops exatos ficam em `src/styles/tokens.css`.

### Tertiary
- **Vermelho de erro** (danger, danger-soft, danger-text, danger-bg): só erro e o botão de encerrar a call. Nunca decorativo, nunca para estado de jornada.

### Neutral
- **Papel** (paper): fundo da landing, interior dos nós e cartões.
- **Cinza de texto** (grey-text): texto de apoio, linhas das habilidades, links da navegação em repouso, legendas, responsável no cartão do nó.
- **Cinza apagado** (grey-dim): texto grande inativo (habilidades não ativas), com contraste 3:1 no branco; também a etiqueta pequena dentro do nó escolhido.
- **Cinza sutil** (grey-subtle): ícones e pontos inativos no app.
- **Fio** (rule): fios de 1px entre linhas, seções, navegação e rodapé.
- **Superfície cinza** (surface-muted), **fundo do app** (app-bg), **fundo do quadro** (board) com o **pontilhado** (board-dot, 1px a cada 18px): camadas tonais do app.
- **Ponto da esfera** (puca-sphere-dot): os pontos de fundo da esfera, só `#rrggbb` porque o canvas lê o valor.

### Named Rules
**The Única Cor Rule.** A única cor fora do preto, branco e cinza é o arco-íris da Puca, e ele marca a Puca: a esfera, o foco dela no quadro, as partículas. Nada mais ganha cor de marca, nem botão, nem link, nem fundo.

**The Marca, Não Cor Rule.** Estado se lê pela marca: cheio (escolhido), contorno sólido (provado), tracejado (caixa preta / selo inferido), contorno grosso com visto (acerto), contorno duplo cinza (alerta), anel arco-íris (foco da Puca). Se um estado só se distingue pela cor, está errado.

**The Vermelho Só Para Parar Rule.** Vermelho é erro e encerrar. Só isso.

## Typography

**Display Font:** Creato Display (OTF 400, 500 e 700, self-hosted em `src/assets/fonts`, licença OFL), com Inter de fallback
**Body Font:** Inter (com ui-sans-serif, system-ui)
**Label/Mono Font:** JetBrains Mono para nomes de sistema nos nós e no cartão do nó; Kalam é a letra à mão do quadro no app

**Character:** Creato Display dá o peso de cartaz, apertada (−0.02em) e balanceada; Inter faz o trabalho calado do texto; o mono marca o que é nome técnico real (`pos-gateway`, `transactions.authorized`).

### Hierarchy
- **Display** (500, clamp(44px, 6.6vw, 92px), 0.98): o título do hero e o do fechamento; até 8 de 12 colunas ou ~14ch. Uma variante de seção atravessa a grade em clamp(40px, 5.6vw, 80px), linha 1, até 18ch.
- **Headline** (500, clamp(32px, 3.6vw, 52px), 1.04): títulos de seção.
- **Title** (500, clamp(19px, 1.7vw, 24px), 1.2, −0.03em): nomes das habilidades; termos de lista em 19px e títulos de coluna em 22px, −0.02em.
- **Body** (400, 16px, 1.55): texto corrido; apoio do hero em 18px, até 52ch, em cinza.
- **Label** (500, 13–15px): barra do quadro, botões (15px; 14px no pequeno), etiquetas (12px), legendas do nó (11px).

### Named Rules
**The Creato Só No Título Rule.** Creato Display é para títulos, marca e nomes grandes de lista; corpo, botões e rótulos ficam em Inter.

## Layout

Grade de 12 colunas (`repeat(12, minmax(0, 1fr))`) com calha de 24px, dentro de um contêiner de até 1280px com 40px de margem lateral (16px e calha de 16px abaixo de 720px). Composições assimétricas: título em 1–8, apoio em 1–7; esfera em 2–5 e lista em 7–11; título de seção em 1–5 e linhas em 7–12. Seções respiram com clamp(96px, 12vw, 168px) de topo; o fechamento tem clamp(112px, 14vw, 200px) antes dele. Abaixo de 1024px os títulos ocupam a largura toda e as colunas viram metades; abaixo de 720px tudo empilha, a navegação some (fica o botão) e o quadro de exemplo vira lista, sem as ligações.

Movimento: entrada de 18px com fade em 0.9s `cubic-bezier(0.16, 1, 0.3, 1)`; botões e nós sobem 2px no hover; a habilidade ativa troca a cada 3.2s, com um fio preto correndo embaixo dela como tempo restante, e pode ser pausada. Com movimento reduzido, entrada, anel e transições param.

## Elevation & Depth

A landing é plana: profundidade vem de fio, contorno e tom, nunca de sombra. A única camada sobreposta é a navegação fixa, papel a 92% com blur de 8px e fio embaixo, e o canvas de partículas atrás de todo o conteúdo. No app, componentes que flutuam sobre o quadro (câmera da Puca, chips, painéis) usam sombras empilhadas suaves e neutras; os nós do quadro usam a sombra "desenhada" leve.

### Shadow Vocabulary
- **Chip** (`box-shadow: 0 1px 1px rgba(0,0,0,0.06), 0 2px 2px rgba(0,0,0,0.06)`): chips e pílulas do app.
- **Card** (`box-shadow: 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05)`): cartões sobre o quadro.
- **Float** (`box-shadow: 0 2px 2px rgba(0,0,0,0.04), 0 4px 4px rgba(0,0,0,0.04), 0 8px 8px rgba(0,0,0,0.04), 0 16px 16px rgba(0,0,0,0.04)`): o que flutua e arrasta.
- **Sketch** (`box-shadow: 2px 3px 0 rgba(0,0,0,0.08)`): a sombra desenhada dos nós no quadro do app.

### Named Rules
**The Cartaz Plano Rule.** Superfícies de apresentação (landing) não têm sombra; separação é fio de 1px ou contorno em tinta. Sombra só em componente que de fato flutua sobre o quadro do app.

## Shapes

Cantos gentis e consistentes: 6px (marca, skip link), 10px (cartão do nó), 12px (nós), 16px (moldura do quadro, câmera), 22px (nós em pílula: fila e DLQ), pílula total para botões e etiquetas, círculo para a esfera e a orbe. Bordas são a linguagem principal: 1px em fio cinza para divisão, 1px em tinta para molduras e topo de listas, 1.5px em tinta nos nós e ligações (`vector-effect: non-scaling-stroke`), tracejado para caixa preta. O anel da Puca fica 7px fora do nó, com 2.5–3px de espessura e raio acompanhando o do nó (+7px).

## Components

### Buttons
Preto, cheio, decidido; um só tipo de botão.
- **Shape:** pílula (999px), 48px de altura (38px no pequeno da navegação).
- **Primary:** tinta com texto papel, Inter 500 15px, padding lateral 24px.
- **Hover / Focus:** sobe 2px em 0.2s com o ease de saída; ativo volta e encolhe para 0.98. Foco: contorno de 2px em tinta a 3px.
- **Link com seta:** texto 500 15px com um traço de 14px depois, que cresce para 26px no hover; altura mínima de 44px. É a ação secundária ao lado do botão.

### Navigation
Fixa no topo, 64px, papel translúcido com blur e fio embaixo. Marca à esquerda (quadrado preto de 24px com a letra, nome em Creato Display 600). Links em Inter 14px cinza, tinta no hover; botão pequeno à direita. No celular, só marca e botão.

### Lista de habilidades (Signature)
Lista ordenada entre fios de 1px. Cada item é um botão: nome em Title; inativos em cinza apagado, ativo em tinta, com a linha de apoio abrindo embaixo (cinza, 15px). Um fio preto corre sob o item ativo marcando o tempo até a próxima; a esfera ao lado muda de estado (fala / pensa) junto. Pausa é um link sublinhado em cinza.

### Nó do quadro (Signature)
- **Padrão:** papel, contorno de 1.5px em tinta, raio 12px, rótulo pequeno em Inter 11px cinza acima do nome em mono 14px.
- **Escolhido pela pessoa:** cheio em tinta, texto papel.
- **Caixa preta:** contorno tracejado, texto cinza.
- **Foco da Puca:** o anel arco-íris girando 7px fora do nó.
- **Cartão do nó:** papel, fio de 1px em tinta, raio 10px, nome em mono 500, responsável em cinza, etiqueta em pílula com contorno de tinta (ex.: provado / inferido).
- **Quadro:** moldura de 1px em tinta, raio 16px, barra superior e legenda separadas por fio, fundo pontilhado (1px a cada 18px).

### Esfera da Puca (Signature)
Esfera de pontos cinza-claros com uma faixa em onda em arco-íris metálico, gerada no canvas; muda de estado (fala, pensa) e reage ao cursor. Em tamanho grande na seção da Puca (4 colunas), e como orbe de 52px com anel `--puca-holo` ao lado da fala no quadro. As partículas do fundo são os pontos da esfera soltos: até 140 pontos de 1.2–3.8px subindo devagar num canvas fixo atrás da página, com o tom girando.

## Do's and Don'ts

### Do:
- **Do** usar só as variáveis de `src/styles/tokens.css`; nada de hex solto.
- **Do** marcar estado por cheio, contorno sólido, tracejado e anel da Puca.
- **Do** reservar o arco-íris para a Puca: esfera, foco no quadro, orbe, partículas.
- **Do** separar conteúdo com fios de 1px (#e5e5e5) e marcar o topo de listas e colunas com fio em tinta.
- **Do** alinhar títulos Creato Display à esquerda na grade de 12 colunas, com tracking negativo.
- **Do** desligar entrada, anel girando e transições com `prefers-reduced-motion`.

### Don't:
- **Don't** dar cor de marca a botão, link, fundo, ícone ou estado de jornada; a cor é da Puca.
- **Don't** usar verde, amarelo ou azul para sucesso, aviso ou info: os tokens de estado são preto e cinza de propósito.
- **Don't** usar vermelho fora de erro e do botão de encerrar.
- **Don't** colocar sombra em superfícies da landing.
- **Don't** usar Creato Display em texto corrido, botões ou rótulos.
