# Auftrag 064 — G7a Katalog v2

**Typ K, Prüfstufe L3.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/064-g7a-katalog-v2.md mit diesem Text an. Bericht: reports/064.md (höchstens 30 Zeilen). Branch: task/064-g7a-katalog-v2 von main (erwarteter HEAD 59338562). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Grundlage:** reports/055.md (§3 G7, §6 Gallery), reports/056.md (G7 geteilt in G7a/G7b; Fehlliste G7: ostwald-backfill.csv, MAX_COMBINATIONS_TO_GENERATE), reports/059.md, reports/063.md (Transport v2, legacyCatalogReader als Schuld bis G7b), reports/058.md (Lastmessung: Dreierkombinationen ab Hex n>=3 nicht aufzählbar). Entscheidungen: kleiner Abnahmekatalog, keine Massenerzeugung; Rückwärtskompatibilität entfällt; Lage 2 bleibt in der App gesperrt.

**Ziel G7a (eine Kernänderung):** Katalog-Erzeugung und Formorgel auf v2.
1. Schritt 1, Messung vor jeder Änderung: per git grep alle Stellen von generateJob, assertNotDegenerateOrder, catalogRelativePath, buildManifestEntry, kCombinations, createShapeOrderRenderer, buildOrbitTable, renderFullTessellationSVG, entryCatalogPath, patternNameFor, catalogEntryGeneratorUrl, renderOrbitGrid, loadBackfill, backfillBadgeFor, MAX_COMBINATIONS_TO_GENERATE, manifest.jsonl, ostwald-backfill.csv (tools/gallery/*, gallery*.js, gallery.html) listen. Weicht stark von reports/056.md ab oder zwei Wege: STOP mit 2 Optionen.
2. Neuer Katalog unter gallery/v2/{shape}/{ordnung}/lage{lage}/k{count}/{3|4|6}star/{tokens}.svg (Tokens segmentkodiert), Manifest v2 (grid, group, lines, count, path, rendererVersion). Gemeinsamer Codec für Pfad/Namen (keine Kopie in gallery.js und tools). Kombinationen über sortierte Linienschlüssel (compareLineKeys), keine Orbitnummern; assertNotDegenerateOrder entfällt zugunsten validateGridSpec.
3. Deterministischer Abnahmekatalog: jede Form, Lage 1, Ordnungen 1 bis 3, k = 1 vollständig, k = 2 ausgewählt (feste Regel, im Bericht). Massenerzeugung nicht Teil dieses Auftrags. Der alte Katalog bleibt in gallery/ unangetastet bis G7b.
4. gallery.js: Viewer und Filter lesen das Manifest v2; Links "Open in generator" und "Copy pattern" schreiben v2 (?v=2&..., Paste {version:2,...}). Backfill-Zuordnung (ostwald-backfill.csv) auf Schlüssel umstellen oder, falls nicht ableitbar, ausdrücklich deaktivieren und im Bericht nennen (keine stillen Verluste).
5. legacyCatalogReader bleibt bis G7b.

**Nicht ändern:** acht geschützte Funktionen in sketch.js (byte-gleich), core/faces.js, core/facecolor.js, core/tiling.js, tools/morph/off-path-golden.json, Baselines, alter Katalog gallery/ (Dateien). Pins nur mit eigenem Commit und Begründung. ?v= gemeinsam bumpen (z. B. 20261119gridfh). Clean-Export-Check bei Skriptänderung.

**Prüfpunkte:** (1) 0 fehlende Manifestpfade, 0 doppelte Schlüssel. (2) Pro Form und Ordnung: Vorschau-SVG = Generator-Ausgabe (Geometrie gleich dem Live-Generator über den Transport-Link, Roundtrip URL/Paste). (3) Namen im Katalog = formatGridName der Quelle. (4) Filter und Ansicht der Formorgel funktionieren auf dem Abnahmekatalog (test-gallery-smoke, -globals auf Fixture v2). (5) Backfill: Ergebnis dokumentiert. (6) AUS-Pfad-Golden im Browser 30/30; geschützte Tests 61/61 und 57/57, test-p5-names, test-i18n.

**Sabotagen (je auf Kopien):** Lage aus dem Pfad entfernt; Stringsortierung der Tokens; altes Manifest eingeschleust; Pfadcodec in gallery.js abweichend.

**Prüfung:** bash tools/proof.sh L3 064 plus AUS-Pfad-Golden im Browser. Bericht: Hashes, Stellenliste, Messwerte, Katalogumfang (Dateien, MB), Sabotagen, Backfill, /usage vorher/nachher, was nicht im Browser gesehen wurde.
