#!/usr/bin/env bash
# Confere se o trabalho local está atrás da main ou se cruza com o que outras pessoas mudaram.
# Roda sozinho pelos hooks do Claude Code (.claude/settings.json) e pode ser chamado à mão:
#   scripts/sync-check.sh          (respeita o intervalo mínimo entre fetches)
#   scripts/sync-check.sh --agora  (busca já)
# Só lê: faz git fetch, não mexe na branch nem nos arquivos. Nunca falha (sai sempre com 0).
# A saída vai para o contexto do agente: nada de texto livre de terceiros (título de PR etc.),
# só número de PR, login e caminhos de arquivo, sem caracteres de controle.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
INTERVALO=${SYNC_CHECK_INTERVALO:-120}   # segundos entre fetches
MARCA="$(git rev-parse --git-path puca-sync-check)"

agora=$(date +%s)
ultimo=$(cat "$MARCA" 2>/dev/null || echo 0)
if [ "$1" != "--agora" ] && [ $((agora - ultimo)) -lt "$INTERVALO" ]; then exit 0; fi
echo "$agora" > "$MARCA"

# só caracteres seguros de caminho/login: letras, números, . _ - / @ + espaço e acentos comuns
limpa() { LC_ALL=C tr -cd '[:alnum:]._/@+ \n-' ; }
linha() { printf '%s\n' "$*"; }

git fetch --quiet origin 2>/dev/null || { linha "[sync] não consegui fazer git fetch (sem rede?). Não sei se a main andou."; exit 0; }

branch=$(git branch --show-current | limpa)
base=origin/main

# arquivos que eu estou mexendo: commits da branch + não commitados + novos
meus=$( { git diff --name-only "$base"...HEAD 2>/dev/null
          git diff --name-only HEAD 2>/dev/null
          git ls-files --others --exclude-standard; } | sort -u)

atras=$(git rev-list --count HEAD.."$base" 2>/dev/null || echo 0)

if [ "$atras" -gt 0 ]; then
  linha "[sync] A main tem $atras commit(s) que você não tem (branch: ${branch:-detached})."
  vindos=$(git diff --name-only HEAD..."$base" 2>/dev/null | sort -u)
  cruzam=$(comm -12 <(echo "$meus") <(echo "$vindos") | sed '/^$/d' | limpa)
  if [ -n "$cruzam" ]; then
    linha "[sync] ⚠️ A main mudou arquivos que você também está mexendo:"
    while IFS= read -r f; do linha "  - $f"; done <<<"$cruzam"
    linha "[sync] Veja o que mudou (git log HEAD..$base -- <arquivo>) e traga a main antes de seguir (skill /sincronizar)."
  else
    linha "[sync] Nada cruza com os seus arquivos. Traga a main quando der (skill /sincronizar)."
  fi
fi

# PRs abertos de outras pessoas mexendo nos mesmos arquivos (sem título: é texto livre de terceiros)
if command -v gh >/dev/null 2>&1 && [ -n "$meus" ]; then
  while IFS= read -r -d '' bloco; do
    num=$(cut -f1 <<<"$bloco" | head -1 | tr -cd '0-9')
    autor=$(cut -f2 <<<"$bloco" | head -1 | LC_ALL=C tr -cd '[:alnum:]-' | cut -c1-39)
    cabeca=$(cut -f3 <<<"$bloco" | head -1)
    [ -z "$num" ] && continue
    [ "$cabeca" = "$(git branch --show-current)" ] && continue
    arquivos=$( { cut -f4 <<<"$bloco" | head -1; tail -n +2 <<<"$bloco"; } | sed '/^$/d' | sort -u)
    comuns=$(comm -12 <(echo "$meus") <(echo "$arquivos") | sed '/^$/d' | limpa)
    if [ -n "$comuns" ]; then
      linha "[sync] ⚠️ PR aberto #$num (de $autor) mexe nos mesmos arquivos que você:"
      while IFS= read -r f; do linha "  - $f"; done <<<"$comuns"
      linha "[sync] Combine com essa pessoa antes de mudar esses arquivos (gh pr view $num)."
    fi
  done < <(gh pr list --state open --json number,author,headRefName,files \
             --jq '.[] | "\(.number)\t\(.author.login)\t\(.headRefName)\t\([.files[].path] | join("\n"))\u0000"' 2>/dev/null)
fi
exit 0
