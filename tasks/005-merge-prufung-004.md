# 005 Merge-Prüfung Task 004
Typ: M (nur prüfen, nichts ändern außer reports/005.md)
Stufe: L3
Basis: Branch task/004-morph-netz, HEAD 239fe51e. git status muss leer sein (sonst STOP).

Aufgaben:
1. `tools/proof.sh L3 005` (volle Suite, einmal). Die zwei geschützten Tests mit eigener Zahl melden (61, 57).
2. `git diff --stat main..HEAD`: nur diese Dateien dürfen erscheinen: core/spatial-morph-render.js,
   tools/morph/test-spatial-morph-render.js, tools/ui/test-morph-view.js, ui-i18n.js, ui-morph.js,
   reports/003.md, reports/004.md. Jede weitere Datei: STOP und melden.
3. `git diff main..HEAD --quiet -- sketch.js core/tiling.js tools/morph/off-path-golden.json`
   muss Exit 0 liefern. Ergebnis melden.
4. Baselines: NICHT aufnehmen. Prüfen, ob ui-morph.js oder ui-i18n.js einen Text ändern, der in
   baseline-cleanup-11.json oder baseline-phone-5.json (Snapshots morph_block, morph_block_radial)
   erfasst ist: mit grep nach dem alten und dem neuen Status-Text in beiden Baseline-Dateien.
   Ergebnis nennen: betroffen ja/nein, welcher Snapshot.
5. Verbrauch: /usage vorher und nachher im Bericht nennen.

Regeln: docs/agent-rules.md. Keine Änderungen an Code, kein Merge, kein Push, kein Commit außer
reports/005.md. Bericht höchstens 25 Zeilen: Status, Zahlen, Ergebnis zu 2, 3, 4.