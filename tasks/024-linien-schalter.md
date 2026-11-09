# 024 Linien-Schalter: Button für Linien an/aus und Linienstärke, in Bild und Export
Typ: K
Stufe: L2
Git: neuer Branch task/024-linien-schalter von main (erwarteter HEAD 85f563da). Kein Merge, kein Push.
     Arbeit und Bericht getrennt committen, usage.csv-Zeile ergänzen.
Regeln: docs/agent-rules.md. Bericht: reports/024.md (höchstens 30 Zeilen). Plan in 5 Zeilen vor der Arbeit.

## Wunsch (Nutzer)
Neuer Button für Linien zwischen "Toggle Nodes" (btn-toggle-nodes) und "Toggle Face Fill" (btn-toggle-faces). Erster Klick: Linien an/aus.
Zweiter Klick (wenn Linien an): Slider für die Linienstärke. "Ausblenden" betrifft Darstellung UND Export (SVG/PNG/weitere).
Entscheidung des Nutzers zur Klickfolge (nach Rückfrage): Zyklus AUS -> AN -> Slider -> AUS.
- Klick bei AUS: Linien AN, kein Slider. Klick bei AN (Slider zu): Slider öffnet, Linien bleiben AN.
- Klick bei offenem Slider: Slider schließt, Linien AUS.
- aria-pressed true bei AN (mit oder ohne offenen Slider), false bei AUS; offener Slider zusätzlich aria-expanded.
- Slider-Zustand (offen/zu) wird nicht gespeichert und nicht exportiert; nur AN/AUS und Stärke gehören zur Session.
- Der Slider schließt sich nicht von selbst (kein Klick-außerhalb), nur über den Button.

## Vorab (Messung, bevor etwas geändert wird)
`git log -1 --oneline`, `git status --short` (leer). Per grep alle Stellen finden, die Linien zeichnen oder exportieren (sketch.js,
core/tiling.js, core/curves.js drawCurvedBezier, core/spatial-morph-render.js, Netz-Overlay gesondert, Export SVG/PNG/weitere, Gallery).
Wie Linienstärke heute gesetzt wird; wie ein Toggle wie btn-toggle-nodes/btn-toggle-faces abgelegt ist (Zustand, Session, Export, i18n,
Tooltip, Stil). Bei zwei Wegen oder wenn eine der acht geschützten Funktionen oder core/tiling.js/core/faces.js zu ändern wäre: STOP mit 2 Optionen.

## Ziel
1. Icon-Button (aria-pressed, de/en Tooltip/aria-label) zwischen Nodes und Faces. Zustand: Linien sichtbar (Standard AN).
2. Slider Linienstärke; Bereich und Schritt aus der heutigen Stärke (2) abgeleitet; Standardwert = heutiges Verhalten, Ausgabe bei unverändertem
   Slider byte-identisch.
3. Linien AUS: keine Linien im Bild (auch Morph), Flächen und Knoten bleiben; keine Nebenwirkung auf die Flächenberechnung.
4. Export (SVG, PNG, weitere): Linien fehlen bei AUS; Stärke folgt dem Slider.
5. Session: Zustand wie bei den Nachbar-Toggles behandelt; alte Sessions ohne das Feld laden mit Standard.
6. Phone (ui-phone-*.js): reicht der Platz in der Leiste nicht (390 px, 48-px-Tasten), wandert der Button in "Mehr" (gleiches Verhalten, Slider dort
   bedienbar). Die Taste ist in genau einer der beiden Stellen. Begründung im Bericht.

## Nicht ändern
Die acht geschützten Funktionen in sketch.js (byte-identisch), core/faces.js, core/facecolor.js, tools/morph/off-path-golden.json, Baselines.
Falls nur über core/tiling.js oder core/spatial-morph-render.js möglich: STOP. Checkbox/label in der Zeitleisten-Gruppe sind verboten.
Pin-Tests (auch der Phone-Konfiguration) nur mit eigenem Commit und Begründung.

## Prüfpunkte
1. Standard (AN, Slider unverändert): Ausgabe byte-identisch (AUS-Pfad-Golden grün; ein Normalbild-Vergleich im Test).
2. AUS: Zeichenaufrufe für Linien = 0 (Stub-Test auf alle Pfade inkl. Morph); Flächen und Knoten unverändert.
3. Export AUS: SVG/PNG ohne Linienelemente; Export AN mit Slider: Stärke wie im Bild.
4. Slider wirkt auf Bild und Export; Zustand bleibt beim Segment- und Ebenenwechsel.
5. Klickzyklus im DOM-Stub-Test: AN/zu -> AN/offen -> AUS/zu -> AN/zu.
6. Session: speichern/laden, alte Session ohne Feld.
7. de/en, test-i18n grün; Button und Slider im DOM-Stub-Test, auch Phone; Position (Leiste oder "Mehr") belegt, genau eine.
8. Acht Funktionen byte-gleich; `git diff --quiet main..HEAD -- core/faces.js core/facecolor.js tools/morph/off-path-golden.json` Exit 0.
   Geschützte Tests 57/57 und 61/61.

## Sabotagen (höchstens 4, auf Kopien)
Linien AUS zeichnet im Morph trotzdem; Export ignoriert den Zustand; Slider ohne Wirkung auf Export; Klick bei offenem Slider lässt AN.

## Prüfung
`bash tools/proof.sh L2 024`. Bericht: Hash vor/nach, Fundstellenliste, Prüfpunkte, Sabotagen, Testzahlen, /usage vorher (5h 48 %, Woche 68 %)/nachher,
Abweichungen, was nicht im Browser gesehen wurde.
