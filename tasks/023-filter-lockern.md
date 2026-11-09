# 023 Filter lockern: nur dangling schließt hart aus, der Bildtest entscheidet den Rest
Typ: K
Stufe: L2
Git: neuer Branch task/023-filter-lockern von main (erwarteter HEAD 49d7183d). Kein Merge, kein Push.
     Arbeit und Bericht getrennt committen, usage.csv-Zeile ergänzen.
Regeln: docs/agent-rules.md. Bericht: reports/023.md (höchstens 30 Zeilen). Plan in 5 Zeilen vor der Arbeit.

## Befund (reports/022.md, gemessen)
Fall Quadrat 2*/D4, 11+19 gegen 5+11, 512 Zuordnungen. Stufe 1 (spatialMorphFilterPairingCandidates) behält dangling === 0 und
boundaryMiss === 0: 128 von 512. Der Bildtest behält davon 64. Ohne Score-Stufe bestehen 448 von 512 den Bildtest; die Score-Stufe
verwirft 320 mit sauberem Bild (boundaryMiss, weil die Verankerung Randenden auf die Kante schiebt). Nutzer-Sichttest: Filter zu
streng, mehr gute Zuordnungen sollen zugelassen werden.

## Vorab
`git log -1 --oneline`, `git status --short` (leer). Per grep lesen: spatialMorphFilterPairingCandidates,
spatialMorphComparePairingScore in core/spatial-morph.js; timelineConclusiveImageStage, timelineConclusiveView in sketch.js;
tools/morph/measure-image-test.js. Bei zwei Wegen: STOP mit 2 Optionen.

## Ziel (eine Kernänderung)
1. spatialMorphFilterPairingCandidates schließt nur noch dangling > 0 hart aus; boundaryMiss wird wie nodeMiss nur Sortierkriterium
   (Reihenfolge über spatialMorphComparePairingScore, boundaryMiss nach dangling, vor nodeMiss, wie bisher). Tests und Sabotagen aus
   017/022 mitziehen (eigener Commit mit Begründung).
2. Der Bildtest (022) entscheidet allein über den Rest. Anbindung, Portionen, Cache unverändert; Fortschrittsanzeige bleibt korrekt
   bei größerer Kandidatenzahl.
3. Reihenfolge der Anzeige: geprüfte, bestandene Kandidaten nach Score; bei vielen Kandidaten (> 100) die Liste nur bis zum Ende der
   Prüfung stabil halten (kein Springen der Zeilen während der Prüfung: neue Treffer unten anfügen oder erst nach Abschluss sortieren,
   im Bericht beschreiben).

## Nicht ändern
Die acht geschützten Funktionen in sketch.js (byte-identisch), core/tiling.js, core/faces.js, core/facecolor.js,
core/spatial-morph-render.js, tools/morph/off-path-golden.json, Render-Pfad, Baselines. Pin-Tests nur mit eigenem Commit und Begründung.

## Prüfpunkte
1. Fall 11+19 gegen 5+11: Anzahl der Überlebenden nach Stufe 1 und nach Bildtest nennen (erwartet bis 448 gute; nicht schönrechnen).
   Alle bestandenen haben im echten Render dangling 0 und Seam-Lücken 0 bei den fünf Zeitstellungen (Gegenprobe gegen den
   Gleichheitstest aus 022).
2. Die 64 mit dangling 24 bei t = 0.1/0.9 bleiben ausgeschlossen.
3. Ein Fall mit boundaryMiss > 0 und sauberem Bild: bleibt; ein Fall mit boundaryMiss > 0 und schlechtem Bild: fällt heraus (Test).
4. Dangling > 0 in Stufe 1: weiter ausgeschlossen, kein Bildtest.
5. Zeiten gemessen (Gesamtzeit für den Fall mit Dedup, ms je Bild), Portionen halten das Zeitbudget.
6. Freie Linienenden (echt): Hinweis wie bisher.
7. Acht Funktionen byte-gleich; `git diff --quiet main..HEAD -- core/tiling.js core/faces.js core/facecolor.js
   core/spatial-morph-render.js tools/morph/off-path-golden.json` Exit 0. Geschützte Tests 57/57 und 61/61, test-i18n grün.

## Sabotagen (höchstens 3, auf Kopien)
boundaryMiss weiter als Ausschluss; Bildtest überspringen; dangling in Stufe 1 ignorieren.

## Prüfung
`bash tools/proof.sh L2 023`. Bericht: Hash vor/nach, Dateien, Prüfpunkte, Sabotagen, Testzahlen, Zeiten, /usage vorher/nachher
(vorher messen), Abweichungen.
