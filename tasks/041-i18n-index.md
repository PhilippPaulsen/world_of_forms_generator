# Auftrag 041 — i18n index.html (29 Einträge)

**Typ U, Prüfstufe L2.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/041-i18n-index.md mit diesem Text an. Bericht: reports/041.md (höchstens 30 Zeilen). Branch: task/041-i18n-index von task/040-string-export. Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Aufgabe:** Die 29 index.html-Einträge (Export-Nr. 1 bis 29, tools/i18n/untranslated-de.json, file index.html) in ui-i18n.js (DICT, de = Originaltext exakt, en = unten) und im Markup verdrahten (data-i18n-title bzw. data-i18n-label, je nach vorhandenem title/aria-label; Text-Einträge 22 bis 24 mit data-i18n). Schlüssel = id aus dem Export, bei Kollision sprechend umbenennen. Duplikate (title+aria, 11 Texte mit vorhandenem existingKey): vorhandenen Schlüssel wiederverwenden. Deutsch muss unverändert bleiben.

Übersetzungen (Nr: en): 1 Circle: complementary colors, triples, quadruples (tap again: choose hue) | 2 Triangle: black, white, shadow, value (tap again: choose register) | 3 Circle harmonies: cardinality | 4 Complementary colors (2 colors) | 5 Triples (3 colors) | 6 Quadruples (4 colors) | 7 Triangle harmonies: series | 8 White (isotints) | 9 Value (equal value) | 10 Next hue | 11 Previous hue | 12 Next register | 13 Previous register | 14 Off, regular net | 15 Geometric | 16 Distribution: cyclic (colors in sequence) | 17 Distribution: area (by face size) | 18 Distribution: symmetry (by symmetry group) | 19 Distribution: rings (outside in) | 20 Choose harmony (alternative to the 7 buttons, also reserved for future harmonies) | 21 Choose harmony | 22 Harmony… | 23 White | 24 Value | 25 3-fold | 26 6-fold | 27 Both axes | 28 Triangle | 29 Anchor: register (triangle, current hue).

**Stichprobe (Frage 3 aus 040):** Im Markup index.html per grep nach deutschen Wörtern ohne Umlaut in title/aria-label/Text ohne data-i18n suchen (z. B. Farbe, Wert, Netz, Form, Linie, Ebene, Knoten, Kreis, Mehr, Aus, An); Funde im Bericht listen, nicht übersetzen.

**Nicht ändern:** core/*, sketch.js, ui-*.js außer ui-i18n.js, Tests (außer Pins mit eigenem Commit und Begründung), Baselines, off-path-golden.json. ?v= bumpen (index.html, gallery.html, color-harmony/ui/index.html), weil ui-i18n.js sich ändert.

**Prüfung:** bash tools/proof.sh L2 041; test-i18n grün; Deutsch-Markup byte-gleich bis auf die neuen data-i18n-Attribute (Nachweis: Attribute entfernen und diffen). Sabotage (1): en eines Eintrags leer. Bericht: Hashes, Zählung, Stichprobenfunde, /usage vorher/nachher.
