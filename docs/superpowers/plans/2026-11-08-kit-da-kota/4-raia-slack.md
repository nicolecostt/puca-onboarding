# Raia Slack: o workspace da Kota com canais e histórico

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** um workspace gratuito da Kota com um app do Slack e um script que cria os canais dos times e posta um histórico com nome e foto de pessoas da Kota. Issue #118, só a parte de preenchimento.

**Arquitetura:** o script fala com a API do Slack por uma interface pequena (`SlackApi`), para os testes rodarem com uma versão falsa. Antes de qualquer escrita ele confere que o token é do workspace da Kota. Canais e autores vêm do mapa; as mensagens, de um arquivo de dados.

**Stack:** API Web do Slack (`fetch`), TypeScript com `tsx` e `vitest`.

**Spec:** `docs/kit-da-kota.md` §7 e §7.1. Índice: [`README.md`](README.md). Consome do alicerce: `MapaKota`, `mapa` (canais, nomes, avatares).

## Restrições globais

- API do Slack direto, com app e token de bot. Nunca o MCP do Slack: o conectado hoje é de uma empresa real e **não** pode receber nada do kit.
- Escopos: os do `docs/stack.md` §10.1, e nada além: `chat:write`, `chat:write.customize`, `im:write`, `users:read` e `users:read.email` (a mensagem direta do servidor, #129) e `channels:manage` (este script). Nada de ler mensagens: o script não repete trabalho porque só posta em canal que ele acabou de criar.
- Token fora do repositório: variável `SLACK_BOT_TOKEN`, o mesmo nome que o servidor usa (`docs/stack.md` §10.1 e tabela de variáveis). No servidor, vai nos `fly secrets` (decisão 0006). O encaminhamento pelo servidor é a #129, não esta raia.
- Pessoas da Kota não são membros reais: mensagens saem com `username` e `icon_url` da pessoa do mapa.
- O link de convite vai no guia de uso; quem tiver o link entra no workspace onde o bot age.

## Foco de revisão

1. **Token de outro workspace no ambiente** (por exemplo, o da empresa real). Esperado: o script para antes de criar ou postar qualquer coisa. Teste em S2.
2. **Rodar o script duas vezes.** Esperado: nenhum canal ou mensagem duplicada. Teste em S2.
3. **Mensagem com autor que não está no mapa.** Esperado: erro antes de postar a primeira mensagem. Teste em S2.
4. **Limite de requisições do Slack** (`429` com `Retry-After`). Esperado: espera o tempo pedido e tenta de novo. Teste em S2.
5. **Token commitado por engano.** Esperado: `.env` e afins já são barrados pelo harness do repo; o script só lê do ambiente. Conferido em S1.

---

### Task S1: workspace e app

**Files:**
- Create: `kit/kota/slack/manifest.yml`, `kit/kota/slack/workspace.json`

**Interfaces:**
- Produces: `workspace.json` no formato `{ "teamId": "T...", "nome": "Kota", "convite": "https://join.slack.com/..." }`. O S2 confere o `teamId`; a C5 usa o `convite`.

- [ ] **Step 1: Criar o workspace gratuito "Kota" (manual) e o app a partir de `manifest.yml`**

O manifesto declara o nome do app, um bot user e só os escopos das restrições.

- [ ] **Step 2: Instalar o app e conferir o token**

Run: `curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" https://slack.com/api/auth.test`
Expected: `"ok":true` e o `team_id` do workspace Kota. Gravar em `workspace.json` com o link de convite.

- [ ] **Step 3: Commit (sem token) e PR**

Run antes: `git diff --cached | grep -c xoxb-`
Expected: `0`.

```bash
git add kit/kota/slack/manifest.yml kit/kota/slack/workspace.json
git commit -m "chore(kit): app do slack da kota"
```

### Task S2: script de preenchimento

**Files:**
- Create: `kit/kota/slack/preencher.ts`, `kit/kota/slack/historico.ts`, `kit/kota/slack/api.ts`
- Test: `kit/kota/__tests__/slack.test.ts`
- Modify: `package.json` (script `"kota:slack": "tsx kit/kota/slack/preencher.ts"`)

**Interfaces:**
- Produces:

```ts
export interface SlackApi {
  authTest(): Promise<{ teamId: string }>;
  criarCanal(nome: string): Promise<{ id: string } | { jaExiste: true }>;   // name_taken vira jaExiste
  postar(m: { canalId: string; texto: string; username: string; iconUrl: string }): Promise<void>;
}
export interface MensagemKota { canal: `#${string}`; autor: string; texto: string }   // autor = id de PessoaKota
export const HISTORICO: MensagemKota[];
export function slackDeVerdade(token: string): SlackApi;   // fetch na API Web; em 429, espera Retry-After e repete
export function preencherSlack(api: SlackApi, m: MapaKota, historico: MensagemKota[], teamIdEsperado: string):
  Promise<{ canaisCriados: string[]; canaisPulados: string[]; mensagens: number }>;
```

- Canais: `#geral`, `#people` (o canal do RH) e `canal` e `canalAjuda` de cada time do mapa. O encaminhamento de Puca não passa por esses canais: vai por mensagem direta ao próprio jurado, dizendo a quem iria na Kota (`docs/stack.md` §10.1, `PRODUCT.md` §5). Todos os jurados entram no mesmo workspace.
- Só posta em canal criado na mesma execução. Se a execução cair no meio de um canal, apague o canal no Slack (arquivado, o nome continua ocupado) e rode de novo.
- Histórico: 5 a 10 mensagens por canal de time, coerentes com o Notion e o repo (aviso de deploy, uma dúvida respondida com link para um ADR, um incidente leve citando o runbook `ledger-db-cheio`). Ninguém marca ninguém com `@`.

- [ ] **Step 1: Testes com uma `SlackApi` falsa em memória; ver falhar**

```ts
it("para sem escrever nada se o token é de outro workspace", async () => {
  await expect(preencherSlack(falsa({ teamId: "TOUTRO" }), mapa, HISTORICO, "TKOTA")).rejects.toThrow(/workspace TOUTRO não é o da Kota/);
  expect(falsa.escritas).toEqual([]);
});
it("cria só os canais que faltam", ...)
it("não posta em canal que já existia", ...)            // criarCanal devolve jaExiste; canaisPulados contém "#livro-razao"
it("posta com nome e avatar da pessoa do mapa", ...)    // username = nome, iconUrl = avatar
it("falha antes de postar se um autor não está no mapa", ...)
it("toda mensagem do HISTORICO tem autor do mapa e canal existente", ...)
it("slackDeVerdade espera o Retry-After num 429", ...)  // fetch falso: 429 com Retry-After 1, depois 200
```

Run: `npx vitest run kit/kota/__tests__/slack.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementar e ver passar**

Run: `npx vitest run kit/kota/__tests__/slack.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Rodar no workspace da Kota, duas vezes**

Run: `npm run kota:slack` e de novo `npm run kota:slack`
Expected: a primeira cria os canais e posta; a segunda informa todos os canais pulados e `mensagens: 0`. Abrir `#livro-razao` no Slack e conferir nomes e fotos. Colar a saída e um print na #118.

- [ ] **Step 4: Commit e PR**

```bash
git add kit/kota/slack kit/kota/__tests__/slack.test.ts package.json
git commit -m "feat(kit): canais e histórico do slack da kota"
```
