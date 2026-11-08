#!/usr/bin/env bash
# Hook SessionStart e UserPromptSubmit. Até a submissão do hackathon, lembra o agente do tempo que falta e da fase
# (implementar até 12:00, só testar e gravar até 13:00), para ele seguir CLAUDE.md § Reta final. Depois da submissão
# fica em silêncio. Não lê a entrada; a saída é só texto deste script. Sempre sai com 0.
# RETA_FINAL_AGORA (data ISO) troca o "agora" nos testes.

node -e '
  const fimImpl = Date.parse("2026-11-08T12:00:00-03:00");
  const submissao = Date.parse("2026-11-08T13:00:00-03:00");
  const agora = process.env.RETA_FINAL_AGORA ? Date.parse(process.env.RETA_FINAL_AGORA) : Date.now();
  if (Number.isNaN(agora) || agora >= submissao) process.exit(0);
  const falta = (t) => {
    const min = Math.max(0, Math.ceil((t - agora) / 60000));
    const h = Math.floor(min / 60);
    return h ? `${h}h${String(min % 60).padStart(2, "0")}` : `${min}min`;
  };
  const msg = agora < fimImpl
    ? `[reta-final] Faltam ${falta(fimImpl)} para fechar a implementação (12:00) e ${falta(submissao)} para a submissão (13:00). ` +
      "Fase IMPLEMENTAR: só o que faz um passo de docs/demo.md funcionar, caminho mais simples, sem pergunta evitável, simulado vale se o real não fecha. Siga CLAUDE.md § Reta final."
    : `[reta-final] Implementação encerrada. Faltam ${falta(submissao)} para a submissão (13:00). ` +
      "Fase TESTAR E GRAVAR: nada de feature, refatoração ou doc; só correção de bug que quebra a demo, e skill checar-demo depois de cada merge. Siga CLAUDE.md § Reta final.";
  process.stdout.write(msg + "\n");
' 2>/dev/null
exit 0
