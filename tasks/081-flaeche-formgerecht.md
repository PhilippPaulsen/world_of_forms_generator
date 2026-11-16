# Auftrag 081 — Nicht quadratische Fläche: formgerechte Seitenmaße (Typ K, L2)

Arbeitsordner …/world_of_forms_generator-farborgel-generator-integration, main nach Merge 080 (18fef84f). Branch task/081-flaeche-formgerecht.

**Anlass (Sichttest Auftraggeber):** Beim Sechseck im Hochformat hat die Fläche die Proportionen des Quadrats, beim Dreieck im Querformat ebenso. Das Muster geht am Rand nicht schlüssig (ganze/halbe Zellen) auf.

**Festlegung:** e = 600 / min(X,Y) bleibt (Zellgröße und resizeBase-Faktor f = min/min' unverändert). Die Fläche folgt in BEIDEN Richtungen den Zellen: Quadrat W = X·e, H = Y·e. Dreieck W = X·e, H = Y·(√3/2)·e (neu nur das Querformat X>Y, H war 600). Sechseck W = X·(√3/2)·e, H = Y·e (neu nur das Hochformat Y>X, W war 600). X=Y bleibt für alle Formen 600×600. Die Kurzseite ist bei Dreieck-Querformat und Sechseck-Hochformat 520 px (bei min(X,Y)), gewollt. Zentrum (W/2, H/2), Verhältnisgrenze 1:3 nach Maschenzahl und die Ebenenregel unverändert. Lange Seite ≤ 1800 px (nachrechnen, im Bericht nennen).

**Zu tun:** (1) Stellen messen (gridWidth/gridHeight/gridCenter/validateGridSize in core/forms.js, setGridSize/gridEdgeFactor in core/state.js, `_sDim`/planSessionRestore, canvasSizeSync/canvasFitSync); bei Abweichung STOP. (2) Nur die Maßfunktionen in core/forms.js ändern (eine Quelle); alle Verbraucher lesen sie bereits (Abweichung nennen). Randschnitt nur an ganzen/halben Zellen prüfen; `GRID_EDGE_PLACEMENT` bleibt die eine Stelle. (3) Nicht ändern: core/tiling.js, faces.js, facecolor.js, die acht Funktionen, off-path-golden.json, Baselines, Katalog. Pins nur mit eigenem Commit (erwartet: test-nonsquare-grid, test-resize-format, test-session-format, test-canvas-fit).

**Prüfpunkte:** (1) X=Y: sechs Messskripte byte-gleich zu main, 600×600 pixelgleich; Quadrat bei allen X≠Y, Dreieck im Hochformat, Sechseck im Querformat byte-gleich zu main. (2) Maßtabelle je Form × (3/5, 5/3, 5/7, 7/5, 3/9, 9/3, 7/8, 8/7) vorher → nachher, lange Seite ≤ 1800. (3) Test: Formeln für alle Formen × Paare ≤ 1:3; Randschnitt an ganzen/halben Zellen; resizeBase-Roundtrip 3/3 ↔ 3/5 ↔ 5/3 ↔ 5/7 deckungsgleich; Session-Roundtrip Dreieck 5/3 und Sechseck 3/5; alte Snapshots mit alter Fläche werden als canvas-mismatch abgelehnt (bewusst, nennen). (4) Browser: Sechseck 3/5 und 5/3, Dreieck 5/3 und 3/5, Quadrat 3/5: Maße, unverzerrt, Ränder an ganzen/halben Zellen; Layout 1280×800 und 390 px; Golden 30/30.

**Sabotagen (je rot):** Sechseck-Breite wieder 600; Dreieck-Höhe wieder 600; X=Y-Ausnahme entfernt; e = 600/max statt min; Dreieck-Zeilenhöhe e statt (√3/2)·e.
**Prüfung:** `bash tools/proof.sh L2 081` plus Golden. Bericht reports/081.md. Ungemergt, kein Push.
