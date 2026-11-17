# Auftrag 086 — Netz: 2D-Feld X × Y beim Quadrat, Konsistenz bei X≠Y (Typ K, L3)

Auftrag (Auftraggeber, gekürzt wiedergegeben; Originaltext im Chat):
Branch task/086-netz-feld-2d von main (317d0132). Anlass Bericht 085: bei X≠Y mit ungeradem min(X,Y) lesen drawTessellation,
spatialMorphRenderDraw, buildExportData, initNetControls, applyNetKindChoice, netControlsSync `shapeSizeFactor`, während netWarpBaseNow
NaN (Einzel) sieht (bis 25,73 px Versatz); das Feld kennt nur ein Rt.

Festlegungen: Feld nur beim Quadrat, nur wenn X UND Y ungerade aus {3,5,7,9}; sonst Einzel mit Hinweis (de/en). Das Feld überspannt
X × Y Makrokacheln auf W × H. X=Y byte-gleich. core/tiling.js BYTE-GLEICH (Feldrechteck in warp.c0/v1/v2 mit f.h=0, f.Rt=1, Basiskachel
in warp.frame; sonst STOP mit 2 Optionen). Nicht Teil: Dreieck/Sechseck, getrennte Teilungen, weitere Netzarten. Kein neues Bedienelement.

Zu tun: (1) Stellen messen; (2) core/state.js netSizeFactors() = eine Quelle; (3) core/netwarp.js Feld mit (Rx, Ry); (4) Export fieldTiles
X bei X=Y, sonst {x,y}; Session-Schema unverändert; (5) resizeBase-Hinweis nur wenn Einzel tatsächlich gilt; (6) UI ohne neue Elemente:
#net-field-btn disabled genau bei Einzel, Readout „Feld: 3 × 5 Kacheln“, sizeCompute im Feld (zu: X=Y 3↔5↔7↔9; offen: je Achse ungerade Zweierschritte);
(7) nicht ändern: core/tiling.js, faces.js, facecolor.js, acht geschützte Funktionen in sketch.js, off-path-golden.json, Baselines, Katalog.

Prüfpunkte: X=Y byte-gleich; measure-net-format.js erweitert (16 Paare); neuer Test tools/grid/test-net-field-2d.js; Browser; Sabotagen auf Kopien.
Prüfung: bash tools/proof.sh L3 086 plus AUS-Pfad-Golden im Browser. Bericht reports/086.md. Ungemergt, kein Push.
