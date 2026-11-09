# 016 d3: reine Bewertungsfunktion für eine Zuordnung (Permutation, Umkehrung, Mitglieder)
Typ: K
Stufe: L2
Git: neuer Branch task/016-d3-score von main (erwarteter HEAD da5900c0). Kein Merge, kein Push.
     Arbeit und Bericht getrennt committen, usage.csv-Zeile ergänzen.
Regeln: docs/agent-rules.md. Bericht: reports/016.md (höchstens 30 Zeilen).
Neue Sitzung, Plan in 5 Zeilen vor der Arbeit.
Vorab: `git log -1 --oneline`, `git status --short` (leer). grep nach sketch.js: getSegmentPairing,
getSegmentFlips, applyFlipsToCoords, memberImageLines, resolveTimelineKeyframeCoords, pairingDisplacement;
nach core/spatial-morph.js: spatialMorphOnEdge, spatialMorphPrepareEndpoint, spatialMorphSeamOpen;
nach tools/morph/test-spatial-morph-prototype.js: dangling. Nach Fundstellen arbeiten, nicht nach Zeilen
aus Berichten. Auswertung: reports/015.md (Branch task/015-inventur-d3, nur lesen).

## Ziel (eine Kernänderung)
In core/spatial-morph.js eine reine Funktion `spatialMorphScorePairing(layerA, layerB, perm, flips, members, opts)`.
Sie liest nur, ändert nichts, zeichnet nichts, kein Zugriff auf Keyframe-Stores, nicht in draw() eingehängt.

## Maß (lexikographisch, kleiner ist besser), Rückgabe {dangling, nodeMiss, boundaryMiss, dist, key}
1. dangling: Zahl freier Linienenden der gepaarten Zwischenstellung (Zählweise wie `dangling` im Prototyp-Test).
2. nodeMiss / boundaryMiss: Knoten- bzw. Randknoten-Inzidenzen (echte Knoten-IDs), die in A vorhanden sind,
   aber nach der Zuordnung in B nicht, und umgekehrt (A→B und B→A summiert).
3. dist: summierte quadrierte Endpunktabstände, nur Tie-Breaker.
Vergleich über `key` oder `spatialMorphComparePairingScore(a, b)`.

## Nicht ändern
sketch.js, core/tiling.js, core/faces.js, core/facecolor.js, tools/morph/off-path-golden.json, Baselines, render-Pfad.
Neue Top-Level-Namen nur mit Präfix `spatialMorph[A-Z]`.

## Prüfpunkte
1. Identische Ebenen, Identität: dangling 0, nodeMiss 0, boundaryMiss 0, dist 0.
2. Symmetrie: score(A,B,p) und score(B,A,p^-1) gleich bei Umkehrung der Rolle.
3. Absichtlich falsche Zuordnung (Permutation vertauscht, die Knoten trennt): schlechter als die richtige in
   dangling oder nodeMiss, auch wenn dist kleiner ist (Gegenprobe zu M1c).
4. Ein Fall mit freien Linienenden (curveType free, tools/morph/off-path-specs.json): dangling zählt sie korrekt.
5. Reinheit: Eingaben vor/nach deep-equal, kein Schreibzugriff.
6. Guard: `git diff --quiet main..HEAD -- sketch.js core/tiling.js core/faces.js core/facecolor.js tools/morph/off-path-golden.json`
   Exit 0. NICHT tools/guard.sh.
7. Tests als neue Datei tools/morph/test-spatial-morph-pairing-score.js, in die Suite eingehängt (Anzahl im Bericht).

## Sabotagen (höchstens 4), Test muss rot werden, danach zurücknehmen
dist vor dangling priorisieren; B→A-Richtung weglassen; freie Enden nicht zählen; Eingabe mutieren.

## Prüfung
`bash tools/proof.sh L2 016`. Bericht: Hash vor/nach, Dateien, Prüfpunkte 1-7, Sabotagen rot ja/nein,
Testzahlen, /usage vorher/nachher, Abweichungen.
