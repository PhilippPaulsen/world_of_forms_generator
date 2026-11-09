# 021 Score auf der symmetrie-geschlossenen Linienmenge
Typ: K
Stufe: L2
Git: neuer Branch task/021-score-symmetrie von main (erwarteter HEAD c0f59e9a). Kein Merge, kein Push.
     Arbeit und Bericht getrennt committen, usage.csv-Zeile ergänzen.
Regeln: docs/agent-rules.md. Bericht: reports/021.md (höchstens 30 Zeilen). Plan in 5 Zeilen vor der Arbeit.

## Befund (reports/020.md, gemessen)
spatialMorphScorePairing bewertet nur die gespeicherten Basislinien, nicht deren Symmetriekopien (Gruppenelemente). Folgen:
(a) Ebenen gelten fälschlich als "frei" (Fall Quadrat 2*/D4, 11+19 gegen 5+11: Knoten 10 teilt seine Linie nur über Kopien), die
Freie-Enden-Sperre macht den Filter unwirksam; (b) ohne Sperre wären alle 8 Score-Gewinner schlecht (nodeMiss, Randknoten über
Kopien unsichtbar).

## Vorab
`git log -1 --oneline`, `git status --short` (leer). Per grep lesen: spatialMorphScorePairing, spatialMorphPairingLines,
spatialMorphFilterPairingCandidates in core/spatial-morph.js; timelineConclusiveFree, timelineConclusiveContext,
timelineEnrichPairingCandidates in sketch.js; tools/morph/measure-filter-gap.js (dort ist die symmetrie-geschlossene Variante mit
0.045 ms je Kandidat skizziert: Basislinie und Partnerlinie unter allen Gruppenelementen, dasselbe Element auf beiden Seiten).
Bei zwei Wegen oder unklarer Gruppenelement-Konvention: STOP mit 2 Optionen.

## Ziel (eine Kernänderung)
1. spatialMorphScorePairing und die Freie-Enden-Prüfung (timelineConclusiveFree) arbeiten auf der symmetrie-geschlossenen
   Linienmenge (opts.groupElements ist seit 018 vorhanden). Ohne groupElements: Verhalten wie bisher (Rückwärtskompatibilität,
   alte Tests unverändert grün).
2. Die falsche Sperre "free" entfällt, wenn die Ebene geschlossen betrachtet keine freien Enden hat; bei echten freien Enden
   (curveType free, off-path-specs) bleibt sie.
3. Rechenzeit je Kandidat im Bericht messen (Ziel unter 0.1 ms); Kandidaten über Bild-Duplikate nicht hier behandeln.

## Nicht ändern
Die acht geschützten Funktionen in sketch.js (byte-identisch), core/tiling.js, core/faces.js, core/facecolor.js,
tools/morph/off-path-golden.json, Render-Pfad, Baselines. Neue Top-Level-Namen mit Präfix spatialMorph[A-Z] (core) bzw. wie 018
(sketch.js). Pin-Tests nur mit eigenem Commit und Begründung.

## Prüfpunkte
1. Fall 11+19 gegen 5+11: freie Enden der Ebenen 0 statt 1, Sperre entfällt, Filter ist wirksam (Zustand nicht "free").
2. Echte freie Enden (free-seeded): Sperre bleibt, Hinweis wie bisher.
3. Ohne groupElements: Ergebnisse identisch zu vorher (test-spatial-morph-pairing-score.js, -filter.js unverändert grün).
4. Reinheit, keine Store-Schreibzugriffe; Eingaben unverändert.
5. Gemessen im Bericht: wie viele der 512 Zuordnungen bleiben "schlüssig" (erwartet: 128 überstehen dangling und boundaryMiss,
   davon 64 schlecht): Zahl nennen, nicht schönrechnen.
6. Acht Funktionen byte-gleich zu main; `git diff --quiet main..HEAD -- core/tiling.js core/faces.js core/facecolor.js
   tools/morph/off-path-golden.json` Exit 0 (core/spatial-morph.js darf sich ändern).
7. Geschützte Tests 57/57 und 61/61, test-i18n grün.

## Sabotagen (höchstens 4, auf Kopien)
groupElements ignorieren; nur Basislinien zählen; Sperre immer an; Partnerlinie mit anderem Element.

## Prüfung
`bash tools/proof.sh L2 021`. Bericht: Hash vor/nach, Dateien, Prüfpunkte, Sabotagen, Testzahlen, ms je Kandidat,
/usage vorher/nachher, Abweichungen.
