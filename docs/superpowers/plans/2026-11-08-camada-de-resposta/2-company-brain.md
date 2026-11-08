# Plano 2 — Company brain: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para executar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para
> acompanhar o andamento.

**Objetivo:** o servidor tem o kit da Kota (mapa, `kota-bank` num commit fixo, páginas do Notion) quebrado em trechos
com fonte, num índice em memória. Ele acha o trecho que responde a uma pergunta em milissegundos, confere uma citação
ao pé da letra e diz de que fonte é uma URL. Nada chama GitHub nem Notion durante a sessão.

**Arquitetura:** `server/src/brain/` lê as fontes no boot e monta `Trecho[]` com os tipos de `src/puca/fontes.ts`
(plano 1). Uma busca de texto (MiniSearch, com tratamento de português) fica atrás da interface `CompanyBrain`, que é
assíncrona e recebe quem pergunta e o contexto, para a permissão por pessoa entrar depois sem mudar quem chama.

**Tecnologia:** TypeScript, Fastify, Vitest, `minisearch` (dependência nova, com decisão registrada).

**Especificação:** [`desenho.md`](desenho.md) (seções "Dados" e "O company brain" no "Uso").

## Restrições globais

- Fontes reais: `kit/kota/mapa.ts`, `kit/kota/notion/urls.json`, `kit/kota/notion/paginas/*.md` (PR #164) e o
  `kota-bank` num commit fixo. Até o `kota-bank` público ter o código (#111), o desenvolvimento usa uma cópia local
  apontada por `KOTA_BANK_DIR`. Sem ela, o brain sobe só com mapa e Notion, e loga isso.
- Do `kota-bank` entram só `src/**/*.{java,py}`, `**/README.md`, `docs/adr/*.md`, `docs/runbooks/*.md` e `CODEOWNERS`.
  **Nunca** `extras/`, `iac/` nem os outros `docs/`, que falam de outra empresa e de outra infraestrutura.
- **Invariante:** o texto normalizado de todo trecho é substring da fonte normalizada. A ingestão confere e recusa o
  trecho que quebrar.
- **Fontes do GitHub:** o literal é conferido contra o texto cru, e a URL abre com `?plain=1#Lx-Ly` (Markdown) ou
  `#Lx-Ly` (código), presa ao commit. **Fontes do Notion:** contra o texto visível (sem marcação, com os
  `notion:<chave>` resolvidos), e a URL vem de `urls.json`.
- **Âncora estável:** caminho de títulos ou símbolo. Nunca número de linha nem ordinal.
- A busca não chama a rede e leva menos de 20 ms no p95 com o kit inteiro.

## Foco da revisão

1. **Markdown com bloco de código** que contém `#`: o `#` dentro de crases não abre título novo. Teste na tarefa 2.
2. **Seção longa** (runbook com 3 páginas): é quebrada em trechos de até ~1.200 caracteres, cada um com âncora
   própria e estável. Teste na tarefa 2.
3. **Java com anotação e genérico** (`@Override public ResponseEntity<?> getBalance(...)`): vira um trecho com o
   símbolo `Classe.metodo`. Teste na tarefa 3.
4. **Pergunta com acento e sem acento** ("transação" e "transacao") acha o mesmo trecho. Teste na tarefa 5.
5. **Pasta fora da lista** (`extras/`, `iac/`) nunca vira trecho, mesmo com README. Teste na tarefa 4.

---

### Tarefa 1: Decisão da busca e contrato "Company brain"

**Arquivos:**
- Criar: `docs/decisoes/<próxima livre>-busca-do-company-brain.md`
- Modificar: `docs/contratos.md` (o "Company brain" sai de "Contratos que vão surgir" e ganha linha na tabela e uma
  seção com um `Trecho` e uma `CitacaoConferida` de exemplo)

- [ ] **Passo 1: escrever a decisão.**
  - **Contexto:** a #25 e a `docs/stack.md` §9.
  - **Decisão:** busca de texto em memória com MiniSearch, tratamento de português próprio e índice montado no boot.
    Vetores só se a medição com perguntas reais falhar.
  - **Consequências:** dependência nova no servidor, e o `Dockerfile` passa a levar o kit.
  - **Medição a fazer:** o portão 1 do README e o plano 3, tarefa 1, que compara com o Notion inteiro no prompt.
- [ ] **Passo 2:** chamar a skill `contrato` e escrever a seção com `CompanyBrain` (assinaturas da tarefa 6) e os
  exemplos.
- [ ] **Passo 3:** `npm run check:contexto` passa.
- [ ] **Passo 4:** commit `docs(decisoes): busca do company brain em memória` e
  `docs(contratos): company brain com trechos e citação conferida`.

### Tarefa 2: Trechos de Markdown (`server/src/brain/markdown.ts`)

**Arquivos:**
- Criar: `server/src/brain/markdown.ts`
- Teste: `server/src/brain/markdown.test.ts`

**Interfaces:**
- Consome: `Fonte`, `Trecho` e `normalizar` de `src/puca/fontes.ts`.
- Produz:
  ```ts
  /** Um trecho por título (h1–h3); seção longa vira vários, cortados em parágrafo. `modo` decide o texto guardado. */
  export function trechosDeMarkdown(texto: string, fonte: Fonte, modo: "cru" | "visivel"): Trecho[];
  export function textoVisivel(md: string): string;   // sem #, **, `, links viram só o texto, listas sem marcador
  ```

- [ ] **Passo 1: escrever os testes que falham**

```ts
it("um trecho por título, com âncora pelo caminho de títulos e linhas", () => {
  const ts = trechosDeMarkdown("# ADR 4\n\n## Contexto\nO saldo é lido.\n\n## Decisão\nCache em memória.\n", fonte, "cru");
  expect(ts.map((t) => t.id)).toEqual([`${fonte.id}#adr-4`, `${fonte.id}#adr-4/contexto`, `${fonte.id}#adr-4/decisao`]);
  expect(ts[1].linhas).toEqual([3, 4]);
});
it("# dentro de bloco de código não abre título", () => {
  const ts = trechosDeMarkdown("## Rodar\n```sh\n# comentário\nnpm test\n```\n", fonte, "cru");
  expect(ts).toHaveLength(1);
});
it("seção longa vira vários trechos de até ~1.200 caracteres, com âncora estável pelo começo do parágrafo", () => {
  const ts = trechosDeMarkdown(`## Passos\n${paragrafos(6, 400)}`, fonte, "cru");
  expect(ts.length).toBeGreaterThan(1);
  expect(ts.every((t) => t.texto.length <= 1300)).toBe(true);
  expect(trechosDeMarkdown(`## Passos\n${paragrafos(6, 400)}`, fonte, "cru").map((t) => t.id)).toEqual(ts.map((t) => t.id));
});
it("todo trecho é substring da fonte, normalizada", () => {
  const md = readFileSync(caminhoDeUmaPaginaReal, "utf8");   // kit/kota/notion/paginas/deploy.md (PR #164)
  for (const t of trechosDeMarkdown(md, fonteNotion, "visivel")) expect(normalizar(textoVisivel(md))).toContain(normalizar(t.texto));
});
```

  `fonte`, `fonteNotion` e `paragrafos(n, tamanho)` são ajudantes do próprio teste. O último teste lê uma página real e
  é pulado com `it.skipIf` enquanto o PR #164 não estiver na `main`.

- [ ] **Passo 2:** `npx vitest run server/src/brain/markdown.test.ts`. Esperado: FAIL.
- [ ] **Passo 3: implementar.**
  - Varre as linhas guardando se está dentro de bloco de código.
  - A âncora é o slug (sem acento, minúsculas, hífens) dos títulos até ali, separados por `/`.
  - O corte de seção longa acontece no fim de parágrafo. A âncora da parte é a da seção + `~` + slug das 5 primeiras
    palavras do parágrafo.
  - `entidades` vem de `reconhecer` (plano 1, tarefa 3).
- [ ] **Passo 4:** rodar de novo. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(brain): trechos de markdown por título, com âncora estável`.

### Tarefa 3: Trechos de código (`server/src/brain/codigo.ts`)

**Arquivos:**
- Criar: `server/src/brain/codigo.ts`
- Teste: `server/src/brain/codigo.test.ts`

**Interfaces:**
- Produz:
  ```ts
  /** Um trecho por classe e por método/função; o resto do arquivo (imports, constantes) vira o trecho `#arquivo`. */
  export function trechosDeCodigo(texto: string, fonte: Fonte, linguagem: "java" | "python"): Trecho[];
  ```

- [ ] **Passo 1: escrever os testes que falham**, com trechos curtos escritos no próprio teste:
  - **Java:** classe com método anotado e genérico → âncoras `#BalanceReaderController` e
    `#BalanceReaderController.getBalance`, com as linhas certas.
  - **Python:** `class` com `def` aninhado e um `def` solto → `#UserService.create_user` e `#main`.
  - **Comentário com chave:** em Java, um `{` dentro de string ou comentário não quebra o casamento de chaves.
- [ ] **Passo 2:** rodar o teste. Esperado: FAIL.
- [ ] **Passo 3: implementar.** Java: regex de declaração mais contagem de chaves que ignora strings e comentários.
  Python: `class` e `def` por indentação. O símbolo é `Classe.metodo`. `entidades` = `sistemaDaPasta(caminho)` mais
  `reconhecer(texto)`.
- [ ] **Passo 4:** rodar o teste. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(brain): trechos de código por classe e método`.

### Tarefa 4: Ler o kit (`server/src/brain/kit.ts`)

**Arquivos:**
- Criar: `server/src/brain/kit.ts`
- Teste: `server/src/brain/kit.test.ts`

**Interfaces:**
- Consome: tarefas 2 e 3; `trechosDoMapa`, `sistemaDaPasta` (plano 1); `caminhoAdr` (`kit/kota/tipos.ts`).
- Produz:
  ```ts
  export async function lerKotaBank(o: { dir: string; commit: string; repo: string; mapa: MapaKota }): Promise<Trecho[]>;
  export async function lerPaginasDoNotion(o: { dir: string; urls: Record<string, string>; mapa: MapaKota }): Promise<Trecho[]>;
  ```

- [ ] **Passo 1: escrever os testes que falham.** Uma pasta temporária criada no teste imita o `kota-bank`, com
  `docs/adr/0006-fila-…md`, `src/ledgermonolith/README.md`, `extras/x/README.md` e `src/ledger/balancereader/A.java`.
  - **ADR rejeitado:** o ADR 6 sai com `situacao: "rejeitado"`, pelo `mapa.adrs` e por `caminhoAdr`.
  - **Legado:** o README do `ledgermonolith` sai com `situacao: "legado"`.
  - **Fora da lista:** nada de `extras/`.
  - **URL presa ao commit:** `https://github.com/JucaGF/kota-bank/blob/<commit>/docs/adr/0006-…md?plain=1#L…`.
  - **Página do Notion:** `notion:deploy` com a URL de `urls.json["deploy"]`.
  - **Integração:** com `KOTA_BANK_DIR` definido, um teste lê o diretório real e confere a invariante em todos os
    trechos. Sem a variável, ele é pulado.
- [ ] **Passo 2:** rodar o teste. Esperado: FAIL.
- [ ] **Passo 3:** implementar com `node:fs/promises` e a lista de inclusão das restrições globais. `versao` é o commit
  (`kota-bank`) ou o hash do arquivo (Notion).
- [ ] **Passo 4:** rodar o teste. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(brain): ler o kota-bank num commit fixo e as páginas do notion do repo`.

### Tarefa 5: Índice (`server/src/brain/indice.ts`)

**Arquivos:**
- Criar: `server/src/brain/indice.ts`
- Modificar: `package.json` (`minisearch` em `dependencies`)
- Teste: `server/src/brain/indice.test.ts`

**Interfaces:**
- Produz:
  ```ts
  export interface Achado { trecho: Trecho; nota: number }
  export interface Indice { buscar(texto: string, o: { entidades: EntidadeId[]; limite: number }): Achado[] }
  export function criarIndice(trechos: Trecho[]): Indice;
  export function termosEmPortugues(texto: string): string[];   // normalizar, separar camelCase e snake_case, tirar stopwords, plural simples
  ```

- [ ] **Passo 1: escrever os testes que falham**, sobre `trechosDoMapa` reais mais dois trechos de Markdown escritos no
  teste:
  - **Acento:** "transação" e "transacao" dão o mesmo `termosEmPortugues`.
  - **Identificador:** `BalanceReader` vira `balance` e `reader`.
  - **Busca:** "quem cuida do saldo?" traz `mapa:sistemas/balancereader#linha` entre os 3 primeiros.
  - **Entidade em foco:** com `entidades: ["sistema:contacts"]`, o trecho do `contacts` sobe para o 1º lugar numa
    pergunta vaga ("o que isso faz?").
  - **Tempo:** 2.000 trechos sintéticos, 100 buscas, p95 < 20 ms.
- [ ] **Passo 2:** rodar o teste. Esperado: FAIL.
- [ ] **Passo 3:** implementar com MiniSearch (`processTerm` = `termosEmPortugues`, campos `texto` e `titulo` com peso
  2 no título). Trecho com entidade em comum com `o.entidades` ganha ×1,5 na nota.
- [ ] **Passo 4:** rodar o teste. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(brain): índice de texto em português, com foco nas entidades da fala`.

### Tarefa 6: O brain (`server/src/brain/brain.ts`)

**Arquivos:**
- Criar: `server/src/brain/brain.ts`
- Teste: `server/src/brain/brain.test.ts`

**Interfaces:**
- Consome: tarefas 4 e 5; `conferirLiteral` (plano 1).
- Produz:
  ```ts
  export interface Quem { pessoa: string | null; escopos: string[] }          // hoje ignorado na filtragem; é a porta da permissão
  export interface CompanyBrain {
    versao: string;                                                            // hash do conjunto de trechos
    buscar(c: { texto: string; quem: Quem; contexto: { destino: TimeId; entidades: EntidadeId[] }; limite: number }): Promise<Achado[]>;
    trecho(id: TrechoId): Trecho | null;
    conferir(id: TrechoId, citado: string): CitacaoConferida | null;
    ondeEsta(url: string): { fonte: FonteId; linhas: [number, number] | null; entidades: EntidadeId[] } | null;
  }
  export async function criarBrain(o: { mapa: MapaKota; urls: Record<string, string>; paginas: string | null;
    kotaBank: { dir: string; commit: string } | null }): Promise<CompanyBrain>;
  ```

- [ ] **Passo 1: escrever os testes que falham**
  - **`ondeEsta`, GitHub:** `https://github.com/JucaGF/kota-bank/blob/main/src/ledger/balancereader/X.java#L10-L20`
    devolve `kota-bank:src/ledger/balancereader/X.java`, `[10, 20]` e `sistema:balancereader`.
  - **`ondeEsta`, Notion:** a URL de `urls.json["deploy"]` devolve `notion:deploy`.
  - **`ondeEsta`, fora do kit:** URL de fora devolve `null`.
  - **`conferir`:** um literal do trecho devolve a citação com a URL da fonte; um literal inventado devolve `null`.
  - **`buscar`:** é assíncrono e respeita `limite`.
  - **Sem `kotaBank`:** o brain sobe só com mapa e Notion.
- [ ] **Passo 2:** rodar o teste. Esperado: FAIL.
- [ ] **Passo 3:** implementar. `buscar` usa `contexto.entidades` como foco. `quem` e `contexto.destino` são guardados
  para o filtro de acesso, que hoje deixa passar tudo (`acesso: "kota"`).
- [ ] **Passo 4:** rodar o teste. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(brain): company brain com busca, conferência de citação e fonte de uma url`.

### Tarefa 7: Linha de comando e bench de recuperação

**Arquivos:**
- Criar:
  - `server/scripts/brain.ts`;
  - `server/bench/brain.ts`;
  - `server/bench/perguntas-kota.json`, com pelo menos 20 perguntas reais escritas a partir do kit, cada uma com a
    `fonte` ou o `trecho` esperado.
- Modificar: `package.json` (scripts `brain` e `bench:brain`)

- [ ] **Passo 1: escrever as perguntas a partir do que o kit diz de verdade.**
  - **Conteúdo:** ADRs pelo título e pelas âncoras do mapa; páginas do Notion do PR #164 (deploy, code review, férias,
    bônus); código (cache do saldo, JWT).
  - **Variedade:** perguntas escritas como uma pessoa falaria, com e sem acento, com nome de sistema e com sinônimo
    ("saldo" para `balancereader`).
- [ ] **Passo 2:** `npm run brain -- "por que o saldo tem cache?"` imprime os 5 achados com nota, fonte, URL e linhas.
- [ ] **Passo 3:** `npm run bench:brain` imprime o acerto nos 3 primeiros, o acerto no 1º e o p50/p95 da busca, e
  falha (código ≠ 0) se o acerto nos 3 primeiros ficar abaixo de 80%.
- [ ] **Passo 4:** rodar com `KOTA_BANK_DIR` apontando para a cópia local. Colar o resultado na #25. Se ficar abaixo de
  80%, ajustar `termosEmPortugues` e os pesos antes de seguir. **Não ajustar as perguntas.**
- [ ] **Passo 5:** commit `test(brain): bench de recuperação com perguntas reais da kota`.

### Tarefa 8: O brain no servidor e na imagem

**Arquivos:**
- Modificar:
  - `server/src/env.ts`: `KOTA_BANK_DIR` e `KOTA_BANK_COMMIT` opcionais;
  - `server/src/app.ts`: `buildApp` recebe `brain`; o boot cria o brain e loga quantos trechos, de quais fontes, e a
    `versao`;
  - `server/src/server.ts`;
  - `server/Dockerfile`: `COPY kit ./kit`; `ARG KOTA_BANK_COMMIT`; clonar o `kota-bank` público nesse commit, quando a
    #111 publicar.
- Teste: `server/src/app.test.ts` (o app sobe com um brain só do mapa; `/api/health` responde com `brain: { versao,
  trechos }`)

- [ ] **Passo 1:** escrever o teste do `/api/health` com o brain. Rodar e ver falhar.
- [ ] **Passo 2:** implementar. Sem `KOTA_BANK_DIR`, sobe com mapa e Notion.
- [ ] **Passo 3:** `npm run check` verde. `docker build -f server/Dockerfile .` passa. Sem o `kota-bank` publicado, o
  `ARG` fica vazio e o clone é pulado com aviso no log de build.
- [ ] **Passo 4:** commit `feat(server): o servidor sobe com o company brain do kit da kota`.

### Tarefa 9: Fechamento

- [ ] **Passo 1:** `npm run check` e `npm run bench:brain` verdes, com as saídas na #26 e na #25.
- [ ] **Passo 2:** abrir as issues que faltaram (por exemplo, reindexar sem reiniciar quando o kit mudar).
- [ ] **Passo 3:** PR pela skill `handoff`, com `Closes #26`. A #25 fecha só depois da medição do plano 3, tarefa 1.
