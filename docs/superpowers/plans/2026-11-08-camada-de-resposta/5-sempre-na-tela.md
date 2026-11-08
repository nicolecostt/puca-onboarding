# Plano 5 — Sempre na tela: plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans`. Este plano está no nível de tarefa. Antes de executar, detalhe os passos de cada
> tarefa com o app Electron (#47) que estiver na `main`.

**Objetivo:** o Orbis fica na tela como uma pílula enquanto a pessoa trabalha. Ao ser chamada (⌥Espaço ou clique), a
Puca entende onde a pessoa está e responde ali mesmo. Se a resposta pede quadro, navegador ou sessão, a janela expande
para a sessão própria e, no fim, devolve a pessoa ao que ela fazia.

**Arquitetura:**
- **Uma janela, dois tamanhos.** A mesma janela e a mesma página encolhem para a pílula e expandem para a sessão. Um
  dono só do estado.
- **Leitura no chamado.** O processo principal lê o contexto **no chamado** (níveis 0, 1 e 2) e entrega um
  `ContextoDoComputador` que vive só no pedido do turno.
- **Mesmo caminho.** O turno é o mesmo do plano 3, com `onde: { tipo: "computador" }`. Ir para a sessão é uma regra de
  capacidade do palco.

**Especificação:** [`desenho.md`](desenho.md) (seção "Modo sempre na tela").

## Restrições globais

- **Ver sim, agir não:** o computer use continua só no navegador de Puca.
- **Permissões opcionais:** só o microfone é obrigatório. Acessibilidade e Gravação de tela são pedidas na pílula, com
  explicação, nunca na instalação. Sem elas, Puca segue no nível 0.
- **Nada em segundo plano:** nenhuma sondagem nem gravação contínua. O processo principal guarda só o **nome** do
  último app em foco, por notificação de ativação.
- **Privacidade:**
  - nada da tela vai para buddy, gestor, RH, log, rastro ou Supabase;
  - o `toJSON()` do contexto devolve um marcador;
  - apps de senha, de mensagens e de banco ficam de fora;
  - segredos são removidos;
  - a pílula mostra o que foi lido, com um ✕ para descartar.
- **Sem Puca avaliar a pessoa:** nenhum tipo de resposta comenta a atividade dela.

## Foco da revisão

1. **Clicar na pílula tira o foco do app de antes:** o contexto lido tem de ser o do app anterior, não o do Orbis.
2. **Permissão negada no meio da demo:** Puca cai de nível sem erro e diz o que deixou de ver.
3. **Texto com senha ou token selecionado:** é removido antes de sair do processo principal.
4. **A pessoa chama Puca dentro do próprio navegador de Puca:** o contexto vem por CDP (URL e seleção), sem pedir
   permissão nenhuma.
5. **Chamado sem fala** (clicou e ficou em silêncio): a pílula fecha sem chamar o servidor.

---

### Tarefa 1: Base do sistema antes do código

- **Decisão nova** em `docs/decisoes/` (próxima livre), que revê:
  - **0004:19-21 e 0008:40:** ver a tela entra, só no chamado; apps nativos continuam fora **para agir**;
  - **0004:44-45:** microfone obrigatório, mais Acessibilidade e Gravação de tela opcionais;
  - **ajudante nativo em Swift:** compilado no CI do macOS, com assinatura estável.
- `docs/stack.md` §3.3, §4.9 e §11.
- **Skill `contexto-base`:** o modo sempre na tela entra no `PRODUCT.md` §11 (aprender na hora da necessidade) e §5
  (o que Puca nunca guarda).
- **Skill `nova-regra`:** a regra das telas no `CLAUDE.md` passa a cobrir a pílula.
- **Contrato "Computer use":** `window.orbis.janela` (`compactar`, `expandir`, `aoChamar`, `voltar`) e
  `window.orbis.tela.contexto(): Promise<ContextoDoComputador | null>`.

### Tarefa 2: `ContextoDoComputador` e a limpeza (`src/puca/tela.ts`, `desktop/tela/limpar.ts`)

- **Interfaces:**
  ```ts
  export interface ContextoDoComputador { nivel: 0 | 1 | 2; app: { nome: string; pacote: string } | null; janela: string | null;
    url: string | null; selecao: string | null; imagem: { jpeg_base64: string; largura: number; altura: number } | null; toJSON(): "[contexto da tela]" }
  export function limparContexto(c: ContextoBruto, bloqueados: string[]): ContextoDoComputador | null;   // segredos, apps bloqueados, ≤ 2.000 caracteres
  export function entidadesDaTela(c: ContextoDoComputador, brain: { ondeEsta(url: string): …; }, mapa: MapaKota): EntidadeId[];
  ```
- **Testes:**
  - `JSON.stringify({ c })` não contém nada lido;
  - app de senha → `null`;
  - token selecionado → removido;
  - URL do `kota-bank` → `sistema:…`.

### Tarefa 3: Janela compacta e atalho (`desktop/janela.ts`, preload)

- Mesma `BrowserWindow`, com `compactar()` (pílula, sempre por cima, em todos os espaços, sem ativar) e `expandir()`.
- `globalShortcut` ⌥Espaço.
- O último app em foco vem por notificação de ativação, só o nome.
- **Teste:** o preload expõe só `window.orbis.janela` e `.tela`.
- **Verificação:** no Mac, ⌥Espaço sobre o Chrome abre a pílula sem tirar o foco antes da leitura.

### Tarefa 4: Leitura por nível (`desktop/ajudante/`, `desktop/tela/contexto.ts`)

| Nível | Fonte | Lê |
|---|---|---|
| 0 | NSWorkspace; CDP do navegador de Puca | app em foco; URL e seleção do navegador de Puca |
| 1 | Acessibilidade | título da janela, seleção, URL do navegador em foco |
| 2 | Gravação de tela | print da janela em foco, só com licença dada naquele chamado |

- **Testes:** queda de nível com permissão negada (ajudante falso).
- **Verificação:** os três níveis no Mac, um de cada vez.

### Tarefa 5: O turno com `onde: "computador"`

- `server/src/turno/material.ts`: as entidades da tela entram como foco da busca. O texto da tela entra como dado não
  confiável, nunca como fonte citável.
- O log não leva o contexto.
- **Testes:**
  - o material com contexto tem o foco certo;
  - o log de um turno com contexto não contém o texto lido;
  - o resumo do encaminhamento não contém o texto lido.

### Tarefa 6: Ir para a sessão e voltar

- O palco da pílula declara `{ quadro: false, navegador: false }`. Quando o `Montado` precisa do que falta, o executor
  chama `janela.expandir()` antes de tocar. "Voltar ao que eu fazia" compacta e devolve o foco ao app anterior.
- **Teste:** `executor.test.ts` cobre a expansão por capacidade.
- **Verificação (demo):** no GitHub do `kota-bank` em `src/ledger/balancereader`, ⌥Espaço, "o que é isso aqui?":
  1. resposta citada na pílula;
  2. "me mostra" → a janela expande, desenha o balancereader e o ledger-db e abre o ADR 4 marcado;
  3. "voltar" → a pessoa está de novo no GitHub.

### Tarefa 7: Fechamento

- `npm run check`; verificação no Mac de outra pessoa seguindo só o guia de uso; PR pela skill `handoff`.
