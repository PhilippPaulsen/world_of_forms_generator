# 013 Flächen und Farbe im Morph bei Hexagon und Dreieck
Typ: K
Stufe: L2
Git: neuer Branch task/013-morph-flaechen-hex-tri von main (git log -1 melden; Stand 285d364f oder neuer).
     Arbeit pro Form ein Commit (Hexagon, dann Dreieck), danach Bericht getrennt.
     Kein Merge, kein Push. git status vorher leer (außer dieser Task-Datei, die mitcommittet wird), sonst STOP.
Regeln: docs/agent-rules.md. Kein Browser, keine Baselines. Vorher Plan in 5 Zeilen zeigen.
Zeilenangaben aus älteren Berichten nicht übernehmen, immer mit grep suchen.
Arbeitsordner: das Repo-Root. Prototyp world_of_forms_morph_v2 nur lesen.
Grundlage: reports/012.md (Inventur) und reports/006a3.md, reports/009.md, reports/010.md.

Ziel: Flächen UND Farbe im Morph für Hexagon und Dreieck, mit denselben Regeln wie beim Quadrat
(Flächen an für alle Keyframes, gerade Linien; Füllung wie im Normalbild; Grau ist eine Füllung).

Aufgaben:
1. Vorab messen (nichts ändern): Der Hex-Deckung-Wert aus 006a3 (>= 0.92) und das Dreieck wurden nur in
   einer Messkopie gemessen. Miss im Produktivpfad nach Freischaltung (Aufgabe 2, noch uncommittet) die
   Deckung je Kachel mit den dichten Paaren aus tools/morph/measure-*.js (angepasst auf die Form) für
   p = 0, 0.1, ..., 1. Gegenprobe wie in 006a3: dieselben Linien als Basisverbindungen durch
   computeCellFaces im Normalbild. Gleiche Deckung dort = bekannte Einschränkung von core/faces.js,
   NICHT beheben, nur in die ROADMAP.
2. Freischaltung: Die Formbedingung in core/spatial-morph-render.js ersetzen. Randpolygon,
   Eckfelder, Raster, Gewichte (pro Teilkachel wie bei den Linien) und tile.flip/tile.rot wie im
   Prototyp und laut reports/012.md. Netz: bei Hexagon/Dreieck das heutige Verhalten unverändert
   lassen; beschreibe im Bericht, was Netz an bei diesen Formen heute bewirkt (Status, Linien, Flächen).
3. Farbe: bei p = 0 und p = 1 muss jede Fläche der Farbe im Normalbild der jeweiligen Ebene
   entsprechen (größter Abstand angeben, auch bei Grau), je Form.
4. Stetigkeit: Farbsprung je verfolgter Fläche wie in 010 (tools/morph/measure-color-jumps.js
   auf die Form erweitern), Anteil nicht zuordenbarer Flächen angeben. Schwelle aus der Messung
   ableiten und begründen, nicht aus 010 übernehmen.
5. Frame-Zeit je Form in Node (dieselbe Methode wie 009), mit und ohne Farbe. Nicht optimieren.
6. Tests: neue Prüfungen je Form (Flächen vorhanden und geschlossen, Deckung wie in Aufgabe 1,
   Endfarben wie Aufgabe 3, Sprung wie Aufgabe 4); der AUS-Pfad bleibt unverändert; bestehende Tests,
   die "Hexagon/Dreieck ohne Flächen" erwarten, anpassen und im Bericht nennen. Höchstens 5 Sabotagen
   je Form, jede macht einen Test rot; melden, wenn eine nur über einen fremden Test auffällt.
7. STOP-Regeln: Ist die Ursache einer Lücke oder eines Fehlers nicht eindeutig oder liegt sie in
   core/faces.js, core/tiling.js, core/facecolor.js oder sketch.js: STOP, Ursache, 2 Optionen mit
   Aufwand in Commits, Empfehlung. Hexagon-Commit nicht machen, wenn Hexagon scheitert; dann Dreieck
   nur, wenn es unabhängig davon sauber ist.
8. ROADMAP.md: die Einschränkung "Flächen nur bei Quadrat" entfernen bzw. durch das Ergebnis ersetzen.

Akzeptanz: tools/proof.sh L2 013 PASS, 61/61 und 57/57; `git diff --quiet main..HEAD --
sketch.js core/tiling.js core/faces.js core/facecolor.js tools/morph/off-path-golden.json` Exit 0.
Bericht reports/013.md, höchstens 30 Zeilen, mit /usage vorher und nachher und der Liste dessen,
was nicht im Browser geprüft ist.