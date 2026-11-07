#!/usr/bin/env bash
# Hook PreToolUse (Bash). Barra (sai com 2, motivo no stderr):
#   - `gh pr merge` e `gh pr review --approve` quando scripts/pr-check.sh <n> --gate barra: conflito com a main,
#     CI vermelho ou rodando, base do sistema fora do padrão depois do merge, ou PR que não deu para verificar;
#   - `git push` direto para a main (as regras do time: tudo entra por PR).
# Qualquer outro comando passa direto. É uma trava contra merge acidental por agente, não uma fronteira de segurança:
# integrar mesmo assim continua sendo decisão de pessoa, pela interface do GitHub. Formas deliberadas de contornar
# (alias, script próprio, gh api) ficam de fora de propósito: a trava é para acidente, não para quem quer burlar.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
entrada=$(cat)
barra() { echo "$1" >&2; exit 2; }

# Quebra o comando em trechos (&&, ||, ;, |, quebra de linha), separa os argumentos respeitando aspas e devolve uma
# linha por ação que interessa: "pr <seletor|atual> <repo-ou-vazio>" ou "push-main".
acoes=$(node -e '
  let c = "";
  try { c = JSON.parse(process.argv[1]).tool_input?.command || ""; } catch { process.exit(0); }
  const args = (s) => [...s.matchAll(/"((?:\\.|[^"\\])*)"|'\''([^'\'']*)'\''|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
  const comValor = new Set(["-b", "--body", "-F", "--body-file", "-t", "--subject", "-A", "--author-email", "--match-head-commit"]);
  const limpo = c.replace(/\$\(|[()`{}]/g, " ");
  let achou = false;
  for (const trecho of limpo.split(/&&|\|\||[;&|\n]/)) {
    const t = args(trecho.trim());
    let i = 0;
    // VAR=valor e prefixos que só executam o comando seguinte
    while (i < t.length && (/^[A-Z_][A-Z0-9_]*=/.test(t[i]) || ["env", "command", "exec", "sudo", "time", "nohup"].includes(t[i]))) i++;
    const prog = (t[i] || "").split("/").pop();
    if (prog === "gh") {
      i++;
      let repo = "";
      while (i < t.length && t[i].startsWith("-")) {
        if (t[i] === "-R" || t[i] === "--repo") { repo = t[i + 1] || ""; i += 2; }
        else if (t[i].startsWith("--repo=")) { repo = t[i].slice(7); i++; }
        else if (t[i] === "--hostname") i += 2; else i++;
      }
      if (t[i] !== "pr" || !["merge", "review"].includes(t[i + 1])) continue;
      achou = true; // entendido (inclusive review sem aprovação, que passa)
      const sub = t[i + 1];
      const resto = t.slice(i + 2);
      if (sub === "review" && !resto.some((a) => a === "--approve" || a === "-a")) continue;
      let sel = "atual";
      for (let k = 0; k < resto.length; k++) {
        const a = resto[k];
        if (a.startsWith("-R=") || a.startsWith("--repo=")) { repo = a.split("=")[1]; continue; }
        if (a === "-R" || a === "--repo") { repo = resto[++k] || ""; continue; }
        if (comValor.has(a)) { k++; continue; }
        if (a.startsWith("-")) continue;
        sel = a; break;
      }
      console.log(["pr", sel, repo].join("\t"));
    } else if (prog === "git") {
      const p = t.indexOf("push", i);
      if (p < 0) continue;
      achou = true;
      const opts = t.slice(p + 1).filter((a) => a.startsWith("-"));
      const refs = t.slice(p + 1).filter((a) => !a.startsWith("-")).slice(1); // o primeiro é o remoto
      if (opts.some((o) => o === "--all" || o === "--mirror")) console.log("push-todas");
      else if (refs.some((r) => /^(\+)?(refs\/heads\/)?(main|master)$/.test(r) || /:(refs\/heads\/)?(main|master)$/.test(r))) console.log("push-main");
      else if (refs.length === 0 || refs.some((r) => /^(\+)?(HEAD|@)$/.test(r))) console.log("push-atual");
    }
  }
  // tem cara de merge/aprovação mas o parser não entendeu: barra (falha fechada)
  if (!achou && /\bgh\b[^\n]*\bpr\s+(merge|review\b[^\n]*(--approve|\s-a\b))/.test(c)) console.log("nao-entendi");
' "$entrada" 2>/dev/null)

[ -z "$acoes" ] && exit 0

while IFS=$'\t' read -r tipo sel repo; do
  case $tipo in
    push-main) barra "Push direto na main não: pelas regras do time tudo entra por PR (skill handoff).";;
    push-todas) barra "git push --all/--mirror pode levar a main junto: faça push só da sua branch.";;
    nao-entendi) barra "Não entendi esse comando de merge/aprovação para verificar antes. Use a forma simples: gh pr merge <n>.";;
    push-atual)
      [ "$(git branch --show-current)" = main ] && barra "Você está na main: push direto na main não. Crie uma branch e abra um PR (skill handoff).";;
    pr)
      if [ -n "$repo" ]; then
        canon() { sed -E 's#^(https?://)?(www\.)?github\.com[/:]##; s#^git@github\.com:##; s#\.git/?$##; s#/+$##' | tr '[:upper:]' '[:lower:]'; }
        meu=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null | canon)
        alvo=$(canon <<<"$repo")
        [ -n "$meu" ] && [ "$alvo" != "$meu" ] && continue # outro repositório: não é com este hook
      fi
      if [[ "$sel" =~ ^[0-9]+$ ]]; then n=$sel
      elif [[ "$sel" =~ /pull/([0-9]+) ]]; then n=${BASH_REMATCH[1]}
      elif [ "$sel" = atual ]; then n=$(gh pr view --json number --jq .number 2>/dev/null | tr -cd '0-9')
      else n=$(gh pr view "$sel" --json number --jq .number 2>/dev/null | tr -cd '0-9'); fi
      [ -z "$n" ] && barra "Não consegui identificar o PR desse comando para verificar antes de integrar. Use o número (gh pr merge <n>)."
      scripts/pr-check.sh "$n" --gate || exit 2;;
  esac
done <<<"$acoes"
exit 0
