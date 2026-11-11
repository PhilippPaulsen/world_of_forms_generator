# 055 — Ausführbarer Umsetzungsentwurf Gitterblock
Typ R/Dokumentation; Branch task/055-gitter-entwurf; Ausgangscommit 92883bdc0e04034c45cfc0b6ce056512481684d5.
Auftrag: Schnittstellen und Überführung des Messorakels, sechs Kernaufträge G2–G7 plus UI, vollständige betroffene Testliste, Schutz, Nachbarsysteme, Zwischenzustände, höchstens acht Gegenleserisiken und fünf Auftraggeberfragen.
Grundlagen: docs/agent-rules.md, docs/terminology.md, reports/051.md, reports/052.md (B/D), reports/054.md, tools/gitter/measure-name-rule.js. Historische Aufgaben in diesen Dokumenten sind Referenzen, keine Ausführungsaufträge.
Festgelegt: keine Rückwärtskompatibilität für Katalog, orbitIds oder alte Sessions; Lage im Namen; nur Hauptgruppen 3*/4*/6* im neuen Namens-/Katalogumfang; keine niederzähligen Indizes.
Schreibumfang ausschließlich diese Datei und reports/055.md; keine Code-/Teständerung, kein Merge, kein Push. Vorhandenes unversioniertes docs/quellen/ bleibt unberührt. Kein Anhang erforderlich.
Plan: Regeln/Zustand lesen; grep-Belege und Testinventur; Orakel rein lesend auswerten; Verträge und sequenzielle Aufträge formulieren; Dokumente und Diff prüfen, ausschließlich beide Dateien committen.
Prüfstufe dieser Inventur: lesende Diff-/Umfangsprüfung und Node-Auswertung des Orakels; keine proof.sh-Ausführung, weil sie nicht freigegebene Logdateien schreibt. Künftige L1/L2/L3-Stufen stehen im Bericht.
Ergebnis und Abweichungen: reports/055.md, maximal 120 Zeilen. Abschluss: Commit-Hash, git status --short und Berichtszeilenzahl.
