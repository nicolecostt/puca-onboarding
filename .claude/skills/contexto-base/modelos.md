# Modelos da base do sistema

Tirados do que o `PRODUCT.md` e o `CONTEXT.md` já fazem. O validador (`npm run check:contexto`) confere a estrutura.

## PRODUCT.md — seção nova

Vai no fim, com o próximo número. Três mudanças juntas:

**1. No sumário** (a âncora é o título em minúsculas, sem pontuação, espaços viram hífens; acentos ficam):

```markdown
13. [Avaliação pelos jurados: o mundo fictício da Tail](#13-avaliação-pelos-jurados-o-mundo-fictício-da-tail)
```

**2. Separador** `---` depois da seção anterior.

**3. A seção:**

```markdown
## 13. Avaliação pelos jurados: o mundo fictício da Tail

> Alinhamento com Joaquim em 2026-11-07.

Um parágrafo de 1–3 frases: o que é e por que importa para o produto.

### 13.1. Primeiro aspecto

Texto curto. Liste com `-` quando forem itens; tabela quando comparar coisas (perfis, papéis, passos).

### 13.2. Em aberto

- Pergunta que ainda precisa de decisão?
```

## PRODUCT.md — subseção nova numa seção existente

`### N.M. Título`, com `M` = próxima subseção daquela seção. Não renumere as outras: link de alguém pode apontar para elas.

## PRODUCT.md — destaques (blocos de citação)

Use só estes, sempre no começo do bloco:

| Destaque | Quando |
|---|---|
| `> **No hackathon:** …` | O escopo do hackathon é menor ou diferente da visão do produto |
| `> ⭐ **…**` | O que é principal para a demo |
| `> ⚠️ **…**` | Limite que não pode ser cruzado (privacidade, segurança, regra do desafio) |
| `> **Prioridade:** …` / `> **Limites …:** …` | Ordem de execução ou restrição |
| `> **Exemplo:** …` | Um caso concreto |
| `> **Hipótese …:** …` | Algo a validar, não um fato |
| `> Alinhamento com <quem> em AAAA-MM-DD.` | A seção (ou parte) veio de uma conversa |
| `> “…”` | Fala de exemplo de Puca ou da pessoa |

## PRODUCT.md — referências

Para outra seção: `[§4.5](#45-conhecimento-contínuo-e-encaminhamento-humano)`. O número no texto é o da seção da âncora.
Para issue: `#12`. Para arquivo do repo: `` `src/journey/route.ts` `` (sem colar código).

## CONTEXT.md — termo novo

No grupo `##` certo (Pessoas e papéis, Perfis, Conversa, Jornada, Quadro, Fontes, Avaliação…). Grupo novo só se nenhum servir.

```markdown
**Encaminhamento**:
Quando Puca admite que não achou fonte confiável e leva a dúvida, com contexto, ao buddy ou responsável.
_Avoid_: escalonamento, fallback
```

- Nome no singular, com inicial maiúscula.
- Definição de 1–2 frases do ponto de vista do domínio. Sem código, caminho de arquivo ou detalhe de implementação.
- `_Avoid_` (opcional, sempre a última linha): sinônimos que não usamos. Se um deles for outro termo do glossário,
  explique entre parênteses: `_Avoid_: lousa (é o produto)`.
- Mesmo nome para dois conceitos: escreva `(Não confundir com …)` na definição do segundo.

## CONTEXT.md — mudar um termo

Renomear ou mudar o significado afeta código, issues e docs: faça o passo **Propagar** da skill e diga no PR.
