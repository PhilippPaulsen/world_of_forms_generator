# Auftrag 032 — Flächenzuordnung im räumlichen Morph (Messung)

**Typ:** R/K (Messprototyp, kein Eingriff in `core/` oder `sketch.js`)
**Branch:** `task/032-spatial-farben` von `main` (erwarteter HEAD `5f444408`)
**Prüfstufe:** L1 (`bash tools/proof.sh L1 032`, `tools/guard.sh main`)
**Schreiben nur:** Task-Datei, `reports/032.md` (höchstens 30 Zeilen, mit Hash des Messskripts), Erweiterung von `tools/morph/measure-face-match.js`, `usage.csv`. Kein Merge, kein Push. Plan in 5 Zeilen vorab. Regeln: `docs/agent-rules.md`.

## Befund (reports/030.md, 031.md, gemessen)
Im Playback-Pfad ordnet crossfadeFaceColors (core/facecolor.js, Task 031) je Fläche Partner in A und B zu (Stern/Raute 0.24 -> 0.08, Sprünge ≤ heute + 3). Der räumliche
Morph (spatialMorphRenderFaceColors, spatialMorphRenderCornerField in core/spatial-morph-render.js) mischt weiter pro Ort über Eck-Raster: dLin bei gleichen Farben 0.12 bis 0.17,
Stern/Raute bis 0.32. Messung 030: h2c besteht Spatial bei Schritt 0.05, verletzt aber das Ziehen mit Schritt 0.01 (Stern/Raute 108 gegen 69, kleine Eckfläche n = 4, A ≈ 148).
Ursache vermutet (Farbfeldgrenze), nicht geprüft.

## Aufgabe
1. Ursache des Fein-Sprungs belegen: Welche Fläche, welcher Schritt, welche Seite (A oder B) wechselt die Polygonüberdeckung? Vergleich mit heutiger Rasterabtastung (warum dämpft sie?).
2. Varianten (jede einzeln ausweisen): s1 = Zuordner aus 031 auf die Spatial-Flächen (Partner aus den Keyframe-Flächen der Eck-Raster-Quelle); s2 = s1 mit Rasterfallback für
   Flächen unter einer Mindestgröße (Schwelle ausmessen: 1 %, 2 %, 5 % der Kachelfläche); s3 = Randflächen-Referenz (Verfahren aus 028 Punkt 5) nur wenn s1/s2 am Rand scheitern.
3. Fälle: die 7 aus 029/030, nur Spatial-Pfad, Schritt 0.05; Stern/Raute zusätzlich 0.01; dichte Muster mit Bounding-Box-Vorauswahl.
4. Messgrößen je Variante gegen heute: max. Sprung pro Fläche (Toleranz +3 Byte), Anzahl Sprünge > 12, dLin gleiche Farben (< 0.02), Stern/Raute, ms je Frame (Node).
5. Abbruchkriterium: Sprung ≤ heute + 3 (auch bei 0.01) UND dLin < 0.02 in allen 7 Fällen: Empfehlung "einbauen" mit Einbaustellen (Datei:Funktion), Schutz
   (core/spatial-morph-render.js, core/spatial-morph.js, Pins test-spatial-morph-render.js, -color.js, off-path-golden), Prüfstufe L3 und AUS-Pfad-Golden im Browser. Sonst STOP mit 2 Optionen.

## Nicht ändern
`sketch.js`, `core/*`, `tools/morph/off-path-golden.json`, Baselines.

## Bericht
Hashes, Tabelle (nur Auffälliges), gemessen/vermutet getrennt, Empfehlung, `/usage` vorher (5 h 41 %, Woche 75 %) / nachher.
