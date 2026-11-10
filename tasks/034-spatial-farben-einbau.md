# Auftrag 034 — Spatial-Farben: s2_5 einbauen (nur Linear/Radial)

**Typ:** K, **Prüfstufe:** L3 (`bash tools/proof.sh L3 034`, dazu AUS-Pfad-Golden im Browser)
**Branch:** `task/034-spatial-farben-einbau` von `task/033-spatial-vier-ecken`. Kein Merge, kein Push. Bericht: `reports/034.md` (höchstens 30 Zeilen). Plan in 5 Zeilen vor der Arbeit. Regeln: `docs/agent-rules.md`.

## Entscheidung des Auftraggebers
Variante s2_5 aus reports/032.md und 033.md einbauen, nur für Linear und Radial (zwei Keyframes, Gewichte (1-t, t)). Bilinear (vier Eckfelder) bleibt unverändert beim Raster.
Bekannte, akzeptierte Verletzung: Dreieck +4 Byte, dLin 0.0656 (wie heute).

## Vorab
`git log -1 --oneline`, `git status --short` (leer). Per grep lesen: spatialMorphRenderFaceColors, spatialMorphRenderCornerField, spatialMorphRenderFillFaces in
core/spatial-morph-render.js; die s1/s2_5-Implementierung in tools/morph/measure-face-match.js (--spatial, Referenz, nicht neu erfinden); die Zuordnungsfunktionen aus Task 031 in
core/facecolor.js (_faceLinByCorrespondence u. a.). Bei zwei Wegen oder wenn der Einbau core/faces.js, core/tiling.js, core/spatial-morph.js oder eine der acht geschützten
Funktionen berührt: STOP mit 2 Optionen.

## Ziel (eine Kernänderung)
1. spatialMorphRenderFaceColors nutzt für Linear/Radial (zwei Keyframes) die Zuordnung (s1) statt des Rasters, ausgenommen Flächen unter 5 % der Zellfläche (40000 px² Bezug wie im
   Messskript): dort weiter Raster. spatialMorphRenderCornerField liefert zusätzlich die Flächenliste der Eckfelder (Cache-Signatur beachten). Bilinear: unverändert Raster.
2. Zustandslos, keine neuen Globals außer mit Präfix spatialMorph[A-Z]. Aufruf der Funktionen aus core/facecolor.js über typeof-Schutz (Abhängigkeit Spatial -> facecolor im Bericht nennen).
3. Standardpfad (Morph AUS) und alle Linien-Ausgaben byte-identisch.

## Nicht ändern
sketch.js (acht Funktionen byte-gleich), core/faces.js, core/tiling.js, core/spatial-morph.js, tools/morph/off-path-golden.json, Baselines. Pin-Tests (test-spatial-morph-render.js,
-color.js, -faces.js) nur in eigenem Commit mit Begründung.

## Prüfpunkte
1. Die 7 Fälle aus 029/030, Spatial, Schritt 0.05, Metrik wie 032 (sollPure, Flächen < 10 px² ausgenommen): Ergebnis gleich Messung s2_5 (6 von 7 bestehen, Dreieck +4 und 0.0656);
   Ziehen 0.01 Quadrat: 69 gegen 69.
2. Stern/Raute Spatial: dLin 0.317 -> ca. 0.107.
3. Bilinear: Farben identisch zum Stand vor der Arbeit (Test).
4. Linien, Flächengeometrie, Morph AUS: unverändert; AUS-Pfad-Golden im Browser 30/30.
5. Zeit je Frame: dichtes Hexagon höchstens das Anderthalbfache der Rasterzeit (Messung: 3,45 gegen 2,78 ms).
6. Schutz: `git diff --quiet task/033-spatial-vier-ecken..HEAD -- sketch.js core/faces.js core/tiling.js core/spatial-morph.js tools/morph/off-path-golden.json` Exit 0;
   geschützte Tests 57/57 und 61/61, Farborgel-Tests, test-p5-names.

## Sabotagen (höchstens 4, auf Kopien)
Raster statt Zuordnung; Schwelle 5 % ignorieren; Bilinear ebenfalls zuordnen; sRGB statt linear.

## Prüfung
`bash tools/proof.sh L3 034` plus AUS-Pfad-Golden im Browser (Verfahren: Kopfkommentar tools/morph/measure-off-path.js, Beispiel reports/011.md). Bericht: Hashes, Prüfpunkte, Sabotagen,
Testzahlen, Zeiten, /usage vorher/nachher, Abweichungen, was nicht im Browser gesehen wurde. Arbeit und Bericht getrennt committen, usage.csv-Zeile.
