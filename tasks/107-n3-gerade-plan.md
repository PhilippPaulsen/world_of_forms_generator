# Auftrag 107 — N3-gerade: gerade Größen bei Dreieck und Sechseck im Feld (Plan, Typ U, Prüfstufe L1)

Branch `task/107-n3-gerade-plan` von main `5371f9bd` (Merge 106). Nichts gebaut: keine Änderung in `core/`, `sketch.js`, `ui-*.js`, Tests. Neu nur dieser Plan, `reports/107.md`, das Wegwerf-Messskript `tools/grid/measure-net-tri-hex-even.js` (liest die echten Core-Dateien, ändert `core/netwarp.js` nur im Speicher). Befund, Zahlen, Nicht-Geprüftes: `reports/107.md`.

## 0. Kernaussage
1. **Beim Dreieck und beim Sechseck ist die Sperre gerader Größen kein geometrisches Gesetz, sondern eine Übernahme der Quadratregel.** Das Quadrat-Feld *ist* das Kachelrechteck X × Y und muss deshalb mittig um die Basiskachel liegen (ungerade) oder um e/2 versetzt werden (gerade, 105/106). Das Dreieck- und das Sechseck-Feld sind dagegen ein **umschreibendes Parallelogramm, das die Fläche überdeckt** (Randmaschen angeschnitten); seine Maschenzahl (Rx, Ry) wird gesucht, nicht aus X, Y abgeleitet. Rx, Ry sind ungerade, weil die Basismasche in der Mitte sitzt, **unabhängig davon, ob X, Y gerade sind**.
2. **Gemessen (Wegwerf-Prototyp, nur das Gate gelockert, Warp unverändert, kein Versatz T):** Dreieck und Sechseck bei den Größen 4, 6, 8 und gemischt (4/3, 3/4, 5/6, 6/5, 4/6, 8/9, 9/8): Deckung 100 %, Inverse < 3e-13 px, Split < 4e-13 px, Sechseck-Ecken auf Knoten des feinen Gitters 100 %, Flächen gleich viele wie bei ungeraden Größen (Dreieck 54, Sechseck 535), `netWarpTileOutsideCanvas` ohne falsch-positive Kacheln (8 Größen, je 1089 Kacheln), Raum-Morph-Flächen (`test-net-field-hex-morph-faces`, Abschnitt 1) bei 4, 6, 8 grün. Obergrenzen reichen (Dreieck 15 × 11 ≤ 21, Sechseck 27 × 27 ≤ 27 nur bei 9/9; 33 Paare mit gerader Achse: Dreieck ≤ 15 × 11, Sechseck ≤ 23 × 23).
3. **Es braucht darum keinen Warp-Umbau.** Kein T = e/2, kein lo/hi, kein Versatz-Sprung: Aus ↔ Feld bleibt so stetig wie bei ungeraden Größen (die Entscheidung „Variante A“ ist hier gegenstandslos), die Zeitleisten-Sperre aus 106 gilt nicht (sie ist schon auf das Quadrat beschränkt, gemessen), `core/tiling.js` bleibt byte-gleich.
4. **Zu ändern sind kleine Stellen, drei davon echte Fehlerquellen:** (a) `netDomainEffective` (Gate gerade); (b) `_netTriangleField` beginnt die Suche bei `R.x` (bei geradem X würde Rx gerade, hx nicht ganzzahlig) → bei `R.x | 1`; (c) `netTransformExportData` schriebe für gerades X bei Dreieck/Sechseck **fälschlich** `fieldBase` und `gridShiftPx` (75 px, die es dort nicht gibt) → auf `shape === 'square'` beschränken; plus UI: Stepper (`ui-form.js`: Zweierschritte → Einerschritte, Funktion `fieldSquare()` wird zu „alle Formen“), Hinweistexte, `sketch.js` Feld-Gating.
5. **Empfehlung: Dreieck zuerst, dann Sechseck; Modell und Freischalten je Form in einer Stufe** (das Modell ist eine Zeile bis drei Zeilen, ein Schalter-aus-Zwischenstand bringt nichts). Siehe §3.

## 1. Teil 1 — Warum gerade Größen heute gesperrt sind (Kurzfassung; Tabelle in `reports/107.md`)
| Stelle | Annahme | zwingend? |
|---|---|---|
| `netDomainEffective` (n % 2, ab 106 nur Quadrat gerade) | „Basiskachel = mittlere Kachel des Kachelrechtecks“ | **Konvention** (nur für das Quadrat geometrisch, dort Feld = Kachelrechteck) |
| `_netTriangleField`: Suche `Rx = R.x; Rx += 2` | Start bei X, nur ungerade Schritte | **Fehler beim Lockern:** gerades X ergibt geraden Rx; Rx, Ry ungerade selbst ist zwingend (Basismasche in der Mitte, hx = (Rx − 1)/2) |
| `_netHexField`: Suche ab 3, Schritt 2 | Rx, Ry ungerade | **unabhängig von X, Y** (nur die Canvas-Ecken im Maschenraum zählen); gerade X, Y ändern nur Kantenlänge e und Kachelzahl im Canvas |
| Ankerung am Schwerpunkt (Dreieck: c0 = Schwerpunkt − ⅔(v1 + v2); Sechseck: Knoten am Schwerpunkt) | Maschenlinien s, t ∈ Z im Basisrahmen | **gilt für jede Größe**: das Basisgitter liegt immer so, der Schwerpunkt ist ein Gitterpunkt (Sechseck: Ecken 100 % auf Knoten, auch bei 4, 6, 8) |
| `netWarpRefineFaces` (Teilung an s, t ∈ Z) | Maschenlinien im Rahmen der Basiszelle | **gilt**: der Rahmen hängt nicht von der Größenparität ab |
| `netWarpTileOutsideCanvas` | Bounding-Box der abgebildeten Kachel (stückweise affin) | **gilt**, bleibt konservativ (0 falsch-positive, 1–2 Kacheln bei 6/6 und 8/8 nicht übersprungen, nur Effizienz) |
| UI: `sizeCompute` Zweierschritte, 5 Texte, `fieldOk` | „Feld: nur ungerade Größen“ | **Konvention** |
| Export `fieldBase`/`gridShiftPx` (105) | Bedingung `R.x % 2 === 0` ohne Form | **Fehler beim Lockern** (siehe 0.4c) |

## 2. Teil 2 — Modell für gerade Größen
**Übertragung des Quadrat-Verfahrens (T, lo, hi)?** Formal ja (T = ½ f1 bzw. ½ v1 je gerader Achse, lo = Rx/2), aber **nicht nötig und nicht sinnvoll**: Bei Dreieck und Sechseck liegt das Feld nicht auf der Fläche (der Rand schneidet Randmaschen an); es gibt keine „ganze Masche am Rand“ zu erreichen. Ein Versatz würde nur Rx um höchstens 1 senken und müsste in `netWarpRefineFaces`, `netWarpTileOutsideCanvas` und `netGridLines(opts.frame)` nachgezogen werden (dort stehen Maschenlinien in **regulären** Koordinaten s, t ∈ Z; mit T lägen sie bei Z − T): Aufwand und Risiko ohne Nutzen. Nicht empfohlen.
**Was „e/2“ bei Parallelogramm und Rhombus bedeuten würde (nur gerechnet, nicht gebaut):** je gerade Achse ½ Gittervektor in Richtung des Vektors (Dreieck: ½ v1 bzw. ½ v2, Länge e/2 mit e = 600/min(X, Y), Winkel zwischen den Achsen 60° bzw. 120°; Sechseck: ½ f1 bzw. ½ f2, Länge a/2 mit a = Sechseckseite, Fein-Rhombus). Nicht weiterverfolgt.
**Symmetrie** (Spiegel an der Mittelachse / Drehung, px, Sinus-Tangens-Mix): Dreieck gerade 4/4 76 / 68, 6/6 77 / 71, 8/8 82 / 75 gegen ungerade 3/3 93 / 84, 5/5 83 / 75, 7/7 79 / 73, 9/9 75 / 70: **gleiche Spanne** (62–106 / 62–93 über alle 17 Größen). Sechseck gerade 4/4 118 / 82, 6/6 117 / 80, 8/8 112 / 73 gegen ungerade 3/3 121 / 86, 5/5 114 / 77, 9/9 115 / 76: **gleiche Spanne**. Weder besser noch schlechter; die Nicht-Exaktheit stammt aus der Scherung des Gitters (88/89), nicht aus der Parität. Der Dreieck-Schwerpunkt liegt in keiner Größe auf der Canvas-Mitte (9,6 bis 43 px, proportional e); beim Sechseck exakt auf der Mitte (alle Größen).
**Sechseck-Verfeinerung und Kachel-Überspringen:** bleiben gültig (s. o., Messung `reports/107.md` §2.4/2.5).
**Offen im Modell:** Größe 2 (ein Feld ist bei Dreieck/Sechseck nicht an der Zahl 3 gebunden, die Untergrenze 3 gilt als UI-Entscheidung weiter; nur Frage in §4).

## 3. Teil 3 — Plan N3-gerade
Wechselwirkungen vorab (gemessen oder aus dem Code gelesen):
| Bereich | Wirkung bei gerader Größe |
|---|---|
| Flächenfüllung | unverändert (54 / 535 Flächen wie ungerade; `netWarpBlocksFaces` unverändert) |
| Overlay `netGridLines(opts.frame)` | liest Rx, Ry aus `fieldTiles`/`fieldMeshes` des Warps; nichts von X, Y; Test mit Parität nötig (Dreieck 4/4: 7 × 5 Maschenlinien, Diagonale) |
| Export | `fieldMeshes` ok; **`fieldBase`, `gridShiftPx` dürfen nicht erscheinen** (Fehlerquelle 0.4c); `fieldTiles` = X, Y (gerade) bleibt |
| Zeitleiste | `netAnimationCompat` sperrt nur beim Quadrat (gemessen: Dreieck/Sechseck 4/4 `ok: true`); Feld ↔ Feld wie heute; kein Sprung |
| Ebenen | Sechseck: „Base sheet only“ bleibt; Dreieck: `gridMatchesBase`-Ebenen wie bisher |
| Morph | Sechseck: `parameterMismatch` unverändert; Flächen-Morph bei 4, 6, 8 grün (Abschnitt 1 des Tests); Dreieck-Morph nur über die bestehenden Dreieck-Tests, nicht einzeln bei gerader Größe gemessen |
| Hinweistexte | 5 Schlüssel (`note.size.field`, `note.size.fieldNetNoNet`, `note.net.fieldOddSize(NoNet)`, `reason.size.field.min`, `net.hint.fieldOdd*`) bekommen für Dreieck/Sechseck den Quadrat-Wortlaut („3 bis 9“) oder fallen weg |

### Stufe T1 — Dreieck: gerade Größen freischalten (Typ K, Prüfstufe L3, Browser)
- **Schreiben:** `core/netwarp.js` (`netDomainEffective`: `evenOk` für `'triangle'`; `_netTriangleField`: Start `R.x | 1`; `netTransformExportData`: `fieldBase`/`gridShiftPx` nur Quadrat), `core/state.js:27` (Kommentar), `ui-form.js` (`fieldSquare()` → Dreieck dazu; Einerschritte 3..9), `sketch.js` (nur Netz-Steuerung: `sqShape`-Verzweigungen, Hinweisschlüssel, Titel), `ui-i18n.js`, `ui-net.js` (falls nötig), `index.html` (`?v=`), `ROADMAP.md`, `CLAUDE.md`. **Nicht:** `core/tiling.js`, `core/faces.js`, `core/facecolor.js`, `core/spatial-morph-render.js`, Golden, Baselines, `gallery/v2`.
- **Freigaben nötig:** `sketch.js` (nur Netz-Steuerung, wie 106), `core/state.js`-Kommentar.
- **Messgrößen:** Node: 49 Paare 3..9² × Gesetze Sinus/Tangens/Geometrisch: Deckung 100 %, Rx, Ry ungerade ≤ 21, Inverse < 1e-8, Split < 1e-9, Dots = Linienenden, Aus ↔ Feld stetig (w = 1e-3 < 1 px); ungerade Größen **byte-gleich zu main** (Segmente, Export, Overlay, Warp: Beweis, dass `R.x | 1` für ungerades X nichts ändert); gerade Größen: Export ohne `fieldBase`/`gridShiftPx`; Hinweis-Tabelle (alle Zustände); Stepper 3 ↔ 9 in Einerschritten; Browser (echter Klick): 4/4, 4/3, 6/5, 8/8: Feld-Button aktiv, Readout „Feld: 7 × 5 Kacheln, Rand angeschnitten“, Overlay, Flächenfüllung, Zeitleiste Aus ↔ Feld akzeptiert, Konsole fehlerfrei, **Golden 30/30**, Frame-Zeit (Soll ≤ ungerader Nachbar + 5 %).
- **Sabotagen:** Start `R.x` statt `R.x | 1` (gerader Rx, rot); `fieldBase` auch beim Dreieck; Gate ohne Parität für das Quadrat-Verhalten kaputt (Quadrat gerade fällt zurück); Stepper bleibt bei Zweierschritten; Hinweis alt.
- **Pins (erwartet):** `test-net-field-triangle` (Fall „gerade Achse = kein Netz“), `test-net-field-2d` (2b), `test-net-hints-nonet`, `test-net-field-even` (Abschnitt 4: Dreieck/Sechseck byte-gleich zu main **für alle Größen** → für Dreieck wird er zu „ungerade byte-gleich“), `test-net-even-ui` (Hinweistabelle), `test-i18n-core`, `test-resize-*`, `test-morph-view`/`-lines-toggle` (sketch.js-Basishash), dazu die 106-Pins gleicher Art. Je eigener Commit mit alt → neu.
- **Aufwand/Risiko:** klein–mittel / gering–mittel (wenig Code, viele Texte/Pins).

### Stufe T2 — Dreieck: Flächen und Morph absichern (Typ K, Prüfstufe L3, nur wenn T1 Lücken zeigt)
Nach Messung (§2) ist dafür kein Code zu erwarten: nur Tests (Flächensumme, Raum-Morph bei 4, 6, 8, 4/3). **Empfehlung: in T1 einarbeiten** (Messung dort, Stufe T2 entfällt, wenn nichts zu beheben ist).

### Stufe H1 — Sechseck: gerade Größen freischalten (Typ K, Prüfstufe L3, Browser)
- **Schreiben:** `core/netwarp.js` (`netDomainEffective`: `evenOk` für `'hex'`; sonst nichts: die Suche ab 3 ist parität-frei), `ui-form.js`, `sketch.js` (Netz-Steuerung), `ui-i18n.js`, `ui-net-readout.js` (falls Text), `index.html` (`?v=`), Docs. **Nicht:** `faces.js` (zwei Haken und Schalter bleiben), `facecolor.js`, `tiling.js`, `spatial-morph-render.js`.
- **Messgrößen:** wie T1 plus: Sechseck-Ecken auf Knoten 100 % (4, 6, 8, 4/3, 6/5), `netWarpTileOutsideCanvas` ohne falsch-positive (je ≥ 8 Größen), Flächen 535, Morph-Flächen-Test Abschnitte 1–4 bei 4, 6, 8 (der Test zählt ungerade Größen 3, 5, 7: Variante mit geraden Größen als neuer Test, bestehender Pin bleibt), Frame-Zeit 8/8 und 9/9 (Messwert ohne Flächen 171 / 213 ms; mit Flächen 9/9 ca. 1,8 s: **Hinweis Performance**, unverändert zu ungerade 9/9), **Obergrenze 27 erreicht bei 9/9** (keine Größe darüber, kein neues Risiko).
- **Sabotagen:** `evenOk` auch für Quadrat (rot); Hex-Suche mit Start bei X (gerade Rx, rot); `fieldBase` auch beim Sechseck; Refine ausgeschaltet (Flächen bei 4/4 mit Knick, rot); Tile-Skip ohne Rand.
- **Pins/Aufwand:** analog T1 plus `test-net-field-hex`, `test-net-field-hex-faces`, `test-net-field-hex-morph-faces` (nur Größenliste, falls sie 3, 5, 7 und gerade verlangen; sonst eigener Test). Aufwand klein–mittel, Risiko mittel (Frame-Zeit, 27 × 27 bei 9/9 mit Flächen).

### Stufe H2 — Sechseck: Flächen und Morph (Typ K, L3; nur wenn H1 Lücken zeigt)
Wie T2. Messung 4.5 (Morph-Test bei 4, 6, 8 grün) spricht für „kein Code“. **Empfehlung: in H1.**

### Reihenfolge und Begründung
**Dreieck zuerst.** (1) Es ist die einzige Form mit einer echten Code-Änderung am Warp-Bau (`| 1`), die sich leicht mit Sabotage absichern lässt; das Sechseck braucht nur das Gate. (2) Dreieck hat keine Verfeinerung und kein Kachel-Überspringen im Feld, also weniger Haken in geschützten Dateien (die Haken in `faces.js` sind Sechseck-spezifisch). (3) Frame-Zeit beim Dreieck ≤ 140 ms (9/9), beim Sechseck bis 270 ms ohne und ca. 1,8 s mit Flächen: ein Fehler fällt beim Dreieck billiger auf. (4) Nach T1 gilt `fieldSquare()` für zwei Formen; H1 fügt die dritte als Einzeiler hinzu. **Alternative:** beide in einem Auftrag (gleicher Pfad), spart ein Pins-/Browser-Paket; Risiko: Sechseck-Frame-Zeit und Pins vermischen sich. Nicht empfohlen.

## 4. Offene Fragen an den Nutzer
siehe `reports/107.md` Teil 4 (sechs Fragen mit Empfehlung).
