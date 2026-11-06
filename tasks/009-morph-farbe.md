# 009 Farbe der Flächen im Morph (006b)
Typ: K
Stufe: L2
Git: neuer Branch task/009-morph-farbe von main (HEAD e8d83bac oder neuer: git log -1 melden).
     Arbeit und Bericht getrennt committen. Kein Merge, kein Push. git status vorher leer
     (außer dieser Task-Datei, die mitcommittet wird), sonst STOP.
Regeln: docs/agent-rules.md. Kein Browser, keine Baselines. Vorher Plan in 5 Zeilen zeigen.
Zeilenangaben aus älteren Berichten nicht übernehmen, immer mit grep suchen.
Arbeitsordner: das Repo-Root, nicht ein Elternordner.

Ziel: Die im Morph gezeichneten Flächen (Task 006a/006a2) bekommen Farbe statt Einheitsgrau.
Vorlage: reports/003.md (Inventur) Punkt 2, Prototyp world_of_forms_morph_v2 (nur lesen):
Eck-Farbfelder der vier Ecken des Keyframe-Paars, pro Fläche an Schwerpunkt gesampelt,
pro Kachel über die Ecken gemischt.
Mischraum: Linear Light (wie crossfadeFaceColors in core/facecolor.js). [Zeile ändern für sRGB]
Ungefärbte Keyframes: Standardpalette wie im Prototyp (_DEFAULT_CORNER_PALETTES), nur lesend.

Aufgaben:
1. Farbe der Flächen aus Keyframe-Farbfeldern und Fortschritt ableiten, in
   core/spatial-morph-render.js (und core/spatial-morph.js nur für reine Hilfsfunktionen und
   Statuscodes). Vorhandene Funktionen aus core/facecolor.js nur AUFRUFEN, nicht ändern.
   Keine Schreibzugriffe auf Keyframe-Stores, ensureDefaultGrayFill nicht aufrufen.
2. Messgröße (nicht nur "Polygon geschlossen"): (a) Anzahl verschiedener Farben je Kachel > 1 bei
   gefärbten Keyframes, (b) Farben bei p = 0 und p = 1 liegen nahe den Farben der jeweiligen
   Keyframe-Ebene (Abstand angeben, Schwelle begründen), (c) Farbverlauf über 21 Werte von p
   stetig (größter Sprung zwischen Nachbarwerten angeben), (d) ungefärbte Keyframes ergeben die
   Standardpalette, nicht Einheitsgrau.
3. Frame-Zeit messen (Node, dieselbe Testszene wie in 006a2): mit Farbe gegen ohne Farbe.
   Bei mehr als 120 ms pro Frame: nicht optimieren, sondern 2 Optionen mit Aufwand nennen.
4. Neuer Test in tools/morph/test-spatial-morph-faces.js oder eigener Datei. Höchstens 5 Sabotagen,
   jede muss einen Test rot machen; melden, wenn eine nur über einen fremden Test auffällt.
5. Keine Änderung am Normalbild, am AUS-Pfad und an den Linien.

Akzeptanz: tools/proof.sh L2 009 PASS, 61/61 und 57/57; `git diff --quiet main..HEAD --
sketch.js core/tiling.js core/faces.js core/facecolor.js tools/morph/off-path-golden.json` Exit 0.
Statustext prüfen: Hinweis "Morph faces: field net only" bleibt unverändert.
Bericht reports/009.md, höchstens 30 Zeilen, mit /usage vorher und nachher und einer Liste dessen,
was NICHT im Browser geprüft ist.