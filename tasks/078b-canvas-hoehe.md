# Auftrag 078b — Canvas-Anzeige: Maßstab zusätzlich durch die Fensterhöhe begrenzen (Typ U, L2)

**Arbeitsordner (nur dieser):** …/world_of_forms_generator-farborgel-generator-integration, main nach Merge 078 (09be20c1). Zuerst `pwd`, `git rev-parse --short HEAD`, `ls -ld core` nennen.
**Branch:** task/078b-canvas-hoehe von main. tasks/078b-canvas-hoehe.md VOR der Arbeit anlegen, reports/078b.md am Ende.

**Ziel:** Bei X≠Y ab 768 px Fensterbreite passt das ganze Canvas ins Fenster. Auf dem Phone (< 768 px, `html.ph`) bleibt alles wie in 078.

**Festlegungen (Auftraggeber):**
- Anzeigemaßstab s = min(bisheriger Maßstab, (Fensterhöhe − Höhe des Kopfbereichs über dem Canvas) / H), Untergrenze s ≥ 0,4 (relativ zur Pixelgröße des Canvas). Darunter scrollt die Seite wie heute.
- Nur die Darstellungsgröße ändert sich. Der Sketch-Canvas (W×H), `nodeHit` und `clientToSketch` bleiben unverändert.
- Quadrat 600×600 bei 1280, 768 und 390 px: pixelgleich zu main. Eine Begrenzung durch die Fensterhöhe darf beim Quadrat NICHT greifen (Quadrat bei niedrigem Fenster bleibt wie in main, auch wenn es sonst kleiner würde). Greift sie dort doch: STOP.

**Zu tun:**
1. Stellen messen: `--canvas-w`, `--canvas-h`, `--canvas-ratio` in style.css/index.html, `canvasSizeSync` in sketch.js (Kopfbereich messen: Welche Elemente liegen über dem Canvas? Wert mit `getBoundingClientRect().top` oder per CSS `dvh`, dein Weg, begründen).
2. Umsetzung bevorzugt rein in CSS (`min()`, `dvh`) plus der vorhandene Hook für die Variable. Auf Resize und Orientierungswechsel reagieren.
3. Nicht ändern: core/*, die acht geschützten Funktionen, off-path-golden.json, Baselines. Pins nur mit eigenem Commit und Begründung (erwartet: test-canvas-size).

**Prüfpunkte:**
1. Quadrat bei 1280×800, 1280×600, 768×1024, 390×844: Canvas, Streifen, Reihe, Schiene pixelgleich zu main.
2. Browser über die API (3/5, 5/3, 3/9, 9/3, 5/7): bei 1280×800 und 768×1024 liegt das ganze Canvas im Fenster (Abstand zum unteren Rand ≥ 0), außer wo die Untergrenze 0,4 greift (dann benennen). Phone 390 px wie 078 (346×576 bei 3/5, 358×215 bei 5/3).
3. Zeiger: `nodeHit` trifft 9/9 bei 3/5 und 5/3 auch im verkleinerten Zustand. Fensterhöhe zur Laufzeit ändern: Canvas folgt.
4. AUS-Pfad-Golden 30/30 (ruhiges System).

**Sabotagen (auf Kopien, je rot):** Begrenzung greift beim Quadrat; Untergrenze 0,4 entfernt; Begrenzung auch unter 768 px; Kopfbereichshöhe nicht abgezogen.

**Prüfung:** `bash tools/proof.sh L2 078b` plus Golden. Bericht reports/078b.md (Hashes, Messtabelle je Fenstergröße und Format, Pins alt → neu, Sabotagen, /usage, nicht gesehen). Ungemergt, kein Push.
