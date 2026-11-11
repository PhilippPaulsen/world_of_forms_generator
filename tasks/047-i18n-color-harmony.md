# Auftrag 047 — i18n color-harmony/ui

**Typ U, Prüfstufe L2.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/047-i18n-color-harmony.md mit diesem Text an. Bericht: reports/047.md (höchstens 30 Zeilen). Branch: task/047-i18n-color-harmony von main (nach Merge von 046). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Aufgabe:** Eigene Seite color-harmony/ui: (1) <title>Farborgel</title> und i18n.mjs ("Color organ") auf die projektweite Schreibweise bringen: de "Farborgel", en "Color Organ". (2) Per grep in color-harmony/ui (index.html, i18n.mjs, *.js/*.mjs) nach weiteren sichtbaren deutschen Texten ohne Übersetzung suchen und auflisten: Fundstelle, de, vorgeschlagenes en (Terminologie docs/terminology.md, US-Schreibweise). Nur Texte umsetzen, die über den vorhandenen Mechanismus (i18n.mjs) laufen; Funde ohne Mechanismus nur listen. Bei Logik-Eingriff oder core/: STOP mit 2 Optionen.

**Nicht ändern:** core/*, sketch.js, Baselines, off-path-golden.json, Dateinamen. Pins/Tests von color-harmony nur mit eigenem Commit und Begründung. ?v= bumpen, falls Skripte betroffen (Muster 8 Ziffern + Buchstaben).

**Prüfung:** bash tools/proof.sh L2 047; color-harmony-Tests und test-i18n grün; Sabotage (1): en leer. Bericht: Hashes, Fundliste, /usage vorher/nachher.
