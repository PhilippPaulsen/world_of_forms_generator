# Auftrag 066 — G7b Altlasten entfernen, V2 allein

**Typ K, Prüfstufe L3.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/066-g7b-altlasten.md mit diesem Text an. Bericht: reports/066.md (höchstens 30 Zeilen). Branch: task/066-g7b-altlasten von main (nach Merge von 065). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Grundlage:** reports/055.md (§5: G7 atomar, Altlasten entfernen, V2 aktivieren), reports/056.md (G7b: 35 Alt-Wrapper, Tests migrieren), reports/063.md (legacyCatalogReader als Schuld), reports/064.md (Katalog v2), reports/065.md (Entscheidung A: Schlüssel = ungerichtete gerade Bahn; Richtungsfreiheit in terminology.md vermerken, Test Geometrie aller Bahnmitglieder gleich aufnehmen).

**Ziel G7b (eine Kernänderung: Altlasten entfernen, V2 allein):**
1. Schritt 1, Messung vor jeder Änderung: per git grep alle Verbraucher von orbitIds, orbitId, pairToOrbitId, computeThemeLineOrbitTable, formatThemeLineName, computeThemeLineOrbitAssignments, _pairKey-Sortierung, assertNotDegenerateOrder, legacyCatalogReader, GITTER_V2, nodeCount-Brücke (nur listen, nicht entfernen: tiling.js bleibt), gallery/ (alter Katalog), gallery/manifest.jsonl, tools/gallery/generate.js (alt) listen. Weicht stark von reports/056.md ab oder zwei Wege: STOP mit 2 Optionen. Liste vor dem Löschen im Bericht.
2. Entfernen: alter Katalog gallery/ (alte Dateien, manifest.jsonl, alter ostwald-backfill.csv; gallery/v2 bleibt), tools/gallery/generate.js (alt) samt alter Pfadfunktionen, legacyCatalogReader samt Pin (Pin umkehren: darf nicht mehr existieren), orbitIds-Formate in sketch.js, alte Namenswrapper in core/orbits.js, die nur diesen Wegen dienen. Bevor ein Wrapper entfernt wird: Verbraucher per grep belegen (Morph-Mitglieder nutzen Gruppenoperationen, nicht Orbit-IDs; computeThemeLineOrbits für Gruppenelemente darf NICHT entfernt werden, falls Morph/Session sie braucht).
3. GITTER_V2 aktivieren (Schalter entfernen, keine Option mehr nötig), sodass die neue API Standard ist.
4. Dokumentation: docs/terminology.md Teil B auf das v2-Namensschema umschreiben (inkl. Hinweis: Schlüssel benennt die ungerichtete gerade Bahn, Richtung frei); Test tools/gitter/test-member-geometry.js (Geometrie aller Bahnmitglieder gleich, Quelle: measure-representatives.js).
5. Altlasten aus reports/051.md nur, wenn sie hier ohnehin berührt werden; keine Nebenreinigung.

**Nicht ändern:** acht geschützte Funktionen in sketch.js (byte-gleich), core/faces.js, core/facecolor.js, core/tiling.js, tools/morph/off-path-golden.json, Baselines, gallery/v2. Pins nur mit eigenem Commit und Begründung (Liste im Bericht). ?v= gemeinsam bumpen (z. B. 20261120gridfi). Clean-Export-Check.

**Prüfpunkte:** (1) Kein Verbraucher der entfernten Namen mehr (git grep leer, außer Kommentare/Verlauf). (2) Verhalten der App byte-gleich zu main für Gitter, Linien, Morph (Frames t = 0 .. 1), Session, Export, Katalog v2. (3) Formorgel und Generator-Link laden Katalog v2 (test-gallery-smoke, test-catalog-v2). (4) Repo-Größe vorher/nachher (MB). (5) AUS-Pfad-Golden im Browser 30/30; geschützte Tests 61/61 und 57/57, test-p5-names, test-i18n. (6) Alte Links (?orbitIds) werden mit der Versionsmeldung abgelehnt (Test).

**Sabotagen (je auf Kopien):** gelöschter Wrapper wird noch von einem Verbraucher gebraucht (Test muss rot werden); GITTER_V2-Pfad umgangen; alter Link wird noch geladen.

**Prüfung:** bash tools/proof.sh L3 066 plus AUS-Pfad-Golden im Browser. Bericht: Hashes, Verbraucher-Liste, Messwerte, Repo-Größe, Sabotagen, /usage vorher/nachher, was nicht im Browser gesehen wurde.
