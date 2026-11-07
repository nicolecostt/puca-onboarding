#!/usr/bin/env bash
# Fatos de um PR para a revisão: merge com a main, conflitos reais com os outros PRs abertos, CI e a base do sistema
# (PRODUCT.md/CONTEXT.md) validada no resultado do merge. Usado pela skill revisar e pelos hooks do .claude/settings.json.
#   scripts/pr-check.sh <n>          relatório
#   scripts/pr-check.sh <n> --gate   silencioso; sai com 2 (motivo no stderr) se o merge deve ser barrado
#   scripts/pr-check.sh --conflitos <ref1> <ref2>   só os conflitos entre duas branches/refs, classificados
# Só lê: busca refs do GitHub para refs/puca-pr/* e simula merges com git merge-tree. Não mexe em branch nem em arquivo.
# A saída vai para o contexto do agente: nada de texto livre de terceiros (título, descrição), só números, estados,
# logins e caminhos de arquivo filtrados.

n=${1:-}
modo=${2:-}
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0

limpa() { perl -CSD -ne 'print if /\A[\p{L}\p{N}._\/\@+-]{1,120}\n?\z/' ; }
# no --gate, qualquer coisa que impeça a verificação barra o merge (falha fechada)
falha() { if [ "$modo" = --gate ]; then echo "PR #$n: não consegui verificar ($1). Confira com scripts/pr-check.sh $n antes de integrar." >&2; exit 2; fi; echo "[pr-check] $1."; exit 0; }
login() { LC_ALL=C tr -cd '[:alnum:]-' | cut -c1-39; }
linha() { [ "$modo" = --gate ] || printf '%s\n' "$*"; }
bloqueios=()
atencao=()

# Conflitos de um merge: "arquivo|mecânicos|de decisão". Com diff3 cada bloco tem os dois lados e a origem.
# Mecânico: a origem está vazia (os dois acrescentaram no mesmo lugar) ou um lado manteve a origem intacta e só
# acrescentou linhas em volta (resolve: a alteração do outro lado + as linhas novas). De decisão: os dois lados
# alteraram a mesma origem de jeitos diferentes.
conflitos() {
  local saida arvore
  saida=$(git -c merge.conflictStyle=diff3 merge-tree --write-tree --name-only --no-messages "$1" "$2" 2>/dev/null)
  [ $? -eq 1 ] || return 0
  arvore=$(head -1 <<<"$saida")
  tail -n +2 <<<"$saida" | sed '/^$/d' | sort -u | while IFS= read -r arq; do
    git show "$arvore:$arq" 2>/dev/null | awk -v f="$arq" '
      /^<<<<<<< /{dentro=1; parte="a"; A=""; B=""; C=""; next}
      /^\|\|\|\|\|\|\| /{if(dentro) parte="b"; next}
      /^=======$/{if(dentro) parte="c"; next}
      /^>>>>>>> /{
        if(dentro){ if(B=="" || index(A,B) || index(C,B)) mec++; else dec++ }
        dentro=0; next}
      { if(dentro){ if(parte=="a") A=A $0 "\n"; else if(parte=="b") B=B $0 "\n"; else C=C $0 "\n" } }
      END{ printf "%s|%d|%d\n", f, mec, dec }'
  done
}

descreve() { # arquivo|mecânicos|de decisão -> texto
  IFS='|' read -r arq mec dec <<<"$1"
  local tipo
  if [ "$arq" = package-lock.json ]; then tipo="lockfile: refazer com npm install depois do merge (mecânico)"
  elif [ "$dec" = 0 ]; then tipo="$mec bloco(s) mecânico(s): manter as duas mudanças (ajustar ordem/numeração se for lista ou seção)"
  else tipo="$dec bloco(s) em que os dois lados alteraram o mesmo trecho de jeitos diferentes: o autor decide$([ "$mec" -gt 0 ] && echo "; mais $mec mecânico(s)")"; fi
  local nome; nome=$(limpa <<<"$arq"); printf '%s — %s' "${nome:-(arquivo com nome fora do padrão)}" "$tipo"
}
junta() { local IFS=';'; local s="$*"; printf '%s' "${s//;/, }"; }

# modo --conflitos: só compara duas refs, sem GitHub
if [ "$n" = --conflitos ]; then
  [ $# -eq 3 ] || { echo "uso: scripts/pr-check.sh --conflitos <ref1> <ref2>" >&2; exit 0; }
  c=$(conflitos "$2" "$3")
  if [ -z "$c" ]; then echo "[pr-check] $(limpa <<<"$2") e $(limpa <<<"$3") integram sem conflito."
  else echo "[pr-check] Conflitos entre $(limpa <<<"$2") e $(limpa <<<"$3"):"; while IFS= read -r x; do echo "  - $(descreve "$x")"; done <<<"$c"; fi
  exit 0
fi

[[ "$n" =~ ^[0-9]+$ ]] || { echo "uso: scripts/pr-check.sh <número do PR> [--gate] | --conflitos <ref1> <ref2>" >&2; exit 0; }
command -v gh >/dev/null 2>&1 || falha "sem gh instalado"

json=$(gh pr view "$n" --json number,state,isDraft,headRefName,baseRefName,mergeable,additions,deletions,changedFiles,statusCheckRollup,body,author 2>/dev/null) \
  || falha "não achei o PR #$n no GitHub"
campo() { node -e 'const d=JSON.parse(process.argv[1]);const v=process.argv[2].split(".").reduce((o,k)=>o?.[k],d);process.stdout.write(String(v??""))' "$json" "$1"; }

estado=$(campo state)
if [ "$estado" != OPEN ]; then linha "[pr-check] PR #$n está $estado; nada a checar."; exit 0; fi
base=$(campo baseRefName | limpa)
autor=$(campo author.login | login)

# refs locais da main e dos PRs abertos (um fetch só); no --gate só os outros PRs não importam
abertos=$n
[ "$modo" = --gate ] || abertos=$(gh pr list --state open --json number --jq '.[].number' 2>/dev/null | tr -cd '0-9\n')
refspecs=("+refs/heads/$base:refs/remotes/origin/$base")
for m in $abertos; do refspecs+=("+refs/pull/$m/head:refs/puca-pr/$m"); done
git fetch -q origin "${refspecs[@]}" 2>/dev/null || falha "não consegui buscar o PR no GitHub (sem rede?)"
pr=refs/puca-pr/$n
main=refs/remotes/origin/$base

linha "[pr-check] PR #$n (de $autor) → $base · $(campo changedFiles) arquivo(s), +$(campo additions) −$(campo deletions)$([ "$(campo isDraft)" = true ] && echo ' · rascunho')"

# 1. merge com a main
atras=$(git rev-list --count "$pr..$main" 2>/dev/null || echo "?")
cm=$(conflitos "$main" "$pr")
if [ -n "$cm" ]; then
  bloqueios+=("conflito com a $base")
  linha "[pr-check] ❌ Conflito com a $base (que andou $atras commit(s) desde a branch):"
  while IFS= read -r c; do linha "  - $(descreve "$c")"; done <<<"$cm"
else
  linha "[pr-check] ✅ Integra na $base sem conflito$([ "$atras" != 0 ] && echo " (a $base andou $atras commit(s) desde a branch)")."
fi

# 2. CI
ci=$(node -e '
  const r=(JSON.parse(process.argv[1]).statusCheckRollup)||[];
  if(!r.length){console.log("nenhum");process.exit()}
  const s=r.map(c=>c.conclusion||c.status||c.state||"?");
  console.log(s.some(x=>/FAIL|ERROR|CANCEL|TIMED/.test(x))?"falhou":s.every(x=>/SUCCESS|NEUTRAL|SKIPPED/.test(x))?"verde":"rodando")' "$json")
case $ci in
  verde) linha "[pr-check] ✅ CI verde.";;
  falhou) bloqueios+=("CI vermelho"); linha "[pr-check] ❌ CI falhou: veja com gh pr checks $n.";;
  rodando) bloqueios+=("CI ainda rodando: espere terminar"); linha "[pr-check] ⏳ CI ainda rodando.";;
  *) bloqueios+=("CI não rodou neste PR"); linha "[pr-check] ⚠️ CI não rodou neste PR.";;
esac

# 3. base do sistema no resultado do merge (só se o merge é limpo e a base mudou de algum lado)
if [ -z "$cm" ] && git diff --quiet "$main...$pr" -- PRODUCT.md CONTEXT.md 2>/dev/null; then :; elif [ -z "$cm" ]; then
  tsx=node_modules/.bin/tsx
  if [ -x "$tsx" ]; then
    tmp=$(mktemp -d)
    arvore=$(git merge-tree --write-tree "$main" "$pr" 2>/dev/null | head -1)
    git show "$arvore:PRODUCT.md" >"$tmp/PRODUCT.md" 2>/dev/null; git show "$arvore:CONTEXT.md" >"$tmp/CONTEXT.md" 2>/dev/null
    res=$(cd "$tmp" && "$OLDPWD/$tsx" "$OLDPWD/scripts/check-contexto.ts" 2>&1 | grep '^erro' | head -5)
    rm -rf "$tmp"
    if [ -n "$res" ]; then
      bloqueios+=("base do sistema quebra no merge")
      linha "[pr-check] ❌ PRODUCT.md/CONTEXT.md ficam fora do padrão depois do merge:"
      while IFS= read -r l; do linha "  $(sed 's/^erro *//' <<<"$l" | limpa)"; done <<<"$res"
    else
      linha "[pr-check] ✅ Base do sistema (PRODUCT.md/CONTEXT.md) válida depois do merge."
    fi
  else
    [ "$modo" = --gate ] && falha "o PR mexe na base do sistema e falta npm ci para validar"
    linha "[pr-check] (rode npm ci para validar a base do sistema no resultado do merge)"
  fi
fi

# 4. outros PRs abertos: conflito de verdade (não só "mexe no mesmo arquivo") e seção do PRODUCT.md com mesmo número
secoes() { git diff "$main...$1" -- PRODUCT.md 2>/dev/null | grep -E '^\+## [0-9]+\. ' | sed -E 's/^\+## ([0-9]+)\..*/\1/' | sort -u; }
minhas=$(secoes "$pr")
for m in $abertos; do
  [ "$m" = "$n" ] && continue
  c=$(conflitos "$pr" "refs/puca-pr/$m")
  iguais=$(comm -12 <(echo "$minhas") <(secoes "refs/puca-pr/$m") | sed '/^$/d' | tr '\n' ' ')
  [ -z "$c" ] && [ -z "$iguais" ] && continue
  atencao+=("conflito com o PR #$m")
  linha "[pr-check] ⚠️ Conflita com o PR aberto #$m: quem integrar depois resolve."
  [ -n "$c" ] && while IFS= read -r x; do linha "  - $(descreve "$x")"; done <<<"$c"
  [ -n "$iguais" ] && linha "  - os dois criam a seção §${iguais% } do PRODUCT.md: o segundo renumera (e ajusta sumário e âncoras)"
done

# 5. issue ligada
grep -qiE '(closes|fixes|resolves) #[0-9]+' <<<"$(campo body)" && linha "[pr-check] ✅ PR fecha uma issue." || linha "[pr-check] ⚠️ PR sem \"Closes #<issue>\"."

# resumo
if [ ${#bloqueios[@]} -gt 0 ]; then
  linha "[pr-check] Resultado: não integrar ainda — $(junta "${bloqueios[@]}")."
  [ "$modo" = --gate ] && { echo "PR #$n não pode ser integrado agora: $(junta "${bloqueios[@]}"). Veja scripts/pr-check.sh $n e corrija antes (ou integre pela interface do GitHub, se a pessoa decidir assim)." >&2; exit 2; }
elif [ ${#atencao[@]} -gt 0 ]; then
  linha "[pr-check] Resultado: integrável, com atenção a: $(junta "${atencao[@]}")."
else
  linha "[pr-check] Resultado: integrável, nenhum conflito."
fi
exit 0
