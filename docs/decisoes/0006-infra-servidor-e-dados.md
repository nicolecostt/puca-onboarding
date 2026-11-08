# 0006 — Servidor no Fly.io e login, dados e arquivos no Supabase

- Data: 2026-11-08 · Quem: Joaquim
- Status: valendo

**Contexto:** o app roda no Mac do jurado (0004) e não pode levar chave de API. O servidor precisa ficar na nuvem. Ele
cria o áudio da Puca na memória (`/api/speak`) e o entrega numa segunda requisição (`/api/tts/:id`), faz streaming
por SSE e mantém WebSocket com a ElevenLabs: serverless quebra isso. Os dados da pessoa (perfil, calibragem,
progresso, rastro, encaminhamentos, primeira tarefa) vivem hoje só no `localStorage`/`sessionStorage` de uma máquina,
e cada jurado precisa dos seus.

**Decisão:**

- O servidor (`server/`) roda no **Fly.io, numa máquina só, sempre ligada** (`min_machines_running = 1`, sem
  desligar por inatividade). Região inicial `iad`, comparada com `gru` pelo `bench:turn`.
- **Supabase** para login, dados e arquivos:
  - **Auth:** login anônimo por instalação, com nome e perfil numa tela simples; contas fixas de e-mail e senha só
    para a apresentação. O servidor confere o token do Supabase em toda rota, menos `/api/health`.
  - **Postgres:** uma tabela por dado da pessoa, com RLS por `auth.uid()`. O app grava local primeiro e sincroniza
    por uma fila; a sessão nunca espera o Supabase.
  - **Storage:** o cache de áudio da Puca sai do disco do servidor.
- O **front vai dentro do app**; não há front hospedado (Vercel fica de fora).
- O servidor passa a ter **limite de uso por pessoa** e uma trava diária de chamadas ao LLM.

Desenho completo: [`docs/stack.md`](../stack.md) §5 e §6.

**Consequências:**

- Entram `@supabase/supabase-js`, `jose`, `@fastify/rate-limit`, `@fastify/cors`; `fly.toml`, `server/Dockerfile`
  e `supabase/migrations/` no repo. Chaves por `fly secrets`, nunca no repo.
- Toda rota do servidor (menos `/api/health`) passa a exigir `Authorization: Bearer <token do Supabase>`: muda o
  contrato "API do servidor". Formato das tabelas e da fila entra no contrato "Progresso e memória" antes de
  implementar (skill `contrato`).
- `puca:profile` e `puca:calibragem` passam de `sessionStorage` para `localStorage`.
- `npm run dev` sem Supabase e sem servidor continua funcionando como hoje.
- Supabase no plano pago durante a avaliação (o grátis pausa depois de 7 dias sem uso).
