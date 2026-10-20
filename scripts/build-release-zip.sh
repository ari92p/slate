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

mkdir -p "$DIST_DIR"
rm -f "$ZIP_PATH"
cd "$REPO_ROOT"
zip -r -X "$ZIP_PATH" "${FILES[@]}" >/dev/null
echo "Built: $ZIP_PATH"
