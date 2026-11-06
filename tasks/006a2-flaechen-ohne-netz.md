# 006a2 Flächen im Morph auch ohne Netz
Typ: K
Stufe: L2
Git: neuer Branch task/006a2-flaechen-ohne-netz von task/006a-morph-flaechen (HEAD 9057a4da).
     Arbeit und Bericht getrennt committen. Kein Merge, kein Push. git status vorher leer
     (außer dieser Task-Datei, die mitcommittet wird), sonst STOP.
Regeln: docs/agent-rules.md. Kein Browser, keine Baselines. Vorher Plan in 5 Zeilen zeigen.

Ziel (nur core/spatial-morph-render.js und tools/):
1. Flächen im Morph sind aktiv, wenn alle Keyframes Flächen an haben, der Linientyp gerade ist,
   die Form ein Quadrat ist UND (kein Netz aktiv ODER ein Netz mit Field). Bei Single/Tiled-Netz
   bleibt es wie bisher: keine Flächen, Status netFacesNeedField.
2. Ohne Netz: activeNetWarp = null, Polygone unverändert gezeichnet, computeCellFaces wie bisher.
3. Veralteten Kommentar "the morph ignores the net" (grep -n "ignores the net" core/spatial-morph-render.js)
   an das heutige Verhalten anpassen.
4. Tests in tools/morph/test-spatial-morph-faces.js: ohne Netz Flächen vorhanden (Anzahl > 0,
   geschlossen); Single und Tiled weiter ohne Flächen mit Status; Feld-Netz unverändert;
   AUS-Pfad unverändert. Bestehende Tests, die "ohne Netz keine Flächen" erwarten, anpassen und im
   Bericht nennen.
5. Höchstens 3 Sabotagen, jede muss einen Test rot machen: (a) Bedingung zurück auf Feld-only,
   (b) Netz-Verzerrung im Ohne-Netz-Zweig aktiv, (c) Flächen auch im AUS-Pfad.

Akzeptanz: tools/proof.sh L2 006a2 PASS, 61/61 und 57/57; Diff gegen task/006a-morph-flaechen
nur in den genannten Dateien; `git diff --quiet task/006a-morph-flaechen..HEAD -- sketch.js
core/tiling.js core/faces.js tools/morph/off-path-golden.json` Exit 0.
Bericht reports/006a2.md, höchstens 25 Zeilen, mit /usage vorher und nachher.