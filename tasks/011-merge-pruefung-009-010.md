# 011 Merge-Prüfung 009/010, ROADMAP, AUS-Pfad-Golden im Browser
Typ: M
Stufe: L3
Git: neuer Branch task/011-merge-pruefung von task/010-morph-farbe-korrektur (HEAD b61b1165).
     Erlaubte Commits: (1) ROADMAP.md, (2) reports/011.md plus diese Task-Datei.
     Kein Merge, kein Push. git status vorher leer (außer dieser Task-Datei), sonst STOP.
Regeln: docs/agent-rules.md. Keine Baselines aufnehmen, kein Code ändern.
Zeilenangaben aus älteren Berichten nicht übernehmen, immer mit grep suchen.
Arbeitsordner: das Repo-Root.

Aufgaben:
1. `tools/proof.sh L3 011` (volle Suite, einmal, bis zum Ende). Die zwei geschützten Tests mit
   eigener Zahl melden.
2. `git diff --stat main..HEAD`: jede geänderte Datei mit dem Commit, aus dem sie stammt.
   Erwartet: core/spatial-morph-render.js, core/spatial-morph.js, tools/morph/*,
   ROADMAP.md, tasks/, reports/, usage.csv. Weitere Dateien nennen; liegt eine in Aufgabe 3, STOP.
3. `git diff main..HEAD --quiet -- sketch.js core/tiling.js core/faces.js core/facecolor.js
   tools/morph/off-path-golden.json` muss Exit 0 liefern. Für core/spatial-morph.js den Diff
   gegen main zusammenfassen: nur Helfer und Statuscodes, keine Änderung an bestehender Logik?
4. Baselines NICHT aufnehmen. grep in baseline-cleanup-11.json und baseline-phone-5.json nach allen
   Statustexten, die seit main neu oder geändert sind (aus ui-i18n.js und ui-morph.js ableiten).
   Betroffen ja/nein, welcher Snapshot.
5. ROADMAP.md, Eintrag "Spatial morph: staged plan", knapp ergänzen:
   - erledigt: Netz im Morph (Task 004), Flächen (006a, 006a2), Farbe im Morph (009, 010):
     Eckfelder als Raster, Flächenmittel; Grautöne wie im Normalbild.
   - bekannte Einschränkungen: Flächen-Lücken bei dichten Linien (Ursache core/faces.js, siehe
     006a3); Farb-Blitzer beim Ziehen bei dichten Mustern (reduziert, beim Abspielen nicht sichtbar;
     Rest: 60 bis 69 % der Flächen zwischen Schritten nicht zuordenbar; Optionen: Raster glätten
     1 Commit, Flächen verfolgen 3+ Commits); radial 28 Farbänderungen in stehenden Kacheln
     ungeklärt; Schwellen bei p = 1 gelockert (65 % innerhalb 2, größter Abstand 12); Rand-Regionen
     ohne Füllung im Normalbild bekommen im Morph Grau; Ebene ohne Füllung: nur Linien (Entscheidung
     offen); Bilinear mit 3 oder 4 Ebenen animiert nicht; Frame-Zeit mit Farbe 211 ms bei p = 0,5
     (Node, 121 Kacheln, ohne Cache), Optionen im Bericht 009.
   - Wunsch für später: Linien programmweit ausblenden können.
6. AUS-Pfad-Golden im Browser, Verfahren aus dem Kopfkommentar von tools/morph/measure-off-path.js
   (wie Task 008 / reports/008.md):
   Eigenen Server aus dem Repo-Root auf Port 8962 (Port 8961 und node-Prozess auf 64269 nicht
   anfassen), Markerdatei, Seite sichtbar (document.visibilityState), error- und
   unhandledrejection-Listener vor den Seiten-Skripten, `await measureOffPath({})` zweimal,
   zweiter Lauf gegen pixelHashes in tools/morph/off-path-golden.json: erwartet 30 von 30 gleich.
   Danach alles beenden, was du gestartet hast, und auflisten, was noch läuft.
   Bei Abweichung: STOP, Anzahl und Namen nennen, keine Ursache raten.
7. /usage vorher und nachher im Bericht.

Bericht reports/011.md, höchstens 30 Zeilen: Status, Zahlen, Ergebnis zu 2 bis 6.