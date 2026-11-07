# Contexto de negócio da Puca

> Pesquisa de Joaquim, consolidada em 2026-11-07. Fontes e números conferidos na mesma data.
> As decisões (quem compra, como cobramos, o que prometemos) estão no [`PRODUCT.md` §14](../../PRODUCT.md#14-modelo-de-negócio-quem-compra-e-como-cobramos). Aqui ficam o detalhe, o mercado e as evidências.

Estágio: hackathon, MVP em construção. Este documento não comprova funcionalidade pronta, resultado de cliente nem viabilidade econômica.

## 1. Como ler

Cada afirmação tem uma destas etiquetas:

- **Decisão:** direção escolhida pelo time.
- **Proposta:** recomendação para tornar uma decisão executável, a ajustar com clientes.
- **Hipótese:** depende de validação comercial ou operacional.
- **Evidência externa:** resultado de uma pesquisa, válido para a população e o método dela.

Não transforme hipótese em decisão, interesse verbal em venda, funcionalidade planejada em pronta, nem evidência externa em resultado da Puca.

## 2. A dor, por quem sente

O problema geral está no [`PRODUCT.md` §2](../../PRODUCT.md#2-problema-que-queremos-resolver). Do ponto de vista de quem paga:

- **Pessoa:** acha a informação, entende sistemas, responsáveis e decisões antigas, separa o que vale para o trabalho dela e avança sem esperar alguém ficar livre.
- **Buddy e gestor:** reexplicam o que já foi explicado, param o que estão fazendo para responder dúvidas recorrentes e não sabem onde a pessoa travou.
- **RH:** quer ver a adaptação além do checklist, perceber dificuldade cedo, padronizar o essencial sem ignorar diferenças entre funções e apoiar a mobilidade interna sem refazer tudo a cada mudança.

Nem toda conversa com o buddy é desperdício: feedback, acolhimento e decisões continuam humanos. A tese é cortar a repetição e direcionar melhor o apoio humano.

## 3. Piloto: como conduzir (proposta)

Combinar no início com o RH e com o responsável operacional:

- participantes e vínculo (novo ou transição);
- tarefas representativas e critério de qualidade;
- fontes e integrações de sistemas incluídas;
- limites de uso e de suporte;
- como medir a situação anterior ou um grupo comparável;
- quem participa da revisão final e quando.

Os prazos (60 dias, revisão no meio, revisão no fim) são recomendação de operação, não dado de pesquisa. Não adotar uma meta universal de redução de tempo sem linha de base: a meta é combinada antes, com método, amostra e limites registrados. A aprovação do RH conta, mas não é experimento causal.

Antes de vender o contrato anual, definir o que uma integração cobre: duração, reabertura, troca de contexto (pode virar uma integração nova), excedentes e validade do saldo. Nada disso está decidido: não inventar multa, renovação automática ou franquia.

## 4. Métricas do piloto (proposta)

| Métrica | Definição sugerida | Cuidado |
| --- | --- | --- |
| Tempo até autonomia | Dias até completar tarefas definidas antes com o nível de apoio combinado | Comparar tarefas e perfis parecidos |
| Tempo bloqueado por contexto | Tempo sem avançar por falta de informação ou resposta | Separar bloqueio técnico e dependência fora do escopo |
| Esforço do buddy | Horas de apoio por integração e tipo de dúvida | Nem toda interação humana é desperdício |
| Qualidade | Aceitação, retrabalho ou critério do gestor sobre a tarefa | Velocidade sem qualidade não é sucesso |
| Clareza de papel | Perguntas fixas sobre responsabilidades, expectativas e próximos passos | Percepção complementa, não substitui o resultado da tarefa |
| Uso efetivo | Pessoas que fazem atividades úteis com a Puca | Número de mensagens não prova valor |

Escolher 1 ou 2 por piloto. Retenção em 90 dias e produtividade anual interessam, mas amostra pequena e fatores externos dificultam atribuir a mudança à Puca: um piloto de 60 dias pode ser seguido de observação aos 90, sem prometer a resposta no fim do piloto. Não usar commits ou linhas de código como medida única de produtividade.

### 4.1. Conta econômica (quando houver dados)

```
valor do tempo de apoio liberado = horas de apoio reduzidas × custo-hora aplicável
benefício líquido estimado = benefícios medidos − preço da Puca − esforço extra de implantação e operação
```

Tempo liberado não é corte de folha nem de caixa. Não contar duas vezes o ganho de autonomia e as horas do buddy. Não converter estatística de pesquisa em economia garantida para um cliente.

## 5. Custos (depois da implementação)

**Decisão:** apurar custos depois de implementar. Não inventar margem, custo por pessoa, CAC, LTV ou retorno agora.

Quando medir, registrar: inferência do LLM, voz, recuperação e indexação, armazenamento, execução de ferramentas, infraestrutura, observabilidade, suporte e implantação. Separar o custo por integração, por cliente e compartilhado, e comparar novo com transição. O ponto de partida é o custo da sessão em tempo e tokens (#52). Margem positiva por integração não é lucro da empresa: aquisição e desenvolvimento entram na conta total.

## 6. Mercado: cenários exploratórios

TAM é a oportunidade anual teórica no recorte modelado. SAM é a parte compatível com o foco e a geografia iniciais. SOM é a receita capturável com clientes e volume definidos. O custo total da dor não é o tamanho do mercado de software, e o gasto mundial com treinamento não é todo capturável. Não somar mercados que se sobrepõem (LMS e treinamento corporativo).

Fórmula: `profissionais na base × parcela elegível × integrações por profissional por ano × preço por integração`.

| Premissa | Valor | Situação |
| --- | --- | --- |
| Parcela elegível (global) | 40% | Hipótese de recorte |
| Parcela elegível (Brasil) | 20% | Hipótese de recorte, diferente da global |
| Integrações por profissional/ano | 0,25 | Hipótese: 25 integrações por 100 profissionais/ano; não é taxa observada |
| Preço por integração | R$ 900 | Hipótese de preço, não é tabela aprovada |

### 6.1. TAM (global, desenvolvedores profissionais)

`36,5 mi × 40% × 0,25 × R$ 900 ≈ R$ 3,29 bi/ano`

> **Corrigido em 2026-11-07:** a pesquisa usava 38,4 milhões de desenvolvedores, número sem fonte localizada (o mais próximo, 38,3 mi, são contas do GitHub nos EUA, outra medida). A base agora é a SlashData: 36,5 mi de desenvolvedores profissionais no início de 2025 (47,2 mi contando não profissionais). Com a base total, o TAM seria ≈ R$ 4,25 bi.

Preço único em reais para o mundo simplifica o exercício e ignora país, moeda e poder de compra.

### 6.2. SAM (Brasil, software, serviços e TI interna)

`1,40 mi × 20% × 0,25 × R$ 900 ≈ R$ 63 mi/ano`

> **Corrigido em 2026-11-07:** a pesquisa usava 1,44 mi de "profissionais CLT", sem fonte localizada. A base agora é a Brasscom (Monitor de Empregos, a partir de RAIS/CAGED): 1.403.318 profissionais de software, serviços de TI e TI interna em fev/2024. Essa conta inclui todos os vínculos, não só CLT. Como a base não é subconjunto da global (ocupações e anos diferentes), o SAM não é um recorte rigoroso do TAM.

### 6.3. SOM (24 meses)

`15 clientes × 60 integrações/ano × R$ 900 = R$ 810 mil/ano`

São 900 integrações por ano e R$ 54 mil por cliente. É receita anualizada ao atingir essa escala, não receita acumulada em 24 meses. 60 integrações não é o mínimo comercial decidido, e 15 clientes não vem de pipeline existente.

TAM e SAM variam na mesma proporção que preço, elegibilidade e frequência; o SOM, na mesma proporção que clientes, volume e preço. Precisão aritmética não é precisão da estimativa.

### 6.4. Tamanho das categorias vizinhas (só contexto, fora da conta)

- Treinamento corporativo no mundo: US$ 394,5 bi em 2025 (Training Industry, [Size of the Training Industry](https://trainingindustry.com/wiki/learning-services-and-outsourcing/size-of-training-industry/)).
- LMS: US$ 28,6 bi em 2025 (Grand View Research, relatório de 2026–2033; visto num revendedor, não na página do editor). Não misturar com a projeção antiga da mesma casa (US$ 70,8 bi em 2030).

## 7. Entrada no mercado

**Proposta:** venda feita pelos fundadores, a partir de contatos, conversando com o RH, delimitando a dor, mostrando a demo e fechando um piloto pago. Com valor observado, expandir volume ou equipes dentro da conta. Não há canal escalável nem ciclo de venda validado.

As empresas abaixo são alvos para investigar, não clientes, parceiros nem empresas com dor comprovada. Não supor número de funcionários, orçamento, ferramentas ou taxa de contratação delas sem pesquisa.

| Empresa | Abordagem a investigar |
| --- | --- |
| Stone | Uma equipe técnica, ou transição para outro contexto de produto |
| VTEX | Contexto técnico e de negócio numa equipe delimitada |
| Nubank | Contexto técnico e operacional, sujeito aos requisitos de acesso |
| iFood | Entrada ou mudança entre equipes com contextos distintos |
| Mercado Livre | Uma unidade ou equipe específica |
| TOTVS | Produto, sistemas e processos dentro de uma equipe |
| Hotmart | Contratações ou mudanças de equipe com tarefas concretas |
| PicPay | Integração técnica acompanhada por RH e gestor |
| Vercel | Referência internacional; fora do SAM brasileiro, acesso comercial não demonstrado |
| Tako | Conversa de descoberta a partir do contato de RH. A Tako também organiza o desafio do hackathon ([`PRODUCT.md` §12](../../PRODUCT.md#12-encaixe-no-desafio-tako-a-puca-como-digital-worker-de-onboarding)) |

**Exemplo de piloto (hipotético, Stone):** uma equipe e um responsável de RH; só fontes autorizadas (documentação de domínio, arquitetura, procedimentos, tarefas do piloto); atividades que mostrem autonomia e qualidade; comparação com integrações anteriores parecidas, quando houver. A Puca orienta, faz o encaminhamento do que não resolve e, no fim, o time revisa tempo bloqueado, esforço de apoio e resultado das tarefas. A continuidade depende do RH.

## 8. Concorrência

| Alternativa | Pergunta para comparar |
| --- | --- |
| LMS e aprendizagem corporativa (Sana Learn) | Até onde personaliza, acompanha a aplicação e usa contexto interno? |
| Busca e assistentes corporativos (Glean) | Além de achar a resposta, orienta a execução e a adaptação ao novo contexto? |
| Documentação e wikis internas | Quanto esforço custa achar, interpretar e atualizar? |
| Ferramentas de onboarding de RH | Cobrem administração, conteúdo, tarefas, acompanhamento e orientação contextual? |
| Buddy e gestor | O que exige um humano e o que se repete? |

São perguntas, não afirmações de que o concorrente não tem a funcionalidade. "Não encontrado" não é "inexistente".

**Sana Learn (conferido em 2026-11-07):** a [página de preços](https://sanalabs.com/products/sana-learn/pricing) não mostra valores. A cobrança é por usuário por mês, o plano "Built to scale" começa em 300 usuários e o Enterprise tem preço sob consulta. A página cita "an AI Tutor for every learner". A Sana tem oferta específica de [onboarding de funcionários](https://sanalabs.com/products/sana-learn/solutions/employee-onboarding): "Every new hire gets an AI tutor on day one." Isso confirma que a categoria já oferece tutor com IA para quem chega: o diferencial da Puca precisa estar na forma (voz com quadro, calibragem, encaminhamento, transição entre times), não em "ter IA". O "onboarding" do FAQ de preços é a implantação da própria Sana, não a integração de funcionários.

Integrações, RAG, agentes, voz e computer use são meios. Viram argumento comercial quando produzem um resultado útil, demonstrável e relevante para o RH e para a pessoa. Não alegar ausência de concorrência, melhor precisão, redução percentual de tempo, vantagem de dados ou barreira à cópia sem evidência. A comparação completa é a #43; o que a Lousa faz de verdade é a #74.

## 9. Validação que já temos

Conversas com pessoas sobre a dor, incluindo uma profissional de RH da Tako que reconheceu o problema e demonstrou interesse. É sinal qualitativo de dor e interesse. Não há contrato, piloto pago, preço aceito, receita, carta de intenção nem resultado medido. Não atribuir frases literais a ninguém sem a transcrição, e não usar nome, logo ou depoimento como endosso sem autorização.

## 10. Evidências externas

Sustentam o problema, não o resultado da Puca. Pesquisas de fornecedor têm interesse comercial; respostas voluntárias não representam todos os trabalhadores; correlação não é causa. Não empilhar estatísticas de fontes diferentes como se fossem a mesma amostra.

**Para o pitch, priorizar:** F07 (contexto na cabeça das pessoas), F08 (esperar resposta interrompe o trabalho), F03 (onboarding focado em administração) e F06 (clareza de papel cai nos primeiros meses, dado brasileiro).

| ID | Fonte | Dado | Limite |
| --- | --- | --- | --- |
| F01 | [Jobvite, Job Seeker Nation 2022](https://www.jobvite.com/blog/job-seekers-insights/) | 30% dos respondentes já deixaram um emprego nos primeiros 90 dias | O post não informa a base; não é 30% das admissões nem a maioria dos desligamentos |
| F02 | [Work Institute, Retention Report 2025](https://info.workinstitute.com/hubfs/2025%20Retention%20Report/2025%20Retention%20Report%20-%20Employee%20Retention%20Truths%20in%20Todays%20Workplace.pdf) | ~40% do turnover acontece no primeiro ano | Base: 123.297 entrevistas de desligamento nos EUA, 2019–2024; denominador são saídas, não contratados; um ano, não 90 dias |
| F03 | [BambooHR](https://www.bamboohr.com/resources/guides/onboarding-benchmarking) e [TalentLMS](https://www.talentlms.com/research/employee-onboarding-report), mesma pesquisa | 1.156 pessoas nos EUA (maio/2025) que começaram num emprego nos 12 meses anteriores: 52% dizem que o onboarding focou mais em tarefas administrativas que em treino prático; 42% sobrecarga de informação; 39% dúvidas sobre o emprego; 31% falta de interação ("human" na TalentLMS, "meaningful" na BambooHR); 73% satisfeitos | Autorrelato; citar a redação da página usada |
| F04 | [BambooHR, 2023](https://www.bamboohr.com/resources/data-at-work/data-stories/2023-onboarding-statistics) | 1.565 trabalhadores nos EUA (abril/2023), 500 de RH: 70% decidem no primeiro mês se o emprego serve; 44% sentiram arrependimento na primeira semana | Percepção não é desligamento |
| F05 | [Gallup](https://www.gallup.com/workplace/235121/why-onboarding-experience-key-retaining-new-hires.aspx) | Só 12% concordam totalmente que a empresa faz um ótimo onboarding | Dado antigo (≈2017–2018, a página não mostra data); não significa que 88% tiveram onboarding ruim |
| F06 | [Pin People, Panorama EX 2026](https://pinpeople.com.br/blog/experiencia-colaborador-panorama-ex-2026) | 139 empresas, 560 mil+ colaboradores, 1 mi+ respostas em 2025: do mês 1 ao 3, clareza de papéis cai 13 p.p. e conexões entre pessoas 12 p.p.; nos comentários sobre papéis e responsabilidades, 42,3% negativos contra 35,1% positivos | Não representa o país; pontos percentuais não são redução relativa |
| F07 | [Stack Overflow Survey 2026, Knowledge](https://survey.stackoverflow.co/2026/knowledge/data) | Barreiras para obter contexto (n=12.374, múltipla escolha): 63,2% informação incompleta; 60,9% na cabeça das pessoas; 56,5% desatualizada; 53,4% espalhada em ferramentas demais; 30,8% não sabe onde procurar; 26,1% decisões difíceis de achar depois. Tempo de busca (n=12.006): ≈75% gastam 5 h ou mais por semana | O 75% é a soma das faixas (a página não diz); busca não é toda desperdício; não somar percentuais de múltipla escolha |
| F08 | [Stack Overflow Survey 2024](https://survey.stackoverflow.co/2024/professional-developers) e [post do Stack Overflow Internal](https://stackoverflow.co/internal/resources/your-developers-deserve-better-insights-from-the-2024-developer-survey) | ~29 mil devs profissionais: 53% dizem que esperar resposta interrompe o fluxo; 30% (29,6%) sofrem com silos de conhecimento 10+ vezes por semana; mais de 60% gastam 30+ min/dia buscando respostas. O post diz que 3 em 4 respondem perguntas já respondidas | Use "mais de 60%": a página diz 61% e as faixas somam 63,8%. O "3 em 4" vem do post, não da página de resultados. Trabalho em geral, não só onboarding |
| F09 | [Atlassian, DevEx Report 2024](https://www.atlassian.com/blog/developer/developer-experience-report-2024) | 2.100+ devs e gestores: 69% dos devs perdem 8 h ou mais por semana com ineficiências | Muitas causas (inclusive dívida técnica); não é tudo onboarding |
| F10 | [Microsoft WorkLab, 2021](https://www.microsoft.com/en-us/worklab/strategies-for-onboarding-in-a-hybrid-world) | Com gestor ativo no onboarding, quem chega tem 3,5× mais chance de se dizer satisfeito e 1,2× mais de sentir que contribui para o time (people analytics da Microsoft) | Associação com percepção, não multiplicador de produtividade |
| F11 | [Yu et al., WWW '23](https://www.microsoft.com/en-us/research/publication/large-scale-analysis-of-new-employee-network-dynamics/) | Telemetria de comunicação de 10 mil+ pessoas que entraram na Microsoft no 1º tri de 2022, por 6 meses | Uma empresa; não é referência universal de tempo até produtividade |
| F12 | [Rodeghero et al., ICSE SEIP 2021](https://www.microsoft.com/en-us/research/publication/please-turn-your-cameras-on-remote-onboarding-of-software-developers-during-a-pandemic/) | 267 novos devs na Microsoft: criar conexão social forte com o time foi um dos maiores desafios | Pandemia; não prova que um agente substitui relação humana |
| F13 | [LinkedIn, Workplace Learning Report 2023](https://www.linkedin.com/business/talent/blog/learning-and-development/what-is-internal-mobility-and-how-to-get-it-right) | Só 15% dizem que a empresa os incentivou a mudar de função | Não mede a dificuldade depois da transição |
| F14 | [Bauer et al., J. Applied Psychology 2007](https://pdxscholar.library.pdx.edu/busadmin_fac/27/) (DOI 10.1037/0021-9010.92.3.707) | Meta-análise com 70 amostras: clareza de papel, autoeficácia e aceitação social medeiam o efeito da socialização em satisfação, comprometimento, desempenho, intenção de ficar e turnover | Não estima ganho de um agente de IA |
| F15 | [Sharma e Stol, J. Systems and Software 2020](https://cora.ucc.ie/handle/10468/8743) (vol. 159, DOI 10.1016/j.jss.2019.110442) | 102 profissionais de software, PLS-SEM: apoio a quem chega pesa muito no sucesso do onboarding (treinamento pesa menos); satisfação medeia a relação com intenção de sair | Intenção não é desligamento; associação não é causa |
| F16 | [Santos et al., revisão sistemática, arXiv 2024](https://arxiv.org/abs/2408.15989) | 32 estudos de soluções de software para onboarding em projetos de software; barreiras ainda não cobertas | Não comprova falta de concorrentes comerciais |
| F17 | [Brynjolfsson, Li e Raymond, QJE 2025](https://academic.oup.com/qje/article/140/2/889/7990658) (140(2):889–942) | Assistente de IA para 5.172 agentes de atendimento: +15% de problemas resolvidos por hora, com ganho maior para quem tem menos experiência | Atendimento não é engenharia; não usar os 14% e 5.179 da versão NBER de 2023 junto |
| M1 | SlashData, Developer Population (2025) | 47,2 mi de desenvolvedores no início de 2025, 36,5 mi profissionais (48,4 mi no 3º tri) | Base do TAM; conferir a página antes do pitch |
| M2 | Brasscom, Monitor de Empregos (RAIS/CAGED) | 1.403.318 profissionais de software, serviços de TI e TI interna em fev/2024 | Base do SAM; todos os vínculos, não só CLT |

### 10.1. Frases proibidas

- "A maioria das demissões ocorre nos primeiros 90 dias."
- "A Puca reduz o turnover em X%" (sem medição própria).
- "Vamos recuperar todas as horas gastas buscando informação."
- "A IA aumenta em 15% a produtividade de qualquer profissional."
- "Temos clientes na lista de empresas citadas."
- "R$ 900 é um preço validado" ou "já conhecemos nossa margem".
- "O mercado endereçável é todo o gasto mundial com treinamento."
- "Somos os únicos com tutor de IA para onboarding" (a Sana já oferece, ver §8).

## 11. Narrativa para o pitch

> “Ajudamos empresas a transformar contexto interno em orientação para quem entra ou muda de equipe. A Puca apoia o aprendizado e as primeiras tarefas para que a pessoa ganhe autonomia, enquanto buddies e gestores concentram o tempo onde o apoio humano faz diferença. A empresa contrata com aprovação do RH, começando por um piloto pago que vira contrato anual por integração.”

A frase descreve a proposta. Antes de usá-la como capacidade pronta, conferir o que a demo mostra de verdade ([`docs/demo.md`](../demo.md)). Números só entram depois de medição própria, com método e limites.

## 12. Próximos passos

| Quando | O quê | Resultado |
| --- | --- | --- |
| Agora | Demo dos dois vínculos e matriz de capacidades: o que está no código, o que é simulado e o que pode ser dito no pitch (#74) | Mostrar comportamento real |
| Agora | Comparação com concorrentes em fontes oficiais com data (#43) | Diferenciais que se sustentam |
| Primeira negociação | Escopo, preço, volume e metas do piloto com o RH | Proposta paga e revisável |
| Depois da implementação | Custo por sessão e esforço operacional (#52) | Base para preço, mínimo e margem |
| Durante o piloto | Uso, tarefas, bloqueios e apoio | Evidência de utilidade |
| Fim do piloto | Revisão com o RH | Conversão, ajuste ou encerramento explícito |

Não reabrir sem motivo novo: o RH aprova; os dois vínculos fazem parte da proposta; há piloto pago e contrato anual com mínimo; custos são apurados depois da implementação; a implantação já está em andamento.
