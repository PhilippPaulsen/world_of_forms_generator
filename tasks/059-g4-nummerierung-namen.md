# Auftrag 059 — G4 Nummerierung und Namen

**Typ K, Prüfstufe L3.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/059-g4-nummerierung-namen.md mit diesem Text an. Bericht: reports/059.md (höchstens 30 Zeilen). Branch: task/059-g4-nummerierung-namen von main (erwarteter HEAD dd146481). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Grundlage:** reports/055.md (§1, §2, G4), reports/056.md (Risiken 1, 2, 5, 6; Fehlliste G4; Ladereihenfolge), reports/054.md und Orakel tools/gitter/measure-name-rule.js (Referenzimplementierung: Knotenzahl-Regel, Familie, Buchstabe, Überstrich, Großbuchstabe, Eindeutigkeit), reports/058.md (buildGridNodes, canonicalGridFrame). Entscheidungen: Hauptgruppen 3*/4*/6* nur; Überstrich-Richtung nach Orakel, Anzeige aA bei Doppelrolle; Name trägt die Lage (z. B. 5q2/4* 12.11a); numerische Sortierung z1, z2, Buchstabenrang, gegen; _pairKey-Stringsortierung nicht für Namen.

**Ziel (eine Kernänderung):** Parallele reine API für semantische Knotenzahlen und Linienschlüssel, ohne Verhaltensänderung der App:
1. numberGridNodes(nodes, grid, ...) in core/forms.js (NICHT in orbits.js: forms.js lädt vor orbits.js, siehe 056). Sie ergänzt Knoten um `zahl` nur im neuen Pfad (Lage-1-Ausgabe von buildGrid bleibt byte-gleich; zahl wird nur auf Anforderung geliefert, z. B. opts.numbered).
2. core/symmetry.js: mainGroupSpec(shape) (3*/4*/6*), gemeinsam mit canonicalGridFrame.
3. core/orbits.js: computeLineKeyTable, lineKeyForPair, pairForLineKey, compareLineKeys, formatLineKey/parseLineKey, formatGridName/parseGridName (Token z. B. 65a, 12.11a, 55e~; Name {ordnung}{d|q|*}{lage}/{3*|4*|6*} {token}[+{token}...]). Parser normalisiert nur nach Prüfung gegen die berechnete Tabelle.
4. Bestehende Namenswrapper (formatThemeLineName, computeThemeLineOrbitTable, orbitIds) bleiben aktiv und unverändert; neuer Pfad hinter internem Schalter GITTER_V2=false (nicht aus der UI erreichbar).
5. Freie Endpunkte, reduzierte symmetryMode und unvollständige Linien: null (kein systematischer Name).

**Portierung:** measure:gridNodes/buildGrid/fold, makeGroup, pairOrbits, readings, sameSide, letterFor, familyName. Kein process.env, keine Tabellen- oder Bilddaten, kein CLI-Code in core/. Das Orakel bleibt unverändert; neue Tests tools/gitter/test-grid-contract.js und test-name-rule.js vergleichen den Kern mit den exports des Orakels nach KOORDINATEN, nicht nach IDs.

**Nicht ändern:** acht geschützte Funktionen in sketch.js (byte-gleich), core/faces.js, core/facecolor.js, core/tiling.js, tools/morph/off-path-golden.json, Baselines, gallery/. Pins nur mit eigenem Commit und Begründung. ?v= gemeinsam bumpen (z. B. 20261114gridfc).

**Prüfpunkte:** (1) 299/299 Knotenzahlen, 240/240 Tabellenzeilen gegen das Orakel; 0 Schlüsselkollisionen; Roundtrip Paar -> Schlüssel -> dieselbe Bahn; parseLineKey(formatLineKey(k)) = k. (2) Drei Formen x beide Lagen x n = 1..8 (Hex bis 6, höher in der Lastmessung); Größe/Translation/Canvas-y-Spiegelung ändern Zahlen und Schlüssel nicht. (3) Orientierte konkrete Paare gegen das Orakel (Überstrich-Richtung). (4) --strict des Orakels: genau zwei bekannte Abweichungen (5q2: 261 -> 262, 64 -> 65); Test prüft diese zwei einzeln, jede weitere ist Fehler. (5) Laufzeit der Tabelle und von formatGridName je Form (Budget für draw: im Bericht Zeit je Aufruf). (6) Lage-1-Ausgabe von buildGrid und alle bestehenden Namen/Orbit-IDs byte-gleich zu dd146481. (7) AUS-Pfad-Golden im Browser 30/30. (8) Geschützte Tests 61/61 und 57/57, test-p5-names.

**Sabotagen (je auf Kopien, jede macht den benannten Check rot):** Gleichstand umgekehrt; Rang nach Radius; Buchstaben fortlaufend statt gleichabständig; Überstrich ohne Bedingung; ohne Seitenregel 1c; dy-Vorzeichen; z1 = z2 vertauscht; Stringsortierung der Tokens.

**Prüfung:** bash tools/proof.sh L3 059 plus AUS-Pfad-Golden im Browser (Verfahren: Kopfkommentar tools/morph/measure-off-path.js). Bericht: Hashes, Messwerte, Sabotagen, Zeit je Aufruf, /usage vorher/nachher, was nicht im Browser gesehen wurde.
