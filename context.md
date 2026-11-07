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
