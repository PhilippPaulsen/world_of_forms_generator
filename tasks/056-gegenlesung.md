# Auftrag 056 — Gegenlesung von reports/055.md

## Ziel
Unabhängige Gegenlesung des Gitter-Umsetzungsentwurfs (`reports/055.md`) gegen den realen Code sowie gegen `reports/051.md`, `reports/052.md` und `reports/054.md` (read-only im übrigen Repo).

## Prüfpunkte
1. Stimmen die genannten Funktionen, Dateien, Konstanten (`NODE_COUNT_MAX`, `assertNotDegenerateOrder`, `_pairKey`, `rebuildGrid`, `netWarpForBase`, `tiling`-Zugriff auf `nodeCount`) mit dem Code überein? Liste der Falschangaben.
2. Fehlen Dateien oder Verbraucher von `nodeCount`, `orbitIds`, Orbit-IDs, Gallery-Pfaden (`git grep` über das ganze Repo, nicht nur `core/` und `tools/`)? Vollständigkeit der Testliste §4 prüfen (`git grep -l`).
3. Sind G2 bis G7 je eine Sitzung (eine Kernänderung)? Besonders G5 und G6: Umfang in Dateien und Funktionen zählen; Vorschlag zur Teilung, falls zu groß.
4. Die acht Gegenleserrisiken (§7): je Risiko bestätigt / widerlegt / offen mit Beleg.
5. Widersprüche des Entwurfs in sich (z. B. `tiling` bytegleich vs. `nodeCount`; `main` grün je Schritt; Adapter-Formeln `fromLegacy`/`toLegacy` gegen `core/forms.js` nachrechnen für alle drei Formen und `nodeCount` 1 bis 7).
6. Fehlende Messgrößen oder Sabotagen je Auftrag (G2–G7, UI).

## Rahmenbedingungen
- Read-only außer `tasks/056-gegenlesung.md` und `reports/056.md`.
- Bericht `reports/056.md` höchstens 60 Zeilen, jede Aussage mit `Datei:Funktion` und `grep` belegt.
- Eigener Branch `task/056-gegenlesung` (von `task/055-gitter-entwurf`), kein Merge, kein Push.
