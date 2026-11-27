# Auftrag 183 — Ausgabe-Fingerabdruck der zehn Presets

**Typ K (nur Testwerkzeug und Pin-Datei), Prüfstufe L2.** Plan: `_Plaene/Fingerabdruck-presets.md` (freigegeben: Test in L2/L3, keine Änderung an `proof.sh`, Doku in `docs/baselines.md`). Bericht: `reports/183.md`. Branch: `task/183-output-pins` von main (`9d5fac69`). Kein Merge, kein Push, kein Studio-Sync.

**Ziel:** `tools/presets/test-output-pins.js` pinnt je Preset SHA-256 des SVG (`generateSVGString()`) und des auf 1e-6 normalisierten `buildExportData()` in `tools/presets/output-pins.json`; Abweichung = Fehler mit Slug, Hash-Art, Polygon-/Pfadzahl alt/neu, Node-Version. `--update` nur bewusst (zeigt alt -> neu, schreibt bei keiner Änderung nichts). Vier echte Sabotage-Läufe im Test (`OUTPUT_PINS_OVERRIDES`).

**Schreiben nur:** `tools/presets/test-output-pins.js`, `tools/presets/output-pins.json`, `docs/baselines.md`, `docs/workflow.md`, diese Datei, `reports/183.md`, `usage.csv`.
**Nicht ändern:** `core/`, `sketch.js`, `presets/`, Manifest, `tools/proof.sh`, die alten Pin-Dateien, Studio/Website.
