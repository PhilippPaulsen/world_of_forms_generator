# Auftrag 125 — 3C-4 Vorbereitung: Möbiusnetz am Sechseck, Messplan (Typ R/U)

Branch `task/125-3c-hex-messung` von main (`f31d547f`, enthält 124 und 126). Nichts in `core/`, `sketch.js`, `ui-*.js` geändert. Nicht gemergt, nicht gepusht, `docs/quellen/` nicht committet.
Ehrlicher Vermerk: dieser Plan ist nach einer ersten Sichtung der Quellseiten und einem Probelauf geschrieben (Reihenfolge des Auftrags nicht eingehalten); die Messungen unten sind die endgültigen.

Fragen und Messungen:
1. Auslassregel: Wortlaut Hinterreiter II, S. 14 (Datei `114.png`) und S. 52 (`152.png`); Regel als Modell (Variante A/B, Nebenklasse c) in `tools/grid/measure-3c-hex.js`; Abgleich mit Fig. 165, 166, 167 pixelweise (`measure-3c-hex-bild.js`).
2. Modell am Sechseck-Feld der App (`core/netwarp.js` `_netHexField`, `core/tiling.js` `tileHex`) lesen; Zuordnung (p, q) zu Kacheln.
3. W gegen Quelle, Geradheit (0 px), Streckung und brauchbare (a, b) je Canvas-Verhältnis.
4. Fluchtlinie, Kachelzahl b = 9 und 12, a ≥ 1 oder a ≥ 2.
5. Format ganz/halb (schneidet die Mittelachse Sechsecke?).
Zusatz: `tools/grid/check-3c-family-stale.js` (nur lesen).
