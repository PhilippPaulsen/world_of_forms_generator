# Auftrag 079 — Nicht quadratische Fläche, B3: Session, Export, Transport (Typ K, L2)

**Arbeitsordner (nur dieser):** …/world_of_forms_generator-farborgel-generator-integration, main nach Merge 078b (f0901592). Zuerst `pwd`, `git rev-parse --short HEAD`, `ls -ld core` nennen. core/ muss beschreibbar sein, sonst STOP.
**Branch:** task/079-flaeche-session von main. tasks/079-flaeche-session.md VOR der Arbeit anlegen (Inhalt = dieser Auftrag), reports/079.md am Ende.

**Ziel:** Ein Muster mit (X,Y) mit X≠Y übersteht Session-Roundtrip (Autosave und Wiederherstellung), JSON-/SVG-Export und Transport (Link und Paste). X=Y bleibt byte-gleich zu main.

**Festlegungen (Auftraggeber):**
- Bestehende Dateien bleiben gültig. Fehlt die Größenangabe, gilt Quadrat (X=Y=shapeSizeFactor). Das Format wird NUR additiv erweitert: SESSION_SCHEMA_VERSION und formatVersion bleiben, es sei denn ein Test erzwingt es (dann STOP mit 2 Optionen).
- `shapeSizeFactor` bleibt der Kantenfaktor min(X,Y) (Stand 078). Neu kommt dazu: Session `size: {x, y}`, Export `meta.size: {x, y}` (nur bei X≠Y; bei X=Y bleibt die Ausgabe byte-gleich), Transport optionaler Parameter `size=XxY` (fehlt er: Quadrat).
- Gültigkeit: validateGridSize (1..9, Verhältnis ≤ 1:3) VOR jeder Mutation. Ungültig ⇒ abgelehnt ohne Teilmutation, auch in Session und Transport.
- Katalog gallery/v2 und gallery-render.js unverändert (nur Quadrat, feste 600/300). SpaceHarmony-Import bleibt außen vor.

**Zu tun:**
1. Stellen messen (git grep): captureSessionSnapshot, planSessionRestore (`canvas-mismatch`), session-apply.js (canvasW/H, SESSION_APPLY_UNTOUCHED), core/export.js (buildExportData, generateSVGString: width/height/viewBox/Rahmen), parseTransportV2 und die Transport-Stelle in sketch.js. Bei Abweichung von Bericht 076/078: STOP.
2. Session: Snapshot trägt size; planSessionRestore lässt gültige (W,H) zu und lehnt `canvas-mismatch` nur noch ab, wenn W,H nicht zu (X,Y) passen. Apply setzt X,Y über setGridSize und löst den vorhandenen Hook canvasSizeSync aus (resizeCanvas, Füllpuffer, --canvas-ratio, canvasFitSync). Reihenfolge so, dass Ebenen und Farben gegen das richtige Gitter gerechnet werden.
3. Export: JSON meta.size bei X≠Y, geometry in px wie bisher. SVG nutzt W×H für width, height, viewBox und Rahmen (prüfen, ob schon der Fall). Name (gridDisplayNameFor) unverändert, nimmt keine Größe.
4. Transport: `size=XxY` lesen und schreiben (nur bei X≠Y), alle Tokens vor jeder Mutation validieren (wie 072d).
5. Nicht ändern: core/tiling.js, core/faces.js, core/facecolor.js, die acht geschützten Funktionen in sketch.js (byte-gleich), off-path-golden.json, Baselines, Katalog. Pins (Quelltext-Tests, u. a. die „session*.js unverändert“-Gruppen und die unklassifizierten shapeSizeFactorX/Y aus 077/078) nur mit eigenem Commit und Begründung, alt → neu im Bericht.

**Prüfpunkte:**
1. X=Y: measure-g5a/g5b/g6a/g6b/lage2-app/size-change byte-gleich zu main. Export (JSON, SVG) und Session-Snapshot bei X=Y byte-gleich zu main.
2. Neuer Test tools/grid/test-session-format.js: 3 Formen × Ordnung 1..3 × Lage 1/2 × Paare (3/5, 5/3, 5/7, 3/9, 7/8 Dreieck, 8/7 Sechseck): Session-Roundtrip (Snapshot → Apply in eine andere Welt) = identischer Snapshot und Export, inklusive Ebenen, Zeitleiste, Farben, freie Punkte. Export-JSON → Paste → gleiches Muster. Link-Roundtrip. SVG: width, height, viewBox = W, H. Alte Snapshots und Dateien ohne size laden als Quadrat. Ungültig abgelehnt ohne Mutation: 1:4 (z. B. 2/9), X=0, X=10, size=3x, size=3x5x7, Mix aus gültigem und ungültigem Token.
3. Browser (echte Handler, Port aus diesem Ordner): über die API 3/5 setzen, Linien und Ebene anlegen, Seite neu laden: Wiederherstellung stellt 600×1000, Linien, Ebene wieder her (kein canvas-mismatch, keine Konsolenfehler). Export-SVG öffnen: Maße stimmen. Link in neuem Tab: gleiches Muster. AUS-Pfad-Golden 30/30 (ruhiges System).

**Sabotagen (auf Kopien, je rot):** `canvas-mismatch` bleibt bei 3/5; Apply setzt canvasW/H nicht (resizeCanvas fehlt); size fehlt im Snapshot (Quadrat nach Reload); SVG width/height bleibt 600; Transport akzeptiert 1:4; Transport mutiert vor der Validierung; X=Y-Export bekommt meta.size.

**Prüfung:** `bash tools/proof.sh L2 079` plus AUS-Pfad-Golden im Browser einmal.
**Bericht reports/079.md (Länge begrenzt):** Hashes, Stellentabelle, Pins (alt → neu, Begründung), Sabotagen, /usage vorher/nachher, was nicht im Browser gesehen wurde. Ungemergt, kein Push.
