# Auftrag 105 — N2a-1: Warp für gerade Achsen im Feld, Schalter aus (Typ K, Prüfstufe L2)

Branch `task/105-n2a1-warp-gerade` von main `25016726` (Merge 104). Zuerst Plan zeigen, Freigabe abwarten; danach nach jedem Schritt committen, `reports/105.md` laufend pflegen. Stopp bei Wochenkontingent ≥ 90 %. Nicht mergen, nicht pushen.

Umgesetzt wird Stufe N2a-1 aus `tasks/104-n2-plan.md`. Entscheidungen: (1) E1 × E2 = X × Y Maschen, eine Masche je Kachel, auch bei gerader Achse; N2b nicht Teil. (2) Aus ↔ Feld bei gerader Achse: nur das Netz-Bild springt um e/2 (Variante A); Aus, Baselines, Sessions gerader Größen unverändert. (3) Optimum 7–12 nur Hinweis, vorgemerkt für N2a-2. (4) Altes N2 (macroX/macroY) zurückgestellt (N2c).

**Umfang:** Warp in `core/netwarp.js`: Bild = F(p + T), T = e/2 je gerader Achse; Feldrechteck im regulären Raum [0, W] − T über `warp.c0/v1/v2`; lo = n/2, hi = n/2 − 1. Schalter standardmäßig aus: dann alles byte-gleich zu main (gerade Größen Einzel/kein Netz), erreichbar nur über den Schalter (Tests, Messskripte), nicht in der UI. Keine Änderung an UI, Readout, Stepper, Hinweistexten, Zeitleiste, Morph, Ebenen, Flächenfreigabe.

**Nicht ändern:** `core/tiling.js` (nötig → stoppen und fragen), `core/faces.js`, `core/facecolor.js`, `sketch.js`, `tools/morph/off-path-golden.json`, Baselines, gallery/v2, `core/spatial-morph-render.js`.

**Messgrößen:** wie Plan 104 §2 N2a-1, zusätzlich: T-Formulierung gemessen (Knick 0, Rand 0, Deckung 100 %, Kachelindizes von `latticeIJBoundsCovering`) für Größen 2, 4, 6, 8 je Achse und gemischt (3×4, 4×3, 2×5, 4×4), Gesetze regular/sinus/tangens/geometric; Fig. 14 (3 × 4): Maschenlinie in der Mitte; ungerade Achsen und Schalter aus byte-gleich zu main (Bestandstest `test-net-field-2d`); Golden 30/30 im Browser (main gegen Arbeitsbaum); Frame-Zeit Feld ungerade ≤ +3 %.

**Neuer Test:** `tools/grid/test-net-field-even.js`; Sabotagen mindestens: T weglassen, T auf falsche Achse, lo/hi vertauscht, Schalter Standard an, ungerade Achse bekommt T.

**Prüfung:** `bash tools/proof.sh L2 105`; `tools/guard.sh` FAIL erwartet (core/ geändert); geschützte Dateien gegen main leer. `?v=` nur bei geändertem ausgeliefertem Code (`core/netwarp.js` wird ausgeliefert: dann erhöhen). `ROADMAP.md` Stand N2a-1.

## Plan (zur Freigabe)
1. **Schalter:** `let netFieldEven = false;` in `core/netwarp.js` bei `NETWARP_MAX_FIELD_TILES` (Muster `faceRepairCollinear`, Tests setzen ihn per `w.set('netFieldEven = true')`).
2. **`netDomainEffective`:** Schalter an: gerades n zugelassen, 2 ≤ n ≤ 8 (Modell; die UI-Untergrenze 3 gehört zu N2a-2; bei n = 2 wirkt Trig nicht, geometrisch ja), ungerade 3..9 wie heute. Schalter aus: Text und Ergebnis unverändert.
3. **`makeNetWarp`:** Rechteckpfad aus 086 auch bei X = Y, sobald eine Achse gerade ist. `field` bekommt zusätzlich `hi` und `shift` je Achse (`hx` bleibt = lo, damit `applyNetWarp` unverändert σ = s + hx liest; ungerade: hi = hx, shift 0). `fc0 = c0 − lo·v1 − lo_y·v2` ergibt [0, W] − T von selbst. Ungerade × ungerade: Objekt byte-gleich (keine neuen Schlüssel).
4. **`applyNetWarp`:** T zuerst auf den Punkt (`x += tx·v1`, `y += ty·v2` je gerader Achse), danach d·v wie heute. **`invertNetWarp`:** T abziehen, dann bisheriger Algorithmus.
5. **`netWarpInsideNet` und `netWarpFieldLocal`** (rufen mit Klick im Bildraum, `sketch.js:5313/5322`): Punkt um T zurück, Bereich [−lo, hi+1]; Klemmung i ∈ [−lo, hi]. **`netWarpSplitSegment`** (reguläre Endpunkte, `curves.js:478`): kein T, Schleife k von −lo+1 bis hi.
6. **`netGridLines` / `netTransformExportData`:** Rx × Ry-Zweig auch bei geradem X = Y; Linienlage aus lo/hi/T (Parität aus `fieldTiles`, keine neue Option aus `sketch.js`); Export additiv `fieldBase`, `gridShiftPx` nur bei gerader Achse (nur im Modell, nicht freigeschaltet in der UI).
7. **Test und Messungen:** `test-net-field-even.js` (Fälle oben, Harness wie `test-net-field-2d.js`), Byte-Vergleich gegen main per `git show`-Kopie für ungerade/Schalter aus, Sabotagen auf Kopien, Browser-Golden, Frame-Zeit.
8. **Commits:** je ein Commit für Schritt 1–3, 4–5, 6, Test, Pins (falls nötig; erwartet keine, da Schalter aus), Bericht.
**Offene Punkte, nur falls du abweichst:** n = 2 im Modell zulassen (Vorschlag ja); Richtung des Versatzes +e/2 (Vorschlag ja).
