**Typ K, Prüfstufe L2.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/053-quad-fix.md mit diesem Text an. Bericht: reports/053.md (höchstens 30 Zeilen). Branch: task/053-quad-fix von main (erwarteter HEAD 9b398d27). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Befund (reports/051.md, A7, nur gerechnet, nicht gesehen):** core/curves.js:drawCurvedBezier zeichnet ein quad-Stück auf dem Canvas als bezier(cur, control, control, to), im SVG als Q control to. Das sind verschiedene Kurven (Gewicht des Kontrollpunkts bei t = 0,5: 0,75 gegen 0,5): der Canvas wölbt 1,5-fach stärker als der SVG-Export.

**Schritt 1 (Messung, vor jeder Änderung):** Per grep die Stelle finden (nicht nach Zeilen). Im Test (Stub-Canvas und SVG-Sammler wie in tools/ui/test-svg-faces.js) für mehrere quad-Stücke (curveType kind curve, fold 1 und 2, verschiedene Stärken) die Punkte der Canvas-Kurve und der SVG-Kurve bei t = 0, 0.25, 0.5, 0.75, 1 berechnen und den größten Abstand in px ausweisen. Bestätigt sich der Unterschied nicht: STOP mit Befund.

**Schritt 2 (Fix, nur wenn bestätigt):** Das quad-Stück auf dem Canvas als echte quadratische Kurve zeichnen (quadraticVertex bzw. exakte Kubik-Umrechnung C1 = P0 + 2/3 (Q - P0), C2 = P2 + 2/3 (Q - P2)), sodass Canvas = SVG. Nur drawCurvedBezier; fold 2 (echte Kubik) und gerade Linien unverändert. Bei Strichstärke, Spiegelkopien und Morph nichts ändern.

**Nicht ändern:** sketch.js (acht geschützte Funktionen byte-gleich), core/faces.js, core/facecolor.js, core/tiling.js, core/spatial-morph*.js, tools/morph/off-path-golden.json, Baselines. Pins nur mit eigenem Commit und Begründung. ?v= bumpen (Muster 8 Ziffern + Buchstaben, z. B. 20261112qfix).

**Prüfpunkte:** (1) Messung vor/nach: max. Abstand Canvas gegen SVG vor dem Fix > 0, danach < 1e-6 px. (2) Gerade Linien, fold 2, Linien AUS, Strichstärke: Ausgabe byte-gleich zu vorher (Test mit alter curves.js). (3) AUS-Pfad-Golden im Browser 30/30 (Verfahren: Kopfkommentar tools/morph/measure-off-path.js, Beispiel reports/011.md); die Golden-Muster mit Kurven prüfen, ob sich ihre Hashes ändern: dann STOP mit Befund (Golden bewusst neu nur nach Rückfrage). (4) Geschützte Tests 57/57 und 61/61, test-p5-names. (5) Sabotage (2): alter Canvas-Pfad zurück; Kontrollpunkt falsch gewichtet.

**Prüfung:** bash tools/proof.sh L2 053 plus AUS-Pfad-Golden im Browser. Bericht: Hashes, Messwerte vor/nach, Sabotagen, /usage vorher/nachher, was nicht im Browser gesehen wurde.
