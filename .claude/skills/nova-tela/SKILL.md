---
name: nova-tela
description: Chame automaticamente para criar uma tela nova em src/screens/ ou um componente novo em src/components/ — ex.: "cria a tela do painel do gestor", "faz um componente de cartão". Cobre os arquivos, o registro no build e o reuso dos componentes. Não use para ajustes dentro de uma tela que já existe.
argument-hint: "[nome e objetivo da tela ou componente]"
---

# Criar tela ou componente

Pedido: $ARGUMENTS

> **Base do sistema:** o glossário do `CONTEXT.md` já está no seu contexto (o `CLAUDE.md` importa); use os termos dele.
> Antes de desenhar, leia no `PRODUCT.md` o cenário ou a funcionalidade que a tela atende. Textos da interface usam os termos do glossário (ex.: pessoa, sessão, quadro, encaminhamento). Se o pedido contradiz o `PRODUCT.md`, pare e mostre a contradição. Se algo novo precisa entrar na base, use a skill `contexto-base`.

## Tela nova

1. `src/screens/<nome>/` com `index.html`, `main.ts` e `style.css`. Copie a estrutura de uma tela parecida.
   O `index.html` carrega `<script type="module" src="./main.ts">`; o `main.ts` importa `../../styles/base.css`
   e `./style.css`.
2. Registre a entrada em `vite.config.ts` (`rollupOptions.input`). **Sem isso, a tela funciona no `dev` e some no build.**
3. Adicione o link na lista do `index.html` da raiz, com título e uma linha de descrição.
4. Reaproveite componentes (`mountChatPanel`, `mountCallBar`, `mountAppHeader`…) em vez de copiar HTML.
5. Atualize a árvore de `src/screens/` em `docs/desenvolvimento.md`.

## Componente novo

1. `src/components/<nome>/` com `<nome>.ts`, `<nome>.css` e `icons/` se tiver SVG.
2. Exporte uma função `mount<Nome>(opções)` que recebe o que precisa e devolve o controle (métodos) para a tela.
3. Para avisar a tela de algo, dispare um evento tipado: declare em `src/lib/events.ts` e use `emit(...)`.
   Isso é contrato: veja a skill `contrato`.
4. Atualize a árvore de `src/components/` em `docs/desenvolvimento.md`.

## No app para Mac

As telas rodam dentro do app Electron ([`docs/stack.md`](../../../docs/stack.md) §3 e §4, decisão 0008).

- Recurso do app (navegador de Puca, microfone do sistema) só com `if (window.orbis)`. Sem ele, no `npm run dev` do
  navegador, a tela continua funcionando com o simulado de hoje.
- Antes de usar `window.orbis`, o formato dele (e o tipo no `Window`) tem que estar na seção "Computer use" de
  `docs/contratos.md`, pela skill `contrato`. Enquanto não estiver, a tela só reserva a área e segue com o simulado.
- O navegador de Puca é desenhado **por cima** do HTML do Orbis. Tela que mostra o navegador (a `live-session`) reserva
  uma área para ele, mede com `getBoundingClientRect` + `ResizeObserver` e chama `window.orbis.navegador.mostrar(bounds)`.
  Barra de call, chat e câmera ficam em volta dessa área, nunca por cima. O Slack simulado de hoje continua com os
  controles por cima: a regra vale para o navegador de verdade.
- O que Puca desenha sobre um site (cursor, círculo, cartão) fica na camada do app, não no front.

## Regras de visual

- Cores, fontes, raios e sombras só por variáveis de `src/styles/tokens.css`. Valor novo entra lá, não solto no CSS.
- Se veio do Figma, cite no comentário o nome do frame (como `call-bar` faz com "Session control bar").

## Verificar

`npm run check` (pega a tela esquecida no build) e abra a tela no `npm run dev`, com o console sem erro.
