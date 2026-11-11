# Auftrag 046 — i18n Rail, Farbe, Orgel-Begriffe

**Typ U, Prüfstufe L2.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/046-i18n-rail-farbe.md mit diesem Text an. Bericht: reports/046.md (höchstens 30 Zeilen). Branch: task/046-i18n-rail-farbe von main (nach Merge von 045). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Aufgabe:** Auf ui-i18n.js umstellen, Muster wie 043 bis 045 (tr(key, params, fallback), Getter, deutscher Text als Fallback, Deutsch zeichengleich, Test tools/ui/test-i18n-tables.js erweitern):
(1) ui-rail.js: more.state.on "an" -> on, more.state.off "aus" -> off, more.hint "Symbol antippen" -> Tap an icon (vorhandenen Schlüssel layers.hint wiederverwenden, wenn de identisch).
(2) ui-farbe.js: die offenen Stellen laut Export (per grep, nicht nach Zeilen): "Fläche füllen einschalten" -> Turn on face fill; "Farborgel lädt noch." -> Color Organ is still loading.; "für Farbton" -> for hue.
Der deutsche Quelltext gilt; Abweichungen im Bericht listen. Bei Eingriff in Logik oder core/: STOP mit 2 Optionen.

**Zusatz Begriffe (Entscheidung des Auftraggebers):** Farborgel -> Color Organ, Formorgel -> Form Organ, Netzorgel -> Net Organ (nur sichtbarer Text, US-Schreibweise, keine Datei-, Funktions- oder Variablennamen). Per grep in index.html, ui-*.js, ui-i18n.js, core/*.js (nur Textliterale), gallery nach sichtbaren Vorkommen von "Farborgel", "Formorgel", "Netzorgel" suchen (auch in bereits übersetzten en-Texten) und auflisten: Fundstelle, de-Text, en-Text. Umsetzen in ui-i18n.js, ui-farbe.js, ui-rail.js, index.html (en-Texte; de bleibt). Funde in core/* oder sketch.js nur listen (Typ K später). docs/terminology.md Part A um drei Zeilen ergänzen (Farborgel = Color Organ, Formorgel = Form Organ, Netzorgel = Net Organ; Hinweis: Eigenname, nur sichtbarer Text); diese Datei ist ausnahmsweise schreibbar.

**Nicht ändern:** core/*, sketch.js, Baselines, off-path-golden.json. Pins nur mit eigenem Commit und Begründung. ?v= bumpen (z. B. 20261110ihtf).

**Prüfung:** bash tools/proof.sh L2 046; test-i18n grün; Deutsch-Gleichheitstest; Export neu erzeugen: offene Einträge in ui-*.js = 0 (außer Fallback-Fragmente, listen). Sabotage (2): en leer; Schlüssel vertauscht. Bericht: Hashes, Zählung, Fundliste der -orgel-Begriffe, abweichende de-Texte, /usage vorher/nachher.
