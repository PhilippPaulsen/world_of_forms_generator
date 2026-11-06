# 014 Merge-Prüfung 013 (mit 012), ROADMAP, AUS-Pfad-Golden im Browser
Typ: M
Stufe: L3
Git: Vorbereitung: neuer Branch task/014-merge-pruefung von task/013-morph-flaechen-hex-tri
     (HEAD a96db730), darauf `git merge --no-ff --no-edit task/012-inventur-hexagon`
     (bringt reports/012.md und die Task-Datei 012; bei Konflikt STOP).
     Erlaubte weitere Commits: (1) ROADMAP.md, (2) reports/014.md plus diese Task-Datei.
     Kein Merge nach main, kein Push. git status vorher leer (außer dieser Task-Datei), sonst STOP.
Regeln: docs/agent-rules.md. Keine Baselines aufnehmen, kein Code ändern.
Zeilenangaben aus älteren Berichten nicht übernehmen, immer mit grep suchen.
Arbeitsordner: das Repo-Root.

Aufgaben:
1. `tools/proof.sh L3 014` (volle Suite, einmal, bis zum Ende). Die zwei geschützten Tests mit
   eigener Zahl melden.
2. `git diff --stat main..HEAD`: jede geänderte Datei mit dem Commit, aus dem sie stammt.
   Erwartet: core/spatial-morph-render.js, tools/morph/*, ROADMAP.md, tasks/, reports/.
   Weitere Dateien nennen; liegt eine in Aufgabe 3, STOP.
3. `git diff main..HEAD --quiet -- sketch.js core/tiling.js core/faces.js core/facecolor.js
   tools/morph/off-path-golden.json` muss Exit 0 liefern. Für core/spatial-morph-render.js den
   Diff gegen main zusammenfassen: nur die Formbedingung oder auch mehr?
4. Baselines NICHT aufnehmen. grep in baseline-cleanup-11.json und baseline-phone-5.json nach allen
   Statustexten, die seit main neu oder geändert sind (aus ui-i18n.js und ui-morph.js ableiten;
   sind diese Dateien unverändert, das sagen). Betroffen ja/nein, welcher Snapshot.
5. ROADMAP.md, Eintrag "Spatial morph: staged plan", knapp ergänzen oder korrigieren
   (der Block aus 013 steht schon; nur Fehlendes ergänzen):
   - Flächen und Farbe bei Hexagon und Dreieck erledigt (Task 013), Sichttest: Nähte beim Dreieck
     kaum sichtbar, gelegentliche Blitzer beim Ziehen, Farben am Ende nur bei ähnlichen Mustern stimmig.
   - bekannte Einschränkungen: Frame-Zeit bei Hexagon/Dreieck mit Symmetrie 520 bis 860 ms in Node
     (420 Kacheln), im Browser relativ flüssig; Optionen: Flächen pro Kachel über Gewichte
     wiederverwenden (1 bis 2 Commits), Cache über Frames (2 bis 3 Commits); Entscheidung: vorerst
     nicht optimieren. Sprunglauf dense-16 beim Hexagon nach über 30 Minuten abgebrochen.
   - reports/012.md (Inventur) erwähnen.
6. AUS-Pfad-Golden im Browser, Verfahren aus dem Kopfkommentar von tools/morph/measure-off-path.js
   (wie Task 011 / reports/011.md):
   Eigenen Server aus dem Repo-Root auf Port 8962 mit --bind 127.0.0.1 (Port 8961 und node-Prozess
   auf 64269 nicht anfassen), Markerdatei, Seite sichtbar (document.visibilityState),
   error- und unhandledrejection-Listener vor den Seiten-Skripten, `await measureOffPath({})` zweimal,
   zweiter Lauf gegen pixelHashes in tools/morph/off-path-golden.json: erwartet 30 von 30 gleich.
   Danach alles beenden, was du gestartet hast, und auflisten, was noch läuft.
   Bei Abweichung: STOP, Anzahl und Namen nennen, keine Ursache raten.
7. /usage vorher und nachher im Bericht.

Bericht reports/014.md, höchstens 30 Zeilen: Status, Zahlen, Ergebnis zu 2 bis 6.