# Auftrag 060 — G5a Basisgitter: eine Wahrheit gridSpec

**Typ K, Prüfstufe L3.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/060-g5a-basis-gridspec.md mit diesem Text an. Bericht: reports/060.md (höchstens 30 Zeilen). Branch: task/060-g5a-basis-gridspec von main (erwarteter HEAD 88a73ecb). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Grundlage:** reports/055.md (§5, §6, G5), reports/056.md (G5 zu groß, Teilung G5a/G5b; Falschangabe 2: weitere E-Produzenten; Widerspruch tiling vs. nodeCount; Risiko 3), reports/057.md (Fassade, setGrid, gridRevision, Legacy-Sonderfall c = 1). Entscheidungen: nodeCount bleibt als ABGELEITETE interne Brücke (core/tiling.js unverändert, liest weiter das globale nodeCount); Lage 2 bleibt gesperrt.

**Ziel G5a (eine Kernänderung):** Das Basisgitter hat EINE schreibbare Wahrheit: gridSpec (aus G2). nodeCount wird nur zentral aus gridSpec projiziert (setGrid/rebuildGrid), nirgends sonst geschrieben.
1. Schritt 1, Messung vor jeder Änderung: per git grep alle SCHREIBSTELLEN von nodeCount (core/, sketch.js, ui*.js, session-apply.js) und alle E-Produzenten (nodeCount - 1 / nodeCountValue - 1: netWarpForBase, netWarpBaseNow, netAuthorWarpActive, netGridLines, spatialMorphRenderDraw, buildExportData, drawNetLinesOverlay, sketch.js setup) listen. Weicht die Liste stark von reports/056.md ab oder ergeben sich zwei Wege: STOP mit 2 Optionen.
2. Alle Schreibstellen auf einen Weg über setGrid/rebuildGrid; Eingabefeld und Session-Restore setzen gridSpec, die Projektion nodeCount folgt. Kein Zwei-Wege-Sync pro Frame.
3. Alle E-Produzenten über eine Funktion getGridDivisions(gridSpec) (= ordnung; Quadrat E = ordnung, auch bei Lage 2). Die Legacy-Fassade netWarpForBase(...) bleibt mit alter Signatur, rechnet intern einmal c-1 bzw. delegiert; c = 1 (Dreieck/Quadrat) behält das heutige Verhalten (E = 0, kein Warp). Hex ohne Warp bleibt.
4. Session: gridRevision bleibt beim Rollback unberührt (wie 057).

**Nicht ändern:** acht geschützte Funktionen in sketch.js (byte-gleich), core/faces.js, core/facecolor.js, core/tiling.js, tools/morph/off-path-golden.json, Baselines. Keine Ebenen-Umstellung (G5b), keine neue UI. Pins nur mit eigenem Commit und Begründung (erwartet: test-nodecount-limits, test-layernode-hit, netwarp-Quelltext-Pins; Liste im Bericht). ?v= gemeinsam bumpen (z. B. 20261115gridfd).

**Prüfpunkte:** (1) Verhalten byte-gleich: Gitter, Linien, Netz-Linien und -Flächen, Export (SVG/JSON) für alle Formen, nodeCount 1 bis 7, Netzarten und Größen (Test gegen alten Stand aus git). (2) Morph-Frames t = 0, .25, .5, .75, 1 byte-gleich. (3) Genau eine Schreibstelle von nodeCount (Quelltext-Test über die Dateien). (4) getGridDivisions für alle Formen c = 1 bis 7 gleich dem alten E. (5) Session-Roundtrip. (6) AUS-Pfad-Golden im Browser 30/30. (7) Geschützte Tests 61/61 und 57/57, test-p5-names, Netzwarp-Schutztests unverändert.

**Sabotagen (je auf Kopien):** E = ordnung - 1 doppelt gerechnet; c = 1 auf E = 1; nodeCount an zweiter Stelle geschrieben (Drift); gridRevision beim Rollback zurückgedreht.

**Prüfung:** bash tools/proof.sh L3 060 plus AUS-Pfad-Golden im Browser (Verfahren: Kopfkommentar tools/morph/measure-off-path.js). Bericht: Hashes, Schreibstellen- und Produzentenliste, Messwerte, Sabotagen, /usage vorher/nachher, was nicht im Browser gesehen wurde.
