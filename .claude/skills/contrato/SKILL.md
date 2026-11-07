---
name: contrato
description: Use quando uma mudança altera um formato que outra parte do código ou outra pessoa usa — tipos da jornada (src/journey/types.ts), eventos em src/lib/events.ts, perfil, tipos de src/data/types.ts, opções de uma função mount… de componente, o contrato do visual da Puca — ou quando for definir um formato novo (ex.: request/response de LLM ou backend). Não use para mudanças internas de um arquivo que ninguém mais importa.
argument-hint: "[qual contrato e o que muda]"
---

# Mudar ou criar um contrato

Mudança: $ARGUMENTS

> **Base do sistema:** o glossário do `CONTEXT.md` já está no seu contexto (o `CLAUDE.md` importa); use os termos dele.
> Quando o conceito existe no glossário, o nome do tipo, campo ou evento segue o termo dele. Confira no `PRODUCT.md` se o formato atende o que a funcionalidade promete (ex.: fonte junto da resposta, §4.3). Se o pedido contradiz o `PRODUCT.md`, pare e mostre a contradição. Se algo novo precisa entrar na base, use a skill `contexto-base`.

A lista de contratos e quem depende de cada um está em `docs/contratos.md`. Comece por ela.

## Passos

1. **Ache todos os usos.** Busque no `src/` o tipo, o nome do evento ou o campo (ex.: `grep -rn "journey:step" src`).
   Liste quem lê e quem escreve.
2. **Classifique.**
   - *Compatível*: campo novo opcional, evento novo, valor novo num union que ninguém faz `switch` exaustivo.
   - *Quebra*: renomear, remover, tornar obrigatório, mudar significado ou unidade.
3. **Escreva o contrato antes do código.** Mostre o tipo novo e um exemplo válido (JSON ou chamada de `emit`).
   Se for um contrato novo entre duas pessoas (ex.: front ↔ backend), combine esse exemplo com a outra pessoa antes de implementar.
   Quem trabalha no outro lado pode usar o exemplo como mock enquanto isso.
4. **Aplique no mesmo PR:** tipo, todos os usos, `docs/contratos.md` e, para jornada, também `validate.ts`, um teste em
   `src/journey/__tests__/` e a seção de `docs/journey-format.md`. A demo `tail.journey.json` tem que continuar válida.
5. **Verifique** com `npm run check`.

## Saída

- Contrato, antes → depois (tipo ou exemplo)
- Compatível ou quebra
- Arquivos que dependem e foram ajustados
- Linha para o PR: `⚠️ quebra contrato: <qual>` quando for quebra

## Armadilhas

- `tsc` não pega JSON de jornada errado: só o validador e os testes pegam.
- Evento novo precisa entrar no `DocumentEventMap`, senão `emit` e `addEventListener` perdem o tipo.
- Os textos da jornada usam `{nome}`, `{time}`, `{gestor}`… do perfil: renomear campo do perfil quebra a interpolação sem erro de tipo.
