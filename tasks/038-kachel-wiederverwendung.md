# Auftrag 038 — Kachel-Wiederverwendung im räumlichen Morph

**Typ K, Prüfstufe L3.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/038-kachel-wiederverwendung.md mit diesem Text an. Bericht: reports/038.md (höchstens 30 Zeilen). Branch: task/038-kachel-wiederverwendung von main (nach Merge von 037). Kein Merge, kein Push. Plan in 5 Zeilen vor der Arbeit.

**Befund (reports/037.md, gemessen):** Browser-Basis Hexagon-artig, 2 Ebenen je 2 Linien, 2 Farben: Median 429 ms, p90 493 ms je draw(). Node: Flächen (computeCellFaces) ca. 55 %, Farbe 35 bis 55 %, Linien+Zeichnen unter 10 bis 25 %. Je Frame nur 5 (linear) bzw. 8 (radial) verschiedene Flächen-Eingaben bei 143 Kacheln (Hexagon), 11/20 bei 420 (Dreieck), 5/10 bei 121 (Quadrat). Hebel (a): Flächen und Farbe pro Kachel innerhalb eines Frames über einen Schlüssel wiederverwenden. Ersparnis geschätzt ca. 95 % von Flächen+Farbe (ungemessen).

**Stufe 1 (Prototyp, kein Eingriff in core/):** Im Messskript tools/morph/measure-frame-profile.js (oder neues tools/morph/measure-tile-reuse.js) den Schlüssel bestimmen (kanonische Linien je Kachel gerundet plus Gewichte plus alles, was Flächen/Farbe beeinflusst: Netz-Warp, Modus, Kachelposition/Orientierung, Symmetrieelement, Keyframe-Felder), Wiederverwendung simulieren, Ersparnis in ms je Frame messen (Hexagon typisch/dicht, Dreieck, Quadrat, linear/radial) und die Ausgabe auf Gleichheit prüfen (Polygonlisten und Fill-Hex je Kachel byte-gleich, Kachelposition/Spiegelung korrekt angewendet). Findet sich ein Schlüssel, der verschiedene Ausgaben zusammenfasst: STOP mit Befund.
**Stufe 2 (nur wenn Stufe 1 gleiche Ausgabe und Ersparnis über 50 % zeigt):** Einbau in core/spatial-morph-render.js:spatialMorphRenderDraw (Schleife um spatialMorphRenderTileFaces/FaceColors, nur FillFaces je Kachel), Cache nur innerhalb eines Frames (kein Zustand über Frames), Präfix spatialMorph[A-Z]. Bei zwei Wegen oder wenn der Einbau core/faces.js, core/facecolor.js, core/tiling.js, core/spatial-morph.js oder eine der acht geschützten Funktionen berührt: STOP mit 2 Optionen.

**Nicht ändern:** sketch.js (acht Funktionen byte-gleich), core/faces.js, core/facecolor.js, core/tiling.js, core/spatial-morph.js, tools/morph/off-path-golden.json, Baselines. Pin-Tests nur in eigenem Commit mit Begründung.

**Prüfpunkte (Stufe 2):**
1. Ausgabe byte-gleich zu vorher: Polygonlisten, Fill-Hex, Linien, Reihenfolge, über alle Fälle aus 037, linear und radial, Schritt 0.01, mit Netz-Feld und mit SVG-Export (035/036).
2. Zeit je Frame (Node): Hexagon typisch, dicht-8, Dreieck, Quadrat, gegen Stand vor der Arbeit; Ziel Ersparnis nahe der Schätzung.
3. Zustandslos über Frames, kein Wachstum (Cache leer nach dem Frame); Exception im Frame lässt keinen Rest zurück.
4. AUS-Pfad-Golden im Browser 30/30; Browser-Messung wie in 037 (draw-Median) vorher/nachher, Muster nennen; falls nicht möglich "nicht gemessen".
5. Schutz: git diff --quiet main..HEAD -- sketch.js core/faces.js core/facecolor.js core/tiling.js core/spatial-morph.js tools/morph/off-path-golden.json Exit 0; geschützte Tests 57/57 und 61/61, test-p5-names, Farborgel-Tests.

**Sabotagen (höchstens 4, auf Kopien):** Schlüssel ohne Gewichte; Schlüssel ohne Kachelorientierung; Cache über Frames behalten; Netz-Warp aus dem Schlüssel.

**Prüfung:** bash tools/proof.sh L3 038 plus AUS-Pfad-Golden im Browser. Bericht: Hashes, Prüfpunkte, Sabotagen, Testzahlen, Zeiten, /usage vorher/nachher, Abweichungen, was nicht im Browser gesehen wurde. Arbeit und Bericht getrennt committen, usage.csv-Zeile.
