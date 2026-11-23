# Auftrag 120 — 3C-0: Messung Möbiusnetz (projektiver Prototyp, Typ R, nur messen)

**Typ R, Prüfstufe L1.** Branch `task/120-3c-messung` von main (`1e4825f2`, Merge 119). Nichts bauen; keine Änderung in `core/`, `sketch.js`, `ui-*.js`, bestehenden Tests. Neue Dateien nur unter `tools/grid/`, `tasks/`, `reports/`. Stopp bei Wochenkontingent ≥ 90 %. Kein Merge, kein Push, `docs/quellen/` nie committen, nur explizite `git add`-Pfade.

**Entscheidungen des Nutzers (Plan 119 §5):** Orientierung 45° gedreht wie die Quelle; a, b ganze Zahlen plus Format ganz oder halb; Dreieck nur die Barenvariante; Zeitleiste: 3C nur zwischen zwei 3C-Netzen interpolierbar; Stepper ersetzt Aus/An, Gesetz nur bei 1.1; erst 3C, dann E0 (4E).

**Prototyp:** `tools/grid/` (importiert nichts aus `core/`): H(p, q) = ((p − q)/(p + q), (1/a − 1/(p + q))/(1/a − 1/b)), x ∈ [−1, 1] ganz, [0, 1] halb, affin auf beliebiges Seitenverhältnis; Ausschnitt p, q ≥ 0, a ≤ p + q ≤ b.

**Messungen:** (1) Horizontabstand für a ≠ 1 an S. 48/Fig. 149 (a=2, b=4) gegen a/(b−a)·H und H/(b−a); (2) W durch Zählen der Maschen für die zehn Familien (S. 48–52, aus P4); (3) Randmaschen Quadrat, Dreieck (liegen p+q = const auf Gitterlinien?); (4) Kachelmuster (Linien, Flächen) unter H: Sehnen exakt, Flächenkanten in px, über Kachelgrenzen; (5) Fluchtlinie: Kachelzahl, Kacheln mit p+q ≤ 0, Strecken über die Fluchtlinie, Vorschlag mit Zahlen; (6) Streckung der Maschen (Ecken, Mitte; 1:1, 1:2) und Optimum (Quadrate 7–12, Dreiecke 8–16, Sechsecke 6–10); (7) Sechseck \*N soweit möglich.

**Ergebnis:** Tabellen mit Zahlen; Absatz „Was das für 3C-1 heißt“; `reports/120.md`, `reports/120-messung.md` (Rohausgabe); Nicht-Geprüftes ausweisen; `bash tools/guard.sh main`, `bash tools/proof.sh L1 120`; `/usage` mit der Wochenzahl.
