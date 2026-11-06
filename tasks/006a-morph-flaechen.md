# 006a Morph-Flächen
Typ K, Prüfstufe L2. Regeln: docs/agent-rules.md. Bericht: reports/006a-morph-flaechen.md (höchstens 40 Zeilen).
Branch: task/006a-morph-flaechen von main (erwarteter HEAD: 3108480a).

Vorab (Pflicht):
1. `git log -1 --oneline`, `git status --short` (muss leer sein).
2. `grep -n "spatialMorphRenderDraw\|spatialMorphRenderRecordTiles\|activeNetWarp\|showFaces" core/spatial-morph-render.js`
3. `grep -n "computeCellFaces\|collectCellSegments\|findFaces" core/faces.js`
4. Arbeite nach den Fundstellen aus dem grep, nicht nach Zeilennummern aus älteren Berichten.
5. Ist HEAD gleich dem Commit in reports/last-green.json, entfällt der Lauf vor der Änderung.

Ziel: Der Morph ermittelt und zeichnet Flächen, noch ohne Farbe (neutrales Grau über vorhandene Standardfüllung, ohne Schreibzugriff auf Keyframe-Stores). Flächen nur bei Feld-Netz.

Regeln:
- Flächen nur wenn Flächen aktiv sind (showFaces / Keyframe-showFaces), Kurventyp `straight` und `activeNetWarp.field` gesetzt. Sonst keine Flächen.
- Flächen werden aus den interpolierten Segmenten pro Tile über `computeCellFaces` bestimmt (Referenz Prototyp, nur lesen: `/Users/flipmac/Documents/flip/The World of Forms/world_of_forms_morph_v2`, `_runSafeComputeCellFaces`, borderPoly aus `outerCorners`, `activeNetWarp = null` während der Flächenberechnung, danach Verzerrung der Polygone bei `activeNetWarp.field`).
- Keine Schreibaufrufe auf Keyframe-Stores (kein `ensureDefaultGrayFill` im Morph-Pfad).
- Freie Linienenden: werden regulär mitgeschnitten, Anzahl freier Enden bleibt unverändert.
- Neue Top-Level-Namen nur mit Präfix `spatialMorph[A-Z]`.
- Status-Text: bei Single/Tiled-Netz "Flächen im Morph nur bei Feld-Netz" (de/en, i18n-Test mitziehen). Bei Feld-Netz entfällt "Flächen folgen". Per Test belegen.

Nicht ändern: core/tiling.js, core/faces.js, die acht geschützten Funktionen in sketch.js, AUS-Pfad, Baselines.

Prüfpunkte (Orakel):
1. Flächen AUS oder Netz nicht Feld: keine Flächen gezeichnet, Linienausgabe identisch zu vorher.
2. Netz AUS / Morph AUS: Ausgabe byte-identisch zu tools/morph/off-path-golden.json.
3. Feld-Netz AN: Flächenzahl pro Tile > 0 bei einem Fall mit geschlossenen Zellen; jede Fläche ist ein geschlossenes Polygon.
4. Freie Linienenden: Anzahl vor und nach Flächenberechnung gleich.
5. `activeNetWarp` und p5-Style nach dem Draw exakt wie vorher, auch bei Exception.
6. core/tiling.js und core/faces.js unverändert (Pin/Hash).
7. Kein Schreibzugriff auf Keyframe-Stores (Store vor/nach deep-equal).

Sabotagen (höchstens 5), jeweils Test muss rot werden, danach zurücknehmen:
1. Feld-Bedingung entfernen.
2. activeNetWarp vor computeCellFaces nicht auf null setzen.
3. ensureDefaultGrayFill im Morph-Pfad aufrufen.
4. finally-Wiederherstellung entfernen.
5. Flächen auch im AUS-Pfad berechnen.

Prüfung: `bash tools/proof.sh L2 006`. Keine Baselines, kein Merge, kein Push.

Bericht (höchstens 40 Zeilen): Hash vor/nach, geänderte Dateien, Ergebnis je Prüfpunkt 1-7, Ergebnis je Sabotage (rot ja/nein), Testzahlen, Abweichungen, offene Punkte. Datei:Zeile nur per grep verifiziert.
