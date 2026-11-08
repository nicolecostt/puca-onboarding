# Kit da Kota

Desenho do **kit da Kota**: o mundo fictício onde o jurado vive a pessoa, que é **fonte** de Puca e **prova** para o
jurado ([`PRODUCT.md` §13](../PRODUCT.md#13-avaliação-pelos-jurados-o-mundo-fictício-da-kota), issue #12). A escolha
de base e de onde o kit mora está em [`docs/decisoes/0005-kit-da-kota.md`](decisoes/0005-kit-da-kota.md).

> Alinhamento com Joaquim em 2026-11-08. O que está marcado **(nossa escolha)** foi decidido por quem escreveu este
> documento e pode ser revisto sem voltar ao alinhamento.

## 1. Por quê

Não dá para prever como cada jurado testa o Orbis. Em vez de roteirizar o teste, controlamos o **mundo** em que ele
cai: uma empresa que parece de verdade, com código que roda, decisões registradas, cultura e políticas escritas. O
jurado recebe o mesmo kit que Puca usa e confere que ela não inventou.

A Tail que existe hoje no código (`src/data/company.ts`, `src/data/profiles.ts`, `tail.journey.json`) foi só para
testes. **Ela sai inteira.** A empresa nova é a **Kota** e começa do zero.

### Objetivos

- Parecer o máximo possível uma empresa real, a ponto de o jurado abrir o repo ou o Notion e se sentir no primeiro dia.
- Código que **roda** na máquina do jurado e que tem **testes** que ele consegue rodar.
- Tudo o que Puca afirma tem fonte no kit, com link que o jurado abre.
- Notion **de verdade**: é uma das integrações que mostram que Puca se conecta a sistemas reais.

### Não objetivos

- Produção, escala, nuvem: o banco roda local, com `docker compose`.
- Uma empresa grande: 4 times, 12 a 15 pessoas.
- Integração completa com Jira ou GitHub para a primeira tarefa (§4.4 do `PRODUCT.md`: pode ser simulada).

### Anti-objetivos (falhou, mesmo que funcione)

- Puca afirma algo que o jurado não encontra no kit.
- O kit carrega nome, marca, pessoa ou commit reais da empresa de onde veio o código.
- O jurado não consegue subir o banco seguindo só o guia.
- Algum documento leva Puca a avaliar o desempenho da pessoa (§12.2): ela explica a **política**, nunca julga a pessoa.

## 2. A Kota

A Kota é um **banco digital**. O código vem do **Bank of Anthos** (Google, Apache-2.0,
[GoogleCloudPlatform/bank-of-anthos](https://github.com/GoogleCloudPlatform/bank-of-anthos), versão v0.6.11),
renomeado e sem a marca original.

| Serviço | Linguagem | O que faz | Time |
|---|---|---|---|
| `frontend` | Python | Site: login, cadastro, saldo, transferência, depósito | Canais |
| `userservice` | Python | Contas e autenticação; assina o JWT | Contas |
| `contacts` | Python | Contatos da pessoa cliente para transferir | Contas |
| `accounts-db` | Postgres | Banco de contas e contatos | Contas |
| `ledgerwriter` | Java | Valida e grava transações no livro-razão | Livro-razão |
| `balancereader` | Java | Saldo com cache, lido do livro-razão | Livro-razão |
| `transactionhistory` | Java | Extrato com cache | Livro-razão |
| `ledger-db` | Postgres | Banco do livro-razão | Livro-razão |
| `loadgenerator` | Python (Locust) | Simula clientes usando o banco | Plataforma |
| `ledgermonolith` | Java | Versão antiga em monolito dos três serviços Java | Livro-razão (legado) |

O `ledgermonolith` existe de verdade no repo: é a história pronta de uma decisão (o monolito que virou três serviços).

### Times **(nossa escolha)**

- **Contas**: cadastro, login com JWT, contatos e `accounts-db`.
- **Livro-razão**: transações, saldo, extrato, `ledger-db` e o monolito legado.
- **Canais**: o site.
- **Plataforma**: infraestrutura, CI, `docker compose`, gerador de carga.

Cada time tem gestor, tech lead e pelo menos uma pessoa que serve de buddy. Fora da engenharia: RH (People) e uma
pessoa de segurança da informação, que aparecem nas políticas e nos encaminhamentos. Nomes, cargos e quem é buddy de
quem ficam no mapa da Kota (§5), a cargo de quem montar.

### Perfis do jurado **(nossa escolha)**

Nos dois perfis o jurado entra no time de **Livro-razão**:

| Perfil | Quem é | O que muda na jornada |
|---|---|---|
| **Novo** | Pessoa engenheira de backend recém-contratada | Passa pela parte institucional da Kota (missão, valores, jeito de trabalhar), depois o time |
| **Transição** | Vem do time de **Contas**: conhece login e JWT, nunca mexeu com saldo e extrato | Pula o institucional; foca no que muda: livro-razão, rituais e pessoas do time novo |

## 3. Onde o kit mora

O kit fica onde uma pessoa de verdade procuraria cada coisa: o que é de engenharia no repo, o resto no Notion.

### 3.1. Repo `kota-bank` (GitHub, público)

- **Código** do Bank of Anthos, com histórico novo: 15 a 25 commits assinados por pessoas da Kota, organizados por área, sem os autores originais e sem linha do tempo fabricada em detalhe. Puca não cita commits como fonte **(nossa escolha)**.
- **`README.md`** da raiz: o que é a Kota, como subir o banco e rodar os testes, mapa dos serviços.
- **`README.md` de cada serviço**: o que faz, time responsável, como rodar e testar, de quem depende.
- **`CODEOWNERS`**: cada pasta ligada ao time responsável. Gerado do mapa da Kota.
- **`docs/adr/`**: 6 a 8 ADRs, cada um ancorado em algo visível no código. Sugestões:
  1. Quebrar o monolito do livro-razão em três serviços (`ledgermonolith` → `ledgerwriter`, `balancereader`, `transactionhistory`).
  2. JWT assinado pelo `userservice` e validado em cada serviço com a chave pública.
  3. Um banco por domínio (`accounts-db` e `ledger-db` separados).
  4. Saldo e extrato com cache em memória, lidos do livro-razão.
  5. Python em Contas e Canais, Java no Livro-razão.
  6. Um ADR **rejeitado** (ex.: fila entre `ledgerwriter` e os leitores), porque empresa de verdade também tem esses.
- **`docs/runbooks/`**: 2 ou 3 procedimentos (trocar a chave do JWT, `ledger-db` cheio, subir o banco do zero).
- **Issues abertas com label de primeira tarefa**: 3 a 5 tarefas pequenas, cada uma com teste que falha antes e passa
  depois. São o catálogo de primeira tarefa da Kota: Puca escolhe conforme o perfil e o gestor aprova antes de a
  pessoa começar (§4.4). Pelo menos uma no Livro-razão para cada perfil.
  A `main` fica sempre verde: cada issue aponta para a branch `tarefa/<n>`, com o teste que falha, e para a
  `solucao/<n>`, com ele passando **(nossa escolha)**.

Cada ADR cita o RFC do Notion de onde veio, quando houver.

### 3.2. Notion da Kota (público)

- **Comece aqui**: o guia de uso do jurado (§6).
- **Quem somos**: missão e 3 ou 4 valores, cada um com um exemplo de como aparece no dia a dia.
- **Pessoas** e **Times** (databases): organograma, gestor, tech lead, buddy, canal do Slack, plantão.
- **Sistemas** (database): catálogo de serviços e time responsável, com link para a pasta no repo. Tem que bater com o `CODEOWNERS`.
- **Jeito de trabalhar**: rituais (daily, planning, review, retro), code review, deploy, incidentes, como uma decisão vira RFC e depois ADR, comunicação (que canal para quê).
- **RFCs**: 2 ou 3 propostas com a discussão que levou aos ADRs.
- **Políticas**: segurança e acesso a produção, dados de cliente e LGPD, férias, home office, despesas; papéis de buddy, gestor e RH.
- **Kota People**: como a Kota trata desempenho e crescimento, no tipo do playbook de pessoas da Revolut, mas com o tom da Kota: ciclo de desempenho, trilha de carreira, promoção, bônus, revisão salarial.
- **Onboarding**: checklist de acessos e primeira semana, separado para **novo** e **transição**.
- **Glossário do banco**: livro-razão, saldo, extrato, número de agência, transação.

Os documentos que a gente chamou de lacuna no alinhamento (bônus, desempenho e afins) **existem**: são coisas que uma
empresa real tem.

## 4. Encaminhamento num mundo completo

Com tudo documentado, o encaminhamento (§4.5) aparece por dois caminhos naturais:

- **Caso pessoal**: "qual vai ser o meu bônus?", "posso tirar férias no 2º mês?". Puca explica a regra geral com a
  fonte e leva o caso da pessoa ao RH ou ao gestor.
- **O que nenhum documento cobre**: Puca diz que não confirmou e leva a dúvida, com o que consultou, à buddy ou ao responsável.

## 5. Coerência

**Mapa da Kota (nossa escolha):** um arquivo só com times, pessoas, sistemas, responsáveis, buddy e canais. Ele não faz
parte do que o jurado vê: fica no nosso repo, em `kit/kota/`. Dele saem o `CODEOWNERS` do `kota-bank` e as databases
**Pessoas**, **Times** e **Sistemas** do Notion. É a parte que não pode divergir.

Regras:

- Todo responsável citado (em README, `CODEOWNERS`, ADR, Notion) existe no mapa.
- Todo ADR e RFC citado existe, com o mesmo número e título.
- Todo nó da jornada que cita fonte aponta para um arquivo do repo ou uma página do Notion que existe.
- Nenhum nome, marca ou e-mail da empresa original fora do que a licença exige (§8).

Um script de checagem (no estilo dos `check:*` do repo) confere essas regras contra o mapa, o `kota-bank` e a cópia do Notion.

## 6. Como chega ao jurado e o que ele faz

O jurado recebe dois links, na landing (#48) e no guia: o repo `kota-bank` e o Notion da Kota. O guia de uso é a página
**Comece aqui** do Notion e diz:

- quem ele é na história e como escolher o perfil (novo ou transição);
- onde estão os materiais e como subir o banco;
- o que vale tentar.

**O que deve convencer o jurado (nossa escolha):**

1. Abrir o cartão de um nó, clicar na fonte e cair no ADR ou na página do Notion que diz a mesma coisa.
2. Fazer uma pergunta fora do roteiro sobre o código ou uma política e receber a resposta com a fonte.
3. Fazer uma pergunta pessoal e ver o encaminhamento ao RH, com a regra geral explicada.
4. Pegar a primeira tarefa, achar a issue no `kota-bank`, rodar o teste e ver ele falhar e passar.
5. Subir o banco e ver "Kota" no site.

## 7. Como o kit é preenchido

- **`kota-bank`**: repo novo a partir do Bank of Anthos, histórico novo, textos e ADRs escritos por nós.
- **Notion**: preenchido por agente pelo **MCP do Notion**, a partir do mapa da Kota (databases) e dos textos (páginas).
- **Contas**: o repositório é [`JucaGF/kota-bank`](https://github.com/JucaGF/kota-bank) (público) e o Notion é o
  workspace **Kota Workspace**, já conectado ao MCP. Por estar numa conta pessoal, o dono do repositório aparece como
  `JucaGF`; uma organização própria fica para depois, se der tempo.
- **Slack da Kota**: workspace gratuito próprio, com canais dos times e destino do encaminhamento. O Slack conectado
  hoje ao MCP é o de uma empresa real e **não** pode receber nada do kit. Ver §7.1.
- **Cópia do Notion**: depois de preencher, baixada pelo MCP para `kit/kota/notion/` no nosso repo. Serve para o check
  de coerência e para Puca ler rápido, sem depender da rede (a resposta nunca espera, nem o LLM nem a rede).

### 7.1. Slack pela API

> Alinhamento com Joaquim em 2026-11-08.

O Slack da Kota usa a **API do Slack direto**, com um **app do Slack e token de bot**, e não o MCP: o MCP fica preso a
um workspace e age como a pessoa logada, e o servidor de Puca não consegue usar login de pessoa.

- **Preencher**: um script cria os canais (`conversations.create`) e posta o histórico (`chat.postMessage`). Com o
  escopo `chat:write.customize`, cada mensagem sai com nome e foto de uma pessoa da Kota, sem contas reais.
- **Agir na demo (decidido na 0008, #13)**: o mesmo app é usado pelo servidor de Puca no encaminhamento ("agir num
  sistema", §12.2 do `PRODUCT.md`). O Slack real complementa o simulado, que fica no `npm run dev`, como plano B e na
  aprovação do gestor.
- **Pessoas da Kota não são membros reais**: o encaminhamento vai por mensagem direta do bot ao próprio jurado,
  dizendo a quem iria na Kota (a buddy pelo nome, o RH ou o gestor). Nunca num canal: todos os jurados entram no mesmo
  workspace, e a dúvida de um não pode aparecer para os outros.
- **O jurado entra pelo link de convite** do workspace, que fica no guia de uso. Quem tiver o link entra no workspace
  onde o bot age: o app fica com o mínimo de escopos.
- O token fica fora do repositório (no script de preenchimento; no `server/.env` do servidor, decisão 0008).

### 7.2. Quem consome o kit

Quem consome a cópia é o company brain (#26). Como o servidor de Puca acessa o Notion **na hora da demo** (token de
integração, MCP local ou só a cópia) ficou decidido na 0008: só a cópia, sem token nem MCP na hora da sessão. O MCP
hospedado do Notion entra com o login de uma pessoa e não serve para um servidor.

## 8. Rodar o banco

- `docker compose` escrito por nós, a partir de `kubernetes-manifests/` do Bank of Anthos. O original só roda em Kubernetes.
- **O `compose` constrói as imagens a partir do código (nossa escolha).** As imagens publicadas
  (`us-central1-docker.pkg.dev/bank-of-anthos-ci/bank-of-anthos/*:v0.6.11`) são públicas, mas só **amd64**, conferido em
  2026-11-08. Nos Macs com Apple Silicon elas rodariam emuladas. Construir localmente também resolve a marca e as
  primeiras tarefas que mudam código. O jurado só precisa do Docker.
- Os serviços Python e os bancos têm `Dockerfile`. Os Java não têm (usam Jib via Maven): escrevemos um `Dockerfile`
  em dois estágios (Maven e JRE) para cada um.
- O nome no site vem de `BANK_NAME=Kota`. Logo e textos fixos com a marca antiga são trocados no código do `frontend`.
- **Subir de verdade ainda não foi testado.**
- Falta gerar o par de chaves do JWT, que no Kubernetes vem de um secret.
- Testes por serviço: `pytest` em `userservice` e `contacts`; `mvn test` nos três serviços Java.

### Restrições

- **Licença Apache-2.0**: o `LICENSE` fica e os cabeçalhos de copyright dos arquivos de código também (cerca de 218
  arquivos). O README da raiz diz que o código é baseado no Bank of Anthos. Arquivos que a gente modificar levam um aviso
  visível de modificação (§4(b) da licença). O upstream não tem `NOTICE` (conferido em 2026-11-08); se aparecer, fica.
  A marca (Bank of Anthos, Anthos, Cymbal, Google) não aparece como marca da Kota.
- **Dados sintéticos** (§12.2): pessoas, e-mails, contas e transações são inventados. E-mails só com domínio
  reservado (ex.: `kota.example`), para não cair em contas reais.

## 9. Fora deste trabalho

- Trocar a Tail pela Kota no código do Orbis (`src/data/`, jornada de demo, landing, `server/src/app.ts`, `docs/demo.md`,
  `docs/contratos.md`, `docs/journey-format.md`, README e as skills em `.claude/skills/`): nova jornada, outra issue.
- Stack do app e acesso ao Notion em tempo de demo: #13 e #26.
- Os dois perfis no app: #30. Landing: #48. Ambiente de demonstração: #49.

## 10. A jornada

> Decidido com Joaquim em 2026-11-08.

A jornada continua **escrita à mão**, mas **acontece no kit**: todo momento se passa na Kota, e toda fonte que um nó
cita é um arquivo do `kota-bank` ou uma página do Notion da Kota, com caminho ou URL estáveis que o check de coerência
confere (§5). Perguntas fora do roteiro são respondidas a partir da cópia do kit (#26). Escrever a jornada nova é a
tarefa de trocar a Tail pela Kota no Orbis (§9).
