# Auftrag 048 — i18n Begriffe angleichen (color-harmony/ui)

**Typ U, Prüfstufe L2.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/048-i18n-begriffe-angleichen.md mit diesem Text an. Bericht: reports/048.md (höchstens 30 Zeilen). Branch: task/048-i18n-begriffe-angleichen von main (nach Merge von 047). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Aufgabe:** In color-harmony/ui/i18n.mjs die englischen Begriffe an die Hauptseite und docs/terminology.md angleichen: Zweier -> Pairs, Dreier -> Triples, Vierer -> Quadruples (statt "Two-/Three-/Four-color group"; wo der Kontext "group" braucht, Länge und Sinn prüfen und im Bericht listen); Gegenfarben -> Complementary colors; Wertgleich -> Value (equal value); Weißgleiche/Schwarzgleiche -> "isotints" bzw. "Black (isotints)" gemäß Hauptseite (Großschreibung am Satzanfang beachten). Per grep alle Vorkommen in i18n.mjs finden (auch zusammengesetzte Texte), nicht nach Zeilen arbeiten. Jede Änderung im Bericht: de, alt-en, neu-en, maxLen-Risiko. docs/terminology.md Part A: Eintrag "Atlas = Atlas (Eigenname/Ansicht)" und Isotint/Isovalent-Hinweis ergänzen (ausnahmsweise schreibbar). Bei Platzproblem (en deutlich länger als alt): im Bericht listen, nicht kürzen ohne Rückfrage.

**Nicht ändern:** de-Texte, core/*, sketch.js, Logik, Baselines. Pins/Tests von color-harmony nur mit eigenem Commit und Begründung. ?v= bumpen (z. B. 20261110ihth).

**Prüfung:** bash tools/proof.sh L2 048; color-harmony-Tests und test-i18n grün; test-i18n-tables um die geänderten Begriffe erweitern; Sabotage (1): alter Begriff zurück. Bericht: Hashes, Änderungsliste, /usage vorher/nachher.
