# Camada de resposta de Puca: desenho

> Rascunho de 2026-11-08 para as issues #25, #26 e #27 e para o modo sempre na tela. É a especificação que os planos
> desta pasta implementam. Toca o `PRODUCT.md` §4.1, §4.3, §4.5, §5, §11, §12.2 e §13. O modo sempre na tela é
> capacidade nova: entra no `PRODUCT.md` pela skill `contexto-base` antes da fase 5.

## Problema

Puca precisa transformar uma fala que a cascata local não resolveu, ou um chamado feito enquanto a pessoa usa outro
app, numa resposta **escolhida pelo modelo**: falar, desenhar no quadro, mostrar a fonte no navegador de Puca, pular
para um momento, abrir uma sessão sob demanda ou encaminhar. Toda afirmação sobre a Kota e toda ação têm de sair do kit
da Kota, e nada pode ser inventado: nem fato, nem URL, nem nó, nem responsável.

O que deixa a forma difícil de escolher, no código de hoje:

- **Ferramentas no fim.** O cliente do Haiku 5.5 (`server/src/llm/anthropic.ts`) junta o JSON de cada ferramenta e só o
  entrega no fim do bloco. Até lá as frases já foram para o TTS, então não dá para conferir nada antes de a pessoa
  ouvir.
- **Quadro fixo.** O quadro só revela, destaca e abre cartão de nós que a jornada declarou (`whiteboard.ts:89-101`).
- **Jornada própria do servidor.** O servidor tem uma cópia da jornada e recusa ids que não estão nela
  (`app.ts:139-141`). Uma sessão gerada na hora não passaria.
- **Respostas sem fonte.** As respostas do agente não carregam fonte (`trail.ts:159`), e o encaminhamento vai sempre
  para a buddy (`forwarding.ts:17`).
- **Tela fora do MVP.** As decisões 0004 e 0008 deixam a tela, os apps nativos e qualquer permissão além do microfone
  fora do MVP.

Restrições que valem para tudo:

- **Cascata e ponte.** A `route.ts` vai do mais barato ao mais caro e o LLM é o último, com a ponte na hora.
- **Servidor sem estado.** O que precisa durar vai para o Supabase.
- **Guarda em código**, não no prompt.
- **Haiku 5.5 com 8 s.**
- **No máximo 3 ações do navegador** por resposta.
- **`npm run dev` sem Electron e sem servidor** continua funcionando.
- **Contrato antes do código.**
- **Nada mockado:** dados reais do kit desde o primeiro dia; exemplos fixos só dentro de testes.

## Uso (o que cada lado chama)

**A tela da sessão.** Uma porta para a fala, em qualquer tela, e um executor que é dono da fila de voz, quadro e
navegador:

```ts
const executor = criarExecutor(palcoDaSessao());              // voz, quadro, navegador (ou cartão), encaminhar
voice.listen({ onBargeIn: () => { executor.cancelar(); tomarAVez(); }, onFinal: (t) => handleUtterance(t, "voz") });

// em atenderFala, depois de routeUtterance:
if (r.kind === "intencao") return executor.executar(montar(r.plano, contextoLocal()));      // sem rede, sem LLM
if (r.kind === "ask") return executor.atender(pedidoDeTurno(text, from, ondeNaSessao()));   // servidor + LLM
```

**O modo sempre na tela.** É a mesma página e o mesmo executor. A janela vira uma pílula sempre por cima. Só muda o
`onde`:

```ts
window.orbis?.janela.aoChamar(async (chamado) => {
  const fala = await ouvirUmaFala();
  await executor.atender(pedidoDeTurno(fala, "voz", { tipo: "computador", contexto: chamado.contexto }));
});   // se o plano usa quadro, navegador ou sessão, o executor expande a janela; "Voltar" devolve o foco
```

**O servidor.** Valida na borda e entrega o turno a um módulo só:

```ts
const lido = lerPedido(req.body, req.pessoa);                      // 400 com o caminho do erro; 409 se a versão diverge
await responderTurno(lido.pedido, { brain, mapa, tts, llm }, (ev) => enviar(reply, ev), ac.signal);
```

**O company brain**, só no servidor:

```ts
await brain.buscar({ texto, quem, contexto: { destino: "livro-razao", entidades: ["sistema:balancereader"] }, limite: 8 });
brain.conferir("kota-bank:docs/adr/0004-…md#contexto", "o saldo é lido do livro-razão");   // → citação com URL, ou null
brain.ondeEsta("https://github.com/JucaGF/kota-bank/blob/main/src/ledger/balancereader/…");  // → fonte, linhas, entidades
```

## Forma

**O princípio:** o servidor decide **o quê**, com fonte conferida; o app decide **onde e quando**, pelo palco que tem. O
LLM escolhe só entre ids que a busca e o mapa entregaram. Quem transforma id em coisa concreta (URL com linhas, nó,
alvo do marca-texto, destinatário) é o código.

### Dados

```ts
type EntidadeId = `sistema:${string}` | `time:${TimeId}` | `pessoa:${string}` | `adr:${number}` | `rfc:${number}`;

interface Fonte {
  id: FonteId;                 // estável: "kota-bank:docs/adr/0004-….md", "notion:deploy", "mapa:sistemas/balancereader"
  tipo: "adr" | "runbook" | "readme" | "codigo" | "notion" | "mapa";   // em ordem de confiança
  titulo: string;
  situacao: "vigente" | "legado" | "rejeitado";                          // vem do mapa (ADR rejeitado, sistema legado)
  acesso: "kota";              // hoje todas; é aqui que a permissão por pessoa entra depois
  versao: string;              // commit do kota-bank ou hash da página: "fonte mudou" é versão diferente
  url: string;                 // base: arquivo no commit fixo ou página pública; urlDoTrecho põe as linhas
}
interface Trecho {
  id: TrechoId;                // `${FonteId}#${âncora}`: âncora é título ou símbolo, nunca linha nem ordinal
  fonte: Fonte;
  texto: string;               // o que a pessoa vê ao abrir: cru no GitHub (?plain=1), texto visível no Notion
  linhas: [number, number] | null;
  entidades: EntidadeId[];
}
```

- **Mapa como fonte.** As linhas do mapa também são trechos: o texto é o de `linhasDatabase(mapa, …)`, o mesmo da
  database do Notion. "Quem cuida" e "de que time é" se conferem como qualquer ADR.
- **Invariante da ingestão.** O texto normalizado (espaço e caixa) de todo trecho é substring da fonte normalizada. Isso
  é conferido na ingestão e num teste.

### Tipos de resposta e ações: uma lista só (`src/puca/catalogo.ts`)

Os tipos de resposta são `responder`, `geral`, `pular`, `sessao` e `encaminhar`. As ações são `destacar`, `desenhar`,
`abrir_cartao`, `mostrar` e `dizer_dono`. Cada entrada do catálogo tem três coisas:

1. **um esquema da entrada**, de onde saem o JSON Schema que vai ao modelo, o tipo TS e o validador;
2. **uma descrição**, de onde sai o texto do prompt;
3. **uma `expansão`**, que é o único lugar onde id vira ação concreta.

Ação nova é uma entrada nova, sem outra lista para acertar à mão. O catálogo é **puro e fica em `src/`**: o servidor o
usa com o plano do modelo, e o app o usa com o plano local da cascata. Assim não existe um segundo caminho.

As regras de cada expansão:

- **`destacar`** revela o nó antes de destacar (corrige B7).
- **`desenhar`** acrescenta ao quadro os sistemas do mapa que faltam. As posições saem de um layout determinístico em
  camadas, pelo `dependeDe`.
- **`mostrar`** só aceita uma fonte citada e conferida **na mesma frase**. Vira `abrir` com a URL e depois `marcar` com
  o próprio trecho conferido.
- **`dizer_dono`** é a **única** forma de afirmar papel de pessoa ou responsável por sistema. O código escreve a frase a
  partir do mapa. O modelo pede a ação, mas não escreve "a Beatriz é tech lead".
- **`encaminhar`** escolhe o destino pelo mapa:

  | Do que é a dúvida | Para quem vai |
  |---|---|
  | um sistema | buddy do time do sistema |
  | um ADR | buddy do time do ADR |
  | caso pessoal | People |
  | segurança | a pessoa de segurança |
  | sem entidade | buddy da própria pessoa |

  O resumo é a fala da pessoa mais os títulos das fontes consultadas, sem texto do modelo.

### O plano do modelo, em pedaços conferidos

Uma chamada ao Haiku 5.5 devolve o plano inteiro:

```
{ tipo, alvos, caso, segmentos: [{ cita, fala, quadro, navegador }] }
```

- **Caminho principal: saída estruturada em stream** (`output_config.format`), com todos os campos obrigatórios e `cita`
  antes de `fala`. A ordem do esquema é a ordem da escrita, e a forma é garantida.
- **Plano B:** ferramenta forçada com `eager_input_streaming`. A escolha sai de uma medição, na tarefa 1 do plano 3.
- **Esquema fixo**, sem `enum` por turno, para não quebrar o cache. Os ids são conferidos em código.
- **`LeitorDePlano`** (puro) solta cada segmento quando o JSON dele fecha. Se o stream for cortado, a frase aberta nunca
  existiu.

Cada segmento passa por `conferirSegmento` antes do TTS. As regras:

1. **Citação conferida.** Cada `cita` existe ao pé da letra no trecho (com ≥ 12 caracteres).
2. **Entidades no literal.** Toda entidade da Kota nomeada na `fala` aparece **no literal citado**, não só no trecho
   inteiro.
3. **Papel só pelo código.** Frase com pessoa e palavra de papel (tech lead, gestor, buddy, responsável, dono) é
   bloqueada: isso é `dizer_dono`.
4. **Aviso de situação.** Se a frase cita fonte `rejeitado` ou `legado` e não diz isso, entra antes uma frase de aviso
   escrita pelo código.
5. **`geral` restrito.** Só vale quando o material do turno não tem trecho acima da nota mínima, e a frase não nomeia
   entidade nem termo do glossário do banco. O código põe antes "Isso é conhecimento geral, não é da Kota:".

O primeiro bloqueio encerra a fala do modelo. O turno termina com "não confirmei" e encaminhamento.

### O turno (`server/src/turno/`) e o que ele emite

- **Material do turno**, sem rede, em ≤ 20 ms: busca, linhas do mapa, entidades em foco e os alvos de pulo e nós do
  quadro **que o app manda em `onde`**. O servidor deixa de carregar a jornada (corrige a armadilha 1). Cada item ganha
  um id curto (`f:3`, `s:ledgerwriter`, `m:deploy`, `n:balancereader`).
- **Pontes.** Ponte na hora; segunda ponte aos 3 s se nada foi conferido ainda; prazo de 8 s.
- **Eventos.** `segmento` (o 0 é a ponte), depois no máximo um `desfecho` (`pular`, `abrir_sessao` ou `encaminhar`),
  depois `fim`. **Só sai o que já foi conferido.**
- **"Não sei" e "deu erro" são resultados diferentes.** `sem_fonte` encaminha. `falha` (timeout, erro, recusa, saída
  fora do esquema, trava diária) só diz a frase de falha, com o motivo no rastro (decisão 0007).
- **Versão de protocolo.** O pedido leva `v`. Se o servidor tem outra versão, responde 409, e o app cai para a cascata
  local e diz que a resposta completa está indisponível.

### O executor (app, `src/puca/executor.ts`)

- **Uma fila.** Para voz (roteiro e segmentos), quadro e navegador. As ações do quadro saem quando o áudio da frase
  começa. As do navegador saem em sequência, no máximo 3 por turno. O desfecho sai depois da última frase.
- **Encaminhamento.** É gravado na hora, com id `enc-<turno>`: repetir não duplica.
- **Barge-in.** `cancelar()` para tudo de uma vez.
- **Palco.** A tela declara o que tem (quadro, navegador ou cartão, janela compacta). Se o plano usa o que o palco não
  tem, o executor expande a janela antes. Ir para a sessão própria é uma regra de capacidade, não um palpite do modelo.
- **Desenho fora do quadro.** `acrescentar { nos, setas }` remonta o quadro preservando o que estava revelado
  (`whiteboard` ganha `revelados()`).

### Sessão sob demanda

`montarSessaoSobDemanda(assunto, material, mapa, perfil)` é **pura, sem LLM**. Ela gera uma `Journey` válida com
momentos de molde: o que é, com quem conversa, por que é assim (ADRs com situação), quem cuida e a volta. Cada fala vem
com fonte, e o quadro sai do layout em camadas.

A tela roda essa jornada no mesmo runner, como desvio: guarda `{momento, passo, quadro}` e, no fim, volta ao passo com
"Voltando ao que eu falava.", o mesmo mecanismo da vez.

### Cascata local com fonte

Um degrau novo, `intencao`, entra antes do `knowledge`. Ele responde pelo mapa, sem rede, a "quem cuida do X", "como o X
se liga" e "mostra o ADR N". O plano dele passa pelo **mesmo catálogo**. A rota `knowledge` deixa de varrer os outros
momentos (B16).

### Modo sempre na tela

- **Janela.** A mesma janela encolhe para uma pílula sempre por cima e expande para a sessão. O estado tem um dono só.
- **Chamado.** Atalho global (⌥Espaço) ou clique, e o microfone abre só no chamado.
- **Leitura só no chamado, nunca em sondagem.** Para o clique na pílula não esconder o app de antes, o processo
  principal guarda só o **nome** do último app em foco, por notificação de ativação. Os níveis de leitura:

  | Nível | Permissão | O que Puca lê |
  |---|---|---|
  | 0 | nenhuma nova | o app em foco; o que está aberto no navegador de Puca (sempre, por CDP) |
  | 1 | Acessibilidade | título da janela, texto selecionado, URL do navegador em foco |
  | 2 | Gravação de tela | print só da janela em foco, com licença pedida **naquele chamado** |

  Sem permissão, Puca segue no nível 0.
- **Entidades.** `brain.ondeEsta(url)` e o léxico do mapa ligam a tela às entidades (pasta do `kota-bank` → sistema,
  `docs/adr/…` → ADR, URL do Notion → página).
- **Privacidade, cobrada em código:**
  - o `ContextoDoComputador` vive só no pedido;
  - o `toJSON()` dele devolve um marcador, então nada vaza por serialização acidental;
  - não existe campo no rastro, no log, no Supabase ou no encaminhamento que o receba;
  - apps de senha, de mensagens e de banco ficam de fora;
  - segredos são removidos;
  - a pílula mostra o que foi lido, com um ✕ para descartar;
  - Puca não avalia a pessoa.
- **Decisão nova** (próxima livre em `docs/decisoes/`). Revê a 0004 (só microfone) e a 0008 (ver a tela fora): **ver
  sim, agir não**. O computer use continua só no navegador de Puca. Registra também o ajudante nativo em Swift.

## Decisão de síntese

Três desenhos concorreram (plano no servidor; sessão no app como agente; classificar e depois compor), com um juiz
independente pela rubrica. **Base: plano tipado no servidor.** É onde a guarda pode morar sem ser contornada, e onde o
envio pelo Slack e a permissão por pessoa vão morar. Tem uma lista só (catálogo) e a menor fronteira (`atender` e
`cancelar`; `responderTurno`; quatro métodos no brain).

Enxertos:

- **Do "sessão no app":**
  - saída estruturada como caminho principal;
  - servidor sem cópia da jornada (o app manda `onde`);
  - licença por chamado para o print;
  - `toJSON` com marcador;
  - remontar o quadro preservando o revelado.
- **Do "classificar e compor":**
  - degrau `intencao` local que responde pelo mapa sem LLM, passando pelo mesmo catálogo. Vira a fase 1, demonstrável
    sem servidor;
  - resumo do encaminhamento sem LLM;
  - ir para a sessão por capacidade do palco;
  - frase de situação escrita pelo código.
- **Correções do juiz:**
  - `buscar` assíncrono e recebendo texto;
  - cobertura de entidades contra o literal citado;
  - campos todos obrigatórios;
  - papel de pessoa só por `dizer_dono`;
  - versão de protocolo;
  - texto visível ou `?plain=1` para o literal bater com a página aberta.

Rejeitados:

- **Duas chamadas em série:** +0,8 s e a fala do modelo sem citação literal.
- **Planejar tudo no cliente:** a guarda poderia ser contornada, e não sustenta permissão por pessoa.
- **`enum` por turno:** quebra o cache.

## Tradeoffs aceitos

- **Latência.** Aceitamos ~+0,3 a 0,5 s até a primeira frase (o modelo copia o trecho antes de afirmar) em troca de
  toda frase ouvida estar conferida. A ponte cobre. Meta: p50 ≤ 1,6 s para a primeira frase conferida, a medir.
- **Conferência lexical, não semântica.** Uma frase pode citar um trecho verdadeiro e concluir errado. Ela é
  determinística, barata e auditável pelo jurado.
- **Respostas de dono e papel são de molde.** Ficam um pouco duras, mas nunca erram nome.
- **Sessão sob demanda de molde, sem LLM.** É instantânea, recriável e já sai com fonte. O LLM entra nela pelas
  perguntas, como em qualquer sessão.
- **Mapa inteiro no cache do prompt.** Serve para a Kota. Numa empresa grande, o material traz só as linhas citadas e
  vizinhas, sem mudar quem chama.

## Perguntas e riscos

- **Risco principal.** O Haiku 5.5 em saída estruturada escreve a primeira frase conferida em ~1,3 s, com a maioria
  dos literais passando? Medir antes de construir (plano 3, tarefa 1).
- **Falsos positivos do reconhecedor.** "Contas", "Canais" e "Plataforma" são times e palavras comuns. A regra é exigir
  "time X" ou maiúscula no meio da frase, e medir.
- **Confirmação do encaminhamento (decidido em 2026-11-08):** antes de sair, Puca pergunta ("Levo para a
  Beatriz?") e só grava com o sim da pessoa.
- **Assinatura no macOS.** Com assinatura ad hoc, cada versão muda o cdhash e o macOS esquece as permissões. É preciso
  certificado estável no CI (fase 5).
- **Voltar ao passo depois de um desvio fere a R13** (pulo só no início do momento)? O desenho trata a volta como a vez,
  não como pulo.
