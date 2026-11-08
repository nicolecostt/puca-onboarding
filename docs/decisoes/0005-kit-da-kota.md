# 0005 — Kit da Kota: Bank of Anthos como código, repo no GitHub e Notion de verdade

- Data: 2026-11-08 · Quem: Joaquim
- Status: valendo

**Contexto:** a issue #12 pede um mundo fictício que seja fonte da Puca e prova para o jurado (`PRODUCT.md` §13). A
Tail que existe no código foi só para testes e não parece uma empresa de verdade. Escrever um codebase inteiro à mão
sempre fica com cara de falso, e o jurado precisa conseguir rodar e testar o que a Puca explica.

**Decisão:**

- A empresa fictícia passa a ser a **Kota**, um banco digital. A Tail sai inteira.
- O código da Kota é o do **Bank of Anthos** (Google, Apache-2.0, v0.6.11): 6 serviços em Python e Java, 2 Postgres,
  testes por serviço e um monolito legado que virou três serviços. Comparado com AKS Store Demo (roda fácil, mas o
  domínio é raso) e eShop (realista, mas todo em .NET), é o que mais rende para o onboarding: cada serviço tem um
  responsável óbvio, há políticas de segurança que fazem sentido e decisões reais para os ADRs. O custo é escrever um
  `docker compose`, porque o original só roda em Kubernetes.
- O kit mora onde uma pessoa de verdade procuraria: **repo público `kota-bank` no GitHub** (código, READMEs,
  `CODEOWNERS`, ADRs, runbooks, issues de primeira tarefa) e **Notion público de verdade** (cultura, pessoas, times,
  sistemas, políticas, Kota People, RFCs, onboarding, guia de uso). O Notion também é uma das integrações que mostram
  que a Puca se conecta.
- O Notion é preenchido por agente pelo **MCP do Notion**. Times, pessoas, sistemas e responsáveis saem de um arquivo
  só, o **mapa da Kota**, no nosso repo (`kit/kota/`), que também gera o `CODEOWNERS`. Depois de preencher, uma cópia do
  Notion é baixada para o nosso repo para o check de coerência e para a Puca ler sem depender da rede.

Desenho completo: [`docs/kit-da-kota.md`](../kit-da-kota.md).

**Consequências:**

- Tudo que cita a Tail no código e nos docs (`src/data/`, `tail.journey.json`, `docs/demo.md`, `docs/contratos.md`,
  `docs/journey-format.md`, README) vai ser trocado numa tarefa própria, com a jornada nova.
- Mudou um responsável, time ou pessoa? Muda no mapa da Kota, e não direto no Notion ou no `CODEOWNERS`.
- O `LICENSE` e os cabeçalhos de copyright do Bank of Anthos ficam no `kota-bank`, como a Apache-2.0 exige.
- Como o servidor da Puca acessa o Notion na hora da demo fica para #13 e #26.
- A jornada continua escrita à mão, mas acontece no kit: toda fonte citada por um nó é um arquivo do `kota-bank` ou uma
  página do Notion da Kota, conferida pelo check de coerência.
- O repositório é `JucaGF/kota-bank` e o Notion é o Kota Workspace.
- O Slack da Kota é um workspace gratuito próprio, usado pela **API do Slack com um app e token de bot** (e não pelo MCP):
  o mesmo app preenche os canais (mensagens com nome e foto de pessoas da Kota) e faz o encaminhamento da Puca na demo.
  O token fica no `server/.env`. Se o Slack real substitui ou complementa o simulado da `live-session` fica para #13.
