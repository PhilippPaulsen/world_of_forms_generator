# Auftrag 049 — Inspector-Titel im Singular (color-harmony/ui)

**Typ U, Prüfstufe L2.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/049-inspector-singular.md mit diesem Text an. Bericht: reports/049.md (höchstens 30 Zeilen). Branch: task/049-inspector-singular von main (nach Merge von 048). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Aufgabe:** In color-harmony/ui zeigt Inspector.mjs (per grep nach t('pair'|'three'|'four') suchen, nicht nach Zeilen) den Titel EINER Harmonie mit den Plural-Texten "Pairs/Triples/Quadruples" (Schlüssel pair/three/four, auch für Buttons/Listen genutzt). Neue Schlüssel für den Singular einführen (z. B. pairOne/threeOne/fourOne): de zeichengleich zum bisherigen Titeltext (Zweier/Dreier/Vierer, nicht ändern), en Pair/Triple/Quadruple. Nur den Titel im Inspector auf die neuen Schlüssel umstellen; alle anderen Verwendungen der Plural-Schlüssel bleiben. Per grep alle Verwendungsstellen der drei Schlüssel auflisten und im Bericht angeben, welche Stelle singular/plural ist; Stellen, die nach Kontext ebenfalls eine einzelne Harmonie meinen, listen, nicht ändern.

**Nicht ändern:** de-Texte, core/*, sketch.js, Logik außer der Schlüsselwahl im Titel, Baselines. Pins/Tests von color-harmony nur mit eigenem Commit und Begründung. ?v= bumpen (z. B. 20261110ihti).

**Prüfung:** bash tools/proof.sh L2 049; color-harmony-Tests, test-i18n, test-i18n-tables grün (Test um die drei neuen Paare erweitern: de unverändert, en Singular); Sabotage (1): Titel nutzt wieder den Plural-Schlüssel. Bericht: Hashes, Verwendungsliste, /usage vorher/nachher.
