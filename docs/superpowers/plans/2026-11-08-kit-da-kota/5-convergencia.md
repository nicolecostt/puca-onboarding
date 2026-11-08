# Convergência: publicar o kota-bank, primeiras tarefas, Orbis na Kota e guia de uso

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** o `JucaGF/kota-bank` público com histórico da Kota, o catálogo de primeira tarefa, o Notion conferido contra a fonte, o Orbis sem a Tail e o guia de uso que leva o jurado sozinho pelo kit. Issues #111 (histórico), #114, #117, #120, #119.

**Arquitetura:** a oficina é a fonte do código; um script recria o histórico no repo público por fast-forward. As primeiras tarefas são dados (`TAREFAS`) mais dois patches cada, publicadas e verificadas por script. O Orbis passa a ler a empresa do mapa. O `check:kota` com todas as regras é o portão final.

**Stack:** `git`, `gh`, TypeScript com `tsx` e `vitest`, MCP do Notion, skills do time (`nova-jornada`, `contrato`, `checar-demo`).

**Spec:** `docs/kit-da-kota.md` §3.1, §5, §6, §7, §10; `PRODUCT.md` §4.4, §13. Índice: [`README.md`](README.md). Consome: tudo das raias (`mapa`, `caminhoAdr`, `acharMarca`, `ARVORE`, `resolverLinks`, `urls.json`, `workspace.json`, `scripts/testar.sh`, `scripts/verificar-local.sh`).

## Restrições globais

- 15 a 25 commits assinados por pessoas da Kota, organizados por área, sem autores originais e sem linha do tempo fabricada em detalhe (datas reais da publicação).
- Push no repo público só por fast-forward, nunca `--force`, e só com o OK do Joaquim (é publicação).
- 3 a 5 issues de primeira tarefa com label, pelo menos uma no Livro-razão para cada perfil. A `main` fica verde; cada issue aponta para `tarefa/<n>` (teste falhando) e `solucao/<n>` (teste passando).
- Cada issue diz o problema, por que importa, sistemas envolvidos, onde achar informação e quem ajuda (`PRODUCT.md` §4.4). Gestor aprova antes de a pessoa começar.
- Toda fonte que um nó da jornada cita é um arquivo do `kota-bank` ou uma página do Notion da Kota (§10).
- No Orbis: commits `tipo(escopo): mensagem`, sem coautoria; uma issue, uma branch, um PR; skills do time na ordem da tabela do `CLAUDE.md`.

## Foco de revisão

1. **Arquivo da oficina que nenhum passo do histórico cobre** sumiria do repo público. Esperado: o script para antes do primeiro commit e lista os arquivos. Teste em C1.
2. **Branch `tarefa/<n>` que falha pelo motivo errado** (erro de compilação em vez do teste esperado). Esperado: a publicação confere que a saída cita `testeQueFalha` e que o resto passa. Teste em C2.
3. **Nó da jornada que cita um ADR com título antigo** depois de uma mudança no mapa. Esperado: a regra `jornada` acusa. Teste em C4.
4. **Página do Notion editada direto na interface** e diferente da fonte que a Puca lê. Esperado: C3 lista a diferença. Teste em C3.
5. **Jurado sem o Slack ou sem o Orbis instalado** tentando seguir o guia. Esperado: o guia diz o que fazer em cada caso, e o teste na máquina limpa passa por ele. Conferido em C5.

---

### Task C1: publicar o histórico no kota-bank (fecha a #111)

**Files:**
- Create: `kit/kota/historia/plano.ts`, `kit/kota/historia/publicar.ts`
- Create: `kit/kota/checar/regras/autores.ts`
- Test: `kit/kota/__tests__/historia.test.ts`
- Modify: `package.json` (script `"kota:publicar": "tsx kit/kota/historia/publicar.ts"`, argumentos `<oficina> <publico>`)

**Interfaces:**

```ts
export interface PassoHistoria { autor: string; mensagem: string; caminhos: string[] }   // autor = id de PessoaKota; caminhos = globs
export const PLANO_HISTORIA: PassoHistoria[];                                              // 15 a 25 passos
export function arquivosSemPasso(arquivos: string[], plano: PassoHistoria[]): string[];
export function publicarHistoria(oficina: string, publico: string, plano: PassoHistoria[], m: MapaKota): { commits: string[] };
```

- Cada arquivo pertence ao **primeiro** passo cujo glob casa. Para cada passo, em ordem: copia os arquivos dele da oficina para o público, apaga do público o que não existe na oficina (menos `.git`), e commita se houver diferença, com autor e committer = nome e e-mail da pessoa. No fim, as duas árvores têm que ser iguais; senão, erro.
- Ordem do `PLANO_HISTORIA`: base (LICENSE, `pom.xml` raiz, `mvnw`), bancos, Contas, o `ledgermonolith` **antes** dos três serviços do livro-razão (conta a história do ADR 1), Canais, `loadgenerator`, compose e scripts, CI, ADRs (cada um pelo tech lead do time dele), runbooks, READMEs, `CODEOWNERS`. Mensagens em português, `tipo(área): texto`.
- Regra `autores` (precisa repo): todo autor e committer depois do commit raiz termina em `@kota.example`.

- [ ] **Step 1: Testes com repos temporários; ver falhar**

```ts
it("lista arquivos sem passo e não commita nada", ...)
it("um commit por passo com diferença, com autor e committer do mapa", ...)   // git log --format='%an <%ae>|%cn <%ce>'
it("a árvore final é igual à da oficina", ...)
it("rodar de novo não cria commit", ...)
it("passo novo no fim gera só o commit novo", ...)
it("regra autores acusa e-mail fora de kota.example depois do commit raiz", ...)
```

Run: `npx vitest run kit/kota/__tests__/historia.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementar e ver passar; commit**

Run: `npx vitest run kit/kota/__tests__/historia.test.ts`
Expected: PASS. Commit: `feat(kit): histórico do kota-bank gerado a partir da oficina`.

- [ ] **Step 3: Escrever o `PLANO_HISTORIA` e publicar localmente**

Run:
```bash
git clone git@github.com:JucaGF/kota-bank.git ../kota-bank
npm run kota:publicar -- ../kota-bank-oficina ../kota-bank
git -C ../kota-bank log --format='%h %an <%ae> %s' | head -30
npm run check:kota -- --repo ../kota-bank
```
Expected: 15 a 25 commits com autores do mapa; `check:kota` sem erro nas regras de repo (`marca`, `codeowners`, `readme-raiz`, `adrs`, `runbooks`, `readmes`, `autores`).

- [ ] **Step 4: Pedir o OK do Joaquim e fazer o push**

Run: `git -C ../kota-bank push origin main`
Expected: fast-forward aceito; o CI do `kota-bank` (R4) verde em `gh run list -R JucaGF/kota-bank`.

### Task C2: catálogo de primeira tarefa (#114)

**Files:**
- Create: `kit/kota/tarefas/tarefas.ts`, `kit/kota/tarefas/publicar.ts`, `kit/kota/tarefas/<chave>/teste.patch`, `kit/kota/tarefas/<chave>/solucao.patch`
- Test: `kit/kota/__tests__/tarefas.test.ts`
- Modify: `package.json` (script `"kota:tarefas": "tsx kit/kota/tarefas/publicar.ts"`)

**Interfaces:**

```ts
export interface TarefaKota {
  chave: string; titulo: string; time: TimeId; perfis: ("novo" | "transicao")[];
  servico: string; testeQueFalha: string;              // nome do teste como aparece na saída de scripts/testar.sh
  problema: string; porQueImporta: string; sistemas: string[];
  ondeLer: string[];                                    // caminhos do kota-bank ou notion:<chave>
  quemAjuda: string[]; autor: string;                   // ids de PessoaKota
}
export const TAREFAS: TarefaKota[];
export function corpoIssue(t: TarefaKota, n: number, m: MapaKota, urls: Record<string, string>): string;
export function conferirTarefa(saidas: { main: Saida; tarefa: Saida; solucao: Saida }, t: TarefaKota): string[];   // Saida = { ok: boolean; texto: string }
export async function publicarTarefas(publico: string, tarefas: TarefaKota[], m: MapaKota, urls: Record<string, string>): Promise<{ chave: string; n: number }[]>;
```

- `corpoIssue` tem as seções `## Problema`, `## Por que importa`, `## Sistemas`, `## Onde ler` (links resolvidos), `## Quem ajuda` (nomes e `canalAjuda`, sem `@`), `## Como começar` (`git switch tarefa/<n>`, `scripts/testar.sh <servico>`, e `solucao/<n>` para comparar depois). Lembra que o gestor aprova antes de começar.
- `publicarTarefas`: label `primeira-tarefa`; acha a issue pelo título ou cria; cria `tarefa/<n>` (main + `teste.patch`) e `solucao/<n>` (+ `solucao.patch`) com autor da tarefa; roda `scripts/testar.sh <servico>` nas três; para em qualquer erro de `conferirTarefa`; só então faz push das branches.
- Candidatas (confirmar lendo o código no Step 1): no `ledgerwriter`, limite de valor por transferência no `TransactionValidator` (perfil novo); no `transactionhistory`, o extrato de outra conta responder 403 em vez de 401, que usa o que a pessoa já sabe de JWT (perfil transição); no `balancereader`, um caso de cache (os dois perfis).

- [ ] **Step 1: Ler o código das candidatas e fechar 3 a 5 tarefas em `TAREFAS`**
- [ ] **Step 2: Testes de `corpoIssue` e `conferirTarefa`; ver falhar**

```ts
it("corpo tem as seis seções e nenhum @", ...)
it("acusa tarefa que passa na branch tarefa", ...)
it("acusa tarefa que falha sem citar testeQueFalha", ...)
it("acusa main ou solucao vermelha", ...)
it("toda tarefa tem autor e quem ajuda no mapa, e há uma no livro-razão para cada perfil", ...)
```

- [ ] **Step 3: Implementar e ver passar; commit** (`feat(kit): catálogo de primeira tarefa da kota`)
- [ ] **Step 4: Escrever os patches na oficina** (uma branch por tarefa com dois commits: o teste e a correção; `git format-patch` de cada um para `kit/kota/tarefas/<chave>/`)
- [ ] **Step 5: Publicar, com o OK do Joaquim**

Run: `npm run kota:tarefas -- ../kota-bank`
Expected: 3 a 5 issues com a label e as branches `tarefa/<n>` e `solucao/<n>`; a saída mostra o teste esperado falhando em cada `tarefa/<n>`. Colar na #114.

### Task C3: Notion conferido contra a fonte e check completo (#117)

**Files:**
- Create: `kit/kota/notion/comparar.ts`
- Test: `kit/kota/__tests__/comparar.test.ts`
- Modify: `kit/kota/notion/COMO-PREENCHER.md` (seção "Conferir")

**Interfaces:**
- Produces: `compararComNotion(fonte: string, publicado: string, urls: Record<string, string>): string[]`. Resolve os links da fonte, reduz os dois a texto (sem marcação Markdown, espaços colapsados) e devolve os parágrafos que diferem.
- A seção "Conferir" do procedimento: para cada chave, buscar a página pelo MCP (`notion-fetch`), rodar `compararComNotion` e, se houver diferença, decidir com quem editou e atualizar a fonte ou subir de novo.

- [ ] **Step 1: Testes; ver falhar**

```ts
it("igual quando só muda a marcação", ...)
it("acusa parágrafo alterado no Notion", ...)
it("compara links já resolvidos", ...)
```

- [ ] **Step 2: Implementar e ver passar; commit** (`feat(kit): conferência do notion da kota contra a fonte`)
- [ ] **Step 3: Conferir todas as páginas pelo procedimento**

Expected: nenhuma diferença. Colar o resumo na #117.

- [ ] **Step 4: Check completo**

Run: `npm run check:kota -- --repo ../kota-bank`
Expected: nenhuma regra com erro e nenhuma pulada. Colar na #117.

### Task C4: trocar a Tail pela Kota no Orbis (#120)

Pode começar numa branch `feat/120-kota-no-orbis` logo depois do alicerce. O merge espera a C2 (números das issues) e a N4 (URLs públicas). Seguir a skill `nova-jornada` para a jornada e `contrato` se mudar algum formato.

**Files:**
- Modify: `src/data/company.ts`, `src/data/profiles.ts`, `src/journey/data/tail.journey.json` (vira `kota.journey.json`), `server/src/app.ts`, `src/screens/landing/index.html`, `docs/demo.md`, `docs/contratos.md`, `docs/journey-format.md`, `README.md`, `.claude/skills/contexto-base/modelos.md`, `.claude/skills/revisar/`, `.claude/skills/nova-jornada/`, `.claude/skills/contrato/`, e os testes em `src/journey/__tests__/` que citam a Tail
- Create: `src/data/__tests__/kota.test.ts`, `kit/kota/checar/regras/jornada.ts`

**Interfaces:**
- Produces: `empresaDoMapa(m: MapaKota): Company` em `src/data/company.ts` (`name: "Kota"`, `teams` com os nomes dos times, `people` por id com `handle = slack`, `role = cargo`, `team` = nome do time ou da área) e `export const company = empresaDoMapa(mapa)`.
- Produces: `profiles` com as chaves = ids das pessoas de `mapa.perfis`; `toTeam: "Livro-razão"`, `fromTeam: "Contas"` na transição; `managerId` = gestor do Livro-razão; `buddyId` = um buddy do Livro-razão. O perfil padrão da URL passa a ser o da transição.
- Produces: regra `jornada` do `check:kota`: em cada `*.journey.json`, todo `info.docs[]` tem `url`, e a URL é um valor de `urls.json` ou um link `github.com/JucaGF/kota-bank/blob/main/<caminho>` que existe (com repo); todo `info.adr` tem `id` `ADR-000N` e `title` iguais ao mapa; todo nó `kind: "task"` tem `info.role` igual ao `titulo` de uma `TarefaKota` e `info.vinculo` num dos `perfis` dela; todo responsável citado existe em `company.people`.

- [ ] **Step 1: Testes de dados e da regra; ver falhar**

```ts
it("empresa é a Kota com os 4 times", ...)
it("gestor e buddy dos perfis existem e são do Livro-razão", ...)
it("transição vem de Contas", ...)
it("regra jornada acusa doc sem url, ADR com título errado e tarefa fora do catálogo", ...)
```

Run: `npx vitest run src/data/__tests__/kota.test.ts kit/kota/__tests__`
Expected: FAIL.

- [ ] **Step 2: Dados da Kota; ver os testes de dados passarem**
- [ ] **Step 3: Jornada nova da Kota pela skill `nova-jornada`** (escrita à mão; fontes do kit; primeira tarefa por vínculo apontando para as issues da C2)
- [ ] **Step 4: Tirar a Tail do resto**

Run: `rg -n -w -i tail --glob '!docs/decisoes/**' --glob '!docs/kit-da-kota.md' --glob '!docs/superpowers/**' .`
Expected: nenhuma linha.

- [ ] **Step 5: Conferir**

Run: `npm run check && npm run check:kota -- --repo ../kota-bank`
Expected: os dois verdes. Depois, skill `checar-demo`.

- [ ] **Step 6: Commit, PR e revisão pelas skills `handoff` e `revisar`**

```bash
git commit -m "feat(journey): a demo acontece na kota, com fontes no kit"
```

**Portão 1 (antecipado, ainda na Onda 1):** antes da jornada inteira, um nó de teste que cita o ADR 1 e a página `rfc-1` passa na regra `jornada` com `--repo ../kota-bank-oficina`. Prova o caminho fonte → kit de ponta a ponta.

### Task C5: guia de uso e teste numa máquina limpa (#119)

**Files:**
- Create: `kit/kota/notion/paginas/comece-aqui.md`

**Interfaces:**
- Consumes: `urls.json` (`kota`), `workspace.json` (`convite`), URL do `JucaGF/kota-bank`, `cliente.demo` / `kota-demo`, o link de download do Orbis (#47, #48).
- Seções fixas: `## Quem você é na história` (escolher novo ou transição e o que muda), `## Onde estão as coisas` (repo, Notion, convite do Slack, Orbis), `## Como subir o banco` (link para o README e usuário de demo), `## O que vale tentar` (os 5 itens do §6: clicar na fonte de um nó e cair no ADR ou na página; pergunta fora do roteiro; caso pessoal que vira encaminhamento; pegar a primeira tarefa e ver o teste falhar e passar; subir o banco e ver "Kota").

- [ ] **Step 1: Escrever, conferir com `npm run check:kota` e subir pelo procedimento**
- [ ] **Step 2: Mandar os links para a #48 (landing)** como comentário na issue
- [ ] **Step 3: Teste na máquina limpa**

Alguém que não montou o kit, num Mac com Apple Silicon e numa janela anônima, segue só o guia e tenta os 5 itens.
Expected: os 5 funcionam. Anotar na #119 e na #39 o que travou e quanto tempo levou. O que travar vira issue nova.
