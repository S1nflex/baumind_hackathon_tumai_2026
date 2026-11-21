#!/usr/bin/env bash
set -euo pipefail

if command -v pdftotext >/dev/null 2>&1; then
  echo 'Poppler ist bereits installiert:'
  pdftotext -v 2>&1 | head -1 || true
  exit 0
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo 'Bitte Poppler für dieses System installieren (pdftotext ist nicht verfügbar).' >&2
  exit 1
fi

if command -v sudo >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y poppler-utils
elif [ "$(id -u)" = 0 ]; then
  apt-get update
  apt-get install -y poppler-utils
else
  echo 'Für die Installation von poppler-utils wird sudo benötigt.' >&2
  exit 1
fi

command -v pdftotext >/dev/null 2>&1
printf 'PDF-Import ist jetzt eingerichtet. Starte npm run dev erneut.\n'
