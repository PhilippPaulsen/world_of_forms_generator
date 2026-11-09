# 022 Bildtest: der Filter prüft das gezeichnete Bild
Typ: K
Stufe: L2
Git: neuer Branch task/022-bildtest von task/021-score-symmetrie (erwarteter HEAD e1d56e9c). Kein Merge, kein Push.
     Arbeit und Bericht getrennt committen, usage.csv-Zeile ergänzen.
Regeln: docs/agent-rules.md. Bericht: reports/022.md (höchstens 30 Zeilen). Plan in 5 Zeilen vor der Arbeit.

## Befund (reports/020.md, 021.md, gemessen)
Fall Quadrat 2*/D4, 11+19 gegen 5+11, 512 Zuordnungen. Nach 021 ist der Filter wirksam, liefert aber leer, weil nodeMiss für jede
Zuordnung > 0 ist (Muster topologisch verschieden). 128 Zuordnungen überstehen dangling und boundaryMiss; 64 (nodeMiss 12) sind
gut, 64 (nodeMiss 20) sind schlecht (dangling 24 im gezeichneten Bild bei t = 0.1 und 0.9, nicht bei 0, 0.25, 0.5, 0.75, 1).
t = 0.5 allein verfehlt alle 64.

## Vorab
`git log -1 --oneline`, `git status --short` (leer). Per grep lesen: spatialMorphFilterPairingCandidates, spatialMorphScorePairing;
timelineConclusiveView, timelineConclusiveContext, timelineConclusiveStep, timelineConclusiveRowVariants; ui-phone-pairing.js;
tools/morph/measure-filter-gap.js (Bildtest mit echtem Render bereits gemessen: wiederverwenden), tools/morph/seam-data.js.
Bei zwei Wegen oder wenn der Bildtest nicht ohne Eingriff in den Render-Pfad möglich ist: STOP mit 2 Optionen.

## Entscheidung des Auftraggebers (auf die Rückfrage: wie entsteht das Bild ohne Eingriff in den Render-Pfad?)
Option "Neue reine Funktion": neue Funktion in core/spatial-morph.js (Präfix spatialMorph[A-Z]) mit denselben Bausteinen wie
spatialMorphRenderDraw (Linien vorbereiten, Front-Gewichte, verankerte Punkte, Kachel- und Symmetrie-Schleife), ohne Globals und ohne
Zeichnen. core/spatial-morph-render.js, Render-Pfad und off-path-golden.json bleiben unberührt (L2). Pflicht-Gleichheitstest: Bild der
neuen Funktion gleich dem echten Render (1e-6 px) über alle 512 Kandidaten und t = 0.1, 0.25, 0.5, 0.75, 0.9 sowie mindestens einen
zweiten Modus (linear:45 oder radial); Zahl der geprüften Bilder im Bericht. Zusätzliche Sabotage: eine Abweichung in der neuen
Schleife (etwa falsches Gewicht) macht den Gleichheitstest rot. Im Bericht: die Schleife steht nun zweimal im Code; Aufräumen
(gemeinsame Quelle, L3) ist ein offener Folgepunkt.

## Ziel
1. Stufe 1 (Filterlogik, core/spatial-morph.js): spatialMorphFilterPairingCandidates behält Kandidaten mit dangling === 0 und
   boundaryMiss === 0 (harter Ausschluss); nodeMiss wird nur Sortierkriterium (Reihenfolge weiter über
   spatialMorphComparePairingScore). Tests und Sabotagen aus 017 mitziehen (eigener Commit mit Begründung).
2. Stufe 2 (Bildtest, nur Werkzeug außerhalb des Render-Pfads): neue reine Funktion bzw. Modul, das für einen Kandidaten das
   gezeichnete Bild bei t = 0.1, 0.25, 0.5, 0.75, 0.9 erzeugt und dangling plus Seam-Lücken zählt (Zählweise wie
   measure-filter-gap.js). Ausschluss bei Wert > 0 an irgendeiner Stelle. Bild-Deduplizierung vor dem Test.
3. Anbindung (sketch.js/ui-phone-pairing.js, ohne die acht geschützten Funktionen): Bildtest nur für die angezeigte Liste und für
   ‹ ›, in Portionen (höchstens 25 ms je Portion, danach Rückgabe an die Oberfläche). Anzeige "wird geprüft x von y", danach
   "x von y schlüssig". Ergebnis je Kandidat zwischenspeichern (Schlüssel: Bild-Schlüssel plus Ebenenpaar plus Modus), Cache bei
   Änderung der Ebenen oder des Segments leeren. Der Render-Pfad und draw() werden nicht berührt; keine Berechnung pro Frame.
4. Während der Prüfung bleibt die Bedienung möglich; ‹ › nutzt bis zum Ende die bereits geprüften Kandidaten plus die gerade gewählte.

## Nicht ändern
Die acht geschützten Funktionen in sketch.js (byte-identisch), core/tiling.js, core/faces.js, core/facecolor.js,
tools/morph/off-path-golden.json, Render-Pfad, Baselines. Pin-Tests nur mit eigenem Commit und Begründung. Checkbox/label in der
Zeitleisten-Gruppe sind verboten.

## Prüfpunkte
1. Fall 11+19 gegen 5+11: nach Stufe 1 überleben 128, nach Bildtest genau die 64 guten (Zahlen im Bericht).
2. Ein Fall, in dem nodeMiss > 0, aber das Bild sauber ist: Kandidat bleibt.
3. Seam-Lücken werden gezählt (echter Fall, sonst synthetisch und gekennzeichnet).
4. Deduplizierung: gleiche Bilder nur einmal gerechnet (Zähler im Test).
5. Portionierung: keine Portion über dem Zeitbudget plus Toleranz (Uhr-Stub); Abbruch/Neustart bei Segmentwechsel; Cache wird geleert.
6. Rechenzeit im Bericht: ms je Bild, ms je Kandidat, Gesamtzeit für den Fall (mit und ohne Dedup).
7. Freie Linienenden (echt, geschlossen > 0): Hinweis wie bisher, ungefilterte Liste, kein Bildtest.
8. de/en-Texte (wird geprüft, x von y schlüssig), test-i18n grün. Sichtbarkeit der Meldungen im DOM-Stub-Test.
9. Acht Funktionen byte-gleich zu main; `git diff --quiet main..HEAD -- core/tiling.js core/faces.js core/facecolor.js
   tools/morph/off-path-golden.json` Exit 0. Geschützte Tests 57/57 und 61/61.

## Sabotagen (höchstens 4, auf Kopien; plus die Gleichheitssabotage der Entscheidung)
nodeMiss weiter als Ausschluss; nur t = 0.5 prüfen; Deduplizierung weglassen; Portionen ohne Zeitbudget.

## Prüfung
`bash tools/proof.sh L2 022`. Bericht: Hash vor/nach, Dateien, Prüfpunkte, Sabotagen, Testzahlen, Zeiten, /usage vorher/nachher,
Abweichungen.
