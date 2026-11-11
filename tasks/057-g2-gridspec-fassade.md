# Auftrag 057 — G2 GridSpec-Fassade

**Typ K, Prüfstufe L3.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/057-g2-gridspec-fassade.md mit diesem Text an. Bericht: reports/057.md (höchstens 30 Zeilen). Branch: task/057-g2-gridspec-fassade von main. Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Grundlage:** reports/055.md (Entwurf, §1 bis §6) und reports/056.md (Gegenlesung). Entscheidungen: nodeCount bleibt als abgeleitete interne Brücke (core/tiling.js unverändert); Lage 2 noch nicht live.

**Ziel (eine Kernänderung, G2):** GridSpec-Fassade über den BESTEHENDEN Lage-1-Buildern. core/forms.js: validateGridSpec, maxOrdnungFor, buildGrid(spec, view) als Wrapper über buildTriangleGrid/buildSquareGrid/buildHexGrid; Adapter fromLegacy/toLegacy. core/state.js: setGrid(spec), gridRevision; rebuildGrid über die Fassade, Legacy-Signatur bleibt. Keine Live-Umstellung von UI, Session, Katalog, Orbits, Netz.

**Adapter (Korrektur aus 056):** hex: ordnung = c, toLegacy = n. triangle/square: c >= 2 -> ordnung = c-1, toLegacy = n+1. c = 1 (triangle/square) ist NICHT invertierbar (alignLayerToBase false, Netz E = 0 gegenüber c = 2): c = 1 bleibt Legacy-Sonderfall mit eigener Abbildung, die Verhalten byte-gleich erhält; per Test belegen (tools/nodecount/test-nodecount-limits.js und tools/session/test-session-plan.js testen order = 1). Lage 2 wird nie aus Legacy abgeleitet und von validateGridSpec in G2 abgelehnt.

**Pins (aus 056, zu prüfen und nur mit eigenem Commit und Begründung anzupassen):** tools/session/test-session-plan.js (Quelltext-Regex auf buildTriangleGrid(nodeCount, ...)), tools/nodecount/test-nodecount-limits.js, tools/ui/test-layer-api.js, tools/netwarp/test-netwarp-animation.js, test-netwarp-facefield.js, tools/color/test-anchor.js, test-farborgel-selection.js, tools/morph/test-spatial-morph-prototype.js; Harnesse tools/session/fixtures.js, scenarios.js, tools/morph/off-path-script.js, render-harness.js, morph-harness.js, tools/color/corpus.js. Vor der Arbeit `git grep -l -E 'rebuildGrid|buildTriangleGrid|layerGrid|nodeCount|orbitIds' -- tools` erneut laufen lassen und die Liste im Bericht.

**Nicht ändern:** acht geschützte Funktionen in sketch.js (byte-gleich), core/faces.js, core/facecolor.js, core/tiling.js, tools/morph/off-path-golden.json, Baselines. ?v= gemeinsam bumpen (Muster 8 Ziffern + Buchstaben, z. B. 20261113g2fa).

**Prüfpunkte:** (1) Lage-1-Koordinaten, Knoten-IDs und Reihenfolge byte-gleich zu vorher für alle Formen und nodeCount 1 bis 7 (Test gegen alte forms.js aus git). (2) Adapter-Roundtrip für c >= 2 (hex ab 1); c = 1 Sonderfall nachgewiesen. (3) validateGridSpec lehnt lage 2, ordnung 0, unbekannte Form explizit ab. (4) rebuildGrid verhält sich wie vorher (Linien, Ebenen, Timeline wie heute; redoStack-Verhalten NICHT ändern, in 056 als bestehende Lücke belegt, nur im Bericht nennen). (5) Frames des Morphs t = 0, .25, .5, .75, 1 byte-gleich. (6) AUS-Pfad-Golden im Browser 30/30. (7) Geschützte Tests 61/61 und 57/57, test-p5-names.

**Sabotagen (je auf Kopien):** hex ebenfalls -1; Dreieck c = 1 -> ordnung 0; Lage 2 durchgelassen; setGrid erhöht gridRevision nicht.

**Prüfung:** bash tools/proof.sh L3 057 plus AUS-Pfad-Golden im Browser (Verfahren: Kopfkommentar tools/morph/measure-off-path.js). Bericht: Hashes, Pin-Liste, Messwerte, Sabotagen, /usage vorher/nachher, was nicht im Browser gesehen wurde.
