# Auftrag 078 — Nicht quadratische Fläche, B2: resizeBase, Ebenen, Farben, Canvas-Layout (Typ K, L3)

**Arbeitsordner (nur dieser):** …/world_of_forms_generator-farborgel-generator-integration, main nach Merge 077 (7420aaea). Zuerst `pwd`, `git rev-parse --short HEAD`, `ls -ld core` nennen. core/ muss beschreibbar sein, sonst STOP.
**Branch:** task/078-flaeche-resize von main. tasks/078-flaeche-resize.md VOR der Arbeit anlegen (Inhalt = dieser Auftrag), reports/078.md am Ende.

**Ziel:** Größen- und Formatwechsel (X,Y) → (X',Y') erhalten Muster, Linien, freie Punkte, Ebenen, Zeitleiste, Alt-Netz und Farben (wie 074/075 bei X=Y), der p5-Canvas passt sich W×H an, das Layout trägt W≠H. Es entsteht weiter KEIN Bedienelement für Y (kommt in B4). Der Handler `#shape-size-input` setzt weiter X=Y. Y wird über die API getrieben (Tests, Messskripte).

**Festlegungen (Auftraggeber):** Kurze Seite 600 px, e = 600/min(X,Y); M1; Zentrum (W/2,H/2); Verhältnis ≤ 1:3; Ebenen = ein Faktor L relativ zu e (alles aus 077). Die lange Seite kann unter 600 px liegen (Dreieck 7/8 usw.): kein Sonderfall, Layout und Skalierung richten sich nach W und H.

**Zu tun:**
1. Stellen messen (git grep): resizeBase/_resizeDo in core/state.js, Handler `#shape-size-input` und sizeChangePlan in sketch.js, setup() mit createCanvas, clientToSketch, nodeHit, crossLayerFillBuffer, `--canvas-size` in index.html/style.css (inkl. #face-colors-group, #timeline-group, #morph-group, .timeline-strip). Bei Abweichung von Bericht 076/077: STOP.
2. core/state.js: `resizeBase` bekommt (X',Y') (Y' fehlt ⇒ = X'). Mit e1, e2 und f = e2/e1 = min(X,Y)/min(X',Y'), C1 = (W1/2,H1/2) → C2 = (W2/2,H2/2): jeder Punkt p' = C2 + (p − C1)·f. Das gilt für freie Punkte, altNetSeed (p,q), Ebenen-Offsets (offset·f) und die Innenpunkt-Samples der Farbumschlüsselung. Ebenengröße L' = L/f (Bruch wie 075), Rotation unverändert. canvasW/H aus setGridSize (077). Gleiches (X,Y): nichts. Ungültig: Wurf vor jeder Änderung. Bei gleichem min(X,Y) ist f=1 (reine Verschiebung C2−C1).
3. sketch.js: nach dem Wechsel `resizeCanvas(canvasW, canvasH)`, crossLayerFillBuffer in der neuen Größe neu, Playback-Cache wie 075. clientToSketch nutzt getrennte sx, sy (bleibt). nodeHit nutzt Math.min(cv.scrollWidth/width, cv.scrollHeight/height). Handler und Hinweistexte wie 075 (de/en), nur Wortlaut für Formatwechsel ergänzen, falls nötig.
4. Layout: `--canvas-w`, `--canvas-h` aus W, H und einem Anzeigemaßstab s; `--canvas-size` bleibt für die Panelbreite (#face-colors-group, #timeline-group, #morph-group, .timeline-strip) die kurze bzw. feste Panelbreite, NICHT die Canvasbreite. Vorschlag: s = min(560/600, verfügbare Breite/W). Passt das nicht in das bestehende Layout (Querformat mit W bis 1800 px, Hochformat bis 1800 px Höhe): STOP mit 2 Optionen, nicht still entscheiden. Quadrat 600×600 bleibt pixelgleich zu main.
5. Nicht ändern: core/tiling.js, core/faces.js, core/facecolor.js, die acht geschützten Funktionen in sketch.js (byte-gleich; liegt etwas darin: STOP), off-path-golden.json, Baselines, Session/Export (B3). Pins nur mit eigenem Commit und Begründung (erwartet: test-canvas-size, test-lines-toggle, test-morph-view, sketch.js-Basis).
6. Feld-Netz: bleibt auf X=Y ungerade beschränkt (netDomainEffective). Bei X≠Y gilt es als Einzel mit Hinweis wie heute bei gerader Größe.

**Prüfpunkte:**
1. measure-g5a/g5b/g6a/g6b/lage2-app/size-change byte-gleich zu main (X=Y), 600×600-Canvas pixelgleich.
2. Neuer Test tools/grid/test-resize-format.js: für alle 3 Formen × Ordnung 1..4 × Lage 1/2 × Paare (X,Y)→(X',Y') mit Verhältnis ≤ 1:3 (inkl. 3/3 ↔ 3/5 ↔ 5/3, 5/7, Dreieck 7/8): Knoten = skalierte alte Knoten = Neuaufbau (Rest ≤ 1e-9), Linien-ID-Paare und Namen gleich, freie Punkte, Offset (×f), Rotation, Ebenen-Größe L/f exakt, Alt-Netz-Seed, Farben fläche-für-Fläche (Quadrat 100 %, Dreieck/Sechseck wie 075, Verluste gezählt), Zeitleiste-Playback bei t = 0, .5, 1 vorher/nachher deckungsgleich, redoStack bleibt, Dry-Run = echter Lauf.
3. Zentrum wandert: C1→C2 wird im Test gemessen (Sabotage unten).
4. Browser (echte Handler, Port aus diesem Ordner): AUS-Pfad-Golden 30/30 (ruhiges System; Ausreißer unter Last wiederholen und nennen). Alte Größen 1..9 sichtbar unverändert. Über die API (Konsole) ein Wechsel 3/3 → 3/5 → 5/3: Canvas hat die neue Größe, Muster unverzerrt, Linien/Ebene/Farben bleiben, Zeiger trifft Knoten (nodeHit) bei beiden Formaten, keine Konsolenfehler. Layout bei 1280 px und 390 px Fensterbreite.

**Sabotagen (auf Kopien, je rot):** Zentrum fest (300,300); `resizeCanvas` fehlt; sx ≠ sy beim Skalieren; f = e1/e2 invertiert; Offset unskaliert; L' gerundet ohne Meldung; nodeHit nur Breite; `--canvas-size` bestimmt wieder die Canvasbreite.

**Prüfung:** `bash tools/proof.sh L3 078` plus AUS-Pfad-Golden im Browser einmal.
**Bericht reports/078.md (Länge begrenzt):** Hashes, Stellentabelle, Pins (alt → neu, Begründung), Sabotagen, Layout-Entscheidung, /usage vorher/nachher, was nicht im Browser gesehen wurde (insbesondere Touch/Phone-Gerät). Ungemergt, kein Push.
