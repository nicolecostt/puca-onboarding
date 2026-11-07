# Puca — agente de IA para onboarding e transição entre equipes

> **Em uma frase:** Puca transforma o conhecimento disperso de uma organização em uma experiência de integração guiada, visual e personalizada, ajudando pessoas a se adaptarem a novos contextos de trabalho.

## Sumário

1. [Visão geral do produto](#1-visão-geral-do-produto)
2. [Problema que queremos resolver](#2-problema-que-queremos-resolver)
3. [Cenários principais de uso](#3-cenários-principais-de-uso)
4. [Funcionalidades centrais e oportunidades de inovação](#4-funcionalidades-centrais-e-oportunidades-de-inovação)
5. [Visibilidade para buddy, gestor e RH](#5-visibilidade-para-buddy-gestor-e-rh)
6. [Contexto corporativo e cultura organizacional](#6-contexto-corporativo-e-cultura-organizacional)
7. [Demonstração dos dois perfis](#7-demonstração-dos-dois-perfis)
8. [Proposta de valor](#8-proposta-de-valor)
9. [Direcionamento do produto](#9-direcionamento-do-produto)
10. [Complementos do alinhamento com Joaquim](#10-complementos-do-alinhamento-com-joaquim)
11. [Posicionamento: Sana Learn como referência e foco em just-in-time learning](#11-posicionamento-sana-learn-como-referência-e-foco-em-just-in-time-learning)
12. [Encaixe no Desafio Tako: a Puca como digital worker de onboarding](#12-encaixe-no-desafio-tako-a-puca-como-digital-worker-de-onboarding)
13. [Modelo de negócio: quem compra e como cobramos](#13-modelo-de-negócio-quem-compra-e-como-cobramos)

---

## 1. Visão geral do produto

Puca é um agente de inteligência artificial projetado para auxiliar profissionais durante a **entrada em uma empresa** ou a **transição entre equipes**, oferecendo uma experiência de integração personalizada, interativa e contextualizada.

A proposta é atuar como um **mentor digital** que acompanha o profissional nos primeiros passos, ajudando-o a compreender:

- a cultura da organização;
- os processos internos;
- as pessoas responsáveis por cada atividade;
- e, especialmente em equipes de tecnologia, a arquitetura, os sistemas e as decisões técnicas do time.

Diferentemente de chatbots corporativos tradicionais, que normalmente respondem perguntas com base em documentos, Puca busca **transformar o conhecimento organizacional em uma experiência de aprendizado guiado**.

**Principal diferencial:** uma interface visual e interativa, na qual o agente explica conceitos, constrói mapas de conhecimento, destaca conexões e adapta a explicação conforme as dúvidas e o nível de familiaridade de cada profissional.

> O objetivo **não** é substituir o buddy, o gestor ou os profissionais mais experientes, mas reduzir o trabalho repetitivo de explicação, facilitar o acesso ao conhecimento e permitir que essas pessoas se concentrem nas interações que realmente exigem acompanhamento humano.

---

## 2. Problema que queremos resolver

A entrada ou mudança de equipe costuma depender de conhecimento distribuído entre diversas fontes: documentos no Notion, repositórios, registros de decisões técnicas, mensagens, apresentações, políticas internas e conversas com profissionais experientes.

Isso gera alguns problemas:

- Informações fragmentadas e difíceis de localizar.
- Dependência de colegas mais experientes para responder dúvidas recorrentes.
- Documentação que nem sempre esclarece como os processos funcionam na prática.
- Dificuldade em identificar as pessoas responsáveis por cada sistema ou atividade.
- Jornadas de integração pouco adaptadas à experiência prévia do profissional.
- Falta de visibilidade para gestores, buddies e RH sobre etapas concluídas e dificuldades que exigem intervenção.

Além disso, **quem muda de equipe enfrenta parte desses desafios novamente**, mesmo já conhecendo a empresa.

Puca busca resolver esses problemas com um agente que reúne o contexto disponível, personaliza a jornada e transforma as informações relevantes em explicações compreensíveis e visualmente navegáveis.

---

## 3. Cenários principais de uso

### Cenário A — Novo funcionário

Um profissional acaba de entrar na empresa.

1. Puca começa identificando **cargo, equipe, responsabilidades e conhecimentos prévios**, a partir do processo de admissão da própria equipe.
2. Faz uma **call inicial** com o funcionário: onboarding cultural e extração de informações importantes sobre a pessoa.
3. A partir dessas informações, **organiza uma jornada de integração**.

O agente pode apresentar:

- Cultura, valores, missão e principais diretrizes da empresa.
- Estrutura organizacional e funcionamento da equipe.
- Processos internos, ferramentas e rituais de trabalho.
- Pessoas de referência, buddy e gestor.
- Sistemas, repositórios e arquitetura técnica, conforme a função.
- Primeiras tarefas e objetivos de aprendizagem.

Essa jornada é **mais abrangente**, pois o profissional ainda precisa conhecer o ambiente corporativo e técnico.

### Cenário B — Funcionário em transição interna

Um profissional que já trabalha na empresa está mudando de equipe, projeto ou área de atuação.

Puca reconhece que ele já conhece a organização e **evita repetir conteúdos introdutórios desnecessários**. O foco fica nas diferenças entre o contexto anterior e o novo:

- Responsabilidades da nova equipe.
- Novos gestores, buddies e pessoas de referência.
- Ferramentas e processos específicos do time.
- Repositórios, sistemas e arquitetura ainda desconhecidos.
- Decisões técnicas e práticas adotadas pela equipe.
- Primeiras atividades dentro da nova função.

A jornada é **mais curta e direcionada**, sem repetir a apresentação institucional completa. Ainda assim, particularidades culturais do novo time (rituais, combinados e formas de colaboração) continuam relevantes.

> **Diferencial:** Puca não oferece a mesma experiência para todos — considera o histórico e a necessidade de cada profissional.

---

## 4. Funcionalidades centrais e oportunidades de inovação

### 4.1. Aula visual e interativa em tempo real

> ⭐ **Principal funcionalidade a demonstrar no hackathon.**

O profissional conversa com Puca por **texto ou voz** e, conforme o agente explica um assunto, **um quadro visual é construído ou atualizado**.

**Exemplo.** Um novo desenvolvedor pergunta:

> “Como funciona o processamento de pagamentos da nossa aplicação?”

Puca apresenta o fluxo geral, mostrando o frontend, o serviço de pagamentos e as demais dependências relevantes. Enquanto explica, destaca componentes, apresenta conexões e revela novas partes do sistema.

Se o usuário perguntar:

> “O que acontece quando o pagamento falha?”

o agente direciona a explicação para essa etapa, destaca os componentes envolvidos e apresenta documentos ou trechos de código que sustentam a resposta.

Pontos importantes:

- O funcionário não apenas **lê** uma explicação: ele **visualiza** o funcionamento do sistema e navega pelo conhecimento apresentado.
- A experiência também funciona com informações **não técnicas**, como estrutura de equipes, fluxos de aprovação, processos internos ou responsabilidades entre departamentos.
- O quadro é construído **progressivamente**, acompanhando o raciocínio do agente e permitindo perguntas a qualquer momento.

### 4.2. Aprendizado ativo e personalizado

Puca não deve só explicar conteúdos: deve também verificar, de forma **leve e interativa**, se o usuário compreendeu os conceitos principais.

Durante uma sessão, o agente pode perguntar:

> “Qual serviço você acha que deveria investigar primeiro se essa operação falhasse?”

O usuário pode responder por **texto, voz ou selecionando um componente do quadro**. Com base na resposta, Puca pode:

- Confirmar o entendimento com evidências.
- Explicar novamente um conceito.
- Apresentar um exemplo mais simples.
- Aprofundar a explicação.
- Sugerir o próximo assunto relevante.

Isso aproxima a experiência de uma **mentoria individualizada**, e não de uma documentação estática.

> O objetivo **não** é dar nota de desempenho ao funcionário, mas identificar quais assuntos já foram trabalhados e quais ainda precisam de esclarecimento.

### 4.3. Conexão entre conhecimento técnico e organizacional

Puca conecta **como os sistemas funcionam** com **como as pessoas e equipes trabalham**.

Um mapa técnico pode apresentar serviços, APIs, dependências e fluxos. Ao selecionar um componente, o usuário também encontra:

- A função daquele serviço.
- Documentos relacionados.
- Decisões arquiteturais que justificam sua existência.
- Equipe responsável.
- Pessoas de referência, quando confirmadas.
- Procedimentos para solicitar ajuda.

**Exemplo.** Ao explicar um fluxo de autorização de pagamentos, Puca pode mostrar tanto a arquitetura envolvida quanto a decisão arquitetural (ADR) que explica por que aquele mecanismo foi escolhido. Se o usuário quiser conversar com alguém sobre a decisão, o agente indica o responsável registrado na documentação.

> Quando não houver fonte confiável, Puca deve deixar **explícito** que não conseguiu confirmar a informação e indicar uma conversa com o buddy.

### 4.4. Do aprendizado à primeira tarefa

Funcionalidade prevista para a evolução do produto: conectar o aprendizado às **primeiras atividades reais** do profissional.

Depois de explicar os sistemas e processos da equipe, o agente identifica uma tarefa adequada ao contexto e ao nível de experiência do usuário, a partir de atividades **previamente disponibilizadas ou aprovadas pelo time**.

**Exemplo.** Após uma aula sobre o fluxo de checkout, Puca apresenta uma issue relacionada a esse serviço e explica:

- Qual problema precisa ser resolvido.
- Por que essa atividade é importante.
- Quais sistemas ou processos estão relacionados.
- Onde encontrar as informações necessárias.
- Quem pode ajudar caso surja algum bloqueio.

Durante a atividade, o profissional pode voltar ao quadro e fazer perguntas relacionadas ao que está desenvolvendo. Puca vira uma **ponte entre a teoria e a prática**, e o profissional ganha autonomia mais rápido, sem depender de explicações repetitivas a cada nova atividade.

> **No hackathon:** pode ser demonstrada como uma primeira tarefa simulada e documentada no Notion. Não é preciso integração completa com Jira ou GitHub para validar a experiência.

### 4.5. Conhecimento contínuo e encaminhamento humano

Nem todas as dúvidas podem ser resolvidas automaticamente. Puca deve identificar **quando encaminhar o usuário a uma pessoa responsável**.

> “Não encontrei uma definição confirmada sobre essa política. A pessoa de referência indicada é a responsável de RH.”

O encaminhamento pode incluir:

- um resumo da dúvida;
- os documentos já consultados;
- o motivo pelo qual o agente não conseguiu resolver.

Assim, o funcionário não precisa explicar toda a situação de novo.

No futuro, respostas confirmadas por especialistas poderão ser incorporadas à base de conhecimento, **mediante autorização e validação**. Dessa forma, Puca não só usa o conhecimento existente, como também ajuda a documentar e reaproveitar dúvidas recorrentes.

> **No hackathon:** essa incorporação passou a ser uma entrega opcional, condicionada ao tempo disponível. Ver [§10.2](#102-incorporação-de-respostas-à-base--opcional-no-hackathon).

---

## 5. Visibilidade para buddy, gestor e RH

Além da experiência do funcionário, queremos dar visibilidade às pessoas responsáveis pela integração, com **painéis diferentes por papel**, respeitando as necessidades e permissões de cada um.

| Papel | O que acompanha |
|---|---|
| **Buddy** | Etapas de orientação concluídas, assuntos que ainda exigem suporte e pedidos de ajuda encaminhados a ele. |
| **Gestor** | Marcos da integração, acessos pendentes, objetivos iniciais e possíveis bloqueios que dependam de decisões da equipe. |
| **RH** | Etapas obrigatórias, pendências administrativas e indicadores agregados das jornadas de onboarding e transição. |

**Exemplos de métricas:**

- Percentual de etapas concluídas.
- Tarefas ou acessos pendentes.
- Sessões de orientação realizadas.
- Solicitações de suporte ainda abertas.
- Assuntos que frequentemente geram dúvidas.
- Tempo até a conclusão de marcos previamente definidos.
- Feedback do funcionário sobre a experiência.

> ⚠️ **Privacidade e confiança**
> - Esses indicadores **não** devem ser apresentados como medidas automáticas de produtividade ou competência.
> - **Não** é necessário mostrar transcrições privadas ou todas as perguntas do funcionário para gestores e RH.
> - A ideia é dar visibilidade sobre o **processo de integração**, e não criar um sistema de vigilância sobre o profissional.

---

## 6. Contexto corporativo e cultura organizacional

Queremos ampliar Puca para além da engenharia de software, **sem perder o onboarding técnico como principal caso de uso inicial**.

O mesmo mecanismo de explicação interativa pode apresentar:

- Estrutura e cultura da organização.
- Valores e práticas de trabalho.
- Processos de comunicação.
- Políticas e procedimentos internos.
- Ferramentas utilizadas pelas equipes.
- Responsabilidades e fluxos entre setores.

**Exemplos de perguntas:**

> “Como funciona o processo de solicitação de férias?”

Puca explica o procedimento com base na documentação oficial, indica as etapas envolvidas e aponta onde fazer a solicitação.

> “Qual é a diferença entre as responsabilidades do meu gestor e do meu buddy?”

O agente apresenta os papéis de cada pessoa a partir da política interna da empresa.

> O contexto corporativo deve **complementar**, e não substituir, a proposta visual e interativa que diferencia o produto.

---

## 7. Demonstração dos dois perfis

Para mostrar a personalização, usamos **uma única empresa fictícia com dois perfis**.

| | Perfil 1 — Novo contratado | Perfil 2 — Mudando de equipe |
|---|---|---|
| **Situação** | Está começando na empresa. | Já conhece a organização, mas está migrando para uma nova equipe de tecnologia. |
| **O que Puca faz** | Apresenta informações institucionais, explica quem é o gestor, introduz os processos e depois inicia uma aula técnica sobre o sistema. | Pula a apresentação institucional básica, identifica o novo contexto, apresenta os responsáveis e vai direto para os sistemas e práticas do time. |

Esses cenários mostram que o agente **não executa uma trilha fixa**: ele usa o contexto e o histórico disponíveis para decidir quais informações são relevantes.

A apresentação pode ser complementada com um **painel simples** mostrando o acompanhamento de cada jornada por buddy, gestor ou RH.

---

## 8. Proposta de valor

| Para quem | Valor |
|---|---|
| **Funcionário** | Menos tempo procurando informações, mais clareza sobre processos e responsabilidades e uma jornada adaptada ao que realmente precisa aprender. |
| **Buddies e gestores** | Menos explicações introdutórias repetidas, visibilidade sobre pendências e mais tempo para orientação especializada. |
| **Empresa e RH** | Integração mais estruturada, reaproveitamento do conhecimento organizacional e acompanhamento da evolução do onboarding e da transição com indicadores objetivos. |

> Esses benefícios ainda são **hipóteses de produto** e devem ser avaliados com testes com usuários.

---

## 9. Direcionamento do produto

Puca deve ser posicionada como um **agente de integração e aprendizagem contextual**, e não apenas como um chatbot de documentação ou uma ferramenta para gerar diagramas.

O diferencial está na combinação de:

- **Personalização** da jornada;
- **Aprendizado visual** e interativo;
- **Contexto corporativo e técnico** conectados;
- **Encaminhamento humano** quando necessário;
- **Acompanhamento** da jornada.

**Visão de longo prazo:** permitir que qualquer profissional, novo na organização ou mudando de equipe, compreenda mais rapidamente seu ambiente, suas responsabilidades e os conhecimentos necessários para começar a contribuir.

---

## 10. Complementos do alinhamento com Joaquim

### 10.1. Call inicial e conhecimento prévio

A call inicial é o momento de identificar **o que a pessoa já conhece**, suas experiências, necessidades e objetivos, combinando a conversa com as informações disponíveis sobre cargo e equipe. Esse diagnóstico orienta a trilha, a profundidade das explicações e os próximos passos, e pode ser atualizado durante o acompanhamento.

| Perfil | Foco da call inicial |
|---|---|
| **Entrando na empresa** | Combina acolhimento e onboarding cultural com o levantamento do repertório técnico e das necessidades da função. |
| **Saindo de um time e entrando em outro** | Considera o contexto anterior, confirma os conhecimentos que podem ser aproveitados e investiga as diferenças do novo time: sistemas, responsabilidades, pessoas, práticas e rituais. A jornada é ajustada a partir dessa conversa. |

### 10.2. Incorporação de respostas à base — opcional no hackathon

O plano inclui a possibilidade de incorporar à base de conhecimento **respostas confirmadas por especialistas**, aproveitando a solução que João está desenvolvendo. Essa funcionalidade é uma **entrega opcional do hackathon**, condicionada ao tempo disponível.

Fluxo previsto:

1. Puca identifica uma lacuna.
2. Encaminha a dúvida, com contexto, ao responsável.
3. Depois que a resposta é validada e autorizada para reutilização, registra o conhecimento com sua fonte e contexto.
4. Em uma dúvida futura, reutiliza essa resposta e indica sua origem.

> **Prioridade:** a experiência principal de tutoria visual, personalizada e acompanhada vem primeiro. A incorporação à base entra como complemento se houver tempo.

---

## 11. Posicionamento: Sana Learn como referência e foco em just-in-time learning

A partir das capturas da página de onboarding da Sana Learn compartilhadas por Joaquim, a intenção é buscar **pelo menos uma cobertura equivalente** das funcionalidades apresentadas, concentrando o principal esforço de diferenciação do Puca em **just-in-time learning**: aprender no momento em que a necessidade surge.

### 11.1. Capacidades de referência para o produto

| Capacidade | O que significa no Puca |
|---|---|
| **Enrollment** | Iniciar e associar a pessoa à jornada adequada a partir de sua entrada, função e data de início. No Puca, considerar também transições internas. |
| **Personalização** | Adaptar a jornada ao cargo, time, conhecimentos prévios e ritmo. A call inicial orienta essa adaptação, que evolui nas interações seguintes. |
| **Criação e atualização de conteúdo** | Apoiar especialistas na organização e no compartilhamento do conhecimento com IA, aproveitando documentação, ADRs e codebase. |
| **Pré-onboarding** | Oferecer materiais de boas-vindas, contatos relevantes, expectativas e preparação para a primeira semana antes do início. |
| **Acompanhamento do progresso** | Apresentar marcos, etapas, pendências e necessidades de suporte, com visões adequadas para funcionário, buddy, gestor e RH. |
| **Sessões e conexão com pessoas** | Considerar a criação e organização de encontros ao vivo, presenciais ou híbridos, para integração cultural e contato com o time. |
| **Just-in-time learning** | Permitir que o funcionário procure o tutor quando surgir uma dúvida e receba orientação contextualizada, sustentada no conhecimento da empresa. |

### 11.2. Principal aposta de diferenciação

Na referência compartilhada, a Sana descreve seu AI Tutor oferecendo respostas em linguagem natural com citações do conhecimento da empresa. O Puca pretende aprofundar essa experiência, especialmente em **onboarding técnico**, com:

- conversa por voz ou texto conectada a uma **lousa visual interativa**;
- construção progressiva de mapas e explicações sobre arquitetura, fluxos e decisões técnicas;
- possibilidade de **interromper, explorar uma dúvida e retomar** a explicação;
- adaptação ao conhecimento identificado na call inicial e nas sessões anteriores;
- consulta a ADRs, código e documentação para sustentar explicações e permitir aprofundamento;
- verificação leve de compreensão e atualização dos objetivos de aprendizagem a partir da própria conversa;
- encaminhamento contextualizado ao especialista quando faltar informação confiável;
- incorporação de respostas confirmadas à base como entrega opcional, se der tempo, aproveitando o trabalho de João ([§10.2](#102-incorporação-de-respostas-à-base--opcional-no-hackathon)).

> **Exemplo:** durante uma tarefa, a pessoa pergunta o que acontece quando um pagamento falha. Puca usa o contexto do time para explicar o fluxo visualmente, destaca os componentes envolvidos, apresenta a decisão arquitetural relevante e adapta a explicação conforme as dúvidas e respostas da pessoa.

### 11.3. Direção de produto e prioridade de execução

A cobertura equivalente se refere às capacidades mostradas nas imagens e representa um **objetivo de produto**. O escopo efetivamente entregue no hackathon precisa ser priorizado, com destaque para a **tutoria contextual, visual e interativa no momento da necessidade**.

> **Hipótese competitiva:** oferecer uma experiência superior nesse uso específico. As capturas descrevem a oferta da Sana, mas não bastam para concluir que ela não tenha capacidades adicionais semelhantes. Essa diferenciação deverá ser verificada comparando produtos e testando com usuários.

---

## 12. Encaixe no Desafio Tako: a Puca como digital worker de onboarding

O Desafio Tako pede um **digital worker**: um agente com papel definido que *"executa um processo de ponta a ponta, em vez de só responder perguntas"*, opera os sistemas que o time já usa (Slack, entre outros) e *"chama um humano quando sai do roteiro"*. **Admissão e onboarding** é uma das frentes listadas pela Tako.

Se a Puca só responder dúvidas, ela fica na categoria de chatbot do próprio guia, e não na de digital worker. Para encaixar no desafio, ela precisa **receber um objetivo e conduzir a integração inteira**, agindo nos sistemas do time e envolvendo pessoas só onde elas são necessárias.

### 12.1. O processo que a Puca conduz

| # | O que a Puca faz | O que isso mostra | Onde o humano entra |
|---|---|---|---|
| 1 | Na **call inicial**, levanta o que a pessoa já sabe, registra a calibragem e **monta a jornada dela** ([§10.1](#101-call-inicial-e-conhecimento-prévio)). | O agente planeja a partir de um objetivo. | — |
| 2 | Conduz a **aula** no quadro, seguindo a jornada e respondendo na hora ao que a pessoa diz: perguntas, pulos e interrupções. | O agente executa e se adapta, sem roteiro fixo. | — |
| 3 | Faz uma **checagem leve de entendimento** e atualiza os objetivos que ainda faltam. | O agente acompanha o resultado do próprio trabalho. | — |
| 4 | Quando falta fonte confiável, faz o **encaminhamento** ao buddy no Slack, com a dúvida, as fontes já consultadas e o motivo de não ter respondido ([§4.5](#45-conhecimento-contínuo-e-encaminhamento-humano)). | O agente trata a exceção e passa para um humano *"com o contexto pronto para decidir"*. | O buddy responde ou indica o responsável. |
| 5 | Entrega a **primeira tarefa** ([§4.4](#44-do-aprendizado-à-primeira-tarefa)) e informa o andamento ao buddy e ao gestor ([§5](#5-visibilidade-para-buddy-gestor-e-rh)). | O processo fecha, da entrada à primeira atividade real. | O gestor aprova a tarefa e acompanha os marcos. |

### 12.2. O que precisa aparecer na demo

- **Agir num sistema, não só falar.** O encaminhamento do passo 4 precisa acontecer de fato no Slack simulado da tela `live-session`. O guia aceita integrações simuladas *"desde que o agente realmente opere sobre elas na demo"*.
- **Rastro.** Cada decisão da Puca (o que respondeu, de qual fonte, quando encaminhou e por quê) fica registrada e pode ser auditada depois.
- **Custo.** Mostrar quanto custa uma sessão em tempo e tokens, comparado com as horas que o buddy gastaria explicando a mesma coisa.

> **Limites que o desafio impõe:** decisões sobre pessoas ficam com humanos, e a demo usa só dados sintéticos. A calibragem e o andamento descrevem o processo de integração, e não avaliam o desempenho da pessoa (ver o aviso de privacidade em [§5](#5-visibilidade-para-buddy-gestor-e-rh)).

---

## 13. Modelo de negócio: quem compra e como cobramos

> Pesquisa e alinhamento de Joaquim em 2026-11-07. Mercado, métricas, evidências externas e fontes: [`docs/negocio/contexto-de-negocio.md`](docs/negocio/contexto-de-negocio.md).

A Puca é vendida para empresas (B2B): **a empresa compra e o RH aprova**. A entrada é um **piloto** pago e pequeno, que vira contrato anual medido em **integrações**.

### 13.1. Quem compra e quem participa

| Papel | No modelo |
|---|---|
| **Empresa** | Contrata e paga. |
| **RH** | Aprova a compra e acompanha o valor para a integração. Ninguém substitui o RH como aprovador por inferência. |
| **Gestor e engenharia** | Ajudam a definir tarefas, contexto e qualidade esperada. |
| **Buddy** | Orienta quando precisa e mostra onde há repetição ou bloqueio. |
| **TI e segurança** | Participam das integrações de sistemas e da avaliação de acessos, quando for o caso. |
| **Pessoa** | Usa a Lousa para aprender e fazer as primeiras tarefas. |

Foco inicial: empresas com times de tecnologia, contratações ou mudanças de time recorrentes e conhecimento espalhado em várias fontes. Não há corte de tamanho definido. Grandes empresas são um bom começo, não um limite.

Os dois vínculos, novo e transição ([§3](#3-cenários-principais-de-uso)), fazem parte da proposta e aparecem na demo.

### 13.2. Como cobramos

- **Unidade:** a integração, ou seja, uma pessoa entrando num contexto de destino. Novo e transição consomem o **mesmo saldo**, com o mesmo preço, até os dados mostrarem diferença de custo ou de valor.
- **Piloto pago:** preço e número de integrações menores que no contrato anual. Padrão de partida: **60 dias de uso**, contados depois que fontes e acessos estão disponíveis, em uma equipe. Revisão no meio e revisão comercial no fim.
- **Contrato anual:** volume de integrações com **quantidade mínima**.
- **Implantação:** a equipe já está trabalhando nela. Uma taxa separada só será proposta se o esforço observado justificar.

O piloto vira contrato anual quando três coisas acontecem juntas:

1. **Valor observado:** melhora em 1 ou 2 métricas combinadas antes do piloto, sem piorar a qualidade das tarefas nem esconder esforço.
2. **Uso e viabilidade:** as pessoas usam o fluxo, o contexto é utilizável e o esforço de implantação é aceitável.
3. **Continuidade:** o RH aprova e há volume futuro que justifique o mínimo anual.

Sem informação suficiente, a decisão é explícita: encerrar, corrigir o escopo ou estender o piloto em acordo. Não há conversão automática nem piloto gratuito indefinido.

### 13.3. O que prometemos

- **Resultado principal:** menos tempo bloqueado por falta de contexto e menos explicação repetida para buddies e gestores ([§8](#8-proposta-de-valor)).
- **Efeito a acompanhar, não promessa:** retenção e experiência nos primeiros 90 dias.
- **Métricas do piloto:** tempo até autonomia, tempo bloqueado por contexto, esforço do buddy, qualidade das tarefas, clareza de papel e uso efetivo. Escolher 1 ou 2 por piloto.

> ⚠️ **Sem medição própria, não afirmamos:** redução percentual de tempo ou de turnover, ausência de concorrência, preço validado, margem conhecida ou clientes na lista de empresas pesquisadas. A lista completa está no doc de negócio.

### 13.4. Em aberto

- Preço por integração. Os R$ 900 do exercício de mercado são só uma premissa.
- Quantidade mínima do contrato anual e forma de pagamento (antecipado ou parcelado).
- O que uma integração cobre: duração, reabertura, troca de contexto, excedentes e validade do saldo.
- Custos e margem: só depois da implementação, a partir do custo medido da sessão (#52).

