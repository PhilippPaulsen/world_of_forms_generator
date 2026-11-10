# Auftrag 028 — Zuordnung verfeinern: Orbit aus der Symmetriegruppe, weicher Fallback (Messung)

**Typ:** R/K (Messprototyp, kein Eingriff in `core/` oder `sketch.js`)
**Branch:** `task/028-zuordnung-verfeinerung` von `task/027-flaechenzuordnung-prototyp`
**Prüfstufe:** L1 (`bash tools/proof.sh L1 028`, `tools/guard.sh main`)
**Schreiben nur:** Task-Datei, `reports/028.md` (höchstens 30 Zeilen, mit Hash des Messskripts), Erweiterung von `tools/morph/measure-face-match.js`, `usage.csv`. Kein Merge, kein Push. Plan in 5 Zeilen vorab. Regeln: `docs/agent-rules.md`.

## Befund (reports/027.md)
Zuordnung trifft Stern/Rauten (5 von 5, dLin 0), aber nur 17-38 % der Flächen haben Partner; der Wechsel Partner/Fallback erzeugt Sprünge (bis 37 gegen 25 heute).
Orbit wird aus Polygonen abgeleitet, nicht aus der Symmetriegruppe.

## Aufgabe (Messung, nacheinander, jede Stufe einzeln ausweisen)
1. Orbit aus der Symmetriegruppe (Gruppenelemente wie in 021/spatialMorphNodeMap) statt aus Polygonen. Anteil eindeutiger Partner vorher/nachher.
2. Weicher Fallback: (a) Fallbackfarbe über ein t-Fenster (z. B. 0.1) mit der Partnerfarbe überblenden; (b) Ortsabtastung nur innerhalb des Polygons der
   Keyframe-Fläche. Max. Farbsprung pro Fläche zwischen t und t+0.05 (measure-color-jumps.js) für beide Varianten gegen heutigen Stand und gegen 027.
3. Fälle: Quadrat N=4 D4 (026), mindestens ein Hexagon- und ein Dreiecksfall, mindestens ein Paar mit Aufspaltung/Verschmelzung aus
   gallery/manifest.jsonl oder tools/morph/data/.
4. Randfall t = 0 im Spatial-Pfad (Endpunkt auf Kante projiziert): Ursache benennen, Behandlung vorschlagen.
5. Abbruchkriterium: Ist der max. Sprung pro Fläche in allen Fällen nicht größer als heute und dLin bei gleichen Farben unter 0.02, Empfehlung "einbauen"
   für den 028-Einbau (Datei:Funktion, Schutz, Pins, L3); sonst STOP mit 2 Optionen.

## Nicht ändern
`sketch.js`, `core/*`, `tools/morph/off-path-golden.json`, Baselines.

## Bericht
Hashes, Tabelle (nur Auffälliges), gemessen/vermutet getrennt, Empfehlung, `/usage` vorher (5 h 14 %, Woche 72 %) / nachher.
