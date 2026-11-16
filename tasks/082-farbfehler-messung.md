# Auftrag 082 — Farbfehler beim Größenwechsel: Messung (Typ R, nur lesen)

**Arbeitsordner (nur dieser):** `/Users/flipmac/Documents/flip/The World of Forms/world_of_forms_generator-farborgel-generator-integration`, `main` nach Merge 081 (`e463740e`). Branch `task/082-farbfehler-messung`.
**Ausnahme vom Schreibverbot:** `tasks/082-farbfehler-messung.md` (VOR der Arbeit), `reports/082.md`, `tools/grid/measure-color-resize.js`. Kein Merge, kein Push, keine Änderung in `core/`, `sketch.js` oder Tests.

**Anlass:** Beim Wechsel der Größe $(X,Y) \to (X',Y')$ treten teilweise Farbfehler auf, die sich durch erneutes Zuweisen beheben lassen. Bekannt aus Bericht 081: die Flächenmenge in `core/faces.js` hängt von der Bildfläche ab; Farbzuordnung läuft über skalierte Innenpunkte (`resizeBase`, 075).

**Messung:**
1. Muster: 3 Formen × Ordnung 2..4 × Lage 1/2 × mindestens 3 Liniensätze (zufällig mit festem Seed, plus ein symmetrisches Muster je Form), echte Farbzuweisung (nicht nur Grau): jede Fläche bekommt eine eigene Farbe aus einer Palette.
2. Größenwechsel: $X=Y$ $3 \leftrightarrow 5 \leftrightarrow 7$, $X \neq Y$ (`3/5`, `5/3`, `5/7`, `7/8`, `8/7`, `3/9`, `9/3`), jeweils hin und zurück.
3. Je Wechsel: Anteil der Flächen mit erhaltener Farbe (Zuordnung über den skalierten Innenpunkt, kein Neu-Zuweisen). Jede Abweichung klassifizieren: (a) Flächenmenge unterschiedlich (Fläche entfällt, verschmilzt oder entsteht neu, belegen: Flächenzahl alt/neu je Form), (b) Fläche vorhanden, aber Farbe falsch zugeordnet (Schlüsselkollision, Rundung), (c) andere. Pro Klasse mit 3 Beispielen (Form, Größen, Fläche, Lage im Bild).
4. Ursache für (a): welche Stelle in `core/faces.js` (Epsilon, Randbehandlung, Kachelbereich über Bildrand, Bildfläche-Abhängigkeit) bestimmt die Flächenmenge? Belegen mit Zahlen, nicht vermuten.
5. Browser: ein echter Wechsel über die Bedienelemente (Schloss öffnen, Höhe ändern) mit einem gefärbten Muster, Sechseck und Dreieck, Screenshot vorher/nachher, falsche Flächen markiert.

**Ausgabe `reports/082.md` (Länge begrenzt):** Tabelle je Form und Größenpaar (Anteil erhalten, Klasse a/b/c), Ursache der Klasse (a) mit Beleg, die Stelle(n) im Code, drei Lösungswege mit Aufwand und Risiko (Schutzgrenzen: `faces.js`, `tiling.js`, `facecolor.js`, `off-path-golden.json`), Empfehlung. `/usage` vorher/nachher, was nicht gemessen wurde.
