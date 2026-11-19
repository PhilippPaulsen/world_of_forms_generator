# Auftrag 108 — T1: gerade Größen beim Dreieck im Feld freischalten (Typ K, Prüfstufe L3)

Branch `task/108-t1-dreieck-gerade` von main `6857f36c` (Merge 107). Grundlage: `tasks/107-n3-gerade-plan.md` Stufe T1, `reports/107.md`. **Dieser Text ist die Konkretisierung zur Freigabe; gebaut wird erst danach.** Entscheidungen 1–5 des Auftrags gelten (kein T, kein lo/hi, Rx/Ry ungerade, Readout unverändert, Feld ab 3, Einerschritte, nur Dreieck; Sechseck und Quadrat byte-gleich zu main).

## 0. Vorabbefund Altbestand (`domain:'field'` bei gerader Dreieck-Größe)
Durchsucht: `tools/morph/off-path-specs.json` (2 Feld-Muster, beide **Quadrat Größe 3**), alle `tools/ui/baseline-*.json` (Treffer nur Element-IDs `net-field-info`/`net-field-note`, keine Muster), `gallery/v2` (`manifest.jsonl`, SVG: kein `domain`/`netTransform`), Session-/Export-Fixtures in Tests (Code, unter L3). **Kein Treffer, dessen Bild sich ändert.** Vermerk alte Sessions: ein `domain:'field'` bei gerader Dreieck-Größe wurde bisher als Einzel behandelt (beim Dreieck: kein Netz) und erscheint jetzt als Feld. Die Trefferliste kommt in den Bericht.

## 1. Code (Dateien, Zeilen von main)
| # | Datei:Zeile | Änderung |
|---|---|---|
| 1 | `core/netwarp.js:220` | `evenOk = sq && n % 2 === 0` → `evenOk = (sq \|\| shape === 'triangle') && n % 2 === 0`. Untergrenze Zeile 222 bleibt: Quadrat `netFieldMinTiles`, sonst 3 (Dreieck ab 3). Sechseck, unbekannte und fehlende Form: unverändert (nur ungerade). |
| 2 | `core/netwarp.js:305` (`_netTriangleField`) | `Rx = R.x` → `Rx = R.x \| 1`, `Ry = R.y` → `Ry = R.y \| 1` (ungerade Start; für ungerades X identisch). |
| 3 | `core/netwarp.js:650` (`netTransformExportData`) | `if (R.x % 2 === 0 \|\| R.y % 2 === 0)` → `if (shape === 'square' && (R.x % 2 === 0 \|\| R.y % 2 === 0))` (`fieldBase`, `gridShiftPx` nur Quadrat). |
| 4 | `core/netwarp.js:193–195, 209` | Kommentare: Dreieck nimmt gerade Größen ohne Versatz (Feld = Überdeckung, Rx/Ry ungerade). |
| 5 | `core/netwarp.js:410` (`netAnimationCompat`) | **unverändert** (Quadrat-Sperre). |
| 6 | `core/state.js:27` | nur Kommentar: „… on the square and the triangle (any parity) or odd 3..9 on the hexagon …“. |
| 7 | `ui-form.js:80` | `fieldSquare()` → `fieldAnySize()`: `currentShape === 'square' \|\| currentShape === 'triangle'`; Aufrufe Z. 125, 146 und Kommentare Z. 79, 107–111, 133 angepasst. Hexagon bleibt bei den Zweierschritten (Zweige unverändert). |
| 8 | `sketch.js` (nur Netz-Steuerung: `applyNetKindChoice` ~Z. 620–626, `netControlsSync` ~Z. 703–715) | neue Variable `evenShape = (currentShape === 'square' \|\| currentShape === 'triangle')`; `sqShape` bleibt für den Optimum-Hinweis (nur Quadrat). Feld-Titel, Hinweisschlüssel, Zurücksetz-Hinweis lesen `evenShape`; `noNet` bleibt `currentShape !== 'square'` (Dreieck: kein Einzelnetz). |
| 9 | `sketch.js:4942` (`sizeChangeText`) | Unterscheidung nach Form: Quadrat `note.size.fieldNet`; Dreieck neuer Schlüssel `note.size.fieldNetNoNetMin`; Sechseck weiter `note.size.fieldNetNoNet`. |
| 10 | `ui-i18n.js`, `index.html` (Z. 1458, 1463 `title`, 1592), `?v=` | Texte unten; `?v=20261223feldgerade` → `?v=20261224dreieckgerade` in `index.html`, `gallery.html`, `color-harmony/ui/index.html`. |
| 11 | `ROADMAP.md`, `CLAUDE.md` (tracked `Claude.md`) | Stand T1; Vermerk alte Sessions. |
`core/tiling.js`, `core/faces.js`, `core/facecolor.js`, `core/spatial-morph-render.js`, Golden, Baselines, `gallery/v2`, die acht geschützten Funktionen: nicht berührt. Freigabe nötig für `sketch.js` (nur Netz-Steuerung, wie 106) und `core/state.js` (nur Kommentar).

## 2. Texte (wörtlich)
**Neu** (`ui-i18n.js`):
| Schlüssel | de | en |
|---|---|---|
| `note.net.fieldMinSizeNoNet` | Feld braucht in X und Y mindestens Größe 3; bei {size} gibt es hier kein Netz. Die Größe bleibt {kept}. | Field needs size 3 or more in X and Y; at {size} there is no net here. The size stays {kept}. |
| `note.size.fieldNetNoNetMin` | Feld-Netz braucht mindestens Größe 3: bei Größe {size} kein Netz. | The field net needs size 3 or more: at size {size} there is no net. |
| `net.domain.field.titleEven` | Feld: das Gesetz spannt über alle Kacheln; jede Kachel ist eine skalierte Kopie des angeklickten Musters (Größe 3 bis 9) | Field: the law spans all tiles; each tile is a scaled copy of the clicked pattern (size 3 to 9) |
**Geändert** (`ui-i18n.js` und die statischen Texte in `index.html`):
| Schlüssel | alt → neu |
|---|---|
| `info.net.field` de | „Feld: ein Gesetz über alle Kacheln; beim Quadrat Größe 3 bis 9, bei Dreieck und Sechseck ungerade Größe von 3 bis 9.“ → „Feld: ein Gesetz über alle Kacheln; bei Quadrat und Dreieck Größe 3 bis 9, beim Sechseck ungerade Größe von 3 bis 9.“ |
| `info.net.field` en | „Field: one law across all tiles; size 3 to 9 on the square, odd size 3 to 9 on the triangle and hexagon.“ → „Field: one law across all tiles; size 3 to 9 on the square and the triangle, odd size 3 to 9 on the hexagon.“ |
`index.html:1458` (Kommentar) analog, `:1592` = `info.net.field` de (neu wie oben).
**Unverändert wiederverwendet** (Dreieck liest sie jetzt): `net.hint.fieldMin` („Feld braucht in X und Y mindestens Größe 3.“ / „Field needs size 3 or more in X and Y.“), `reason.size.fieldSq.min` („Im Feld-Netz ist 3 die kleinste Größe.“ / „In the field net 3 is the smallest size.“), `note.net.fieldMinSize` bleibt Quadrat. Die englischen Fest-Strings in `netControlsSync` für das Dreieck: Titel bei nicht passender Größe „Field needs Shape Size 3 or more in X and Y“ (wie Quadrat), Zurücksetz-Hinweis „Shape Size {R} is not a valid field size: the field net applies only from size 3 in X and Y, so there is no net here.“ (Sechseck behält den alten Satz mit „odd sizes (3, 5, 7, 9)“).
**Entfallen für das Dreieck** (bleiben für das Sechseck): `reason.size.field.min`, `note.size.field`, `note.net.fieldOddSizeNoNet`, `net.hint.fieldOdd`, `note.size.fieldNetNoNet`, `net.domain.field.title`.
Optimum-Hinweis (7–12 Maschen) gilt **nur Quadrat**; für das Dreieck wird keiner gezeigt (Quelle nennt 8–16 mit anderer Zählung, nicht übernommen).

## 3. Tests und Sabotagen
Neu: `tools/grid/test-net-field-triangle-even.js` (Warp, Export, Zeitleisten-Tabelle, Byte-Vergleich gegen main per `git show`-Kopie) und `tools/ui/test-net-triangle-even-ui.js` (echte `initNetControls`, Hinweis-Tabelle Form × Größe × Ereignis, Stepper, Schlüssel de/en). Sabotagen auf Kopien (je rot): (1) Sechseck bekommt gerade Größen, (2) Quadrat-Versatz im Dreieck-Code (`shiftVec`), (3) Dreieck-Suche beginnt bei geradem Wert, (4) Export schreibt `gridShiftPx`/`fieldBase` beim Dreieck, (5) Zweierschritte beim Dreieck, (6) Größe 2 öffnet das Feld, (7) Hinweisschlüssel fehlt in en, (8) unbekannte Form wird wie Dreieck behandelt.
Messungen wie im Auftrag (Browser 4/4, 3/4, 4/3, 6/5, 8/8; Morph, Ebene mit Versatz und Drehung, Zeitleiste; ungerade Dreieck, Sechseck 1–9, Quadrat byte-gleich; Frame-Zeit ≤ +3 %; Golden 30/30 main gegen Arbeitsbaum). Erwartete Pins (eigener Commit, alt → neu im Bericht): `test-net-field-triangle` (gerade → kein Netz), `test-net-field-2d` (2b), `test-net-field-even` (Abschnitt 4), `test-net-field-hex`/`-hex-faces` falls sie das Dreieck gerade pinnen, `test-net-hints-nonet`, `test-net-readout-tick`, `test-net-even-ui`, `test-i18n-core`, `test-resize-*`, `test-morph-view`/`-lines-toggle` (sketch.js-Basishash).
Commits: Kern (1–4, 6), UI (7–10), Tests, Pins, `?v=`, Docs, Bericht.

## 4. Offen (nur falls du abweichst)
- Texte oben (besonders `net.domain.field.titleEven`, das das alte „Größe × Größe“ beim Dreieck ersetzt).
- Dreieck 1 und 2: kein Netz, Hinweis `note.net.fieldMinSizeNoNet` (Entscheidung 3).
