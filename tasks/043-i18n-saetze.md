# Auftrag 043 — i18n Sätze (Teil A index.html, Teil B Satzfunktionen)

**Typ U, Prüfstufe L2.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/043-i18n-saetze.md mit diesem Text an. Bericht: reports/043.md (höchstens 30 Zeilen). Branch: task/043-i18n-saetze von task/042-i18n-nachtrag. Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Teil A (index.html, 5 Stellen):** "Schatten (Schattenreihe)" title+aria (nahe Zeile 565) -> Shadow (shadow series); Optionen Gegenfarben, Dreier, Vierer, Schatten (nahe 766-771) -> Complementary colors, Triples, Quadruples, Shadow. Markup-Text als de verwenden, en sinngemäß anpassen (abweichende im Bericht listen). Regeln wie 041/042.

**Teil B (Satzfunktionen in ui-form.js, ui-layer.js, ui-layers.js, ui-timeline.js):** Die deutschen Satz-Tabellen (T['reason.node.max.square'], reason.node.max.other, note.size.field, layers.remove.title/lines/keyframe, timeline.dia.text) laufen heute als Funktionen mit hartem deutschem Text. Auf UI.t(key, params) umstellen: ganze Sätze mit {n}/{k}/{from}/{to}, Singular und Plural als getrennte Schlüssel (Auswahl weiter im Code über k === 1). Deutsch muss ZEICHENGLEICH bleiben (Test: alte Funktion gegen UI.t de für n/k-Werte 0, 1, 2, 5). Weitere Satzbausteine aus der Export-Liste (Nr. 35-47 ui-form, 48-63 ui-layers, 64-71 ui-net, 72-82 ui-timeline) mit demselben Verfahren, soweit sie ein vorhandener Tabellen-Key sind: Liste im Bericht, welche erledigt sind und welche nicht.
Englisch (Schlüssel: EN):
- reason.node.max.square: At most {n} nodes for the square.
- reason.node.max.other: At most {n} nodes for triangle and hexagon.
- note.size.field: Field net: odd sizes only, so {from} → {to}.
- layers.remove.title: Remove layer {n}?
- layers.remove.lines (k=1): The one line of this layer will be lost. This cannot be undone. / (k>1): The {k} lines of this layer will be lost. This cannot be undone.
- layers.remove.keyframe: "This layer is a keyframe of the timeline" + [" and has one line" | " and has {k} lines"] + ". It will be removed, its keyframe leaves the timeline, and the line pairings of the adjacent segments will be lost. This cannot be undone."
- timeline.dia.text (k=1): The line pairing of the adjacent segment will be lost (pairing, reversal and symmetry variant of the lines). The layer itself is kept. This cannot be undone. / (k>1): The line pairings of {k} adjacent segments will be lost (pairing, reversal and symmetry variant of the lines). The layer itself is kept. This cannot be undone.
Übrige Einträge (ui-form reason.node.min*, reason.size.*, reason.fold.*, more.label*; ui-layers layers.dia.*, layers.chip.*, layers.eye.*, layers.add; ui-net reason.*; ui-timeline timeline.net.*, timeline.scrub, timeline.clear.*, timeline.dia.title) liefere ich NICHT; sie bleiben für 044 (Liste im Bericht).

**Nicht ändern:** core/*, sketch.js, Baselines, off-path-golden.json. Pins (test-layer-*, test-net-lock-reasons, test-symmetry-wiring, test-morph-view, test-phone-*) nur mit eigenem Commit und Begründung. ?v= bumpen (Muster 8 Ziffern + Buchstaben, z. B. 20261110ihtc).

**Prüfung:** bash tools/proof.sh L2 043; test-i18n grün; Deutsch-Gleichheitstest wie oben; Sabotage (2): en leer; Plural-Schlüssel vertauscht. Bericht: Hashes, erledigte/offene Einträge, abweichende de-Texte, /usage vorher/nachher.
