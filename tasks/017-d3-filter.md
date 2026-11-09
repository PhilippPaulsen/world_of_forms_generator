# 017 d3: Kandidatenfilter nach Schlüssigkeit (reine Funktion)
Typ: K
Stufe: L2
Git: neuer Branch task/017-d3-filter von main (erwarteter HEAD 4567a173). Kein Merge, kein Push.
     Arbeit und Bericht getrennt committen, usage.csv-Zeile ergänzen.
Regeln: docs/agent-rules.md. Bericht: reports/017.md (höchstens 30 Zeilen). Plan in 5 Zeilen vor der Arbeit.
Vorab: `git log -1 --oneline`, `git status --short` (leer). grep nach core/spatial-morph.js: spatialMorphScorePairing,
spatialMorphComparePairingScore, spatialMorphPairingLines; nach sketch.js (nur lesen): timelinePairingCandidates,
pairingDisplacement, allPermutations. Nach Fundstellen arbeiten, nicht nach Zeilennummern.

## Ziel (eine Kernänderung)
In core/spatial-morph.js eine reine Funktion `spatialMorphFilterPairingCandidates(layerA, layerB, candidates, opts)`.
- Eingabe: Kandidaten `{perm, flips, members, ...}` in der Form von `timelinePairingCandidates`; Zusatzfelder unverändert durchreichen.
- Bewertet jeden mit `spatialMorphScorePairing` (opts.poly durchreichen). Behält nur `dangling === 0 && nodeMiss === 0 && boundaryMiss === 0`.
- Sortiert die Übrigen mit `spatialMorphComparePairingScore` (beste zuerst, stabil).
- Rückgabe `{kept: [...Kandidaten mit Feld score], dropped, total, empty}`. Kein schlüssiger Kandidat: `kept: []`, `empty: true`, keine Ersatzliste.
- Rein: ändert Eingaben nicht, zeichnet nicht, kein Store-Zugriff, nicht in draw() eingehängt.

## Nicht ändern
sketch.js, core/tiling.js, core/faces.js, core/facecolor.js, tools/morph/off-path-golden.json, Baselines, Render-Pfad, UI.
Neue Top-Level-Namen nur mit Präfix `spatialMorph[A-Z]` (Namensregel der Geometrie-Suite beachten, wie in 016).

## Prüfpunkte
1. Eine schlüssige und eine trennende Zuordnung (Gegenprobe M1c, trennende hat kleinere dist): trennende fällt heraus.
2. Alle unschlüssig: `kept` leer, `empty === true`.
3. Reihenfolge: bester Score zuerst, bei Gleichstand ursprüngliche Reihenfolge.
4. Fall mit freien Linienenden (off-path-specs, curveType free): Kandidat mit freiem Ende fällt heraus, sofern dangling es zählt.
5. Reinheit: Eingaben vor/nach deep-equal; `dropped + kept.length === total`.
6. Ungültige oder ungleich lange Ebenen: `kept: []`, kein Absturz.
7. Guard: `git diff --quiet main..HEAD -- sketch.js core/tiling.js core/faces.js core/facecolor.js tools/morph/off-path-golden.json` Exit 0. NICHT tools/guard.sh.
8. Tests als neue Datei tools/morph/test-spatial-morph-pairing-filter.js, in die Suite eingehängt (Anzahl im Bericht). `?v=` anheben, falls der Render-Test es verlangt.

## Sabotagen (höchstens 4, auf Kopien), Test muss rot werden
Filter nur nach dangling (nodeMiss ignorieren); Sortierung umkehren; bei leerer Liste Ersatzliste liefern; Eingabe mutieren.

## Prüfung
`bash tools/proof.sh L2 017`. Bericht: Hash vor/nach, Dateien, Prüfpunkte 1-8, Sabotagen rot ja/nein, Testzahlen,
/usage vorher/nachher, Abweichungen.
