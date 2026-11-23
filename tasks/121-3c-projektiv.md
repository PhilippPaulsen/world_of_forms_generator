# Auftrag 121 — 3C-1: projektiver Warp (Möbiusnetz) fürs Quadrat — PLAN (Typ K, Prüfstufe L2)

Branch `task/121-3c-projektiv` von main `11768afa` (Merge 120). **Stand: nur dieser Plan geschrieben, nichts gebaut, auf Freigabe warten.** Nicht mergen, nicht pushen, `docs/quellen/` nie committen, nur explizite `git add`-Pfade. /usage bei Planstart: Woche 71 %, 5 h 20 % (Stopp bei ≥ 90 %).

Gelesen: `tasks/119`, `reports/119.md`, `reports/120.md`, `reports/120-messung.md`, `tools/grid/measure-3c.js`, `core/netwarp.js` (ganz), `core/curves.js:470–540`, `core/tiling.js` (Warp-Installation, Kachelschleife, `closedNetRectCorners`, `latticeIJBoundsCovering`), `core/faces.js:1104–1151, 1335–1400`, `core/export.js:185–195, 339, 531`, `core/session.js` (`_vNetSpec`), `core/spatial-morph-render.js:495–660`, `sketch.js` (`drawnHitNodes`, `nodeHit`, Punkt-Overlay, `pressAt`, `axisFromSpec`/`adoptNetState`). Nicht gelesen: UI-Texte, `ui-net.js` im Detail (3C-3).

## 0. Kurzfassung
1. **Kein neues `core/`-File, kein Eingriff in `tiling.js`, `faces.js`, `facecolor.js`, `spatial-morph-render.js`, `sketch.js`, `export.js`.** Der Warp trägt dieselben Marker wie das Feld (`repeat: false`, `field: {Rt: 1, h: 0}`, `c0/v1/v2` = Rechteck [0,b]²), damit die bestehende Kachelschleife und die Flächenfüllung ihn ohne Änderung bedienen. Schreiben: `core/netwarp.js` (Kern), `core/curves.js` (eine Zeile an der Senke), `core/session.js` (Validator). Freigaben nötig: `curves.js` und das Export-/Session-Format.
2. **Befund Fluchtlinie (gemessen, siehe §3): Die Klemme ε = 10⁻³ trägt nicht.** Sie erzeugt Koordinaten bis 8·10⁵ px; der Canvas (Chrome, Skia) schaltet Pfade jenseits ≈ 8 200 px auf harte Kanten (Kantenglättung weg). Eine Klemme in Pixeln (Schranke 4 000 px) ist stattdessen geometrisch falsch (3,5 % der Pixel). **Aber das Problem betrifft nur a = 1:** für a ≥ 2 ist die kleinste Ecke einer gezeichneten Kachel v = a−1 ≥ 1, ihr Bild liegt höchstens 3 Rahmenhöhen außerhalb. Vorschlag: a ≥ 2 im Kern erzwingen (sichtbar abgelehnt, wie `domainIgnored`); a = 1 entweder später mit einem exakten Polygonschnitt-Haken in `faces.js` (Freigabe) oder gar nicht. Entscheidung Frage 1.
3. **Neu gefunden, nicht in 119/120:** Die Knotenpunkte (`showNodes`) und der Treffertest (`drawnHitNodes`, `nodeHit`) zeichnen und treffen nur die Knoten der **Basiskachel** (`applyNetWarp(nd)` auf ihre regulären Koordinaten). Beim Feld ist das die Mitte; beim Möbiusnetz wäre es die Kachel an der Keilspitze (p = q = 0), die für a ≥ 2 **außerhalb des Bildes** liegt: kein Knoten sichtbar, kein Klick trifft. Lösung ohne `sketch.js`: die **Bearbeitungskachel (i0, j0)** — wie beim Feld die zentrale Zelle (`hx`, `warp.frame`): `(p, q) = (s + i0, t + j0)`, (i0, j0) = sichtbarste Kachel nahe der Bildmitte. Das Bild ändert sich dadurch nicht (jede Kachel trägt dasselbe Muster), nur wo Punkte, Treffertest und freie Endpunkte arbeiten.
4. Erwartete Größe: **Aufwand L, Risiko mittel** (Format, Zeitleiste, Fluchtlinie). Ohne Netz ändert sich kein Code-Pfad.

## 1. Modell (aus Prototyp H, Messungen 1 bis 5)
Regulär: Quadratgitter (p, q), Muster in jeder Masche (= Kachel, Maschen = Einheitsquadrate in den Kachelkoordinaten (s, t) des Rahmens `{c0, v1, v2}` der Basiskachel). Ausschnitt: p, q ≥ 0, a ≤ v ≤ b mit v = p + q (halb: zusätzlich p ≥ q). Bild auf den Canvas (W × H px, `canvasW`, `canvasH`, Rahmen = Canvas):
- ganz: X = W·p/v, halb: X = W·(p−q)/v, Y = H·a·(b−v)/((b−a)·v) (a unten, b oben; entspricht `(1 − y)·H` des Prototyps).
- Homogen (ganz): Zeilen `[W,0,0]`, `[−c,−c,c·b]` mit c = H·a/(b−a), `[1,1,0]` auf (p, q, 1). Das ist die eine Homographie H; sie steht so im Export.
- Inverse geschlossen: v = a·b/(Y′·(b−a) + a) mit Y′ = Y/H; p = X·v/W (ganz) bzw. p = (v + X·v/W)/2 (halb); q = v − p. Die 3×3-Inverse wird im Test gegen diese Formeln geprüft, im Code stehen die Formeln.
- W (Maschenzahl) = (b²−a²)/2 (ganz), halb /2; Familie □N (k = 1). Quelle S. 48, Messung 2: 16 von 16 bestätigt.
- Orientierung 45° ergibt sich von selbst (p, q sind die Gitterachsen, x = p−q über p+q); sie hängt nicht von der Drehung des Quadrats ab, weil nur (s, t) des Rahmens eingehen.

## 2. Spec und Warp (`core/netwarp.js`)
**Spec** (neu, getrennt von `{x, y, …}`): `{ kind: 'projective', a, b, format: 'full' | 'half', family: '□N' }`. Alte Specs haben kein `kind`. Konstruktor `netProjectiveSpec(a, b, format)` (rein, später von der UI benutzt).
**Gültigkeit** `netProjectiveEffective(spec, shape, interp)`: Quadrat; a, b ganze Zahlen, 2 ≤ a < b ≤ `NETWARP_PROJ_MAX_B` = 12 (UI schlägt später nur b ≤ 9 vor; Kachelzahl b² ≤ 144 < `MAX_TILES` 4000); Format und Familie bekannt. Ungültig → **kein Warp, sichtbar** (`{valid: false, reason}`; Export-Flag `projectiveIgnored`, wie `domainIgnored`). Nicht ganzzahlige a, b nur mit `spec.interp === true` (Zeitleiste, §7), dann a ≥ 2 − 1e-9, a < b.
**Info** `netProjectiveInfo(spec, W, H)` (rein): W, Maschen-Streckung (Messung 6, Quotient größte/kleinste Bildmasche an Ecken und Mitte), Kachelzahl, Bearbeitungskachel. Für den Test und die UI (3C-3); die UI-Vorschlagsliste selbst gehört nicht hierher.
**`makeNetWarp`-Zweig** ganz oben: `if (spec && spec.kind === 'projective') return _netProjectiveWarp(spec, frame)` (ein Property-Zugriff je Warp-Bau, nicht je Segment; ohne `kind` unverändert). Das Objekt:
- `projective: { a, b, format, W, H, i0, j0, nx: b, ny: ceil(b)|ceil(b/2), eps }`, `kind`-Marker, `frame: {c0, v1, v2, det}` = Basiskachel (Kachel der Bearbeitung).
- Für die bestehenden Leser (`repeat: false`, `domain: 'field'`, `field: {Rt: 1, h: 0}`, `refineFaces` fehlt): `c0 = frame.c0 − i0·v1 − j0·v2`, `v1 = nx·v1f`, `v2 = ny·v2f` — damit liefert `closedNetRectCorners()` genau das Rechteck [0,b]×[0,b] (halb [0,b]×[0,b/2]) und `latticeIJBoundsCovering` die b² Kacheln; `tiling.js` bleibt unberührt (Muster aus der Feld-Rx×Ry-Lösung, `makeNetWarp` Zeile 280).
- Folge für die Leser: `faces.js` (`activeNetWarp.field` → `place = applyNetWarp` je Ecke, **ohne** `netWarpRefineFaces`, weil `refineFaces` fehlt), `tiling.js` (`!field` → Flächen erlaubt), `netWarpBlocksFaces` (Feld-Regel: Basisflächen ja, Ebenen auf der Basisgitter ja, andere abgelehnt).
**Funktionen** (je ein früher Zweig `if (warp.projective)`; die Feld- und Tile-Pfade bleiben Zeile für Zeile erhalten):
| Funktion | 3C-Verhalten |
|---|---|
| `applyNetWarp` | (s, t) → (p, q) = (s+i0, t+j0), v = max(p+q, ε), Formeln §1; v = 0 (Spitze) → x = 0. Immer endlich (auch für gekrümmte Linien, §3). |
| `invertNetWarp` | Formeln §1, liefert den regulären Punkt (s, t) der Bearbeitungskachel-Koordinaten; für das Bild außerhalb des Ausschnitts (Y′ ≥ … ) trotzdem definiert, solange v > 0. |
| `netWarpTileCoords`, `netWarpInsideNet` | Treffer = Punkt im Ausschnitt (v in [a, b], p, q ≥ 0, halb p ≥ q) über die Inverse; sonst falsch. |
| `netWarpFieldLocal` | Bildpunkt → (p, q) → Kachel (i, j) = floor, lokal (l, m) = Rest; Ergebnis wie beim Feld: Punkt der Bearbeitungskachel `c0 + l·v1 + m·v2`, `tile`, `local`; außerhalb null. Klammerung am Rand wie beim Feld. |
| `netWarpSplitSegment` | liefert **nicht** Kachelteilung, sondern den **exakten Schnitt** der regulären Strecke mit dem Ausschnitt (Cyrus-Beck gegen 4 bzw. 5 Halbebenen mit Toleranz 1e-9): `[p1′, p2′]` oder `[]` (ganz draußen). Das ist die Senke-Lösung §3, ohne neuen Haken. |
| `netWarpTileOutsideCanvas` | Zweig vor dem `refineFaces`-Wächter: Kachel überspringen, wenn ihr v_max ≤ a, v_min ≥ b oder (halb) p ≤ q überall (aus den vier Ecken der Kachel über `toTileLocal(outerCorners)` und dem Rahmen); exakt, kein Rand. Die 1-px-Marge bleibt für Linienstärke ungenutzt (Kachelrand exakt). |
| `netGridLines` | Zweig ganz oben: Linien p = i + k/E und q = j + k/E (macro bei k = 0, micro sonst), am Ausschnitt exakt geschnitten, Enden über H. Ohne Rand-Überstand; `closed` ignoriert. |
| `netTransformExportData`, `netTransformFromExport` | §6. |
| `netAnimationCompat`, `netLerpSpecs` | §7. |
| `netWarpForBase` | Zweig: `spec.kind === 'projective'`: Quadrat → `makeNetWarp`, sonst null (Dreieck, Sechseck folgen in 3C-2; sichtbar abgelehnt, wenn die UI es anbietet). |
**Bearbeitungskachel (i0, j0):** die Kachel mit der größten Fläche im Ausschnitt; Gleichstand: die dem Bildmittelpunkt (v = 2ab/(a+b)) nächste. Rein aus a, b, Format (Polygonschnitt der b² Einheitsquadrate, ≤ 144, einmalig je Warp-Bau). Beispiel 2,4 ganz: (1,1), Kachel mit v in [2,4] komplett im Ausschnitt.

## 3. Fluchtlinie
### 3.1 Messung (Canvas, dieser Plan; Skripte in der Arbeitsmappe `scratchpad/clamp.html`, `err.js`, nicht committet)
| Frage | Ergebnis |
|---|---|
| Wo liegen die Koordinaten bei ε = 10⁻³? | Spitze bei y_px = 8·10⁵ (H = 600, a = 1, b = 4); bei ε = 10⁻⁶: 8·10⁸. |
| float32? | Unkritisch: 799 800 ist als float32 exakt, Auflösung bei 8·10⁵ px = 0,06 px, Fehler an der sichtbaren Kante < 10⁻⁴ px. |
| Canvas (Chrome, Skia) | **Schwelle zwischen 7 800 und 11 229 px**: bei ε = 0,1 (Spitze 7 800 px) 0 Pixel Unterschied zum exakt geschnittenen Polygon; ab ε = 0,07 (11 229 px) **2 149 von 360 000 Pixeln** anders (0,6 %), größte Abweichung 63/255, 999 Pixel > 32/255; ab dort gleichbleibend, bis ε = 10⁻⁶. Ursache (nicht im Quelltext geprüft, aus dem Verhalten): ab ≈ 8 192 px (32 767 geteilt durch 4 Unterabtastung) rastert Skia den Pfad ohne Kantenglättung. Betrifft jedes Polygon mit einer Ecke dahinter, nicht die Linien (die bleiben im Canvas). |
| Linien (Strecke mit Klemme statt Schnitt) | ε = 10⁻³: 612 Pixel, größte Abweichung 16/255 (die 0,07 px aus Messung 120). |
| Klemme in Pixeln (Bildraum-Schranke) | 4 000 px: 12 630 Pixel falsch (3,5 %); 8 000 px: 6 150 (1,7 %); nur ε ≈ 10⁻³ ist geometrisch rein, aber dann > 8 192 px. **Untauglich.** |
| SVG | `799800.00` ist eine gültige Zahl; Chrome rendert sie; Illustrator, Inkscape: **nicht geprüft**. |
| Wo entstehen überhaupt große Koordinaten? | Nur in der Spitzenkachel (0,0) (v_min = 0). Gezeichnete Kachel mit Ecke unter a hat v_min = a−1; y = −b/((a−1)(b−a)) Rahmenhöhen: a = 2, b = 3: 3 H; a = 2, b = 9: 1,3 H; a = 8, b = 9: 1,3 H. **Für a ≥ 2 nie größer als 3 H** (1 800 px bei H = 600), weit unter 8 192. Kacheln mit v_max ≤ a werden übersprungen (Flächen) bzw. an der Senke verworfen (Linien). |
### 3.2 Plan
- **Linien (exakt, a ≥ 1):** an der Senke. `netWarpSplitSegment` (schon aufgerufen von `drawCurvedBezier`, nur für gerade Strecken) gibt den Schnitt zurück; die Streckenzug-Behandlung des Senke verarbeitet ein Paar `[p1′, p2′]` bereits (zwei Punkte → eine Linie). **Einzige Änderung in `core/curves.js`** (innerhalb `if (activeNetWarp)`): nach `const split = …` die Zeile `if (split && split.length < 2) return;` (leerer Schnitt = Strecke ganz außerhalb, nichts zeichnen, nichts sammeln). Begründung: ohne sie wäre `polyline[0]` undefiniert. Kleinste Änderung; ohne Netz nie erreicht, `activeNetWarp` ist dann null. Nicht-gerade Linien (Kurvenmodus ist unter einem Warp von der UI aus, aus einer Session aber möglich): kein Schnitt; die Endpunkte gehen durch `applyNetWarp` mit der Klemme v ≥ ε = 10⁻³ (endlich, sichtbar leicht ungenau, dokumentiert).
- **Flächen (a ≥ 2):** keine Klemme nötig (Ecken ≤ 3 H); `netWarpTileOutsideCanvas` überspringt die Kacheln ganz außerhalb. Die Klemme bleibt als Schutz in `applyNetWarp` (v ≥ ε), tritt aber für a ≥ 2 nie auf.
- **Flächen bei a = 1 (nicht im Kern):** Option B (exakt): ein Haken in `faces.js` `drawFaceFillsAtTile`, der das Polygon **vor** der Abbildung am Ausschnitt schneidet (`netWarpPlaceFacePolygon`, no-op ohne `projective`; etwa 12 Zeilen, Freigabe für `faces.js` nötig, Pin des Sechseck-Tests `test-net-field-hex-faces.js (7)` muss um einen Marker `// task 121 {` erweitert werden). Option C: a = 1 zulassen und die Kantenglättung der Spitzenkachel verlieren. **Empfehlung: A (a ≥ 2 erzwingen) jetzt, B nur wenn Sie a = 1 wollen.**

## 4. Kachelschleife und Rahmen
Die Schleife läuft über das Rechteck [0,b]² (halb [0,b]×[0,b/2]) über `closedNetRectCorners` + `latticeIJBoundsCovering` (Messung 5: 9 (1,3) bis 64 (4,8) Kacheln, etwa die Hälfte mit Fläche). Ebenen mit Versatz erweitern das Rechteck wie heute um `maxLayerOffset()`: ihre Kacheln außerhalb von [0,b]² liegen im regulären Raum bei p, q < 0 oder v > b; die Strecken dort schneidet die Senke ganz weg (Ausschnitt), die Flächen überspringt der Haken. Dadurch gibt es kein Bild jenseits des Netzrands. Der Canvas ist der Rahmen: ein Netz, dessen Rahmen nicht zum Canvas passt, entsteht nicht (die UI zeigt später das passende Seitenverhältnis, Messung 6).

## 5. Export und Session
- **Export** (`netTransformExportData`, `core/netwarp.js`; `core/export.js` unverändert, es reicht Form und Canvas): bei `spec.kind === 'projective'` früher Rückgabewert `{ version: 2, kind: 'projective', family, a, b, format, orientation: 'diagonal 45°', W, canvas: {w, h}, tiles: {x, y}, editTile: {i, j}, homography: {rows, note}, geometryIsRegular: true, facesOmitted: false, layerFacesOmitted: true, facesMapping: 'regular central cell; every tile is the image of the regular tile under the one homography of lattice coordinates (p, q) = (s + i, t + j): polygon edges stay straight', interpretation: true, constants?: nein }`. **Kein `fieldBase`, kein `gridShiftPx`** (nur im Feld-Pfad, der nicht erreicht wird). `projectiveIgnored: {reason}` bei ungültigem Spec. Bestehende Exporte bleiben `version: 1` und byte-gleich.
- **Leser:** `netTransformFromExport` liest `version === 1` und gibt sonst null (bisher): für `version === 2, kind === 'projective'` neuer Zweig (a, b, format, family; alles andere abgeleitet). Ein alter Leser ohne den Zweig bekommt für Version 2 `null` (kein Netz) — Geometrie (`nodes`, `edges`) bleibt regulär und korrekt (`geometryIsRegular`), das Bild fehlt, aber `meta.netTransform.version = 2` ist als solches erkennbar. Das ist die Versionierung; SpaceHarmony liest nur nodes/edges.
- **Session** (`core/session.js`, `_vNetSpec`): neuer Zweig `kind === 'projective'` (a, b Zahlen 1 bis 12 mit a < b, format `full|half`, family `□N`, optional `interp`); die alten Pfade unberührt. **Keine Schema-Erhöhung:** der alte Validator verlangt `x`, `y` als `{kind, w}` und wirft für ein 3C-Spec → Fehlercode `invalid` → die Session wird sichtbar abgelehnt (Quarantäne), nicht still falsch gezeigt; das pinnt ein Test mit dem Validator von main. `session-apply.js` kopiert Specs per JSON, unverändert. Zeitleiste: `timeline.netStates` läuft durch denselben Validator.

## 6. Zeitleiste (`netAnimationCompat`, `netLerpSpecs`)
- `netAnimationCompat(from, to)`: früh, wenn eines der beiden Specs `kind: 'projective'` ist: beide 3C mit gleichem Format und gleicher Familie → ok; **sonst abgelehnt mit Grund** („a 3C net (Möbiusnetz) is rotated 45° against the grid and cannot be interpolated with a Regular, Field, Single or Tiled net“; „format differs (full vs half)“). Regulärer Ausdruck des bestehenden Pfads (`_netAnimNorm`) wird für 3C nie erreicht (er läse `spec.x` undefiniert).
- `netLerpSpecs`: a, b linear (exakt a bei t = 0, b bei t = 1), `interp: true`, `keep: true`; Format und Familie von den Enden. a, b werden reell (jede reelle Matrix ist eine Homographie, Messung/119 §2.2); Gültigkeit mit `interp` (a ≥ 2 − 1e-9, a < b) bleibt für Mischwerte erhalten. Die Bearbeitungskachel kann dabei springen: nur Punkte, Treffer und freie Endpunkte, nicht das Bild.
- `timelineNetSummary` und die Statusanzeigen nutzen `netAnimationCompat` und `netLerpSpecs(…, 0/1)` — funktionieren ohne Änderung (Test in der Zeitleiste).

## 7. Wechselwirkungen
- **Ebenen:** wie Feld: Ebenen auf dem Basisgitter (`gridMatchesBase`) haben Flächenfüllung; andere nicht. Linien jeder Ebene gehen durch dieselbe Senke, daher exakt geschnitten. Ebenen mit Versatz/Drehung: unverändert Feld-Verhalten.
- **Raum-Morph:** `spatial-morph-render.js` liest `activeNetWarp.field` und zeichnet Flächenpolygone je Ecke über `applyNetWarp` (Zeile 507); die Linien über die Senke. 3C **erbt das Verhalten des Felds** (Morph-Flächen unter Feld sind laut ROADMAP offen). Browser-Prüfung: Raum-Morph unter 3C ohne Fehler, Linien und Flächen im Netz; wenn die Polygone (Randaufweitung 0,3 px, `spatialMorphRenderGrow`) auffällige Fehler zeigen, wird das gemeldet, nicht in der Datei geändert.
- **Flächenfüllung offen unter Feld:** erbt, benannt (Ebenen mit eigenem Raster, siehe oben; Zeichnen, Export der Basisflächen in regulärer Mittelzelle).
- **Treffertest, Punkte:** Bearbeitungskachel (§0.3), kein Eingriff in `sketch.js`. Freie Endpunkte: `netWarpInsideNet` → außerhalb abgelehnt (bestehende Meldung); innen `netWarpFieldLocal`. Neu ist der Ausschnitt statt Rechteck (Klick außerhalb des Keils, aber im Canvas, wird abgelehnt: sichtbar, bestehender Text).
- **Netzlinien-Overlay (`netGridLines`):** siehe Tabelle §2. `sketch.js` ruft die Funktion mit `closed`/`domain`/`fieldTiles`; der 3C-Zweig ignoriert beides.
- **Panel Netz:** unter 3C-1 ohne UI. `adoptNetState()` verträgt ein 3C-Spec (`axisFromSpec(undefined)` gibt die frische Achse zurück, geprüft). **Bekannte Lücke bis 3C-3:** jede Bedienung des Panels (`commit()`) überschreibt `baseNetTransform` durch ein Spec aus der UI und beendet das 3C-Netz; im Test wird das Spec nach der Bedienung neu gesetzt.
- **Harness-Weg, den Warp zu setzen:** `baseNetTransform = netProjectiveSpec(a, b, 'full')` (globales `let`, aus Tests und `javascript_tool` direkt) und `redraw()`; für den Browser ein Hilfsskript `tools/netwarp/set-3c.browser.js` (nur Test, kein Produktcode, kein URL-Parameter).

## 8. Dateien (je Zeile)
| Datei | Rolle |
|---|---|
| `core/netwarp.js` | **schreiben** (Kern, ≈ 250 Zeilen, kein bestehender Pfad geändert; alle Zweige hinter `projective`/`kind`) |
| `core/curves.js` | **schreiben, Freigabe nötig:** eine Zeile (§3.2) |
| `core/session.js` | **schreiben, Freigabe nötig (Format):** Zweig in `_vNetSpec` |
| `core/export.js` | unverändert (Format entsteht in `netwarp.js`); nur wenn der Test es anders verlangt, melden |
| `core/tiling.js`, `core/faces.js`, `core/facecolor.js`, `core/spatial-morph-render.js` | **geschützt, unverändert** (Option B für a = 1 würde `faces.js` öffnen, nur auf Ihre Freigabe) |
| `sketch.js` (acht Funktionen, kein `/* */`), `ui-*.js`, `index.html` (außer `?v=`), `style.css` | unverändert; kein Layout-Baseline-Wechsel |
| Off-Path-Golden, Baselines `tools/ui/baseline-*.json`, `gallery/` | unverändert |
| `index.html`, `gallery.html`, `color-harmony/ui/index.html` | **`?v=` heben** (`netwarp.js`, `curves.js`, `session.js` geändert), alle drei zusammen |
| neu: `tools/netwarp/test-netwarp-projective.js`, `tools/netwarp/set-3c.browser.js`, `tools/netwarp/measure-3c-frame.browser.js` | Tests, nur Test |
| `tasks/121-3c-projektiv.md`, `reports/121.md` | Plan, Bericht |
**Erwartete Pins (alt → neu):** `tools/ui/test-quad-canvas-svg.js` (BASE `9b398d27`) und `tools/ui/test-lines-toggle.js` (BASE `6fbf420b`) vergleichen `core/curves.js` **ausgeführt** gegen den alten Stand (Aufrufe und SVG-Zeichenketten byte-gleich): sollten ohne Pin grün bleiben, weil die neue Zeile hinter `activeNetWarp` liegt und ohne Netz nie erreicht wird; `tools/netwarp/test-netwarp-layerlines.js` (BASE `eef20c1d`) dito. Die fünf „core unchanged against the base“-Tests (`test-glossary`, `-lage-click`, `-lage2-limits`, `-name-display`, `-ordnung12`) kommen nur bei einem **neuen** `core/`-File dran: hier keines, also kein Pin. Möglicher Pin: ein Test, der `core/session.js` als Text vergleicht (nicht gefunden; beim Lauf `proof.sh L2` melden). Wenn ein Pin nötig wird: eigener Commit mit alt → neu (wie 117).

## 9. Testplan
**Harness** `tools/netwarp/test-netwarp-projective.js` (importiert `core/`, Sandbox wie `test-netwarp-field.js`): Prototyp H aus `measure-3c.js` als Gegenstelle (Formeln direkt gegen `applyNetWarp`).
1. Linien: 20 000 Strecken: Bild eines Streckenpunkts gegen die Sehne der Bilder der Endpunkte ≤ 1e-9 px; Senke (Mock-p5 wie im Feldtest): Polylinie = Schnitt, Ende exakt auf v = a, v = b, p = 0, q = 0, (halb) p = q.
2. Flächenkanten: Polygon je Kachel, Kante gegen Sehne ≤ 1e-9; Spalt zwischen Nachbarkacheln 0 (gleiche Rechnung).
3. W-Zählung wie Messung 2 (16 Zeilen, Quadrat-Zeilen gegen `netProjectiveInfo`).
4. Fluchtlinie: Spitzenkachel (0,0): Linien alle verworfen (Senke ruft nicht), `netWarpTileOutsideCanvas` wahr für v_max ≤ a; genau eine Kachel hat v_min = 0; keine Koordinate eines gezeichneten Polygons > 3 H für a ≥ 2, alle a, b ≤ 12; `applyNetWarp` endlich in (0, 0), (0, ε/2) und v < 0.
5. Inverse: `invertNetWarp(applyNetWarp(P)) = P` ≤ 1e-9 über 10 000 Punkte, ganz und halb; geschlossene Form gegen echte 3×3-Inverse; `netWarpFieldLocal` Klick → Zentralkachel → Bild = Klick (≤ 1e-6 px).
6. Zeitleiste: 3C ↔ 3C ok, `netLerpSpecs` exakt an den Enden; 3C ↔ Regular, Feld, Einzel, `{regular: true}`, alte Specs abgelehnt mit Grund; Format verschieden abgelehnt.
7. Export-Rundlauf: `netTransformExportData` → JSON → `netTransformFromExport` gibt dasselbe Spec; `geometryIsRegular`, `facesMapping`, kein `fieldBase`; Session `_vNetSpec` nimmt 3C an, lehnt `a = 1` (Kern), `a ≥ b`, Format Unsinn ab; alter Validator von main (`git show`) wirft für 3C (Pin der „sichtbar abgelehnt“-Aussage).
8. **Off-Path:** ohne Netz (`baseNetTransform = null`) und mit legacy-Spec (Feld, Einzel, Kachel) sind alle `drawCurvedBezier`-Aufrufe und `applyNetWarp`-Ergebnisse byte-gleich zu main (wie `test-netwarp-layerlines.js`).
**Sabotagen (mindestens fünf, jede muss rot werden):** (S1) Y-Formel mit b und a vertauscht; (S2) Bearbeitungskachel fest (0,0); (S3) Senke ohne die neue Zeile (leerer Schnitt); (S4) Schnitt nur an v ≥ a, nicht an v ≤ b; (S5) `netAnimationCompat` lässt 3C ↔ Regular zu; (S6) `invertNetWarp` ohne Halb-Formel; (S7) Export ohne `version: 2`; (S8) `_vNetSpec` ohne `a < b`; (S9) Off-Path-Zweig greift immer (`kind` nicht geprüft).
**Browser** (App im Fenster, Konsole fehlerfrei, `read_console_messages`):
- Echte Zeichnung für (a, b, Format) = **2,4 ganz** (Rahmen 4:3, `best` = 1,32), **3,6 halb** (Rahmen aus `netProjectiveInfo`, 1:1 getestet), **2,5 ganz** (Rahmen 2:1): Netzlinien-Overlay und Muster; Bildschirmfoto je Fall; Vergleich Pixel gegen Prototyp (Canvas 600 × 900 wie Messung 4), Abweichung der Linien gegen den exakten Schnitt.
- Flächenfüllung an (2,4 ganz) mit einem Muster mit Flächen; AA-Prüfung am Rand (Pixel gegen exakten Schnitt, wie `clamp.html`).
- Klick-Treffertest: Knoten der Bearbeitungskachel treffen; Klick auf freien Punkt im Netz legt einen Knoten an (und wird dort gezeichnet, wo geklickt wurde); Klick außerhalb des Ausschnitts wird abgelehnt.
- Export/Import: JSON `meta.netTransform` (Version 2), SVG (Koordinaten endlich, höchstens 3 H außerhalb, jede Datei als XML gelesen, Linien an der Senke geschnitten), Session speichern und laden, Zeitleiste mit zwei 3C-Netzen.
- **Golden 30/30:** main (`git archive`, eigener Port) und Arbeitsbaum (eigener Port) im selben Fenster, Ergebnisobjekte vergleichen (FNV, wie 117); Layout 1100 px main = Arbeitsbaum.
- **Frame-Zeit bei 64 Kacheln** (a = 4, b = 8): Median über 20 `redraw()` bei Feld 9 × 9 und 3C (4,8 ganz) mit demselben Muster, 0 und 3 Ebenen; Stopp, wenn 3C > 2 × Feld 9 × 9.
**Prüfstufe:** `bash tools/guard.sh main` (FAIL nur für `core/netwarp.js`, `core/curves.js`, `core/session.js` erwartet), `bash tools/proof.sh L2 121` (L3, falls Option B `faces.js` öffnet), `tools/proof.sh L1` mit 61/61 und 57/57.

## 10. Aufwand, Risiko, Reihenfolge der Commits
| Teil | Aufwand | Risiko |
|---|---|---|
| Kern: Spec, Gültigkeit, `applyNetWarp`/`invertNetWarp`/Zuordnung, Bearbeitungskachel | M | mittel (alles weitere hängt daran; Off-Path nur über Test belegt) |
| Senke (`curves.js`) und `netWarpSplitSegment`-Schnitt | S | gering (eine Zeile, hinter dem Warp) |
| Flächen, `netWarpTileOutsideCanvas`, Kachelschleife (Marker-Trick) | S–M | mittel (Wirkung auf Leser, die ich nicht ändere) |
| Export/Session/Version | M | mittel (Formatfrage, alte Leser) |
| Zeitleiste | S | gering |
| `netGridLines` | S | gering |
| Browser-Prüfung, Golden, Frame-Zeit, Bericht | M | Zeit |
Commits (je ein Thema): (1) Test-Gerüst + Prototyp-Gegenstelle (rot); (2) Kern in `netwarp.js`; (3) Senke und Schnitt (`curves.js`); (4) Flächen und Kachelhaken; (5) Export/Session; (6) Zeitleiste, Overlay; (7) Pins (nur falls nötig); (8) `?v=`-Bump; (9) Bericht.

## 11. Offene Fragen an Sie (nur was Code und Messung nicht beantworten)
1. **a = 1 im Kern?** (A) Nein, a ≥ 2 erzwingen *(empfohlen: nichts, was die UI vorschlägt, hat a = 1; Messung 6)*; (B) a = 1 mit exaktem Polygonschnitt-Haken in `faces.js` (Freigabe, L3, +1 Pin); (C) a = 1 mit Klemme und harten Kanten an den Flächen der Spitzenkachel. Die Quell-Fig. 148 (1,4) ist ein a = 1-Fall.
2. **Session ohne Schema-Erhöhung** (alter Leser lehnt 3C-Sessions sichtbar ab): einverstanden, oder Schema 3?
3. **Rahmen = Canvas** (das Netz füllt immer den ganzen Canvas, das Seitenverhältnis ist die Wahl des Nutzers, die UI warnt über Streckung): einverstanden? Die Alternative wäre ein eigener Netz-Rahmen im Canvas (mehr Code, nicht in 119/120 gefordert).

## Nicht geprüft
Skia-Schwelle nur im Browser-Fenster (Chromium der App) gemessen, nicht im Quelltext; Illustrator/Inkscape mit großen SVG-Zahlen nicht; `ui-net.js`-Verhalten unter einem 3C-Spec nur gelesen, nicht ausgeführt; Raum-Morph unter 3C nicht gesehen; Option B nicht gebaut; Pins nach Gefühl, erst `proof.sh` zeigt sie.
