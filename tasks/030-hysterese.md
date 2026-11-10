# Auftrag 030 — Hysterese beim dominanten Keyframe-Polygon (Messung)

**Typ:** R/K (Messprototyp, kein Eingriff in `core/` oder `sketch.js`)
**Branch:** `task/030-hysterese` von `task/029-stetige-gewichtung`
**Prüfstufe:** L1 (`bash tools/proof.sh L1 030`, `tools/guard.sh main`)
**Schreiben nur:** Task-Datei, `reports/030.md` (höchstens 30 Zeilen, mit Hash des Messskripts), Erweiterung von `tools/morph/measure-face-match.js`, `usage.csv`. Kein Merge, kein Push. Plan in 5 Zeilen vorab. Regeln: `docs/agent-rules.md`.

## Befund (reports/029.md, gemessen)
v3cb (Nähe 1.5, Containment-Gewicht, Fallback aus dem dominanten Keyframe-Polygon) erreicht dLin 0.0000 bei gleichen Farben und Stern/Raute 0.054, hat aber zu große
Sprünge (Quadrat Playback 158 gegen 70, Hexagon Spatial 49/84 gegen 30, Galerie Playback 54 gegen 25). Quelle (vermutet): Wechsel des dominanten Keyframe-Polygons
zwischen t und t+0.05. v3 (ohne Fallback-Fix) hält die Sprünge, verfehlt aber dLin im Spatial-Pfad.

## Aufgabe
1. Quelle der v3cb-Sprünge belegen: Anteil der Sprünge > 12, bei denen sich das dominante Polygon (oder Partner) zwischen t und t+0.05 ändert.
2. Variante h1: v3cb mit Hysterese: dominantes Polygon einer Fläche wechselt nur, wenn der neue Kandidat den alten um Faktor 1.25 bei der Überlappung übertrifft,
   Zustand über die Schrittfolge t = 0..1 geführt (und in Gegenrichtung 1..0 gleiche Ergebnisse prüfen: Pfadabhängigkeit benennen).
3. Variante h2: statt Hysterese stetige Überblendung der Fallbackfarben aller Polygone mit Überlappungsanteil als Gewicht (kein Entscheid).
4. Fälle: die 7 aus 029, Playback und Spatial, t-Schritt 0.05; zusätzlich Zeitschritt 0.01 für Stern/Raute (Ziehen).
5. Messgrößen je Variante gegen heute, v3, v3cb: max. Sprung pro Fläche (Toleranz +3 Byte gegen heute), Anzahl Sprünge > 12, dLin gleiche Farben (< 0.02),
   Stern/Raute-Abweichung, ms je Frame mit Bounding-Box-Vorauswahl (dichte Muster).
6. Abbruchkriterium: Sprung ≤ heute + 3 UND dLin < 0.02 in allen Fällen: Empfehlung "einbauen" (Datei:Funktion, Schutz, Pins, L3, AUS-Pfad-Golden im Browser).
   Sonst STOP mit 2 Optionen, inkl. "nur Playback-Pfad einbauen" bewerten.

## Nicht ändern
`sketch.js`, `core/*`, `tools/morph/off-path-golden.json`, Baselines.

## Bericht
Hashes, Tabelle (nur Auffälliges), gemessen/vermutet getrennt, Empfehlung, `/usage` vorher (5 h 23 %, Woche 73 %) / nachher.
