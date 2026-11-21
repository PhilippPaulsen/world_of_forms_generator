# Auftrag 117 — Animationsexport, Stufe 3: SVG-Folge (Plan, Typ K, Prüfstufe L3) — ENTWURF, wartet auf Freigabe

Branch `task/117-anim-export-svg` von main `45d45557` (Merge 116). Grundlage: `tasks/114-animationsexport-plan.md` (Stufe 3), `reports/114.md`, `reports/115.md`, `reports/116.md`, `core/anim-export.js`, `runAnimationExport` in `sketch.js`. **Bisher nichts gebaut.** Geschrieben nur dieser Plan, die Messskripte `tools/anim/measure-svg-frames.browser.js` (neu) und die Modi `noface`, `clip` in `tools/anim/measure-anim-export.js`; Rohdaten `reports/logs/117-*.txt` (nicht committet). Entscheidungen des Nutzers aus 114 und die Regeln aus 116 gelten unverändert (kein `/* */` in `sketch.js`; das Wort `spatialMorph` dort nur in den zwei erlaubten Blöcken; acht Funktionen und `draw()` byte-gleich; Pins in eigenem Commit; `?v=` gemeinsam).

## 0. Kernaussage
1. **„Ohne Flächen“ braucht keine Änderung in `core/export.js`.** Der Schalter sind die vorhandenen Flags: `showFaces` der Basis und `showFaces` jeder Ebene (die Keyframes und die Wiedergabe-Ebene folgen ihnen, `core/tiling.js:218`; der Raum-Morph fragt dieselben Flags, `core/spatial-morph-render.js:232`). Der Treiber setzt sie für den Aufruf von `generateSVGString()` auf `false` und im `finally` zurück. **Gemessen: das SVG ist dann Byte für Byte das SVG mit Flächen ohne die Gruppe `<g stroke="none">…</g>`** (6 von 6 Fällen in der Node-VM, 6 von 6 im Browser, 24 Frames), und die Flächen werden gar nicht erst berechnet (Zeit und Größe sinken, Abschnitt 2). `core/export.js` bleibt **unverändert**; eine Freigabe dafür ist **nicht** nötig.
2. **Ein SVG-Frame braucht kein `redraw()` und keine Leinwand.** `setTimelineProgress(t)` + `generateSVGString()` ist dasselbe SVG wie mit `redraw()` dazwischen (geprüft in 6 Szenen). Damit entfallen Pixeldichte und `toBlob`; das Größenfeld 1×/2× gilt nur für PNG.
3. **Zeit je Frame im Browser** (Sechseck 9/9 Feld, 0 / 3 / 5 Ebenen mit Flächen): 0,14 / 0,30 / 0,47 s plus 0,09 / 0,16 / 0,21 s Deflate. Die Node-Werte aus 114 (bis über 2,5 s) waren die obere Schranke der VM; im Browser wird die Stoppgrenze 2,5 s nicht erreicht.
4. **Größe**: roh 11 bis 54 MB je Frame im Sechseck-Feld, **gepackt (Deflate) 1,6 bis 3,4 MB** (Faktor 8 bis 16); ohne Flächen gepackt 0,5 bis 1,4 MB. Die Grenze 500 MiB gilt für das ZIP, also für die **gepackte** Größe. Mit 5 Ebenen und Flächen passen etwa 145 Frames, ohne Flächen die vollen 300.
5. **Eine kleine Freigabe in `core/anim-export.js`**: `add(name, bytes, handle)` verbietet das Handle bei `deflate` (116); für die SVG-Folge soll das Handle auch bei Deflate gelten (das Handle ist dann ein Blob der **gepackten** Bytes), damit die gepackten Frames nicht im JS-Haufen liegen (Abschnitt 5, Frage 3).
6. **Befund Beschneiden (nicht bauen):** 45 bis 86 % der Bytes eines Frames stehen in Elementen, die **ganz außerhalb** der Leinwand liegen (Abschnitt 2.3). Ein Beschneiden würde die rohe Größe im Sechseck-Feld etwa halbieren bis dritteln. Es ist eine eigene Stufe (Empfehlung: später, nach Rückmeldung zu dieser).

## 1. Fundstellen (Stand main `45d45557`)
| Was | Stelle |
|---|---|
| SVG-Erzeugung | `generateSVGString()` `core/export.js:493`; Flächen über `_svgCollectFacePolygons()` `:461` (tauscht `fill`/`vertex`/`endShape`, ruft `drawTessellation()`), Linien über `svgPathCollector` (`core/state.js:186`); Hintergrund aus `--panel-bg-color`; Breite/Höhe = `width`/`height` (CSS-Pixel, unabhängig von der Pixeldichte) |
| Flächen-Gates | Basis: `showFaces` `core/tiling.js:62`; Ebenen: `layerShowsFaces` `:218` (Wiedergabe-Ebene: alle Keyframes `showFaces`); Raum-Morph: `core/spatial-morph-render.js:232` |
| Nicht im SVG | Netz-Überlagerung `drawNetLinesOverlay` (`sketch.js:4435`, Anzeigehilfe `netLinesOn`, standardmäßig aus; „Not exported; a PNG export includes it“); die Querschichten-Flächen (`crossLayerFillBuffer`, in `draw()`, nicht in `drawTessellation()`) |
| Treiber (PNG) | `runAnimationExport` `sketch.js` (Dateiende): Vorprüfung, Schätzung, Zustand sichern, Ruhe abwarten, Dichte, Frame-Schleife, ZIP, Download, Zustand zurück; `animExportEnv`, `animExportRefresh`, `animExportStart`, `animExportInit` |
| Bausteine | `core/anim-export.js`: `animFrameTimes`, `animFrameName(i, n, ext)` (Endung `svg`), `animZipWriter({method:'deflate', deflate})` (die Kompression wird übergeben), `animExportEstimate`, `animExportLimits` |
| Dialog | `index.html` `#export-anim` (Zeile „Format“ heute Text „PNG-Folge (ZIP)“), `style.css` `.export-anim*`, `ui-i18n.js` `export.anim.*` |

## 2. Messung
Skripte: `tools/anim/measure-svg-frames.browser.js` (Browser: Quadrat/Sechseck, Zeitleiste/Morph, 0/3/5 Ebenen, Flächen an und über Flags aus, `CompressionStream('deflate-raw')`, `DOMParser`), `node tools/anim/measure-anim-export.js noface|clip` (Node-VM).
### 2.1 Flächen aus, über die Flags (Frage 1)
| Fall (Node-VM) | mit Flächen ms / KB | Flags aus ms / KB | Polygone | gleich „mit Flächen minus Gruppe“ |
|---|---|---|---|---|
| Zeitleiste Quadrat 3/3 | 1 / 31 | 1 / 31 | 0 | **ja** |
| Raum-Morph Quadrat 3/3 | 9 / 138 | 3 / 31 | 1210 | **ja** |
| Raum-Morph Quadrat 3/3, Feld-Netz | 2 / 10 | 1 / 3 | 90 | **ja** |
| Sechseck 4/4 Feld, 3 Ebenen, Zeitleiste | 1052 / 20 360 | 638 / 11 002 | 105 925 | **ja** |
| Sechseck 4/4 Feld, 3 Ebenen, Raum-Morph | 979 / 9510 | 224 / 2389 | 78 640 | **ja** |
| Sechseck 8/8 Feld, 3 Ebenen, Raum-Morph | 1875 / 21 652 | 449 / 4951 | 186 714 | **ja** |
Im Browser (Sechseck 9/9 Feld, Median über 4 Frames; `redraw` nicht nötig, jede SVG als XML gültig, „Flags aus = mit Flächen minus Gruppe“ in allen):
| Szene | mit Flächen: ms / roh MB / gepackt MB / Deflate ms | ohne Flächen: ms / roh MB / gepackt MB | Polygone |
|---|---|---|---|
| 0 Ebenen, Zeitleiste | 140 / 15,8 / 1,9 / 89 | 84 / 8,3 / 0,87 | 86 832 |
| 3 Ebenen, Zeitleiste | 298 / 36,5 / 2,7 / 155 | 282 / 24,7 / 1,25 | 136 728 |
| 5 Ebenen, Zeitleiste | 471 / 54,1 / 3,4 / 209 | 306 / 36,1 / 1,44 | 209 304 |
| 3 Ebenen, Raum-Morph | 117 / 10,9 / 1,6 / 74 | 51 / 4,1 / 0,54 | 78 078 |
| Quadrat 3/3, Zeitleiste / Raum-Morph | 11 / 1,2 MB, 4 / 0,37 MB | 5 / 0,48, 1 / 0,10 MB | 8 712 / 3 025 |
Bemerkung: „ohne Flächen“ spart im Sechseck-Feld mit Ebenen **Größe** (gepackt 2,2 bis 2,6×) und im Morph auch **Zeit** (2,3×); bei der Zeitleiste mit 3 Ebenen kaum Zeit (282 gegen 298 ms: die Linien der Ebenen dominieren).
### 2.2 Deckel (Frage 2)
Mit 5 Ebenen und Flächen (3,4 MB gepackt je Frame) passen unter 500 MiB etwa **145 Frames**, mit 3 Ebenen etwa 185, ohne Flächen (1,4 MB) die vollen 300. Die Schätzung (Abschnitt 3) nennt die Zahl, der Dialog sperrt „exportieren“ mit der Meldung, kein Abbruch mitten im Lauf.
### 2.3 Beschneiden (Frage 4, nur Befund)
Elemente, deren Rechteck **ganz außerhalb** der Leinwand liegt (Node-VM):
| Fall | Leinwand | Polygone außen / gesamt | Pfade außen / gesamt | Anteil der Bytes außen |
|---|---|---|---|---|
| Zeitleiste Quadrat 3/3 | 600² | 0 / 0 | 507 / 605 | 83 % |
| Raum-Morph Quadrat 3/3 | 600² | 1054 / 1210 | 503 / 605 | 86 % |
| Sechseck 4/4 Feld, 3 Ebenen, Zeitleiste | 600² | 25 768 / 105 925 | 191 719 / 204 000 | 62 % |
| Sechseck 4/4 Feld, 3 Ebenen, Raum-Morph | 600² | 40 540 / 78 640 | 38 197 / 40 800 | 62 % |
| Sechseck 8/8 Feld, 3 Ebenen, Raum-Morph | 600² | 61 994 / 186 714 | 72 810 / 82 800 | 45 % |
Die Randkacheln der Kachelung stehen im SVG (die Leinwand beschneidet nur beim Anzeigen). Entfernen der ganz äußeren Elemente ändert das sichtbare Bild nicht (Striche an der Kante: Strichbreite mitrechnen). **Nicht gebaut, nicht geprüft:** die Wirkung auf die gepackte Größe (Deflate packt Wiederholungen ohnehin gut, der Gewinn wird kleiner sein als die rohen Prozent), die Zeit des Beschneidens, ob die Auswahl besser beim Erzeugen als danach liegt (Nachbearbeitung eines 50-MB-Strings ist so teuer wie das Erzeugen). Empfehlung: eigene Stufe 4 oder gar nicht, je nach Rückmeldung zur gepackten Größe.

## 3. Treiber und Größenschätzung
**`runAnimationExport(env, opts)` bekommt `opts.format: 'png' | 'svg'` (Standard `png`, das PNG-Verhalten bleibt Zeile für Zeile).** Bei `svg`:
1. Vorprüfung wie bisher (`noTimeline`, `unresolved`, `otherClockPlaying`, `static`) plus `noCompression`, wenn `env.deflate` fehlt (Browser ohne `CompressionStream`: Meldung, kein Export).
2. Schätzung vor dem Start über **einen Probeframe**: `env.probeSvg(noFaces)` erzeugt das SVG des **gezeigten** Zustands (kein `setTimelineProgress`, kein Zustandswechsel), packt es und liefert `{raw, packed, ms, polygons}`; `animExportEstimate({frames, bytesPerFrame: packed})` prüft Deckel (300 Frames, 500 MiB) und liefert `allowedFrames`. Die Dauer ≈ Frames × (ms + Deflate-ms). Der Probeframe blockiert den Browser kurz (0,1 bis 0,7 s im Sechseck-Feld): er läuft beim Wählen von SVG und beim Umschalten „mit/ohne Flächen“, höchstens einmal je Kombination und Dialog-Öffnung (Zwischenspeicher), mit der Anzeige „Schätze …“ vorher (`sleep(0)`).
3. Zustand sichern, pausieren, auf Ruhe warten (wie PNG; die Hintergrundprüfung stört auch hier). **Keine Pixeldichte.**
4. Frame i: `setProgress(t_i)` → `svg = env.svgFrame(noFaces)` (`animExportSvgString(noFaces)`: sichert `showFaces` und `layer.showFaces`, setzt bei `noFaces` alle auf `false`, ruft `generateSVGString()`, **`finally` stellt sie zurück**) → `bytes = TextEncoder.encode(svg)` → `await zip.add(animFrameName(i + 1, n, 'svg'), bytes, handle)` mit `animZipWriter({method:'deflate', deflate})`, `deflate` = `CompressionStream('deflate-raw')` (gepackte Bytes zusätzlich als Blob, das als Handle ins ZIP geht).
5. Ende wie PNG (`zip.finish()`, Download `world_of_forms_animation_svg.zip` über `downloadBlob`), `finally`: Zeitleistenzustand, Status, `redraw()`; die Flags sind schon im Frame-`finally` zurück.
Neue Funktionen in `sketch.js` (am Dateiende, Regeln aus 116): `animExportSvgString`, `animExportProbeSvg`, `animExportDeflate`; Änderungen in `runAnimationExport` (Format-Zweig), `animExportEnv`, `animExportRefresh`, `animExportStart`, `animExportInit`. Codes neu: `noCompression`.

## 4. Bedienelemente (Skizze; wörtlich, vorher abstimmen)
Der Block `#export-anim` bekommt die **Format-Auswahl** als zwei Knöpfe (`aria-pressed`, wie 1×/2×); die Größe (1×/2×) nur bei PNG; bei SVG die Zeile „Flächen“:
```
Animation (Zeitleiste / Raum-Morph)
Format    [ PNG-Folge ] [ SVG-Folge ]          (Knöpfe, ein gewählter)
Bildrate  [ 24 Bilder/s ▾ ]    Bilder [ 96 ]
Größe     [ 1× (600×600) ] [ 2× (1200×1200) ]  (nur PNG)
Flächen   [ mit Flächen ] [ ohne Flächen ]     (nur SVG)
Geschätzt: 38 MB gepackt · 96 Bilder · ca. 1 min
Die Netz-Linien (Anzeigehilfe) stehen im PNG, nicht im SVG.    (nur SVG und nur bei eingeschalteten Netz-Linien)
[ Animation exportieren ]
```
Während des Laufs wie bei PNG (Fortschritt `Bild i von n`, Abbrechen, Close und Escape brechen ab). **Zustände:** bereit, *schätzt* (Meldung „Schätze die Größe …“, Knopf gesperrt), gesperrt (`tooBig`, `static`, `unresolved`, `otherClock`, `noCompression`, `framesInvalid`), läuft, fertig, abgebrochen, Fehler. Standard beim Öffnen: PNG-Folge (wie bisher), „mit Flächen“.
**Texte (DE wie im Markup, EN im Wörterbuch `ui-i18n.js`; Schlüssel `export.anim.*`; neu fett):**
| Schlüssel | DE | EN |
|---|---|---|
| **`formatPng`** (Knopf, bisher Textzeile) | PNG-Folge | PNG sequence |
| **`formatSvg`** | SVG-Folge | SVG sequence |
| **`faces`** | Flächen | Faces |
| **`facesOn`** / **`facesOff`** | mit Flächen / ohne Flächen | with faces / without faces |
| **`estimateSvg`** | Geschätzt: {size} gepackt · {n} Bilder · ca. {time} | Estimated: {size} packed · {n} frames · about {time} |
| **`probing`** | Schätze die Größe … | Estimating the size … |
| **`tooBigSvg`** | Zu groß: höchstens {max} Bilder bei dieser Größe. Weniger Bilder oder ohne Flächen wählen. | Too large: at most {max} frames at this size. Choose fewer frames or without faces. |
| **`svgNetNote`** | Die Netz-Linien (Anzeigehilfe) stehen im PNG, nicht im SVG. | The net lines (display aid) are in the PNG, not in the SVG. |
| **`noCompression`** | Dieser Browser kann nicht komprimieren (CompressionStream fehlt). | This browser cannot compress (CompressionStream is missing). |
| **`timeSec` / `timeMin`** | {n} s / {n} min | {n} s / {n} min |
| `done`, `cancelled`, `progress`, `slow`, `error`, … | unverändert aus 116 | unverändert |
Die alte Markup-Zeile „Format: PNG-Folge (ZIP)“ (`formatPng` als Text) wird durch die Knöpfe ersetzt; `test-i18n` prüft das Deutsch der Markup-Schlüssel gegen den Text (Knopftexte in Markup mit `data-i18n`).
**Handy 375 px:** die Knöpfe stehen in `.format-options` (zwei je Zeile, 48 px durch die vorhandenen Regeln), keine neue `html.ph`-Regel geplant; Prüfung der Dialoghöhe (der Dialog scrollt schon).

## 5. Freigaben, Dateien, Pins, Risiken
**Schreiben nur:** `sketch.js` (Dateiende; zwei, drei Zeilen in `runAnimationExport`/Handlern), `core/anim-export.js` (**Freigabe nötig**: Handle auch bei `deflate`, ~2 Zeilen), `index.html` (Format-Knöpfe, Zeile „Flächen“, Hinweisabsatz), `style.css` (nur falls nötig, Absatz `.export-anim-note`), `ui-i18n.js`, `?v=` in den drei Seiten (Suffix `\d+[a-z]+`, z. B. `20261229animsvg`), neue Tests unter `tools/anim/`, `tasks/117…`, `reports/117.md`; `ROADMAP.md` und `Claude.md` je ein Satz (Wunsch aus 116; auf Zuruf). **Nicht ändern:** `core/export.js` (**bleibt unverändert**), `draw()`, die acht Funktionen, `core/tiling.js`, `core/faces.js`, `core/facecolor.js`, `core/spatial-morph*.js`, Golden, Baselines, `gallery/`.
**Pins (eigener Commit, alt → neu):** `tools/ui/test-morph-view.js:325` und `tools/ui/test-lines-toggle.js` (Basis `ad9a41a6` → Commit, der `sketch.js` zuletzt ändert); `tools/anim/test-anim-export.js` (der Prüfpunkt „ein Handle mit deflate wirft“ wird zu „ein Handle mit deflate gilt“, plus Sabotage); `tools/ui/test-number-input.js` unberührt (kein neues Feld). Zu prüfen: `test-i18n*`, `test-p5-names`, `test-spatial-morph-render` (kein `spatialMorph` im Treiber), `test-draw-writes`, Layout-Baselines (Dialog geschlossen: erwartet 0 Unterschiede; 1100 px main gegen Arbeitsbaum wie in 116).
**Risiken:** (1) Die Flags `showFaces` werden kurz verändert: ein Fehler mitten im Frame darf sie nicht verlieren (`try/finally` im Frame, Test mit Wurf, Sabotage). Die Bildschirm-Zeichnung läuft in dieser Zeit nicht (synchron, kein `draw()` dazwischen). (2) Speicher: ein Frame im Sechseck-Feld ist roh bis 54 MB als String, dann Bytes, dann gepackt (Spitze ≈ 150 MB kurz); die ZIP hält nur Blobs der gepackten Bytes. Browserspeicher **nicht gemessen**. (3) `CompressionStream` fehlt in älteren Browsern (Safari < 16.4, Firefox < 113): Meldung `noCompression`, kein Export. (4) Die Schätzung nutzt den gezeigten Frame; andere Zeitpunkte können mehr oder weniger Polygone haben (Messung 114: 86 bis 105 k je t): Größenordnung, die Meldung sagt „Geschätzt“. (5) Das normale SVG-Export (Einzelbild) bleibt unberührt; nachgewiesen durch denselben String vor und nach einer SVG-Folge. (6) Download großer ZIP wie in 116 nicht geprüft. Aufwand: mittel; Risiko: mittel.

## 6. Testplan
**Harness** `tools/anim/test-anim-svg-driver.js` (Funktionen per Textauszug aus `sketch.js`, Platzhalter für `generateSVGString`, Flags, Uhr, `deflate` = `zlib.deflateRawSync`):
1. Frame-Folge: n = 2, 24, 96; die `t_i` sind `animFrameTimes`, der letzte genau 1; Namen `frame_0001.svg`; ZIP mit eigenem Leser: Methode 8, entpackte Bytes = das Platzhalter-SVG von **seinem** t; `unzip -t` und Python `zipfile`.
2. Flags: bei `noFaces` stehen `showFaces` und alle `layer.showFaces` während `generateSVGString()` auf `false` und danach wieder wie vorher (Basis, Ebenen, Keyframes, gemischt an/aus); ein Wurf in `generateSVGString()` stellt sie zurück (`error`, kein Download); bei „mit Flächen“ werden sie nie angefasst.
3. Zustand wie PNG: Position, pausiert, Statustext, `startTime`, `netLive`, `currentFrame` zurück (auch bei Abbruch und Fehler); laufende Wiedergabe pausiert und bleibt pausiert; **keine** Pixeldichte-Aufrufe und kein `toBlob` im SVG-Zweig.
4. Grenzen: 301 Frames, geschätzt 501 MiB (gepackt), `tooBig` mit `allowedFrames`, nichts angefasst; `noCompression` ohne `env.deflate`; Vorprüfungen wie PNG.
5. Schätzung: `animExportProbeSvg` ändert den Zustand nicht, packt, liefert `{raw, packed, ms}`; Zwischenspeicher je (Format, Flächen).
6. PNG-Zweig unverändert: die 47 Prüfpunkte aus 116 bleiben grün; die acht Funktionen und `draw()` byte-gleich zu main; `core/export.js` und `core/` außer `anim-export.js` byte-gleich; Wörterbuch DE und EN mit gleichen Platzhaltern; Markup-Ids.
**Sabotagen (mindestens 5, auf Kopien, alle rot):** (a) Flags nicht zurückgesetzt; (b) Flags nicht gesetzt („ohne Flächen“ wirkungslos); (c) Methode `store` statt `deflate` für SVG; (d) Deckel rechnet mit der rohen statt der gepackten Größe; (e) Wurf im Frame verliert die Flags (`finally` entfernt); (f) SVG-Zweig ruft `pixelDensity` oder `toBlob`; (g) Handle bei Deflate wird ignoriert (Kern-Test).
**Browser (echte Seite):** echte Folge mit **24 SVG-Frames** über den Dialog und über den Treiber: Quadrat 3/3 (Zeitleiste und Raum-Morph, mit und ohne Flächen) und **Sechseck 9/9 Feld mit 0 / 3 / 5 Ebenen mit Flächen** (Zeit je Frame, Größe roh und gepackt, mit und ohne Flächen); ZIP-Bytes aus dem Browser mit `unzip -t` und Python `zipfile`; **jede der 24 SVG als gültiges XML** (Python `xml.etree`, `DOMParser`) und die Polygonzahl > 0 bei „mit Flächen“, 0 bei „ohne“; **alle 24 Frames gleich den Frames mit `redraw()` dazwischen**; **dasselbe SVG des gezeigten Zustands vor und nach der Folge** (Flags zurück, Einzelexport unverändert); Zustand und Leinwand danach wie vorher (0 Pixel Unterschied); Konsole fehlerfrei; Dialog bei 375 und 1100 px (Zustände bereit, schätzt, gesperrt, läuft, fertig), Deutsch und Englisch; Abbruch und Close/Escape während des Laufs; **Golden 30/30** (main gegen Arbeitsbaum im selben Fenster, Ergebnisobjekte vergleichen); Layout 1100 px main gegen Arbeitsbaum; dann `guard.sh main` (FAIL erwartet: `sketch.js`, `core/anim-export.js`), `proof.sh L3 117`, `test-crossfade-match` bei Rot einzeln wiederholen.

## 7. Offene Fragen an den Nutzer
1. **Standard „Flächen“ bei SVG:** (a) mit Flächen (**Empfehlung**: gibt das Bild wieder; Größe und Deckel stehen im Dialog); (b) ohne Flächen (kleiner, aber nicht das gezeigte Bild).
2. **Beschneiden der Elemente außerhalb der Leinwand (45 bis 86 % der rohen Bytes):** (a) später als eigene Stufe 4, nach Rückmeldung zu dieser (**Empfehlung**); (b) gar nicht (gepackt ist der Gewinn kleiner); (c) gleich mit in Stufe 3 (mehr Aufwand, mehr Pins, Nachweis „sichtbar gleich“ nötig).
3. **Handle bei Deflate** in `core/anim-export.js` (2 Zeilen, Kern-Test +1, Sabotage): freigeben (**Empfehlung**)? Ohne sie liegen die gepackten Frames als `Uint8Array` im JS-Haufen (bis 500 MiB).
4. **Hinweis zur Netz-Überlagerung:** nur bei eingeschalteten Netz-Linien (**Empfehlung**, sonst gibt es nichts, was fehlt) oder immer bei SVG?
5. **`ROADMAP.md` und `Claude.md`** je ein Satz zur SVG-Folge nach dem Bau (wie bei 116)?

## 8. Nicht Teil dieser Stufe
Beschneiden (Frage 2), Video, Netz- und Ebenen-Animation, Transparenz, Querschichten-Flächen im SVG, Handy-Touch auf echtem Gerät, Safari/Firefox.
