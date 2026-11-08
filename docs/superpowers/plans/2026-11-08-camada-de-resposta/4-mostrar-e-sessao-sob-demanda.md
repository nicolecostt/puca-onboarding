# Plano 4 — Mostrar e sessão sob demanda: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans`. Este plano está no nível de tarefa (arquivos, interfaces, testes). Antes de executar,
> detalhe os passos de cada tarefa no formato dos planos 1 a 3, com a forma do navegador do Puca que a #123 tiver
> deixado na `main`.

**Objetivo:**
- o Puca abre a fonte citada no navegador dele e marca o trecho;
- um assunto que a jornada não cobre vira uma sessão gerada na hora, que volta ao passo de antes;
- os nós da jornada da Kota apontam para trechos do kit.

**Arquitetura:**
- **`mostrar`:** já sai do catálogo como `abrir` + `marcar` (plano 1, tarefa 6). Aqui o executor ganha o navegador
  pelo `window.orbis.navegador`; sem ele, o cartão do plano 1 continua.
- **Sessão sob demanda:** `montarSessaoSobDemanda` é pura e gera uma `Journey` que o mesmo runner roda como desvio.

**Especificação:** [`desenho.md`](desenho.md) (seções "Sessão sob demanda" e "Modo sempre na tela", parte do nível 0 no
navegador do Puca).

## Restrições globais

- No máximo 3 ações do navegador por turno. A lista de endereços permitidos do app é a segunda trava; a primeira é a URL
  só sair de `Fonte`.
- O navegador fica **em volta** dos controles, nunca por baixo deles (`CLAUDE.md`, telas).
- A sessão gerada é uma `Journey` válida para o `validate.ts`, com ids prefixados `sob-`, e passa pelo mesmo runner,
  pela mesma cascata e pela mesma checagem.
- A volta do desvio é retomada pela vez ("Voltando ao que eu falava."), não um pulo.

## Foco da revisão

1. **Página que não carrega ou trecho não achado na página aberta:** a ação falha sem quebrar a fila, e o Puca diz
   onde fica o trecho (stack §4.3).
2. **Desvio dentro do desvio:** pedir outra sessão sob demanda no meio de uma substitui a atual. Não empilha mais de um
   nível.
3. **Assunto sem nenhum trecho além do mapa:** a sessão sai só com "o que é" e "quem cuida", sem momento vazio.
4. **Pessoa fala por cima durante o `abrir`:** a fila do navegador para (`cancelar`) e a camada é limpa.

---

### Tarefa 1: `mostrar` no navegador do Puca

- **Arquivos:**
  - `src/puca/executor.ts`: o palco ganha `navegador: { executar(a: AcaoDaPuca[]): Promise<ResultadoDaFila>; cancelar(): void } | null`;
  - `src/screens/lesson/main.ts`: o palco usa `window.orbis?.navegador` e a área do navegador na sessão, pela skill
    `nova-tela` se mudar o layout;
  - contrato "Computer use" (com a #123).
- **Interfaces:** consome `AcaoDaPuca` e `ResultadoDaFila` do contrato da #123. A expansão de `mostrar` (plano 1,
  tarefa 6) passa a preencher `SegmentoPronto.navegador` com `abrir` + `marcar` quando o contexto diz que há navegador,
  e `cartoes` quando não há.
- **Testes:**
  - `executor.test.ts`: as ações do navegador saem depois do início da fala, no máximo 3 por turno; com `navegador:
    null`, vira cartão;
  - ação que falha não para a fila.
- **Verificação:** no app, "mostra o ADR 4" abre `…/0004-…md?plain=1#L…` e marca o trecho.

### Tarefa 2: `montarSessaoSobDemanda` (`src/puca/sob-demanda.ts`)

- **Interfaces:**
  ```ts
  export function montarSessaoSobDemanda(assunto: EntidadeId[], c: { mapa: MapaKota; trechos: Trecho[]; vinculo: Vinculo }): Journey;
  ```
  Os momentos saem de molde:
  - "o que é": quadro do layout em camadas mais a linha do sistema;
  - "com quem conversa": `flow` pelo `dependeDe`;
  - "por que é assim": os ADRs das âncoras, com situação;
  - "quem cuida": `dizer_dono`;
  - "voltar".

  Cada passo tem fala e `fontes` (TrechoId).
- **Testes:**
  - `loadJourney(montarSessaoSobDemanda(["sistema:balancereader"], …))` passa no `validate.ts`;
  - o ADR 4 aparece no momento "por que";
  - para `sistema:contacts`, que não tem ADR próprio, o momento "por que" some;
  - a função é determinística.

### Tarefa 3: Tipo `sessao` no catálogo e o desvio na sessão

- **Arquivos:**
  - `src/puca/catalogo.ts`: o tipo `sessao` vira o desfecho `{ tipo: "abrir_sessao"; jornada: Journey }`;
  - `src/screens/lesson/main.ts`: `desviar(jornada)` guarda `{ runner, momento, passo, quadro, revelados }`, roda um
    segundo runner e, no fim ou em "voltar", restaura e retoma pela vez;
  - degrau `intencao` (plano 1): "me explica o X" → `sessao`.
- **Testes:**
  - `catalogo.test.ts`: o plano `sessao` com alvo fora do material é bloqueado;
  - `runner.test.ts` (ou um teste novo de desvio com io falso): o desvio termina e o runner principal continua do mesmo
    passo.
- **Verificação:** na jornada da Kota, "quero entender o userservice" abre a sessão gerada e, no fim, volta ao passo.

### Tarefa 4: Fontes nos nós da jornada

- **Arquivos:**
  - `src/journey/types.ts`: `NodeInfo.entidade?: EntidadeId`, e `NodeDoc` ganha `trecho?: TrechoId`;
  - `docs/journey-format.md`;
  - `src/components/whiteboard/from-journey.ts`: o cartão mostra o link da fonte;
  - `kit/kota/checar/regras/`: regra nova que confere que todo `trecho` citado pela jornada existe no brain;
  - contrato "Jornada", pela skill `contrato`.
- **Testes:**
  - `validate.test.ts`: entidade inválida é recusada;
  - teste da regra do `check:kota`: trecho inexistente aparece na saída.
- **Depois:** o FAQ de dono passa a usar `dizer_dono` quando o nó tem `entidade`, e some o segundo caminho para a mesma
  resposta.

### Tarefa 5: Fechamento

- `npm run check`; demo das tarefas 1 e 3 gravada e colada na issue; PR pela skill `handoff`.
