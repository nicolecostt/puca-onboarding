# Navegador da Puca (computer use de verdade): plano de implementação

> **Para agentes:** sub-skill obrigatória: `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans`. Passos com checkbox (`- [ ]`). **Reta final (`CLAUDE.md`, decisão 0010):** até 12:00
> de 2026-11-08; cada tarefa tem um tempo-alvo. Passou 15 min do alvo? Corte para o que a tarefa diz em "Se apertar".

**Objetivo:** no app para Mac, a sessão abre o mundo da Kota num navegador de verdade dentro da tela, e a Puca aponta,
circula, marca e clica nele no ritmo da fala; quando a pessoa fala por cima, para na hora. No `npm run dev`, nada muda.

**Arquitetura:** o processo principal do Electron (`desktop/navegador/`) cria um `WebContentsView` e o controla pelo
protocolo de depuração (`webContents.debugger`), com uma camada injetada na página (cursor, círculo, marca-texto) e uma
fila serial cancelável. O `preload` expõe `window.orbis.navegador`. Na sessão, as ações do navegador são uma ação nova
da jornada (`type: "navegador"`), disparadas pelas mesmas marcas `at` da fala que já movem o quadro; o palco alterna
entre **Quadro** e **Navegador**. Ponto de partida: a prova de 2026-11-08 em [`prova-desenho.cjs`](prova-desenho.cjs).

**Stack:** Electron 33 (`WebContentsView`, `webContents.debugger` 1.3), TypeScript, esbuild (`npm run build:desktop`),
Vite, Vitest (ambiente `node`, sem DOM).

**Especificação:** `docs/stack.md` §4 e decisão 0008; `PRODUCT.md` §12.2; issue #123. Abordagem acertada na conversa
de 2026-11-08: o navegador fica **na sessão**, não na `live-session`; a jornada dá as ações fixas da demo; o LLM
escolher ações por intenção (#173, #174) vem depois e consome o mesmo `window.orbis.navegador`.

## Restrições globais

- `npm run dev` no navegador comum continua igual: sem `window.orbis.navegador`, a ação `navegador` é ignorada e a
  `live-session` simulada segue (critério da #123).
- O navegador da Puca só abre o mundo da Kota: `https://github.com/JucaGF/kota-bank` (e caminhos abaixo dele) e
  `https://lean-ptarmigan-dd2.notion.site/`. Slack fica fora deste plano.
- Nunca `digitar`, nunca publicar: as ações deste plano são `abrir`, `apontar`, `circular`, `marcar`, `clicar`,
  `rolar` e `limpar`.
- Electron: `sandbox: true`, `contextIsolation: true`, sem `nodeIntegration` no `WebContentsView`;
  `partition: "persist:kota"`; `setWindowOpenHandler` nega janela nova.
- O alvo é achado pelo texto visível (sem diferenciar maiúscula nem acento) ou por seletor, nunca por coordenada fixa.
  Rolar até o alvo **antes** de ler a posição; clicar no centro do `closest("a, button")`.
- Barra de call, chat e câmera ficam **em volta** da área do navegador (`CLAUDE.md`, telas).
- Textos de interface, comentários e commits em português; commits `tipo(escopo): mensagem`, sem linha de coautoria.

## Foco da revisão

1. **A pessoa fala por cima no meio de `abrir`:** a fila não executa a ação seguinte, a camada é limpa, e o
   `finally` de `falar` (`src/screens/lesson/main.ts:627`) não dispara as ações do navegador que faltavam (só as do
   quadro). Teste na Tarefa 4.
2. **Alvo que não existe na página** (texto mudou no GitHub ou no Notion): a ação falha, a fila segue e a sessão
   continua falando. Teste da fila na Tarefa 3 (pela resposta `falhas`).
3. **Clique que leva para fora da Kota** (ex.: link do GitHub para `github.com/features`): `will-navigate` bloqueia e
   a página fica onde estava. Teste de `permitido` na Tarefa 2.
4. **Chat aberto ou janela redimensionada:** a área do navegador acompanha (`ResizeObserver` + `chatpanel:change`),
   sem cobrir o chat. Conferido ao vivo na Tarefa 6.
5. **Página nova sem recarregar** (GitHub e Notion trocam de página por `pushState`): os desenhos da página anterior
   somem (`Page.navigatedWithinDocument` → `limpar`). Conferido ao vivo na Tarefa 6.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/orbis.ts` (novo) | tipos do contrato: `Alvo`, `AcaoDaPuca`, `ResultadoDaFila`, `OrbisNavegador`, `window.orbis` |
| `docs/contratos.md` | seção "Computer use" sai de "Contratos que vão surgir" |
| `src/journey/types.ts`, `src/journey/validate.ts` | `BoardAction` ganha `{ type: "navegador"; acao: AcaoDaPuca }` |
| `desktop/navegador/guarda.ts` (novo) + teste | `permitido(url)` |
| `desktop/navegador/camada.ts` (novo) + teste | script injetado, montado de funções de verdade (testáveis) |
| `desktop/navegador/index.ts` (novo) | `WebContentsView`, protocolo de depuração, fila, IPC |
| `desktop/main.ts`, `desktop/preload.ts` | ligar o navegador à janela; expor `orbis.navegador` |
| `src/screens/lesson/palco-navegador.ts` (novo) | área do navegador na sessão, abas Quadro/Navegador, bounds |
| `src/screens/lesson/cortes.ts` (novo) + teste | quais ações ainda valem depois de a fala ser cortada |
| `src/screens/lesson/{index.html,style.css,main.ts}` | host do navegador, `io.apply`, barge-in |
| `src/journey/data/kota.journey.json` | ações `navegador` em dois passos (skill `nova-jornada`) |

**Não mexe:** `live-session/`, servidor, `route.ts`, `runner.ts` (as marcas `at` já funcionam para qualquer
`BoardAction`).

**Conflito conhecido:** o PR #177 (jornada da Kota) mexe em `src/screens/lesson/main.ts`, `docs/contratos.md` e
`docs/journey-format.md`. Antes de cada commit, rode a skill `sincronizar`; a Tarefa 5 só começa com o #177 na `main`.

---

### Tarefa 1: Contrato "Computer use" e ação `navegador` na jornada (alvo: 10 min, até ~10:05)

**Arquivos:**
- Criar: `src/lib/orbis.ts`
- Modificar: `docs/contratos.md` (linha da tabela "Contratos que vão surgir" vira linha da tabela principal + seção
  `## Computer use`), `src/journey/types.ts` (união `BoardAction`), `src/journey/validate.ts:9` e o laço das ações
  (`:120-141`)
- Testar: `src/journey/__tests__/validate.test.ts`

**Interfaces (produz, usadas por todas as outras tarefas):**

```ts
// src/lib/orbis.ts
export type Alvo = { texto: string; seletor?: string } | { seletor: string };
export type AcaoDaPuca =
  | { tipo: "abrir"; url: string }
  | { tipo: "apontar" | "circular" | "marcar" | "rolar" | "clicar"; alvo: Alvo }
  | { tipo: "limpar" };
export interface ResultadoDaFila { feitas: number; falhas: { acao: AcaoDaPuca; motivo: string }[]; cancelada: boolean }
export interface OrbisNavegador {
  mostrar(bounds: { x: number; y: number; width: number; height: number }): void;
  esconder(): void;
  executar(acoes: AcaoDaPuca[]): Promise<ResultadoDaFila>;
  cancelar(): void;
}
declare global { interface Window { orbis?: { versao: string; navegador?: OrbisNavegador } } }
```

Em `types.ts`, a união `BoardAction` ganha `| { type: "navegador"; acao: AcaoDaPuca }` (o `at` continua valendo).
A seção do `docs/contratos.md` traz os tipos acima, a lista de endereços permitidos, a regra "sem `window.orbis` a ação
é ignorada" e este exemplo válido de passo:
`{ "type": "navegador", "acao": { "tipo": "circular", "alvo": { "texto": "README.md" } }, "at": "ADR 1" }`.
A linha "Computer use" da tabela principal aponta para `src/lib/orbis.ts` e diz quem depende (`desktop/`, sessão).
Use a skill `contrato` só para o checklist dela; não abra discussão (reta final).

- [ ] **Passo 1: testes que falham** em `validate.test.ts`:
  - `aceita ação navegador num momento sem quadro`: uma jornada com um passo de vista `logo` e
    `actions: [{ type: "navegador", acao: { tipo: "abrir", url: "https://github.com/JucaGF/kota-bank" } }]` não dá erro.
  - `recusa ação navegador com tipo desconhecido`: `acao: { tipo: "digitar" }` dá erro contendo `navegador`.
- [ ] **Passo 2:** `npx vitest run src/journey/__tests__/validate.test.ts` → FALHA (ação "navegador" desconhecida).
- [ ] **Passo 3:** em `validate.ts`, `"navegador"` entra em `ACTION_TYPES`, fica fora da checagem "num momento sem
  quadro" e da checagem de alvos do quadro, e o `acao.tipo` tem de ser um dos sete do contrato.
- [ ] **Passo 4:** o mesmo comando → PASSA; `npm run typecheck` → sem erro (o `switch` de `io.apply` em
  `lesson/main.ts:646` precisa de um `case "navegador": return;` provisório; a Tarefa 4 preenche).
- [ ] **Passo 5:** commit `feat(journey): ação navegador na jornada e contrato do computer use`.

### Tarefa 2: Guarda e camada, puras e testadas (alvo: 15 min, até ~10:20)

**Arquivos:**
- Criar: `desktop/navegador/guarda.ts`, `desktop/navegador/camada.ts`
- Testar: `desktop/navegador/guarda.test.ts`, `desktop/navegador/camada.test.ts`

**Interfaces (produz):**
- `permitido(url: string): boolean` em `guarda.ts`.
- `normalizar(texto: string): string` (minúsculas, sem acento por `NFD` + remover marcas, espaços colapsados, `trim`).
- `escolherAlvo(candidatos: { texto: string; visivel: boolean; clicavel: boolean }[], procurado: string): number`
  devolve o índice: só visíveis cujo `normalizar(texto)` contém `normalizar(procurado)`; clicáveis antes; entre
  empatados, o de texto mais curto; `-1` se nenhum.
- `CAMADA: string` em `camada.ts`: o script injetado. É montado **das funções acima** (`normalizar.toString()`,
  `escolherAlvo.toString()`), então o que roda na página é o que o teste cobre. Ele define `window.__puca` com
  `achar(alvo)`, `cursor(x, y)`, `circular(r)`, `marcar(r)`, `limpar()`, copiados de `prova-desenho.cjs` (traço à
  mão, coordenadas do documento, `pointer-events: none`, `z-index` máximo), com as cores roxo `#6b4eff`, vermelho
  `#e5484d` e marca-texto `#ffe06680`. `achar` procura primeiro em `a, button, [role=button], input, textarea`,
  depois em `h1, h2, h3, p, li, span, td`, faz `scrollIntoView({ block: "center" })` e só então devolve
  `{ doc, vp }` (retângulo no documento e na tela), ou `null`.
- O mesmo script instala, uma vez (`window.__pucaOuvindo`), o ouvinte de `click` em captura que ignora cliques com
  `window.__pucaClicando`. (Perceber a pessoa fica fora deste plano; o ouvinte só evita contar o clique da Puca.)

- [ ] **Passo 1: testes que falham.**
  - `guarda.test.ts`: `permitido("https://github.com/JucaGF/kota-bank")` → `true`;
    `permitido("https://github.com/JucaGF/kota-bank/blob/main/README.md")` → `true`;
    `permitido("https://lean-ptarmigan-dd2.notion.site/412bd621283f81849a35d3b5f53b6ac8")` → `true`;
    `permitido("https://github.com/JucaGF/kota-bank-oficina")` → `false`;
    `permitido("https://github.com/features")` → `false`; `permitido("http://github.com/JucaGF/kota-bank")` → `false`;
    `permitido("https://evil.com/?u=github.com/JucaGF/kota-bank")` → `false`; `permitido("nada")` → `false`.
  - `camada.test.ts`: `normalizar("  Livro-Razão\n ") === "livro-razao"`;
    `escolherAlvo([{texto:"README.md (2)",visivel:true,clicavel:false},{texto:"README.md",visivel:true,clicavel:true}], "readme.md") === 1`;
    invisível nunca é escolhido; nenhum → `-1`; `CAMADA` contém `function normalizar` e `__pucaClicando`.
- [ ] **Passo 2:** `npx vitest run desktop/navegador` → FALHA (módulos não existem).
- [ ] **Passo 3:** implementar `guarda.ts` (por `new URL`; protocolo `https:`; host `github.com` com caminho
  `/JucaGF/kota-bank` exato ou começando por `/JucaGF/kota-bank/`; host `lean-ptarmigan-dd2.notion.site`) e
  `camada.ts`.
- [ ] **Passo 4:** `npx vitest run desktop/navegador` → PASSA.
- [ ] **Passo 5:** commit `feat(app): guarda e camada do navegador da puca`.

**Se apertar:** o `escolherAlvo` pode ser só "texto normalizado igual ou contido, o mais curto".

### Tarefa 3: Navegador no processo principal e `window.orbis.navegador` (alvo: 35 min, até ~10:55)

**Arquivos:**
- Criar: `desktop/navegador/index.ts`
- Modificar: `desktop/main.ts` (`abrirJanela` chama `ligarNavegador(win)`), `desktop/preload.ts`

**Interfaces:**
- Consome: `permitido` e `CAMADA` (Tarefa 2), tipos de `src/lib/orbis.ts` (Tarefa 1, por `import type`).
- Produz: `ligarNavegador(win: BrowserWindow): void` e os canais IPC `orbis:navegador:mostrar`, `:esconder`,
  `:cancelar` (`ipcMain.on`) e `:executar` (`ipcMain.handle`, devolve `ResultadoDaFila`). O `preload` expõe
  `navegador` em `window.orbis` com os quatro métodos de `OrbisNavegador`, por `ipcRenderer.send`/`invoke`, nada mais.

Comportamento (a prova já tem quase todo o código; ver `prova-desenho.cjs`):

- **Criação preguiçosa** no primeiro `mostrar`: `new WebContentsView({ webPreferences: { partition: "persist:kota",
  sandbox: true, contextIsolation: true, nodeIntegration: false } })`, `win.contentView.addChildView(view)`,
  `view.setBounds(bounds)` (os bounds do front já estão em pixels da janela). `esconder` = `setVisible(false)`.
- **Depurador:** `debugger.attach("1.3")`, `Page.enable`, `Runtime.enable`, `Page.setBypassCSP({ enabled: true })`,
  `Page.addScriptToEvaluateOnNewDocument({ source: CAMADA })`. Em `Page.frameNavigated` (frame principal) e
  `Page.navigatedWithinDocument`: `Runtime.evaluate("window.__puca?.limpar()")`. Antes de cada ação, garante a camada
  com `Runtime.evaluate(CAMADA)` (a página pode ter sido aberta antes do script registrado).
- **Guarda:** no `webContents` do view, `will-navigate` e `will-redirect` com `!permitido(url)` → `preventDefault()`;
  `setWindowOpenHandler(() => ({ action: "deny" }))`.
- **Fila serial:** as chamadas de `executar` se encadeiam numa promessa só (uma de cada vez, na ordem de chegada).
  `cancelar()` incrementa `geracao` e chama `__puca.limpar()`; cada ação confere a geração **antes** de começar; a
  que estava rodando termina. Com a geração mudada, o lote devolve `cancelada: true` e não executa o resto.
- **Ações:**
  - `abrir`: `!permitido(url)` → falha `"fora da Kota"`; senão `Page.navigate` e espera `Page.frameStoppedLoading` ou
    8 s (o que vier antes; sites de página única às vezes não mandam o evento), mais 600 ms.
  - `apontar`, `circular`, `marcar`, `rolar`: `__puca.achar(alvo)`; `null` → falha `"não achei <texto>"` e a fila
    segue; senão cursor até o alvo (900 ms), depois o desenho.
  - `clicar`: `achar`, cursor, `window.__pucaClicando = true`, `Input.dispatchMouseEvent` `mouseMoved`,
    `mousePressed`, `mouseReleased` no centro de `vp`, `__pucaClicando = false` 50 ms depois, espera 1,5 s.
  - `limpar`: `__puca.limpar()`.
- Tudo em `try/catch` por ação: erro do protocolo vira falha, nunca exceção para o front.

- [ ] **Passo 1:** implementar `index.ts`, ligar em `main.ts` e no `preload.ts`.
- [ ] **Passo 2:** `npm run typecheck && npm run build:desktop` → sem erro.
- [ ] **Passo 3: prova ao vivo.** `npm run dev` num terminal, `npm run dev:app` no outro; no app, abrir
  Visualizar → Ferramentas de desenvolvedor e rodar:
  `orbis.navegador.mostrar({x:40,y:80,width:900,height:600}); await orbis.navegador.executar([{tipo:"abrir",url:"https://github.com/JucaGF/kota-bank"},{tipo:"circular",alvo:{texto:"README.md"}},{tipo:"clicar",alvo:{texto:"README.md"}}])`
  → GitHub aparece no retângulo, círculo em volta do `README.md`, o README abre; o retorno é
  `{ feitas: 3, falhas: [], cancelada: false }`. Depois
  `orbis.navegador.executar([{tipo:"abrir",url:"https://github.com/features"}])` → `falhas[0].motivo === "fora da Kota"`.
- [ ] **Passo 4:** commit `feat(app): navegador da puca dentro do app, com fila que para quando a pessoa fala`.

**Se apertar:** deixe `marcar` e `rolar` como `apontar` (mesmo cursor, sem desenho próprio).

### Tarefa 4: O navegador na sessão (alvo: 30 min, até ~11:25)

Pode começar em paralelo com a Tarefa 3, logo depois da Tarefa 1: só depende de `OrbisNavegador`.

**Arquivos:**
- Criar: `src/screens/lesson/palco-navegador.ts`, `src/screens/lesson/cortes.ts`
- Modificar: `src/screens/lesson/index.html` (depois do `#board-host`:
  `<div class="lesson__board lesson__navegador" id="navegador-host" hidden></div>` e
  `<div class="palco-abas" id="palco-abas" hidden>` com os botões "Quadro" e "Navegador"),
  `src/screens/lesson/style.css`, `src/screens/lesson/main.ts` (`io.apply`, `tomarAVez` em `:252`, o `finally` de
  `falar` em `:627`, `showBoard`/`showLogo`)
- Testar: `src/screens/lesson/cortes.test.ts`

**Interfaces:**
- Consome: `OrbisNavegador`, `AcaoDaPuca`, `BoardAction`, `SpeechCue`.
- Produz:
  - `acoesQueAindaValem(cues: SpeechCue[], desde: number): BoardAction[]` em `cortes.ts`: as ações de
    `cues.slice(desde)` que **não** são `type: "navegador"`.
  - `montarPalcoNavegador(host: HTMLElement, abas: HTMLElement, orbis: OrbisNavegador | undefined): PalcoNavegador | null`
    (`null` sem `orbis`), com `PalcoNavegador = { executar(a: AcaoDaPuca): void; mostrarNavegador(): void;
    mostrarQuadro(): void; cancelar(): void }`.

Comportamento:

- `mostrarNavegador`: esconde `#board-host`, mostra `#navegador-host` e as abas, mede o host com
  `getBoundingClientRect` e chama `orbis.mostrar`; mede de novo em `ResizeObserver` do host, `resize` da janela e
  `chatpanel:change` (com o chat aberto, a largura perde a do painel do chat: `width - 404`).
  `mostrarQuadro`: `orbis.esconder()` e volta ao `#board-host`. As abas trocam entre os dois.
- `executar(a)`: `mostrarNavegador()` e `void orbis.executar([a])`; falha vai para `console.warn` (sem erro vermelho).
- Em `main.ts`: `const palco = montarPalcoNavegador(..., window.orbis?.navegador)`; em `io.apply` (`:646`), trate
  `a.type === "navegador"` **antes** do `if (!board) return` (o passo pode estar numa vista sem quadro):
  `palco?.executar(a.acao)` (sem app, não faz nada: o simulado segue); `showBoard` e `showLogo` chamam
  `palco?.mostrarQuadro()` só quando a vista muda (`fresh`); `tomarAVez` chama `palco?.cancelar()` logo depois de
  `voice.stop()`; no `finally` de `falar`, o laço do corte usa `acoesQueAindaValem(cues, next)` em vez de aplicar
  todas.
- CSS: `.lesson__navegador` herda a posição de `.lesson__board` (`inset: var(--top) 24px var(--bottom)`, `right: 300px`
  com a câmera); `.palco-abas` fica acima da área, no espaço do título, sem sobrepor o retângulo medido.

- [ ] **Passo 1: teste que falha** em `cortes.test.ts`: com cues `[highlight@5, navegador(circular)@10,
  card@20, navegador(clicar)@30]` e `desde = 1`, `acoesQueAindaValem` devolve só `[card]`; com `desde = 0`, devolve
  `[highlight, card]`.
- [ ] **Passo 2:** `npx vitest run src/screens/lesson/cortes.test.ts` → FALHA.
- [ ] **Passo 3:** implementar `cortes.ts`, `palco-navegador.ts` e as mudanças em `main.ts`, `index.html` e `style.css`.
- [ ] **Passo 4:** o teste → PASSA; `npm run typecheck` → sem erro.
- [ ] **Passo 5:** commit `feat(lesson): a sessão mostra o navegador da puca e para as ações quando a pessoa fala`.

**Se apertar:** sem abas (o palco volta ao quadro sozinho na próxima vista) e sem descontar o chat.

### Tarefa 5: Dois passos da jornada da Kota usam o navegador (alvo: 15 min, até ~11:40)

Começa só com o PR #177 (jornada da Kota) na `main`. Às 11:10 sem merge: faça na branch do #177 combinando com quem
a abriu, ou use a jornada da `main` e diga no PR. Use a skill `nova-jornada`.

**Arquivos:** modificar `src/journey/data/kota.journey.json`.

Escolha dos endereços (as fontes precisam estar no ar; os ADRs só entram no `kota-bank` com o PR #178):

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://github.com/JucaGF/kota-bank/blob/main/docs/adr/0001-de-monolito-para-tres-servicos.md
```

(Confira o nome exato do arquivo do ADR 1 no `kota-bank` antes de rodar.)

- **`pagamentos` / `pg-saldo`** ("…nasceu quando o monolito virou três serviços, no ADR 1"):
  - ADR no ar (200): `abrir` o ADR 1 sem `at`; `marcar` o título dele com `at: "ADR 1"`.
  - Sem o ADR (404): `abrir` `https://github.com/JucaGF/kota-bank` sem `at`; `circular` `{ texto: "README.md" }` com
    `at: "ADR 1"`.
- **`empresa-e-cultura`**, o primeiro passo que cita um valor da Kota: `abrir` a página do Notion dos valores
  (`https://lean-ptarmigan-dd2.notion.site/412bd621283f81849a35d3b5f53b6ac8`, a mesma do `info.url` do nó) e
  `apontar` um título visível dela (abra a página e copie o texto exato) com `at` no nome do valor.

- [ ] **Passo 1:** editar os dois passos.
- [ ] **Passo 2:** `npm test` → PASSA (inclui `validate`).
- [ ] **Passo 3:** commit `feat(journey): a puca abre o kota-bank e o notion da kota durante a sessão`.

### Tarefa 6: Verificação ao vivo e PR (alvo: 15 min, até ~11:55)

- [ ] **Passo 1:** `npm run check` → verde.
- [ ] **Passo 2: no app** (`npm run dev:fly` ou `npm run dev` + `npm run dev:app`), sessão com `?perfil=` da Kota:
  1. Nos dois passos da Tarefa 5, o palco troca para o navegador, a página da Kota abre e o cursor da Puca circula ou
     aponta na hora da palavra marcada.
  2. Falar por cima (ou tomar a vez pelo chat) durante `abrir` → nada mais acontece no navegador, os desenhos somem e a
     Puca escuta.
  3. Abrir e fechar o chat, redimensionar a janela → o navegador não cobre o chat.
  4. Clicar num link que leva para fora do `kota-bank` → a página não sai.
  5. Aba "Quadro" volta ao quadro; a sessão segue até o fim; console sem erro vermelho.
- [ ] **Passo 3: sem o app** (`npm run dev`, navegador comum): a mesma sessão roda até o fim, sem navegador e sem erro
  no console; "Abrir Slack" continua levando à `live-session` simulada.
- [ ] **Passo 4:** atualizar a linha 9 de `docs/demo.md` (estado do computer use) e abrir o PR pela skill `handoff`
  com `Closes #123`. No PR, liste o que ficou de fora (abaixo).

---

## Fora deste plano (vai como linha no PR, reta final)

- Perceber a pessoa (`aoAgirAPessoa`, modo "acompanhar") e passar o que ela fez ao turno do LLM (#173).
- Ações pedidas pelo LLM ou pelo mapa (`mostrar` da #174, plano 4), até 3 por turno.
- Ações no rastro (critério da #123): não há entrada de rastro para fala da jornada hoje; precisa de campo novo no
  contrato do rastro.
- `seta`, `cartao`, `digitar`; Slack no navegador da Puca (o encaminhamento real é da #129).
- Abrir a fonte de um nó no navegador quando a pessoa toca nele (`docs/stack.md` §9).
