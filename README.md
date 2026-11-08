# Orbis

O **Orbis** é um app de onboarding e de transição entre equipes. Quem conduz é o **Puca**, um agente de IA que faz o
papel de mentor nos primeiros dias: ele transforma o conhecimento espalhado da empresa (Notion, repositórios, ADRs,
políticas) numa sessão guiada, visual e feita para cada pessoa.

## Como funciona

1. **Call inicial:** o Puca conversa com a pessoa para entender o cargo, o time e o que ela já sabe.
2. **Jornada:** com isso, monta um caminho próprio e pula o que a pessoa já domina.
3. **Sessão no quadro:** explica falando enquanto desenha no quadro (sistemas, pessoas, decisões), e a pessoa
   interrompe e pergunta quando quiser, por voz ou chat.
4. **Checagem de entendimento:** pergunta para confirmar o que ficou claro e reforça o que não ficou.
5. **Primeira tarefa:** entrega uma tarefa real e pequena do time, aprovada pelo gestor no Slack.
6. **Encaminhamento:** o que não tem fonte confiável ela não inventa; manda a dúvida para a buddy.

Buddy, gestor e RH acompanham o progresso e as pendências sem precisar repetir as mesmas explicações.

## A Kota

Na demo, a pessoa entra na **Kota**, um banco digital fictício com código que roda, ADRs, Notion e Slack de verdade.
O kit da Kota é a fonte do Puca e a prova para quem avalia: tudo o que ele explica dá para conferir lá.

## Rodar

```bash
npm install
npm run dev     # abre a lista de telas
npm run check   # tipos, testes, base do sistema, harness e build (o que o CI roda)
```

## Saiba mais

- [`PRODUCT.md`](PRODUCT.md): visão do produto · [`CONTEXT.md`](CONTEXT.md): glossário
- [`docs/desenvolvimento.md`](docs/desenvolvimento.md): como rodar o servidor, a estrutura de pastas e onde mexer
- [`docs/demo.md`](docs/demo.md): roteiro da demo · [`docs/kit-da-kota.md`](docs/kit-da-kota.md): o mundo da Kota
- [`docs/stack.md`](docs/stack.md) e [`docs/decisoes/`](docs/decisoes/): stack e decisões técnicas
- [`AGENTS.md`](AGENTS.md): regras do time para quem trabalha com agentes de programação
