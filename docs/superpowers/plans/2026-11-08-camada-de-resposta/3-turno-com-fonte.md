# Plano 3 — Turno com fonte: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para executar este plano tarefa a tarefa. Os passos usam caixas (`- [ ]`) para
> acompanhar o andamento.

**Objetivo:** quando a cascata local não resolve, o modelo escolhe o tipo de resposta e devolve um plano em pedaços.
Cada frase só é falada depois de a citação ser conferida no servidor. Falha técnica não vira encaminhamento, e o rastro
guarda a fonte de cada resposta.

**Arquitetura:**
- **No servidor:** `server/src/turno/` monta o material do turno com o brain (plano 2), chama o Haiku 5.5 uma vez com o
  esquema que sai do catálogo (`src/puca/catalogo.ts`), lê o JSON em stream com `LeitorDePlano`, confere cada segmento
  e só emite o que passou.
- **No app:** o executor (plano 1) toca os segmentos conforme chegam.
- **Na troca:** o `/api/ask` v1 sai no mesmo PR em que o v2 entra.

**Tecnologia:** TypeScript, Fastify, `@anthropic-ai/sdk` (já no repo pela #161), Vitest.

**Especificação:** [`desenho.md`](desenho.md) (seções "O plano do modelo, em pedaços conferidos", "O turno" e "O
executor").

## Restrições globais

- **Modelo:** Claude Haiku 5.5, sem raciocínio, esforço `medium`, prazo de 8 s para o turno inteiro. A ponte sai na
  hora; a segunda ponte, aos 3 s sem segmento conferido.
- **Esquema:** fixo, derivado do catálogo, sem `enum` por turno. Todos os campos obrigatórios, com `cita` antes de
  `fala`.
- **"Não sei" ≠ "deu erro":** `sem_fonte` encaminha. Timeout, erro, recusa, saída fora do esquema e trava diária só
  dizem a frase de falha (decisão 0007, PR #169).
- **Servidor sem jornada:** o que ele precisa do momento, dos alvos de pulo e do quadro vem em `onde`.
- **Privacidade:** o log do servidor nunca leva a fala nem o contexto do computador.
- **Migrar e apagar:** quem chama o v1 é migrado, e o v1 é apagado no mesmo PR.

## Foco da revisão

1. **Frase verdadeira com conclusão errada** ("o ADR 6 adotou a fila", citando o literal do ADR 6): a regra de
   situação põe o aviso "foi rejeitado" antes. Teste na tarefa 4.
2. **Papel invertido** ("a Beatriz é tech lead", citando a linha do time): é bloqueada pela regra de papel. Teste na
   tarefa 4.
3. **Pergunta geral com termo da Kota** ("por quanto tempo o saldo fica em cache?", sem trecho): não pode sair como
   `geral`, porque "saldo" é termo do glossário do banco. Teste na tarefa 4.
4. **Stream cortado no meio de uma frase:** a frase aberta não é falada e o turno fecha como `falha`. Testes nas
   tarefas 3 e 7.
5. **Pessoa fala por cima no meio do turno:** nenhum evento depois do cancelamento é aplicado, e o encaminhamento não
   sai. Testes nas tarefas 7 e 9.

---

### Tarefa 1: Medir antes de construir (`server/bench/plano.ts`)

**Arquivos:**
- Criar: `server/bench/plano.ts`; script `bench:plano` em `package.json`

**O que mede**, nas perguntas de `server/bench/perguntas-kota.json` (plano 2), com o brain real:

| Variante | Como |
|---|---|
| A | saída estruturada em stream (`output_config.format`) com o esquema do plano |
| B | ferramenta forçada `responder` com `eager_input_streaming` |
| C (#25) | o Notion inteiro na parte fixa do prompt, com cache, contra a busca (top 8) |

Saída por variante:
- p50 e p95 do tempo até o 1º segmento fechado;
- porcentagem de segmentos com `cita` antes de `fala`;
- porcentagem de literais que passam em `conferirLiteral`;
- tokens de entrada (com e sem cache) e de saída.

- [ ] **Passo 1:** escrever o bench. O fechamento do 1º segmento é detectado por varredura simples do texto acumulado,
  porque o leitor de verdade é a tarefa 3. Usa `ANTHROPIC_API_KEY` e `KOTA_BANK_DIR`.
- [ ] **Passo 2:** rodar com 20 perguntas e 3 repetições, e colar a tabela na #25.
- [ ] **Passo 3: decidir e registrar.** Fica com A ou B pelo p50 do 1º segmento e pela taxa de literal aceito. Entre
  busca e Notion inteiro, fica com o de melhor acerto (literal aceito com a fonte esperada); empate vai para a menor
  latência. A escolha entra na decisão do plano 2 e no "Decisão de síntese" do `desenho.md`. O resultado é registrado
  na #25 e **não trava** o plano (decidido com Joaquim em 2026-11-08): se ficar abaixo da meta, abra uma issue para
  otimizar e siga.
- [ ] **Passo 4:** commit `test(server): bench do plano do modelo com o kit da kota`.

### Tarefa 2: Esquema que sai do catálogo (`src/puca/esquema.ts` + `catalogo.ts`)

**Arquivos:**
- Criar: `src/puca/esquema.ts`
- Modificar: `src/puca/catalogo.ts` (cada entrada de `ACOES` e de `TIPOS` ganha `entrada: Esquema<…>`)
- Teste: `src/puca/__tests__/esquema.test.ts`, `src/puca/__tests__/catalogo.test.ts`

**Interfaces:**
- Produz:
  ```ts
  export interface Esquema<T> { readonly json: Record<string, unknown>; ler(v: unknown, caminho: string): { ok: true; valor: T } | { ok: false; erro: string } }
  export const e: { texto(o: { min?: number; max: number }): Esquema<string>; enumerado<V extends readonly [string, ...string[]]>(v: V): Esquema<V[number]>;
    lista<T>(item: Esquema<T>, o: { max: number }): Esquema<T[]>; objeto<P extends Record<string, Esquema<unknown>>>(p: P): Esquema<{ [K in keyof P]: TipoDe<P[K]> }>;
    uniao<D extends string, M extends Record<string, Esquema<object>>>(d: D, m: M): Esquema<…>; handle(...prefixos: string[]): Esquema<Handle> };
  export const ESQUEMA_DO_PLANO: Esquema<Plano>;            // derivado de TIPOS e ACOES
  export function textoDoCatalogo(): string;               // a parte do prompt que explica tipos e ações, das descrições
  ```

- [ ] **Passo 1: testes que falham.**
  - **Ordem e obrigatórios:** `ESQUEMA_DO_PLANO.json` tem `required` com todos os campos, e a ordem das propriedades do
    segmento é `cita`, `fala`, `acoes`.
  - **Leitura:** `ler` recusa `faz: "apagar"` com o caminho do erro (`segmentos[0].acoes[0].faz`).
  - **Prompt:** `textoDoCatalogo()` contém a `descricao` de cada entrada de `ACOES`. O teste percorre
    `Object.keys(ACOES)`: nenhuma lista à mão.
  - **Entrada nova:** uma entrada de teste acrescentada ao catálogo aparece no esquema e no texto sem mexer em outro
    arquivo.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar o construtor mínimo (sem dependência nova) e derivar.
- [ ] **Passo 4:** rodar e ver passar.
- [ ] **Passo 5:** commit `feat(puca): esquema do plano derivado do catálogo`.

### Tarefa 3: Leitor do plano em stream (`src/puca/leitor.ts`)

**Interfaces:**
- Produz:
  ```ts
  export type EventoDoLeitor = { tipo: "cabeca"; plano: Pick<Plano, "tipo" | "alvos" | "caso"> } | { tipo: "segmento"; n: number; segmento: SegmentoPedido };
  export function criarLeitorDePlano(): { empurrar(pedaco: string): EventoDoLeitor[]; fim(): { completo: boolean } };
  ```
  `cabeca` sai assim que `tipo`, `alvos` e `caso` fecharam. Cada `segmento` sai quando o `}` dele fecha, já lido pelo
  `ESQUEMA_DO_PLANO`.

- [ ] **Passo 1: testes que falham.**
  - **Corte arbitrário:** um plano real gravado da tarefa 1 (arquivo `__tests__/plano-gravado.json`), cortado em todas
    as posições possíveis em dois pedaços, dá sempre os mesmos eventos.
  - **Strings difíceis:** aspas escapadas, `{` e `}` dentro de string e acentos não quebram nada.
  - **Stream cortado:** sem o `}` final, `fim()` dá `completo: false` e o segmento aberto não sai.
  - **Segmento fora do esquema:** é descartado, e o leitor segue no próximo.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar o leitor incremental (pilha de profundidade com estado de string e escape; ao fechar um
  objeto no caminho `segmentos[n]`, parse do recorte).
- [ ] **Passo 4:** rodar e ver passar.
- [ ] **Passo 5:** commit `feat(puca): leitor do plano do modelo em stream`.

### Tarefa 4: Conferência do segmento (`src/puca/conferir.ts` + `montar`)

**Interfaces:**
- Consome: `conferirLiteral`, `reconhecer`, `Trecho` (plano 1).
- Produz:
  ```ts
  export type Conferido = { ok: true; segmentos: SegmentoPronto[] } | { ok: false; motivo: "sem_citacao" | "literal" | "entidade_fora_do_literal" | "papel" | "geral_com_kota" | "geral_com_material" | "handle" };
  export function conferirSegmento(s: SegmentoPedido, c: ContextoDeMontagem & { materialForte: boolean; glossario: string[] }): Conferido;
  ```
  `montar` (plano 1) passa a aceitar segmentos com `fala`, chamando `conferirSegmento`, e passa a cobrir `pular` (alvo
  `m:` precisa estar em `c.momentos`).

- [ ] **Passo 1: testes que falham**, com `trechosDoMapa` reais e um ADR escrito no teste:
  - **Literal:** a citação existe → `ok`. A citação inventada → `literal`.
  - **Entidade fora do literal:** "o balancereader grava no ledger-db", citando um literal que só fala do
    balancereader → `entidade_fora_do_literal`.
  - **Papel:** "a Beatriz é tech lead", citando a linha do time → `papel`.
  - **Aviso de situação:** a frase cita o ADR 6 (rejeitado) e não diz "rejeit" → `ok`, com um segmento de `origem:
    "aviso"` antes.
  - **`geral`:**
    - "um cache guarda dados em memória" sem material forte → `ok`, com o prefixo "Isso é conhecimento geral, não é da
      Kota:";
    - a mesma frase com material forte → `geral_com_material`;
    - "por quanto tempo o saldo fica em cache" → `geral_com_kota` (termo do glossário).
  - **Pulo:** `pular` para um `m:` fora dos alvos → desfecho nulo e `bloqueado`.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar as regras na ordem do desenho. O glossário do banco sai de
  `kit/kota/notion/paginas/glossario.md` (termos em negrito) mais os ids e as pastas dos sistemas. Material forte = algum
  achado com nota acima do limiar calibrado na tarefa 1.
- [ ] **Passo 4:** rodar e ver passar.
- [ ] **Passo 5:** commit `feat(puca): conferir cada frase do modelo antes de falar`.

### Tarefa 5: Plano do modelo pelo Haiku (`server/src/llm/anthropic.ts`)

**Interfaces:**
- Produz:
  ```ts
  export type EventoDoModelo = { tipo: "texto"; texto: string } | { tipo: "uso"; entrada: number; saida: number; cache: number } | { tipo: "fim"; motivo: string | null };
  export function streamPlano(r: { sistemaFixo: string; sistemaVariavel: string; mensagens: { quem: "pessoa" | "puca"; texto: string }[];
    esquema: Record<string, unknown>; sinal: AbortSignal }, client?: AnthropicLike): AsyncGenerator<EventoDoModelo>;
  export function aquecer(sistemaFixo: string, esquema: Record<string, unknown>, client?: AnthropicLike): Promise<void>;
  ```
  Usa o mecanismo escolhido na tarefa 1. Em A, os deltas de texto da saída estruturada. Em B, os `input_json_delta` da
  ferramenta forçada, repassados como `texto`, sem esperar o `content_block_stop`. O `streamAnthropic` de hoje fica
  para quem ainda usa.

- [ ] **Passo 1: testes que falham**, com stream falso no estilo de `anthropic.test.ts`:
  - **Deltas:** saem na ordem em que chegam.
  - **Cache:** `cache_control` vai no fim do bloco fixo, e o variável vem depois.
  - **Mensagens:** as do começo com `quem: "puca"` são descartadas (começa por `user`).
  - **Erros:** um erro do SDK vira `LlmError` com o código.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar e ver passar.
- [ ] **Passo 5:** commit `feat(server): plano do modelo em stream pelo haiku 5.5`.

### Tarefa 6: Material do turno (`server/src/turno/material.ts`)

**Interfaces:**
- Consome: `CompanyBrain` (plano 2), `PedidoDeTurno` (tarefa 8).
- Produz:
  ```ts
  export interface Material { trechos: Map<Handle, Trecho>; momentos: { handle: Handle; id: string; titulo: string; objetivo: string }[];
    nos: { handle: Handle; id: string; revelado: boolean; entidade: EntidadeId | null }[]; forte: boolean; textoVariavel: string }
  export async function montarMaterial(p: PedidoDeTurno, d: { brain: CompanyBrain; mapa: MapaKota }): Promise<Material>;
  export function textoFixo(mapa: MapaKota): string;   // instruções + textoDoCatalogo() + resumo do mapa (vai para o cache)
  ```

- [ ] **Passo 1: testes que falham.**
  - **Handles:** só para o que veio da busca, do mapa citado, de `onde.alvosDePulo` e de `onde.quadro`.
  - **Trechos marcados:** no `textoVariavel`, cada trecho vem como `[f:1] (fonte · situação) «texto»`, marcado como dado.
  - **Prompt fixo estável:** `textoFixo(mapa)` é igual entre duas chamadas.
  - **Tempo:** a busca entra em menos de 20 ms com o brain do mapa.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar e ver passar.
- [ ] **Passo 5:** commit `feat(server): material do turno com trechos, momentos e quadro`.

### Tarefa 7: O turno (`server/src/turno/turno.ts`)

**Interfaces:**
- Consome: tarefas 3 a 6; `pickBridge` (`server/src/agent/bridges.ts`, que muda para `server/src/turno/pontes.ts`);
  `tts.start`.
- Produz:
  ```ts
  export async function responderTurno(p: PedidoDeTurno, d: { brain: CompanyBrain; mapa: MapaKota; tts: Tts | null; llm: typeof streamPlano; agora?: () => number },
    emitir: (ev: EventoDoTurno) => void, sinal: AbortSignal): Promise<RegistroDoTurno>;   // RegistroDoTurno: tempos e motivo, sem texto da pessoa
  ```

- [ ] **Passo 1: testes que falham**, com `llm` falso tocando fragmentos gravados:
  1. **Caminho feliz:** `segmento` 0 (ponte), 1 e 2, nessa ordem, depois `fim` com `respondido`. O TTS começa só para
     os segmentos conferidos.
  2. **Literal reprovado no 2º segmento:** sai o 1º, depois um aviso "não confirmei", depois `desfecho: encaminhar`
     com destino do mapa, depois `fim` com `sem_fonte`.
  3. **Prazo de 8 s estourado sem nada conferido:** frase de falha, **sem** `desfecho`, `fim` com `falha`/`timeout`.
  4. **Nada conferido aos 3 s:** sai a segunda ponte (relógio falso).
  5. **`sinal` abortado:** nenhum evento depois.
  6. **`responder` sem nenhum segmento:** `sem_fonte`, com encaminhamento.
  7. **Trava diária estourada:** `falha`/`limite_diario`, sem LLM.
- [ ] **Passo 2:** rodar e ver falhar.
- [ ] **Passo 3:** implementar. Um `Prazo` para o turno inteiro; um `AbortController` filho para o LLM. O desfecho só
  depois do último segmento.
- [ ] **Passo 4:** rodar e ver passar.
- [ ] **Passo 5:** commit `feat(server): turno com ponte, plano conferido e fim que separa não sei de deu erro`.

### Tarefa 8: Contrato e rota v2; o v1 sai (`src/puca/turno.ts`, `server/src/app.ts`)

**Arquivos:**
- Criar: `src/puca/turno.ts`, com os tipos compartilhados `PedidoDeTurno`, `Onde`, `EventoDoTurno` e `Resultado`, e
  `VERSAO_DO_TURNO`, um hash de `ESQUEMA_DO_PLANO.json`. `SegmentoPronto` e `Desfecho` continuam vindo do catálogo
  (plano 1). O segmento do evento é `SegmentoPronto & { id: string; audio_url: string | null }`.
- Modificar:
  - `docs/contratos.md`: linha "API do servidor" e uma seção com um pedido e uma sequência de eventos de exemplo, pela
    skill `contrato`;
  - `server/src/app.ts`: `POST /api/ask` lê o v2 com `lerPedido`. Responde 400 com o caminho do erro e 409 se
    `v ≠ VERSAO_DO_TURNO`.
- Apagar: `server/src/agent/ask.ts`, `prompt.ts`, `ask*.test.ts`, depois de migrar quem chama (tarefa 9).
- Teste: `server/src/app.test.ts` (400, 409, stream de eventos com brain do mapa e `llm` falso).

**Interfaces:**
- Produz (resumo; o desenho tem o resto):
  ```ts
  export interface PedidoDeTurno { v: string; turno: string; fala: string; de: "voz" | "chat"; perfil: { pessoa: string; nome: string; vinculo: Vinculo; destino: TimeId };
    historico: { quem: "pessoa" | "puca"; texto: string }[]; onde: Onde }
  export type Onde = { tipo: "sessao"; momento: string; passo: string; alvosDePulo: { id: string; titulo: string; objetivo: string }[];
      quadro: { nos: { id: string; revelado: boolean; entidade: EntidadeId | null }[] } | null }
    | { tipo: "computador"; contexto: ContextoDoComputador | null };   // ContextoDoComputador: plano 5
  export type EventoDoTurno = { tipo: "segmento"; turno: string; n: number; segmento: SegmentoPronto & { id: string; audio_url: string | null } }
    | { tipo: "desfecho"; turno: string; desfecho: Desfecho } | { tipo: "fim"; turno: string; resultado: Resultado; tempo: TempoDoTurno };
  export interface TempoDoTurno { ponte_ms: number | null; primeiro_segmento_ms: number | null; total_ms: number;
    tokens_in: number | null; tokens_out: number | null; tokens_cache: number | null; bloqueados: number }
  export type Resultado = { tipo: "respondido" } | { tipo: "sem_fonte" } | { tipo: "cancelado" }
    | { tipo: "falha"; motivo: "timeout" | "erro_llm" | "recusa" | "fora_do_esquema" | "limite_diario" };
  ```

- [ ] **Passo 1:** escrever os testes do `app.test.ts`. Rodar e ver falhar.
- [ ] **Passo 2:** implementar a rota v2.
- [ ] **Passo 3:** rodar e ver passar.
- [ ] **Passo 4:** commit `feat(server): api do turno v2 com versão de protocolo`.

### Tarefa 9: O app fala com o v2 (`src/puca/cliente.ts`, executor, sessão)

**Arquivos:**
- Criar: `src/puca/cliente.ts`, que lê o SSE do v2 e entrega `EventoDoTurno` tipado.
- Modificar:
  - `src/puca/executor.ts`: `atender(p: PedidoDeTurno): Promise<Resultado>`, que toca os segmentos conforme chegam.
  - `src/screens/lesson/main.ts`:
    - `ondeNaSessao()`: alvos de pulo = momentos da jornada fora o atual; quadro = nós com `revelado` e `entidade`
      pelo `reconhecer` do rótulo;
    - `historicoParaModelo()`: começa pela pessoa e inclui as falas do roteiro (B13);
    - o ramo `ask` vira `executor.atender`;
    - o rastro grava `fontes` e `motivo_falha`.
  - `src/voice/agent-voice.ts`: sai o cliente do `/api/ask` v1.
  - `src/journey/route.ts`: o `knowledge` só do momento atual (B16).
- Teste:
  - `src/puca/__tests__/cliente.test.ts`: SSE cortado em pedaços arbitrários; evento desconhecido ignorado.
  - `src/puca/__tests__/executor.test.ts`: `atender` com um `fetch` falso; cancelar no meio não aplica o desfecho.
  - `src/journey/__tests__/route.test.ts`: uma frase do `knowledge` de outro momento agora vai para `ask`.

- [ ] **Passo 1:** escrever os testes. Rodar e ver falhar.
- [ ] **Passo 2:** implementar. Atualizar a linha "Rota da fala" do contrato.
- [ ] **Passo 3:** `npm run check` verde.
- [ ] **Passo 4:** commit `feat(lesson): perguntas fora do roteiro respondidas com fonte conferida`.

### Tarefa 10: Portão 2 e fechamento

- [ ] **Passo 1:** `npm run bench:turn` (cenários trocados para as perguntas da Kota) e colar na #27.
  - **Primeira frase conferida:** p50 ≤ 1,6 s.
  - **Literal aceito:** ≥ 90%.
- [ ] **Passo 2: demo ao vivo** com servidor e a jornada da Kota (#120):
  1. "por que o saldo tem cache?" → ADR 4 citado; o rastro tem a URL com linhas.
  2. "a gente usa fila entre o ledgerwriter e os leitores?" → "foi proposta e rejeitada".
  3. "qual vai ser meu bônus?" → regra geral da página Bônus e encaminhamento para a Simone.
  4. Servidor parado → frase de falha, sem encaminhamento.
  5. "o que é um JWT?" → resposta geral dita como geral.
- [ ] **Passo 3:** PR pela skill `handoff`, com `Closes #27` e `Closes #25`, e a lista de contratos mudados (API do
  servidor v2, Rota da fala, Rastro) marcada como quebra de compatibilidade do `/api/ask`.
