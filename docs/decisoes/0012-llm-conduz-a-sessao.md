# 0012 — O LLM conduz a sessão; a jornada vira pauta

- Data: 2026-11-08 · Quem: João
- Status: valendo

**Contexto:** a sessão seguia a jornada como roteiro, e o LLM só respondia o que a `route.ts` não resolvia. Na
conversa por voz isso soava errado: interrompido, o Puca respondia e voltava sozinho com "Voltando ao que eu
falava", repetindo a fala inteira, sem ouvir direito nem perguntar se podia voltar (#173). Com o Claude Haiku sem
raciocínio (decisão 0007), a primeira frase sai em ~0,8 s, rápido o bastante para o LLM decidir todo turno.

**Decisão:**

- Todo turno da sessão, do Puca ou da pessoa, é um `POST /api/turn` (contrato "Turno da sessão" em
  `docs/contratos.md`). O LLM escreve cada fala e decide o próximo movimento: seguir para o próximo passo, pular de
  momento, registrar a checagem, encaminhar ou esperar a pessoa.
- A jornada é a **pauta**: o prompt leva o objetivo e a fala de cada passo como guia, não como texto obrigatório. As
  transições da jornada continuam valendo (`nextPosition`), e as ações do passo montam o quadro ao entrar nele.
- Interrompido, o Puca responde ao que a pessoa disse e pergunta antes de voltar ao assunto. Nada retoma sozinho.
- A call inicial segue o mesmo modelo (`POST /api/call`, #57): perguntas norteadoras em vez de roteiro, follow-ups
  do LLM, onboarding cultural pelo Notion da Kota e as respostas anotadas por ferramenta, que viram perfil e
  calibragem. Sem respostas de exemplo: sem LLM, a call avisa que o Puca está fora do ar.
- O Notion da Kota (`kit/kota/notion/paginas/`, ~25 mil tokens) vai inteiro na parte fixa do prompt, com cache.
  É um dos dois caminhos da #25; a busca (BM25 ou vetores) entra se a qualidade ou a latência pedirem.
- A `route.ts` vira plano B: sem servidor, sem LLM ou com a trava diária esgotada, a sessão segue a jornada como
  roteiro, como antes. O `/api/ask` continua para esse caminho e para o `bench:llm`.
- O STT só fecha a fala depois de 800 ms de pausa (era 300 ms, e cortava a frase no meio).

**Consequências:**

- A regra do `CLAUDE.md` "A resposta nunca espera o LLM" passa a ser "A sessão nunca fica muda": o LLM decide o
  turno, a ponte cobre a espera e a `route.ts` cobre a falha.
- Toda fala do Puca vira TTS gerado na hora (o cache só ajuda frase repetida): mais caracteres na ElevenLabs por
  sessão. A trava `LIMITE_DIARIO_TTS` tem que caber na cota do plano.
- Cada passo é uma chamada ao LLM: entre um passo e outro há ~1 s de espera, e a trava `LIMITE_DIARIO_LLM` conta
  turnos, não perguntas.
- A sincronia fina entre palavra e quadro (`at` das ações) só vale no roteiro; no turno do LLM, as ações saem
  quando a frase seguinte começa a tocar.
- O servidor precisa do `kit/kota/notion/` na imagem (`server/Dockerfile`).
