# Plano 1 — O mapa responde: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para executar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para
> acompanhar o andamento.

**Objetivo:** a Puca responde "quem cuida do X", "como o X se liga" e "mostra o ADR N" pelo mapa da Kota, na hora, sem
LLM e sem servidor. Ela desenha no quadro os sistemas que ainda não estavam nele e encaminha para a pessoa certa, que o
mapa escolhe.

**Arquitetura:** um núcleo puro em `src/puca/` (fontes, entidades, destino, layout, catálogo) que o app usa agora e o
servidor vai usar no plano 3. Um degrau novo, `intencao`, entra na cascata da `route.ts` e devolve um `Plano`. A
função `montar` do catálogo transforma o plano em segmentos prontos e um desfecho. O executor toca tudo numa fila só.

**Tecnologia:** TypeScript, Vite e Vitest. Nenhuma dependência nova.

**Especificação:** [`desenho.md`](desenho.md) (seções "Dados", "Tipos de resposta e ações", "Cascata local com
fonte" e "O executor").

## Restrições globais

- Dados reais: o código de produção lê `kit/kota/mapa.ts` e `kit/kota/notion/urls.json`. Nada de pessoa, time ou
  sistema escrito à mão fora deles. Exemplos fixos só nos testes.
- A cascata continua do mais barato ao mais caro. O degrau `intencao` entra **depois** do `faq` com score 1 e
  **antes** do `knowledge`.
- Papel de pessoa (tech lead, gestor, buddy, responsável) só sai de `dizer_dono`, com frase escrita pelo código.
- Quem não usa o quadro ou o navegador continua igual: `npm run dev` sem servidor e sem Electron funciona.
- O navegador da Puca não existe ainda. `mostrar` vira um cartão com o trecho e o link (sem `window.open`).
- Textos de interface, comentários e docs em português, no vocabulário do `CONTEXT.md`.
- Commits `tipo(escopo): mensagem`, sem coautoria.

## Foco da revisão

1. **Nome comum confundido com time.** "contas a pagar", "nos canais de sempre" e "a plataforma" não podem virar
   `time:contas`, `time:canais` nem `time:plataforma`. Teste na tarefa 3.
2. **Sistema escrito de outro jeito.** "Balance Reader", "balance-reader" e "o balancereader" têm de achar
   `sistema:balancereader`. Teste na tarefa 3.
3. **Pergunta sobre o legado.** "quem cuida do ledgermonolith?" diz o time **e** que o sistema é legado. Teste na
   tarefa 6.
4. **Sistema já no quadro.** Desenhar um sistema que a jornada já pôs no quadro revela e destaca o nó existente, sem
   duplicar. Testes nas tarefas 5 e 6.
5. **Sem quadro na tela** (logo da sessão ou tela Início). "como o ledgerwriter se liga?" ainda responde por fala, e o
   desenho fica para quando houver quadro. Testes nas tarefas 6 e 8.

---

### Tarefa 1: Contratos (Encaminhamento, Rota da fala, Rastro)

**Arquivos:**
- Modificar: `docs/contratos.md` (linhas da tabela "Encaminhamento", "Rota da fala" e "Rastro", mais uma seção
  "Plano da Puca" com um exemplo válido)

**Interfaces:**
- Produz (no doc, implementado nas tarefas seguintes):
  - `Forwarding.to: { name: string; role: "buddy" | "tech_lead" | "gestor" | "people" | "seguranca"; pessoa?: string }`.
    É compatível com quem lê `to.name` (live-session e rastro).
  - Rota nova: `{ kind: "intencao"; plano: Plano }`.
  - Rastro: `TrailEntry.fontes?: { titulo: string; url: string }[]`, somado a `sources`.

- [ ] **Passo 1:** chamar a skill `contrato` e combinar o destino com as issues #125, #104 e #129 (comentário em cada
  uma, com o formato acima).
- [ ] **Passo 2:** escrever as três linhas e o exemplo de `Plano` (um `responder` com um segmento `dizer_dono` para
  `sistema:balancereader`).
- [ ] **Passo 3:** `npm run check:contexto` passa.
- [ ] **Passo 4:** commit `docs(contratos): destino do encaminhamento pelo mapa, rota intencao e fontes no rastro`.

### Tarefa 2: Fontes e trechos do mapa (`src/puca/fontes.ts`)

**Arquivos:**
- Criar: `src/puca/fontes.ts`
- Teste: `src/puca/__tests__/fontes.test.ts`

**Interfaces:**
- Produz:
  ```ts
  export type FonteId = string;   // "mapa:sistemas/balancereader", "kota-bank:docs/adr/0004-….md", "notion:deploy"
  export type TrechoId = string;  // `${FonteId}#${ancora}`
  export interface Fonte { id: FonteId; tipo: "adr" | "runbook" | "readme" | "codigo" | "notion" | "mapa"; titulo: string;
    situacao: "vigente" | "legado" | "rejeitado"; acesso: "kota"; versao: string;
    url: string }   // base: arquivo no commit fixo, página pública do Notion ou database do mapa
  export interface Trecho { id: TrechoId; fonte: Fonte; texto: string; linhas: [number, number] | null; entidades: EntidadeId[] }
  export interface CitacaoConferida { trecho: TrechoId; citado: string; fonte: Fonte; linhas: [number, number] | null; url: string }
  export function normalizar(s: string): string;                                  // espaço colapsado, minúsculas, sem acento
  /** URL que abre o trecho: Markdown do GitHub com `?plain=1#Lx-Ly`, código com `#Lx-Ly`, Notion e mapa sem âncora. */
  export function urlDoTrecho(t: Trecho): string;
  export function conferirLiteral(t: Trecho, citado: string): CitacaoConferida | null;   // ≥ 12 caracteres e substring normalizada; url = urlDoTrecho(t)
  export function trechosDoMapa(m: MapaKota, urls: Record<string, string>, versao: string): Trecho[];
  ```

- [ ] **Passo 1: escrever os testes que falham**

```ts
it("cada sistema do mapa vira um trecho citável com a URL da database Sistemas", () => {
  const t = trechosDoMapa(mapa, urls, "teste").find((x) => x.id === "mapa:sistemas/balancereader#linha")!;
  expect(t.fonte.url).toBe(urls.sistemas);
  expect(t.texto).toContain("Livro-razão");
  expect(t.entidades).toContain("sistema:balancereader");
});
it("sistema legado e ADR rejeitado vêm com a situação do mapa", () => {
  const ts = trechosDoMapa(mapa, urls, "teste");
  expect(ts.find((x) => x.id === "mapa:sistemas/ledgermonolith#linha")!.fonte.situacao).toBe("legado");
});
it("conferirLiteral aceita espaço e caixa diferentes e recusa trecho curto ou ausente", () => {
  const t = trechosDoMapa(mapa, urls, "teste").find((x) => x.id === "mapa:sistemas/balancereader#linha")!;
  expect(conferirLiteral(t, "SALDO de cada conta,   com cache")).not.toBeNull();
  expect(conferirLiteral(t, "cache")).toBeNull();
  expect(conferirLiteral(t, "saldo guardado numa fila")).toBeNull();
});
```

- [ ] **Passo 2:** `npx vitest run src/puca/__tests__/fontes.test.ts`. Esperado: FAIL ("trechosDoMapa is not a
  function").
- [ ] **Passo 3: implementar `src/puca/fontes.ts`.** O texto de cada linha é `linhasDatabase(mapa, db)` serializado
  como `Campo: valor` unido por ` · ` (listas unidas por `, `; booleano vira "sim"/"não"). É o que a database do
  Notion mostra, então o literal confere por construção. As databases são `sistemas`, `times` e `pessoas`. Os ADRs e
  as RFCs entram como trechos da database `rfcs`, com a situação do ADR. Âncora `#linha`. `versao` vem de quem chama.
- [ ] **Passo 4:** rodar de novo. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(puca): trechos citáveis do mapa da kota`.

### Tarefa 3: Entidades e reconhecedor (`src/puca/entidades.ts`)

**Arquivos:**
- Criar: `src/puca/entidades.ts`
- Teste: `src/puca/__tests__/entidades.test.ts`

**Interfaces:**
- Produz:
  ```ts
  export type EntidadeId = `sistema:${string}` | `time:${TimeId}` | `pessoa:${string}` | `adr:${number}` | `rfc:${number}`;
  export function reconhecer(texto: string, m: MapaKota): EntidadeId[];   // na ordem em que aparecem, sem repetir
  export function sistemaDaPasta(caminho: string, m: MapaKota): string | null;   // "src/ledger/balancereader/x.java" → "balancereader"
  ```

- [ ] **Passo 1: escrever os testes que falham**

```ts
it.each([
  ["quem cuida do balancereader?", ["sistema:balancereader"]],
  ["e o Balance Reader?", ["sistema:balancereader"]],
  ["o balance-reader fala com o ledger-db", ["sistema:balancereader", "sistema:ledger-db"]],
  ["por que o ADR 4 escolheu cache?", ["adr:4"]],
  ["li o ADR-0006", ["adr:6"]],
  ["o time de Contas cuida disso?", ["time:contas"]],
  ["a Beatriz pode me ajudar?", ["pessoa:beatriz"]],
])("%s", (fala, esperado) => expect(reconhecer(fala, mapa)).toEqual(esperado));

it.each(["tenho contas a pagar", "nos canais de sempre", "a plataforma caiu"])("palavra comum não vira time: %s", (fala) =>
  expect(reconhecer(fala, mapa)).toEqual([]));

it("a pasta do kota-bank aponta para o sistema", () =>
  expect(sistemaDaPasta("src/ledger/balancereader/src/main/java/Cache.java", mapa)).toBe("balancereader"));
```

- [ ] **Passo 2:** rodar o teste. Esperado: FAIL.
- [ ] **Passo 3: implementar.**
  - **Sistemas:** casam pelo id, com ou sem hífen e espaço, ignorando caixa.
  - **ADR e RFC:** `ADR`/`RFC` seguido de número, com ou sem `-` e zeros à esquerda.
  - **Pessoas:** primeiro nome ou nome completo do mapa, com inicial maiúscula na fala original.
  - **Times:** só com "time de X", "time X" ou "X" com maiúscula no meio da frase.
  - **`sistemaDaPasta`:** o prefixo mais longo entre as `pasta` do mapa.
- [ ] **Passo 4:** rodar o teste. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(puca): reconhecer sistemas, times, pessoas e adrs da kota numa fala`.

### Tarefa 4: Destino do encaminhamento pelo mapa (`src/puca/destino.ts` + `forwarding.ts`)

**Arquivos:**
- Criar: `src/puca/destino.ts`
- Modificar: `src/journey/forwarding.ts:17` (tipo de `to`)
- Teste: `src/puca/__tests__/destino.test.ts`, `src/journey/__tests__/forwarding.test.ts` (o exemplo atual continua
  passando)

**Interfaces:**
- Consome: `EntidadeId` (tarefa 3).
- Produz:
  ```ts
  export type MotivoDoEncaminhamento = "sem_fonte" | "caso_pessoal" | "seguranca";
  export interface Destino { pessoa: string; nome: string; role: "buddy" | "tech_lead" | "gestor" | "people" | "seguranca" }
  export function destinoDoEncaminhamento(m: MapaKota, e: { entidades: EntidadeId[]; motivo: MotivoDoEncaminhamento; vinculo: Vinculo }): Destino;
  ```

- [ ] **Passo 1: escrever os testes que falham**

```ts
const d = (entidades: EntidadeId[], motivo: MotivoDoEncaminhamento = "sem_fonte", vinculo: Vinculo = "novo") =>
  destinoDoEncaminhamento(mapa, { entidades, motivo, vinculo });
it("sistema → buddy do time do sistema", () => expect(d(["sistema:userservice"])).toMatchObject({ pessoa: "raissa", role: "buddy" }));
it("ADR → buddy do time do ADR", () => expect(d(["adr:3"])).toMatchObject({ pessoa: "vinicius", role: "buddy" }));
it("caso pessoal → People", () => expect(d([], "caso_pessoal")).toMatchObject({ pessoa: "simone", role: "people" }));
it("segurança → segurança", () => expect(d(["sistema:userservice"], "seguranca")).toMatchObject({ pessoa: "jonas", role: "seguranca" }));
it("sem entidade → buddy do time de destino da pessoa", () => expect(d([])).toMatchObject({ pessoa: "beatriz", role: "buddy" }));
it("o primeiro sistema decide quando há vários", () => expect(d(["sistema:contacts", "sistema:ledgerwriter"]).pessoa).toBe("raissa"));
```

- [ ] **Passo 2:** rodar o teste. Esperado: FAIL.
- [ ] **Passo 3:** implementar a tabela do desenho. O time de destino sai de `mapa.perfis[vinculo].para`. People e
  segurança saem de `pessoas` com `area` `people` e `seguranca`. Em `forwarding.ts`, ampliar o tipo de `to` (tarefa 1);
  `buddyOf` continua para a jornada da Tail até a #120.
- [ ] **Passo 4:** `npx vitest run src/puca src/journey`. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(puca): destino do encaminhamento escolhido pelo mapa`.

### Tarefa 5: Sistemas do mapa no quadro (`src/puca/quadro-do-mapa.ts` + whiteboard)

**Arquivos:**
- Criar: `src/puca/quadro-do-mapa.ts`
- Modificar: `src/components/whiteboard/whiteboard.ts` (interface `Whiteboard`: `revelados(): string[]`)
- Teste: `src/puca/__tests__/quadro-do-mapa.test.ts`

**Interfaces:**
- Produz:
  ```ts
  /** Nós e setas que faltam no quadro para mostrar estes sistemas e as ligações entre eles. Determinístico. */
  export function acrescentarDoMapa(atual: BoardSpec | null, sistemas: string[], m: MapaKota): { nos: BoardNode[]; setas: BoardEdge[]; existentes: string[] };
  ```
  `existentes` lista os ids de nós que o quadro já tinha para esses sistemas (casados por id ou rótulo normalizado).

- [ ] **Passo 1: escrever os testes que falham**

```ts
it("sem quadro: põe os sistemas em camadas pela dependência, sem sobrepor", () => {
  const r = acrescentarDoMapa(null, ["frontend", "ledgerwriter", "ledger-db"], mapa);
  expect(r.nos.map((n) => n.id)).toEqual(["mapa-frontend", "mapa-ledgerwriter", "mapa-ledger-db"]);
  expect(new Set(r.nos.map((n) => n.x)).size).toBe(3);                       // três camadas
  expect(r.setas.map((s) => `${s.from}>${s.to}`)).toEqual(["mapa-frontend>mapa-ledgerwriter", "mapa-ledgerwriter>mapa-ledger-db"]);
});
it("sistema que já está no quadro não é duplicado", () => {
  const atual = { nodes: [{ id: "ledgerwriter", label: "ledgerwriter", kind: "service", x: 200, y: 200 }], edges: [] } as unknown as BoardSpec;
  const r = acrescentarDoMapa(atual, ["ledgerwriter", "ledger-db"], mapa);
  expect(r.existentes).toEqual(["ledgerwriter"]);
  expect(r.nos.map((n) => n.id)).toEqual(["mapa-ledger-db"]);
  expect(r.setas[0]).toMatchObject({ from: "ledgerwriter", to: "mapa-ledger-db" });
});
it("mesma entrada, mesma saída", () => expect(acrescentarDoMapa(null, ["contacts"], mapa)).toEqual(acrescentarDoMapa(null, ["contacts"], mapa)));
```

- [ ] **Passo 2:** rodar o teste. Esperado: FAIL.
- [ ] **Passo 3: implementar.**
  - **Camadas.** A camada é a profundidade em `dependeDe` dentro do conjunto pedido.
  - **Área.** Sem quadro, as colunas são distribuídas na área de 1440 × 844. Com quadro, vão para a faixa livre à
    direita do nó mais à direita (mínimo de 260 px de largura); se não couber, abaixo.
  - **Nós.** `kind` vem da linguagem (`Postgres` → banco, o resto → serviço), e `info` traz `role` = `oQueFaz` e
    `team` = nome do time.
  - **Setas.** Seguem o `dependeDe` entre os pedidos, e também para nós existentes.
  - **Whiteboard.** `revelados()` devolve o `Set` `shown` como array.
- [ ] **Passo 4:** rodar o teste. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(puca): desenhar no quadro sistemas do mapa que ainda não estão nele`.

### Tarefa 6: Catálogo e `montar` (`src/puca/catalogo.ts`)

**Arquivos:**
- Criar: `src/puca/catalogo.ts`
- Teste: `src/puca/__tests__/catalogo.test.ts`

**Interfaces:**
- Consome: tarefas 2 a 5.
- Produz:
  ```ts
  export type Handle = `f:${string}` | `s:${string}` | `t:${string}` | `p:${string}` | `a:${number}` | `m:${string}` | `n:${string}`;
  export type AcaoPedida =
    | { faz: "dizer_dono"; alvo: Handle } | { faz: "destacar"; ids: Handle[] } | { faz: "desenhar"; ids: Handle[] }
    | { faz: "abrir_cartao"; id: Handle } | { faz: "mostrar"; f: Handle };
  export interface SegmentoPedido { cita: { f: Handle; trecho: string }[]; fala: string; acoes: AcaoPedida[] }
  export interface Plano { tipo: "responder" | "geral" | "pular" | "sessao" | "encaminhar"; alvos: Handle[];
    caso: MotivoDoEncaminhamento | null; segmentos: SegmentoPedido[] }
  export interface ContextoDeMontagem { mapa: MapaKota; trechos: Map<Handle, Trecho>; quadro: BoardSpec | null;
    revelados: string[]; vinculo: Vinculo; pergunta: string; momentos: string[] }
  export type AcaoNoQuadro = BoardAction | { type: "acrescentar"; nos: BoardNode[]; setas: BoardEdge[] };
  /** `navegador` fica vazio neste plano; o plano 4 passa a preencher quando há navegador da Puca. */
  export interface SegmentoPronto { texto: string; origem: "plano" | "roteiro" | "aviso" | "ponte" | "falha";
    fontes: CitacaoConferida[]; quadro: AcaoNoQuadro[]; navegador: AcaoDaPuca[]; cartoes: CitacaoConferida[] }
  // AcaoDaPuca: a proposta da docs/stack.md §4.3, declarada aqui com `abrir` e `marcar` até o contrato "Computer use" (#123)
  export type Desfecho = { tipo: "pular"; momento: string } | { tipo: "encaminhar"; destino: Destino; motivo: MotivoDoEncaminhamento;
    resumo: string; consultadas: { titulo: string; url: string }[] };
  export interface Montado { segmentos: SegmentoPronto[]; desfecho: Desfecho | null; bloqueado: string | null }
  export const ACOES: { readonly [K in AcaoPedida["faz"]]: { descricao: string; expandir(a: Extract<AcaoPedida, { faz: K }>, c: ContextoDeMontagem, citadas: CitacaoConferida[]): Partial<SegmentoPronto> } };
  export function montar(p: Plano, c: ContextoDeMontagem): Montado;
  ```

- [ ] **Passo 1: escrever os testes que falham**

```ts
it("dizer_dono escreve a frase pelo mapa e cita a linha do sistema", () => {
  const m = montar(planoDono("s:balancereader"), ctx());
  expect(m.segmentos[0].texto).toMatch(/Livro-razão/);
  expect(m.segmentos[0].texto).toMatch(/Thiago Nakamura/);
  expect(m.segmentos[0].fontes[0].fonte.id).toBe("mapa:sistemas/balancereader");
});
it("sistema legado: o aviso vem antes", () => {
  const m = montar(planoDono("s:ledgermonolith"), ctx());
  expect(m.segmentos[0].origem).toBe("aviso");
  expect(m.segmentos[0].texto).toMatch(/legado/);
});
it("desenhar sem quadro não quebra: a fala sai e o quadro fica vazio", () => {
  const m = montar(planoDesenhar(["s:ledgerwriter"]), ctx({ quadro: null }));
  expect(m.segmentos[0].quadro).toEqual([]);
});
it("desenhar sistema que já está no quadro revela e destaca o existente", () => {
  const m = montar(planoDesenhar(["s:ledgerwriter"]), ctx({ quadro: quadroComLedgerwriter, revelados: [] }));
  expect(m.segmentos[0].quadro).toEqual([{ type: "reveal", targets: ["ledgerwriter"] }, { type: "highlight", targets: ["ledgerwriter"], tone: "focus" }]);
});
it("handle fora do material some, e a frase que dependia dele é bloqueada", () => {
  const m = montar(planoDono("s:inventado"), ctx());
  expect(m.segmentos).toEqual([]);
  expect(m.bloqueado).toMatch(/inventado/);
});
it("encaminhar leva a fala da pessoa como resumo e o destino do mapa", () => {
  const m = montar({ tipo: "encaminhar", alvos: ["s:userservice"], caso: "sem_fonte", segmentos: [] }, ctx({ pergunta: "qual o timeout do login?" }));
  expect(m.desfecho).toMatchObject({ tipo: "encaminhar", destino: { pessoa: "raissa" }, resumo: "qual o timeout do login?" });
});
```

  `planoDono`, `planoDesenhar`, `ctx` e `quadroComLedgerwriter` são ajudantes do próprio teste: montam o contexto a
  partir de `trechosDoMapa(mapa, urls, "teste")`.

- [ ] **Passo 2:** rodar o teste. Esperado: FAIL.
- [ ] **Passo 3: implementar `montar` e `ACOES`.** As regras de cada ação estão no desenho. Neste plano, `montar`:
  - **cobre:** os tipos `responder` (segmentos com `dizer_dono`, `desenhar`, `destacar`, `abrir_cartao` e `mostrar`) e
    `encaminhar`;
  - **deixa de fora:** `pular`, que chega no plano 3, e `sessao`, que chega no plano 4.
  - **`mostrar`:** vai para `cartoes`, porque não há navegador.
  - **Quadro:** a ação `acrescentar` vem antes de `reveal` e `highlight` dos novos.
  - **Literal ainda não conferido:** a regra de `fala` livre (`conferirSegmento`) é do plano 3. Aqui, `montar` aceita só
    segmentos de roteiro (com `fala` vazia e `dizer_dono` ou `desenhar`); um plano com `fala` preenchida e sem
    conferência devolve `bloqueado`.
- [ ] **Passo 4:** rodar o teste. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(puca): catálogo de ações e montagem do plano em segmentos prontos`.

### Tarefa 7: Degrau `intencao` (`src/puca/local.ts` + `route.ts`)

**Arquivos:**
- Criar: `src/puca/local.ts`
- Modificar: `src/journey/route.ts` (`Route`, `RouteContext.mapa?`, cascata entre `faq` score 1 e `knowledge`)
- Teste: `src/puca/__tests__/local.test.ts`, `src/journey/__tests__/route.test.ts` (casos novos; os antigos não
  mudam)

**Interfaces:**
- Consome: `reconhecer` (tarefa 3), `Plano` (tarefa 6).
- Produz:
  ```ts
  export function classificarLocal(fala: string, c: { mapa: MapaKota; foco: EntidadeId[] }): Plano | null;
  // RouteContext ganha `mapa?: MapaKota; foco?: EntidadeId[]`; Route ganha `{ kind: "intencao"; plano: Plano }`
  ```

- [ ] **Passo 1: escrever os testes que falham**

```ts
it.each([
  ["quem cuida do balancereader?", "dizer_dono", ["s:balancereader"]],
  ["de quem é o ledger-db?", "dizer_dono", ["s:ledger-db"]],
  // o sistema, depois o dependeDe dele, depois quem depende dele (na ordem do mapa)
  ["como o ledgerwriter se liga com os outros?", "desenhar", ["s:ledgerwriter", "s:balancereader", "s:ledger-db", "s:frontend"]],
  ["mostra o ADR 4", "mostrar", ["a:4"]],
])("%s → %s", (fala, faz, ids) => {
  const p = classificarLocal(fala, { mapa, foco: [] })!;
  expect(p.segmentos[0].acoes[0].faz).toBe(faz);
  expect(idsDe(p)).toEqual(ids);
});
it("sem entidade, mas com foco vindo da tela, usa o foco", () =>
  expect(idsDe(classificarLocal("quem cuida disso?", { mapa, foco: ["sistema:contacts"] })!)).toEqual(["s:contacts"]));
it("pergunta que o mapa não responde segue a cascata", () =>
  expect(classificarLocal("por que o saldo usa cache?", { mapa, foco: [] })).toBeNull());

// route.test.ts
it("com o mapa no contexto, 'quem cuida do balancereader?' é intencao, antes do knowledge", () =>
  expect(routeUtterance("quem cuida do balancereader?", { ...ctx, mapa }).kind).toBe("intencao"));
it("sem o mapa no contexto, nada muda", () =>
  expect(routeUtterance("quem cuida do balancereader?", ctx).kind).not.toBe("intencao"));
```

- [ ] **Passo 2:** rodar os dois arquivos de teste. Esperado: FAIL.
- [ ] **Passo 3: implementar.** São três intenções, por palavra-chave depois de `normalizar`:
  - **dono:** "quem cuida", "de quem é", "responsável", "dono", "quem mantém";
  - **ligações:** "se liga", "fala com", "depende", "conversa com", "chama quem". Desenha o sistema mais o `dependeDe`
    dele e quem depende dele;
  - **fonte:** "mostra", "abre", "onde está" + ADR.

  Só responde com entidade reconhecida, ou com `foco` quando a fala é dêitica ("isso", "esse", "aqui"). No `route.ts`,
  o degrau só roda com `ctx.mapa`.
- [ ] **Passo 4:** rodar os testes. Esperado: PASS (os casos antigos do `route.test.ts` também).
- [ ] **Passo 5:** commit `feat(journey): degrau intencao responde pelo mapa antes do conhecimento`.

### Tarefa 8: Executor com fila única (`src/puca/executor.ts`)

**Arquivos:**
- Criar: `src/puca/executor.ts`
- Teste: `src/puca/__tests__/executor.test.ts`

**Interfaces:**
- Consome: `Montado`, `SegmentoPronto`, `Desfecho` (tarefa 6).
- Produz:
  ```ts
  export interface Palco {
    falar(texto: string, aoComecar: () => void, sinal: AbortSignal): Promise<void>;
    quadro: { aplicar(a: BoardAction): void; acrescentar(nos: BoardNode[], setas: BoardEdge[]): void } | null;
    cartao(c: CitacaoConferida): void;
    encaminhar(d: Extract<Desfecho, { tipo: "encaminhar" }>): void;
    pular(momento: string): void;
  }
  export interface Executor { executar(m: Montado): Promise<"ok" | "cancelado">; cancelar(): void }
  export function criarExecutor(p: Palco): Executor;
  ```

- [ ] **Passo 1: escrever os testes que falham** (com um palco falso que grava a ordem das chamadas)

```ts
it("o quadro de cada segmento sai quando a fala dele começa, e o desfecho depois da última", async () => {
  const p = palcoFalso();
  await criarExecutor(p).executar({ segmentos: [seg("a", [rev("x")]), seg("b", [rev("y")])], desfecho: encaminharPara("raissa"), bloqueado: null });
  expect(p.ordem).toEqual(["falar:a", "quadro:reveal x", "fim:a", "falar:b", "quadro:reveal y", "fim:b", "encaminhar:raissa"]);
});
it("sem quadro no palco, as ações de quadro são ignoradas e a fala sai", async () => {
  const p = palcoFalso({ quadro: null });
  await criarExecutor(p).executar({ segmentos: [seg("a", [rev("x")])], desfecho: null, bloqueado: null });
  expect(p.ordem).toEqual(["falar:a", "fim:a"]);
});
it("cancelar no meio para a fila e não aplica o desfecho", async () => {
  const p = palcoFalso({ falaDemora: true });
  const ex = criarExecutor(p);
  const r = ex.executar({ segmentos: [seg("a", []), seg("b", [])], desfecho: encaminharPara("raissa"), bloqueado: null });
  ex.cancelar();
  expect(await r).toBe("cancelado");
  expect(p.ordem).not.toContain("encaminhar:raissa");
});
it("cartões de fonte saem depois da fala do segmento", async () => { /* … ordem "falar:a", "fim:a", "cartao:…" */ });
```

- [ ] **Passo 2:** rodar o teste. Esperado: FAIL.
- [ ] **Passo 3: implementar.**
  - **Fila.** Uma `Promise` em cadeia com `AbortController`.
  - **`acrescentar`.** Vai para `palco.quadro.acrescentar`; as outras ações de quadro, para `aplicar`.
  - **Encaminhamento.** É gravado mesmo se a fala falhar, mas não depois de `cancelar()`.
- [ ] **Passo 4:** rodar o teste. Esperado: PASS.
- [ ] **Passo 5:** commit `feat(puca): executor toca fala, quadro e desfecho numa fila só`.

### Tarefa 9: Sessão usa o degrau e o executor (`src/screens/lesson/main.ts`)

**Arquivos:**
- Modificar:
  - `src/screens/lesson/main.ts`:
    - o `RouteContext` em `atenderFala` ganha `mapa` e `foco`;
    - novo `case "intencao"`;
    - `forward` recebe o `Destino`;
    - o `showBoard` guarda a spec atual;
    - o palco implementa `acrescentar`, remontando com os nós a mais e reaplicando `revelados()`.
  - `src/journey/trail.ts` (`fontes?` em `TrailEntry`).
  - `src/journey/__tests__/trail.test.ts` (caso com `fontes`).

**Interfaces:**
- Consome: `classificarLocal`, `montar`, `criarExecutor`, `trechosDoMapa`, `destinoDoEncaminhamento`.

- [ ] **Passo 1:** teste do rastro: `trail.update(id, { fontes: [{ titulo, url }] })` grava e `sourcesFor` não muda
  para as rotas antigas. Rodar e ver falhar.
- [ ] **Passo 2:** implementar o campo `fontes` no rastro. Rodar e ver passar.
- [ ] **Passo 3: ligar a tela.**
  - **Montagem.** Monte uma vez `const trechos = trechosDoMapa(mapa, urls, versaoDoMapa)` e o executor com o palco da
    sessão: `falar` = `speakAside` com `aoComecar` no início do áudio, `cartao` = aviso no canto com o trecho e o
    link, `encaminhar` = **pergunta antes** ("Levo para a {nome}, {papel} do time {time}?", com as respostas sugeridas
    "Pode levar" e "Não precisa") e só no sim faz `outbox.add` com `to` do destino; no não, diz "Tudo bem, não levei."
    (decidido com Joaquim em 2026-11-08).
  - **`case "intencao"`.** Monta o contexto (`quadro` = spec atual, `revelados` = `board.revelados()`) e chama
    `executor.executar(montar(route.plano, contexto))`. Grava `fontes` e `answer` no rastro.
  - **Barge-in.** Também chama `executor.cancelar()`.
- [ ] **Passo 4:** `npm run check`. Esperado: tudo verde.
- [ ] **Passo 5: verificação ao vivo.** `npm run dev` sem o servidor, sessão aberta, no chat:
  1. "quem cuida do balancereader?" → fala com Livro-razão, Thiago Nakamura e Beatriz Cavalcanti; rastro com a URL da
     database Sistemas.
  2. "como o ledgerwriter se liga?" → o quadro ganha ledgerwriter, balancereader e ledger-db, com setas, sem apagar o
     que estava revelado.
  3. "quem cuida do ledgermonolith?" → aviso de legado antes.

  Anotar o resultado na issue. Enquanto a #120 não entra, a sessão ainda é a da Tail: o teste prova o degrau, e a demo
  do portão 1 fica para depois da #120.
- [ ] **Passo 6:** commit `feat(lesson): perguntas sobre sistemas da kota respondidas pelo mapa, com desenho e destino certo`.

### Tarefa 10: Fechamento do plano

- [ ] **Passo 1:** `npm run check` verde, com a saída colada na issue.
- [ ] **Passo 2:** abrir as issues que faltaram (skill `handoff`, item "Faltou algo"), por exemplo o FAQ de dono da
  jornada passar a usar `dizer_dono` quando os nós da Kota tiverem entidade (plano 4).
- [ ] **Passo 3:** PR pela skill `handoff`, com `Closes` da issue deste plano e a lista de contratos mudados.
