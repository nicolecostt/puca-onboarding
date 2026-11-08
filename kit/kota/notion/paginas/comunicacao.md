# Comunicação

Quase tudo na Kota acontece por escrito, no Slack. A regra geral é perguntar e avisar no lugar onde a resposta serve para mais gente.

## Que canal usar

| Canal | Para quê |
|---|---|
| #geral | Avisos para a Kota toda, como a homologação fora do ar, uma tela nova no site ou o resumo de um incidente que outros times viram. Não é lugar de pergunta. |
| #people | O canal de People. Dúvida sobre política, férias, benefícios ou carreira que serve para todo mundo. |
| #contas, #livro-razao, #canais, #plataforma | O canal de cada time, para o dia a dia dele: aviso de deploy, plantão da semana, rituais e decisões pequenas. |
| #contas-ajuda, #livro-razao-ajuda, #canais-ajuda, #plataforma-ajuda | O canal de ajuda de cada time. Qualquer pessoa da Kota pergunta ali sobre o que aquele time cuida. |
| Mensagem direta | Assunto entre duas pessoas. Dúvida técnica não vai por mensagem direta, porque a resposta se perde. |

Fora do horário comercial, problema no site vai para o #plataforma-ajuda, porque é o plantão de Plataforma que cobre o site nesse horário.

## Em qual canal de ajuda perguntar

Procure o serviço na database [Sistemas](notion:sistemas) para saber qual time cuida dele. O canal de ajuda desse time está na database [Times](notion:times). Uma dúvida sobre o extrato, por exemplo, vai no #livro-razao-ajuda, porque o `transactionhistory` é do Livro-razão.

Se ainda assim você não souber onde perguntar, pergunte ao seu buddy.

## Caso pessoal

Dúvida sobre a regra geral de férias, bônus ou promoção pode ir no #people. Se a dúvida é sobre o seu caso, fale com o seu gestor ou escreva para people@kota.example. As regras gerais estão em [Políticas](notion:politicas) e em [Kota People](notion:kota-people). O que é com o buddy, com o gestor e com People está em [Papéis de buddy, gestor e RH](notion:papeis-buddy-gestor-rh).

## Fora do Slack

- **seguranca@kota.example** recebe suspeita de vazamento de senha, token, chave de API ou dado de cliente. Escreva na hora.
- **people@kota.example** recebe o seu caso individual de férias, benefícios, carreira ou salário.
- **O Notion** guarda o que precisa durar e não é código, como políticas, RFCs e este jeito de trabalhar.
- **O [kota-bank](https://github.com/JucaGF/kota-bank)** guarda os ADRs, os runbooks e o README de cada serviço.

## Combinados

- Escreva a pergunta inteira na primeira mensagem, com o que você tentou, o erro e o link. Um "oi, tudo bem?" sozinho faz a outra pessoa esperar por nada.
- Responda na thread da mensagem, para a conversa ficar junta.
- Nos canais de ajuda, alguém do time responde no mesmo dia útil.
- Fora do horário comercial, ninguém espera resposta, a não ser de quem está de plantão.
- Senha, token e chave de API nunca vão no Slack, nem em mensagem direta. Se algo vazou, escreva para seguranca@kota.example.
- Dado de cliente só circula como manda a política de [Dados de cliente e LGPD](notion:dados-de-cliente-e-lgpd).
