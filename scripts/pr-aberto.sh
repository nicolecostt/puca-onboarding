#!/usr/bin/env bash
# Hook PostToolUse (Bash). Depois de um `gh pr create` que devolveu o link do PR, lembra o agente da regra do time:
# PR aberto é PR acompanhado até ficar pronto para integrar (skill acompanhar-pr). Qualquer outro comando passa em
# silêncio. Só lê a entrada do hook; a saída leva só o número do PR, nunca texto do PR. Sempre sai com 0.

entrada=$(cat)
n=$(node -e '
  let d = {};
  try { d = JSON.parse(process.argv[1]); } catch { process.exit(0); }
  const cmd = d.tool_input?.command || "";
  if (!/\bgh\b[^\n;&|]*\bpr\s+create\b/.test(cmd)) process.exit(0);
  const r = d.tool_response;
  const saida = typeof r === "string" ? r : [r?.stdout, r?.stderr].filter(Boolean).join("\n");
  const ns = [...String(saida).matchAll(/github\.com\/[\w.-]+\/[\w.-]+\/pull\/(\d+)/g)].map((m) => m[1]);
  if (ns.length) process.stdout.write(ns[ns.length - 1]);
' "$entrada" 2>/dev/null | tr -cd '0-9')

[ -z "$n" ] && exit 0
msg="[pr] PR #$n aberto. Regra do time: chame agora a skill acompanhar-pr e acompanhe o PR #$n (CI, comentários, conversas de revisão, merge com a main), resolvendo o que aparecer até ele ficar pronto para integrar."
node -e 'process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: process.argv[1] } }))' "$msg"
exit 0
