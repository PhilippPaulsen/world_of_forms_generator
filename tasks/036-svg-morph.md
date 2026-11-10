# Auftrag 036 — SVG-Export: räumlicher Morph, p5-Warnung

**Typ K, Prüfstufe L3.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/036-svg-morph.md mit diesem Text an. Bericht: reports/036.md (höchstens 30 Zeilen). Branch: task/036-svg-morph von main. Kein Merge, kein Push. Plan in 5 Zeilen vor der Arbeit.

**Ziele:**
1. **Räumlicher Morph im SVG:** core/spatial-morph-render.js:spatialMorphTryDraw bricht bei gesetztem svgPathCollector ab (Normalmuster). Das aufheben, damit generateSVGString die Zwischenstellung (aktuelles t; Linien über drawCurvedBezier-Senke, Flächen über den Polygon-Sammler aus 035) exportiert. Der Statustext des Morphs darf durch den Export nicht verändert werden (Status-Schreibzugriff beim Export unterdrücken oder wiederherstellen).
2. **p5-Warnung beheben (core/export.js):** Der Sammler überschreibt fill/noFill/beginShape/vertex/endShape per Zuweisung; p5 meldet jedes Mal "You just changed the value of ... which was a p5 function". Ohne Verhaltensänderung vermeiden (z. B. Object.defineProperty auf globalThis oder p5-konformes Umgehen), Wiederherstellung im finally bleibt, Test-Welten ohne diese Funktionen bleiben lauffähig.

**Vorab:** git log -1 --oneline, git status --short (leer). Per grep lesen: spatialMorphTryDraw, spatialMorphRenderDraw, spatialMorphRenderSetStatus in core/spatial-morph-render.js; _svgCollectFacePolygons, generateSVGString in core/export.js; tools/morph/test-spatial-morph-render.js (Test des Collector-Abbruchs). Bei zwei Wegen oder wenn der Eingriff core/spatial-morph.js, core/faces.js, core/facecolor.js, core/tiling.js, core/curves.js oder eine der acht geschützten Funktionen berührt: STOP mit 2 Optionen.

**Nicht ändern:** sketch.js (acht Funktionen byte-gleich), core/spatial-morph.js, core/faces.js, core/facecolor.js, core/tiling.js, core/curves.js, tools/morph/off-path-golden.json, Baselines. Pin-Tests nur in eigenem Commit mit Begründung.

**Prüfpunkte:**
1. Morph AN, t = 0, 0.25, 0.5, 1 (linear und radial, mit Farben): SVG-Pfadkoordinaten gleich den Linienaufrufen des Morph-Frames (Test mit Stub), Polygonzahl, fill-Hex und Reihenfolge gleich den Flächenaufrufen; Linienstärke und Linien AUS (024) wirken. **Zusatz:** ein Fall mit aktivem Netz-Feld (activeNetWarp.field) im Morph: SVG-Koordinaten der Linien und Polygone entsprechen den verzerrten Frame-Aufrufen. Im Bericht festhalten: Netz-Overlay-Linien (drawNetLinesOverlay) werden nicht exportiert (bekannte Lücke, eigener Auftrag).
2. Morph AUS und Keyframe-ohne-Morph: SVG byte-identisch zum Stand vor der Arbeit.
3. Zeichnet der Export auf den Live-Canvas? Nein (0 Zeichenaufrufe auf dem Canvas-Stand-in); Statustext des Morphs vor/nach Export gleich.
4. Keine p5-Warnung mehr (Test über Stub der p5-Warnlogik oder Quelltextprüfung), Wiederherstellung auch bei Exception.
5. AUS-Pfad-Golden im Browser 30/30 (Verfahren: Kopfkommentar tools/morph/measure-off-path.js, Beispiel reports/011.md). Geschützte Tests 57/57 und 61/61, test-p5-names, Farborgel-Tests.
6. Schutz: git diff --quiet main..HEAD -- sketch.js core/spatial-morph.js core/faces.js core/facecolor.js core/tiling.js core/curves.js tools/morph/off-path-golden.json Exit 0.

**Sabotagen (höchstens 4, auf Kopien):** Abbruch bei Collector bleibt; Export schreibt Status; Morph-Export ignoriert t; Wiederherstellung entfernt.

**Prüfung:** bash tools/proof.sh L3 036 plus AUS-Pfad-Golden im Browser. Bericht: Hashes, Prüfpunkte, Sabotagen, Testzahlen, /usage vorher (messen) und nachher, Abweichungen, was nicht im Browser gesehen wurde. Arbeit und Bericht getrennt committen, usage.csv-Zeile.
