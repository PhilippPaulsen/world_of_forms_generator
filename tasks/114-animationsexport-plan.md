# Auftrag 114 — Animationsexport: PNG-Folge (ZIP) und SVG-Folge (Plan, Typ U, Prüfstufe L1)

Branch `task/114-animationsexport-plan` von main `34ad6dc4` (Merge 113). Nichts gebaut: keine Änderung in `core/`, `sketch.js`, `ui-*.js`, Tests. Neu nur dieser Plan, `reports/114.md`, die Messskripte `tools/anim/measure-anim-export.js` (Node) und `tools/anim/measure-png-frames.browser.js` (Browser). Rohdaten: `reports/logs/114-*.txt` (nicht committet).

## 0. Kernaussage
1. **Ein Frame zu Zeit t ist heute schon deterministisch abrufbar**, ohne Echtzeit: `setTimelineProgress(t)` (oder `timeline.elapsedMs = t·Gesamtdauer` + `applyTimelineFrame()`), dann `redraw()`. Keine der acht geschützten Funktionen muss geändert werden. Gemessen: 20 Zeitpunkte, 6 Fälle, gleicher SVG-Hash vorwärts, rückwärts, gemischt, in frisch gebauter Welt (Abschnitt 2.1).
2. **Der Raum-Morph hat keine eigene Zeit.** Er folgt `timeline.elapsedMs` (`core/spatial-morph-render.js:100–107`, die Front wandert mit dem Fortschritt; Bilinear ist statisch, alle Frames gleich). Ein Export „Zeitleiste“ und „Raum-Morph“ ist **derselbe Treiber**; der Morph braucht nur eingeschalteten Schalter.
3. **PNG-Folge ist billig**: 600² ≈ 10 ms Zeichnen + 5 ms PNG, 90–110 kB je Frame; größte Fläche (1800×600, 2× = 3600×1200) 17 ms PNG, 0,9 MB. Das Sechseck-Feld 9/9 zeichnet im Browser 0,1 bis 0,3 s, PNG 40 ms. Stoppgrenze 2,5 s im Browser **nicht** erreicht.
4. **SVG-Folge ist im Sechseck-Feld nicht praktikabel**: 10 bis 56 MB je Frame (100 000 bis 380 000 Polygone). Im Quadrat 3/3 3 bis 150 kB. Nötig: Größenschätzung vor dem Start, Option „ohne Flächen“, Deckel.
5. **ZIP: „store“ reicht für PNG** (Deflate spart 0 %), für SVG nicht (Deflate 5× kleiner, `CompressionStream('deflate-raw')` ist im Browser eingebaut, keine Abhängigkeit). Eigener Schreiber ~40 Zeilen, geprüft mit `unzip -t` und Python `zipfile`.
6. **Kein Netz, keine neue Abhängigkeit nötig.** Video: nur als Option bewertet (Abschnitt 3, Stufe 4), nicht empfohlen für jetzt.

## 1. Bestand (aus Code und Läufen)
| Was | Heute | Fundstelle |
|---|---|---|
| PNG | ein Bild, `saveCanvas('world_of_forms','png')`; Pixelmaß = CSS-Größe × p5-Pixeldichte (Standard = `devicePixelRatio`; im Browserfenster dieser Messung 2, also 1200² für 600²) | `core/export.js:9`, `sketch.js:2043` |
| SVG | `generateSVGString()`: lässt `drawTessellation()` mit ersetzten `fill/vertex/endShape` und `svgPathCollector` laufen; Flächen als `<polygon>`, Linien als `<path>`, Rahmen, Knoten optional. Enthält die Flächen aller gezeichneten Ebenen und den Morph-Frame der aktuellen Zeit (Task 036). **Nicht** im SVG: die Netz-Überlagerung (`drawNetLinesOverlay`, bekannte Lücke aus 036) | `core/export.js:493–538` |
| JSON | `buildExportData`; Ebenen-Flächen fehlen (`layerFacesOmitted: true`, `core/netwarp.js:649`), das betrifft **nur** JSON, nicht SVG und PNG | `core/export.js:133`, `core/netwarp.js:648` |
| Session | eigener Speicher/Transport, kein Bildexport | `core/session*.js` |
| Dialog | `#btn-save` → `#export-overlay` mit PNG, JSON, SVG; Handler `sketch.js:2026–2068`; `UI.dialog` in `ui-rail.js:7` (Handy teilt denselben Dialog: nicht im Browser geprüft) | `index.html:1323` |
| Zeitleiste | Keyframe-Ebenen (`timeline.keyframeLayerIds`), eine Wiedergabe-Ebene (`isTimelinePlayback`), Segmentdauern; `resolveTimelineSegment` → `{segmentIndex, localT}`; `applyTimelineFrame` interpoliert die Linien zu `_morphNodes/_morphConnections` der Wiedergabe-Ebene und setzt `timeline.currentFrame` (für Farb-Überblendung und Netz) | `sketch.js:3467–3530, 4039–4072` |
| Raum-Morph | Projekt-Schalter `spatialMorph {enabled, mode, angleDeg}`; zeichnet in `drawTessellation` über den Render-Haken die Frame-Linien des aktiven Segments; Fortschritt aus `timeline.elapsedMs` | `core/spatial-morph-render.js:100–107, 552–604` |
| Ebenen-/Netz-Animation | `layer.animation` (Stage A/B) und `baseNetAnimation`: eigene Uhren, derselbe Aufbau (`elapsedMs` bei Pause). **Nicht** Teil dieses Plans (siehe Frage 4) | `sketch.js:3085, 3238` |

**Was hängt an der Uhr?** `millis()` wird nur gelesen, wenn `playing === true` (`sketch.js:1225, 3035–3044, 3092, 3241–3251, 4042, 4085–4090`); pausiert gilt `timeline.elapsedMs`. `requestAnimationFrame` kommt in den Dateien nicht vor; die Schleife ist p5 `loop()/noLoop()` über `syncAnimationLoopState` (`sketch.js:3284`), `draw()` ruft `applyTimelineFrame` nur bei `timeline.playing` (`sketch.js:2349`). `ui-timeline.js:161–170` hat einen Timer für das Wiedergabe-Ende. `performance.now` im Morph-Render dient nur der Statistik (`:85–87`). **Ein pausierter Export braucht keine Uhr.**

**Nebenwirkungen von `setTimelineProgress`**: setzt `playing=false`, `netLive=true`, ruft `syncAnimationLoopState`, schreibt über `applyTimelineFrame` den Status-Text (`setTimelineStatus`, DOM). Der Export muss Zustand sichern und zurücksetzen: `elapsedMs`, `playing`, `startTime`, `netLive`, `currentFrame`, Status-Text, Schleifenzustand; und anschließend ein `redraw()`. Läuft eine Wiedergabe, wird sie vor dem Start pausiert (Entscheid, Frage 5).

## 2. Messung (Skripte unter `tools/anim/`)
Umgebung: Node-VM mit den echten `core/`-Dateien und dem echten Funktionstext aus `sketch.js`, p5-Zeichnung ersetzt (Harness `tools/morph/render-harness.js`); Browser: Chromium im App-Fenster, `http.server` auf den Arbeitsbaum, echte Seite, `devicePixelRatio` 2.

### 2.1 Determinismus (Frage 2, erster Punkt) — `node tools/anim/measure-anim-export.js det`
20 Zeitpunkte t ∈ [0,1]; Frame = SVG-Zeichenfolge (Linien + Flächen wie gezeichnet), Hash je t.
| Fall | verschiedene Frames von 20 | vorwärts = rückwärts | = gemischte Reihenfolge | zweimal gleiches t | = frisch gebaute Welt |
|---|---|---|---|---|---|
| Zeitleiste Quadrat 3/3, ohne / mit Feld-Netz | 20 / 20 | ja / ja | ja / ja | ja / ja | ja / ja |
| Raum-Morph linear Quadrat 3/3, ohne / mit Feld-Netz | 20 / 20 | ja / ja | ja / ja | ja / ja | ja / ja |
| Sechseck 4/4 Feld, 2 Ebenen + Zeitleiste / + Morph | 20 / 20 | ja / ja | ja / ja | ja / ja | ja / ja |
Browser (echte Leinwand, Quadrat 3/3 und 9×3, Sechseck): 4 Zeitpunkte ergeben 4 verschiedene Bilder. **Nicht gemessen:** Pixelgleichheit desselben t zweimal im Browser (nur im Node-SVG); Radial, Bilinear, Zeitleiste mit mehr als zwei Segmenten und Paarungen/Flips; Farb-Überblendung der Wiedergabe-Ebene (`playbackCrossfadeColors`) mit gefärbten Keyframes.

### 2.2 PNG je Frame, Browser (`tools/anim/measure-png-frames.browser.js`)
`setTimelineProgress(t)` + `redraw()` + `canvas.toBlob('image/png')`, Median über 4 bis 8 Frames, drei Keyframe-Ebenen.
| Fläche, Pixeldichte | Leinwand px | Zeichnen ms | PNG ms | PNG kB |
|---|---|---|---|---|
| Quadrat 3/3, 1× | 600² | 11 | 5 | 104 |
| Quadrat 3/3, 2× | 1200² | 12 | 9 | 313 |
| Quadrat, Raum-Morph, 1× | 600² | 6 | 4 | 106 |
| **größte Fläche** Quadrat 9×3, 1× | 1800×600 | 7 | 9 | 280 |
| Quadrat 9×3, 2× | **3600×1200** | 8 | **17** | 909 |
| Sechseck 9/9 Feld, 1× | 600² | 166 | 37 | 422 |
| Sechseck 9/9 Feld, 2× | 1200² | 168 | 47 | 1024 |
| Sechseck 9/9 Feld, Morph, 1× | 600² | 165 | 37 | 422 |
| Sechseck 9/9 Feld + 0 / 3 / 5 Ebenen auf dem Basisgitter (Zeitleiste) | 600² | 90–270 (0 Ebenen), 90–270 (3), 90–270 (5) | 17–39 | — |
**Befund aus den ersten Läufen**: die ersten Frames nach dem Aufbau (Sechseck 4/4, 8/8, 9/9, 1×) brauchten 0,4 / 1,2 / 5,0 s PNG-Zeit, **obwohl** Zeichnen 70 bis 170 ms war: Hintergrundarbeit der Zeitleiste (Zuordnungsprüfung in Portionen, `timelineImageCheckSchedule`, `sketch.js:1477`) belegt den Hauptthread, `toBlob` wartet. Der Export muss vor dem ersten Frame Ruhe abwarten (Leerlauf-Prüfung) und je Frame eine Zeitgrenze melden.
**Speicher**: `usedJSHeapSize` 14 bis 110 MB, schwankt durch die Speicherbereinigung, **nicht** als Messwert tauglich (nur Größenordnung: keine Zunahme je Frame sichtbar bei gehaltenen Blobs, die liegen außerhalb des JS-Haufens). Gehaltene PNG-Blobs, Hochrechnung 300 Frames: 600² ≈ 31 MB, 1200² ≈ 94 MB, 3600×1200 ≈ 270 MB, Sechseck 9/9 2× ≈ 300 MB. Das ist die Summe der Dateien, die ZIP sowieso hält. **Ablauf in Stücken** nötig ab etwa 300 MB; Vorschlag: ZIP-Teile (`Blob`-Stücke, Lokal-Kopf + Blob je Eintrag, Zentralverzeichnis am Ende; die Blobs belegen den Haufen kaum), Obergrenze der Gesamtgröße statt nur der Frame-Zahl (Frage 3). **Nicht gemessen:** der Spitzenspeicher des Browsers (Prozess-Speicher), Safari/Firefox, Handy.

### 2.3 SVG je Frame (`node … svg`, Node-VM, Zeit = Node, Dateigröße exakt)
| Fall | Zeit ms | Größe | Polygone | Pfade |
|---|---|---|---|---|
| Zeitleiste Quadrat 3/3, Flächen an, Netz aus / an | 1,3 / 0,5 | 41 / 3,6 kB | 0 / 0 | 605 / 45 |
| Raum-Morph Quadrat 3/3, Flächen an, Netz aus / an | 9,1 / 3,2 | 149 / 12 kB | 1056 / 96 | 605 / 45 |
| dasselbe, Flächen aus | 0,2–3,2 | 2,8–31 kB | 0 | 605 / 45 |
| **Sechseck 4/4 Feld**, 3 Ebenen, Zeitleiste / Morph | 1056 / 973 | **21 MB / 9,9 MB** | 113 750 / 86 480 | 204 000 / 40 800 |
| **Sechseck 8/8 Feld**, 3 Ebenen, Zeitleiste / Morph | 2513 / 1852 | **56 MB / 22 MB** | 381 906 / 186 869 | 414 000 / 82 800 |
Folgen: 300 Frames Sechseck 8/8 wären 6 bis 17 GB. Die Zahlen zählen **alle** gezeichneten Kacheln; ob Polygone und Pfade außerhalb der Leinwand im SVG stehen (und ein Beschneiden sie senken könnte), ist **nicht geprüft**. Zeitleiste Quadrat 3/3 mit Flächen: 0 Polygone, weil die Beispiel-Linien keine geschlossene Fläche bilden (nicht als Fehler gewertet, nicht geprüft).

### 2.4 ZIP (`node … zip`, eigener „store“-Schreiber, 60 kB je PNG-Platzhalter, echte SVG-Frames)
| Inhalt | Frames | roh MB | store MB | Zeit ms | Deflate MB (Zeit ms) | Prüfung |
|---|---|---|---|---|---|---|
| SVG | 30 / 120 / 300 | 0,17 / 0,66 / 1,25 | 0,17 / 0,67 / 1,28 | 1,2 / 1,6 / 3,2 | 0,03 / 0,12 / 0,25 (2 / 5 / 10) | `unzip -t` OK, `zipfile` OK |
| PNG (unkomprimierbar) | 30 / 120 / 300 | 1,76 / 7,03 / 17,58 | 1,76 / 7,04 / 17,61 | 3,4 / 13,7 / 33,7 | 1,76 / 7,03 / 17,58 (19 / 78 / 189) | `unzip -t` OK, `zipfile` OK |
Aufschlag je Eintrag 104 Byte; CRC32 ist der Hauptaufwand (34 ms für 17,6 MB). **„store“ reicht für PNG; für SVG ist Deflate (`CompressionStream('deflate-raw')`) ein Faktor 5 kleiner**; der Schreiber wäre dasselbe, mit Methode 8 und echter Größe/CRC im Kopf. Ohne ZIP64: bis 65 535 Einträge und 4 GiB; die Frame-Obergrenze liegt darunter. **Nicht gemessen:** echte PNG im ZIP (Platzhalter!), Öffnen in macOS Archivprogramm, Windows Explorer; Dateinamen > ASCII; ein einzelner Download-Auslöser für Dateien > 1 GB im Browser.

### 2.5 Sechseck-Feld mit Ebenen, Frame-Zeit (Stoppgrenze 2,5 s)
- **Browser** (Zeichnen, `redraw()`): 0,07 bis 0,27 s bei 4/4 bis 9/9, auch mit 3 und 5 zusätzlichen Ebenen (die Zahl blieb gleich: **ungeklärt**, ob die Ebenen im Browser-Lauf Flächen zeichneten; Task 112/113 meldete +110 bis +130 ms je Ebene). Stoppgrenze nicht erreicht.
- **Node-VM** (`… time`, Zeichnen + SVG, Basis mit 10 Linien, Ebenen mit je 10 Linien, Flächen an): Sechseck 4/4: 0,4 bis 1,5 s; 8/8: 0,9 bis 3,2 s; 9/9: 1,2 bis 3,7 s. **Über 2,5 s**: 8/8 mit 5 Ebenen Zeitleiste (Zeichnen 2,7 s, SVG 3,2 s), 9/9 mit 3 Ebenen Zeitleiste SVG (2,8 s), 9/9 mit 5 Ebenen Zeitleiste (3,1 s / 3,7 s). Die Node-VM ist langsamer als der Browser (ersetzte Zeichenaufrufe, Pfadsammler); die Zahlen sind eine **obere Schranke**, kein Browserwert, und mit dem Browserlauf nicht in Einklang gebracht. Für die Planung gilt: **SVG-Frame im Sechseck-Feld kann > 2,5 s dauern → Fortschritt, Abbrechen und Zeitgrenze sind Pflicht.**
- Zeitleiste und Morph getrennt: Zeitleiste ist in der Node-VM mit Ebenen langsamer (+0,3 bis 1,2 s), Morph unabhängig von Ebenen (der Morph-Render zeichnet seine eigenen Kacheln).

## 3. Plan: Stufen
Reihenfolge-Empfehlung: **1 → 2 → 3**, Video (4) nur auf Wunsch. Eine Stufe je Auftrag.

### Stufe 1 — Bausteine, rein (Typ K, Prüfstufe L2)
Neue Datei `core/anim-export.js` (p5-frei, kein DOM): `animFrameTimes({totalMs, fps | frames})` → Liste t_i = i/(n−1) (letzter Frame bei t=1), `animZipWriter` (store und deflate-raw über übergebene Kompressionsfunktion), `animCrc32`, Namensschema `frame_0001.png`, Größenschätzung. **Schreiben nur**: neue Datei, neuer Test `tools/anim/test-anim-export.js` (Zeiten, CRC gegen `zlib`, ZIP-Prüfung gegen Referenzleser in Node, Grenzen), `?v=` und Script-Tag in `index.html`, `gallery.html`, `color-harmony/ui/index.html` (nur wenn dort geladen; `tools/color/test-esm-cachebust.js` beachten). **Freigabe nötig**: neue Datei in `core/` (`tools/guard.sh` meldet sie als Änderung; die Regel „core/ unverändert“ gilt für diese Stufe nicht). Risiko gering, Aufwand klein.

### Stufe 2 — PNG-Folge (Typ K, Prüfstufe L3, Browser)
Treiber in `sketch.js` als **neue** Funktion (nicht eine der acht): sichert Zeitzustand, pausiert, wartet Leerlauf, je Frame `setTimelineProgress(t)` → `redraw()` → `toBlob` → in ZIP-Stücke, Fortschritt je Frame, Abbruch-Flag (Zwischenstand verwerfen), zuletzt Zustand zurück und `redraw()`; ein Download (`downloadBlob`, `core/export.js:13`). Pixeldichte: `pixelDensity(1|2)` setzen und danach **zurück**, nicht auf den Seitenwert vertrauen. UI: Abschnitt 4. **Schreiben nur**: `sketch.js` (die neue Funktion plus ein Handler), `index.html` (Dialogzeilen), `style.css`, `ui-rail.js`/`ui-i18n.js` (Texte), Test `tools/anim/test-anim-png.js` (Treiber in der Harness mit Leinwand-Platzhalter: Frame-Folge, Zustand wiederhergestellt, Abbruch, byte-gleiche geschützte Funktionen). **Freigabe nötig**: `sketch.js`; neue Bedienelemente nach Abstimmung (Skizze 4). **Pins/Baselines**: Hash-Pin der `sketch.js`-Basis (wie in 113: eigener Commit mit Begründung), `tools/ui/test-p5-names.js` (keine `/* */` in `setup()/draw()`), Phone-CSS-Regeln (`html.ph`, `@media`; `test-phone-config.js`), Layout-Baselines bei neuem Dialoginhalt (`baseline-cleanup-11.json` hat 104 kB Spielraum; neue Baseline nur nach Abstimmung). Golden unberührt, solange `draw()` nicht verändert wird. Risiko mittel: Speicher (Stücke, Deckel), Hintergrundarbeit (Leerlauf), Browser-Download großer Dateien, Handy. Aufwand mittel.

### Stufe 3 — SVG-Folge (Typ K, Prüfstufe L3, Browser)
Gleicher Treiber, Frame = `generateSVGString()`; Größenschätzung vor dem Start (ein Probeframe), Deflate je Eintrag, Option „ohne Flächen“ (SVG ohne `<polygon>`-Gruppe; verlangt eine kleine Option in `generateSVGString` **oder** Nachbearbeitung der Zeichenfolge, sonst `core/export.js` zu ändern: **Freigabe** `core/export.js`), harte Grenzen für Frame-Zahl × geschätzte Größe. Gleiche Pins/Baselines wie Stufe 2. Risiko mittel–hoch (Dateigröße im Sechseck-Feld, Zeit > 2,5 s je Frame, Netz-Überlagerung fehlt im SVG: im Export-Hinweis nennen). Aufwand mittel.

### Stufe 4 — Video (nur bewertet, nicht empfohlen jetzt; Typ R)
`MediaRecorder` + `canvas.captureStream`: ohne Abhängigkeit, aber Echtzeit und ungenaue Bildabstände; `VideoEncoder` (WebCodecs): genaue Frames, aber ein MP4/WebM-Muxer müsste selbst geschrieben oder geladen werden (Abhängigkeit, Freigabe). **Nicht gemessen.** Vorschlag: erst nach Stufe 2 entscheiden, ob PNG-ZIP + externes Werkzeug (ffmpeg) reicht.

**Nötige Freigaben, Überblick**: neue Datei `core/anim-export.js` (1); `sketch.js` neue Funktion (2, 3); Bedienelemente (2); `core/export.js` nur falls „ohne Flächen“ (3); Pins/Baselines (2, 3); keine Netzabhängigkeit.

## 4. Bedienvorschlag (Skizze, vorher abstimmen)
Im bestehenden Exportdialog (`#btn-save`) eine vierte Zeile, nur sichtbar, wenn eine Zeitleiste mit ≥ 2 Keyframes existiert:
```
Export als…
[ PNG ] [ JSON ] [ SVG ]
──────────────────────────────
Animation (Zeitleiste / Raum-Morph)
Format   (•) PNG-Folge (ZIP)  ( ) SVG-Folge (ZIP)
Länge    [ 4,0 s ]  Bildrate [ 24 ▾ ]   → 96 Frames   (oder: Frames [ 96 ])
Größe    (•) 1×  600×600   ( ) 2×  1200×1200
Hintergrund  (•) wie Bild   ( ) transparent*   (*nur falls später)
Schätzung: ~10 MB · ~3 s            [ Animation exportieren ]
──────────────────────────────
[ Close ]
```
Während des Laufs ersetzt eine Fortschrittszeile den Block: `Frame 37 / 96 · [██████░░░░] · [Abbrechen]`; der Dialog bleibt offen, die Zeitleiste ist gesperrt. Dauer und Bildrate ergeben die Frame-Zahl; die Länge ist standardmäßig die Zeitleisten-Gesamtdauer (`totalTimelineDurationMs`), änderbar nur als **Frame-Zahl** (die Segmentdauern bleiben unberührt). Handy: derselbe Dialog, Optionen untereinander, Fortschritt und Abbrechen groß; ZIP-Download auf iOS-Safari **nicht geprüft**. Wirkung von Bilinear (statisch): Hinweis „alle Frames gleich“ und kein Export. Läuft die Wiedergabe: pausiert zuerst, Hinweis im Dialog.

## 5. Offene Fragen an den Nutzer
1. **Video als Ziel?** (a) nein, nur Bildfolge; extern zusammensetzen (**Empfehlung**); (b) später `MediaRecorder`-WebM als einfache Option; (c) WebCodecs/MP4 mit eigenem Muxer (viel Aufwand).
2. **Standard Bildrate und Größe?** (a) 24 Bilder/s, 1× (**Empfehlung**: 600² = 100 kB/Frame, auch auf dem Handy tragbar); (b) 30 Bilder/s, 2× (scharf für Retina, 3-fach größer); (c) Wahl ohne Standard.
3. **Begrenzung?** (a) höchstens 300 Frames und höchstens 500 MB geschätzt (**Empfehlung**, Meldung statt Abbruch); (b) nur Frame-Zahl 600; (c) keine, nur Warnung.
4. **Auch Ebenen-Animation und Netz-Animation (nicht Zeitleiste)?** (a) nein, nur Zeitleiste und Raum-Morph (**Empfehlung**, ein Treiber, geprüft); (b) die Netz-Animation später als eigene Stufe (eigene Uhr, gleiche Bauart); (c) Ebenen-Animation (`layer.animation`) auch.
5. **Läuft gerade eine Wiedergabe?** (a) pausieren, Zustand zurück (**Empfehlung**); (b) Export gesperrt, solange sie läuft.
6. **SVG im Sechseck-Feld** (Frames von 10 bis 56 MB): (a) Schätzung + Deckel, Option „ohne Flächen“ (**Empfehlung**); (b) SVG-Folge nur für Quadrat und Dreieck; (c) keine Grenze.
7. **Hintergrund transparent?** (a) nein, wie das Bild (**Empfehlung**, `draw()` malt den Hintergrund; transparent würde `draw()` berühren, Golden-Risiko); (b) später als eigener Auftrag.

## 6. Nicht geprüft
Pixelgleichheit desselben t im Browser; Radial, Bilinear und mehr als zwei Segmente; gefärbte Keyframes (Überblendung); Zeichenzeit der Ebenen mit Flächen im Browser (Messung 112/113 nennt +110 bis +130 ms je Ebene, hier nicht reproduziert); echter Spitzenspeicher, Safari, Firefox, Handy; PNG im ZIP mit echten Dateien und fremden Entpackern; Download > 1 GB; SVG-Beschneiden außerhalb der Leinwand; Netz-Überlagerung im SVG (bekannte Lücke).
