# Auftrag 072c2 — Sektorzähler im Tooltip

**Typ K, Prüfstufe L2.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/072c2-sektorzaehler.md mit diesem Text an. Bericht: reports/072c2.md (höchstens 20 Zeilen). Branch: task/072c2-sektorzaehler von main (erwarteter HEAD 6f85fd39). Kein Merge, kein Push. Plan in 3 Zeilen vorab.

**Befund (zu belegen):** Der Tooltip am Namensfeld (patternNameTooltip in sketch.js, Glossar glossary.letter / Sektor) nennt "Buchstabe g (7 Sektoren)" im Quadrat. Nach reports/054.md und 072b.md ist die Buchstabenreihe je Form Dreieck a e i n, Quadrat a d g k n, Sechseck a c e g i l n; der Buchstabe nennt die Zahl n der berührten Sektoren als Rang in dieser Reihe (Quadrat: a=1, d=2, g=3, k=4, n=5; Sechseck: a=1, c=2, e=3, g=4, i=5, l=6, n=7; Dreieck: a=1, e=2, i=3, n=4). Der Tooltip scheint stattdessen den Alphabetindex zu nehmen (g = 7). Auftraggeber-Beispiele: Quadrat `52ḡ` (richtig: 3 Sektoren), Sechseck `12.6c` (richtig: 2), Dreieck `15a` (1).

**Aufgabe:**
1. Messung vor jeder Änderung: git grep der Stelle, die die Sektorzahl für den Tooltip berechnet (patternNameTooltip, Glossar, formatLineKey, Buchstaben-Rang in core/orbits.js/_letterFor oder ähnlich). Tabelle: Form, Buchstabe, Tooltip-Wert alt, Rang in der Reihe (soll). Zeigen die Orakel-Funktionen (tools/gitter/measure-name-rule.js, letterFor) den Rang bereits an? Bei zwei Wegen oder Abweichung vom Befund: STOP mit 2 Optionen.
2. Behebung (kleinster Eingriff): Sektorzahl = Rang des Buchstabens in der Reihe der Form (aus der eine Quelle, kein zweites Alphabet); gilt für die volle Gruppe und für "nur Drehung" (072c). Keine Änderung der Namen, Schlüssel, Export, Katalog.
3. Tooltip-Text: "(1 Sektor)"/"(n Sektoren)" bleibt; zusätzlich prüfen, dass die Zahl nie größer als die Zahl der Buchstaben der Reihe ist (Dreieck 4, Quadrat 5, Sechseck 7).
4. Regressionstest: für alle drei Formen und alle Buchstaben der Reihe die richtige Sektorzahl (Tabelle), auch zweistellige Familien; der Test ist auf 6f85fd39 rot (belegen), danach grün. Gegen die Orakelberechnung (Berührungszahl der Sektoren eines Zuges, wo das Orakel sie direkt liefert) stichprobenartig vergleichen und Abweichungen listen.
5. Zusätzlich prüfen und nur MELDEN (nicht beheben): Info-Karte, Name und Gitterzeile: stehen "5□/ ... ₄" und "Gitter: ..." im DOM in getrennten Blöcken (Auftraggeber sah beim Kopieren "…66dD₄Gitter: 5q1 · Knoten: 36" ohne Trennung): Struktur und CSS (white-space: pre-line) beschreiben, im Browser den echten Zeilenumbruch bestätigen (Screenshot-Beschreibung).

**Nicht ändern:** acht geschützte Funktionen in sketch.js (byte-gleich; liegt die Stelle in einer davon: STOP), core/faces.js, core/tiling.js, core/facecolor.js, tools/morph/off-path-golden.json, Baselines, Speicherformat, Katalog, Session, Export, Namensberechnung. Pins nur mit eigenem Commit und Begründung. ?v= gemeinsam bumpen (z. B. 20261202gridfu).

**Prüfpunkte:** (1) Namen, Export, Session, Katalog, Gitter, Linien, Morph-Frames byte-gleich zu 6f85fd39 (measure-Skripte). (2) Regressionstest rot/grün. (3) Browser: Tooltip-Text lesen für Quadrat 52g, Sechseck 12.6c, Dreieck 15a (voller Gruppe und nur Drehung); AUS-Pfad-Golden einmal 30/30 (Ausreißer unter Last: bei ruhigem System wiederholen und nennen); geschützte Tests 61/61 und 57/57, test-p5-names, test-i18n.

**Sabotagen (je auf Kopien):** Alphabetindex statt Rang; falsche Reihe für eine Form; Zahl nicht begrenzt.

**Prüfung:** bash tools/proof.sh L2 072c2 plus AUS-Pfad-Golden einmal im Browser. Bericht: Hashes, Tabelle alt/neu (nur Auffälliges), Regressionstest rot/grün, Befund Info-Karte, Sabotagen, /usage vorher/nachher, was nicht im Browser gesehen wurde.
