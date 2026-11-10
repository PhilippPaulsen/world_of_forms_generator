# Auftrag 033 — Spatial-Farben: Hexagon-Sprung, Dreieck-Rest, vier Eckfelder (Messung)

**Typ:** R/K (Messprototyp, kein Eingriff in `core/` oder `sketch.js`)
**Branch:** `task/033-spatial-vier-ecken` von `task/032-spatial-farben`
**Prüfstufe:** L1 (`bash tools/proof.sh L1 033`, `tools/guard.sh main`)
**Schreiben nur:** Task-Datei, `reports/033.md` (höchstens 30 Zeilen, mit Hash des Messskripts), Erweiterung von `tools/morph/measure-face-match.js`, `usage.csv`. Kein Merge, kein Push. Plan in 5 Zeilen vorab. Regeln: `docs/agent-rules.md`.

## Befund (reports/032.md, gemessen)
s2_5 (Zuordner aus 031, Fläche < 5 % der Zelle: Raster) besteht 6 von 7 Spatial-Fällen und das Ziehen (0.01); Dreieck +4 Byte und dLin 0.0656 (wie heute). s1 scheitert am
Hexagon (55 gegen 30, vermutet: Gewicht g in dichten Mustern). Nur zwei Keyframes (Gewichte (1-t, t)) gemessen; spatialMorphRenderFaceColors mischt bis zu vier Eck-Raster
(bilineare Kacheln). Soll-Metrik wurde geschärft (sollPure, Flächen < 10 px² ausgenommen).

## Aufgabe (Stufen einzeln ausweisen)
1. Hexagon-Sprung von s1: Ursache belegen (Gewicht g, Partnerwechsel oder Polygonfarbe; Fläche, Schritt, Werte). Behebungsvariante s4 messen (z. B. g stetig über Containment
   beider Richtungen wie v3c, oder Bounding-Box/Größenfenster für Partner).
2. Dreieck-Rest: welche 3 Flächen halten dLin 0.0656, warum Raster hier falsch (Randpolygon/Standardfarbe?), ob eine Behandlung (z. B. Randflächen immer Raster) das Kriterium erfüllt.
3. Vier Eckfelder: Fälle mit bilinearer Kachel (vier Eckgewichte, aus tools/morph/ Daten oder gallery), Zuordnung je Eckfeld, Mischung mit den Eckgewichten gegen heutiges
   Raster; Sprung, dLin gleiche Farben, Zeit. Wenn kein geeigneter Fall existiert: synthetisch bauen und kennzeichnen.
4. Messgrößen wie 032 (Sprung pro Fläche, Toleranz +3 Byte, Anzahl > 12, dLin sollPure < 0.02, ms je Frame), Metrik unverändert zu 032, damit Zahlen vergleichbar bleiben;
   alte Metrik zusätzlich einmal ausweisen.
5. Abbruchkriterium: alle 7 Fälle plus Ziehen plus mindestens ein Vier-Ecken-Fall bestehen: Empfehlung "einbauen" mit Einbaustellen (Datei:Funktion), Schutz, Pins, L3,
   AUS-Pfad-Golden im Browser. Sonst STOP mit 2 Optionen, inkl. "s2_5 trotz Dreieck +4 einbauen" bewerten.

## Nicht ändern
`sketch.js`, `core/*`, `tools/morph/off-path-golden.json`, Baselines.

## Bericht
Hashes, Tabelle (nur Auffälliges), gemessen/vermutet getrennt, Empfehlung, `/usage` vorher / nachher.
