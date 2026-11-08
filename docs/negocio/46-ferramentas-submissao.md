# Ferramentas, modelos e APIs para a submissão

Inventário baseado no código e na documentação deste repositório em 8 de novembro de 2026. “Implementado no repositório” indica integração presente no código; não confirma que uma conta, chave ou serviço esteja ativo no ambiente da demonstração.

## Construção do projeto

| Item | Uso evidenciado no repositório | Estado |
|---|---|---|
| TypeScript | Linguagem do front e do servidor | Implementado |
| Vite | Desenvolvimento e build do front | Implementado |
| Fastify | API do servidor | Implementado |
| Vitest | Testes automatizados | Implementado |
| Three.js | Dependência declarada no projeto; não encontrei importação no código consultado | Presente nas dependências |
| Electron | App desktop para Mac | Planejado em `docs/stack.md`; não consta nas dependências atuais |

O repositório não comprova quais editores, assistentes de programação, ferramentas de design ou serviços de hospedagem foram usados pela equipe para construir o projeto. Confirmar com a equipe antes de incluir esses nomes na submissão. O Figma é citado como referência visual nos documentos, mas isso não confirma uso de uma ferramenta específica no processo de implementação.

## Modelos e APIs do produto

| Serviço | Uso e identificação encontrada | Estado no código |
|---|---|---|
| Featherless AI | API compatível com OpenAI, chamada por `fetch` em `/chat/completions`; o benchmark identifica Qwen3-32B. | Implementado como LLM atual em `server/src/llm.ts`. Requer `FEATHERLESS_API_KEY`. |
| Deepgram | Geração de token para STT e conexão WebSocket de transcrição; modelo `nova-3`, idioma `pt-BR`. | Implementado em `server/src/voice/deepgram-token.ts`. Requer chave do servidor. |
| ElevenLabs | API de TTS com áudio e alinhamento de caracteres; modelo configurável, com `eleven_flash_v2_5` como padrão no exemplo de ambiente. | Implementado; HTTP e WebSocket disponíveis no servidor. Requer chave e ID de voz. |

A troca para Anthropic Claude Haiku 5.5 (`claude-haiku-5-5`) está registrada na decisão 0007 e no plano da stack, mas ainda não está implementada no cliente atual. Portanto, não listar como modelo em uso no produto sem atualizar este inventário após a integração.

## Componentes planejados, sem integração confirmada no código atual

| Serviço ou ferramenta | Planejamento documentado |
|---|---|
| Supabase | Login, banco e armazenamento, previstos em `docs/stack.md`; o SDK não aparece nas dependências atuais. |
| Slack | Encaminhamento real via bot e API documentados como evolução; o Slack presente na demo é simulado. |
| GitHub API | Leitura pública planejada; escrita por token é condicional. A integração de escrita não está confirmada no servidor atual. |
| Notion API/MCP | Conteúdo local/público e MCP para preparação do kit são descritos na documentação; não há integração ao vivo do Notion no servidor da sessão. |
| Fly.io | Hospedagem descrita como plano; confirmar se o deploy foi realizado. |

## Confirmações da equipe antes do envio

- Quais ferramentas de autoria e desenvolvimento a equipe realmente usou (editor, assistente de IA, design e colaboração).
- Se o servidor da demonstração usará Featherless, Deepgram e ElevenLabs com credenciais ativas, e quais serviços estarão habilitados ao vivo.
- Se Anthropic/Claude já foi integrado depois do estado deste checkout; a documentação registra a mudança como planejada.
- Se Supabase, Slack, GitHub e Fly.io foram ativados ou continuam apenas no plano.

## Evidências no repositório

- Dependências e scripts: `package.json`.
- Cliente Featherless: `server/src/llm.ts`; modelo medido: `server/bench/llm-latency.ts`.
- Deepgram: `server/src/voice/deepgram-token.ts` e `server/.env.example`.
- ElevenLabs: `server/src/voice/tts/elevenlabs-http.ts`, `server/src/voice/index.ts` e `server/.env.example`.
- Planejamento e status da stack: `docs/stack.md` §§ 3, 6–10, 13 e `docs/decisoes/0007-llm-claude-haiku.md`.
