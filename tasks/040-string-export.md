# Auftrag 040 — String-Export (unübersetzte deutsche Texte)

**Typ R (Export, kein Eingriff in Code), Prüfstufe L1.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/040-string-export.md mit diesem Text an (Vorlage tasks/_template.md). Bericht: reports/040.md (höchstens 30 Zeilen). Branch: task/040-string-export von main (erwarteter HEAD 56e00f6e). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Schreiben nur:** Task-Datei, Bericht, neue Datei tools/i18n/untranslated-de.json (Export), ggf. neues Skript tools/i18n/export-untranslated.js (damit der Export reproduzierbar ist), usage.csv. Kein Code in core/, sketch.js, ui-*.js, index.html ändern.

**Befund:** ROADMAP nennt "Übersetzung der übrigen Texte" (Phase 5, string retrofit) als offen: Texte, die nur deutsch im Quelltext oder Markup stehen und nicht über ui-i18n.js (de/en) laufen. Terminologie: translation-terminology.md im Projekt (falls im Repo vorhanden, Pfad nennen; sonst im Bericht vermerken).

**Aufgabe:**
1. Mechanismus bestätigen: wie funktioniert ui-i18n.js (Schlüsselformat, data-i18n, Titel/aria-label, Sprachumschaltung, test-i18n.js: was prüft er, was ist Pflicht)?
2. Per grep/Skript alle noch nicht übersetzten, für Nutzer sichtbaren deutschen Strings finden: in index.html (Text, title, aria-label, placeholder ohne data-i18n), in ui-*.js, sketch.js, core/*.js (Statusmeldungen, Tooltips, alert/confirm, Textknoten, Export-/Dateinamen-Texte). Ausschließen: Kommentare, Entwicklerlogs, Testdateien, Variablennamen, tools/, gallery (falls eigene Seite: getrennt ausweisen).
3. Export als JSON: je Eintrag { id (vorgeschlagener i18n-Schlüssel), de (Originaltext), file, function oder Selektor, kind (text|title|aria|placeholder|status|dialog|other), context (ein Satz: wo sichtbar, Platzhalter wie %d/{n}), maxLen (falls Platz knapp, z. B. Phone-Taste), existingEn (falls schon eine englische Fassung im Quelltext steht) }. Platzhalter und Zusammensetzungen (Satzbausteine) kennzeichnen, damit sie nicht zerlegt übersetzt werden.
4. Zählung im Bericht: Anzahl je Datei und je kind; Anzahl Duplikate (gleicher Text mehrfach); Anzahl mit Platzhaltern; Anzahl, die nach der Übersetzung Code-Änderung brauchen (nicht nur Eintrag in ui-i18n.js, z. B. harter String im JS).
5. Empfehlung: Zerlegung des Imports (Typ U, je Datei oder Gruppe, mit Prüfstufe und Pin-Risiken: welche Tests pinnen Texte, z. B. test-phone-*.js, test-morph-view.js).

**Nicht ändern:** Code, Tests, Baselines, ui-i18n.js, off-path-golden.json. Keine ?v=-Änderung.

**Prüfung:** `bash tools/proof.sh L1 040` und `tools/guard.sh main` PASS; `git diff --stat main..HEAD` nennt nur die erlaubten Dateien (im Bericht bestätigen). Bericht: Hashes, Mechanismus (3 Zeilen), Zählungen, Empfehlung Import, offene Fragen (höchstens 3), /usage vorher/nachher. Arbeit und Bericht getrennt committen, usage.csv-Zeile.
