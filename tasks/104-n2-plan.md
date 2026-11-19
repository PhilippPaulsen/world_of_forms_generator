# Auftrag 104 — Netze: N2a gerade Größen im Feld, N2b getrennte Teilungen E1 × E2 (Plan, Typ U, Prüfstufe L1)

Branch `task/104-n2-plan` von main `3d7cc73a` (Merge 103). Nichts gebaut: keine Änderung in `core/`, `sketch.js`, `ui-*.js`, Tests. Neu nur dieser Plan, `reports/104.md`. Befund und Zahlen: `reports/104.md`. Quellenstand, Messungen und Fundstellen stehen dort; hier steht, was gebaut werden soll.

## 0. Kernaussage in fünf Zeilen
1. Hinterreiters E = E1 × E2 ist die **Maschenzahl je Achse** (`W = E1 × E2`, Fig. 14: E = 3 × 4, W = 12; Quelle S. 10). Die App zählt im Feld heute **X × Y Maschen = X × Y Kacheln**: ein Feld ist also schon ein E1 × E2 mit E1 = X, E2 = Y, aber nur ungerade (3, 5, 7, 9) und nur mit Maschen = Kacheln.
2. Fig. 14 selbst (3 × 4) ist heute nicht darstellbar, weil sie eine gerade Achse hat. 9 der 12 verschiedenen E-Werte der Seiten 10–22 haben mindestens eine gerade Achse (nur 3 × 3, 3 × 5, 5 × 9 sind beidseitig ungerade).
3. **N2a löst gerade Größen ohne Eingriff in `tiling.js` und ohne Umbau des Gitters:** das Netz verschiebt das Bild um e/2 je gerader Achse (Translation T im Warp: `Bild = F(p + T)`). Gespeichertes (Knoten, freie Endpunkte, Ebenen, Session) bleibt in regulären Koordinaten unberührt. Das ist billiger und sicherer als „E3“ aus 087c (Gitterbau).
4. **N2b** trennt Maschen von Kacheln: E_i teilt X_i, eine Masche ist ein Block von X_i/E_i Kacheln, innerhalb des Blocks läuft das Gesetz linear. Jede Kachel bleibt affin, Flächen bleiben exakt. Das löst auch den Konflikt mit dem Optimum (W 7–12 Quadrate, App-Feld bis 81).
5. Reihenfolge: N2a-1, N2a-2, N2a-3, dann N2b-1, N2b-2. Je Stufe ein Auftrag. Danach (nicht Teil dieses Plans) gerade Größen bei Dreieck und Sechseck, dann △N, *N, △MN, *MN je ein Auftrag.

## 1. Modell N2a — gerade Größen im Feld (Quadrat)
**Geometrie (je Achse mit Kachelzahl n, Kantenlänge e = 600 / min(X, Y), Feldrechteck = Canvas [0, W] × [0, H]):**
| | ungerade n (heute) | gerade n (neu) |
|---|---|---|
| Kacheln links / rechts der Basiskachel | lo = hi = (n−1)/2 | lo = n/2, hi = n/2 − 1 |
| Maschenlinie in der Mitte | nein (Mitte der Zentralkachel) | **ja, bei W/2** |
| Verschiebung T des Bildes gegenüber Aus | 0 | **+e/2** (Wahl der Richtung: +; Spiegelung wäre ebenso zulässig) |
| Feldrand | Maschenlinie | Maschenlinie (beide Seiten ganze Maschen) |
| Randlage im Aus (ohne Netz) | unverändert | unverändert: zwei halbe Kacheln am Rand (`GRID_EDGE_PLACEMENT = 'through-edge-cells'`) |
Gesetz unverändert: `netFieldLaw(axis, n)`: `P_k = n · f(k/n)`, für gerades n symmetrisch, 087c gemessen: Knick in Kacheln 0, Rand 0 px, Trig-Symmetrie 0, Inverse ≤ 5e-13 px (Variante E3).
**Warp (alles in `core/netwarp.js`, `core/tiling.js` byte-gleich):**
- `warp.field` bekommt `{lo, hi, shift}` je Achse statt nur `hx, hy` (Altfelder bleiben für ungerade; Ungerade × ungerade bleibt byte-gleich).
- `apply(p) = p + T + d·v` mit d aus dem Feldgesetz auf `s + lo` (s = reguläre Kachelkoordinate von p). `invert(pt)`: erst T abziehen. Das Feldrechteck im **regulären** Raum (das, was `closedNetRectCorners` aus `warp.c0/v1/v2` liest) ist `[0, W] − T`; `closedNetRectCorners` und `latticeIJBoundsCovering` liefern damit genau n Kacheln je Achse (nachgerechnet: Kachelzentren i = −n/2 … n/2 − 1).
- Gerade Achsen laufen immer über den Rechteckpfad aus 086 (`h = 0, Rt = 1` für `tiling.js`), auch bei X = Y. Ungerade × ungerade X = Y bleibt auf dem alten Pfad.
- `netDomainEffective`: erlaubt gerades n von 4 bis 8 (n = 2 nur mit geometrischem Gesetz sinnvoll, Trig hat bei 2 Maschenzellen den Fixpunkt 1/2 und wirkt nicht: bleibt Einzel mit Hinweis; Obergrenze 9 gilt weiter, also gerade ≤ 8), ungerade 3..9 wie heute. Das Verhältnis ≤ 1:3 bleibt.
- Sechs Funktionen lesen `hx, hy` und müssen lo/hi/T lesen: `applyNetWarp`, `invertNetWarp`, `netWarpInsideNet`, `netWarpSplitSegment` (Schleife k von −lo+1 bis hi), `netWarpFieldLocal` (Klemmung i ∈ [−lo, hi]), `netGridLines` (Rx × Ry-Zweig; für gerades X = Y ebenfalls, Parität aus `fieldTiles`, daher keine neue Option aus `sketch.js` nötig). Fehlerherd: `netWarpTileCoords` wird mit Punkten im regulären Raum (Split) **und** im Bildraum (Inside, FieldLocal-Klick) gerufen; jede Funktion bekommt einen eigenen Test.
- Export: `fieldTiles` (Zahl oder `{x, y}`) bleibt; **additiv** `fieldBase: {x: {lo, hi}, y: {lo, hi}}` und `gridShiftPx: {x, y}` (nur bei geradem n, sonst fehlen die Felder, ungerade byte-gleich). `geometry.nodes/edges` bleiben regulär (Aus-Koordinaten); der Import in SpaceHarmony braucht `gridShiftPx` für das Bild.
- Session: `baseNetTransform` und `timeline.netStates` tragen keine Kachelzahl und kein Shift; T ist abgeleitet aus (Domäne Feld, X, Y). Kein Schema, keine Version.

**Randlage und Deckung beim Umschalten Aus ↔ Feld, gerade Achse:** das Bild springt beim Einschalten des Felds um e/2 (alles, auch Ebenen, da der Warp positionsbasiert auf alles wirkt). Das ist die Konsequenz von „Ausgitter um e/2 versetzt“. Knoten behalten ihre IDs. Hinweis im UI („Feld bei gerader Größe: das Netz liegt um eine halbe Kante versetzt“). Variante B (Aus bei geraden Größen immer um e/2 versetzen) wird nicht empfohlen: ändert alle Bilder und Baselines gerader Größen, Session-Koordinaten.
**Entscheidung 087 neu bewertet:** „Feld nur bei X, Y beide ungerade“ hatte drei Gründe: (a) Knick in der Kachelmitte (E1), (b) Netz endet nicht am Rahmen (E2), (c) Ursprungsverschiebung um e/2 würde Aus und Golden verändern (E3). (c) entfällt, weil die Verschiebung im Warp liegt und nur das Netz-Bild betrifft. Folgen, wenn gelockert: Feld wird für gerade Größen wählbar (Button, Readout, Hinweise), `sizeCompute` im Feld steigt in Einerschritten 3 … 9 (die 2 bleibt gesperrt), 5 Hinweistexte und ~8 Pins ändern sich, gerade Größen bei Dreieck und Sechseck bleiben vorerst Einzel/kein Netz.

## 2. Stufen N2a
### N2a-1 — Warp-Modell mit lo/hi/T (Typ K, Prüfstufe L2)
- **Schreiben:** `core/netwarp.js`, neuer Test `tools/grid/test-net-field-even.js`, Pins nur in eigenem Commit. **Nicht:** `tiling.js`, `faces.js`, `facecolor.js`, Golden, `sketch.js`, `ui-*.js`, die acht Funktionen. Konstante `NETWARP_FIELD_EVEN = false` (wie der Schalter 095): die Funktion ist gebaut, aber noch nicht erreichbar; der Test schaltet sie im vm ein.
- **Messgrößen** (alle 64 Paare X, Y ∈ 3..9 mit mindestens einer geraden Achse und Verhältnis ≤ 1:3; 4 Gesetze): gezeichnete Kacheln = X · Y; Segmente außerhalb des Canvas 0; Rand 0 px (Netz endet auf Canvas); Knick in Kacheln 0 (je Kachel 9 Punkte affin, < 1e-9 px); F(F⁻¹(p)) < 1e-8 px; Trig: Spiegel x, y und 180° 0 px (90° bei X = Y); Maschenlinie bei W/2 bzw. H/2 auf < 1e-9 px; Aus ↔ Feld bei w → 0: Bild = Aus-Bild um genau e/2 je gerader Achse verschoben (0 bei ungerader); Split-Kantenzug < 1e-9 px; Dots = Linienenden; Flächen: Summe = W · H; ungerade × ungerade (25 Fälle aus 086, Segmente, Export, Overlay, Warp, apply/invert/split/local) **byte-gleich zu main**.
- **Sabotagen:** (1) T fehlt (muss Knick 10–95 px zeigen); (2) hi = lo bei gerader Achse; (3) `invert` ohne T; (4) Feld mit n+1 (E2: Rand-Abstand 19–48 px).
- **Pins/Baselines/Golden:** keine Baseline (kein Layout). L1 61/57 und Golden 30/30 müssen unverändert grün sein (Golden im Browser wegen `core/`-Änderung Pflicht).
- **Aufwand/Risiko:** mittel / gering (reine Modellfunktion, Schalter aus).

### N2a-2 — Freischalten und Bedienung (Typ K, Prüfstufe L3, Browser)
- **Schreiben:** `core/netwarp.js` (Konstante an), `ui-form.js` (`sizeCompute` im Feld: Einerschritte, 2 gesperrt, ≤ 9), `sketch.js` (`applyNetKindChoice`, `netControlsSync`: nur Hinweistexte, `fieldOk` liest `netDomainEffective`; Freigabe für Änderung nötig, **nicht** die acht geschützten Funktionen prüfen/ändern ohne Rückfrage), `ui-i18n.js`, `ui-net.js`, `ui-net-readout.js`, `index.html` (`?v=`). **Nicht:** `tiling.js`, `faces.js`, `facecolor.js`, Golden.
- **UI (nichts Neues, vorher Abstimmung):** keine neuen Buttons. Feld-Button wird bei geraden Größen aktiv. Readout: „Feld: 4 × 3 Kacheln“ (vorhandener Schlüssel `net.readout.field2`). Neuer Hinweisschlüssel `note.net.fieldEvenShift` (de/en) beim Einschalten bei gerader Achse. Texte `reason.size.field.min` bleibt (Feld ≥ 3), `note.size.field` (Zweierschritt-Hinweis) entfällt für gerade/ungerade Einerschritte. Skizze:
```text
Größe 4/3, Feld an:   Readout  "Feld: 4 × 3 Kacheln"     Hinweis (einmal): "Das Netz liegt um eine halbe Kante versetzt zum Gitter."
Stepper (Schloss zu): 3 ↔ 4 ↔ 5 ↔ … ↔ 9   (heute 3 ↔ 5 ↔ 7 ↔ 9); 2 und 1: gesperrt "Feld braucht mindestens 3"
Stepper (Schloss offen, X und Y getrennt, Verhältnis ≤ 1:3): wie heute, jetzt auch gerade Werte
```
- **Messgrößen:** echte `initNetControls`/Handler im Browser (127.0.0.1): Größe 4/4, 4/3, 3/4, 6/5 im Feld: Kacheln, Overlay-Linien (`#net-lines-btn`: je Achse n+1 Linien, Mittellinie bei W/2), Klick auf Linienende trifft Knoten (Hit-Test: Klick auf gezeichneten Knoten → derselbe Knoten, 0 px), freies Ende per Klick (`netWarpFieldLocal`) liegt nach Zeichnen unter dem Klick (< 0,5 px), Konsole fehlerfrei, **Golden 30/30**, Stepper-Folge, Readout nach Größenwechsel ohne Tick (`readoutDomain`, 092), `resizeBase` 4/4 → 5/5 → 4/4 behält Feld, Hinweis nur bei 2 und 1.
- **Sabotagen:** (1) `sizeCompute` lässt 2 zu; (2) `fieldOk` liest die alte Regel (`n % 2`); (3) Readout liest `shapeSizeFactor` statt X, Y; (4) Overlay ohne Parität (Linien um e/2 falsch).
- **Pins/Baselines:** Pins ändern sich (alt → neu, je Begründung im Bericht): `test-net-field-2d` (gerade Achsen = Einzel), `test-resize-format` (6), `test-net-readout`, `test-netwarp-field`, `test-net-hints-nonet`, `test-i18n-core` (Wortlaut `fieldOddSize`), `test-ordnung-stepper` falls betroffen. Layout-Baselines (`baseline-phone-5.json`, `baseline-cleanup-11.json`): keine Änderung erwartet (kein neues Element, Prüfung mit `compare-baseline.js`, Soll 0 Unterschiede).
- **Aufwand/Risiko:** klein–mittel / mittel (viele Texte und Pins).

### N2a-3 — Folgen: Zeitleiste, Morph, Ebenen, Flächen (Typ K, Prüfstufe L3, Browser)
- **Zeitleiste:** `netAnimationCompat` behandelt `{regular:true}` heute als kompatibel zu jeder Domäne. Bei gerader Achse springt das Bild um e/2 zwischen Aus und Feld: neue Regel „gerade Achse: regulär und Feld nicht koppelbar“ (Grund sichtbar im Hinweis); `timelineNetCoupled` entsprechend. Feld ↔ Feld (zwei Specs) interpoliert wie heute (Lerp von w, focus; T gleich). Test: t = 0, 0,5, 1 bei 4/4 und 4/3.
- **Morph:** `parameterMismatch` vergleicht nur Größe und Symmetrie, T hängt nur von Größe und Domäne ab: kein neuer Code erwartet. Prüfen, ob `spatialMorphRenderDraw`/`spatialMorphRenderTileFaces` das Feldrechteck mit `latticeIJBoundsCovering` aus `warp.c0/v1/v2` lesen (gelesen in 091: ja) und bei gerader Achse n Kacheln liefern (Soll 4/4: 16, 4/3: 12). Nicht gekoppelte Netz-Snapshots: Status `netActive` unverändert.
- **Ebenen („Base sheet only“):** Ebenen laufen durch denselben Warp (positionsbasiert), `gridMatchesBase`-Ebenen bekommen Flächen wie bisher; verschobene Ebenen: Kanten werden am Kachelrand durch `netWarpSplitSegment` geknickt, mit lo/hi korrekt. Test mit einer Ebene (Versatz 0 und Versatz ≠ 0) bei 4/4.
- **Flächen:** Basisflächen exakt, weil jede Kachel affin; Messung: Farbflächen-Summe = W · H, 0 Lücken (Kontrolle mit `measure-face-artifacts` analog 096/103, Wachstum 0,3 px aus).
- **Messgrößen/Sabotagen:** (1) Compat-Regel entfernt (Sprung e/2 im Lerp sichtbar: Test misst Knotenversatz zwischen t = 0 und t = 1e-3); (2) Ebene nutzt n+1; (3) Morph liest `shapeSizeFactor` (Kachelzahl falsch); (4) Split ohne lo.
- **Aufwand/Risiko:** mittel / mittel (Zeitleiste und Morph haben viele Pins).

## 3. Modell N2b — getrennte Teilungen E1 × E2 (auf N2a)
**Definition:** Das Feld hat X × Y **Kacheln** (Musterperiode, Größe laut Stepper) und E1 × E2 **Maschen** (die Netzzellen der Quelle). Maschenzahl und Kachelzahl sind getrennt, solange E_i | X_i; die Masche ist ein Block aus (X/E1) × (Y/E2) Kacheln. Beispiel: Fläche 6 × 8 Kacheln, E = 3 × 4, W = 12: Maschen 2 × 2 Kacheln (Fig. 14: Netz 3 × 4 mit Mustern darin). Ist E_i = X_i, ändert sich nichts (heutiges Feld, N2a).
**Warp:** Spec bekommt optional `meshes: {x: E1, y: E2}` (fehlt = X, Y). `netFieldLaw(axis, n, m)`: P auf Maschenebene `E · f(k/E)`, auf Kachelebene linear dazwischen (n = E · m Grenzen). Dadurch bleibt jede Kachel affin (keine Knicke innerhalb einer Kachel, Knicke nur an Maschengrenzen = Kachelgrenzen), und `apply`, `invert`, `split` brauchen nur die längere P-Tabelle: sie rechnen schon je Kachel. `netGridLines`: Maschenlinien als `macro`, innere Kachelgrenzen als `micro` (vorhandene Stufen). Export: `fieldTiles` (Kacheln), `fieldMeshes` ist heute das Triangle/Hex-Feld (`meshes {x, y}` des Warp); für das Quadrat additiv `netMeshes: {x: E1, y: E2}` (nicht denselben Schlüssel überladen). Session: `_vNetSpec` liest `meshes` optional (fehlt = Kacheln), ältere Sessions laden unverändert; Zeitleiste: `meshes` gleich für alle Keyframes (sonst `netAnimationCompat` lehnt ab, wie `macro`).
**Bezug zu 085 N2:** 085 meinte `macroX, macroY` (verschiedene Makroteilungen in Einzel/Gekachelt). Das ist ein anderes, kleineres Thema (Geschachtelt, `spec.macro` ist ein Skalar für beide Achsen); es bleibt als **N2c** (klein, optional) und gehört nicht zu N2b.
**Grenzen laut Quelle:** Optimum W = E1 · E2 = 7–12 (Quadrate; Dreiecke 8–16 mit k = 2, Sechsecke 6–10 mit k = 1/6 laut Interpolationstabelle S. 17), Streckung höchstens 1 × 2 (S. 17). Die App begrenzt auf 1:3 und das Feld auf ≤ 9 × 9; N2b bietet das Optimum als **Hinweis** (Readout/Tooltip), nicht als Sperre (Gesetz des Optimums verwirft nach der Quelle Netze außerhalb der Grenzen; die App lässt sie zu).

### N2b-1 — Modell E1 × E2 im Warp (Typ K, Prüfstufe L2)
- **Schreiben:** `core/netwarp.js` (`netFieldLaw`, `netDomainEffective` liest E_i | X_i, ≥ 3 bzw. ≥ 4 gerade, `makeNetWarp`, `netGridLines`, `netTransformExportData`), `core/session.js` (`_vNetSpec` optional `meshes`; Freigabe nötig), neuer Test `tools/grid/test-net-meshes.js`. Schalter aus bis N2b-2 (Spec ohne `meshes` unverändert).
- **Messgrößen:** alle (X, Y, E1, E2) mit E_i | X_i, E_i ∈ 3..9 (gerade ≥ 4): Kacheln affin (Knick 0), Rand 0 px, Inverse < 1e-8 px, Maschengrenzen = P_k auf < 1e-9 px, Kacheln innerhalb einer Masche gleich breit, Trig-Symmetrie 0 px; E_i = X_i **byte-gleich zu N2a** (Segmente, Export, Overlay); Export-/Session-Roundtrip (`meshes` bleibt), alte Sessions laden.
- **Sabotagen:** (1) lineare Interpolation fehlt (Knick in Kacheln); (2) E_i teilt X_i nicht und wird zugelassen; (3) `meshes` wird in der Session verworfen; (4) Y liest E1.
- **Aufwand/Risiko:** klein–mittel / gering.

### N2b-2 — Bedienung E1 × E2 (Typ K, Prüfstufe L3, Browser; UI nach Abstimmung)
- **UI-Vorschlag (nichts gebaut):** die vorhandene Zeile `#net-macro-row` / `#net-macro-buttons` (heute im Feld ausgeblendet) zeigt im Feld die Paare (E1, E2) mit E_i | X_i als Buttons `3×4` (wie `${m}×${E/m}` bei Geschachtelt); Standard = (X, Y). Position: im Blatt `#more-netz` unter den Domänenbuttons, keine neue Leiste. Skizze:
```text
#more-netz:  [Beide|X|Y] [Einzel|Gekachelt|Feld]   Maschen: [3×4] [3×2] [6×4] [6×2] …   (nur Feld)
Readout:     "Feld: 3 × 4 Maschen (6 × 8 Kacheln), W = 12"       Hinweis außerhalb 7–12: "Quelle: 7 bis 12 Maschen"
```
- **Messgrößen:** Browser: Größe 6/8, Feld, `3×4` wählen: Overlay Maschenlinien 4 + 5, Knoten und Linien deckungsgleich (0 px), Konsole, Golden 30/30, Zeitleiste t = 0 … 1 mit gleichem `meshes`, Morph unverändert, Umschalten auf `meshes` fehlt (= X, Y) byte-gleich zu N2a.
- **Sabotagen:** (1) Button-Liste ohne Teilbarkeitsfilter; (2) Readout zeigt Kachelzahl statt Maschen; (3) `meshes` bleibt nach Größenwechsel stehen, obwohl E_i ∤ X_i (muss zurückfallen: Hinweis); (4) Overlay `micro` = `macro`.
- **Pins/Baselines:** Layout-Baselines: Zeile `#net-macro-row` im Feld sichtbar → mögliche Änderung nur im Zustand Feld (Baselines zeichnen den Standardzustand; Prüfung mit `compare-baseline.js`; ändert sich etwas, neue Datei mit `before`-Notiz laut `CLAUDE.md`). Pins: `test-net-readout`, `test-phone-config`, i18n-Schlüssel.
- **Aufwand/Risiko:** mittel / mittel (UI-Abstimmung, Phone-Layout `ui-phone-*.js` nicht im Browser/Telefon gesehen in 086–093).

## 4. Abhängigkeiten danach (nur Hinweis)
- Gerade Größen bei Dreieck und Sechseck: gleiche Verallgemeinerung lo/hi/T, aber im Rautenrahmen (T = halbe Gittervektor-Länge); die Suche nach dem kleinsten Feld (`_netTriangleField`, `_netHexField`) ist heute auf ungerade (Rx, Ry) beschränkt und könnte gerade zulassen; eigene Messung nötig (Randmaschen, Symmetrie). Voraussetzung: N2a-2 grün.
- E1 × E2 bei Dreieck/Sechseck: Maschenzahl (Dreieck k = 2, Sechseck k = 1/6; die App zählt Sechsecke, E_fein = 3 X, siehe 087c Teil 1) — Frage der Zählung vor jedem Bau.
- △N, *N, △MN, *MN: je ein Auftrag; jeweils `W = k · E1 · E2` (S. 17) als Messgröße gegen die Quelle.

## 5. Offene Fragen an den Auftraggeber
siehe `reports/104.md` Teil 4 (fünf Fragen mit Empfehlung).
