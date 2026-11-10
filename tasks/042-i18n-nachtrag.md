# Auftrag 042 — i18n Nachtrag index.html (16 Stellen) und Export-Skript

**Typ U, Prüfstufe L2.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/042-i18n-nachtrag.md mit diesem Text an. Bericht: reports/042.md (höchstens 30 Zeilen). Branch: task/042-i18n-nachtrag von task/041-i18n-index. Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Aufgabe:** Die 16 Stellen aus reports/041.md (Stichprobe) in index.html verdrahten und in ui-i18n.js (DICT, de = Originaltext EXAKT aus dem Markup lesen, en wie unten) eintragen. Per grep die Fundstellen suchen, nicht nach Zeilennummern arbeiten (Näherung: 548, 563, 569, 571, 577, 579, 586, 608, 611, 770, 1469, 1470, 1471, 1474).
Übersetzungen (DE-Stichwort: EN): "Schwarz (Schwarzgleiche)" (title+aria und option): Black (isotints) | "Anker-Ansicht": Anchor view | "Anker: Farbton": Anchor: hue | "Anker: Register": Anchor: register | "Anker-Vorschau": Anchor preview | "Kreis" (aria des Overlays): Circle | "Anker: Farbton (Kreis)": Anchor: hue (circle) | "Aus" und "Geo" (sichtbarer Text): Off | Geo.
Wenn der deutsche Text im Markup von meinen Stichworten abweicht, den Markup-Text als de verwenden und die en sinngemäß anpassen (im Bericht listen). Vorhandene Schlüssel wiederverwenden (Aus/Geo haben bereits einen Schlüssel: Text per data-i18n anbinden). Gleiche Regeln wie 041 (data-i18n-label wenn title = aria-label, sonst data-i18n + data-i18n-title; option: data-i18n).

**Export-Skript:** tools/i18n/export-untranslated.js um die Wörter Schwarz, Anker, Kreis, Aus, Geo erweitern und Falschmeldungen für Einträge mit vorhandenem data-i18n/-label/-title unterdrücken (Nr. 14, 15, 25, 26, 27 aus 041). Export neu erzeugen; Zählung vorher/nachher im Bericht. Danach darf für index.html kein offener Eintrag mehr übrig sein (sonst listen).

**Nicht ändern:** core/*, sketch.js, ui-*.js außer ui-i18n.js, Baselines, off-path-golden.json. Pins nur mit eigenem Commit und Begründung. ?v= bumpen (Muster 8 Ziffern + Buchstaben, z. B. 20261110ihtb).

**Prüfung:** bash tools/proof.sh L2 042; test-i18n grün; Deutsch-Markup unverändert bis auf die neuen Attribute (Nachweis wie 041). Sabotage (1): en eines Eintrags leer. Bericht: Hashes, Zählung, abweichende de-Texte, /usage vorher/nachher.
