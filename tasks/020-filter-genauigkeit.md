# 020 Filter-Genauigkeit: Messung an Quadrat 2*/D4, 11+19 gegen 5+11
Typ: R (Messung, keine Änderung an core/ oder sketch.js)
Stufe: L1
Git: neuer Branch task/020-filter-genauigkeit von main (erwarteter HEAD 31a4b8e9). Kein Merge, kein Push.
     Schreiben nur: tasks/020…, reports/020.md, neues Messskript tools/morph/measure-filter-gap.js, usage.csv.
Regeln: docs/agent-rules.md. Bericht: reports/020.md (höchstens 30 Zeilen). Prüfung: `bash tools/proof.sh L1 020`.

## Fall
Quadrat-Muster, Symmetriegruppe 2*/D4. Anfang = Muster "2*/D4 11+19" (Dreieck-Sechsstrahl-Muster, Linien kreuzen sich in der
Zellmitte, Enden auf Kachelkanten), Ende = Muster "2*/D4 5+11" (8-Strahl-Stern mit Achtecken). Beide Ebenen mit gleicher Linienzahl
und aktuellem Zuordnungs-Editor-Kontext. Ebenendaten per grep suchen; wenn nicht auffindbar: STOP und fragen, nicht nachbauen.

## Beobachtung des Nutzers (Symptom, ist zu messen)
Mit Filter AN erscheinen in Ausnahmen Zwischenstufen "nicht schlüssig": Linienenden sind frei und mit keiner Nachbarmasche
verbunden (Kreuz in freien Zellen). "Schlüssig" heißt: jedes Linienende ist mit der Nachbarmasche (gegenüberliegende Kachelkante
oder Knoten) verbunden.

## Messung (Pflicht, ohne Fix)
1. Für alle Zuordnungen (perm, flips, bei Bedarf members) des Falls: Filterergebnis aus spatialMorphScorePairing /
   spatialMorphFilterPairingCandidates (ja/nein).
2. Je Kandidat an t = 0, 0.1, 0.25, 0.5, 0.75, 0.9, 1: Zahl freier Linienenden der Zwischenstellung (`dangling`, Zählweise
   tools/morph/test-spatial-morph-prototype.js) und Zahl der Seam-Lücken (Randende ohne Gegenstück an der gegenüberliegenden
   Kachelkante, vgl. tools/morph/seam-data.js). Zwischenstellung über dieselbe Funktion, die der Morph zum Zeichnen benutzt.
3. Tabelle: Kandidat | Filter ja/nein | max dangling über t | max Seam-Lücken über t | t des Maximums.
4. Ursache trennen (gemessen von vermutet getrennt): Gibt es Kandidaten mit Filter "ja" und Zwischen-dangling oder Seam-Lücken > 0?
   Falls ja: welche Größe fehlt im Score? Falls nein: Gegenprobe, ob der Nutzer-Fall mit Standardzuordnung oder mit gesetzten
   Flips/Members entsteht (timelineEnrichPairingCandidates prüfen).
5. Vorschlag: eine konkrete zusätzliche Messgröße mit Kostenabschätzung (ms je Kandidat bei 5 Zeitstellungen, gemessen), noch nicht umsetzen.

## Nicht ändern
sketch.js, core/*, tools/morph/off-path-golden.json, Baselines.
Bericht: Hash vor/nach, Tabelle (gekürzt auf Auffälliges), Ursache (gemessen/vermutet getrennt), Vorschlag mit Kosten, /usage vorher/nachher.
