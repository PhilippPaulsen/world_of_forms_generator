# 006a3 Flächen-Lücken im Morph
Typ: K
Stufe: L2
Git: neuer Branch task/006a3-flaechen-luecken von task/006a2-flaechen-ohne-netz (HEAD 4ac51bea).
     Arbeit und Bericht getrennt committen. Kein Merge, kein Push. git status vorher leer
     (außer dieser Task-Datei, die mitcommittet wird), sonst STOP.
Regeln: docs/agent-rules.md. Kein Browser, keine Baselines. Vorher Plan in 5 Zeilen zeigen.
Zeilenangaben aus älteren Berichten nicht übernehmen, immer mit grep suchen.

Symptom: Bei laufender Zeitleiste (Morph an, kein Netz, Flächen an) erscheinen weiße Lücken
(keine Fläche) in einzelnen Kacheln, an Kachelrändern und -ecken, besonders bei dichten Linien.

Aufgaben:
1. Messgröße: Deckung = Summe der Flächenpolygon-Inhalte / Kachelfläche, je Kachel.
   Für alle Keyframe-Paare in tools/morph/data/ (mindestens die zwei dichtesten und ein Paar
   mit freien Linienenden), Modi linear und radial, Fortschritt p = 0, 0.05, ..., 1 (21 Werte).
   Tabelle im Bericht: Paar, Modus, Anzahl Kacheln mit Deckung < 0.999, kleinste Deckung, schlechtestes p.
2. Diagnose an der schlechtesten Kachel: Ursache benennen (Polygon offen, fehlender Randknoten,
   am Rand gleitender Endpunkt, fast kollineare Linien, Toleranz, ...). Mit Beleg (Datei, Funktion).
3. Gegenprobe: dieselben Linien im Normalbild (kein Morph) durch computeCellFaces. Gibt es dort
   auch Lücken, ist es kein Morph-Fehler: dann STOP und berichten.
4. Fix nur, wenn die Ursache eindeutig ist und in core/spatial-morph-render.js lösbar.
   Sonst STOP und berichten: Ursache, 2 Optionen mit Aufwand in Commits, Empfehlung.
   Hinweis: core/spatial-morph.js (Kernfunktionen), core/faces.js, core/tiling.js, sketch.js
   dürfen nicht geändert werden.
5. Neuer Test (in tools/morph/test-spatial-morph-faces.js): Deckung >= 0.999 für alle Kacheln,
   alle Paare, alle 21 Werte von p, beide Modi. Höchstens 3 Sabotagen, jede macht den Test rot.

Akzeptanz: tools/proof.sh L2 006a3 PASS, 61/61 und 57/57; `git diff --quiet
task/006a2-flaechen-ohne-netz..HEAD -- sketch.js core/tiling.js core/faces.js core/spatial-morph.js
tools/morph/off-path-golden.json` Exit 0.
Bericht reports/006a3.md, höchstens 30 Zeilen, mit /usage vorher und nachher.