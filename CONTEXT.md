# Puca

Agente de IA que conduz o onboarding de quem entra na empresa ou muda de time: conversa por voz ou texto
enquanto monta um quadro visual que explica sistemas, pessoas e processos. Só glossário: nada de implementação aqui.

## Pessoas e papéis

**Puca**:
A agente que conversa com a pessoa e conduz a aula.
_Avoid_: bot, assistente, tutor

**Orbis**:
O produto (o app) onde a Puca atua.
_Avoid_: plataforma, Lousa, Iris (nomes antigos)

**Pessoa**:
Quem está sendo integrado, novo na empresa ou mudando de time.
_Avoid_: usuário, aluno, colaborador

**Buddy**:
Colega designado para acompanhar a pessoa; destino padrão quando a Puca não tem fonte confiável.
_Avoid_: mentor, padrinho

**Gestor**:
Líder do time de destino da pessoa.
_Avoid_: chefe, manager

**Responsável**:
Quem cuida de um sistema ou decisão, segundo uma fonte confirmada.
_Avoid_: dono (quando não confirmado)

## Perfis

**Perfil**:
O que se sabe da pessoa (cargo, time, gestor, ferramentas, como prefere aprender) e o vínculo dela.
_Avoid_: persona, cadastro

**Novo**:
Vínculo de quem acabou de entrar na empresa; passa pela parte institucional.
_Avoid_: recém-chegado, onboarding

**Transição**:
Vínculo de quem já está na empresa e muda de time; pula a parte institucional e vai direto ao time.
_Avoid_: transferência, mudança

**Calibragem**:
O que a Puca concluiu sobre o que a pessoa já sabe, com o grau de certeza de cada item.
_Avoid_: diagnóstico, avaliação

## Conversa

**Call inicial**:
A primeira conversa, em que a Puca acolhe a pessoa, faz o onboarding cultural e preenche o perfil.
_Avoid_: entrevista, kickoff

**Aula**:
Uma sessão em que a Puca explica um assunto montando o quadro enquanto fala.
_Avoid_: lição, tutorial

**Fala**:
Um turno da pessoa, por voz ou chat, que a Puca precisa encaminhar.
_Avoid_: mensagem, input

**Ponte**:
Frase curta que a Puca diz na hora enquanto prepara uma resposta mais longa.
_Avoid_: filler, enrolação

**Pulo**:
Pedido da pessoa para mudar de assunto; sempre leva ao início de um momento.
_Avoid_: atalho, desvio

**Encaminhamento**:
Quando a Puca admite que não achou fonte confiável e leva a dúvida, com contexto, ao buddy ou responsável.
_Avoid_: escalonamento, fallback

## Jornada

**Jornada**:
O roteiro de uma aula: momentos, passos e quadros. É o contrato que a Puca segue.
_Avoid_: trilha, fluxo, script

**Momento**:
Um capítulo da jornada, com um objetivo único.
_Avoid_: etapa, seção, fase

**Passo**:
Uma fala ou ação da Puca dentro de um momento.
_Avoid_: step, item

**Objetivo**:
O que um momento ou passo quer alcançar; não é falado, serve para a Puca se localizar.
_Avoid_: meta

**Conhecimento**:
Contexto extra de um passo ou momento, usado só se a pessoa perguntar.
_Avoid_: contexto, base

**Resposta sugerida**:
Opção pronta que a pessoa pode escolher num passo que espera resposta.
_Avoid_: botão, opção

**Transição**:
Regra que escolhe para onde a jornada vai depois de um passo. (Não confundir com o vínculo de mesmo nome.)

## Quadro

**Quadro**:
A vista visual que a Puca monta progressivamente durante a aula.
_Avoid_: diagrama, whiteboard

**Nó**:
Um item do quadro: serviço, fila, pessoa, time, documento, tarefa.
_Avoid_: caixa, card, componente

**Cartão do nó**:
O detalhe de um nó: função, time, responsável, fontes e ADR.
_Avoid_: popup, tooltip

**Evidência**:
O grau de confiança de uma ligação ou informação: provado ou inferido.
_Avoid_: certeza

**Caixa preta**:
Nó sem documentação confirmada.

## Fontes

**Fonte**:
De onde vem uma informação (ADR, Notion, docs, código), ordenada por confiança.
_Avoid_: documento, referência

**ADR**:
Registro de uma decisão técnica do time e do porquê dela.

## Avaliação

**Tail**:
A empresa fictícia onde se passam a demo e o teste dos jurados.
_Avoid_: empresa de exemplo, empresa mock

**Kit da Tail**:
Os materiais falsos, mas realistas, da Tail (repos, código, ADRs, Notion, políticas, organograma). É a fonte da Puca e a prova que o jurado confere.
_Avoid_: mock, dados fake, dataset

**Guia de uso**:
O que acompanha o kit para o jurado: quem ele é na história, como escolher o perfil, onde estão os materiais e o que vale tentar.
_Avoid_: manual, tutorial

**Jurado**:
Quem avalia o Orbis no hackathon. Vive a pessoa: escolhe o perfil e passa pela jornada.
_Avoid_: avaliador, juiz

## Negócio

**Integração**:
O que a empresa compra: uma pessoa entrando num contexto de destino, como novo ou em transição. É a unidade de cobrança. (Não confundir com a conexão com sistemas, como Slack, Jira ou GitHub.)
_Avoid_: jornada (é o roteiro da aula), licença, assento

**Piloto**:
Primeira contratação paga, curta e com poucas integrações, que termina numa decisão de continuar, ajustar ou encerrar.
_Avoid_: teste grátis, prova de conceito
