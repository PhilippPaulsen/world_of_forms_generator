# Auftrag 084 — Aufräumen (Typ K, L2)

**Arbeitsordner (nur dieser):** …/world_of_forms_generator-farborgel-generator-integration, main nach Merge 083. Zuerst `pwd`, `git rev-parse --short HEAD`, `ls -ld core` nennen. core/ muss beschreibbar sein, sonst STOP.
**Branch:** task/084-aufraeumen von main. tasks/084-aufraeumen.md VOR der Arbeit anlegen (Inhalt = dieser Auftrag), reports/084.md am Ende.

**Regel:** Ein Eintrag = ein Commit, jeder mit eigener Messung vorher/nachher. Verhalten bleibt byte-gleich, außer ausdrücklich genannt. Wird ein Eintrag riskanter als gedacht (Aufrufer in der App, Export/Session betroffen, Golden ändert sich): diesen Eintrag NICHT umsetzen, im Bericht als „nicht umgesetzt, Grund“ listen. Kein Eintrag erzwingt einen anderen.

**Einträge:**
1. **Alte Namensfunktionen** (core/orbits.js, Reste aus der Zeit vor Namen v2): per git grep alle Aufrufer je Funktion belegen. Nur entfernen, was außerhalb von Tests/Messskripten keinen Aufrufer hat. Tests, die sie pinnen: begründet anpassen (eigener Commit), nicht still löschen.
2. **Dauerschreiber** (Muster aus 071c): Im Browser per MutationObserver 3 s lang Ruhe, dann nach jedem draw() geschriebene DOM-Knoten/Attribute zählen und listen (Knoten, Wert, Häufigkeit). Nur Schreibstellen reparieren, die jeden Frame denselben Wert schreiben („Wert nur bei Änderung“, Wertvergleich, wie 071c); mit Zählertest je Stelle. Alles andere (echte Animation, Canvas) bleibt. Ergebnis: Liste vor/nachher.
3. **Umbruch Info-Karte** (Tooltip/Info-Button, Hinterreiter-Namen, Quellform): Umbruch und Breite bei 1280, 768, 390 px prüfen, nur CSS/Text anpassen, wenn etwas überläuft oder abgeschnitten wird. Screenshots vorher/nachher, kein Eingriff, wenn nichts schlecht ist.
4. **`beyondCeiling` und `legacyC1`:** NICHT entfernen. Nur messen: Aufrufer (Datei:Zeile, App oder nur Tests/Messskripte), und im Bericht empfehlen, ob und wie sie später fallen können.
5. **ROADMAP-Stand:** ROADMAP.md und CLAUDE.md „Now“ auf den Stand von main bringen (nicht quadratische Fläche fertig, Farbmapping, offene Kleinigkeiten). Keine neuen Aufgaben erfinden.

**Nicht ändern:** core/faces.js, core/tiling.js, core/facecolor.js, die acht geschützten Funktionen in sketch.js (byte-gleich), tools/morph/off-path-golden.json, Baselines, Katalog. Pins nur mit eigenem Commit und Begründung. `?v=` gemeinsam bumpen, falls sich eine ausgelieferte Datei ändert.

**Prüfpunkte:**
1. Alle Messskripte (g5a/g5b/g6a/g6b/lage2-app/size-change/color-resize) byte-gleich zu main.
2. Je Eintrag: Messung vorher/nachher als Zahl (Aufrufer, Schreibzähler, Zeilenumbrüche).
3. Browser: AUS-Pfad-Golden 30/30 (ruhiges System, frische Seite), Konsole fehlerfrei, Namensanzeige und Tooltip an drei Mustern unverändert (Screenshot).

**Sabotagen (auf Kopien, je rot):** gelöschte Funktion hat doch einen Aufrufer (Test rot); Dauerschreiber-Reparatur schreibt wieder bei jedem draw (Zählertest rot); Wertvergleich unterdrückt eine echte Änderung (Test rot).

**Prüfung:** `bash tools/proof.sh L2 084` plus AUS-Pfad-Golden im Browser einmal.
**Bericht reports/084.md (Länge begrenzt):** je Eintrag umgesetzt oder nicht, mit Zahlen; Pins (alt → neu, Begründung); Sabotagen; /usage vorher/nachher; was nicht im Browser gesehen wurde. Ungemergt, kein Push.
