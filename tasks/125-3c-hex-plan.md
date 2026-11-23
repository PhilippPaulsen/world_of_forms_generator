# Auftrag 3C-4 — Möbiusnetz am Sechseck (*N), PLAN (Typ K, Prüfstufe L2) — aus Messung 125

Grundlage `reports/125.md`. **Nichts gebaut, auf Freigabe warten.** Wie Plan 124 (dort die Einzelheiten); hier die Unterschiede. Nicht mergen, nicht pushen, `docs/quellen/` nie committen, nur explizite `git add`-Pfade.

## 1. Modell
Homographie unverändert (`_projPx`, `_projPQ`). Familie `*N`, k = 1/3, W = (b²−a²)/6 (ganz), /12 (halb). Kachel = Sechseck; Gitter (p, q) = (s, t) im Rahmen {c0 = Schwerpunkt, v1 = f1, v2 = f2} von `_netHexField`. Auslassregel: Nebenklasse `cls` ∈ {0, 1, 2} des Index-3-Untergitters, Sechseckmitte (i0, j0) mit i0 − j0 ≡ cls; Variante A (Baren, wie 124). Format: ganz zuerst, halb zweite Stufe. a ≥ 2, b ≤ 12 (UI-Vorschlag b ≤ 9). Bei a ≥ 2 keine singuläre Kachel.

## 2. Kern (`core/netwarp.js`, Freigabe nötig)
| Stelle | Änderung |
|---|---|
| `netProjectiveFamilyFor`, `netProjectiveForShape`, `netProjectiveEffective` | Form `hex` → Familie `*N`; Grund „the hexagon lacks the omission rule“ (Z. 878) entfällt |
| `netProjectiveSpec(a, b, format, family, cls)` | fünfter Parameter, Standard 0; Quadrat und Dreieck byte-gleich |
| `netWarpForBase` | Zweig `shape === 'hex'`, 6 Ecken: Rahmen {Schwerpunkt, f1, f2}; `refineFaces` nicht setzen |
| `_netProjEditTile` | Sechseck mit Mitte ≡ cls, größte Fläche im Gebiet, Tiebreak Nähe zur Bildmitte; (i0, j0) = Mitte |
| `_netProjLocal`, Treffertest | Klick → (p, q) → nächste Sechseckmitte der Klasse → lokale Koordinaten zur Mitte |
| `_netProjTileOutside` | 6 Ecken; ganz außen: vmax ≤ a, vmin ≥ b, pmax ≤ 0, qmax ≤ 0 (halb dmax ≤ 0); Randsechsecke werden gezeichnet, der Canvas schneidet |
| `netProjectiveInfo` | W = Summe der Flächenanteile; Streckung (Bericht 125 §4, als Auslegung gekennzeichnet) |
| `_netProjGridLines` | Overlay: Wabenkanten je cls (nicht das volle Dreiecksgitter) |
| `_netProjExportData`, `netTransformFromExport` | `family: '*N'`, `cls`, `tileShape: 'hexagon'`, Text `facesMapping`; Version 2 |
| `_netProjCompat`, `netSpecSnapshot` | Familie **und** cls gleich; **Zusatzbefund:** beim Aufnehmen Familie per `netProjectiveForShape` an die Form anpassen (behebt „family differs“ bei veraltetem `family`) |
| Zeitleiste | *N ↔ *N nur bei gleichem cls (a, b linear), sonst Grund „the 3C omission class differs“ |
`core/session.js` (`_vNetSpec`, Freigabe nötig): `family` ∈ {□N, △N, *N}, `cls` ganzzahlig 0 bis 2, nur bei *N. Keine Schema-Erhöhung.

## 3. UI (`ui-net-art.js`, `ui-i18n.js`; `ui-net.js` nur falls ein Test es verlangt)
`AVAIL.n3c.hex` → frei; `suggest('hex')`: W 6 bis 10, Streckung ≤ 2, b ≤ 9, a ≥ 2; Vorschläge ganz: 1:1 3,8 · 3,7; 3:2 4,8 · 3,7 · 5,9; 2:1 5,9 · 5,8 · 4,8 · 6,9; 3:4 2,7 · 2,8; 1:2 keiner. Halb: sichtbar, gesperrt mit Grund (erste Stufe). Klassenwahl cls: kleine Wahl „symmetrisch / unsymmetrisch (links, rechts)“ nur nach Ihrer Freigabe, sonst fest 0. Schlüssel DE/EN; `net.art.reason.n3c.hex` entfällt; `tools/ui/test-netz-i18n-keys.js` deckt neue Schlüssel (Quadrat, Dreieck, Sechseck).

## 4. Dateien (je Zeile)
| Datei | Rolle |
|---|---|
| `core/netwarp.js`, `core/session.js` | schreiben, Freigabe nötig |
| `ui-net-art.js`, `ui-i18n.js` | schreiben; `ui-net.js` nur bei Testbedarf |
| `index.html`, `gallery.html`, `color-harmony/ui/index.html` | `?v=` gemeinsam |
| neu `tools/netwarp/test-netwarp-projective-hex.js`, `tools/netwarp/verify-3c-hex.browser.js` | Tests |
| `core/tiling.js`, `faces.js`, `facecolor.js`, `spatial-morph-render.js`, `export.js`, `sketch.js`, Off-Path-Golden, Baselines, `gallery/` | **unverändert** |
Erwartete Pins (alt → neu): `test-netart-model` (Sechseck frei), `test-netwarp-projective` und `-triangle` (Sechseck-`null` und Kerngrund), die „core unchanged“-Tests führen netwarp/session schon in der Ausnahmeliste.

## 5. Testplan
Harness gegen `tools/grid/measure-3c-hex.js`: (1) W je (a, b, cls) = Formel; (2) 20 000 Strecken, Netz- und Sechseckkanten ≤ 1e-9 px; (3) Wabe = Auslassregel (Mitten fehlen, Valenz 3); (4) Bearbeitungskachel Mitte ≡ cls, Klick → Bild; (5) Gültigkeit (a ≥ 2, halb zunächst abgelehnt); (6) Zeitleiste inkl. veraltetem `family`; (7) Export-Rundlauf, Session; (8) Off-Path byte-gleich zu main (Quadrat-, Dreieck-3C, Sechseck-Feld); (9) Figurenvergleich 165 (cls 1) und 166 (halb, cls 0) ≥ 80 %.
Sabotagen (≥ 5, je rot): falsche Klasse; cls ignoriert; `_netProjTileOutside` ohne vmax ≤ a; `*N` im Validator fehlt; Zeitleiste ignoriert cls; Snapshot ohne Formanpassung; `AVAIL.n3c.hex` gesperrt; Schlüssel fehlt.
Browser (DE und EN, Konsole fehlerfrei): Netzart → 3C am Sechseck, a/b/cls, Flächenfüllung 3,7 bei 1:1, Treffertest, Export JSON/SVG, Session, Zeitleiste, Stichprobe Quadrat/Dreieck. Golden 30/30 (FNV `58f7a972`). Frame-Zeit: Median über 20 `redraw()` bei 3,7 und 5,9, Stopp bei > 2 × Sechseck-Feld. `bash tools/guard.sh main` (FAIL nur netwarp, session erwartet), `bash tools/proof.sh L2 NNN`.

## 6. Aufwand, Risiko, Commits
Kern M (Bearbeitungskachel, Treffertest an Sechseckmitten), Export/Session S, Zeitleiste S, UI S–M, Browser/Bericht M. Risiko mittel. Commits: Plan; Test-Gerüst (rot); Kern; Export/Session/Zeitleiste; UI; Pins; `?v=`; Dokumentation; Bericht.

## 7. Offene Fragen an Sie
1. a ≥ 2 (Standard) oder a = 1 nur für cls = 0 (rechnerisch sicher)?
2. Nebenklassen in der UI wählbar oder fest 0? (Fig. 165 der Quelle zeigt cls 1.)
3. Variante B (Fächer aus T1, Fig. 167) später? Sie fehlt auch am Dreieck.
4. Halbes Format in der ersten Stufe gesperrt (Brauchbarkeit gering) oder gleich mit?
5. Streckungsmaß am Sechseck (Auslegung) und W-Bereich 6 bis 10 einverstanden?
6. Zusatzbefund (veraltetes `family`) im selben Bau beheben oder als eigener kleiner Auftrag?
