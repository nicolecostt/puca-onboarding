#!/usr/bin/env bash
# Hook UserPromptSubmit: quando o pedido é revisar/aprovar/integrar um PR, coloca no contexto do agente os fatos do
# scripts/pr-check.sh e o lembrete das regras de revisão. Em qualquer outro pedido, não imprime nada.
# Recebe o JSON do hook no stdin. Nunca bloqueia (sai sempre com 0).

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
entrada=$(cat)

# números de PR citados num pedido de revisão (no máximo 3); "sem-numero" se pediu revisão de PR sem dizer qual
prs=$(node -e '
  let p = "";
  try { p = JSON.parse(process.argv[1]).prompt || ""; } catch { process.exit(0); }
  const intencao = /(revis|review|aprov|approv|merge|integr|pode subir|tá bom pra subir|ta bom pra subir)/i;
  if (!intencao.test(p) || !/\b(pr|prs|pull)\b|#\d+/i.test(p)) process.exit(0);
  const nums = [...p.matchAll(/(?:\bprs?\b|pull(?: request)?|#)\s*#?\s*(\d{1,6})/gi)].map((m) => m[1]);
  const unicos = [...new Set(nums)].slice(0, 3);
  console.log(unicos.length ? unicos.join(" ") : "sem-numero");
' "$entrada" 2>/dev/null)

[ -z "$prs" ] && exit 0

if [ "$prs" = sem-numero ]; then
  echo "[revisão] Pedido de revisão de PR sem número: descubra qual com gh pr list e rode scripts/pr-check.sh <n>."
else
  for n in $prs; do scripts/pr-check.sh "$n"; echo; done
fi
echo "[revisão] Chame a skill revisar. Os fatos acima (merge, conflitos, CI, base) são verificados: use-os, não suponha."
echo "[revisão] Critério do hackathon: funciona, integra e não atrapalha a demo. Só aponte problema com evidência (arquivo:linha ou saída de comando) e cenário concreto; estilo e \"seria melhor se\" não bloqueiam."
exit 0
