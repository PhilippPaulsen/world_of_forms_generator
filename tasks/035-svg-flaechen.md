# Auftrag 035 — SVG-Export: Flächen

**Typ K, Prüfstufe L2.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/035-svg-flaechen.md mit diesem Text an. Bericht: reports/035.md (höchstens 30 Zeilen). Branch: task/035-svg-flaechen von main (erwarteter HEAD 1e635820). Kein Merge, kein Push. Plan in 5 Zeilen vor der Arbeit.

**Befund (reports/025.md):** core/export.js:generateSVGString schreibt Hintergrund, Linien-<g> (seit 024 mit lineStyle), Knoten, Rahmen, aber keine Flächen. Flächen laufen über zwei Polygon-Zeichner: core/faces.js:drawFaceFillsAtTile und core/spatial-morph-render.js:spatialMorphRenderFillFaces (fill -> beginShape -> vertex -> endShape(CLOSE)). Empfehlung 025: Polygon-Sammler in generateSVGString durch temporäres Abfangen von fill/beginShape/vertex/endShape während drawTessellation(), ohne Eingriff in faces/facecolor/tiling.

**Vorab:** `git log -1 --oneline`, `git status --short` (leer). Per grep lesen: generateSVGString, exportSVG, svgPathCollector in core/export.js und core/curves.js; tools/morph/measure-color-jumps.js:build (dort wird fill/beginShape/vertex/endShape bereits abgefangen: Referenz); wie Linien-Stärke und lineStyle.visible im SVG behandelt sind (024). Bei zwei Wegen oder wenn der Eingriff core/faces.js, core/facecolor.js, core/tiling.js, core/spatial-morph-render.js oder eine der acht geschützten Funktionen berührt: STOP mit 2 Optionen.

**Ziel (eine Kernänderung, nur core/export.js):**
1. Während generateSVGString drawTessellation() ausführt, werden fill(c), beginShape/vertex/endShape(CLOSE) abgefangen (Wiederherstellung der p5-Funktionen im finally, auch bei Exception) und als <polygon points fill> in Zeichenreihenfolge gesammelt. Keine Zeichnung auf dem Live-Canvas während des SVG-Baus.
2. SVG-Schichtung: Hintergrund, Flächen-Gruppe, Linien-Gruppe (nur lineStyle.visible), Knoten, Rahmen. Flächenfarben als Hex (rgba/Alpha beachten: Alpha als fill-opacity). face.highlight (stroke/strokeWeight) nicht exportieren, im Bericht nennen.
3. Nur wenn Flächen aktiv sind (showFaces); sonst keine Polygon-Gruppe, SVG byte-identisch zum Stand vor der Arbeit.
4. Spatial Morph bleibt wie heute (Frühabbruch in spatialMorphTryDraw: normales Muster); das ist K2, nicht hier.
5. Der Haarriss-Schutz (stroke=fill, 0.5) nur falls im Test ein Spalt zwischen Nachbarflächen messbar ist; sonst weglassen.

**Nicht ändern:** sketch.js (acht Funktionen byte-gleich), core/faces.js, core/facecolor.js, core/tiling.js, core/spatial-morph-render.js, core/spatial-morph.js, core/curves.js, tools/morph/off-path-golden.json, Baselines. Pin-Tests nur in eigenem Commit mit Begründung.

**Prüfpunkte:**
1. Showfaces AUS: SVG byte-identisch zu vorher (Vergleich mit altem export.js im Test).
2. Showfaces AN: Polygon-Anzahl und fill-Hex im SVG gleich den abgefangenen Canvas-Aufrufen (Normalbild, mit Ebene, Farborgel-Beispiel, Netz-Feld, Playback-Zwischenstellung); Reihenfolge gleich.
3. Rasterung: SVG gegen Canvas-Pixelvergleich, falls ein Headless-Renderer im Repo existiert (sonst im Bericht "nicht gemessen"); alternativ Flächeninhalt je Polygon gegen Canvas-Polygone.
4. Linien AUS (024): Flächen bleiben, Linien fehlen; Linienstärke folgt dem Slider.
5. p5-Funktionen nach dem Export wiederhergestellt (auch bei Exception, Test); Live-Canvas während des Exports unverändert (keine Zeichenaufrufe).
6. Dateigröße: Polygonzahl und Bytes für ein dichtes Muster im Bericht nennen.
7. Schutz: `git diff --quiet main..HEAD -- sketch.js core/faces.js core/facecolor.js core/tiling.js core/spatial-morph-render.js core/spatial-morph.js core/curves.js tools/morph/off-path-golden.json` Exit 0; geschützte Tests 57/57 und 61/61, test-p5-names, Farborgel-Tests.

**Sabotagen (höchstens 4, auf Kopien):** p5-Wiederherstellung entfernen; Reihenfolge Linien vor Flächen; Flächen bei showFaces AUS exportieren; Alpha ignorieren.

**Prüfung:** `bash tools/proof.sh L2 035`. Bericht: Hashes, Prüfpunkte, Sabotagen, Testzahlen, Dateigrößen, /usage vorher/nachher, Abweichungen, was nicht im Browser gesehen wurde. Arbeit und Bericht getrennt committen, usage.csv-Zeile.
