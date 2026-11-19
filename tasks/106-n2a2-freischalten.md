# Auftrag 106 — N2a-2: gerade Größen im Feld freischalten und bedienen, nur Quadrat (Typ K, Prüfstufe L3)

Branch `task/106-n2a2-freischalten` von main `bec517fc` (Merge 105). Zuerst Plan zeigen, Freigabe abwarten; danach nach jedem Schritt committen, `reports/106.md` laufend pflegen. Stopp bei Wochenkontingent ≥ 90 %. Nicht mergen, nicht pushen.
Entscheidungen: (1) E1 × E2 = X × Y, auch gerade; N2b nicht Teil. (2) nur Quadrat, Dreieck und Sechseck byte-gleich zu main. (3) Aus ↔ Feld bei gerader Achse: nur das Netz-Bild springt um e/2. (4) Optimum 7–12 Maschen nur Hinweis. (5) UI-Untergrenze 3 (n = 2 nur im Modell). (6) N2c zurückgestellt.
Nicht ändern: `core/tiling.js` (nötig → stoppen und fragen), `core/faces.js`, `core/facecolor.js`, `core/spatial-morph-render.js`, die acht geschützten Funktionen in `sketch.js` (laut reports/003.md Zeilen ~3114–3961: Zeitleiste/Zeichnung, nicht die Netz-Steuerung), `tools/morph/off-path-golden.json`, Baselines, gallery/v2.

## PLAN (zur Freigabe)

### A. Befund vor dem Bau (gemessen, Node, reale Core-Dateien; Skripte in den Tests ab Schritt 5)
1. **Ebenen bei Feld mit gerader Achse (4/4, 3/4, 6/5; Ebene mit Versatz, Drehung 17°, Versatz + Drehung 90°):** gezeichnete Stücke in den regulären Raum zurückgerechnet (`invertNetWarp`) liegen alle auf den regulären Segmenten der Ebene (größte Abweichung **0 px**, 12 Fälle); dieselben Zahlen bei ungeraden Größen (5/5, 3/5). Ebenen-Linien sind also richtig, kein Sperrgrund. (Segmente außerhalb des Canvas bei versetzten Ebenen: bekannt, auch ungerade, unverändert.)
2. **Raum-Morph unter Feld mit gerader Achse (Keyframes mit Linien, mit und ohne Flächen):** Status `netActive`, 24 Segmente und 40 Flächen je Kachel, Kachelzahl X·Y, 0 Segmente außerhalb des Canvas, Flächenfläche/Canvas 1,034–1,056: **genau wie bei ungeraden Größen** (3/3, 5/5). Kein Sperrgrund.
3. **Zeitleisten-Netzzustände:** `netAnimationCompat` hält `{regular:true}` (Aus) mit jeder Domäne für kompatibel. Bei gerader Achse springt das Bild zwischen Aus und Feld um e/2: ein Lerp wäre ein sichtbarer Sprung bei t = 0+. **Sperre nötig:** neue Compat-Regel (vorhandener Mechanismus: `timelineNetSegment` liefert den Grund, `timelineNetSummary` zeigt „Net NOT animated … The author net is shown there“). Feld ↔ Feld bleibt kompatibel.
4. **Alte Sessions/Transporte:** eine Session mit `domain:'field'` bei gerader Größe wurde bisher als Einzel gezeichnet (Hinweis „gilt als Einzel“), sie erscheint künftig als Feld. Folge der Freischaltung, kein Schema; im Bericht und in `CLAUDE.md` vermerkt.
5. Im Morph und bei Ebenen ist **keine** Sperre nötig; ist ein Test in Schritt 5 anderer Meinung: stoppen und fragen.

### B. Schalter `netFieldEven`
Entfällt. Ersatz **`let netFieldMinTiles = 3;`** in `core/netwarp.js` (Untergrenze der Feldachse; nur Harness setzt 2, damit n = 2 im Modell messbar bleibt; nichts anderes liest oder schreibt es). Die Quadrat-Beschränkung kommt aus der Form: `netDomainEffective(spec, Rt, shape)` mit drittem Parameter; fehlt er, liest die Funktion `currentShape`. `makeNetWarp` übergibt `'square'`, `_netTriangleField` `'triangle'`, `_netHexField` `'hex'`. Regel Quadrat: ganze Zahl n mit `netFieldMinTiles ≤ n ≤ 9`, gerade und ungerade; Dreieck/Sechseck: wie bisher nur ungerade 3..9 (Grund-Texte unverändert). Folge für den Test aus 105: 5a (Standard false) → „Standard `netFieldMinTiles` = 3, n = 2 im Quadrat abgelehnt, gerade Größe bei Dreieck/Sechseck abgelehnt“; 5b → „nur `core/netwarp.js` nennt `netFieldMinTiles`, `netFieldEven` kommt nirgends mehr vor“; Test 4 → gerade Quadrat-Größen mit Feld sind jetzt gewollt anders: byte-gleich zu main bleiben ungerade × ungerade, gerade ohne Netz, gerade mit Einzel/Gekachelt, **alle Dreieck- und Sechseck-Fälle (gerade und ungerade, Feld)**; Sabotage „Schalter Standard an“ → „`netFieldMinTiles` Standard 2“ und „Dreieck bekommt gerades Feld“.

### C. Bedienung (alles über vorhandene Elemente, keine neuen Buttons oder Positionen)
- **Stepper (`ui-form.js sizeCompute`)**, Quadrat im Feld (Schloss zu und offen): **Einerschritte** je Achse von 3 bis 9 (heute ungerade Zweierschritte); bei offenem Schloss zusätzlich Verhältnis ≤ 1:3 wie bisher. Dreieck/Sechseck im Feld: unverändert Zweierschritte. Ohne Feld: Einerschritte. Untergrenze im Feld 3. Die Form wird aus `currentShape` gelesen.
- **Readout** unverändert (`net.readout.field` „Feld: {n} × {n} Kacheln“, `net.readout.field2` „Feld: {n} × {m} Kacheln“ gelten auch bei geraden Achsen; byte-gleich zu main bei ungeraden Größen).
- **Optimum-Hinweis** nur Quadrat im Feld, nur wenn X·Y außerhalb 7 bis 12: in der vorhandenen Hinweiszeile `#net-field-info` (nur Desktop sichtbar; auf dem Telefon sind die Hinweiszeilen geparkt, dort erscheint er nicht; der Readout bleibt unverändert, damit er für ungerade Größen byte-gleich zu main ist).
- **Overlay, Hit-Test, Knoten, Flächen, Export:** laufen schon über den Warp (105); hier nur im echten Browser belegt.

### D. Texte (neu oder geändert, wörtlich; alle de und en, Schlüssel in `ui-i18n.js`)
Neu (nur Quadrat):
| Schlüssel | de | en | wo |
|---|---|---|---|
| `reason.size.fieldSq.min` | Im Feld-Netz ist 3 die kleinste Größe. | In the field net 3 is the smallest size. | Stepper unter 3 im Feld (Quadrat) |
| `note.net.fieldMinSize` | Feld braucht in X und Y mindestens Größe 3; {size} passt nicht, deshalb Einzelnetz. Die Größe bleibt {kept}. | Field needs size 3 or more in X and Y; {size} does not fit, so single net. The size stays {kept}. | Toast beim Einschalten eines Netzes aus Aus bei Größe < 3 (Quadrat) |
| `net.hint.fieldMin` | Feld braucht in X und Y mindestens Größe 3. | Field needs size 3 or more in X and Y. | `#net-field-hint` (Quadrat, Feld nicht möglich) |
| `net.domain.field.titleSq` | Feld: das Gesetz spannt über alle X × Y Kacheln; jede Kachel ist eine skalierte Kopie des angeklickten Musters (Größe 3 bis 9) | Field: the law spans all X x Y tiles; each tile is a scaled copy of the clicked pattern (size 3 to 9) | Titel von `#net-field-btn` (Quadrat) |
| `net.hint.optimum` | Nach Hinterreiter (Band II, S. 17) wirken Quadratnetze mit 7 bis 12 Maschen am besten; dieses Netz hat {w}. | According to Hinterreiter (vol. II, p. 17) square nets work best with 7 to 12 meshes; this net has {w}. | `#net-field-info`, nur wenn X·Y < 7 oder > 12 |
Geändert (Wortlaut in Stellen, die für alle Formen gelten):
| Schlüssel | alt → neu |
|---|---|
| `info.net.field` | de: „Feld: ein Gesetz über alle Kacheln, ungerade Größe von 3 bis 9.“ → „Feld: ein Gesetz über alle Kacheln; beim Quadrat Größe 3 bis 9, bei Dreieck und Sechseck ungerade Größe von 3 bis 9.“ en: „Field: one law across all tiles, odd size from 3 to 9.“ → „Field: one law across all tiles; size 3 to 9 on the square, odd size 3 to 9 on the triangle and hexagon.“ |
Unverändert (nur noch Dreieck/Sechseck): `reason.size.field.min`, `note.size.field`, `note.net.fieldOddSizeNoNet`, `net.hint.fieldOdd`, `net.reason.fieldOdd`, `note.size.fieldNetNoNet`, `net.domain.field.title`. **Totes Wort:** `note.net.fieldOddSize` (Quadrat bei geraden Größen) wird nicht mehr angezeigt, bleibt als Schlüssel stehen (Pin in `test-i18n-core`).
Fest geschriebene englische Hinweise in `sketch.js` (nicht im Wörterbuch, wie bisher), Quadrat: Feld-Reset „Shape Size {R} is not a valid field size, so Field was reset to Single (Field needs Shape Size 3 or more in X and Y).“; Titel bei gesperrtem Feld „Field needs Shape Size 3 or more in X and Y“; Größenhinweis Einzel „… Field (Shape Size 3-9) spreads the law over all the tiles instead.“; Flächenhinweis „… Use Field (Shape Size 3-9), or set the net to Regular on the Base sheet.“ (Dreieck/Sechseck: die bisherigen Texte mit „odd“).
Umschalten der Texte je Form: `netControlsSync` setzt `data-i18n` / `data-i18n-title` und den Text von `#net-field-hint` und `#net-field-btn` nur bei Änderung (wie die vorhandenen Schreibwächter, Task 084).
**Compat-Grund (Zeitleiste, englisch wie die anderen Gründe):** „at an even size a Field moves the picture by half a tile against a Regular net, so the two cannot be interpolated“.

### E. Hinweis-Tabelle (Test: jeder Schlüssel de und en vorhanden, erscheint im richtigen Fall)
| Form | Größe | Ereignis | Text |
|---|---|---|---|
| Quadrat | beide Achsen ≥ 3, beliebig (3, 4, 5 … 9; 3/4, 6/5, 8/8) | Netz aus Aus | kein Toast, Feld an; Readout „Feld: X × Y Kacheln“; `net.hint.optimum` falls X·Y ∉ 7..12 |
| Quadrat | Achse < 3 (1, 2) | Netz aus Aus | Toast `note.net.fieldMinSize`, Einzel, Feld-Button grau, `net.hint.fieldMin`, Titel „Field needs …3 or more“ |
| Quadrat | Wechsel auf Achse < 3 im Feld | Größenänderung | `note.size.fieldNet` „Feld-Netz gilt bei Größe {size} als Einzel.“ (unverändert) |
| Quadrat | Feld, Stepper unter 3 | Klick | `reason.size.fieldSq.min` |
| Dreieck, Sechseck | ungerade 3..9 | wie bisher | unverändert |
| Dreieck, Sechseck | gerade oder < 3 | Netz aus Aus / Größenänderung / Stepper | `note.net.fieldOddSizeNoNet`, `net.hint.fieldOdd`, `note.size.fieldNetNoNet`, `reason.size.field.min`, `note.size.field` unverändert |

### F. Schritte (je ein Commit; Pins im eigenen Commit)
1. `core/netwarp.js`: `netFieldMinTiles` statt `netFieldEven`, `netDomainEffective(spec, Rt, shape)`, Compat-Regel; Test aus 105 nachziehen (eigener Commit, Begründung).
2. `ui-form.js` (`sizeCompute`, Texte), `ui-i18n.js` (neue Schlüssel, `info.net.field`), `index.html` (Info-Karte nicht nötig: Text kommt aus dem Wörterbuch).
3. `sketch.js` (`applyNetKindChoice`, `netControlsSync`, Hinweise, Optimum-Hinweis, Flächenhinweis `:4448`).
4. Test `tools/ui/test-net-even-ui.js` (Hinweis-Tabelle, Stepper, Sperre Zeitleiste, Optimum-Ort, Dreieck/Sechseck byte-gleich) und Ergänzungen in `tools/grid/test-net-field-even.js` (Ebenen-Konsistenz, Morph-Zahlen, ungerade 16 Paare byte-gleich inkl. Readout, Export).
5. Pins (alt → neu mit Begründung): erwartet `test-net-field-2d` (2a, 7a–7c), `test-resize-format` (6), `test-net-hints-nonet`, `test-i18n-core`/`-tables`/`-sentences`, `test-resize-base`, `test-resize-layers`, `test-morph-view` und `test-lines-toggle` (sketch.js-Basis); genaue Liste aus dem L3-Lauf.
6. Browser (echt): Quadrat 4/4, 4/3, 3/4, 6/5, 8/8 im Feld: Netzlinien, Punkte (0 px zu Linienenden), Hit-Test, Flächenfüllung, Export; Bilder `reports/logs/106-*.png`; Pane-Größe/Zoom so einstellen, dass das Muster sichtbar ist; Golden 30/30 (main gegen Arbeitsbaum, gleiche Pane); Frame-Zeit ungerade ≤ +3 %.
7. `?v=` (nur `\d+[a-z]+`, z. B. 20261223feldgerade), `ROADMAP.md`, `CLAUDE.md`; `bash tools/proof.sh L3 106`; Bericht.

### G. Sabotagen (je rot, auf Kopien): Dreieck/Sechseck bekommt gerades Feld; Stepper Zweierschritte statt Einerschritte beim Quadrat; Hinweis `net.hint.fieldMin` fehlt (de oder en); Compat-Regel (Zeitleiste) entfernt; Readout liest nur ungerade (gerade Achse zeigt Einzel); Optimum-Hinweis im Readout statt in `#net-field-info`; `netFieldMinTiles` Standard 2; T fehlt (aus 105).
### H. Risiko
Mittel: viele Texte und Pins; kein Eingriff in geschützte Dateien erwartet. Offen: das Browser-Bild der Pane (in 105 nicht aussagekräftig); wenn es wieder nicht geht, Zoom/Viewport per `resize_window` setzen und `canvas.toDataURL()` als Bild speichern.
