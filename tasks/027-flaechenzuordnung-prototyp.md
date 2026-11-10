# Auftrag 027 — Prototyp Flächenzuordnung für die Morph-Farbe (Messung)

**Typ:** R/K (Messprototyp, kein Eingriff in `core/` oder `sketch.js`)
**Branch:** `task/027-flaechenzuordnung-prototyp` von `main` (erwarteter HEAD `f585cba9`)
**Prüfstufe:** L1 (`bash tools/proof.sh L1 027`, `tools/guard.sh main`)
**Schreiben nur:** Task-Datei, `reports/027.md` (höchstens 30 Zeilen), `tools/morph/measure-face-match.js` (neu, enthält die Zuordnungsfunktion als Prototyp), `usage.csv`.
Kein Merge, kein Push. Plan in 5 Zeilen vor der Arbeit. Regeln: `docs/agent-rules.md`.

## Befund (reports/026.md, gemessen)
`spatialMorphRenderFaceColors` und `playbackCrossfadeColors`/`crossfadeFaceColors` mischen pro Ort: sie tasten die starren Keyframe-Felder A und B an den
Positionen der bei t gemorphten Fläche ab. Wächst oder verschiebt sich eine Fläche, treffen Abtastpunkte Nachbarflächen des anderen Keyframes, und gleich
gefärbte Flächen (Stern violett, Raute gelb in A und B) werden zu Pastell (dLin bis 0.32 statt 0). Es fehlt die Zuordnung: gemorphte Fläche bei t gegen
Fläche in A und Fläche in B.

## Aufgabe
Im Messskript (Vorlage `tools/morph/measure-color-blend.js`, `measure-color-jumps.js` matchTile) eine reine Zuordnungsfunktion prototypisieren: für jede
Fläche des gemorphten Blatts bei t die Partnerfläche in Keyframe A und in B bestimmen. Kriterien: gleicher Symmetrie-Orbit, gleiche Eckenzahl,
Schwerpunktnähe bzw. Schwerpunkt-Einschluss, Flächenverhältnis; eindeutig oder nicht eindeutig (aufgespalten, verschmolzen, kein Partner). Vorgesehene
Verwendung später: Farbe = Mischung der Partnerfarben mit (1-t, t) im linearen Licht, Ortsfeld nur als Fallback.

## Messung (Pflicht, Messgröße pro Fläche, nicht Mittelwert)
1. Fall aus 026 (Quadrat N=4, D4, [[1,12]] gegen [[1,8]], Stern/Raute): bei t = 0, 0.1, 0.25, 0.5, 0.75, 0.9, 1: Anteil eindeutig zugeordneter Flächen,
   Anteil Fallback, dLin(Soll gegen Ist) bei Mischung über die Zuordnung (Soll 0 bei gleichen Farben).
2. Zwei weitere Fälle: (a) unterschiedliche Farben in A und B (Soll = lineare Mischung der Partnerfarben); (b) Aufspaltung oder Verschmelzung von Flächen
   (andere Linienzahl-Topologie, Beispiele aus `tools/morph/data/` oder gallery): wie viele Flächen ohne eindeutigen Partner, was der Fallback macht, ob
   Sprünge zwischen Nachbarschritten entstehen (`measure-color-jumps.js`: maximaler Farbsprung pro Fläche zwischen t und t+0.05).
3. Beide Pfade (Playback-Blatt und Spatial-Morph-Blatt) abdecken oder begründen, warum einer genügt.
4. Rechenzeit je Frame (ms) der Zuordnung in Node; Vergleich mit der heutigen Ortsabtastung.
5. Vorschlag für 028: Einbaustellen (Datei:Funktion), Schutz-Bewertung (`core/facecolor.js`, `core/spatial-morph-render.js`, Pins, Prüfstufe), Risiken.
   Noch nicht umsetzen.

## Nicht ändern
`sketch.js`, `core/*`, `tools/morph/off-path-golden.json`, Baselines.

## Bericht
`reports/027.md`: Hash vor/nach, Tabelle (nur Auffälliges), gemessen/vermutet getrennt, Vorschlag 028, `/usage` vorher (5 h 3 %, Woche 70 %) / nachher.
