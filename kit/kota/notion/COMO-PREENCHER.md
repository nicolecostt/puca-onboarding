# Como preencher o Notion da Kota

O procedimento que todo agente segue para subir a árvore, as databases e as páginas da Kota ao Notion pelo MCP. Pode
rodar quantas vezes quiser: cada passo procura o que já existe antes de criar, e uma segunda rodada não cria nada.

A fonte é o nosso repo, nunca o Notion:

- a árvore (chave, título, pai e tipo de cada nó) e as linhas das databases saem de `arvore.ts`, lido do `mapa.ts`;
- o texto de cada página sai de `paginas/<chave>.md` (tarefa N3);
- a URL pública de cada chave fica em `urls.json`, gravada por este procedimento.

Mudou pessoa, time ou sistema? Mude no `mapa.ts` e rode o procedimento de novo. **Nunca edite uma database à mão no
Notion**: a próxima rodada desfaz, e o `check:kota` não vê a mudança.

## Antes de começar

- **Workspace.** Chame `notion-get-self` e confira que `workspace.name` é `Kota Workspace`. Se for outro, pare: o MCP
  está conectado a outra conta, e nada do kit pode ir para lá.
- **Ferramentas.** São as do MCP do Notion. No Claude Code têm o prefixo `mcp__claude_ai_Notion__` (por exemplo,
  `mcp__claude_ai_Notion__notion-fetch`) e precisam ser carregadas pelo `ToolSearch` antes do primeiro uso.
- **Domínio público.** `lean-ptarmigan-dd2` (gerado pelo Notion; conferido pelo endpoint público getPublicPageData). A URL pública de uma chave é
  `https://<domínio>.notion.site/<id sem hífens>`. Para trocar o domínio, veja a seção "Trocar o domínio" no fim.
- **Plano.** Os comandos abaixo rodam na raiz do repo. Este imprime a árvore, na ordem de criação, e as linhas das
  quatro databases:

```bash
npx tsx -e 'import { mapa } from "./kit/kota/mapa"; import { ARVORE, linhasDatabase } from "./kit/kota/notion/arvore"; const dbs = ["pessoas", "times", "sistemas", "rfcs"] as const; console.log(JSON.stringify({ arvore: ARVORE, linhas: Object.fromEntries(dbs.map((d) => [d, linhasDatabase(mapa, d)])) }, null, 1))'
```

## 1. Árvore

Percorra a `ARVORE` na ordem do array (o pai sempre vem antes dos filhos). Para cada nó:

### 1.1. Achar o nó, se já existe

1. **Pelo `urls.json`.** Se a chave tem URL, o id é o trecho de 32 caracteres no fim. Chame `notion-fetch` com esse
   id. Se a página existe, não está na lixeira e está sob o pai esperado, é ela: siga para 1.2. Para saber o pai, não
   confie no `<ancestor-path>`, que pode vir vazio numa página: o `notion-fetch` do pai tem que listar o id dela
   (item 3).
2. **Pelo título, sob o pai.** Se não achou pelo id:
   - nó com pai de tipo `pagina`: chame `notion-fetch` com o id do pai (do `urls.json`). Os filhos aparecem no
     `<content>` como `<page url="...">Título</page>` e `<database url="..." data-source-url="...">Título</database>`.
     Procure o título exato do nó;
   - nó de tipo `linha` (as RFCs): chame `notion-fetch` com o id da database RFCs para pegar o `data-source-url`
     (`collection://...`) e depois `notion-query-data-sources` com
     `SELECT url FROM "collection://<id>" WHERE "Título" = ?` e o título em `params`;
   - a raiz `kota`: chame `notion-search` com `query: "Kota"` e fique com o resultado de `type: "page"`, título exato
     `Kota` e sem `path` (página no topo).
3. **Muitos nós de uma vez.** O `notion-fetch` do pai mostra a URL de cada filho, com o id no fim. Se o id bate com
   o do `urls.json`, o nó existe sob o pai certo, sem precisar buscar um por um.
4. **Duas ou mais com o mesmo título sob o mesmo pai:** pare e avise quem pediu a tarefa. Não escolha uma nem apague a
   outra.

### 1.2. Achou: atualizar

- Título diferente do da `ARVORE` (renomeado no `arvore.ts`): `notion-update-page` com `command: "update_properties"`
  e `properties: {"title": "<título>"}`. Numa linha de RFC, a propriedade é `Título`.
- Conteúdo: só quando o nó tem `paginas/<chave>.md` (seção 3).

### 1.3. Não achou: criar

| Tipo | Ferramenta | Parâmetros |
|---|---|---|
| raiz `kota` | `notion-create-pages` | `parent: {"teamspace_id": "<id>"}`, com o id do teamspace `Joaquim’s Space HQ` dado por `notion-get-teams`; `pages: [{"properties": {"title": "Kota"}, "content": ""}]` |
| `pagina` | `notion-create-pages` | `parent: {"type": "page_id", "page_id": "<id do pai>"}`; `pages: [{"properties": {"title": "<título>"}, "content": ""}]` |
| `database` | `notion-create-database` | `parent: {"type": "page_id", "page_id": "<id do pai>"}`, `title: "<título>"`, `schema` da tabela abaixo |
| `linha` | `notion-create-pages` | `parent: {"type": "data_source_id", "data_source_id": "<collection da database>"}`; `pages` com as propriedades da linha (seção 2) |

Use `allow_async: false`: o id que volta é o que vai para o `urls.json`. Irmãos seguidos do mesmo tipo podem ir numa
chamada só (o Notion mantém a ordem do array); entre uma página e uma database, crie uma por vez para manter a ordem
da `ARVORE` no Notion.

Schemas das databases (as colunas da N1). As opções de seleção são os valores que hoje saem do `linhasDatabase`:

| Database | `schema` |
|---|---|
| Pessoas | `CREATE TABLE ("Nome" TITLE, "Cargo" RICH_TEXT, "Área" SELECT('Contas':blue, 'Livro-razão':green, 'Canais':orange, 'Plataforma':purple, 'People':pink, 'Segurança':red), "E-mail" EMAIL, "Slack" RICH_TEXT, "Papel" MULTI_SELECT('gestor':blue, 'tech lead':purple, 'buddy':green))` |
| Times | `CREATE TABLE ("Nome" TITLE, "Missão" RICH_TEXT, "Gestor" RICH_TEXT, "Tech lead" RICH_TEXT, "Buddies" MULTI_SELECT('Raíssa Bentes':default, 'Beatriz Cavalcanti':default, 'Igor Valadares':default, 'Vinícius Pires':default), "Canal" RICH_TEXT, "Canal de ajuda" RICH_TEXT, "Plantão" RICH_TEXT)` |
| Sistemas | `CREATE TABLE ("Nome" TITLE, "Time" SELECT('Contas':blue, 'Livro-razão':green, 'Canais':orange, 'Plataforma':purple), "Linguagem" SELECT('Python':default, 'Java':default, 'Postgres':default), "O que faz" RICH_TEXT, "Depende de" MULTI_SELECT('frontend':default, 'userservice':default, 'contacts':default, 'accounts-db':default, 'ledgerwriter':default, 'balancereader':default, 'transactionhistory':default, 'ledger-db':default, 'loadgenerator':default, 'ledgermonolith':default), "Pasta no repo" URL, "Legado" CHECKBOX)` |
| RFCs | `CREATE TABLE ("Título" TITLE, "Número" NUMBER, "Autor" RICH_TEXT, "Status" SELECT('virou ADR':green, 'rejeitada':red), "ADR" URL)` |

Pessoas aparecem pelo nome, em texto, e "Depende de" é a lista de sistemas pelo `Nome` deles: não há relação entre
databases. Se o mapa ganhar um valor que ainda não é opção (área, linguagem, sistema, buddy), acrescente a opção antes
de gravar a linha com `notion-update-data-source` e `ALTER COLUMN "<coluna>" SET SELECT(...)` (ou `MULTI_SELECT`),
listando **todas** as opções: a que ficar de fora some da coluna.

### 1.4. Gravar a URL

Logo depois de achar ou criar o nó, grave a URL pública dele no `urls.json`, na ordem da `ARVORE`:

```bash
npx tsx -e 'import { readFileSync, writeFileSync, existsSync } from "node:fs"; import { ARVORE } from "./kit/kota/notion/arvore"; const [dominio, chave, id] = process.argv.slice(1); if (!ARVORE.some((n) => n.chave === chave)) throw new Error(`chave fora da ARVORE: ${chave}`); const f = "kit/kota/notion/urls.json"; const urls = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {}; urls[chave] = `https://${dominio}.notion.site/${id.replaceAll("-", "")}`; writeFileSync(f, JSON.stringify(Object.fromEntries(ARVORE.filter((n) => n.chave in urls).map((n) => [n.chave, urls[n.chave]])), null, 2) + "\n");' dominio-pendente <chave> <id>
```

O id é o que o Notion devolveu (com ou sem hífens). Para uma database, é o id da database (`<database url>`), não o da
`collection://`.

## 2. Linhas das databases

Depois de criar ou achar cada database, alinhe as linhas dela com o `linhasDatabase` do plano:

1. `notion-fetch` com o id da database dá o `data-source-url` e o `<sqlite-table>` com os nomes exatos das colunas.
2. `notion-query-data-sources` com `SELECT * FROM "collection://<id>"` lista as linhas que já existem. A linha é
   achada pela coluna de título: `Nome` (Pessoas, Times, Sistemas) ou `Título` (RFCs).
3. Para cada linha do plano:
   - não existe: crie com `notion-create-pages` (`parent` `data_source_id`);
   - existe com algum valor diferente: `notion-update-page` com `command: "update_properties"` e só as colunas que
     mudaram;
   - existe igual: nada.
4. Linha que está no Notion e não está no plano (alguém saiu do mapa): liste e pergunte a quem pediu a tarefa
   antes de tirar. Apagar não se desfaz por este procedimento.

Os valores vão como o `linhasDatabase` dá, com duas conversões: `true` vira `"__YES__"` e `false` vira `"__NO__"`
(coluna `Legado`); listas vão como array de strings (seleção múltipla), inclusive a vazia. Na volta, o SQL devolve a
seleção múltipla como texto JSON (`"[\"buddy\"]"`) e a vazia como `null`: compare `null` com a lista vazia como iguais.

As linhas `rfc-1..3` da `ARVORE` são as linhas da database RFCs: entram por aqui e também têm a URL gravada no
`urls.json` (1.4).

## 3. Conteúdo das páginas

Só quando `paginas/<chave>.md` existe (tarefa N3). Antes da primeira vez, leia a especificação do Markdown do Notion
com `notion-fetch` e `id: "notion://docs/notion-flavored-markdown-spec"`.

1. Resolva os links `notion:<chave>` pelo `urls.json` (falha com a chave que não tem URL pública):

   ```bash
   npx tsx -e 'import { readFileSync } from "node:fs"; import { resolverLinks } from "./kit/kota/notion/links"; process.stdout.write(resolverLinks(readFileSync(process.argv[1], "utf8"), JSON.parse(readFileSync("kit/kota/notion/urls.json", "utf8"))))' kit/kota/notion/paginas/<chave>.md
   ```

2. Tire do texto a primeira linha se ela for `# <título>`: o título é a propriedade da página.
3. Ache a página (1.1) e chame `notion-update-page` com `command: "replace_content"` e `new_str` com o texto
   resolvido. O `replace_content` troca o texto inteiro: rodar de novo com o mesmo arquivo não acumula
   nada.
4. Página com subpáginas ou databases (`kota`, `jeito-de-trabalhar`, `politicas`, `kota-people`, `onboarding`):
   `replace_content` apagaria os filhos. Mantenha no `new_str` as tags `<page url="...">` e `<database url="...">`
   que o `notion-fetch` mostra e nunca passe `allow_deleting_content: true`.

## 4. Conferir

1. `npm run -s check:kota`: a regra `notion-urls` não pode acusar nada (toda chave com URL pública, um domínio só,
   nenhuma URL repetida). As regras `paginas*` acusam as páginas que a N3 ainda não escreveu.
2. Nada duplicado. A busca não serve para contar: o `notion-search` devolve no máximo 50 resultados, e a árvore com
   as linhas passa disso. Conte pela estrutura, antes e depois de rodar o procedimento:
   - `notion-fetch` da raiz e das quatro páginas que agrupam (`jeito-de-trabalhar`, `politicas`, `kota-people`,
     `onboarding`): conte os `<page>` e `<database>` do `<content>`;
   - `notion-query-data-sources` com `SELECT COUNT(*) AS n FROM "collection://<id>"` em cada database.

   Com o mapa de hoje, o esperado é 11 filhos na raiz, 6, 6, 5 e 2 nas que agrupam, e 17 pessoas, 4 times,
   10 sistemas e 3 RFCs. Os números de antes e de depois têm que ser iguais.

## Trocar o domínio

O domínio público do workspace é escolhido na interface do Notion (Settings, Sites). O endpoint público `https://www.notion.so/api/v3/getPublicPageData` devolve o domínio atual em `publicDomainName`. Depois de escolher,
troque o domínio em todas as URLs, atualize a linha "Domínio público" deste arquivo e rode o `check:kota`:

```bash
perl -pi -e 's#https://lean-ptarmigan-dd2\.notion\.site/#https://<domínio>.notion.site/#' kit/kota/notion/urls.json
```

Publicar a raiz com as subpáginas (Share, Publish) é da tarefa N4. Até lá, as URLs do `urls.json` não abrem sem login.
