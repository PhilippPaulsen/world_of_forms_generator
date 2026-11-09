# 025 Inventur: SVG-Farben und Morph-Zwischenstellung
Typ: R (nur lesen)
Git: kein Code ändern. Nur tasks/025-inventur-svg-farben.md und reports/025.md auf Branch task/025-inventur-svg-farben
     (von main, erwarteter HEAD 4f1d461b) anlegen und committen. Kein Merge, kein Push.
Regeln: docs/agent-rules.md. Keine Tests, kein Merge, kein Push. Bericht höchstens 30 Zeilen, Datei:Funktion statt Zeilennummern.
Arbeitsordner: `/Users/flipmac/Documents/flip/The World of Forms/world_of_forms_generator-farborgel-generator-integration`.

## Ziel der Inventur
SVG-Export soll das aktuelle Bild speichern: Flächenfarben, Morph-Zwischenstellung, Linien mit Stärke (letzteres seit 024 vorhanden).

## Zu klären
1. Was schreibt core/export.js heute ins SVG (Gruppen, Elemente, Sammler svgPathCollector)? Werden Flächen exportiert? Wenn nein, warum nicht (nur Linien-Senke drawCurvedBezier)?
2. Wie werden Flächen auf dem Canvas gezeichnet (Normalbild: core/faces.js drawCellFaces o. ä.; Morph: drawSpatialMorphFaceFillsAtTile in core/spatial-morph-render.js bzw. Gegenstück)? Welche Zeichenaufrufe (fill, beginShape, Gradienten, Undercoat, Nahtstroke) und welche Farbquellen?
3. Gibt es für Flächen eine ähnliche Senke wie drawCurvedBezier, an der ein SVG-Sammler andocken könnte, oder gibt es mehrere Pfade (Normalbild, Morph, Netz-Verzerrung, Farborgel)?
4. Exportiert der SVG-Export bei laufendem oder pausiertem Morph die Zwischenstellung (aktuelles t) oder den Basisstand? Belege.
5. Reihenfolge und Deckung: wie müssen Flächen, Undercoat, Naht und Linien im SVG geschichtet werden, damit es dem Canvas entspricht?
6. Schutz: berührt eine Lösung die acht Funktionen in sketch.js, core/tiling.js, core/faces.js, core/facecolor.js, core/spatial-morph-render.js, off-path-golden.json? Je Datei Ja/Nein.
7. Empfehlung: Zerlegung in Kernaufträge (Typ K, je eine Änderung) mit Reihenfolge, Prüfstufe und Messgröße (z. B. SVG gerastert gegen Canvas-Pixelvergleich).

Abschluss im Chat: Hash, git status --short, Zeilenzahl des Berichts.
