# 077 — Nicht quadratische Fläche, B1: Maße und Gitter (Typ K, L2)
Branch task/077-flaeche-kern-b von main (HEAD 187beb4f), Arbeitsordner world_of_forms_generator-farborgel-generator-integration.

**Ziel:** Das Gitter kennt zwei Maschenzahlen X (Breite) und Y (Höhe), Zellen unverzerrt. Es entsteht kein UI-Pfad zu X≠Y (der kommt in B4); Tests und Messskripte treiben es über die API.

**Festlegungen (Auftraggeber):**
- Kurze Seite = 600 px, e = 600 / min(X,Y). X=Y ⇒ 600×600, alles byte-gleich zu main.
- Dreieck/Sechseck: M1. Die Zahl ist die Zeilen- bzw. Spaltenzahl. Dreieck lang in Y: H = Y·(√3/2)·e. Sechseck lang in X: W = X·(√3/2)·e (Spaltenschritt). Lang in der anderen Richtung wie bisher.
- Zentrum (W/2, H/2), Rand durch die Randmaschen. Die Randlage als EINE benannte Konstante ablegen.
- Obergrenze: max(X,Y) ≤ 3·min(X,Y), beide 1..9. Darüber wird abgelehnt, nicht geklemmt.
- Ebenen: ein Faktor L relativ zur Basis-Kante e. Keine eigene Ebenen-X/Y.

**Zu tun:**
1. Stellen messen (git grep: canvasW, canvasH, shapeSizeFactor in core/forms.js, state.js, sketch.js setup, session*). Bei Abweichung vom Bericht 076: STOP.
2. core/forms.js: Funktion für W(shape,X,Y) und H(shape,X,Y) (eine Quelle). buildTriangleGrid, buildSquareGrid und buildHexGrid nutzen e = 600/min(X,Y) und die Zentrierung auf (W/2,H/2). Fix: buildHexGrid teilt nicht mehr canvasH.
3. core/state.js: shapeSizeFactorX/Y (Y=X als Standard), canvasW/H aus W(), H(). setGrid/rebuildGrid reichen beide durch. validateGridSpec-Stil-Prüfung für die Grenze 1:3.
4. Nicht ändern: core/tiling.js, core/faces.js, core/facecolor.js, acht geschützte Funktionen, off-path-golden.json, Baselines, Session/Export (B3), resizeBase (B2). Pins nur mit eigenem Commit und Begründung.

**Prüfpunkte:**
1. measure-g5a/g5b/g6a/g6b/lage2-app/size-change byte-gleich zu main (X=Y).
2. Neuer Test tools/grid/test-nonsquare-grid.js: alle 3 Formen × X,Y ∈ 1..9 (Verhältnis ≤ 1:3): Zellkante e gleich in beiden Richtungen, keine Verzerrung (Kantenlängen, Winkel); W, H gleich der Formel; Knoten liegen im Rahmen; Verhältnis > 1:3 abgelehnt ohne Mutation. Tabelle aus Bericht 076 Abschnitt 3 (z. B. Dreieck 3/5 → 600×866, Quadrat 3/5 → 600×1000) als Gegenprobe.
3. Sechseck X=Y: Zellen gleich groß wie vor dem Fix (kein Größenwechsel bei 1/1..9/9).
4. Browser: AUS-Pfad-Golden 30/30 einmal (ruhiges System), alte Größen 1..9 sichtbar unverändert.

**Sabotagen (Kopien, je rot):** Hex teilt wieder canvasH/X; e = 600/X statt min(X,Y); Y ignoriert (Quadrat wird 600×600); Grenze 1:3 entfernt; Zentrum fest (300,300).

**Prüfung:** `bash tools/proof.sh L2 077`. Bericht: Hashes, Stellentabelle, Pins (alt → neu), Sabotagen, /usage vorher/nachher, was nicht im Browser gesehen wurde.
