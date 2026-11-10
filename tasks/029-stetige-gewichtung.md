# Auftrag 029 — Stetige Gewichtung statt hartem Entscheid Partner/Fallback (Messung)

**Typ:** R/K (Messprototyp, kein Eingriff in `core/` oder `sketch.js`)
**Branch:** `task/029-stetige-gewichtung` von `task/028-zuordnung-verfeinerung`
**Prüfstufe:** L1 (`bash tools/proof.sh L1 029`, `tools/guard.sh main`)
**Schreiben nur:** Task-Datei, `reports/029.md` (höchstens 30 Zeilen, mit Hash des Messskripts), Erweiterung von `tools/morph/measure-face-match.js`, `usage.csv`. Kein Merge, kein Push. Plan in 5 Zeilen vorab. Regeln: `docs/agent-rules.md`.

## Befund (reports/028.md, gemessen)
Orbit aus der Gruppe bringt nichts. Zu streng ist Schwerpunkt-Einschluss; mit Nähekriterium (Schwerpunktabstand ≤ 1.5·√Fläche) steigt der Partneranteil im Quadrat
auf 76/43 %. Sprünge entstehen am harten Wechsel Partner/Fallback (Dreieck Spatial 20 -> 49, Galerie Playback 25 -> 35, Hexagon Spatial 30 -> 67/84).
Vermutung (ungemessen): stetige Gewichtung beseitigt sie.

## Aufgabe (Stufen einzeln ausweisen)
1. Variante v3: Nähekriterium 1.5 + stetige Gewichtung: je Fläche Gewicht g in [0,1] = Probenanteil der Fläche im Partnerpolygon (Partner A und B getrennt);
   Farbe = g * Partnermischung(1-t,t) + (1-g) * Ortsabtastung (linear, wie heute). Kein harter Entscheid.
2. Variante v3r: v3 plus Referenzflächen am Rand (Spatial, Verfahren aus 028 Punkt 5).
3. Fälle: die 5 aus 028 plus mindestens je ein KURATIERTES Hexagon- und Dreiecksbeispiel aus gallery/manifest.jsonl (nicht Zufallspaare), Playback und Spatial,
   t = 0..1 Schritt 0.05.
4. Gemessen je Variante gegen heute, v1, v2b: max. Farbsprung pro Fläche zwischen t und t+0.05 (Byte-Kanalmaximum), Anzahl Sprünge > 12, dLin bei gleichen
   Farben (alle Flächen, alle t), Anteil g > 0.5, Rechenzeit ms je Frame (neu messen).
5. Abbruchkriterium: max. Sprung je Fall nicht größer als heute (Toleranz +3 Byte) UND dLin gleiche Farben < 0.02 in allen Fällen: Empfehlung "einbauen" mit
   Einbaustellen (Datei:Funktion), Schutz, Pins, L3. Sonst STOP mit 2 Optionen, auch die Möglichkeit "nur Quadrat-artige Fälle verbessern, sonst heutiger Pfad" bewerten.

## Nicht ändern
`sketch.js`, `core/*`, `tools/morph/off-path-golden.json`, Baselines.

## Bericht
Hashes, Tabelle (nur Auffälliges), gemessen/vermutet getrennt, Empfehlung, `/usage` vorher (5 h 19 %, Woche 72 %) / nachher.
