# Auftrag 128 — 3C: halbes Format für Sechseck und Dreieck — PLAN (Typ K, Prüfstufe L2)

Branch `task/128-3c-halb` von main `c8e35a20` (Merge 127). **Nur dieser Plan und das Messskript `tools/grid/measure-3c-half.js` (liest `core/`, ändert nichts); nichts gebaut, auf Freigabe warten.** Nicht mergen, nicht pushen, `docs/quellen/` nie committen. `/usage`: Woche **99 %** beim Schreiben (die Stoppgrenze 98 % ist überschritten; auf Ihre Anweisung bis hierher, dann Stopp). Rohausgabe: `node tools/grid/measure-3c-half.js`.

## 0. Kurzfassung
1. **Halb geht an beiden Formen sauber, ohne neues Abbildungsstück.** Mit nur zwei im Speicher entfernten Gültigkeitszeilen (`netProjectiveEffective`: `tri`-Halb und `hexa`-Halb) liefern Linien, Flächen, W, Treffertest und Bearbeitungskachel an Sechseck (cls 0, 1, 2) und Dreieck dieselben exakten Ergebnisse wie im ganzen Format (Tabelle 1). Der Canvas-Schnitt an der Mittelachse genügt.
2. **Der Grund der Sperre in 124 war eine Entwurfsentscheidung, kein mechanisches Hindernis:** dort ruht der Rand beim ganzen Dreieck auf Dreieckskanten; die Mittelachse p = q tut es nicht (Messung 120/3, „T1-Rand p = q liegt NICHT auf einer Dreieckskante“). Dasselbe gilt schon beim Quadrat (Diagonale), und dort ist halb seit 121 gebaut. Der Grund gilt für den Bau nicht mehr.
3. **Streckung:** Die Quellfigur 166 hat 2,42, Fig. 161/162 haben 1,47 (selbes Maß wie die UI). Ein Richtwert „≤ 2“ lässt am Sechseck halb fast nichts zu; Vorschlag: Richtwert **≤ 2,5** für halb am Sechseck, **≤ 2** am Dreieck (Abschnitt 3). Entscheidung bei Ihnen.
4. **Zusatz b) ist geklärt:** Das Sechseck-Raster „3:2“ hat den Canvas **779 × 600** (B:H 1,30, `gridWidth`/`gridHeight`, `core/forms.js:94–`), nicht 1,5. Dort liefert `netProjectiveInfo` für 3,7 / 3,8 / 4,8 die Streckung 1,47 / 1,85 / 1,90 (≤ 2: Vorschläge **3,7 · 3,8 · 4,8**, genau was Sie sehen); bei B:H 1,5 (Bericht 127) wären es 1,70 / 2,13 / 1,64 und 5,9 1,8. Bericht 127 rechnete mit 900 × 600 statt dem wirklichen Canvas.

## 1. Machbarkeit (gemessen)
Kern im Speicher freigegeben (zwei Zeilen), 600 × 900 bzw. 600 × 600, `drawTessellation` ohne und mit Flächen:
| Form | a,b,cls | Linien | Flächen (größte Koordinate) | W gezählt = Formel | Treffertest (Klicks, schlecht, größte Abweichung) | Bearbeitungskachel im Gebiet |
|---|---|---|---|---|---|---|
| Sechseck | 3,9,0 | ok (1948) | ok (1575 px) | 6 = (b²−a²)/12 | 335, 0, 3,6e-13 | ja |
| Sechseck | 3,9,1 / 3,9,2 | ok | ok (1575 px) | 6 | 410 / 226, 0, 3,4e-13 | ja |
| Sechseck | 4,8,0 · 2,7,1 | ok | ok (1000 / 1500 px) | 4 · 3,75 | 306 / 378, 0 | ja |
| Dreieck | 3,6 (Fig. 161/162) | ok (538) | ok (900 px) | **13,5** = (b²−a²)/2 | 268, 0, 4,7e-13 | ja |
| Dreieck | 2,6 · 2,4 · 1,3 | ok | ok | 16 · 6 · 4 | 377 / 210 / 180, 0 | ja |
„Linien ok“: alle endlich, im Canvas, jede = Bild ihres exakten Schnitts (Senke, `_netProjCut` schneidet auch an p = q). „Flächen ok“: alle Koordinaten endlich, alle Kanten exakte Sehnen. Abweichungen beim Treffertest: Klick → freier Punkt in der nächsten Kachel → durch den Kachel-Versatz zurückgezeichnet.
**Wo der Canvas-Schnitt nicht genügt, wurde nichts gefunden;** zu prüfen bleiben im Bau nur: (a) Flächenfüllung angeschnittener Kacheln im Browser (Polygone reichen über die Schnittkante, der Canvas schneidet; wie am Rand des ganzen Formats), (b) das Overlay (`_netProjGridLines` schneidet mit `_projPlanes` inklusive p ≥ q, also exakt), (c) Knoten an der Schnittkante: ein Knoten der Bearbeitungskachel kann nur im Gebiet geklickt werden (`netWarpInsideNet` verlangt p ≥ q), ein halb angeschnittener Knoten wird in den Nachbarkacheln gezeichnet wie am Rand des ganzen Formats.

## 2. Abgleich mit der Quelle
- Fig. 166 (Sechseck 3,9 halb, Variante A, cls 0): Pixelvergleich aus 125 (`measure-3c-hex-bild.js`) 82,5 % gegen 61,1 % des zweitbesten; im Bau gegen die Kern-Overlay-Linien wiederholen (wie 127 Prüfung 10).
- Fig. 161/162 (Dreieck 3,6 halb): W 13,5 ✓ (Zählung oben). Pixelvergleich der Dreiecksfiguren gibt es noch nicht; im Bau mit demselben Verfahren aus `measure-3c-hex-bild.js` (Rahmen von Hand lesen) ergänzen; Fig. 162 ist die zweite Lösung (Variante B, bleibt außerhalb).
- W je (a, b, cls) = Formel: für alle c identisch (Flächenanteile); Prototyp-Abweichung (Kante gegen Gerade) ≤ 1e-9 px wird im Harness geprüft wie in 127.

## 3. Streckung und Vorschläge für „halb“
Streckung der Quellfiguren mit dem UI-Maß: Fig. 166 **2,42** (Sechseck-Maß 2,42, fein 2,36; B:H 0,71), Fig. 161/162 **1,47** (B:H 0,71). Beste Verhältnisse: Sechseck 3,9 bei B:H 0,48 (1,64), Dreieck 3,6 bei 0,8 (1,31).
**Sechseck halb**, W im Optimum (6 bis 10; W ist der Wert der halben Fläche, wie in der Quelle „W/2“), b ≤ 9: nur 3,9 (W 6) und 2,9 (W 6,42) erreichen W ≥ 6; Streckung ≤ 2 trifft nur 3,9 bei 1:2. Deshalb zwei Varianten zur Entscheidung: **(A) W-Bereich für halb 3 bis 10** (die Hälfte von 6 am unteren Ende) und Streckung ≤ 2,5, b ≤ 9; **(B)** b bis 12 zulassen. Zahlen (cls 0, W 3 bis 10, Streckung ≤ 2,5), Canvas 1:2 = 520 × 1200, 3:4 = 520 × 800, 1:1 = 600 × 600, 3:2 = 779 × 600, 2:1 = 1039 × 600:
| Verhältnis | b ≤ 9 | b ≤ 12 |
|---|---|---|
| 1:2 | 3,9 (6; 1,8) · 3,8 (4,58; 1,92) · 3,7 (3,33; 2,1) | 3,10 (7,58; 1,73) · 3,9 · 3,8 · 3,11 (9,33; 1,98) |
| 3:4 | 3,7 (3,33; 1,47) · 4,9 (5,42; 1,71) · 3,8 · 4,8 | 3,7 · 5,12 (9,92; 1,59) · 4,10 (7; 1,67) · 5,11 (8; 1,7) |
| 1:1 | 5,9 (4,67; 1,37) · 5,8 (3,25; 1,6) · 4,8 (4; 1,7) | 5,9 · 7,12 (7,92; 1,41) · 6,11 (7,08; 1,43) |
| 3:2 | 5,8 (3,25; 1,33) · 6,9 (3,75; 1,37) · 5,9 (4,67; 1,78) | 7,11 (6; 1,28) · 5,8 · 8,12 (6,67; 1,35) |
| 2:1 | 6,9 (3,75; 1,48) · 5,8 (3,25; 1,77) | 8,11 (4,75; 1,24) · 7,10 (4,25; 1,27) · 9,12 (5,25; 1,35) |
Mit dem strengen Bereich (W 6 bis 10, Streckung ≤ 2) gibt es für cls 0 nur 1:2 → 3,9 (1,8); bei 3:4, 1:1, 3:2, 2:1 keinen Vorschlag. cls 1 und 2 (nur zur Information): 1:2 cls 2 wie cls 0 (3,9; 1,8), cls 1 erst bei ≤ 2,5 (3,9; 2,25); sonst gleich leer.
**Dreieck halb** (W 8 bis 16, a ≥ 1, b ≤ 9, Streckung ≤ 2), Canvas 1:2 = 600 × 1039, 3:4 = 600 × 693, 1:1 = 600 × 600, 3:2 = 900 × 520, 2:1 = 1200 × 520: 1:2 → 2,5 (10,5; 1,43) · 3,6 (13,5; 1,8) · 2,6 (16; 1,89); 3:4 → 3,6 (13,5; 1,42) · 3,5 (8; 1,5) · 4,6 (10; 1,85); 1:1 → 3,5 (8; 1,3) · 4,6 (10; 1,6) · 3,6 (13,5; 1,64) · 5,7 (12; 1,89); 3:2 → 5,7 (12; 1,14) · 6,8 (14; 1,26) · 4,6 (10; 1,42) · 7,9 (16; 1,43) · 3,5 (8; 1,87); 2:1 → 7,9 (16; 1,1) · 6,8 (14; 1,28) · 5,7 (12; 1,52) · 4,6 (10; 1,89). Das Dreieck braucht keinen eigenen Richtwert (Quelle 1,47 ≤ 2).

## 4. Kern, UI, Session, Export, Zeitleiste (nur was „halb“ freigibt)
| Stelle | Änderung |
|---|---|
| `core/netwarp.js` `netProjectiveEffective` | die beiden Zeilen `tri && spec.format !== 'full'` und `hexa && spec.format !== 'full'` entfallen (Quadrat bleibt); sonst Gültigkeit unverändert (a, b, cls) |
| `netProjectiveInfo` | keine Änderung nötig (Sechseck- und Dreieckzweig lesen `planes` mit `half`; gemessen) |
| `_netProjEditTile`, `_netProjTileOutside`, `_netProjLocal`, `_netProjGridLines` | unverändert (kennen `half`; gemessen) |
| `_netProjExportData` | `format: 'half'` wird schon geschrieben; Text `homography.note` kennt „p ≥ q“; nur prüfen |
| `_netProjCompat` | halb ↔ ganz bleibt abgelehnt (vorhandener Grund „format differs“), halb ↔ halb mit a, b linear |
| `core/session.js` `_vNetSpec` | keine Änderung (△N halb wird seit 124 angenommen; `*N` halb ebenso) |
| `ui-net-art.js` | `LIM.triangle.formats` und `LIM.hex.formats`: `['full', 'half']`; je Form eigener W-Bereich und Streckungs-Richtwert für halb (`wLo`, `wHi`, `stretchMax` je Format); `formatAvail` liefert dann immer OK; `HINTS.triHalf`/`hexHalf` und `invalidHint`: der Zweig entfällt (ein Rest-Fall: ungültig aus anderem Grund bleibt `aMin`/`other`); `suggest` je Format |
| `ui-i18n.js` | Schlüssel `net.art.reason.n3c.triHalf`, `…hexHalf`, `net.3c.invalid.triHalf`, `…hexHalf`, `…short.triHalf`, `…short.hexHalf` entfallen (mit Tests); Warntext für den Richtwert „halb“ ggf. neu (DE/EN) |
Formwechsel: ein halbes Spec gilt an allen drei Formen (Quadrat, Dreieck, Sechseck); beim Wechsel Dreieck/Sechseck → bleibt halb. Die Familie wird beim Lesen und beim Aufnehmen (127) umbenannt.

## 5. Zusätze (eigene Commits)
**a) Tooltip nach Sprachwechsel.** Ursache (belegt am Befund 127, Fundstellen): `UI.setLang` → `applyI18n` (`ui-i18n.js:620–639`, `applyEl`) schreibt `title` und `aria-label` des Format-Knopfs aus `data-i18n-title`/`-label` neu; der Grund steht dort nur, solange `UI.setDisabled(bt, reason)` (`ui.js:202–209`, aufgerufen in `ui-net.js:234`) nach dem Sprachwechsel noch einmal läuft; das tut es nur beim nächsten Neuzeichnen/Sync, nicht beim Sprachwechsel selbst. Kleinster Fix (im Bau zu bestätigen): nach `setLang` den Netz-Sync einmal auslösen (die vorhandene Sprachwechsel-Stelle in `ui-net.js`, `langNow()` im Sync-Zeichen `sig`, Zeile 246), Test: Sprache wechseln, Tooltip = Grund in der neuen Sprache. Nach dem Bau von (1) bis (4) gibt es keinen gesperrten Format-Knopf mehr; dann prüfen, ob andere gesperrte Knöpfe denselben Fehler haben (z. B. a/b-Stepper-Chevrons an den Grenzen, `data-reason-bound`) und melden.
**b)** erledigt (0, Punkt 4).

## 6. Dateien (je Zeile)
`core/netwarp.js` (zwei Zeilen, **Freigabe nötig**, begründet: Gültigkeit), `core/session.js` unverändert, `ui-net-art.js`, `ui-i18n.js`, `ui-net.js` (nur Zusatz a), `index.html`/`gallery.html`/`color-harmony/ui/index.html` (`?v=` gemeinsam). Unverändert: `core/tiling.js`, `faces.js`, `facecolor.js`, `spatial-morph-render.js`, `export.js`, Off-Path-Golden, Baselines, `gallery/`, `sketch.js`. Erwartete Pins (alt → neu): `test-netwarp-projective-triangle.js` 5b (halb am Dreieck abgelehnt → gültig), S3, `test-netwarp-projective-hex.js` 7b und S7, `test-netart-model.js` (3e, 4c/5f, `formatAvail`), `test-netz-grund.js` (triHalf/hexHalf), `test-netz-i18n-keys.js` (entfallende Schlüssel). Baselines: kein Fall erfasst 3C halb am Sechseck/Dreieck; nur Vermerk in `docs/baselines.md`, keine Aufnahme.

## 7. Testplan
Harness (`test-netwarp-projective-hex.js`, `-triangle.js` erweitert, halb): Linien, Flächenkanten ≤ 1e-9, W-Zählung je (a, b, cls), Inverse, Klick → Bild an der Schnittkante (Klicks nahe p = q), Export-Rundlauf mit `format: 'half'`, Zeitleiste halb ↔ halb ok, halb ↔ ganz abgelehnt, Off-Path byte-gleich zu main. Sabotagen ≥ 5, je rot: halb am Dreieck wieder gesperrt; Hälfte der Fläche (`dmax`-Zweig in `_netProjTileOutside` entfernt); Bearbeitungskachel ohne Halbebene (`planes` ohne `half`); W zählt ganz statt halb; Zeitleiste lässt halb ↔ ganz zu; Vorschlag ohne eigenen Richtwert. Browser (echte Bedienung am Sechseck und Dreieck, halb: Flächenfüllung, Treffertest nahe der Schnittkante, Export JSON/SVG, Session, Zeitleiste halb ↔ halb, Formwechsel in beide Richtungen mit halbem Spec, DE und EN, Telefon 375 und 320 px, Konsole fehlerfrei, Fotos `reports/128-bilder/` nicht committen). Golden 30/30 und Frame-Zeit wie 127; Server wie 127 (Nutzer startet ihn, Port nennen).

## 8. Aufwand, Risiko, Commits
Kern S (zwei Zeilen), UI M (Richtwerte je Format, Vorschläge, Texte entfallen), Zusatz a S, Browser/Bericht M. Risiko gering (Kern gemessen), mittel bei der UI-Tabelle. Commits: Plan/Messung; Test-Gerüst rot; Kern; UI-Modell und Texte; Pins; Zusatz a (Test rot, Fix); `?v=`; Doku (`ROADMAP.md`, Claude.md); Bericht.

## 9. Offene Fragen an Sie
1. **W-Bereich und Richtwert für halb am Sechseck:** (A) W 3 bis 10, Streckung ≤ 2,5, b ≤ 9; (B) wie A mit b ≤ 12 für halb; (C) streng (W 6 bis 10, Streckung ≤ 2: nur 1:2 → 3,9). Standard dieses Plans: (A).
2. Am Dreieck halb den Bereich W 8 bis 16 und Streckung ≤ 2 behalten (Standard)?
3. Klassen cls 1 und 2 bleiben in der UI vorerst fest 0 (Auftrag 127), auch bei halb?
4. Zusatz a: Fix in `ui-net.js` (Sync beim Sprachwechsel) oder allgemein in `UI.setLang` (`ui.js`/`ui-i18n.js`, betrifft alle gesperrten Knöpfe)?

## Nicht geprüft
Pixelvergleich der Dreiecksfiguren 161/162; Flächenfüllung und Overlay im Browser (nur die Zahlen im Speicher); ob die Zusatz-a-Ursache genau so liegt (Fundstellen gelesen, Sprachwechsel-Hook nicht); Frame-Zeit halb.
