# Incidentes

Incidente é qualquer coisa que afeta o cliente ou está perto de afetar. Site fora do ar, login falhando, saldo ou extrato errado, transferência que não grava e alerta que o runbook não resolve são incidentes. Na dúvida, trate como incidente. Um alarme falso custa menos que um problema descoberto tarde.

## Quem está de plantão

Cada time tem a sua escala, e a regra de cada uma está na database [Times](notion:times).

- **Contas** tem rodízio semanal, 24 horas por dia, porque o login não pode ficar fora do ar.
- **Livro-razão** tem rodízio semanal, 24 horas por dia. Quem chega acompanha um plantão antes de entrar na escala.
- **Canais** tem plantão em horário comercial. À noite e no fim de semana, o plantão de Plataforma cobre o site.
- **Plataforma** tem rodízio semanal, 24 horas por dia, e também cobre o site fora do horário comercial.

No começo da semana, quem pega o plantão avisa no canal do time. Fora do horário comercial, problema no site vai para o #plataforma-ajuda.

## Quando o alerta toca

1. Avise no canal do time que você está olhando. Uma linha basta.
2. Procure o runbook do problema em `docs/runbooks/`, no kota-bank. Para disco cheio no banco do livro-razão, por exemplo, o runbook é o [ledger-db cheio](https://github.com/JucaGF/kota-bank/blob/main/docs/runbooks/ledger-db-cheio.md).
3. Se o runbook não resolve em meia hora, ou se o cliente já está sendo afetado, chame o tech lead do time. Se for preciso decidir algo que o cliente vai sentir, chame também o gestor.
4. Escreva no canal o que está fazendo enquanto faz. Assim, quem chega para ajudar entende sem perguntar.
5. Quando resolver, diga no canal se houve impacto para cliente.

Chamar ajuda no meio de um incidente é o esperado, inclusive de quem acabou de entrar na escala.

## Depois do incidente

- **Sem impacto para cliente.** Fica um registro curto no histórico de incidentes do time, com o que aconteceu, o que resolveu e o que vale anotar no runbook.
- **Com impacto para cliente.** Além do registro, o time faz uma revisão do incidente em até uma semana. A revisão conta o que aconteceu, em ordem, e lista o que ajudou, o que atrapalhou e o que muda, cada mudança com uma pessoa responsável. Procuramos o que falhou no processo, e não quem errou.

Quando outros times viram o alerta ou sentiram o problema, o gestor do time dono deixa uma linha no #geral dizendo se houve impacto e onde está o resumo.

## Um exemplo do Livro-razão

O alerta de disco do `ledger-db` tocou com 85% e subindo. O Gustavo Schmitt estava de plantão, avisou no #livro-razao e seguiu o runbook. A Beatriz Cavalcanti se ofereceu para acompanhar e sugeriu começar pelo passo que mede o tamanho com o `psql`. O banco tinha crescido com o volume do dia de pagamento. Depois dos passos do runbook, o disco voltou para 60%, sem nenhum cliente afetado.

Como foi leve e sem impacto, ficou só o registro no histórico do time, e a Natália Brandão avisou no #geral que estava resolvido. A Beatriz pediu para anotar no runbook o tamanho que apareceu, para ajudar quem pegar o próximo alerta.

## Incidente de segurança

Suspeita de vazamento de senha, token, chave de API ou dado de cliente é incidente de segurança. Escreva na hora para seguranca@kota.example, mesmo sem ter certeza, e a segurança troca o que for preciso junto com você. Quando o dado é de cliente, vale também a política de [Dados de cliente e LGPD](notion:dados-de-cliente-e-lgpd).
