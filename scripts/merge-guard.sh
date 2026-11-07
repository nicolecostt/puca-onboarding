#!/usr/bin/env bash
# Hook PreToolUse (Bash): antes de `gh pr merge` ou de aprovar um PR (`gh pr review --approve`), roda
# scripts/pr-check.sh <n> --gate e barra (sai com 2) se o PR tem conflito com a main, CI vermelho ou deixa a base do
# sistema fora do padrão. Qualquer outro comando passa direto. Integrar mesmo assim é decisão de pessoa, pela
# interface do GitHub.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
entrada=$(cat)

n=$(node -e '
  let c = "";
  try { c = JSON.parse(process.argv[1]).tool_input?.command || ""; } catch { process.exit(0); }
  const m = /\bgh\s+pr\s+(merge|review)\b(.*)/s.exec(c);
  if (!m) process.exit(0);
  const resto = m[2];
  if (m[1] === "review" && !/(^|\s)(--approve|-a)(\s|$)/.test(resto)) process.exit(0);
  const num = /\/pull\/(\d+)/.exec(resto) || /(?:^|\s)#?(\d{1,6})(?=\s|$)/.exec(resto);
  console.log(num ? num[1] : "atual");
' "$entrada" 2>/dev/null)

[ -z "$n" ] && exit 0
if [ "$n" = atual ]; then
  n=$(gh pr view --json number --jq .number 2>/dev/null | tr -cd '0-9')
  [ -z "$n" ] && exit 0
fi

scripts/pr-check.sh "$n" --gate
