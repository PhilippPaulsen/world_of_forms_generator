# Report 006a - Morph-Flächen (Typ K, L2)
**Status:** erledigt, L2 grün (93 Dateien, 61/61 und 57/57). Kein Merge, kein Push, keine Baseline.
**Hash:** vorher `3108480a` (`main`, Branch `task/006a-morph-flaechen`), nachher Arbeit `3e11072f`, Bericht danach.
Vorlauf: `last-green.json` zeigte `7ba41ee5`, deshalb L2 vorher auf `3108480a`: 92 Dateien PASS.

## Geändert (12 Dateien, +403/-18)
core/spatial-morph-render.js (+91), core/spatial-morph.js, ui-morph.js, ui-i18n.js, 4 Testdateien (neu: tools/morph/test-spatial-morph-faces.js), Claude.md (38 Zeilen), ROADMAP.md, docs/claude-context.md, tasks/006a-morph-flaechen.md.
Neu in `core/spatial-morph-render.js`: `spatialMorphRenderFacesWanted` (:231), `spatialMorphRenderTileFaces` (:239, `activeNetWarp = null` :245), `spatialMorphRenderFillFaces` (:268), Bedingung `facesDrawn` (:355), Status (:400), `faceStats` (:38).
Neuer Statuscode `netFacesNeedField` (Single/Tiled bei Flächen an): "Flächen im Morph nur bei Feld-Netz" / "Morph faces: field net only". Feld-Netz: "Netz verzerrt Linien", "Flächen folgen" ist überall weg.

## Prüfpunkte (tools/morph/test-spatial-morph-faces.js, 41/41)
1. Flächen aus, Tiled, Single, kein Netz, Kurve: `computeCellFaces` 0 Aufrufe, kein Fill, Linien-Hashes gleich dem Stand vor der Änderung (gepinnt, aus altem Render-Code gemessen). OK.
2. Morph AUS: 0 Aufrufe, Gesamtlog (Linien und Fills) gleich Stand vorher; die 30 AUS-Muster (OFF_GOLDEN) im bestehenden Test weiter grün. Das Pixel-JSON `off-path-golden.json` ist nur im Browser vergleichbar: dort nicht neu gemessen.
3. Feld-Netz: jede Kachel hat Flächen (9 von 9, 360 Flächen), alle geschlossen (CLOSE, >=3 Ecken, Fläche > 0), Grautöne; Quadrat in 6 Symmetrien x 2 Größen. OK.
4. Freie Enden: Eingaben unverändert (deep-equal), freie Enden im Frame mit/ohne Flächen gleich, freie Enden werden als Knoten mitgeschnitten. OK.
5. `activeNetWarp`, p5-Stil-Stack, `segmentCollector` wie vorher, auch bei Exception im Fill und in `computeCellFaces`. OK.
6. core/tiling.js und core/faces.js per sha256 gleich; `git diff main` für sketch.js, Baselines, off-path-golden.json leer. OK.
7. Stores vor/nach deep-equal; `faceAssignmentsFor`, `applyAssignmentsLazily`, `ensureDefaultGrayFill` 0 Aufrufe. OK.

## Sabotagen (alle rot)
1 Feld-Bedingung weg: rot (4 Prüfungen). 2 `activeNetWarp` nicht auf null: rot (1). 3 `ensureDefaultGrayFill` im Morph: rot (1). 4 finally im Draw entfernt: rot (3, im Render-Test 2). 5 Berechnung im AUS-Pfad: rot (1). Echte Dateien unberührt.

## Testzahlen
faces 41, test-morph-view 98 (97, +1), test-i18n 56 (52, +4), test-spatial-morph-render PASS; angepasst: Textstellen und Codeliste.

## Abweichungen und Auslegungen
- "Flächen aktiv" = alle Keyframes im Plan zeigen Flächen (Basis: `showFaces`, Layer: eigenes `showFaces`).
- Hinweis `netFacesNeedField` nur, wenn Flächen an sind; ohne Flächen bleibt "Netz verzerrt Linien".
- Layer-Sheet bekommt `gridMatchesBase: true`: der Feld-Warp ist für genau dieses Gitter gebaut. Synthetische Knoten sind `free: true`, damit die Gruppe nur aus echten Knoten entsteht.
- Das Netz gibt es nur für Quadrate: Dreieck/Hexagon haben nie Flächen im Morph.
- Fülltöne sind die Standard-Grautöne nach Orbit; Randlinien zählen als Orbits, es ist nicht ein einziges Grau.

## Offene Punkte
- Nicht im Browser angesehen; Kosten ca. 22 ms für 9 Kacheln (Testszene), kein Cache.
- Rand-verschobene Enden: Flächen aus der Identität, Symmetriekopien nutzen op-eigene Gewichte; Kanten können minimal von Linien abweichen.
- Nicht einzeln sabotiert: finally in `spatialMorphRenderTileFaces` und `pop` in `FillFaces`.
- Farbe im Morph (006b) offen.
