# Camada de resposta de Puca: plano em fases

Índice dos planos que implementam o company brain como base de todas as ações de Puca e o modo sempre na tela. O
desenho (a especificação) é [`desenho.md`](desenho.md). Cada fase tem o seu plano, com tarefas, testes e comandos, e
termina em algo demonstrável com dados reais da Kota.

| Plano | Entrega | Issues | Começa quando |
|---|---|---|---|
| [`1-o-mapa-responde.md`](1-o-mapa-responde.md) | Degrau `intencao` na cascata: "quem cuida", "como se liga" e "mostra o ADR" respondidos pelo mapa, sem LLM e sem servidor; destino do encaminhamento pelo mapa; quadro que acrescenta sistemas | #174, #125 (destino) | Agora |
| [`2-company-brain.md`](2-company-brain.md) | Ingestão do kit (mapa, `kota-bank` num commit fixo, páginas do Notion), índice, busca, conferência do literal; bench de recuperação com perguntas reais | #26, #25 | Agora, em paralelo ao 1 |
| [`3-turno-com-fonte.md`](3-turno-com-fonte.md) | Medição; o `/api/ask` v2: plano do modelo em pedaços conferidos, tipos de resposta, "não sei" separado de "deu erro", executor único no app, fonte no rastro | #27, #25 (medição), nova (`voz`) | Planos 1 e 2 na `main` |
| [`4-mostrar-e-sessao-sob-demanda.md`](4-mostrar-e-sessao-sob-demanda.md) | Fonte aberta e marcada no navegador de Puca; sessão sob demanda com volta ao passo; fontes nos nós da jornada | #27, nova (`app`) | Plano 3 na `main`; `mostrar` também espera a #123 |
| [`5-sempre-na-tela.md`](5-sempre-na-tela.md) | Decisão nova; pílula sempre por cima, atalho, leitura do contexto no chamado (níveis 0, 1 e 2); passagem para a sessão própria | #175 (backlog, `se-der-tempo`) | Backlog: depois do plano 4, com o app Electron (#47) e o navegador de Puca (#123) na `main` |

Os planos 4 e 5 estão no nível de tarefa: arquivos, interfaces e testes. Os passos finos entram quando as dependências
deles chegarem à `main`, porque a forma do navegador de Puca (#123) e do app Electron (#47) ainda pode mudar.

> **Decidido com Joaquim em 2026-11-08:** o modo sempre na tela (plano 5) fica no backlog (#175); a medição do plano 3,
> tarefa 1, registra o resultado mas não trava o plano; o encaminhamento pede confirmação à pessoa antes de sair.

## Ondas e portões

```
Onda 1   plano 1 (app, sem rede) ─┐      plano 2 (servidor, sem LLM) ─┐
                                  │                                   │
Portão 1: na jornada da Kota (#120), "quem cuida do balancereader?" responde pelo mapa, desenha e encaminha certo,
          com `npm run dev` sem servidor; `npm run brain -- "por que o saldo tem cache?"` traz o ADR 0004 com URL e
          linhas; bench de recuperação com acerto nos 3 primeiros ≥ 80% nas perguntas da Kota
                                  │
Onda 2   plano 3 (tarefa 1 mede antes de construir)
                                  │
Portão 2: bench do turno com a 1ª frase conferida em p50 ≤ 1,6 s e literal aceito em ≥ 90% das frases citadas;
          demo: ADR 6 rejeitado dito como rejeitado, bônus → People, servidor parado → frase de falha sem encaminhar
                                  │
Onda 3   plano 4
Backlog  plano 5 (#175), depois da decisão nova integrada
```

Um portão só abre com o comando dele verde e o resultado colado na issue. Os números do portão 1 e do portão 2 são o
ponto de partida. Se a medição mostrar outro patamar, o número muda **na issue**, com o motivo.

## Quem produz e quem consome

Cada arquivo compartilhado tem **um dono**. Os outros só leem.

| Arquivo | Dono | Quem lê |
|---|---|---|
| `src/puca/fontes.ts` (Fonte, Trecho, normalizar, conferir literal) | plano 1 | planos 2, 3, 4 |
| `src/puca/entidades.ts` (ids e reconhecedor do mapa) | plano 1 | planos 2, 3, 5 |
| `src/puca/catalogo.ts` (tipos de resposta, ações, expansão) | plano 1 cria; plano 3 acrescenta o esquema | servidor (plano 3) e app |
| `src/puca/executor.ts` (fila única) | plano 1 cria; plano 3 acrescenta o SSE | telas |
| `server/src/brain/` | plano 2 | plano 3 |
| `server/src/turno/` | plano 3 | `app.ts` |
| `docs/contratos.md`: Encaminhamento, Rota da fala, Rastro | plano 1 | todos |
| `docs/contratos.md`: Company brain | plano 2 | planos 3, 4 |
| `docs/contratos.md`: API do servidor v2 | plano 3 | planos 4, 5 |
| `docs/contratos.md`: Computer use (`window.orbis.janela`, `.tela`) | plano 5 (com a #123) | — |

## Dependências de fora desta pasta

| Issue | O que traz | Quem precisa |
|---|---|---|
| #120 | jornada, perfis e dados da Kota no Orbis | demo dos portões 1 e 2 (o código dos planos 1 a 3 não depende dela) |
| #113, #116 e PR #164 | ADRs, runbooks, READMEs e páginas do Notion da Kota | conteúdo do brain (plano 2 roda com o que já existir) |
| #111 | `kota-bank` público com a marca da Kota | o `Dockerfile` clonar o repositório (plano 2, tarefa 8) |
| #123 | navegador de Puca no app | `mostrar` (plano 4) |
| #47 | app Electron | plano 5 |
| #125, #104 e #129 | destino do encaminhamento (RH, gestor) e envio no Slack real | o contrato Encaminhamento do plano 1 é combinado com as três de uma vez |
| #18 | token do Supabase no front | o `/api/ask` v2 com `req.pessoa` (plano 3) |

## Regras para quem executa

- **Base do sistema.** Antes de cada plano: skill `comecar-tarefa` (issue, branch, escopo). Antes de mudar contrato:
  skill `contrato`. Antes do plano 5: skills `contexto-base` (`PRODUCT.md`) e `nova-regra` (`CLAUDE.md`).
- **Nada mockado.** Testes podem ter exemplos fixos, sempre em `__tests__/` ou ao lado do teste. Código de produção só
  lê o mapa, o `kota-bank` e as páginas reais. Sem fonte configurada, cai no comportamento de hoje, nunca num conteúdo
  de reserva.
- **Commits** no formato do `CLAUDE.md`, em português e sem linha de coautoria.
- **Antes de dizer que terminou:** `npm run check`.
