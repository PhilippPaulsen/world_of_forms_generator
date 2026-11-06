# 010 Morph-Farbe: Blitzer und Grautöne
Typ: K
Stufe: L2
Git: neuer Branch task/010-morph-farbe-korrektur von task/009-morph-farbe (HEAD a55fbf2a).
     Arbeit und Bericht getrennt committen. Kein Merge, kein Push. git status vorher leer
     (außer dieser Task-Datei, die mitcommittet wird), sonst STOP.
Regeln: docs/agent-rules.md. Kein Browser, keine Baselines. Vorher Plan in 5 Zeilen zeigen.
Zeilenangaben aus älteren Berichten nicht übernehmen, immer mit grep suchen.
Arbeitsordner: das Repo-Root.

Beobachtung im Browser (Morph an, linear/radial, Flächen mit Farbe):
(b) Die Flächenfarben bewegen sich langsamer als die Linien; es gibt sichtbare Sprünge/Blitzer.
(e) Ebenen mit Grautönen bekommen Default-Farben (Prototyp-Palette). Das ist NICHT gewünscht:
    die tatsächliche Füllung der Ebene soll verwendet werden, auch Grau.

Aufgaben:
1. MESSEN zuerst (b). 3 dichte Paare plus 1 Paar mit Farben, linear und radial, p = 0 bis 1 in
   Schritten von 0.02. Je Kachel die Flächen zwischen Nachbarwerten verfolgen (Zuordnung über
   Schwerpunkt-Nähe und Überlappung). Je Fläche: Farbsprung (größter Kanalunterschied in sRGB-Bytes).
   Tabelle: Paar, Modus, Anzahl Flächen mit Sprung > 12, größter Sprung, schlechtestes p, Anteil nicht
   zuordenbarer Flächen. Zum Vergleich im selben Schritt: größte Verschiebung der Linienendpunkte in px.
2. Ursache benennen (Funktion, Beleg). Mögliche Kandidaten, nichts davon annehmen: Farbe aus dem Feld
   der Ecke statt aus der Fläche selbst, Wechsel der Flächenzahl zwischen Schritten, Cache,
   Eckgewichte. Gegenprobe: Springt die Farbe auch, wenn die Flächengeometrie stabil bleibt?
3. Fix nur, wenn die Ursache eindeutig ist und in core/spatial-morph-render.js oder reinen Helfern
   in core/spatial-morph.js lösbar. Sonst STOP: Ursache, 2 Optionen mit Aufwand in Commits,
   Empfehlung.
4. (e) Grautöne: Bei p = 0 und p = 1 muss die Farbe jeder Fläche der Farbe im Normalbild der
   jeweiligen Ebene entsprechen, auch bei Grau. Finde mit grep, wie das Normalbild die Füllung
   bestimmt, und verwende es nur lesend. Die Prototyp-Palette (_DEFAULT_CORNER_PALETTES) entfällt
   als Ersatz für vorhandene Füllungen. Keine Schreibzugriffe auf Stores.
   Hat eine Ebene Flächen aus: wie bisher keine Flächen im Morph, nicht ändern.
5. Tests: Sprungmessung aus 1 als Schwelle (Schwelle aus Messung ableiten und begründen),
   Grau-Fall (Farbe bei p = 0 und 1 gleich Normalbild). Höchstens 4 Sabotagen, jede macht einen
   Test rot; melden, wenn eine nur über einen fremden Test auffällt.
6. ROADMAP.md: eine Zeile bei den bekannten Einschränkungen: Bilinear mit 3 oder 4 Ebenen
   animiert nicht.
Nicht ändern: bilinear, Linien, Normalbild, AUS-Pfad.

Akzeptanz: tools/proof.sh L2 010 PASS, 61/61 und 57/57; `git diff --quiet main..HEAD --
sketch.js core/tiling.js core/faces.js core/facecolor.js tools/morph/off-path-golden.json` Exit 0.
Bericht reports/010.md, höchstens 30 Zeilen, mit /usage vorher und nachher und der Liste dessen,
was nicht im Browser geprüft ist.