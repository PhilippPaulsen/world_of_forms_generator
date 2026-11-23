# Auftrag 124 — 3C-2: Möbiusnetz fürs Dreieck, nur ganzes Format — PLAN (Typ K, Prüfstufe L2)

Branch `task/124-3c-dreieck` von main `8fac0c91` (Merge 123). **Stand: nur dieser Plan (und die kleine Messung `tools/grid/measure-3c-triangle.js`) geschrieben, nichts gebaut, auf Freigabe warten.** Nicht mergen, nicht pushen, `docs/quellen/` nie committen, nur explizite `git add`-Pfade. Stoppregel: Zwischenmeldung ≥ 93 %, Stopp ≥ 98 % Wochenkontingent.

Gelesen: `tasks/121`, `tasks/119`, `reports/120-messung.md`, `120`, `121`, `122`, `123`, `core/netwarp.js` (Block `netProjective*`, `_netTriangleField`, `netWarpForBase`, `netWarpTileOutsideCanvas`), `core/tiling.js` (`tileTriangle`, `closedNetRectCorners`, `latticeIJBounds`), `core/faces.js:1335–1400`, `ui-net-art.js` ganz, `style.css` (Stepper-Anzeige), Quellseiten S. 51, 52 (Fig. 159 bis 169). Nicht gelesen: `core/session.js` über `_vNetSpec` hinaus, `ui-net.js` im Detail (nur die Stellen mit `n3c`).

## 0. Kurzfassung
1. **Die Homographie ist dieselbe wie beim Quadrat.** Sie hängt nur von (p, q) ab, nicht von der Gittermetrik. Im Dreiecksgitter ist p + q = const eine **Dreieckskante** (Länge 1; Messung 120/3), ebenso p = const, q = const. Das Gebiet (p, q ≥ 0, a ≤ p+q ≤ b) besteht deshalb nur aus **ganzen Dreiecken** und ist nach allen vier Seiten sauber begrenzt. Kein neues Abbildungsstück; neu sind Kachelzuordnung, Bearbeitungskachel, Maße, Vorschläge, Format-Sperre.
2. **Kachel = Dreieck** (die Kachelschleife `tileTriangle` setzt aufrechte und umgedrehte Dreiecke, `flip180`), **Masche = Raute aus zwei Dreiecken** = Einheitsquadrat (p, q). Das Basisdreieck hat in den Rahmenkoordinaten die Ecken (1,0), (0,1), (1,1) (nachgerechnet: `c0 = A + B − C`), ist also das **obere** Dreieck der Masche (0,0); das umgedrehte ist das untere.
3. **Kein Eingriff in geschützte Dateien.** Schreiben: `core/netwarp.js` (Kern), `ui-net-art.js`, `ui-i18n.js`, `style.css` (eine Zeile), `ui-net.js` nur falls der Test es verlangt. Freigaben nötig: `core/netwarp.js` und `core/session.js` (Familie im Validator).
4. **Neu gefunden:** beim Dreieck (ganz) wird kein Dreieck gezeichnet, das über die Fluchtlinie ragt (Rand = Dreieckskante). Damit wäre **a = 1 hier harmlos** (Frage 1). Auftragsgemäß bleibt a ≥ 2 der Vorschlag.
5. Erwartet: **Aufwand M, Risiko mittel** (Kachelzuordnung am Dreieck, Zeitleiste, UI-Texte). Ohne Netz ändert sich kein Code-Pfad.

## 1. Modell
**Abbildung.** Wie 121: ganz: X = W·p/v, Y = H·a·(b−v)/((b−a)·v), v = p + q (a unten, b oben), Rahmen = Canvas. Inverse: v = a·b/(Y′(b−a)+a), p = X·v/W. Die Formeln stehen im Kern (`_projPx`, `_projPQ`) und bleiben **unverändert**.

**Maschen und Kacheln.** Rechteck [0,b]² von Maschen = 2·b² Dreiecke. Im Gebiet liegen genau die Dreiecke mit vmin ≥ a und vmax ≤ b: unteres Dreieck der Masche (i,j): v ∈ [i+j, i+j+1], oberes: v ∈ [i+j+1, i+j+2]. **Kein Dreieck wird geschnitten** (ganz). Das Spitzen-Dreieck (Fluchtlinienkachel) ist das untere der Masche (0,0): Ecke bei v = 0, vmax = 1.

**W-Zählung gegen Quelle (Messung vorhanden, im Test wiederholt):** W = b² − a² Dreiecke (k = 2, Quelle S. 51 „W = b² − a²“). Zählung `measure-3c-triangle.js`: 2,4 → 12; 3,6 → 27; 1,3 → 8; 3,5 → 16, jeweils = Formel; Quelle Fig. 159/160: 12 ✓. (Messung 120/2: △N 159/160 12 ✓; 161/162 halb 13,5 ✓ — halb ist gesperrt.) Familie **△N**, k = 2.

**Maschen-Streckung (neu, klein, Zahlen).** Die Messung 120/6 nahm für △N die Quadratstreckung als Näherung. Das ist falsch: die regelmäßige Raute des Dreiecksgitters hat die Diagonalen p+q (Länge 1) und p−q (Länge √3). Maß hier: Breite/Höhe der Bildraute (Diagonalen p−q : p+q) mal √3 → 1 = regelmäßig; Streckung = max(x, 1/x). Das ist **meine Auslegung** (wie beim Quadrat nicht am Bild bewiesen); Gegenprobe an der Quelle: Fig. 159 (2,4, 332 × 446 px, gedreht gelesen: B:H = 1,34) ergibt nach dieser Rechnung **1,48**, nach der Quadratformel 2,56 (Fig. 149 ergab dort 2,63 — gleiche Größenordnung wie die Quelle selbst; die Dreiecksformel ist also die strengere Lesart, nicht die falsche).
Ergebnis (`measure-3c-triangle.js`, △N ganz, W 8 bis 16, Streckung ≤ 2, b ≤ 9, a ≥ 1):

| Canvas B:H | brauchbar (a,b), Streckung |
|---|---|
| 1:2 (0,5) | keiner |
| 3:4 (0,75) | 1,3 (1,73) · 1,4 (1,79) — beide mit a = 1 |
| 1:1 | 1,3 (1,54) · 2,4 (1,98) |
| 3:2 | 2,4 (1,32) · 3,5 (1,73) |
| 2:1 | 3,5 (1,30) · 2,4 (1,59) |

Bestes Verhältnis für 2,4: B:H = 1,58 (Streckung 1,25). **Mit a ≥ 2 gibt es bei 1:1 nur 2,4 (1,98, an der Grenze), bei 3:4 keinen Vorschlag.** Das spricht für Frage 1.

**Rand.** Links/rechts/oben/unten: ganze Dreiecke, Rand liegt auf Dreieckskanten (12/12 bei 2,4; 27/27 bei 3,6). Der Canvas ist der Rahmen (wie 121, Frage 3).

**Orientierung.** Wie beim Quadrat (121): a unten, b oben, Gitterachsen (p, q) wie im Rahmen `{c0, v1 = C−B, v2 = C−A}`. Die Quelle zeigt Fig. 159 bis 164 wie Fig. 149 **um 90° gedreht** (a-Seite links, Fluchtpunkt rechts); wir drehen nicht, wie in 121 entschieden. Die Dreiecksbilder der Quelle haben nur eine der zwei Lösungen im Gitter (Barenvariante, 119 Frage 3a).

## 2. Kern (`core/netwarp.js`, Freigabe nötig)
Nur frühe Zweige hinter `kind === 'projective'`; alles Bestehende Zeile für Zeile erhalten.
| Stelle | Änderung |
|---|---|
| `netProjectiveEffective(spec, shape)` | Form `square` oder `triangle`; Dreieck: **Format `full` Pflicht** (halb → ungültig mit Grund „3C at the triangle exists in the full format only (the middle axis cuts triangles, Messung 120/3)“), Familie `△N`; Quadrat Familie `□N`. a ≥ 2 wie beim Quadrat (Frage 1). Grund „exists for the square only (the triangle follows)“ entfällt. |
| `netProjectiveSpec(a, b, format, family?)` | dritter/vierter Parameter, Standard `□N`; ohne Familie gleich wie heute (Quadrat byte-gleich). |
| `netWarpForBase` | Zweig: `shape === 'triangle'` und 3 Ecken → `makeNetWarp(spec, frame)` mit dem Rahmen aus `_netTriangleField` (`c0 = A+B−C`, `v1 = C−B`, `v2 = C−A`); Sechseck bleibt `null` (sichtbar abgelehnt, Messung 7). |
| `_netProjectiveWarp` | Rahmen kommt vom Aufrufer; Marker (`repeat:false`, `field:{Rt:1,h:0}`, `c0/v1/v2` = Gitterparallelogramm [0,b]²) wie beim Quadrat. **Dreieck:** `tileTriangle` nutzt `latticeIJBounds(…, 4)` mit `coveredRectCorners()` (= dieses Parallelogramm), also etwas **mehr** Kacheln als im Gebiet (Rand +4 Maschen, höchstens 2·(b+8)² = 800 bei b = 12). Die überzähligen: Linien kappt die Senke (`netWarpSplitSegment` → `[]`), Flächen überspringt `netWarpTileOutsideCanvas`. Frame-Zeit wird gemessen (Abschnitt 7). |
| **Bearbeitungskachel** (`_netProjEditTile`) | Dreieck: das **obere** Dreieck der Masche (i0, j0) im Gebiet (so liegt das Basisdreieck), nächst zur Bildmitte (Schwerpunkt (i+2/3, j+2/3) gegen (vm/2, vm/2)); Maschen, deren oberes Dreieck nicht im Gebiet liegt, entfallen. Punkte, Knoten-Overlay und Treffertest (`drawnHitNodes`, `nodeHit`) arbeiten wie beim Quadrat in dieser Kachel, **kein Eingriff in `sketch.js`**. |
| `_netProjTileOutside` | Dreieckskachel: Ecken aus `outerCorners` (3 statt 4) → vmin/vmax/pmax/qmax linear, exakt; Zweig hängt nicht an der Eckenzahl (zu prüfen: `toTileLocal`-Aufruf mit `flip180` für umgedrehte Kacheln). Ganz: keine Randkachel, nur ganz drinnen oder ganz draußen. |
| `_netProjCut`, `_projPlanes`, `_netProjInside`, `_netProjLocal`, `_netProjGridLines` | Gitter-Überlagerung: zusätzlich die dritte Schar p+q = i + k/E (die Dreieckskanten). Sonst unverändert (Gebiet ist metrikfrei). |
| `netProjectiveInfo(spec, W, H)` | Familie wählen: Dreieck zählt Dreiecke (W = b²−a²), Streckung nach 1., `tilesWithArea`, `editTile`. Quadrat unverändert. |
| `_netProjExportData` | siehe 3. |
| `netAnimationCompat` | siehe 3. |

**Fluchtlinienkachel beim Dreieck:** das untere Dreieck (0,0). Sie hat vmax = 1 ≤ a, also wird sie nie gezeichnet (Flächen: `_netProjTileOutside`; Linien: Schnitt leer). Jede gezeichnete Kachel hat vmin ≥ a: **größte Koordinate eines gezeichneten Polygons = die Ränder des Canvas** (kein Überstand wie beim Quadrat bis 3 H).

## 3. Export, Session, Zeitleiste
- **Export** (`_netProjExportData`): `version: 2`, `kind: 'projective'`, `family: '△N'`, `a`, `b`, `format: 'full'`, `W`, `canvas`, `tiles`, `editTile`, `homography` (**gleiche Matrix**), `geometryIsRegular: true`, `facesMapping` mit „triangle tile“ statt „regular central cell“-Satz für das Quadrat (Text je Familie). Quadrat-Export byte-gleich. Alte Leser: Version 2 → `null`, Geometrie bleibt regulär (wie 121). Version bleibt 2 (neues Feld nur `family` anders). `netTransformFromExport`: Familie `△N` annehmen (nur ganz).
- **Session** (`_vNetSpec`, `core/session.js`, Freigabe nötig): `family` ∈ {`□N`, `△N`}; `△N` nur mit `format: 'full'`; sonst wie 121. Keine Schema-Erhöhung (alter Validator lehnt jedes 3C sichtbar ab). Zusätzlich beim Laden: Familie und Form passen nicht zusammen (△N auf Quadrat) → Spec bleibt, Warp = `null` (Form-Wächter, wie `why3` in 123).
- **Zeitleiste** (`netAnimationCompat`): 3C-Quadrat ↔ 3C-Dreieck: **abgelehnt** mit dem schon vorhandenen Grund „the 3C family differs (□N vs △N)“ (Schlüssel `net.3c.compat.family`, DE/EN ist seit 123 abgedeckt). Begründung: die Kachelform ist verschieden, die Homographie gleich, aber eine Überblendung würde zwei verschiedene Muster-Kacheln mischen. △N ↔ △N: a, b linear wie beim Quadrat (nur `full`). 3C ↔ Netzart 1: wie bisher abgelehnt.

## 4. UI
- `ui-net-art.js`: `AVAIL.n3c.triangle` → `OK`; Sechseck bleibt mit Grund. `suggest` bekommt die Form (`shape`): Dreieck: Familie △N, nur `full`, **W 8 bis 16** (Optimum S. 17, Messung 120/6 „Optimum für △N“), Streckung ≤ 2 nach Abschnitt 1, b ≤ 9; Quadrat unverändert. `stepA`/`warnings`/`defaultFor` lesen die Grenzen je Form (`limits`); Format-Auswahl am Dreieck: **„halb“ sichtbar, aber gesperrt mit Grund** (`net.art.reason.n3c.triHalf`, neu); der Stepper schaltet bei Dreieck + 3C auf `full`.
- `ui-i18n.js`: neue Schlüssel (DE/EN): `net.art.reason.n3c.triHalf` („Am Dreieck gibt es das Möbiusnetz nur im ganzen Format: die Mittelachse schneidet Dreiecke.“ / „On the triangle the Möbius net exists in the full format only: the middle axis cuts triangles.“), ggf. `net.3c.warn.*` mit W-Bereich je Form. **Texte, die „folgt (3C-2)“ sagen, werden aktualisiert:** `net.art.reason.n3c.triangle` (`ui-i18n.js:197`) entfällt (Dreieck ist frei); der Kerngrund `core/netwarp.js:866` („the triangle follows in 3C-2“) wird durch den Halb-Grund ersetzt; Sechseck-Grund (`net.art.reason.n3c.hex`) bleibt unverändert. Nachsehen: Hinweise unter „Mehr“/„Maße“ (W 7 bis 12 → je Form).
- `ui-net.js` (`why3`, `core3c`): nur anfassen, wenn der Test es verlangt (Form-Wächter lässt Dreieck durch). Keine neuen Bedienelemente, keine neuen Positionen, kein neuer Stepper-Entwurf; Format-Icon „halb“ am Dreieck bekommt `aria-disabled` und den Grund als Tooltip (bestehendes Muster aus 123, nur Daten).
- `tools/ui/test-netz-i18n-keys.js` deckt die neuen Schlüssel (Modell liefert sie; Test läuft das Modell für Dreieck, Quadrat, Sechseck).

## 5. Kleiner Punkt: Schriftschnitt der Netzart-Anzeige (reines CSS)
Soll aus den Steppern abgeleitet: `.stepper-display` (`style.css:924–932`) setzt **kein** `font-weight`; Stärke/Fokus (und a, b, `style.css:982`) erben `var(--weight-regular)` (400). **Ursache:** `style.css:983` `#net-art-value { font-weight: var(--weight-strong); }` (600, Task 123). Änderung: Zeile 983 **löschen**; sonst nichts (a und b werden mitgeprüft: im Browser `getComputedStyle(...).fontWeight` für `#net-art-value`, `#net-a-value`, `#net-b-value`, `#net-strength-value`, Fokus-Anzeige; Soll: alle gleich 400). `test-netz-nachbesserung`: Punkt 6 prüft nur `min-width` (Zeile 982), nicht die Zeile 983; kein Pin zu erwarten. **Baseline:** der Schnitt ändert Zeichenbreiten der Anzeige (tabellarisch, Ziffern gleich breit; „3C“ schmaler) minimal: wenn `compare-baseline` Rechteckdifferenzen im Netz-Tab zeigt, sind sie nur diese; **keine neue Aufnahme**, solange die Breite durch `min-width: 2.5ch` fest bleibt (zu messen). Eine neue Aufnahme (`baseline-netzart-14.json`) nur, wenn die Breiten sich ändern oder die UI-Änderungen von Abschnitt 4 den Netz-Tab verschieben (Warn-/Hinweiszeilen); sonst Vermerk im Bericht. Telefon: unverändert (kein Layout).

## 6. Dateien (je Zeile)
| Datei | Rolle |
|---|---|
| `core/netwarp.js` | **schreiben, Freigabe nötig** (Abschnitt 2, 3; ca. 80 Zeilen, nur Zweige) |
| `core/session.js` | **schreiben, Freigabe nötig** (Familie `△N` im Validator `_vNetSpec`, sonst lehnt er jedes Dreiecks-Spec ab) |
| `ui-net-art.js`, `ui-i18n.js` | schreiben (Tabelle, `suggest(shape)`, Gründe, Texte) |
| `style.css` | eine Zeile (983 löschen) |
| `ui-net.js`, `sketch.js` | unverändert; nur wenn ein Test es verlangt, melden (die acht Funktionen in `sketch.js` nie; kein `/* */`) |
| `core/tiling.js`, `core/faces.js`, `core/facecolor.js`, `core/spatial-morph-render.js`, `core/export.js`, Off-Path-Golden, `tools/ui/baseline-*.json` (Bestand), `gallery/` | **unverändert** |
| `index.html`, `gallery.html`, `color-harmony/ui/index.html` | **`?v=` gemeinsam** (Suffix ohne Ziffer nach dem Datum, z. B. `20270101dreieck`) |
| neu: `tools/netwarp/test-netwarp-projective-triangle.js`, `tools/netwarp/verify-3c-triangle.browser.js`, `tools/grid/measure-3c-triangle.js` (liegt schon da) | Tests, Messung |
| `tasks/124-3c-dreieck.md`, `reports/124.md`, `ROADMAP.md`, `Claude.md`, `docs/baselines.md` | Plan, Bericht, Dokumentation (Abschnitt 8) |

**Erwartete Pins (alt → neu):** die „core unchanged against the base“-Tests (`test-glossary`, `-lage-click`, `-lage2-limits`, `-name-display`, `-ordnung12`, `-ordnung-stepper`, `-shape-change`, `-lage-paths`) und `test-anim-png-driver`/`-svg-driver` führen `netwarp.js`, `session.js` schon in der Ausnahmeliste (121); neu: **keine**. `ui-net-art.js` wird von `test-netart-model` gelesen: **Änderung der Erwartung** („3C am Dreieck gesperrt“ → frei; Sabotage S1 dreht sich um), `test-netart-sketch`: wahrscheinlich grün. `test-netz-nachbesserung`: Wächter-Text des Dreiecks. `test-morph-view`, `test-lines-toggle` (sketch.js-Basis): nicht betroffen (`sketch.js` unverändert). `tools/netwarp/test-netwarp-projective.js` (121): Erwartung „Dreieck → `null`“ und der alte Kerngrund drehen sich um (Pin alt → neu im Test-Commit).

## 7. Testplan
**Harness** `tools/netwarp/test-netwarp-projective-triangle.js` (importiert `core/`, Sandbox wie 121; Gegenstelle: Prototyp `measure-3c.js`/`measure-3c-triangle.js`):
1. Linien: 20 000 Strecken, Bild = Sehne ≤ 1e-9 px; Senke: Schnitt exakt an v = a, v = b, p = 0, q = 0.
2. **Flächenkanten:** Dreieckskacheln: Kante gegen Sehne ≤ 1e-9; benachbarte Dreiecke (auch aufrecht/umgedreht) lückenlos (Spalt 0); jede gezeichnete Kachel hat vmin ≥ a (kein Überstand).
3. W-Zählung: 2,4 → 12; 3,6 → 27; 1,3 → 8; 3,5 → 16 gegen `netProjectiveInfo` und Formel b² − a²; keine halbe Kachel.
4. Inverse: `invert(apply(P)) = P` ≤ 1e-9 (10 000 Punkte), `netWarpFieldLocal` Klick → Bearbeitungskachel (oberes Dreieck) → Bild = Klick.
5. Bearbeitungskachel: liegt im Gebiet, ist oberes Dreieck, Basisdreieck (1,0),(0,1),(1,1) → Bild gleich dem Bild der Kachel (i0, j0).
6. Gültigkeit: Dreieck halb abgelehnt mit Grund; Quadrat unverändert; Sechseck `null`.
7. Zeitleiste: △N ↔ △N ok, an den Enden exakt; □N ↔ △N abgelehnt mit „family differs“; △N ↔ Netzart 1 abgelehnt.
8. Export-Rundlauf (`netTransformExportData` → JSON → `netTransformFromExport` gleich); Session `_vNetSpec` nimmt △N ganz an, lehnt △N halb, a ≥ b, Familie Unsinn ab; alter Validator von main wirft (Pin).
9. **Off-Path:** ohne Netz und mit jedem alten Spec (Feld Quadrat/Dreieck/Sechseck, Einzel, Kachel) alle `drawCurvedBezier`-Aufrufe byte-gleich zu main; Quadrat-3C byte-gleich zu 121.
10. UI-Modell: `test-netart-model` angepasst, `suggest('triangle')` = Tabelle Abschnitt 1; `test-netz-i18n-keys` deckt alle neuen Schlüssel.
**Sabotagen (mindestens fünf, jede rot):** (S1) Dreieck zählt mit Quadrat-Streckung; (S2) Bearbeitungskachel = unteres Dreieck; (S3) Format halb am Dreieck erlaubt; (S4) `_netProjTileOutside` ohne `vmax ≤ a`; (S5) `netAnimationCompat` lässt □N ↔ △N zu; (S6) Export ohne `family: '△N'`; (S7) `_vNetSpec` ohne Familien-Prüfung; (S8) `AVAIL.n3c.triangle` wieder gesperrt; (S9) Off-Path-Zweig greift immer; (S10) Schlüssel `net.art.reason.n3c.triHalf` fehlt im Wörterbuch.
**Browser** (App im Fenster, `read_console_messages` fehlerfrei, DE und EN): echte Bedienung am Dreieck: Netzart-Stepper → 3C (Voreinstellung = erster Vorschlag, Format ganz), a/b ändern, „halb“ gesperrt mit Grund; Flächenfüllung (Muster mit Flächen) an 2,4 und 3,5 bei Canvas 3:2; Klick-Treffertest (Knoten der Bearbeitungskachel treffen, freier Punkt landet unter dem Klick, Klick außerhalb des Gebiets nicht möglich, weil Canvas = Rahmen); Export JSON (Version 2, `△N`) und SVG (als XML gelesen, Koordinaten innerhalb des Canvas), Session speichern/laden, Zeitleiste △N ↔ △N und □N ↔ △N; Quadrat bleibt gleich (Stichprobe). Bildschirmfotos `reports/124-bilder/` (**nicht committen**). Stil-Punkt 5: `getComputedStyle` je Stepper-Anzeige, Foto Netz-Zeile. Optional Raum-Morph unter △N (angesehen, nichts geändert; Befund aus 121 gilt: Flächen folgen den Linien stellenweise nicht).
**Golden 30/30:** main (`git archive`, eigener Port) und Arbeitsbaum (eigener Port) im selben Fenster, Ergebnisobjekte vergleichen (FNV `58f7a972` erwartet). **Frame-Zeit:** Median über 20 `redraw()`: △N (2,4) und (4,8) ganz, 0 und 3 Ebenen, gegen das Dreieck-Feld; Stopp, wenn △N > 2 × Dreieck-Feld.
**Prüfstufe:** `bash tools/guard.sh main` (FAIL nur `core/netwarp.js`, `core/session.js` erwartet), `bash tools/proof.sh L2 124` (L3 nur, wenn `core/faces.js`/`tiling.js` gebraucht würden: **nicht** geplant).

## 8. Dokumentation (Einzeiler)
- `Claude.md` „Current references“: verweist noch auf `baseline-phone-6.json` und `baseline-netzart-12.json` (Task 122) — **nicht** auf `baseline-netzart-13.json` und `baseline-phone-7.json` (123). Ergänzen: eine Zeile mit den beiden neuen Dateien (Phone-7 inhaltlich = Phone-6, siehe unten).
- `docs/baselines.md`: enthält weder `netzart-13` noch `phone-7` (Suche ohne Treffer) → je ein Eintrag.
- `ROADMAP.md`: Vermerk „Das Telefon-Messszenario (`tools/ui/measure-phone.js`) kennt keine 3C-Zustände (nur Netzart 1), darum ist `baseline-phone-7.json` inhaltlich gleich `baseline-phone-6.json`; nur vermerkt, nicht gebaut“; dazu Eintrag 3C-2 erledigt (Dreieck, ganz), Sechseck offen (Auslassregel), a = 1 am Dreieck (Frage 1).

## 9. Aufwand, Risiko, Commits
| Teil | Aufwand | Risiko |
|---|---|---|
| Kern: Form, Gültigkeit, Warp-Zweig, Bearbeitungskachel, Info, Overlay | M | mittel (Dreieckkachel-Zuordnung, mehr Kacheln als Gebiet) |
| Export, Session | S | gering (Familie) |
| Zeitleiste | S | gering (vorhandener Grund) |
| UI-Modell, Texte | S–M | gering (Tabelle, `suggest` je Form) |
| CSS-Schriftschnitt | S | gering |
| Browser, Golden, Frame-Zeit, Bericht | M | Zeit |
Commits: (1) Plan; (2) Test-Gerüst + Messskript (rot); (3) Kern; (4) Export/Session/Zeitleiste; (5) UI-Modell und Texte; (6) CSS; (7) Pins (alt → neu); (8) `?v=`; (9) Dokumentation; (10) Bericht.

## 10. Offene Fragen an Sie
1. **a = 1 am Dreieck?** Messung dieses Plans (Abschnitt 1/2): beim Dreieck (ganz) wird keine Kachel über die Fluchtlinie gezeichnet, a = 1 ist rechnerisch **sicher** (Fluchtlinienkachel hat vmax = 1 ≤ a). Ohne a = 1 gibt es bei 1:1 nur 2,4 (Streckung 1,98) und bei 3:4 keinen Vorschlag; mit a = 1 wären 1,3 (1,54 bei 1:1) und 1,4 die besten Vorschläge, und Fig. 159/160 der Quelle sind a = 2. (A) a ≥ 2 wie beim Quadrat *(Ihre Vorgabe; Standard dieses Plans)*; (B) a ≥ 1 nur für das Dreieck (Kern- und UI-Grenze je Form, +1 Prüfpunkt, ein Pin im Test von 121). Fundstelle: `core/netwarp.js:871`.
2. **Streckungsmaß am Dreieck** (√3-Bezug, Abschnitt 1) und **W-Bereich 8 bis 16** statt 7 bis 12 als Vorschlags- und Warngrenze: einverstanden? Fundstellen: Messung 120/6 („Optimum für △N: 8 bis 16“), `ui-net-art.js:W_LO/W_HI`. Die Quellaussage S. 17 habe ich nicht neu gelesen.
3. **Zeitleiste □N ↔ △N:** abgelehnt mit vorhandenem Grund (Standard) oder zugelassen (a, b überblenden, Kachelform springt)? Empfehlung: abgelehnt.
4. **Halbes Format am Dreieck:** „sichtbar, gesperrt mit Grund“ (so geplant) — oder im Stepper gar nicht zeigen? Der Auftrag sagt sichtbar; nur zur Bestätigung des Wortlauts (Abschnitt 4).

## Nicht geprüft (bis jetzt)
Skizze/Bild der Dreiecksfiguren (Fig. 159 bis 164) nur an einer Seite (S. 51) gesehen; „zwei Lösungen“ je Figur nicht untersucht; `tileTriangle` mit Rand +4 Maschen auf Frame-Zeit noch nicht gemessen; `toTileLocal` mit `flip180` in `_netProjTileOutside` nur gelesen; Telefon-Layout unter △N; die englische Oberfläche (wird im Browser geprüft).
