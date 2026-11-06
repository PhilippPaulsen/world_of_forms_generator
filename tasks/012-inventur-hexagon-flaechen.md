# 012 Inventur: Flächen im Morph bei Hexagon und Dreieck
Typ: R (nur lesen)
Git: kein Code ändern. Nur reports/012.md auf neuem Branch task/012-inventur-hexagon von main
     (git log -1 melden), plus diese Task-Datei committen. Kein Merge, kein Push.
     git status vorher leer (außer dieser Task-Datei), sonst STOP.
Regeln: docs/agent-rules.md. Keine Tests, keine Baselines, kein Browser.
Zeilenangaben aus älteren Berichten nicht übernehmen, immer mit grep suchen.
Arbeitsordner: das Repo-Root. Prototyp world_of_forms_morph_v2 nur lesen.

Beobachtung: Im Morph erscheinen bei Hexagon keine Farbflächen, nur Linien.
Zu klären, jeweils mit Datei und Funktion (grep, keine Vermutung):
1. Wo schließt core/spatial-morph-render.js Hexagon und Dreieck von Flächen aus (Bedingung, Funktion)?
   Ist das eine Entscheidung (Kommentar, Bericht reports/006a-morph-flaechen.md) oder eine Lücke?
2. Prototyp: Zeichnet er im Morph Flächen bei Hexagon oder Dreieck? Wenn ja: wo, mit welchen
   Besonderheiten (Randpolygon, Kachelform, Gitter)?
3. Normalbild: Wie bestimmen computeCellFaces und die Farbzuordnung die Flächen bei Hexagon
   und Dreieck (core/faces.js, core/tiling.js)? Gibt es Annahmen "Quadrat" (Randpolygon aus
   outerCorners, Kachelraster, Eckgewichte), die im Morph-Pfad verletzt wären?
4. Welche Teile des Morph-Farbpfads (Eckfelder, Raster, Eckgewichte, Randpolygon) sind
   quadratspezifisch? Je Teil: übertragbar ja/nein, Beleg.
5. Empfehlung: Aufwand in Commits für Hexagon, für Dreieck, getrennt; Risiko für Schutzdateien
   (sketch.js, core/tiling.js, core/faces.js, core/facecolor.js, off-path-golden.json); Vorschlag
   Typ und Stufe; offene Fragen an mich (höchstens 3).
Bericht reports/012.md, höchstens 30 Zeilen, am Ende: Wurde alles gelesen oder nur teilweise?