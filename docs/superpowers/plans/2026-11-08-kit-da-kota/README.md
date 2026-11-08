# Kit da Kota: plano em raias paralelas

Índice dos planos que implementam o kit da Kota (issues #110 a #120). O desenho é `docs/kit-da-kota.md`, a decisão é
`docs/decisoes/0005-kit-da-kota.md`. Este índice diz a ordem, quem produz o quê e as regras de coordenação. Cada raia
tem o próprio plano, com tarefas, testes e comandos.

| Plano | Issues | Começa quando |
|---|---|---|
| [`0-alicerce.md`](0-alicerce.md) | #110, parte da #117 | Agora. Bloqueia as outras raias |
| [`1-raia-repo.md`](1-raia-repo.md) | #111 (código), #112 | A tarefa R1 começa junto com o alicerce; o resto, depois da tarefa 0.5 |
| [`2-raia-engenharia-escrita.md`](2-raia-engenharia-escrita.md) | #113 | Alicerce no `main` |
| [`3-raia-notion.md`](3-raia-notion.md) | #115, #116 | Alicerce no `main` |
| [`4-raia-slack.md`](4-raia-slack.md) | #118 (só preenchimento) | Alicerce no `main` |
| [`5-convergencia.md`](5-convergencia.md) | #111 (histórico), #114, #117, #119, #120 | Raias 1 a 3 entregues (a #120 pode começar numa branch antes) |

## Ondas e portões

```
Onda 0  alicerce ─────────────┐   R1 (compose com o código cru, em paralelo)
                              │
Portão 0: mapa válido no main, check:kota verde, oficina com o código importado, compose sobe
                              │
Onda 1  ┌─ raia repo:  R2 marca → R3 dados de demo → R4 CI → R5 README raiz
        ├─ raia eng.:  E1 ADRs → E2 runbooks → E3 READMEs + CODEOWNERS (E3 espera R2)
        ├─ raia Notion: N1 árvore → N2 estrutura no Notion → N3a..e conteúdo → N4 publicar
        └─ raia Slack:  S1 workspace e app → S2 preenchimento
                              │
Portão 1: um nó de jornada de teste cita o ADR-0001 e uma página pública do Notion, e check:kota passa com --repo da oficina
                              │
Onda 2  C1 publicar histórico → C2 primeiras tarefas
        C3 cópia do Notion e check completo
        C4 Tail → Kota no Orbis (#120)
                              │
Onda 3  C5 guia de uso (#119) e teste numa máquina limpa (#39)
```

Um portão só abre com o comando dele verde e o resultado colado na issue.

## Quem produz e quem consome

Cada arquivo compartilhado tem **um dono**. Os outros só leem. É isso que deixa as raias andarem sem combinar na conversa.

| Arquivo | Dono | Quem lê |
|---|---|---|
| `kit/kota/tipos.ts`, `kit/kota/mapa.ts` | alicerce | todos |
| `kit/kota/checar/` (regras do `check:kota`) | alicerce cria; cada raia acrescenta a regra dela num arquivo próprio em `kit/kota/checar/regras/` | todos |
| `kit/kota/marca/` | raia repo | convergência (C1, C3) |
| `kit/kota/gerar/readme-servico.ts` | raia eng. | ninguém |
| `kit/kota/notion/arvore.ts`, `kit/kota/notion/paginas/*.md`, `kit/kota/notion/urls.json` | raia Notion | raia eng. (links dos RFCs), C3, C4, C5 |
| `kit/kota/slack/` | raia Slack | C5 (link do convite) |
| `kit/kota/historia/`, `kit/kota/tarefas/` | convergência | ninguém |
| Árvore de código do Kota (repo `JucaGF/kota-bank-oficina`) | raia repo e raia eng., em PRs separados e caminhos separados | C1 |

Uma mudança de pessoa, time, sistema, ADR ou RFC entra **só** no `mapa.ts`, num PR próprio. Nunca direto no Notion, no
`CODEOWNERS` ou num README.

## Decisões deste plano

Tomadas aqui para destravar as raias. Cada uma pode ser revista sem refazer o resto.

1. **Oficina privada.** O trabalho no código acontece num repo privado `JucaGF/kota-bank-oficina`, com PRs normais. O
   `JucaGF/kota-bank` público só recebe o histórico gerado pelo script da C1 (15 a 25 commits com autores do mapa), em
   cima do commit inicial, por fast-forward. Motivo: uma branch de trabalho no repo público mostraria autores reais ao
   jurado, e gerar o histórico no fim tira da raia repo a dependência dos nomes do mapa.
2. **Registro de ADRs e RFCs dentro do mapa.** Número, título, status, RFC de origem e âncora no código. A raia eng.
   (ADRs) e a raia Notion (RFCs) escrevem em paralelo a partir dele.
3. **Pacotes Java renomeados** de `anthos.samples.bankofanthos` para `br.com.kota`. O jurado abre o código; o anti-objetivo
   proíbe a marca da origem. O aviso de modificação da Apache-2.0 §4(b) entra por script.
4. **CODEOWNERS e autores de commit com e-mails `@kota.example`**, nunca `@handle`. Um `@handle` inventado pode ser o
   de uma pessoa real no GitHub.
5. **Avatares do Slack** pelo DiceBear (iniciais, `https://api.dicebear.com/9.x/initials/png?seed=<nome>`): sintético, sem rosto.
6. **Textos do Notion nascem em Markdown** em `kit/kota/notion/paginas/` e sobem pelo MCP. A mesma pasta é a cópia que a
   Puca lê (#26, `docs/stack.md` §9). A C3 confere que o Notion publicado ainda bate com ela. As URLs são as públicas
   (`*.notion.site`), as mesmas que a lista de endereços permitidos do navegador de Puca aceita (`docs/stack.md` §4.7).
7. **`check:kota` fora do `npm run check`**, porque o CI do Orbis não tem o checkout do Kota. Roda à mão com `--repo`.
8. **Testes do Kota rodam dentro do Docker** (`scripts/testar.sh`), para o jurado só precisar do Docker, inclusive nas
   branches de primeira tarefa.

## Em aberto (não trava nenhuma raia)

- **#13 (resolvida):** a decisão 0008 e o `docs/stack.md` §10.1, na `main`, mandam o encaminhamento por mensagem direta ao jurado, pelo bot do mesmo app da #118 (`SLACK_BOT_TOKEN`, escopos do §10.1, até 10 mensagens por hora), nunca num canal. A raia Slack entrega o app e o token; a ação do servidor fica na #129.
- **`CODEOWNERS` com e-mail no GitHub:** e-mail sem conta com acesso de escrita aparece como "Unknown owner" na tela do arquivo. A E3 confere com `gh api repos/<repo>/codeowners/errors` depois do push e, se aparecer erro, a decisão 4 volta para o Joaquim.
- **Publicar o Notion na web** é um passo na interface do Notion. Suponho que o MCP não faça isso; a N4 confere.
- **Prazo do hackathon:** não está no repositório. As ondas não têm data.

## Emendas às issues

Para as issues dizerem o mesmo que este plano:

- **#110:** acrescentar o registro de ADRs e RFCs, canais e avatares; e-mails `@kota.example` no `CODEOWNERS`.
- **#111:** o código não depende mais da #110; o histórico com autores vira a C1, depois de tudo.
- **#112:** acrescentar `scripts/testar.sh`, `scripts/verificar-local.sh` e o CI em Linux amd64 como prova do critério.
- **#114:** depende da #112 e da C1.
- **#117:** o check nasce no alicerce e cresce por raia; a cópia do Notion fica no fim.
- **#120:** pode começar numa branch depois do alicerce; o merge espera a C1 e a N4.

## Responsáveis (sugestão)

Alicerce e raia repo com Joaquim (dono do `kota-bank` e da conexão do Notion). Raia Notion precisa de quem tiver o MCP
conectado ao Kota Workspace: convidar a pessoa para o workspace antes. As outras raias com quem estiver livre. Cada
pessoa se atribui na issue antes de começar (`gh issue edit <n> --add-assignee @me`).
