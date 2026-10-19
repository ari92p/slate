# Datenschutzerklärung

_Stand: 19. Oktober 2026_

Slate durchsucht den Verlauf des aktuellen Browserprofils lokal nach Domains aus den aktiven Listen. Wenn die Cookie-Bereinigung ausdrücklich aktiviert wurde, liest und entfernt Slate zusätzlich passende Cookies.

## Verarbeitete und gespeicherte Daten

Verlauf und Cookies werden ausschließlich im Browser verarbeitet. Slate überträgt sie weder an den Entwickler noch an Analysedienste oder andere Dritte. Lokal gespeichert werden die Einstellungen, Blacklist, Whitelist, heruntergeladene Quellenlisten und ein zusammengefasster Status der letzten Prüfung.

## Externe Listen

Slate ruft die öffentlichen Domainlisten von HaGeZi und Block List Project über GitHub ab. Eigene Filterlisten werden von der vom Nutzer eingetragenen HTTPS-Adresse geladen. Der jeweilige Betreiber erhält dabei die üblichen Verbindungsdaten wie die IP-Adresse. Verlauf, Cookies und eigene Regeln werden diesen Anfragen nicht beigefügt. Die Antworten werden nur als Daten eingelesen; Slate führt keinen externen Code aus.

## Berechtigungen

- `history`: passende Verlaufseinträge finden und entfernen
- `storage` und `unlimitedStorage`: Einstellungen und große Domainlisten lokal speichern
- `alarms`: optionale Prüfintervalle und tägliche Listenaktualisierung
- `contextMenus`: Einstellungen über das Symbolmenü öffnen
- `cookies` und Websitezugriff: optional und erst nach ausdrücklicher Aktivierung der Cookie-Bereinigung
- Websitezugriff auf eine eigene Listenadresse: wird beim Hinzufügen dieser Filterliste separat angefordert

Änderungen an dieser Erklärung werden in diesem Repository veröffentlicht.
