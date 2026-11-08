#!/bin/bash
# Publica uma versão nova do app para Mac (docs/desenvolvimento.md, "App para Mac"):
#   npm run publicar-app -- 0.1.2
# Gera os dois .zip a partir da main do GitHub, assina, cria a tag v<versão> e sobe o Release.
# Quem já tem o app atualiza rodando de novo o comando de instalar da landing.
set -euo pipefail

VERSAO="${1:-}"
REMOTO="${ORBIS_REMOTO:-origin}" # ex.: ORBIS_REMOTO=ssh://git@ssh.github.com:443/nicolecostt/puca-onboarding.git
falhar() { echo "publicar-app: $1" >&2; exit 1; }

[[ "$VERSAO" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || falhar "diga a versão, ex.: npm run publicar-app -- 0.1.2"
TAG="v$VERSAO"
cd "$(dirname "$0")/.."

gh auth status >/dev/null 2>&1 || falhar "entre no GitHub antes: gh auth login"
[ -z "$(git status --porcelain --untracked-files=no)" ] || falhar "há alterações não commitadas; o app sai da main do GitHub, sem elas"

git fetch -q origin main --tags
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && falhar "a tag $TAG já existe; escolha outra versão"
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] ||
  falhar "você não está na main atualizada. Rode: git switch main && git pull (ou git switch --detach origin/main)"

# A versão vale só para este build (o app mostra em "Sobre o Orbis"); o package.json volta ao que era no fim.
cp package.json /tmp/orbis-package.json.$$
cp package-lock.json /tmp/orbis-package-lock.json.$$
trap 'mv /tmp/orbis-package.json.$$ package.json; mv /tmp/orbis-package-lock.json.$$ package-lock.json' EXIT
npm version "$VERSAO" --no-git-tag-version --allow-same-version >/dev/null

echo "Gerando o Orbis $VERSAO (uns 2 minutos)..."
rm -rf release dist dist-desktop
npm run build:app

for app in release/mac/Orbis.app release/mac-arm64/Orbis.app; do
  codesign --verify --deep --strict "$app" || falhar "assinatura inválida em $app"
done

echo "Publicando o Release $TAG..."
git tag -a "$TAG" -m "Orbis $VERSAO"
git push -q "$REMOTO" "$TAG" || { git tag -d "$TAG" >/dev/null; falhar "não consegui subir a tag (tente ORBIS_REMOTO com o endereço SSH)"; }
gh release create "$TAG" \
  release/Orbis-mac-arm64.zip release/Orbis-mac-arm64.zip.sha256 \
  release/Orbis-mac-x64.zip release/Orbis-mac-x64.zip.sha256 \
  --verify-tag --latest --title "Orbis $TAG" \
  --notes "App para Mac do Orbis $VERSAO. Instalar ou atualizar: veja a seção \"Instalar no Mac\" do README ou https://theorbis.app."

echo "Pronto: Orbis $VERSAO publicado. Para atualizar um Mac, rode de novo:"
echo "  curl -fsSL https://raw.githubusercontent.com/nicolecostt/puca-onboarding/main/scripts/instalar.sh | bash"
