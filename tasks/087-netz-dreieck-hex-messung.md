# Auftrag 087 — Netz-Feld: Dreieck, Sechseck und gerade Größen (Typ R, nur lesen)

Arbeitsordner: world_of_forms_generator-farborgel-generator-integration, main nach Merge 086 (149dad21). Branch task/087-netz-dreieck-hex-messung. Ausnahme vom Schreibverbot: dieses Dokument, reports/087.md, tools/grid/measure-net-tri-hex.js. Kein Merge, kein Push, keine Änderung in core/, sketch.js oder an Tests. docs/quellen/ nicht committen.

Anlass: Feld-Netz (Netzart 1.1) heute nur Quadrat, ungerade X,Y ∈ {3,5,7,9} (086). Gewünscht: (N3) Feld auch für Dreieck und Sechseck, (N1b) Feld auch bei geraden Größen.

Zu messen: 1. Quelle Band II S. 10–22 (110–122.png, Gerstner_01–03): Netzfamilien △N, △TN, △GN, △MN, *N, *MN (Zelle, E1·E2, W = k·E1·E2, Rahmen, Teilausschnitte, Quernetz, verzerrte Achsen, Beleg). 2. Abbildung auf die App (Quadrat-Feld = □N?; △N, *N im Raster der App; ein Bild je Form). 3. Messung Dreieck/Sechseck in In-Memory-Kopie, X≠Y ungerade (3/5, 5/3, 5/7, 7/5): Kastenfeld vs Parallelogramm, Rand, Makrogrenzen-Kreuzer, Knickgrößen, Inverse, Aufwand netWarpSplitSegment; Flächenfüllung affin ja/nein. 4. X=Y (600×600-Ausnahme): Optionen a/b/c mit Maßen, Bild, Aufwand, Risiko, Naht, Empfehlung. 5. Gerade Größen (Quadrat, Kopie): Bruchstelle netFieldLaw, Symmetrie, Deckung Aus↔Feld, Umfang; Messung 4/4, 4/5, 2/6, 6/5 mit Sinus, Tangens, Geo. 6. Zerlegung in Bauaufträge (N3, dann N1b). 7. Höchstens 5 offene Entscheidungen.

Ausgabe reports/087.md. Prüfung: bash tools/guard.sh <Basis> PASS und bash tools/proof.sh L1 087.
