# Auftrag 058 — G3 Lage-2-Builder

**Typ K, Prüfstufe L3.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/058-g3-lage2-builder.md mit diesem Text an. Bericht: reports/058.md (höchstens 30 Zeilen). Branch: task/058-g3-lage2-builder von main (erwarteter HEAD 4ab7654d). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Grundlage:** reports/055.md (§1 bis §3, G3), reports/056.md (Risiken 1, 2, 7; Fehlliste G3), reports/057.md, Orakel tools/gitter/measure-name-rule.js (gridNodes: Lage 2 = Lage 1 plus Mittelpunkte der kleinsten Maschen). Lage 2 bleibt NICHT live (validateGridSpec lehnt sie in der App weiter ab, Freigabe erst später).

**Ziel (eine Kernänderung):** Reiner Builder für Lage 2 in core/forms.js: buildGridNodes(spec) und projectGridNodes (u,v -> x,y), buildGrid(spec, view) liefert für lage 2 die zusätzlichen Knoten (IDs: Lage-1-IDs unverändert, neue Knoten angehängt). Knoten tragen u, v (dimensionslose Gitterkoordinaten, ganzzahlig skalierte Schlüssel, Nenner 6, keine Pixel-Rundung). core/symmetry.js: canonicalGridFrame(gridGeometry): Transformation Canvas (y-down) <-> Orakel (y-up), mit Test. Lage 2 nur über einen internen Schalter (enforceLage2 oder Parameter) erreichbar, nicht aus der UI.

**Aus der Gegenlesung zu beachten:** y-Achse (Risiko 1): Test mit orientierten konkreten Knotenpaaren gegen das Orakel, nicht nur Zählungen; Sabotage dy-Vorzeichen. Hex Ordnung 1 hat 7 Knoten (Mitte). Lage-2-Maschentypen: Dreieck n² + n² ... (Formeln aus 055 §1: Dreieck L2 = L1 + n², Quadrat L1 + n², Hex L1 + 6n²). layerGrid-Cross-Shape-Zweig (layerShape != baseShape) und completeEdgeToRegularPolygon in Lage 2 messen oder als nicht unterstützt festhalten. Lastmessung: je Form die Grenzgitter (Lage 2: triangle/square n 5, hex n 2 sowie die Quellgrenzen bis n 8) Knotenzahl, Paarzahl, Bahnzahl, Build-Zeit, Peak-Speicher (Node) und Dreierkombinationen; Ergebnis als Tabelle im Bericht, Empfehlung für die Limits.

**Nicht ändern:** acht geschützte Funktionen in sketch.js (byte-gleich), core/faces.js, core/facecolor.js, core/tiling.js, tools/morph/off-path-golden.json, Baselines. Lage-1-Ausgabe (Koordinaten, IDs, Reihenfolge) bleibt byte-gleich zu 4ab7654d. Pins nur mit eigenem Commit und Begründung. ?v= gemeinsam bumpen (Muster 8 Ziffern + Buchstaben, z. B. 20261113gridfb).

**Prüfpunkte:** (1) Lage 1 byte-gleich (Test gegen alte forms.js aus git, wie 057). (2) 12 Referenzgitter: Knotenzahlen und Bahnen gleich dem Orakel (Zuordnung nach Koordinaten, nicht nach IDs); Formeln für n = 1 bis 8, alle drei Formen. (3) Gruppenabschluss der Lage-2-Knotenmenge unter 3*/4*/6*. (4) Orientierte Paare Canvas gegen Orakel (y-Spiegelung). (5) Größe, Translation, Canvas-y-Spiegelung ändern u, v nicht. (6) AUS-Pfad-Golden im Browser 30/30. (7) Geschützte Tests 61/61 und 57/57, test-p5-names.

**Sabotagen (je auf Kopien):** abwärts gerichtete Maschen auslassen; doppelte Mittelpunkte nicht entfernt; dy-Vorzeichen falsch; Lage 2 in der App freigeschaltet.

**Prüfung:** bash tools/proof.sh L3 058 plus AUS-Pfad-Golden im Browser (Verfahren: Kopfkommentar tools/morph/measure-off-path.js). Bericht: Hashes, Lasttabelle, Messwerte, Sabotagen, /usage vorher/nachher, was nicht im Browser gesehen wurde.
