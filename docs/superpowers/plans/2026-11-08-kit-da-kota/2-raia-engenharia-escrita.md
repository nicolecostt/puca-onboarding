# Raia engenharia escrita: ADRs, runbooks, READMEs e CODEOWNERS da Kota

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** a engenharia da Kota documentada onde um engenheiro procuraria, coerente com o mapa e conferida pelo `check:kota`. Issue #113.

**Arquitetura:** tudo que é fato do mapa (time, responsáveis, canal, dependências, número e título de ADR) sai de gerador ou é conferido por regra. O texto escrito à mão fica fora dos marcadores gerados e só explica.

**Stack:** Markdown na oficina; TypeScript com `tsx` e `vitest` no `puca-onboarding` para geradores e regras.

**Spec:** `docs/kit-da-kota.md` §3.1 e §5. Índice: [`README.md`](README.md). Consome do alicerce: `MapaKota`, `mapa` (com o registro de 7 ADRs e 3 RFCs), `caminhoAdr`, `Regra`, `ContextoKota`, `gerarCodeowners`. Consome da raia repo: `acharMarca`. Consome da raia Notion: `kit/kota/notion/urls.json` com as chaves `rfc-1`, `rfc-2`, `rfc-3`.

## Restrições globais

- 6 a 8 ADRs em `docs/adr/`, cada um ancorado em algo visível no código, incluindo o monolito que virou três serviços e um ADR rejeitado. O registro do mapa tem 7.
- Cada ADR cita o RFC do Notion de onde veio, quando houver.
- 2 ou 3 runbooks em `docs/runbooks/`.
- README em cada serviço: o que faz, time responsável, como rodar e testar, de quem depende.
- Todo responsável citado existe no mapa. Pessoas são citadas pelo nome, nunca por `@handle`.
- Sem linha do tempo fabricada em detalhe: datas de ADR só com ano e mês.
- E3 só começa depois do merge do R2 (troca de marca), porque reescreve READMEs que o R2 altera.

## Foco de revisão

1. **ADR cujo trecho "Onde ver no código" aponta para um caminho que o R2 renomeou** (pacote Java). Esperado: a regra acusa caminho inexistente. Teste em E1.
2. **RFC ainda sem página no Notion.** Esperado: a regra diz "RFC 1 sem URL em urls.json", e não um erro genérico. Teste em E1.
3. **Runbook com comando que não roda** (serviço com outro nome no compose). Esperado: a regra acusa o serviço; cada runbook é executado uma vez. Teste em E2.
4. **README editado à mão dentro dos marcadores.** Esperado: a regra acusa diferença do gerado. Teste em E3.
5. **Alguém troca o tech lead no mapa.** Esperado: rodar os geradores atualiza README e `CODEOWNERS` sem tocar no texto à mão. Teste de idempotência em E3.

---

### Task E1: os 7 ADRs

**Files:**
- Create (oficina): `docs/adr/0001-<slug>.md` a `docs/adr/0007-<slug>.md`
- Create (`puca-onboarding`): `kit/kota/checar/regras/adrs.ts` (registrar em `regras/index.ts`), teste `kit/kota/__tests__/regra-adrs.test.ts`

**Interfaces:**
- Produces: formato de ADR que a C4 (jornada) cita:

```markdown
# ADR-0001: Quebrar o monolito do livro-razão em três serviços

- Status: aceito
- Data: 2024-03
- Time: Livro-razão
- RFC: https://<...>.notion.site/<...>

## Contexto
## Decisão
## Consequências
## Onde ver no código
- `src/ledgermonolith`
- `src/ledger`
```

- Nome do arquivo: `caminhoAdr(a)` do alicerce.
- Produces: regra `adrs` (precisa repo). Para cada `AdrKota`: existe `caminhoAdr(a)` (alicerce); a primeira linha é `# ADR-000N: <titulo>`; `Status` e `Time` (nome do time) iguais ao mapa; com `rfc`, a linha `RFC` é igual a `notionUrls["rfc-N"]`; cada âncora aparece em "Onde ver no código" e existe no repo. Arquivo em `docs/adr/` fora do mapa é erro. Nenhum `@handle`.

- [ ] **Step 1: Testes da regra com um repo temporário; ver falhar**

```ts
it("aceita um ADR igual ao mapa", ...)
it("acusa título diferente do mapa", ...)        // /ADR 1: título "X" no arquivo, "Quebrar..." no mapa/
it("acusa âncora que não existe no repo", ...)   // /ADR 4: âncora src\/ledger\/balancereader não existe/
it("acusa RFC sem URL", ...)                     // /ADR 1: RFC 1 sem URL em urls.json/
it("acusa RFC com URL diferente", ...)
it("acusa arquivo de ADR fora do mapa", ...)
it("acusa @handle", ...)
```

Run: `npx vitest run kit/kota/__tests__/regra-adrs.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementar a regra e ver passar**

Run: `npx vitest run kit/kota/__tests__/regra-adrs.test.ts`
Expected: PASS. Commit: `feat(kit): check:kota confere os adrs com o mapa`.

- [ ] **Step 3: Escrever os ADRs na oficina**

Ler o código de cada âncora antes de escrever. O contexto e as consequências citam o que dá para ver lá (por exemplo, o ADR 6 explica por que o `balancereader` lê o livro-razão por consulta periódica em vez de fila). O ADR 6 tem status rejeitado e diz o que foi proposto e por que não seguiu.

- [ ] **Step 4: Conferir**

Run: `npm run check:kota -- --repo ../kota-bank-oficina`
Expected: a regra `adrs` só acusa `RFC n sem URL` enquanto a N2 não gravar as URLs. Nenhum outro erro.

- [ ] **Step 5: Commit e PR na oficina**

```bash
git -C ../kota-bank-oficina add docs/adr && git -C ../kota-bank-oficina commit -m "docs: decisões de arquitetura da kota"
```

- [ ] **Step 6: Quando a N2 gravar `urls.json`, preencher as linhas `RFC` e rodar o Step 4 de novo**

Expected: regra `adrs` sem erro.

### Task E2: runbooks

**Files:**
- Create (oficina): `docs/runbooks/subir-do-zero.md`, `docs/runbooks/trocar-chave-jwt.md`, `docs/runbooks/ledger-db-cheio.md`
- Create (`puca-onboarding`): `kit/kota/checar/regras/runbooks.ts`, teste `kit/kota/__tests__/regra-runbooks.test.ts`

**Interfaces:**
- Consumes: nomes de serviço do `docker-compose.yml` (R1), `scripts/verificar-local.sh`.
- Produces: seções fixas em todo runbook: `## Quando usar`, `## Antes de começar`, `## Passos` (comandos em bloco `bash`), `## Como saber que deu certo`, `## Quem chamar` (time e `canalAjuda` do mapa).
- Produces: regra `runbooks` (precisa repo). Todo `docker compose <subcomando> <serviço>` dos blocos cita um serviço que existe no `docker-compose.yml`; todo caminho entre crases existe; `Quem chamar` cita um `canalAjuda` do mapa; as 5 seções existem.

- [ ] **Step 1: Testes da regra; ver falhar**

```ts
it("acusa serviço que não existe no compose", ...)   // /trocar-chave-jwt\.md: serviço "jwt" não existe no docker-compose\.yml/
it("acusa seção faltando", ...)
it("acusa canal que não é de nenhum time", ...)
```

- [ ] **Step 2: Implementar e ver passar**

Run: `npx vitest run kit/kota/__tests__/regra-runbooks.test.ts`
Expected: PASS. Commit: `feat(kit): check:kota confere os runbooks com o compose`.

- [ ] **Step 3: Escrever os três runbooks e executar cada um no banco local**

`trocar-chave-jwt` apaga as chaves do volume pelo serviço `jwt-chaves`, sobe de novo e mostra que o login volta a funcionar (sessões antigas caem). `subir-do-zero` usa `docker compose down -v` e `scripts/verificar-local.sh`. `ledger-db-cheio` mede o tamanho do banco com `psql` dentro do `ledger-db` e diz o que fazer.

Run: os comandos de cada runbook, em ordem, e depois `scripts/verificar-local.sh`
Expected: todos rodam; a fumaça passa no fim. Colar a saída no PR.

- [ ] **Step 4: Conferir e fazer o PR**

Run: `npm run check:kota -- --repo ../kota-bank-oficina`
Expected: regra `runbooks` sem erro. Commit: `docs: runbooks da kota`.

### Task E3: READMEs dos serviços e CODEOWNERS (depois do merge do R2)

**Files:**
- Create (`puca-onboarding`): `kit/kota/gerar/readme-servico.ts`, teste `kit/kota/__tests__/readme-servico.test.ts`, regra `kit/kota/checar/regras/readmes.ts`
- Modify (`puca-onboarding`): `package.json` (script `"kota:readmes": "tsx kit/kota/gerar/readme-servico.ts"`)
- Modify ou Create (oficina): `<pasta>/README.md` dos 10 sistemas, `.github/CODEOWNERS`

**Interfaces:**
- Produces: `blocoServico(m: MapaKota, sistemaId: string): string` e `aplicarBlocos(raiz: string, m: MapaKota): string[]` (devolve os READMEs alterados). O bloco fica entre `<!-- kota:servico:inicio -->` e `<!-- kota:servico:fim -->`, logo abaixo do título `# <id>`, com as linhas, nesta ordem: `**Time:** <nome> (<canal>)`, `**Responsáveis:** <nome do tech lead> (tech lead), <nome do gestor> (gestor)`, `**Depende de:** <ids separados por vírgula, ou "nada">`, `**Como rodar:** \`docker compose up --build <id>\``, `**Como testar:** \`scripts/testar.sh <id>\`` (ou `sem testes automatizados` para quem não está em `COM_TESTES = ["userservice","contacts","ledgerwriter","balancereader","transactionhistory"]`).
- Produces: regra `readmes` (precisa repo). Todo sistema tem README com o bloco igual ao gerado e uma seção `## O que faz`.

- [ ] **Step 1: Testes; ver falhar**

```ts
it("bloco com time, canal, responsáveis e dependências do mapa", ...)
it("sistema sem testes diz 'sem testes automatizados'", ...)
it("troca só o bloco e mantém o texto escrito à mão", ...)
it("rodar de novo não muda nada", ...)
it("cria README que não existe com título e bloco", ...)
it("regra acusa bloco editado à mão", ...)
```

Run: `npx vitest run kit/kota/__tests__/readme-servico.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementar e ver passar**

Run: `npx vitest run kit/kota/__tests__/readme-servico.test.ts`
Expected: PASS. Commit: `feat(kit): blocos dos readmes de serviço da kota gerados do mapa`.

- [ ] **Step 3: Aplicar na oficina e escrever o texto de cada serviço**

Run: `npm run kota:readmes -- ../kota-bank-oficina && npm run kota:codeowners -- ../kota-bank-oficina/.github/CODEOWNERS`

Depois, à mão e fora do bloco, em cada README: `## O que faz` (a partir de `oQueFaz` e do código), `## Como funciona` (curto), `## Decisões` (links para os ADRs cujas âncoras incluem a pasta). O README do `ledgermonolith` diz que é legado e aponta o ADR 1. Texto que sobrou do upstream e não vale para a Kota sai.

- [ ] **Step 4: Conferir**

Run: `npm run check:kota -- --repo ../kota-bank-oficina`
Expected: regras `readmes`, `codeowners`, `marca` sem erro.

- [ ] **Step 5: Commit e PR na oficina**

```bash
git -C ../kota-bank-oficina add -A && git -C ../kota-bank-oficina commit -m "docs: readme de cada serviço e codeowners da kota"
```
