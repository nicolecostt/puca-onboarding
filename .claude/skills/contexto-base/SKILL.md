---
name: contexto-base
description: Use SEMPRE que for adicionar ou mudar algo em PRODUCT.md (visão de produto, cenários, funcionalidades, prioridades do hackathon, alinhamentos, insights) ou CONTEXT.md (glossário do domínio) — inclusive quando a pessoa disser "anota isso no contexto", "isso vai pro PRODUCT", "novo insight", "novo termo", "alinhamento com fulano". Garante o padrão dos dois arquivos e leva a mudança para issues e docs. Não use para decisão técnica (vai em docs/decisoes/) nem para como o código funciona (README, docs/).
argument-hint: "[o que entra ou muda na base]"
---

# Mudar a base do sistema

Pedido: $ARGUMENTS

`PRODUCT.md` (o quê e por quê do produto) e `CONTEXT.md` (o vocabulário) são a base que todos os agentes leem.
Uma mudança aqui muda o trabalho de todo mundo: por isso segue sempre o mesmo caminho.

## 1. Onde isso vai

| É… | Vai em |
|---|---|
| O que o produto faz, para quem, por quê; cenário; prioridade ou limite do hackathon; resultado de um alinhamento | `PRODUCT.md` |
| Uma palavra do domínio que precisa de significado único (ou um sinônimo a evitar) | `CONTEXT.md` |
| Uma escolha técnica (stack, biblioteca, formato, onde guardar dados) | `docs/decisoes/` (não aqui) |
| Como o código funciona, como rodar | `README.md`, `docs/` |
| Uma tarefa | issue (não aqui) |

Uma coisa só vai para um lugar. Se precisar aparecer em outro, **linke**, não copie.

## 2. Antes de escrever

1. Sincronize (skill `sincronizar`): outra pessoa pode estar mudando o mesmo arquivo. `gh pr list` e veja se algum PR aberto mexe em `PRODUCT.md`/`CONTEXT.md`; se sim, combine antes.
2. Leia o **sumário** do `PRODUCT.md` e procure se o assunto já existe (`grep -n -i "<palavra>" PRODUCT.md CONTEXT.md`).
   - Já existe: **atualize a seção existente** no lugar. Nunca deixe duas versões da mesma regra.
   - Contradiz algo escrito: mostre a contradição para a pessoa e pergunte qual vale. A nova substitui a antiga no texto; não acumule.
3. Use os termos do glossário no texto novo (ele já está no seu contexto). Termo que não existe e vai ser usado em mais de um lugar entra no `CONTEXT.md` junto.

## 3. Escrever no padrão

Siga os modelos de [`modelos.md`](modelos.md) (seção nova, subseção, destaques, termo do glossário). O essencial:

- `PRODUCT.md`: seção `## N. Título` no fim (próximo número), entrada no **Sumário** com a âncora certa, `---` entre seções,
  subseções `### N.M.`, referências como `[§N.M](#âncora)`. Conteúdo que veio de conversa leva a origem:
  `> Alinhamento com <quem> em AAAA-MM-DD.` O que ainda não está decidido vai numa subseção **Em aberto**.
- `CONTEXT.md`: `**Termo**:` + definição curta do ponto de vista do domínio + `_Avoid_:` (opcional, última linha), dentro do grupo `##` certo. Sem código, sem implementação.

## 4. Validar

```bash
npm run check:contexto                      # estrutura: sumário, âncoras, numeração, formato do glossário
npx tsx scripts/check-contexto.ts --termos  # avisos: termos que o glossário evita nas linhas novas
```

Erro tem que ser corrigido. Aviso de termo: troque quando o texto fala do conceito do glossário; se for uso comum da palavra, deixe.

## 5. Propagar (não pule)

A base mudou; o que depende dela tem que acompanhar. Procure e ajuste no mesmo PR, ou crie issue:

1. **Issues:** `gh issue list --state open --search "<palavras-chave>"`. Requisito novo → acrescente na issue afetada
   (seção "Do contexto novo", citando a seção `§N`); trabalho que não tem issue → crie com o template `tarefa`;
   termo renomeado → ajuste os títulos que usam o antigo.
2. **Docs do time:** `docs/demo.md` (o que a demo mostra), `docs/contratos.md`, a prioridade no `CLAUDE.md`.
3. **Código e textos da interface** que usam o termo antigo: liste para a pessoa; a troca em código é outra tarefa.

## 6. Entregar

PR só com a mudança da base (e o que foi propagado), título `docs(product): …` ou `docs(context): …`,
e na descrição: o que mudou, seções/termos afetados, issues criadas ou atualizadas. Use `/handoff`.

## Saída

- Onde entrou (arquivo, seção ou termo) e por quê ali
- Contradições encontradas e como ficaram
- Resultado do `check:contexto` e dos avisos de termos
- Issues e docs atualizados ou criados
