# Auftrag NNN — Titel

<!-- Hinweise (beim Ausfüllen löschen):
     - Diese Datei VOR jeder Arbeit als tasks/NNN-kurzname.md anlegen, mit dem Auftragstext.
     - Der Bericht heißt reports/NNN.md (höchstens 30 Zeilen); proof.sh bekommt die Nummer dreistellig: tools/proof.sh L1 NNN.
     - Abschnitte ohne Inhalt weglassen. -->

**Typ X (K Kern / R Messung / U nur Dokumentation und Vorlagen / ...), Prüfstufe Lx.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/NNN-kurzname.md mit diesem Text an. Bericht: reports/NNN.md (höchstens 30 Zeilen). Branch: task/NNN-kurzname von main (erwarteter HEAD xxxxxxxx). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Befund:** Was gemessen oder gesehen wurde, mit Quelle (reports/MMM.md, Datei:Zeile). Zahlen, keine Vermutungen.

**Vorab:** Stufen, Prototypen, Messungen vor dem Eingriff; Bedingung für den STOP mit Befund oder zwei Optionen.

**Ziel / Aufgabe:** Was danach gelten soll, nummeriert; je Punkt ein überprüfbarer Satz.

**Schreiben nur:** Dateien, die geändert werden dürfen.

**Nicht ändern:** Dateien und Funktionen, die unverändert bleiben (sketch.js, core/*, off-path-golden.json, Baselines, alte Berichte und Tasks). Pin-Tests nur in eigenem Commit mit Begründung.

**Prüfpunkte:**
1. ...
2. ...

**Sabotagen (höchstens 4, auf Kopien):** Je Prüfpunkt eine Änderung, die der Test erkennen muss.

**Prüfung:** `bash tools/proof.sh Lx NNN` (und `tools/guard.sh main`, wenn sketch.js und core/ unverändert bleiben). Bericht: Hashes, Prüfpunkte, Sabotagen, Testzahlen, /usage vorher/nachher, Abweichungen, was nicht im Browser gesehen wurde. Arbeit und Bericht getrennt committen, usage.csv-Zeile.
