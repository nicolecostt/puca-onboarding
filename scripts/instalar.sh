#!/bin/bash
# Instala o Orbis no Mac (docs/stack.md §3.4). Não pede sudo e só escreve em ~/Applications/Orbis.app.
#   curl -fsSL https://raw.githubusercontent.com/nicolecostt/puca-onboarding/main/scripts/instalar.sh | bash
# Para remover o app e os dados locais:
#   curl -fsSL https://raw.githubusercontent.com/nicolecostt/puca-onboarding/main/scripts/instalar.sh | bash -s -- --desinstalar
set -euo pipefail

REPO="nicolecostt/puca-onboarding"
DESTINO="${HOME}/Applications/Orbis.app"
DADOS="${HOME}/Library/Application Support/Orbis"
# ORBIS_BASE_URL troca de onde baixa (teste com um Release específico ou uma pasta local servida por http).
BASE="${ORBIS_BASE_URL:-https://github.com/${REPO}/releases/latest/download}"

falhar() { echo "Orbis: $1" >&2; exit 1; }

if [ "${1:-}" = "--desinstalar" ]; then
  osascript -e 'quit app "Orbis"' >/dev/null 2>&1 || true
  rm -rf "${DESTINO}" "${DADOS}"
  echo "Orbis removido."
  exit 0
fi

[ "$(uname -s)" = "Darwin" ] || falhar "o app é só para Mac."

case "$(uname -m)" in
  arm64) ARQ="arm64" ;;
  x86_64) ARQ="x64" ;;
  *) falhar "processador $(uname -m) não suportado." ;;
esac
ZIP="Orbis-mac-${ARQ}.zip"

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

echo "Baixando o Orbis (${ARQ})..."
curl -fL --progress-bar -o "${TMP}/${ZIP}" "${BASE}/${ZIP}" || falhar "não consegui baixar ${BASE}/${ZIP}."
curl -fsSL -o "${TMP}/${ZIP}.sha256" "${BASE}/${ZIP}.sha256" || falhar "não consegui baixar a soma de conferência."

echo "Conferindo o arquivo..."
(cd "${TMP}" && shasum -a 256 -c "${ZIP}.sha256" >/dev/null) || falhar "o arquivo baixado não bate com a soma publicada. Nada foi instalado."

echo "Instalando em ${DESTINO}..."
osascript -e 'quit app "Orbis"' >/dev/null 2>&1 || true
mkdir -p "${HOME}/Applications"
ditto -x -k "${TMP}/${ZIP}" "${TMP}/app"
[ -d "${TMP}/app/Orbis.app" ] || falhar "o pacote não tem o Orbis.app."
rm -rf "${DESTINO}"
mv "${TMP}/app/Orbis.app" "${DESTINO}"
# Pelo curl a quarentena não vem; tira por garantia, caso o arquivo tenha chegado por outro caminho.
xattr -dr com.apple.quarantine "${DESTINO}" 2>/dev/null || true

echo "Pronto. Abrindo o Orbis..."
open "${DESTINO}"
