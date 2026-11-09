# 018 d3: Schalter "Nur schlüssige Zuordnungen" im Pairing-Editor
Typ: K
Stufe: L2
Git: neuer Branch task/018-d3-filter-ui von main (erwarteter HEAD fb63462d). Kein Merge, kein Push.
     Arbeit und Bericht getrennt committen, usage.csv-Zeile ergänzen.
Regeln: docs/agent-rules.md. Bericht: reports/018.md (höchstens 30 Zeilen). Plan in 5 Zeilen vor der Arbeit.
Vorab: `git log -1 --oneline`, `git status --short` (leer). Per grep (keine Zeilennummern) lesen: timelinePairingCandidates,
commitTimelineSegmentPairing, getSegmentFlips, getSegmentPairing, memberImageLines in sketch.js; den Pairing-Editor-Teil
(wo timelinePairingCandidates aufgerufen und die Kandidatenliste gerendert wird); spatialMorphFilterPairingCandidates in
core/spatial-morph.js. Ablage der Schalter-Zustände im Editor und i18n-Mechanismus (de/en) bestätigen.

## Ziel
Im Pairing-Editor ein Schalter "Nur schlüssige Zuordnungen" (Standard AUS). Bei AN wird die Kandidatenliste mit
`spatialMorphFilterPairingCandidates(layerA, layerB, candidates, {poly})` gefiltert und in der Reihenfolge des Filters angezeigt.

## Regeln
- Vor dem Filtern jeden Kandidaten mit den aktuell gesetzten segmentFlips und segmentMembers des Segments anreichern, wenn er
  sie nicht selbst trägt (n >= 2), damit der Filter dieselbe Zuordnung bewertet, die später gezeichnet wird. Anreicherung in einer
  neuen Hilfsfunktion außerhalb der acht geschützten Funktionen, ohne Seiteneffekte.
- poly immer übergeben (sonst zählen Randenden als frei).
- Leere Liste (empty): Meldung "Keine schlüssige Zuordnung. Filter ausschalten, um alle zu sehen." Liste bleibt leer, keine Ersatzliste.
- Hat eine der beiden Ebenen freie Linienenden (Filter wäre immer leer): eigener Hinweis "Ebene hat freie Linienenden, Filter nicht
  anwendbar", Liste ungefiltert zeigen, Schalter inaktiv oder wirkungslos.
- Filter AUS: Ausgabe und Verhalten exakt wie bisher.
- Texte de/en im bestehenden i18n, i18n-Test mitziehen. Statuszeile/Anzeige: Zahl "x von y schlüssig".
- Schalterzustand nicht in Sessions/Exporte schreiben, falls nicht ohnehin üblich (im Bericht nennen, was gewählt wurde).

## Nicht ändern
Die acht geschützten Funktionen in sketch.js (byte-identisch), core/tiling.js, core/faces.js, core/facecolor.js,
core/spatial-morph.js (Filterfunktion unverändert), tools/morph/off-path-golden.json, Baselines, Render-Pfad.

## Prüfpunkte
1. Filter AUS: Kandidatenliste identisch zu vorher (Test).
2. Filter AN, Fall mit trennender und schlüssiger Zuordnung: nur die schlüssige bleibt.
3. n >= 2: gesetzte Flips/Members fließen in die Bewertung ein (Test mit Flip, der eine sonst schlüssige Permutation trennt).
4. Leere Liste: Meldung, keine Ersatzliste.
5. Freie Enden: Hinweis, ungefilterte Liste.
6. de/en Texte vorhanden, i18n-Test grün; Schalter-Zustand AUS nach Neuladen.
7. Byte-Vergleich der acht geschützten Funktionen (Nachweis im Bericht); `git diff --quiet main..HEAD -- core/tiling.js core/faces.js
   core/facecolor.js core/spatial-morph.js tools/morph/off-path-golden.json` Exit 0. NICHT tools/guard.sh.
8. Neuer Test unter tools/ui/ oder tools/morph/ (Logik der Anreicherung und Filteranbindung, ohne Browser), in die Suite eingehängt.
   `?v=` anheben, falls verlangt.

## Sabotagen (höchstens 4, auf Kopien)
Anreicherung weglassen; poly nicht übergeben; Filter bei AUS trotzdem anwenden; leere Liste durch Ersatzliste ersetzen.

## Prüfung
`bash tools/proof.sh L2 018`. Bericht: Hash vor/nach, Dateien, Prüfpunkte 1-8, Sabotagen rot ja/nein, Testzahlen,
/usage vorher/nachher, Abweichungen.

Bei Unklarheit zur Ablage der Editor-Schalter oder zur Kandidatenform: STOP mit 2 Optionen, nicht raten.
