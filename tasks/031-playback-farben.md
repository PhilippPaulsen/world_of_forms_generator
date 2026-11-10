# Auftrag 031 — Playback-Farben: Flächenzuordnung statt Ortsabtastung (Einbau)

**Typ:** K, **Prüfstufe:** L3 (`bash tools/proof.sh L3 031`, dazu AUS-Pfad-Golden im Browser)
**Branch:** `task/031-playback-farben` von `task/030-hysterese`. Kein Merge, kein Push. Bericht: `reports/031.md` (höchstens 30 Zeilen). Plan in 5 Zeilen vor der Arbeit. Regeln: `docs/agent-rules.md`.

## Befund (reports/029.md, 030.md, gemessen)
`crossfadeFaceColors` (core/facecolor.js) mischt pro Ort: Abtastpunkte der bei t gemorphten Fläche werden in den starren Keyframe-Feldern A und B nachgeschlagen. Wächst die
Fläche, treffen Punkte Nachbarflächen; gleich gefärbte Flächen werden Pastell (Stern/Raute dLin bis 0.25). Variante h2c (Messskript tools/morph/measure-face-match.js, --hyst)
löst das zustandslos: je Fläche Überlappungsanteile mit den Keyframe-Polygonen (Bounding-Box-Vorauswahl), Farbe pro Seite = überlappungsgewichtetes Mittel der Polygonfarben
(linear), beide Seiten nach ihrer Überdeckung gewichtet, dann (1-t, t). Gemessen im Playback: Sprung ≤ heute + 3 in 7 von 7 Fällen, dLin gleiche Farben 0.0000, Stern/Raute
0.25 -> 0.08, Zeit 0.1 bis 5.6 ms je Frame mit Bounding-Box.

## Vorab
`git log -1 --oneline`, `git status --short` (leer). Per grep lesen: crossfadeFaceColors, playbackCrossfadeColors, keyframeColorField, keyframeFieldFor, _lookupField in
core/facecolor.js; die h2c-Implementierung in tools/morph/measure-face-match.js (Referenz, nicht neu erfinden); Tests tools/color/test-crossfade.js, test-playback-faces.js.
Bei zwei Wegen oder wenn der Einbau core/faces.js, core/spatial-morph-render.js, core/tiling.js oder eine der acht geschützten Funktionen berührt: STOP mit 2 Optionen.

## Ziel (eine Kernänderung)
1. crossfadeFaceColors nutzt h2c statt Ortsabtastung. keyframeColorField liefert zusätzlich die Polygonliste (Bounding-Box, Farbe) je Keyframe-Feld, ohne bestehende
   Rückgaben zu ändern.
2. Fallback wie in h2c (Fläche ohne Überdeckung: heutiger Ortspfad). Zustandslos, kein Pfadzustand.
3. Spatial-Pfad (spatialMorphRenderFaceColors) unverändert.
4. Gleiche Farben in A und B: Ergebnis exakt die Farbe (Toleranz 1e-9 im linearen Licht).

## Nicht ändern
sketch.js (acht Funktionen byte-gleich), core/faces.js, core/tiling.js, core/spatial-morph-render.js, core/spatial-morph.js, tools/morph/off-path-golden.json, Baselines.
Pin-Tests der Crossfade-Suiten nur in eigenem Commit mit Begründung (Golden der Mischung bewusst neu).

## Prüfpunkte
1. Fall Stern/Raute (026) im Playback, t = 0, 0.25, 0.5, 0.75, 1: dLin pro Fläche, max. Sprung pro Fläche (Schritt 0.05 und 0.01) gegen den Stand vor der Arbeit; Werte ≈ Messung 030
   (0.08; Sprung ≤ heute + 3).
2. Alle 7 Fälle aus 029/030 (Playback): Sprung ≤ heute + 3, dLin gleiche Farben < 0.02.
3. Verschiedene Farben in A und B: Ergebnis zwischen den Partnerfarben, Endpunkte t = 0 und 1 exakt wie Keyframes.
4. Zeit je Frame: dichte Muster (Hexagon) höchstens das Dreifache von heute (Bounding-Box).
5. Spatial-Pfad und AUS-Pfad unverändert: `git diff --quiet main..HEAD -- core/faces.js core/tiling.js core/spatial-morph-render.js core/spatial-morph.js sketch.js
   tools/morph/off-path-golden.json` (bei Kette gegen task/030-hysterese prüfen) Exit 0; Farborgel-Tests, test-p5-names, geschützte Tests 57/57 und 61/61.
6. Zustandslos: Vorwärts- und Rückwärtslauf liefern gleiche Farben (Test).

## Sabotagen (höchstens 4, auf Kopien)
Ortsabtastung statt h2c; Bounding-Box-Vorauswahl falsch (Fläche verfehlt Polygon); Seitengewichtung durch an/aus ersetzen; lineares Licht durch sRGB ersetzen.

## Prüfung
`bash tools/proof.sh L3 031` plus AUS-Pfad-Golden im Browser (Verfahren: Kopfkommentar tools/morph/measure-off-path.js, Beispiel reports/011.md). Bericht: Hashes, Prüfpunkte, Sabotagen,
Testzahlen, Zeiten, /usage vorher (5 h 28 %, Woche 73 %) / nachher, Abweichungen, was nicht im Browser gesehen wurde. Arbeit und Bericht getrennt committen, usage.csv-Zeile.
