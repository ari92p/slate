#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$REPO_ROOT/dist"

VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$REPO_ROOT/manifest.json" | head -n1)"
if [[ -z "${VERSION}" ]]; then
  echo "Die Version konnte nicht aus manifest.json gelesen werden."
  exit 1
fi

ZIP_PATH="$DIST_DIR/slate-v${VERSION}.zip"
FILES=(
  manifest.json
  background.js
  core.js
  options.html
  theme.js
  vendor
  i18n.js
  slate.css
  fonts
  icons
  options.js
  sources.js
  _locales
  data
  licenses
  LICENSE
  PRIVACY.md
  README.md
)

UNPACKED_DIR="$DIST_DIR/slate"

# dist/ only ever holds the current build: one ZIP and one unpacked folder.
# The folder keeps the same path, so the browser can simply reload it after each build.
mkdir -p "$DIST_DIR"
find "$DIST_DIR" -mindepth 1 -maxdepth 1 -name 'slate-v*' -exec rm -rf {} +
cd "$REPO_ROOT"
zip -r -X "$ZIP_PATH" "${FILES[@]}" >/dev/null
mkdir -p "$UNPACKED_DIR"
find "$UNPACKED_DIR" -mindepth 1 -delete
unzip -q "$ZIP_PATH" -d "$UNPACKED_DIR"
echo "Built: $ZIP_PATH"
echo "Unpacked: $UNPACKED_DIR"
