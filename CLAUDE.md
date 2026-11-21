# Slate

Browser-Extension, GitHub `ari92p/slate`, öffentlich und im Chrome Web Store.

- Nur Englisch: Es gibt nur `_locales/en`. Keine weiteren Sprachen oder sprachabhängige Funktionen vorschlagen.
  Neue UI-Texte nur in `_locales/en/messages.json`. Release-Notes auf GitHub ebenfalls Englisch.
- `dist/` enthält nur den aktuellen Build: `dist/slate-v<version>.zip` und den festen Ordner `dist/slate/`, den der Nutzer
  in Brave geladen hat. Nach Änderungen, die der Nutzer ausprobieren will, `npm run build` ausführen. Keine anderen
  Ordner in `dist/` anlegen.
- Ein Probe-Build mit unveränderter Versionsnummer überschreibt das ZIP dieser Version (`dist/` ist gitignored). Vorher
  die Version erhöhen oder das ZIP mit `gh release download` wiederherstellen.
- Release-Ablauf: Commit (ohne `Co-Authored-By`), Push auf `main`, danach nach Rückfrage
  `gh release create vX.Y.Z dist/slate-vX.Y.Z.zip`.
