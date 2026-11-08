# Raia Notion: o Notion da Kota, estruturado, escrito e público

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** o Kota Workspace com a árvore do §3.2, as databases Pessoas, Times, Sistemas e RFCs iguais ao mapa, o conteúdo com cara de empresa real e tudo aberto sem login. Issues #115 e #116.

**Arquitetura:** a árvore e as linhas das databases saem de código (`kit/kota/notion/arvore.ts`) lido do mapa. Cada página nasce em Markdown em `kit/kota/notion/paginas/<chave>.md`, sobe pelo MCP do Notion seguindo um procedimento escrito (`COMO-PREENCHER.md`), e a URL pública de cada chave fica em `kit/kota/notion/urls.json`. Links entre páginas são escritos como `notion:<chave>` e resolvidos na hora de subir.

**Stack:** MCP do Notion (conectado ao Kota Workspace), Markdown, TypeScript com `tsx` e `vitest`.

**Spec:** `docs/kit-da-kota.md` §3.2, §4, §5, §7. Índice: [`README.md`](README.md). Consome do alicerce: `MapaKota`, `mapa`, `caminhoAdr`, `Regra`, `ContextoKota`. Consome da raia repo: `acharMarca` (R2). Se a R2 ainda não entrou no `main` quando a N1 for feita, a regra `paginas` entra sem a checagem de marca e ganha essa checagem num PR curto depois.

## Restrições globais

- Páginas públicas, abrindo sem login.
- Databases iguais ao mapa, com link para a pasta de cada sistema no `kota-bank`. Têm que bater com o `CODEOWNERS`.
- Kota People explica ciclo de desempenho, carreira, promoção, bônus e revisão salarial com o tom da Kota. A política nunca avalia uma pessoa.
- E-mails só `@kota.example` (de pessoas do mapa ou dos aliases).
- Os documentos de bônus, desempenho e afins **existem**: empresa real tem.
- Mudou pessoa, time ou sistema? Muda no `mapa.ts` e sobe de novo. Nunca editar database direto no Notion.
- Quem roda o MCP precisa estar conectado ao Kota Workspace (hoje, a conta do Joaquim). Convidar a pessoa da raia antes.

## Foco de revisão

1. **Página que abre com login para o jurado** (publicada sem as subpáginas, ou URL interna `notion.so`). Esperado: toda URL em `urls.json` é `*.notion.site` e abre numa janela anônima. Teste em N2 (regra) e N4 (conferência).
2. **Link entre páginas quebrado** depois de mover ou recriar uma página. Esperado: links escritos como `notion:<chave>` e resolvidos pelo `urls.json`; chave desconhecida é erro. Teste em N1.
3. **"Qual vai ser o meu bônus?"** Esperado: a página de bônus tem a regra geral e a linha de encaminhamento a People ou ao gestor, que a #125 usa. Teste em N3d (regra de conteúdo).
4. **Subir a mesma página duas vezes** cria duplicata no Notion. Esperado: o procedimento procura pela chave antes de criar e atualiza. Conferido em N2 (Step 5).
5. **E-mail inventado fora do mapa** numa política. Esperado: a regra acusa. Teste em N1.

---

### Task N1: árvore, linhas das databases e regras das páginas

**Files:**
- Create: `kit/kota/notion/arvore.ts`, `kit/kota/notion/links.ts`
- Create: `kit/kota/checar/regras/notion-urls.ts`, `kit/kota/checar/regras/paginas.ts` (registrar em `regras/index.ts`)
- Test: `kit/kota/__tests__/notion.test.ts`

**Interfaces:**
- Produces:

```ts
export type ChaveNotion = string;
export interface NoNotion { chave: ChaveNotion; titulo: string; pai: ChaveNotion | null; tipo: "pagina" | "database" | "linha" }
export const ARVORE: NoNotion[];
export function linhasDatabase(m: MapaKota, db: "pessoas" | "times" | "sistemas" | "rfcs"): Record<string, string | string[] | boolean | number>[];
export function resolverLinks(md: string, urls: Record<ChaveNotion, string>): string;   // [x](notion:<chave>) → URL; chave sem URL lança erro com a chave
```

- `ARVORE`, com estas chaves e pais: `kota` (raiz); filhos de `kota`: `comece-aqui`, `quem-somos`, `pessoas`, `times`, `sistemas`, `jeito-de-trabalhar`, `rfcs`, `politicas`, `kota-people`, `onboarding`, `glossario`. Filhos de `jeito-de-trabalhar`: `rituais`, `code-review`, `deploy`, `incidentes`, `de-rfc-a-adr`, `comunicacao`. Filhos de `politicas`: `seguranca-e-acesso`, `dados-de-cliente-e-lgpd`, `ferias`, `home-office`, `despesas`, `papeis-buddy-gestor-rh`. Filhos de `kota-people`: `ciclo-de-desempenho`, `trilha-de-carreira`, `promocao`, `bonus`, `revisao-salarial`. Filhos de `onboarding`: `onboarding-novo`, `onboarding-transicao`. Linhas de `rfcs`: `rfc-1`, `rfc-2`, `rfc-3`. `pessoas`, `times`, `sistemas` e `rfcs` têm tipo `database`.
- Colunas: Pessoas `Nome, Cargo, Área, E-mail, Slack, Papel` (Papel: multi-seleção `gestor`, `tech lead`, `buddy`). Times `Nome, Missão, Gestor, Tech lead, Buddies, Canal, Canal de ajuda, Plantão` (pessoas pelo nome). Sistemas `Nome, Time, Linguagem, O que faz, Depende de, Pasta no repo, Legado`, com `Pasta no repo = https://github.com/JucaGF/kota-bank/tree/main/<pasta>`. RFCs `Título, Número, Autor, Status, ADR`, com `Status` `virou ADR` ou `rejeitada` (pelo status do ADR) e `ADR = https://github.com/JucaGF/kota-bank/blob/main/<caminhoAdr>`.
- Regra `notion-urls`: toda chave da `ARVORE` tem URL; toda URL é `https://<dominio>.notion.site/...`, com o mesmo domínio.
- Regra `paginas`: toda chave de tipo `pagina` ou `linha` tem `paginas/<chave>.md` (menos `comece-aqui`, que é da C5); todo `notion:<chave>` existe na `ARVORE`; todo e-mail é de uma pessoa do mapa ou de um alias; nenhum `@handle`; `acharMarca` sem ocorrência na pasta; com repo, todo link `github.com/JucaGF/kota-bank/(blob|tree)/main/<caminho>` aponta para caminho que existe.

- [ ] **Step 1: Testes; ver falhar**

```ts
it("toda chave é única e todo pai existe", ...)
it("sistemas têm a pasta no repo como link", () => expect(linhasDatabase(mapa, "sistemas")[0]["Pasta no repo"]).toMatch(/^https:\/\/github\.com\/JucaGF\/kota-bank\/tree\/main\/src\//));
it("uma linha por pessoa, time, sistema e RFC do mapa", ...)
it("RFC 3 aparece como rejeitada e aponta para o ADR 6", ...)
it("resolverLinks troca notion:<chave> pela URL e falha com chave sem URL", ...)   // /notion:ferias sem URL/
it("regra paginas acusa e-mail fora do mapa, @handle e chave inexistente", ...)
it("regra notion-urls acusa URL notion.so e chave sem URL", ...)
```

Run: `npx vitest run kit/kota/__tests__/notion.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementar e ver passar**

Run: `npx vitest run kit/kota/__tests__/notion.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit e PR**

```bash
git commit -m "feat(kit): árvore e databases do notion da kota geradas do mapa"
```

### Task N2: estrutura e databases no Notion

**Files:**
- Create: `kit/kota/notion/COMO-PREENCHER.md` (o procedimento que todo agente segue para subir ao Notion)
- Create: `kit/kota/notion/urls.json`

**Interfaces:**
- Consumes: `ARVORE`, `linhasDatabase`, `resolverLinks` (N1).
- Produces: `kit/kota/notion/urls.json`, `Record<ChaveNotion, string>` com URLs públicas. A raia eng. lê `rfc-1..3`; a C4 e a C5 leem o resto.
- `COMO-PREENCHER.md` fixa: procurar a página pela chave (título) sob o pai antes de criar; se existe, atualizar; criar na ordem da `ARVORE`; databases com as colunas da N1; depois de cada criação, gravar a URL pública (`https://<dominio>.notion.site/<id sem hífens>`) em `urls.json`; conteúdo sobe com `resolverLinks` aplicado; nunca editar a database à mão.

- [ ] **Step 1: Escolher o domínio público do workspace**

Na interface do Notion: Settings → Public pages → domínio (ex.: `kota`). Anotar em `COMO-PREENCHER.md`.

- [ ] **Step 2: Escrever `COMO-PREENCHER.md`**

- [ ] **Step 3: Criar a árvore e as databases pelo MCP, seguindo o procedimento**

Páginas ainda vazias (o conteúdo é a N3), databases já com as linhas de `linhasDatabase`.

- [ ] **Step 4: Conferir**

Run: `npm run check:kota`
Expected: regra `notion-urls` sem erro (todas as chaves com URL `notion.site`).

- [ ] **Step 5: Rodar o procedimento de novo**

Expected: nenhuma página nova no Notion (a busca do `notion-search` pela raiz devolve o mesmo número de páginas antes e depois).

- [ ] **Step 6: Commit e PR; avisar a raia eng. que `rfc-1..3` têm URL**

```bash
git add kit/kota/notion/COMO-PREENCHER.md kit/kota/notion/urls.json
git commit -m "feat(kit): estrutura e databases do notion da kota"
```

### Task N3: conteúdo (cinco PRs, um por grupo de páginas)

Cada grupo é uma tarefa com o mesmo ciclo. Grupos:

- **N3a:** `quem-somos` (missão e 3 ou 4 valores, cada um com um exemplo do dia a dia) e os 6 filhos de `jeito-de-trabalhar` (rituais, code review, deploy, incidentes, como uma decisão vira RFC e depois ADR, que canal para quê). Rituais e canais citam os do mapa.
- **N3b:** `rfc-1`, `rfc-2`, `rfc-3`. Cada RFC tem proposta, alternativas, uma seção "Discussão" com comentários de pessoas do mapa e "Resultado" com link para o ADR (`caminhoAdr`).
- **N3c:** os 6 filhos de `politicas`. Segurança e acesso a produção conversa com o ADR 2 (JWT). Férias tem a regra de quando a pessoa pode tirar férias pela primeira vez, para responder "posso tirar férias no 2º mês?".
- **N3d:** os 5 filhos de `kota-people`. Cada página descreve processo e critérios gerais, sem exemplo de pessoa avaliada. `bonus`, `promocao` e `revisao-salarial` terminam com a linha: `Casos individuais: fale com seu gestor ou com People (people@kota.example).`
- **N3e:** `onboarding-novo`, `onboarding-transicao` (checklist de acessos e primeira semana; a transição vem de Contas para Livro-razão) e `glossario` (livro-razão, saldo, extrato, número de agência, transação).

**Files:** `kit/kota/notion/paginas/<chave>.md` do grupo. Para a N3d, também `kit/kota/checar/regras/kota-people.ts` e o teste em `kit/kota/__tests__/notion.test.ts`.

**Interfaces:**
- Consumes: `resolverLinks`, `COMO-PREENCHER.md`, `urls.json`.
- Produces (N3d): regra `kota-people`: `bonus.md`, `promocao.md` e `revisao-salarial.md` contêm a linha exata de casos individuais.

- [ ] **Step 1 (só N3d): teste da regra `kota-people`; ver falhar; implementar; ver passar**

```ts
it("acusa página de bônus sem a linha de casos individuais", ...)
```

- [ ] **Step 2: Escrever as páginas do grupo em Markdown**

- [ ] **Step 3: Conferir**

Run: `npm run check:kota -- --repo ../kota-bank-oficina`
Expected: regras `paginas` (e `kota-people` na N3d) sem erro.

- [ ] **Step 4: Subir pelo MCP seguindo `COMO-PREENCHER.md` e abrir duas páginas do grupo no Notion**

Expected: texto igual ao Markdown, links entre páginas abrindo a página certa.

- [ ] **Step 5: Commit e PR**

```bash
git add kit/kota/notion/paginas
git commit -m "docs(kit): <grupo> no notion da kota"
```

### Task N4: publicar e conferir sem login

**Files:**
- Create: `kit/kota/notion/conferir-publico.ts`
- Modify: `package.json` (script `"kota:notion-publico": "tsx kit/kota/notion/conferir-publico.ts"`)

**Interfaces:**
- Produces: `conferirPublico(urls: Record<string, string>): Promise<string[]>`: `GET` sem cookie em cada URL; erro se o status não é 200 ou se a resposta redireciona para login. É um primeiro filtro (suposição: o Notion responde assim para página não publicada). A prova é a janela anônima do Step 3.

- [ ] **Step 1: Publicar a página `kota` com as subpáginas** (Share → Publish, com subpáginas incluídas)
- [ ] **Step 2: Rodar o filtro**

Run: `npm run kota:notion-publico`
Expected: nenhuma URL com erro.

- [ ] **Step 3: Janela anônima**

Abrir `kota`, `bonus`, `rfc-1`, `sistemas` e `onboarding-transicao` sem login. Expected: as cinco abrem. Colar os prints na #115.

- [ ] **Step 4: Commit e PR**

```bash
git commit -m "feat(kit): conferência das páginas públicas do notion da kota"
```
