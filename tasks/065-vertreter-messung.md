# Auftrag 065 — Vertreter-Messung (Bahn-Mitglieder zeichnen verschieden)

**Typ R (Messskript, kein Eingriff in core/ oder sketch.js), Prüfstufe L1.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/065-vertreter-messung.md mit diesem Text an. Bericht: reports/065.md (höchstens 30 Zeilen). Branch: task/065-vertreter-messung von main (erwarteter HEAD 056f97c9). Schreiben nur: Task-Datei, Bericht, Skript tools/gitter/measure-representatives.js, usage.csv. Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Befund (reports/063.md):** Im Quadrat c = 4 zeichnen 4 von 8 Mitgliedern einer Linienbahn anders, obwohl Altbahn- und Schlüsseltabelle dieselbe Partition haben; schon im alten Stand. Der Vertreter eines Schlüssels kann anders zeichnen als der Vertreter der Quelle.

**Aufgabe:**
1. Für alle Formen, Lage 1, Ordnung 1 bis 5 (Quadrat zusätzlich c 1 bis 7): für jeden Linienschlüssel alle Paare der Bahn (computeLineKeyTable) unter der Hauptgruppe zeichnen (Segmentmenge über drawConnectionWithSymmetry bzw. Export-Pfad) und die Zeichnungen vergleichen. Ausweis: Anzahl Bahnen, Anzahl Bahnen mit abweichender Zeichnung, kleinste betroffene Ordnung, je Fall ein Beispiel (Paar, Segmentdifferenz).
2. Ursache klären: Warum zeichnen Mitglieder derselben Bahn verschieden (Orientierung/Spiegelung der Linie unter der Gruppe, Behandlung von z1 = z2, Umlaufsinn, Symmetrieelemente von symmetryMode gegen Hauptgruppe)? Vergleich mit dem Orakel tools/gitter/measure-name-rule.js. Gemessen und vermutet getrennt.
3. Folge für den Katalog: Welche Einträge des Abnahmekatalogs (gallery/v2) sind betroffen? Wirkung auf das Vorschaubild (Vertreter), den Generator-Link (resolveTransport) und den Namen.
4. Empfehlung: kleinster Fix mit Kern-Dateien und Schutz-Bewertung, noch nicht umsetzen.

**Nicht ändern:** core/*, sketch.js, Tests, Baselines, gallery/. Prüfung: bash tools/proof.sh L1 065; tools/guard.sh main. Bericht: Hashes, Tabelle (nur Auffälliges), gemessen/vermutet getrennt, Empfehlung, /usage vorher/nachher.
