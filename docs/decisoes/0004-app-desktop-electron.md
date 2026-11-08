# 0004 — O Orbis vira app para Mac em Electron, instalado pelo terminal

- Data: 2026-11-08 · Quem: Joaquim
- Status: valendo

**Contexto:** o computer use de verdade (a Puca abrindo, apontando e clicando nas ferramentas da pessoa) é a aposta de
diferencial, e no Mac ele exige um app com a permissão de Acessibilidade; o navegador não consegue. Portar para Swift
significaria reescrever cerca de 8.900 linhas de front (quadro, motor da jornada, telas, voz) enquanto o time segue
mudando esse mesmo código em TypeScript. Não há tempo para conta de desenvolvedor da Apple nem para a App Store.

**Decisão:**

- O Orbis é um **app desktop em Electron** em volta do front atual. Vite + TypeScript sem framework continua; o front
  roda igual no Electron (é o mesmo Chromium do desenvolvimento).
- O MVP é **só para macOS** (Apple Silicon e Intel).
- O computer use acontece num **navegador da Puca dentro do app** (uma área da janela do Orbis, um `WebContentsView`,
  com GitHub, Notion e Slack na versão web), controlado pelo protocolo de depuração do Chromium (`webContents.debugger`):
  navegar, clicar e passar o mouse com eventos de mouse reais, preencher campos e teclar. Como o navegador é do app, a
  posição de cada elemento é conhecida e o cursor da Puca é desenhado por cima dele. Ver a tela por print fica fora do
  MVP (0008). Apps nativos (Slack desktop, por exemplo) ficam
  fora do MVP. O desenho das ações está na decisão 0008 e na #123.
- **Instalação pelo terminal**, sem App Store e sem conta da Apple: `curl -fsSL <endereço>/instalar | bash` baixa o
  `.zip` dos Releases do GitHub (o repositório é público), coloca o `Orbis.app` em `~/Applications` e abre. Arquivo
  baixado com `curl` não recebe a quarentena do macOS, e o build assina o app com assinatura própria (`codesign --sign -`).
  O script confere o SHA-256 publicado no Release antes de instalar, e o guia de uso diz que o app não é notarizado.
- O servidor (voz e LLM) fica na nuvem. **As chaves de API nunca vão dentro do app.**

**Medições** (2026-11-08, Mac M4, macOS 26.6, Electron 33.2.1, sessão `?perfil=ana&auto=1` em primeiro plano, 30 s, sem voz):

| Cenário | CPU (% de 1 núcleo) | Memória (aprox.) |
|---|---|---|
| Sessão no Chrome | 28% | 700 MB |
| Sessão no Electron | 33% | 400 MB |
| Só a janela transparente com o cursor da Puca andando pela tela inteira | 6% | 95 MB |
| Sessão + janela transparente | 39% | — |
| Sessão atrás de outras janelas | ~0% | — |

O custo é da página, não do Electron. Comparado: Swift nativo, Swift com WebView, Tauri (Rust e motor do Safari) e Electron.

**Consequências:**

- Entram `electron` e um empacotador como dependências de desenvolvimento quando o app for implementado; `npm run dev`
  no navegador continua sendo o jeito de trabalhar nas telas.
- A única permissão do macOS é o microfone (aviso do sistema). O computer use dentro do próprio app não pede
  Acessibilidade nem Gravação de tela.
- Sem assinatura da Apple, não há atualização automática: versão nova é rodar o comando de novo.
- Quem não tem Mac fica fora do MVP.
- O resto da stack (servidor, dados, LLM, ações reais) está nas decisões 0006, 0007 e 0008. Guia de implementação de
  tudo, inclusive do app (estrutura de `desktop/`, empacotamento, `instalar.sh`, release): [`docs/stack.md`](../stack.md).
