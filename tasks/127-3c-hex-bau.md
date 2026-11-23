# Auftrag 127 — 3C-4 Bau: Abweichungen gegenüber Plan 125

Stand: nur der Zusatz-Fix (veraltetes `family`) in Arbeit; der Sechseck-Kern folgt nach Neustart des Wochenkontingents. Bisher keine Abweichung vom Plan 125. Gefunden beim Lesen: `captureNetAnimationEnd` (`sketch.js`) klont `baseNetTransform` selbst, ruft `netSpecSnapshot` nicht auf; der Fix dort ist eine Zeile (Aufruf von `netSpecSnapshot()`), nicht in den acht geschützten Funktionen. Pin in `sketch.js`-Basis-Tests: eigener Commit, falls ein Test anschlägt.
