# Alicerce do kit da Kota: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** o mapa da Kota tipado e validado, o gerador do `CODEOWNERS`, o esqueleto do `check:kota` e a oficina com o código cru importado. Tudo que as raias consomem.

**Arquitetura:** um arquivo de dados (`kit/kota/mapa.ts`) com tipos em `kit/kota/tipos.ts` é a única fonte de pessoas, times, sistemas, ADRs e RFCs. Geradores leem o mapa; o `check:kota` roda uma lista de regras, uma por arquivo, contra o mapa e o checkout do Kota.

**Stack:** TypeScript rodado com `tsx`, testes com `vitest` (os do repo), `git`, `gh`.

**Spec:** `docs/kit-da-kota.md` §2, §3.1, §5 e `docs/decisoes/0005-kit-da-kota.md`. Índice e decisões: [`README.md`](README.md).

## Restrições globais

- Só dados sintéticos (`PRODUCT.md` §12.2). E-mails só com o domínio `kota.example`.
- 4 times: Contas, Livro-razão, Canais, Plataforma. 12 a 15 pessoas, mais RH (People) e segurança da informação.
- Cada time tem gestor, tech lead e pelo menos uma pessoa buddy.
- Nos dois perfis a pessoa entra no Livro-razão; na transição ela vem de Contas.
- Nenhum nome, marca ou e-mail da empresa de origem (Bank of Anthos, Anthos, Cymbal, Google) como marca da Kota.
- Textos, mensagens de erro e commits em português; commits no formato `tipo(escopo): mensagem`, sem linha de coautoria.

## Foco de revisão

1. **Nome inventado que é de alguém real.** Um `@handle` pode existir no GitHub. Esperado: o mapa não guarda handle de GitHub; o `CODEOWNERS` usa e-mail. Teste em 0.3.
2. **Duas pessoas com o mesmo nome exibido** confundem o jurado e o encaminhamento. Esperado: `validarMapa` acusa. Teste em 0.1.
3. **Nomes da Tail reaproveitados** (Diego, Júlia, Paula, Marcos…) deixam rastros da Tail nas buscas. Esperado: `validarMapa` acusa nome que já existe em `src/data/company.ts` da Tail. Teste em 0.2.
4. **ADR apontando para RFC que não aponta de volta.** Esperado: erro dos dois lados. Teste em 0.1.
5. **`check:kota` sem `--repo`** não pode passar em silêncio as regras que precisam do repo. Esperado: aviso "regra X pulada: sem --repo". Teste em 0.4.

---

### Task 0.1: Tipos e validação do mapa

**Files:**
- Create: `kit/kota/tipos.ts`
- Create: `kit/kota/validar.ts`
- Test: `kit/kota/__tests__/validar.test.ts`
- Modify: `tsconfig.json` (acrescentar `"kit"` ao `include`)

**Interfaces:**
- Produces (copiar exatamente, todas as raias dependem destes nomes):

```ts
export type TimeId = "contas" | "livro-razao" | "canais" | "plataforma";
export type AreaId = TimeId | "people" | "seguranca";
export type Email = `${string}@kota.example`;

export interface PessoaKota {
  id: string;        // kebab-case, único
  nome: string;      // único
  cargo: string;
  area: AreaId;
  email: Email;
  slack: string;     // nome exibido no Slack, sem @
  avatar: string;    // https://api.dicebear.com/9.x/initials/png?seed=<nome com encodeURIComponent>
}
export interface TimeKota {
  id: TimeId; nome: string; missao: string;
  gestor: string; techLead: string; buddies: string[];   // ids de PessoaKota
  canal: `#${string}`; canalAjuda: `#${string}`; plantao: string;
}
export interface SistemaKota {
  id: string; pasta: string;   // caminho no kota-bank, sem barra final
  time: TimeId; linguagem: "Python" | "Java" | "Postgres";
  oQueFaz: string; dependeDe: string[];   // ids de SistemaKota
  legado?: true;
}
export interface AdrKota { n: number; titulo: string; status: "aceito" | "rejeitado"; time: TimeId; rfc?: number; ancoras: string[] }
export interface RfcKota { n: number; titulo: string; autor: string; adr: number }
export interface MapaKota {
  repo: "JucaGF/kota-bank";
  pessoas: PessoaKota[]; times: TimeKota[]; sistemas: SistemaKota[];
  adrs: AdrKota[]; rfcs: RfcKota[];
  perfis: {
    novo: { pessoa: string; para: "livro-razao" };
    transicao: { pessoa: string; de: "contas"; para: "livro-razao" };
  };
  aliases: Email[];   // ex.: people@kota.example, seguranca@kota.example
}
```

- Produces: `validarMapa(m: MapaKota, nomesProibidos?: string[]): string[]` em `kit/kota/validar.ts`. Lista vazia = válido. Cada erro é uma frase em português que cita o id envolvido.
- Produces: `caminhoAdr(a: AdrKota): string` em `kit/kota/tipos.ts`: `docs/adr/` + número com 4 dígitos + `-` + título em minúsculas, sem acento, palavras unidas por hífen + `.md`. Ex.: `docs/adr/0001-quebrar-o-monolito-do-livro-razao-em-tres-servicos.md`. A raia eng. cria os arquivos com esse nome; a raia Notion e a C4 linkam por ele.

- [ ] **Step 1: Escrever os testes que falham**

Um mapa mínimo válido (`mapaMinimo()` no próprio teste, 4 times, 12 pessoas) e um teste por regra:

```ts
it("aceita o mapa mínimo", () => expect(validarMapa(mapaMinimo())).toEqual([]));
it("acusa gestor, tech lead ou buddy que não existe", () =>
  expect(validarMapa(com(m => { m.times[0].gestor = "ninguem"; })).join("\n")).toMatch(/time contas: gestor "ninguem" não existe/));
it("acusa responsável de outro time", ...)            // /time contas: tech lead "x" é de livro-razao/
it("acusa time sem buddy", ...)                        // /time canais: sem buddy/
it("acusa contagem fora de 12 a 15 pessoas nos times", ...)   // /14 pessoas nos times|tem 11, precisa de 12 a 15/
it("acusa falta de alguém de people e de seguranca", ...)     // /ninguém de people/
it("acusa id ou nome repetido", ...)                   // /nome "Ana Souza" repetido/
it("acusa e-mail fora de kota.example", ...)           // /e-mail .* fora de kota\.example/ (o tipo não impede em dado vindo de JSON)
it("acusa sistema com dependência ou time inexistente", ...)
it("acusa ADR com RFC inexistente e RFC que não volta para o ADR", ...)  // /ADR 6 cita RFC 9/, /RFC 1 aponta ADR 2, mas ADR 2 não cita RFC 1/
it("acusa número de ADR ou RFC repetido ou fora de sequência", ...)
it("acusa pessoa do perfil novo fora do livro-razão e da transição fora de contas", ...)
it("caminhoAdr tira acento e pontuação", () => expect(caminhoAdr({ n: 5, titulo: "Python em Contas e Canais, Java no Livro-razão" } as AdrKota)).toBe("docs/adr/0005-python-em-contas-e-canais-java-no-livro-razao.md"));
it("acusa nome proibido", () => expect(validarMapa(mapaMinimo(), ["Ana Souza"]).join()).toMatch(/nome "Ana Souza" é da Tail/));
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run kit/kota/__tests__/validar.test.ts`
Expected: FAIL, `validarMapa` não existe.

- [ ] **Step 3: Implementar `tipos.ts` e `validarMapa` em `kit/kota/validar.ts`, e acrescentar `"kit"` ao `include` do `tsconfig.json`**

Uma função pequena por regra, todas juntando strings num array. Sem biblioteca de schema.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run kit/kota/__tests__/validar.test.ts && npm run typecheck`
Expected: PASS e `tsc` sem erro.

- [ ] **Step 5: Commit**

```bash
git add kit/kota/tipos.ts kit/kota/validar.ts kit/kota/__tests__/validar.test.ts tsconfig.json
git commit -m "feat(kit): tipos e validação do mapa da kota"
```

### Task 0.2: O mapa da Kota preenchido

**Files:**
- Create: `kit/kota/mapa.ts`
- Test: `kit/kota/__tests__/mapa.test.ts`

**Interfaces:**
- Consumes: `MapaKota`, `validarMapa` (0.1).
- Produces: `export const mapa: MapaKota` em `kit/kota/mapa.ts`.

- [ ] **Step 1: Escrever o teste**

```ts
import { company } from "../../../src/data/company";   // a Tail, enquanto existir
it("o mapa da Kota é válido e não reaproveita nomes da Tail", () =>
  expect(validarMapa(mapa, Object.values(company.people).map(p => p.name))).toEqual([]));
it("os sistemas cobrem os 10 serviços do §2", () =>
  expect(mapa.sistemas.map(s => s.id).sort()).toEqual(["accounts-db","balancereader","contacts","frontend","ledger-db",
    "ledgermonolith","ledgerwriter","loadgenerator","transactionhistory","userservice"]));
it("o registro tem 7 ADRs e 3 RFCs", () => { expect(mapa.adrs).toHaveLength(7); expect(mapa.rfcs).toHaveLength(3); });
```

Quando a #120 tirar a Tail, o primeiro teste passa a importar a lista de nomes de um array fixo no próprio teste.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run kit/kota/__tests__/mapa.test.ts`
Expected: FAIL, `mapa` não existe.

- [ ] **Step 3: Preencher `kit/kota/mapa.ts`**

Pessoas com nomes brasileiros variados e cargos do §2. Canais `#<time>` e `#<time>-ajuda`. Pastas dos sistemas como no
upstream: `src/frontend`, `src/accounts/userservice`, `src/accounts/contacts`, `src/accounts/accounts-db`,
`src/ledger/ledgerwriter`, `src/ledger/balancereader`, `src/ledger/transactionhistory`, `src/ledger/ledger-db`,
`src/loadgenerator`, `src/ledgermonolith` (este com `legado: true`, time `livro-razao`). Aliases
`people@kota.example` e `seguranca@kota.example`.

As pessoas de `perfis` têm os ids `ana` (novo, área `livro-razao`) e `bruno` (transição, área `contas`), com e-mails
`ana@kota.example` e `bruno@kota.example`: são as contas fixas da apresentação no `docs/stack.md` §6. Os nomes completos
mudam (os da Tail ficam proibidos só para as pessoas da empresa).

Registro de decisões (números e títulos fixos, as raias eng. e Notion escrevem a partir daqui):

| ADR | Título | Status | Time | RFC | Âncoras |
|---|---|---|---|---|---|
| 1 | Quebrar o monolito do livro-razão em três serviços | aceito | livro-razao | 1 | `src/ledgermonolith`, `src/ledger` |
| 2 | JWT assinado pelo userservice e validado em cada serviço | aceito | contas | | `src/accounts/userservice` |
| 3 | Um banco por domínio | aceito | plataforma | 2 | `src/accounts/accounts-db`, `src/ledger/ledger-db` |
| 4 | Saldo e extrato com cache em memória, lidos do livro-razão | aceito | livro-razao | | `src/ledger/balancereader`, `src/ledger/transactionhistory` |
| 5 | Python em Contas e Canais, Java no Livro-razão | aceito | plataforma | | `src/accounts`, `src/ledger` |
| 6 | Fila entre o ledgerwriter e os leitores | rejeitado | livro-razao | 3 | `src/ledger/balancereader` |
| 7 | Ambiente local com docker compose construído do código | aceito | plataforma | | `docker-compose.yml` |

RFC 1 "Separar o livro-razão do monolito" → ADR 1; RFC 2 "Banco de contas separado do livro-razão" → ADR 3; RFC 3 "Fila de eventos de transação" → ADR 6.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run kit/kota/__tests__/mapa.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kit/kota/mapa.ts kit/kota/__tests__/mapa.test.ts
git commit -m "feat(kit): mapa da kota com times, pessoas, sistemas e decisões"
```

### Task 0.3: Gerador do CODEOWNERS

**Files:**
- Create: `kit/kota/gerar/codeowners.ts`
- Test: `kit/kota/__tests__/codeowners.test.ts`
- Modify: `package.json` (script `"kota:codeowners": "tsx kit/kota/gerar/codeowners.ts"`)

**Interfaces:**
- Consumes: `mapa`, `MapaKota`.
- Produces: `gerarCodeowners(m: MapaKota): string`. CLI: `npm run kota:codeowners -- <arquivo de saída>`.

- [ ] **Step 1: Escrever os testes que falham**

```ts
it("primeira linha avisa que é gerado", () => expect(gerarCodeowners(m).split("\n")[0]).toMatch(/^# Gerado do mapa da Kota/));
it("padrão do repo é o time de plataforma", () => {
  const t = m.times.find(t => t.id === "plataforma")!, email = (id: string) => m.pessoas.find(p => p.id === id)!.email;
  expect(gerarCodeowners(m).split("\n")).toContain(`* ${email(t.techLead)} ${email(t.gestor)}`);
});
it("cada sistema vira /<pasta>/ com e-mails do tech lead e do gestor do time", ...)
it("nunca usa @handle", () => expect(gerarCodeowners(mapa)).not.toMatch(/(^|\s)@\w/m));
it("docs/adr/ fica com os tech leads de todos os times", ...)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run kit/kota/__tests__/codeowners.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `gerarCodeowners` e o bloco de CLI** (quando chamado direto, grava no caminho do primeiro argumento)

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run kit/kota/__tests__/codeowners.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add kit/kota/gerar/codeowners.ts kit/kota/__tests__/codeowners.test.ts package.json
git commit -m "feat(kit): codeowners da kota gerado do mapa"
```

### Task 0.4: Esqueleto do check:kota

**Files:**
- Create: `kit/kota/checar/contexto.ts`, `kit/kota/checar/checar.ts`, `kit/kota/checar/cli.ts`
- Create: `kit/kota/checar/regras/mapa.ts`, `kit/kota/checar/regras/codeowners.ts`, `kit/kota/checar/regras/index.ts`
- Test: `kit/kota/__tests__/checar.test.ts`
- Modify: `package.json` (script `"check:kota": "tsx kit/kota/checar/cli.ts"`)

**Interfaces:**
- Produces (as raias acrescentam regras com esta forma, um arquivo por regra em `regras/`, registrado em `regras/index.ts`):

```ts
export interface ContextoKota {
  mapa: MapaKota;
  repo?: string;                       // raiz de um checkout do kota-bank ou da oficina
  notionUrls: Record<string, string>;  // conteúdo de kit/kota/notion/urls.json, {} se não existir
  jornadas: string[];                  // caminhos de src/journey/data/*.journey.json
}
export interface Regra { nome: string; precisaRepo: boolean; checar(ctx: ContextoKota): string[] }
export function checarKota(ctx: ContextoKota, regras: Regra[]): { erros: string[]; pulas: string[] };
```

- CLI: `npm run check:kota -- [--repo <caminho>]`. Sai com código 1 se houver erro; imprime as regras puladas.
- Regras iniciais: `mapa` (chama `validarMapa`) e `codeowners` (precisa repo: `.github/CODEOWNERS` igual a `gerarCodeowners(mapa)`).

- [ ] **Step 1: Escrever os testes que falham**

```ts
it("junta os erros de todas as regras com o nome da regra", ...)       // erros: ["[mapa] ...", "[codeowners] ..."]
it("pula regra que precisa de repo quando não há repo e avisa", () =>
  expect(checarKota({ ...ctx, repo: undefined }, [regraQuePrecisaRepo]).pulas).toEqual(["codeowners: sem --repo"]));
it("codeowners acusa arquivo ausente e arquivo diferente do gerado", ...)  // usa um diretório temporário
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run kit/kota/__tests__/checar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar contexto, `checarKota`, as duas regras e a CLI**

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run kit/kota/__tests__/checar.test.ts && npm run check:kota`
Expected: PASS; a CLI sai com 0 e lista `codeowners: sem --repo` como pulada.

- [ ] **Step 5: Commit, PR e merge**

```bash
git add kit/kota/checar kit/kota/__tests__/checar.test.ts package.json
git commit -m "feat(kit): check:kota confere o mapa e o codeowners"
```

Rodar `npm run check`, abrir o PR das tasks 0.1 a 0.4 com `Closes #110` (skill `handoff`) e pedir revisão (skill `revisar`).

### Task 0.5: Oficina com o código cru

**Files:** repo novo `JucaGF/kota-bank-oficina` (privado).

**Interfaces:**
- Produces: a branch `main` da oficina com a árvore do Bank of Anthos v0.6.11 sem histórico upstream. Clonada em `../kota-bank-oficina`, ao lado do `puca-onboarding`. Todas as raias que mexem no código abrem PR aqui.

- [ ] **Step 1: Criar o repo privado e importar a árvore**

```bash
gh repo create JucaGF/kota-bank-oficina --private --clone ../kota-bank-oficina
git clone --depth 1 --branch v0.6.11 https://github.com/GoogleCloudPlatform/bank-of-anthos.git ../boa-upstream
git -C ../boa-upstream archive HEAD | tar -x -C ../kota-bank-oficina
```

- [ ] **Step 2: Conferir que só veio a árvore**

Run: `git -C ../kota-bank-oficina status --short | wc -l` e `ls ../kota-bank-oficina/LICENSE`
Expected: cerca de 449 arquivos novos e o `LICENSE` presente.

- [ ] **Step 3: Commit e push**

```bash
git -C ../kota-bank-oficina add -A
git -C ../kota-bank-oficina commit -m "chore: código do bank of anthos v0.6.11, sem alterações"
git -C ../kota-bank-oficina push -u origin main
```

- [ ] **Step 4: Dar acesso a quem vai trabalhar nas raias repo e eng.**

Run: `gh api -X PUT repos/JucaGF/kota-bank-oficina/collaborators/<login>` para cada pessoa.
Expected: convite listado em `gh api repos/JucaGF/kota-bank-oficina/invitations`.

**Portão 0:** `npm run check:kota` verde no `main` do `puca-onboarding`, oficina com o código e a tarefa R1 (raia repo) com o banco subindo. Colar a saída dos três na #110.
