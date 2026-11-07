---
name: nova-tela
description: Use para criar uma tela nova (página) em src/screens/ ou um componente novo em src/components/. Cobre os arquivos, o registro no build e o reuso dos componentes existentes. Não use para ajustes dentro de uma tela que já existe.
argument-hint: "[nome e objetivo da tela ou componente]"
---

# Criar tela ou componente

Pedido: $ARGUMENTS

## Tela nova

1. `src/screens/<nome>/` com `index.html`, `main.ts` e `style.css`. Copie a estrutura de uma tela parecida.
   O `index.html` carrega `<script type="module" src="./main.ts">`; o `main.ts` importa `../../styles/base.css`
   e `./style.css`.
2. Registre a entrada em `vite.config.ts` (`rollupOptions.input`). **Sem isso, a tela funciona no `dev` e some no build.**
3. Adicione o link na lista do `index.html` da raiz, com título e uma linha de descrição.
4. Reaproveite componentes (`mountChatPanel`, `mountCallBar`, `mountAppHeader`…) em vez de copiar HTML.
5. Atualize a árvore de `src/screens/` no `README.md`.

## Componente novo

1. `src/components/<nome>/` com `<nome>.ts`, `<nome>.css` e `icons/` se tiver SVG.
2. Exporte uma função `mount<Nome>(opções)` que recebe o que precisa e devolve o controle (métodos) para a tela.
3. Para avisar a tela de algo, dispare um evento tipado: declare em `src/lib/events.ts` e use `emit(...)`.
   Isso é contrato: veja a skill `contrato`.
4. Atualize a árvore de `src/components/` no `README.md`.

## Regras de visual

- Cores, fontes, raios e sombras só por variáveis de `src/styles/tokens.css`. Valor novo entra lá, não solto no CSS.
- Se veio do Figma, cite no comentário o nome do frame (como `call-bar` faz com "Session control bar").

## Verificar

`npm run check` (pega a tela esquecida no build) e abra a tela no `npm run dev`, com o console sem erro.
