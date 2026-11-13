# Auftrag 071c — Tooltip-Reparatur (Dauerschreiben)

**Typ K, Prüfstufe L2.** Regeln: docs/agent-rules.md. Branch task/071c-tooltip-reparatur von main (erwarteter HEAD c634e55d). Kein Merge, kein Push. Plan in 3 Zeilen vorab. Bericht reports/071c.md (höchstens 20 Zeilen).

**Befund (Auftraggeber, Sichttest 071b, echter Browser):** Der Tooltip am Namensfeld #pattern-name-status erscheint nicht mehr. title ist korrekt gesetzt, core/glossary.js geladen, UI.t liefert Text. Ein MutationObserver (title, childList, characterData, subtree) zählt 28 Änderungen in 3 s bei unberührter Seite. Vermutung: updatePatternNameStatus (oder Info-Zeile / syncGridControls im UI.onSync-Takt) schreibt Text und title bei jedem Takt; der Browser startet den Tooltip bei jeder Änderung neu. Der 071b-Test prüfte nur Fakes.

**Aufgabe:** 1. Schreibstelle messen (MutationObserver vorher/nachher; bei gleicher Eingabe darf NICHTS geschrieben werden; Abweichung: STOP mit 2 Optionen). 2. Kleinster Eingriff: Text und title nur schreiben, wenn sich der berechnete Wert ändert (Vergleich mit dem DOM-Wert); ebenso #grid-info-status; title nie verlieren (Formwechsel, Lagewechsel, Sprachwechsel, Neuaufbau). 3. Regressionstest mit echtem sketch.js-Code und DOM-Stub mit Zählern: 2. und 3. Aufruf bei gleicher Eingabe 0 Schreibzugriffe; Änderung von Linie, Ordnung, Lage, Form, Symmetriemodus, Sprache genau einmal; reduzierte Symmetrie ohne title; ROT auf c634e55d belegen. 4. Andere Felder der Info-Karte/des Sync-Takts auf Dauerschreiben prüfen (Liste im Bericht: Feld, Schreibstelle, Häufigkeit in 3 s); Behebung nur für #pattern-name-status und #grid-info-status.

**Nicht ändern:** acht geschützte Funktionen in sketch.js, core/faces.js, core/tiling.js, core/facecolor.js, tools/morph/off-path-golden.json, Baselines, Namensberechnung, Export, Session, Glossar-Inhalt. Pins nur mit eigenem Commit. ?v= bumpen (20261130gridfs).

**Prüfpunkte:** (1) alles außer Schreibverhalten byte-gleich zu c634e55d (measure-Skripte). (2) Regressionstest rot/grün. (3) Browser: Zählung vorher/nachher, title nach Zeichnen/Formwechsel/Lagewechsel/Sprachwechsel, Hover. (4) Golden einmal 30/30; geschützte Tests, test-p5-names, test-i18n.

**Sabotagen:** Wertvergleich entfernt; title nur beim Signaturwechsel; reduzierte Symmetrie bekommt title. **Prüfung:** bash tools/proof.sh L2 071c plus Golden einmal.
