# Decisões

Uma decisão por arquivo, `NNNN-assunto-curto.md`, numerada em sequência. Arquivos separados evitam conflito de
merge quando duas pessoas registram decisões ao mesmo tempo (se o número coincidir, quem integrar depois renumera).

Registre só o que muda o trabalho dos outros: formato de dados, biblioteca nova, o que fica fora da demo,
uma regra do produto. O resto fica no PR.

Modelo:

```markdown
# NNNN — Título

- Data: AAAA-MM-DD · Quem: nome
- Status: valendo | substituída por NNNN

**Contexto:** o problema em 1–3 frases.
**Decisão:** o que fica decidido.
**Consequências:** o que muda para quem trabalha no repo.
```
