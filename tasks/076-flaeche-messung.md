# Auftrag 076 — Nicht-quadratische Arbeitsfläche: Bestand, Messung und Zerlegung

Du arbeitest read-only, mit genau diesen Ausnahmen: tasks/076-flaeche-messung.md und reports/076.md anlegen und auf dem Branch task/076-flaeche-messung (von main, erwarteter HEAD 6df4ccf6) committen. Sonst nur lesende Befehle (git, grep, cat, sed, ls, node nur zur Auswertung ohne Dateischreiben). Kein Merge, kein Push. Regeln: docs/agent-rules.md. Bericht höchstens 60 Zeilen, Datei:Funktion statt Zeilennummern, jede Aussage per grep belegt, gemessen und vermutet getrennt.

**UI-Regel (Auftraggeber):** Neue oder verschobene Bedienelemente werden nicht gebaut, bevor die Position freigegeben ist. Dieser Auftrag liefert nur Bestand, Messung und Zerlegung.

**Ziel des Auftraggebers (Vorhaben b):** Die Arbeitsfläche soll auch nicht quadratisch sein.
- Die Zellen (Maschen) behalten die Form des Netzes, sie werden nicht verzerrt.
- Standard ist weiter das Quadrat mit 1 x 1 bis 9 x 9 Maschen.
- Neu: ungleiche Maschenzahl für Breite und Höhe, zum Beispiel 3 / 5 oder 5 / 7, damit auch Normformate näherungsweise möglich sind.
- Die kurze Seite bleibt 600 px. Die lange Seite ergibt sich aus der Maschenzahl. Auf dem Desktop eher Querformat, auf dem Tablet eher Hochformat.
- Bei Dreieck und Sechseck soll bei anderen Proportionen als dem Quadrat die Begrenzung der Fläche in der langen Richtung an die Grenzen der Maschen angepasst werden.
- Bedienung im Größen-Stepper (#nav-size-stepper): ein Feld "Locked" gibt die zweite Ziffer frei. Auf dem Handy liegt es im "Mehr"-Menü.
- Später kommen Netze mit zwei Teilungen (E1 x E2), die Fläche kommt zuerst.

**Hintergrund:** reports/051.md (A3, A4: canvasW = canvasH = 600 in core/state.js, createCanvas einmal in sketch.js setup, versteckter #canvas-size-slider, kein resizeCanvas, Zeigerumrechnung clientToSketch, Session 'canvas-mismatch', feste Pixelwerte, 33 Testdateien mit der Zahl 600), reports/073.md/074.md/075.md (Größe = Maschen über die Breite, Skalierung um die Canvasmitte (300,300), resizeBase), reports/069.md (Knotenabstand), reports/052.md (Netz: eine Teilung für beide Achsen).

**Aufgabe:**
1. **Bestand mit Datei:Funktion.** Wo steckt die Quadratform: Canvas-Maße (canvasW, canvasH, createCanvas, #canvas-size-slider, CSS --canvas-size, clientToSketch), Kantenlänge (canvasW / shapeSizeFactor) und alle Leser von shapeSizeFactor, Kachelung (core/tiling.js: Rechteck-Schranken, closedNetRectCorners, tileSquare/tileTriangle/tileHex, Zahl der Kacheln), Netz (core/netwarp.js: Rahmen, Feld/Makrokachel R), Flächen (faceTrailKey, FACE_KEY_SCALE, FACE_EPSILON), Morph (spatialMorphSpanFromCentroids, Fallback 600), Export (SVG width/height/viewBox, PNG saveCanvas, JSON), Session (canvas-mismatch, Snapshot-Felder), resizeBase (Zentrum (300,300), Offsets), Ebenen (layerGrid, Offset/Rotation in px), Galerie (DETAIL_CANVAS_SIZE), UI (Stepper, Phone-Zeilen). Tabelle: Stelle, Annahme (quadratisch / fest 600 / nur Breite), Kategorie.
2. **Feste 600 und gleiche Seiten:** Anzahl und Art der Treffer in Code (ohne tools) und in tools/ (Tests, Harnesse, Messskripte, off-path-script.js, Golden). Welche Tests pinnen Quelltext oder Maße (Liste mit Dateinamen)? Wie hängt tools/morph/off-path-golden.json an 600 x 600?
3. **Maße je Form (Rechnung, node ohne Schreiben):** für Quadrat, Dreieck, Sechseck und Maschenzahlen X, Y = 1..9: Zellenkante e = 600 / min(X, Y); Breite und Höhe der Fläche; für Dreieck und Sechseck die Ausdehnung der Maschengrenzen in der langen Richtung (Zeilenhöhe, Versatz, halbe Zellen am Rand); wie viele Zeilen/Spalten ergeben "annähernd" das Verhältnis; Tabelle der Fläche in px und das Verhältnis X/Y gegen Normverhältnisse (2/3, 3/4, 4/5, 5/7 gegen 1/Wurzel 2). Größte lange Seite bei 1 / 9 (5400 px) und bei 2 / 9, 3 / 9.
4. **Grenzen messen (Node, wo möglich):** Zahl der Kacheln und Segmente für Flächen von 600 x 600 bis 600 x 5400 (Quadrat, Hex 12, Dreieck 12 als Stichprobe); draw()-Rechenzeit soweit in Node messbar; Canvas-Größen-Grenzen des Browsers (nur als Wissen kennzeichnen, nicht messen); Vorschlag für ein größtes Seitenverhältnis oder eine größte lange Seite, mit Begründung (gemessen/vermutet).
5. **Folgen für die letzten Aufträge:** resizeBase (Zentrum, Skalierung bei W != H, Offsets der Ebenen), Flächenschlüssel (absolute px), Session (neue Felder, Restore ohne canvas-mismatch), Knotenabstand, Zeigerumrechnung; Zeitleisten- und Morph-Spans.
6. **UI-Bestand und Entwurf (kein Bau):** #nav-size-stepper heute (Markup, Selektoren, Maße 1280/390 px, Zeilenbreiten im Phone-Raster 282 bis 298 px, "Mehr"-Block #more-form), Pin-Tests, die den Stepper oder das Markup lesen. Zwei Positionsvarianten für das Feld "Locked" mit zweiter Ziffer (Desktop im Stepper, Handy im "Mehr"-Menü), mit Maßen, ASCII-Skizze, Beschriftung de/en, Tooltip, Verhalten (Locked = beide Zahlen gleich, entsperrt: zwei Zahlen X / Y; welche Zahl ist Breite?), Aufwand und Risiko.
7. **Zerlegung** in höchstens vier Bauaufträge (Typ, Prüfstufe, Dateien, Schutz: acht geschützte Funktionen in sketch.js, core/faces.js, core/tiling.js, core/facecolor.js, tools/morph/off-path-golden.json; Pins; Messgröße; Sabotagen; Reihenfolge). Beachte: core/tiling.js ist geschützt; wo eine Änderung dort nötig wäre, ausdrücklich benennen und Alternativen nennen.
8. Offene Fragen an den Auftraggeber (höchstens 5), Risiken.

**Nicht ändern:** alles außer den zwei Dateien oben. docs/quellen/ nicht committen. Abschluss im Chat: Hash, git status --short, Zeilenzahl des Berichts.
