# Auftrag 116 — Animationsexport, Stufe 2: PNG-Folge (Plan, Typ K, Prüfstufe L3) — ENTWURF, wartet auf Freigabe

Branch `task/116-anim-export-png` von main `94ef6e5b` (Merge 115). Grundlage: `tasks/114-animationsexport-plan.md` (Stufe 2, Abschnitt 4), `reports/114.md`, `reports/115.md`, `core/anim-export.js`. **Bisher nichts gebaut, nichts außer dieser Datei geschrieben.** Entscheidungen des Nutzers aus 114 gelten unverändert: nur Bildfolge; nur Zeitleiste und Raum-Morph; 24 Bilder/s und 1× als Standard (1× oder 2× wählbar); Grenze 300 Frames und 500 MiB geschätzt, Meldung statt Abbruch; laufende Wiedergabe pausieren und Zustand zurücksetzen; Hintergrund wie das Bild; Bilinear: Hinweis statt Export.

## 0. Kernaussage
1. Ein Frame zu t ist `setTimelineProgress(t)` + `redraw()` + `canvas.toBlob`; gemessen (114): 5 bis 47 ms PNG, 7 bis 270 ms Zeichnen. Die acht geschützten Funktionen werden nur **aufgerufen** (`setTimelineProgress`, `applyTimelineFrame`, `totalTimelineDurationMs`, `resolveTimelineKeyframeCoords`, `resolveTimelineSegment` indirekt), nicht geändert.
2. Neu in `sketch.js`: **eine Treiber-Funktion mit herausgereichten Abhängigkeiten** (`runAnimationExport(env, opts)`, ohne DOM und p5, damit die Harness sie mit Platzhaltern testet) und **ein dünner Verdrahtungsblock** (Dialog, `redraw`, `toBlob`, Download). `draw()` bleibt unberührt.
3. **Eine kleine Erweiterung von `core/anim-export.js` ist nötig** (Freigabe, Abschnitt 6): `add(name, bytes, handle)`, damit die Bytes eines Frames **nicht** in den Teilen des ZIP im JS-Haufen bleiben (der Auftrag verlangt „Blobs nicht im JS-Haufen halten“; heute hält `finish()` jede Nutzlast als `Uint8Array`).
4. Keine Änderung an `draw()`, an bestehenden `core/`-Dateien, Golden, Baselines, `gallery/`. Neue Baseline: erwartet **nicht nötig** (der Dialog ist im Layout-Baseline geschlossen; Nachweis in Abschnitt 5, sonst Vorschlag).

## 1. Fundstellen (Stand main `94ef6e5b`)
| Was | Stelle |
|---|---|
| Exportdialog, Markup | `index.html:1323–1334` (`#export-overlay`, `#export-png/-json/-svg`, `#close-export`) |
| Öffnen/Schließen und Handler | `sketch.js:2026–2068` (`#btn-save` → `removeClass('hidden')`; `pngBtn`, `jsonBtn`, `svgBtn`) |
| Tastatur/Fokus des Dialogs | `ui-rail.js:7` `UI.dialog(...)`, `ui.js:643–680` (Escape = Klick auf `#close-export`) |
| Download | `core/export.js:13` `downloadBlob(content, filename, mimeType)` (Blob, `<a download>`, sofort `revokeObjectURL`) |
| Zeitleistenzustand | `timeline {keyframeLayerIds, playbackLayerIndex, segmentDurationsMs, elapsedMs, startTime, playing, netLive, currentFrame, netStates}` (`core/state.js`, `sketch.js:3360–3380`) |
| Frame zu t | `setTimelineProgress(t)` `sketch.js:4101` (setzt `elapsedMs`, `playing=false`, `netLive=true`, `syncAnimationLoopState()`, `applyTimelineFrame()`); `applyTimelineFrame` `:4039` (setzt `currentFrame`, `_morphNodes/_morphConnections`, schreibt `setTimelineStatus`) |
| Pausieren/Fortsetzen (Vorbild) | `toggleTimelinePlayback` `sketch.js:4081`: Pause = `elapsedMs = clamp(millis() - startTime)`, `playing=false`; Fortsetzen = `startTime = millis() - elapsedMs`, `playing=true`, `netLive=true`, `syncAnimationLoopState()` |
| Raum-Morph | folgt `timeline.elapsedMs` (`core/spatial-morph-render.js:100–107`); Schalter/Modus über `getSpatialMorph()` (`sketch.js:4812`); Status `spatialMorphStatus()`, Code `bilinearStatic` (`core/spatial-morph.js:431`) |
| Andere Uhren | Ebenen-Animation `layer.animation.playing` (wird in `draw()` über `millis()` fortgeschrieben, `sketch.js:2346`), Netz-Animation `baseNetAnimation.playing` (`sketch.js:3241`) |
| Hintergrundprüfung | `timelineImageCheck {timer, job:{queue,i}}` (`sketch.js:3892–3950`); ruhig, wenn `timer === null && job.i >= job.queue.length`; sie hat in 114 die ersten `toBlob` um 0,4 bis 5 s verzögert |
| Statustext | `window.setTimelineStatus` `sketch.js:1274`, Element `#timeline-status`; Zustand `timelineConditionSaid` |
| Pixeldichte | nirgends gesetzt (p5-Standard = `devicePixelRatio`); Offscreen-Puffer `crossLayerFillBuffer = createGraphics(width, height)` `sketch.js:2382` |
| Texte | `ui-i18n.js` (`DICT`, `{de, en}`, Platzhalter `{n}`), `data-i18n` am Markup |
| Phone | `html.ph .dialog-content { max-height; overflow-y:auto }`, `html.ph .dialog-content button { min-height: var(--target) }` (`style.css:1615–1616`); gröbere Zeiger: `@media (pointer: coarse)` für `.format-btn`, `.dialog-content button`, `select`, Zahlfelder (`style.css:162–200`) |
| Skripte | `index.html:1620` `core/export.js?v=20261227hexebenenflaechen`, `:1630` `sketch.js?v=…`; `gallery.html` und `color-harmony/ui/index.html` tragen dasselbe `?v=` (eine Version über alle drei, `tools/color/test-esm-cachebust.js` Punkt 3) |
| Pin auf `sketch.js` | `tools/ui/test-morph-view.js:325` (`git diff --stat 2bd470e9 -- sketch.js core/tiling.js` muss leer sein) |

## 2. Ablauf des Treibers
`runAnimationExport(env, opts)` mit `opts = {fps | frames, density (1|2)}` und `env = {timeline(), totalMs(), setProgress(t), redraw(), toBlob(), density{get,set}, now(), sleep(ms), idle(), status{get,set}, onProgress({i,n,phase,ms}), shouldCancel(), spatialMorph(), otherClocksPlaying(), download(blob,name), applyFrame(), pauseTimeline(), resumeTimeline(saved)}`; liefert `{ok, code, n, bytes}`; wirft nicht für erwartbare Fälle (Codes unten).
1. **Prüfen** (nichts wird verändert): Zeitleiste mit ≥ 2 Keyframes und lösbarem Segment (`resolveTimelineKeyframeCoords` ok für jedes Segment, sonst Code `unresolved`); Ebenen- oder Netz-Animation läuft (Code `otherClockPlaying`, kein Export: deren Uhr hängt an `millis()`, die Frames wären nicht reproduzierbar); Morph an und Modus `bilinear` (Code `static`); Frames `animFrameTimes({totalMs, fps | frames})`; `animExportEstimate` mit der Größenschätzung (Abschnitt 3); `limit !== null` → Code `tooBig` mit `allowedFrames`, **nichts wird gerendert**.
2. **Zustand sichern**: `elapsedMs`, `playing`, `startTime`, `netLive`, `currentFrame` (Kopie), Statustext (`#timeline-status`) und `timelineConditionSaid`, `density.get()`, `animationLoopActive`. Lief die Wiedergabe: `elapsedMs = clamp(millis() - startTime)`, `playing = false`, `syncAnimationLoopState()` (genau wie die Pause-Taste).
3. **Auf Ruhe warten**: `env.idle()` fragt `timelineImageCheck` (neue kleine Funktion `timelineImageCheckIdle()`, liest nur) alle 50 ms; höchstens 15 s, dann weiter mit Hinweis `waiting` im Fortschritt (die Messung 114 zeigt, dass das ohne Warten Sekunden je Frame kostet, nicht dass es falsch wird).
4. **Pixeldichte** `density.set(opts.density)` (`pixelDensity(1|2)`), danach je Frame:
   `setProgress(t_i)` → `redraw()` → `await toBlob()` → `bytes = new Uint8Array(await blob.arrayBuffer())` → `await zip.add(animFrameName(i, n, 'png'), bytes, blob)` (Bytes nur für CRC und Größe, der **Blob** wird als Teil gehalten) → `onProgress` → `await sleep(0)` (Oberfläche zeichnet, Hintergrundportionen laufen). Dauert ein Frame > 2,5 s: Hinweis `slow` im Fortschritt, kein Abbruch.
5. **Abbrechen**: `shouldCancel()` wird vor jedem Frame gefragt; Treffer → `zip` verwerfen (Teile freigeben), kein Download, Code `cancelled`; Schritt 7 läuft trotzdem.
6. **Ende**: `zip.finish()` → `download(new Blob(parts, {type: 'application/zip'}), 'world_of_forms_animation.zip')` über `downloadBlob`. Das ZIP hat nur ASCII-Namen, store (PNG ist nicht komprimierbar, 114).
7. **Zustand zurück (immer, auch bei Abbruch und Fehler, `finally`)**: Pixeldichte zurück; `timeline.elapsedMs`, `startTime`, `netLive` zurück; `applyFrame()` (= `applyTimelineFrame()`, setzt `currentFrame` und die Wiedergabe-Ebene neu), dann Statustext und `timelineConditionSaid` wörtlich zurück; lief die Wiedergabe: `startTime = millis() - elapsedMs`, `playing = true` (wie `toggleTimelinePlayback`); `syncAnimationLoopState()`; ein `redraw()`. **Entscheidung dazu unten (Frage 1).**
8. **Fehler** (`toBlob` null, Ausnahme im Zeichnen, ZIP-Grenze): Code `error` mit Text, Zustand zurück, kein Download.

Codes: `ok`, `cancelled`, `tooBig`, `static`, `unresolved`, `otherClockPlaying`, `error`.

## 3. Größenschätzung vor dem Start
Beim Öffnen des Dialogs und bei jeder Änderung der Optionen: `canvas.toBlob` **des Bildes, das gerade sichtbar ist** (kein `redraw`, kein Zustandswechsel), Bytes × (Zielpixel / aktuelle Pixel) = `bytesPerFrame` → `animExportEstimate({frames, bytesPerFrame})`. Genauigkeit: Größenordnung (der Bildinhalt ändert sich je Frame; 114: 91 bis 106 kB bei 600²). Anzeige „Geschätzt: 9,6 MB · 96 Bilder“; bei `limit !== null` die Meldung `tooBig` und die Schaltfläche gesperrt (der Nutzer senkt Bilder oder wählt 1×).

## 4. Bedienelemente (Skizze 114 mit den Entscheidungen; **Zeile „Hintergrund“ entfällt**)
Ein Block `#export-anim` im Exportdialog, unter den drei Format-Knöpfen, **nur sichtbar**, wenn `timeline` mit ≥ 2 Keyframes besteht (beim Öffnen geprüft; ohne Zeitleiste oder mit einem Keyframe bleibt der Dialog wie bisher, kein Hinweis):
```
Export as…
[ PNG ] [ JSON ] [ SVG ]
──────────────────────────────
Animation (Zeitleiste / Raum-Morph)
Format    PNG-Folge (ZIP)
Bildrate  [ 24 Bilder/s ▾ ]      Bilder  [ 96 ]
Größe     [ 1× 600×600 ] [ 2× 1200×1200 ]      (zwei Knöpfe, aria-pressed)
Geschätzt: 9,6 MB · 96 Bilder
[ Animation exportieren ]
──────────────────────────────
[ Close ]
```
Bildrate `12, 24, 30, 60`; **Bilder** zeigt Dauer × Bildrate (gerundet, mindestens 2) und ist ein Zahlfeld: eine Eingabe setzt die Bilderzahl direkt (die Zeitleiste bleibt unberührt, t läuft von 0 bis 1 über die Bilder); ein Wechsel der Bildrate setzt sie neu. Der Block bleibt auch bei geöffnetem Dialog ohne Wirkung auf JSON/SVG/PNG.

**Zustände:** *bereit* (Schaltfläche an); *gesperrt* (Meldung in der Zeile unter der Schätzung, Schaltfläche `disabled`: `tooBig`, `static`, `unresolved`, `otherClockPlaying`); *läuft* (Optionen und die drei Format-Knöpfe `disabled`, an der Stelle der Schaltfläche `<progress>` und „Bild 37 von 96“ und der Knopf **Abbrechen**; `#close-export` und Escape = Abbrechen, der Dialog bleibt offen); *fertig* (Zeile „Fertig: 96 Bilder, 9,4 MB.“, Optionen frei); *abgebrochen* („Abgebrochen. Nichts wurde gespeichert.“); *Fehler* („Export fehlgeschlagen: …“, Zustand ist zurück).

**Wortlaut (DE wie im Markup, EN im Wörterbuch `ui-i18n.js`; Schlüssel `export.anim.*`):**
| Schlüssel | DE | EN |
|---|---|---|
| `title` | Animation (Zeitleiste / Raum-Morph) | Animation (timeline / spatial morph) |
| `format` | Format | Format |
| `formatPng` | PNG-Folge (ZIP) | PNG sequence (ZIP) |
| `fps` | Bildrate | Frame rate |
| `fpsValue` | {n} Bilder/s | {n} frames/s |
| `frames` | Bilder | Frames |
| `size` | Größe | Size |
| `size1` / `size2` | 1× ({w}×{h}) / 2× ({w}×{h}) | 1× ({w}×{h}) / 2× ({w}×{h}) |
| `estimate` | Geschätzt: {size} · {n} Bilder | Estimated: {size} · {n} frames |
| `start` | Animation exportieren | Export animation |
| `prepare` | Die Zeitleiste prüft noch im Hintergrund … | The timeline is still checking in the background … |
| `progress` | Bild {i} von {n} | Frame {i} of {n} |
| `slow` | Langsam: {s} s je Bild. | Slow: {s} s per frame. |
| `cancel` | Abbrechen | Cancel |
| `cancelled` | Abgebrochen. Nichts wurde gespeichert. | Cancelled. Nothing was saved. |
| `done` | Fertig: {n} Bilder, {size}. | Done: {n} frames, {size}. |
| `tooBig` | Zu groß: bei dieser Größe höchstens {max} Bilder. Weniger Bilder oder 1× wählen. | Too large: at most {max} frames at this size. Choose fewer frames or 1×. |
| `static` | Bilinear ist statisch: alle Bilder wären gleich. | Bilinear is static: all frames would be identical. |
| `unresolved` | Die Zeitleiste ist nicht darstellbar (Linienzahl der Keyframes verschieden). | The timeline cannot be shown (the keyframes have different line counts). |
| `otherClock` | Eine Ebenen- oder Netz-Animation läuft. Erst anhalten. | A layer or net animation is playing. Stop it first. |
| `error` | Export fehlgeschlagen: {msg} | Export failed: {msg} |
Größen in der Meldung: `1,2 MB` (Komma in DE, Punkt in EN über das vorhandene Formatieren; kein neuer Formatierer: ein kleines Funktionsstück im Treiber, `KB`/`MB`).

**Handy (`html.ph`):** der Block ist eine Spalte (`display:flex; flex-direction:column; gap`), Knöpfe als `.format-btn` (die Regel `html.ph .dialog-content button { min-height: var(--target) }` und `@media (pointer: coarse)` gelten schon), Auswahl und Zahlfeld über die vorhandenen Regeln für `select` und `input[type=number]`; Fortschritt `<progress>` volle Breite; der Dialog scrollt (vorhanden). **Keine neue `html.ph`-Regel geplant** (also keine Zwillingsregel, `test-phone-config.js` bleibt unberührt); Prüfung bei 375 px im Browser. Bei gröberem Zeiger (Mobile) mit echtem Touch nicht geprüft.

## 5. Testplan
**Harness** `tools/anim/test-anim-png-driver.js` (Funktion aus `sketch.js` per Textauszug wie `tools/morph/render-harness.js`, Platzhalter für Leinwand, `toBlob`, Uhr, `redraw`; die Bytes des Platzhalter-PNG hängen von `timeline.elapsedMs` ab):
1. Frame-Folge: n = 2, 24, 96; die an `setProgress` übergebenen t sind `animFrameTimes`, der letzte genau 1; Reihenfolge und Namen im ZIP; ZIP mit eigenem Leser und `unzip -t`/`zipfile`; die Bytes jedes Eintrags = die Platzhalter-Bytes seines t.
2. Zustand danach gleich wie vorher: `elapsedMs`, `startTime`, `playing`, `netLive`, `currentFrame`, Statustext, `timelineConditionSaid`, Pixeldichte, `animationLoopActive`; bei pausierter und bei laufender Wiedergabe (laufend: pausiert während des Exports, danach fortgesetzt, `startTime` konsistent).
3. Abbruch nach Frame k: kein Download, Zustand zurück, Teile freigegeben; Abbruch vor dem ersten Frame.
4. Grenzen: 301 Bilder und 501 MiB geschätzt → `tooBig`, **kein** `setProgress`-Aufruf, kein Zustandswechsel; Modus `bilinear` → `static`; Ebenen-Animation läuft → `otherClockPlaying`; Keyframe-Linienzahl verschieden → `unresolved`.
5. Fehlerpfad: `toBlob` gibt `null` im Frame 3 → `error`, Zustand zurück, kein Download.
6. Leerlauf-Warten: `idle()` meldet 3× besetzt, dann ruhig → erst dann das erste Bild; Zeitüberschreitung 15 s → weiter mit `prepare`-Hinweis.
7. Pixeldichte wird für die Frames gesetzt und danach zurückgesetzt, auch bei Abbruch und Fehler.
8. **Die acht geschützten Funktionen sind byte-gleich zu main** (Text aus `git show main:sketch.js` gegen Arbeitsbaum, Funktionskörper wörtlich), `draw()` byte-gleich, `core/*` außer `anim-export.js` byte-gleich.
9. DOM-Verdrahtung: der Block ist nur mit Zeitleiste ≥ 2 Keyframes sichtbar; Wörterbuch hat alle `export.anim.*` in DE und EN (Platzhalter gleich).
**Sabotagen (mindestens 5, auf Kopien, alle rot):** (a) Zustand wird nicht zurückgesetzt; (b) Abbruch wird ignoriert; (c) Grenze ohne Wirkung; (d) letztes t ≠ 1; (e) Pixeldichte nicht zurück; (f) Wiedergabe wird nicht pausiert; (g) Statustext nicht zurück.
**Kern-Test** `tools/anim/test-anim-export.js` erhält zwei Prüfpunkte für `add(name, bytes, handle)` (Handle statt Bytes im Teil, CRC und Größe aus den Bytes), Sabotage: Handle wird ignoriert.
**Browser (echte Seite, `git archive` main auf einem Port, Arbeitsbaum auf einem zweiten; ZIP-Bytes werden von der Seite per `fetch` PUT an einen kleinen Empfänger `tools/anim/receive-zip.js` geschickt und mit `unzip -t` und `python3 -I zipfile` geprüft):**
- **Quadrat 3/3**, drei Keyframes, Zeitleiste und danach Raum-Morph (linear), **24 Bilder**, 1× und 2×: ZIP heil, 24 PNG-Signaturen, Größe je Bild, **Zeichenzeit je Frame** (`redraw()` in ms, Median/Maximum).
- **Sechseck-Feld 9/9 mit Ebenen und Flächen** (Netz-Feld, 3 und 5 Ebenen auf dem Basisgitter mit `showFaces`, plus Zeitleiste), 24 Bilder: Zeichenzeit je Frame gemessen **mit Nachweis, dass die Ebenen Flächen zeichnen** (Pixelvergleich mit und ohne Flächen der Ebenen), **das fehlte in 114** (Node: 1 bis 3 s, Browser: 0,1 bis 0,3 s ohne Flächen der Ebenen). Stoppgrenze 2,5 s je Frame.
- Zustand vor/nach dem Export gleich: Leinwand-Hash (derselbe Zustand, dieselbe Dichte), `timeline`-Felder, `additionalLayers` (JSON), Statustext, `pixelDensity()`, Schleifenzustand; Export bei laufender Wiedergabe; Abbruch mitten im Lauf.
- Konsole fehlerfrei; Dialog bei 375 px und 1100 px (Zustände bereit, gesperrt, läuft, fertig) als Bild; Deutsch und Englisch.
- **AUS-Pfad-Golden 30/30** (`await measureOffPath({})`, Digest `cf06fe1b`, main und Arbeitsbaum im selben Fenster).
- Layout-Baseline: **`compare-baseline.js` bei 375 und 1100 gegen `baseline-phone-5.json` / `baseline-cleanup-11.json`**, erwartet 0 Unterschiede (Dialog geschlossen, der Block ist `hidden`); sonst Vorschlag einer neuen Baseline, nicht ohne Abstimmung.
- `bash tools/guard.sh main` (FAIL erwartet nur wegen `sketch.js` und `core/anim-export.js`), `bash tools/proof.sh L3 116`, `test-crossfade-match` bei Rot unter Last einzeln wiederholen.

## 6. Freigaben, Dateien, Pins, Risiken
**Schreiben nur:** `sketch.js` (neue Funktionen `runAnimationExport`, `timelineImageCheckIdle`, Verdrahtung `animExportWire…`; eine Zeile im bestehenden `#btn-save`-Handler, die den Block aktualisiert; ein Aufruf im Handler von `#close-export`); `core/anim-export.js` (**Freigabe nötig**: `add(name, bytes, handle)`, 3 Zeilen); `index.html` (Block, Script-Tag `core/anim-export.js?v=…` vor `sketch.js`, `?v=`); `gallery.html`, `color-harmony/ui/index.html` (nur `?v=`, damit die Version einheitlich bleibt; sie laden `anim-export.js` nicht); `style.css` (`.export-anim …`, ohne `html.ph`); `ui-i18n.js` (Schlüssel `export.anim.*`); `ui-rail.js` nur falls der Fokus des Dialogs den neuen Knopf nicht findet (erwartet nicht); neue Tests und Messskripte unter `tools/anim/`; `tasks/116…`, `reports/116.md`. **Version:** `?v=20261228animpng` (Regel `\d+[a-z]+`).
**Nicht ändern:** `draw()`, die acht Funktionen, alle bestehenden `core/`-Dateien (außer der Erweiterung oben), `tools/morph/off-path-golden.json`, Baselines, `gallery/`.
**Pins (eigener Commit, alt → neu):** `tools/ui/test-morph-view.js:325`: Basis `2bd470e9` → der Commit, der den Treiber enthält (wie 113). Zu prüfen und nur bei Rot anzupassen: `tools/ui/test-p5-names.js` (neue Top-Level-Namen `anim*`, `runAnimationExport` kein p5-Mitglied; keine Blockkommentare in `setup()`/`draw()`: dort wird nichts geändert), `tools/ui/test-i18n*.js` (Wörterbuch gegen Markup), `tools/color/test-esm-cachebust.js` (eine Version), `tools/ui/test-draw-writes.js`, Tests, die `index.html` als Text prüfen. Die fünf Alt-Tests aus 115 sind schon ausgenommen (Datei existiert in main).
**Risiken:** (1) `pixelDensity(1|2)` zur Laufzeit mit dem Offscreen-Puffer `crossLayerFillBuffer` (`createGraphics` bei der alten Dichte): wird durch den Pixelvergleich vor/nach geprüft; Rückfall: Puffer verwerfen (`crossLayerFillBuffer = null`) nach der Rückkehr, falls nötig (kleine Zusatzzeile, im Bericht melden). (2) Download großer ZIP: `downloadBlob` ruft `revokeObjectURL` sofort; bei Safari/Handy könnte ein großer Download scheitern: **nicht geprüft**, Rückfall wäre ein eigener Anker mit verzögertem Widerruf (im Bericht). (3) Hintergrundprüfung der Zeitleiste verlängert Frames, bis sie ruhig ist (siehe Schritt 3). (4) Autospeichern der Sitzung während des Exports: die Schreiber speichern bei Zustandsänderungen; Uhren werden nie gespeichert (`core/session.js`); im Browser geprüft (Sitzung vor/nach gleich). (5) Statuszeile und Hinweise der Zeitleiste werden je Frame neu geschrieben (`applyTimelineFrame`), danach wörtlich zurück. (6) Ebenen mit Flächen im Sechseck-Feld: Zeit je Frame wächst mit den Ebenen (112/113: +110 bis +130 ms je Ebene); Stoppgrenze 2,5 s je Frame. (7) Speicher: PNG-Blobs liegen im Blob-Speicher, nicht im JS-Haufen; Spitzenspeicher des Browsers **nicht** messbar im Bericht (nur Größenordnung). Aufwand: mittel; Risiko: mittel.

## 7. Offene Fragen (Antwort vor dem Bau)
1. **Nach dem Export bei vorher laufender Wiedergabe:** (a) Wiedergabe setzt an der alten Stelle fort (wörtlich „Zustand zurücksetzen“, **Empfehlung**); (b) bleibt pausiert an der alten Stelle.
2. **Erweiterung `add(name, bytes, handle)` in `core/anim-export.js`** (3 Zeilen, Kern-Test +2): freigeben (**Empfehlung**)? Ohne sie halten die ZIP-Teile bis 500 MiB als `Uint8Array` im JS-Haufen.
3. **Bilder-Feld editierbar** (Frame-Zahl direkt) oder nur Bildrate wählbar? (a) beides (**Empfehlung**, wie in der Skizze 114); (b) nur Bildrate, einfacher.
4. **`ROADMAP.md` und `Claude.md`:** ein Satz zur PNG-Folge nach dem Bau? (Nicht in der Schreibliste; nur auf Zuruf.)

## 8. Nicht Teil dieser Stufe
SVG-Folge (Stufe 3), Video, Ebenen- und Netz-Animation, Hintergrund transparent, Handy-Touch-Prüfung auf echtem Gerät.
