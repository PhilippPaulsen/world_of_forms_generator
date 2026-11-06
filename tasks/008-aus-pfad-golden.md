# 008 AUS-Pfad-Golden im Browser
Typ: R (nur messen, keine Codeänderung)
Stufe: keine
Git: Branch task/007-merge-pruefung-006 (HEAD 2e8f0378) auschecken, nicht committen außer
     reports/008.md plus diese Task-Datei auf neuem Branch task/008-aus-pfad-golden von dort.
     git status vorher leer (außer dieser Task-Datei), sonst STOP. Kein Merge, kein Push.
Regeln: docs/agent-rules.md. Keine Baselines aufnehmen, keine Dateien ändern.

Aufgabe: das Verfahren aus dem Kopfkommentar von tools/morph/measure-off-path.js ausführen:
1. Eigenen Server aus dem Repo-Root auf Port 8962 starten (Port 8961 und den node-Prozess auf 64269
   nicht anfassen). Markerdatei im Root, um den Document Root zu bestätigen.
2. Seite im Browser-Pane öffnen, sichtbar (document.visibilityState prüfen), Fehler-Listener
   (error, unhandledrejection) VOR den Seiten-Skripten einbauen.
3. measure-off-path.js auswerten, `await measureOffPath({})` zweimal; der zweite Lauf zählt.
4. Ergebnis mit `pixelHashes` in tools/morph/off-path-golden.json vergleichen: erwartet 30 gleiche
   Einträge im Format hash:länge.
5. Alles beenden, was du gestartet hast, und auflisten, was noch läuft.

Bei Abweichung: STOP, nenne Anzahl und Namen der abweichenden Einträge, rate keine Ursache.
Zusätzlich zum Vergleich: gemeldete Fehler der Listener.
Bericht reports/008.md, höchstens 15 Zeilen: Ergebnis (30 von 30 gleich: ja/nein), Fehlerliste,
Browser und Pixeldichte, /usage vorher und nachher.