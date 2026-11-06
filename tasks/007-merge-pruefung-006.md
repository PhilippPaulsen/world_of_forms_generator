# 007 Merge-Prüfung 006a/006a2/006a3 und ROADMAP-Eintrag
Typ: M
Stufe: L3
Git: neuer Branch task/007-merge-pruefung-006 von task/006a3-flaechen-luecken (HEAD 6943b1cf).
     Erlaubte Commits: (1) ROADMAP.md, (2) reports/007.md plus diese Task-Datei.
     Kein Merge, kein Push. git status vorher leer (außer dieser Task-Datei), sonst STOP.
Regeln: docs/agent-rules.md. Kein Browser, keine Baselines, kein Code ändern.
Zeilenangaben aus älteren Berichten nicht übernehmen, immer mit grep suchen.

Aufgaben:
1. `tools/proof.sh L3 007` (volle Suite, einmal). Die zwei geschützten Tests mit eigener Zahl melden.
2. `git diff --stat main..HEAD`: Liste aller geänderten Dateien. Erwartet: core/spatial-morph-render.js,
   tools/morph/test-spatial-morph-render.js, tools/morph/test-spatial-morph-faces.js,
   tools/ui/test-morph-view.js, i18n-Test, ui-i18n.js, ui-morph.js, tools/proof.sh,
   tasks/ und reports/. Jede weitere Datei nennen; liegt sie in Aufgabe 3, STOP.
3. `git diff main..HEAD --quiet -- sketch.js core/tiling.js core/faces.js core/spatial-morph.js
   tools/morph/off-path-golden.json` muss Exit 0 liefern. Ergebnis melden.
4. tools/proof.sh: Diff gegen main zeigen (nur die Änderung an der Nummernprüfung).
   Prüfen: `tools/proof.sh L0 006a3` und `tools/proof.sh L0 007` werden akzeptiert,
   `tools/proof.sh L0 12` und `tools/proof.sh L0 abc` werden abgelehnt. Ergebnis melden.
5. Baselines NICHT aufnehmen. grep in baseline-cleanup-11.json und baseline-phone-5.json nach den
   neuen Statustexten ("Netz verzerrt Linien", "Flächen im Morph nur bei Feld-Netz", "Morph faces: field net only").
   Betroffen ja/nein, welcher Snapshot.
6. AUS-Pfad-Golden im Browser: Ermittle, wie tools/morph/off-path-golden.json im Browser geprüft wird
   (Kopfkommentar einer Datei unter tools/morph/ oder in der Doku). Gib mir die genauen Schritte oder
   das Konsolenskript zum Kopieren, mit erwartetem Ergebnis. NICHT selbst ausführen.
   Wenn nichts auffindbar ist: sagen, nicht raten.
7. ROADMAP.md: im Eintrag "Spatial morph: staged plan" ergänzen (nur diese Punkte, knapp):
   - erledigt: Netz im Morph (Option A, Task 004), Flächen im Morph ohne Farbe (006a, 006a2);
     Flächen nur bei Quadrat, geraden Linien und Flächen an für alle Keyframes; bei Single/Tiled-Netz
     keine Flächen (Status netFacesNeedField).
   - bekannte Einschränkung: Flächen-Lücken bei dichten Linienmustern (Deckung bis 0,957, 9 von 12
     dichten Testpaaren linear), Ursache core/faces.js (FACE_EPSILON 0.5, kollineare Überlappung nicht
     geschnitten), tritt im Normalbild identisch auf. Optionen A (Fix nur im Morph, 1 bis 2 Commits)
     und B (core/faces.js, 2 bis 3 Commits) offen, Entscheidung: vorerst nicht beheben.
   - offen: Farbe im Morph (006b), Frame-Zeit mit Flächen ca. 81 ms in Node (121 Kacheln), kein Cache.
8. /usage vorher und nachher im Bericht.

Bericht reports/007.md, höchstens 30 Zeilen: Status, Zahlen, Ergebnis zu 2 bis 6.