#!/bin/sh
# Gera o .sha256 de cada .zip do app (o instalador confere antes de instalar).
set -eu
cd "$(dirname "$0")/../release"
for f in Orbis-mac-*.zip; do
  shasum -a 256 "$f" > "$f.sha256"
  cat "$f.sha256"
done
