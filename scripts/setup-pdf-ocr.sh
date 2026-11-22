#!/usr/bin/env bash
set -euo pipefail
if ! command -v apt-get >/dev/null 2>&1; then
  echo 'Linux apt-get benötigt. Installiere Poppler und Tesseract inkl. deutscher Sprachdaten manuell.' >&2
  exit 1
fi
if command -v sudo >/dev/null 2>&1; then SUDO=sudo; elif [ "$(id -u)" = 0 ]; then SUDO=''; else echo 'sudo benötigt.' >&2; exit 1; fi
$SUDO apt-get update
$SUDO apt-get install -y poppler-utils tesseract-ocr tesseract-ocr-deu tesseract-ocr-eng
pdftotext -v 2>&1 | head -1 || true
tesseract --list-langs
