# Auftrag 037 — Performance-Messung räumlicher Morph

**Typ R/K (Messung, kein Eingriff in core/ oder sketch.js), L1.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/037-performance-messung.md mit diesem Text an. Bericht: reports/037.md (höchstens 30 Zeilen, mit Hash des Messskripts). Branch: task/037-performance-messung von main (erwarteter HEAD d67a091f). Schreiben nur: Task-Datei, Bericht, neues Skript tools/morph/measure-frame-profile.js, usage.csv. Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Befund:** Nutzer sieht im räumlichen Morph bei Hexagon spürbare Verlangsamung und leichtes Ruckeln (nach Task 034; vorher laut ROADMAP schon Frame-Zeit 520 bis 860 ms in Node bei Hexagon/Dreieck mit Symmetrie). Nicht gemessen, ob 034 es verschlechtert hat. Allgemein soll die Performance untersucht werden.

**Aufgabe:**
1. Frame-Profil (Node, vorhandene Render-Harness tools/morph/render-harness.js und measure-frame-time.js wiederverwenden): je Frame Zeit für Linien, Flächenberechnung (computeCellFaces/_runSafeComputeCellFaces), Farbzuordnung (spatialMorphRenderFaceColors: Zuordnung gegen Raster), Zeichnen. Fälle: Quadrat, Hexagon (dicht, mit Symmetrie), Dreieck, kuratierte Beispiele; Playback- und Spatial-Pfad; Ebenenzahl 2.
2. Vergleich Stand 5f444408 (vor 034) gegen main (Worktree oder git stash-freie Kopie, kein Checkout im Arbeitsbaum): Frame-Zeit je Fall, Differenz durch 034.
3. Browser-Messung, falls möglich (Verfahren wie tools/morph/measure-off-path.js: sichtbares Fenster nötig; sonst "nicht gemessen" und angeben): performance.now um draw() bei Hexagon-Beispiel, Ziehen und Abspielen, beide Stände.
4. Hebel bewerten (nicht umsetzen): (a) Flächen pro Kachel über Gewichte wiederverwenden, (b) Cache über Frames (Schlüssel, Trefferquote beim Ziehen), (c) Zuordnung nur bei Stillstand/Loslassen, Raster beim Ziehen, (d) weniger Kacheln zeichnen (Sichtbarkeit). Je Hebel: erwartete Ersparnis (aus dem Profil abgeleitet), Risiko, Einbaustellen (Datei:Funktion), Schutz, Prüfstufe.
5. Empfehlung: ein Hebel mit dem besten Verhältnis, mit Messgröße (ms je Frame bei Schritt 0.01 Ziehen und beim Abspielen, 16-ms-Ziel).

**Nicht ändern:** sketch.js, core/*, off-path-golden.json, Baselines. Prüfung `bash tools/proof.sh L1 037`, `tools/guard.sh main`. Bericht: Hashes, Tabelle (nur Auffälliges), gemessen/vermutet getrennt, Empfehlung, /usage vorher/nachher.
