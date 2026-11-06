# Report 005 (Morph-Texte) - Typ U, L1
**Status:** erledigt, L1 grün, nur Text geändert. Kein Merge, kein Push.
**Hash:** vorher `3e607de8` (Branch `task/005-morph-texte` von `main`), nachher `d736ed37`.
Dateiname `005-morph-texte.md` statt `005.md`: `reports/005.md` ist der schon committete Bericht der Merge-Prüfung (Task 004).

## Abweichungen vom Auftrag
- HEAD war `3e607de8` (`usage.csv`), nicht `7ba41ee5`; `7ba41ee5` ist Vorfahr, dazwischen nur `usage.csv`. `git status` leer.
- `tasks/005-morph-texte.md` gibt es nicht; der Auftrag kam als Text.
- Der Status-Text war schon `Netz verzerrt Linien; Flächen folgen` (de) / `Net warps lines; faces follow` (en), Task 004. Unverändert.

## Geänderte Dateien (7, +13/-13)
Claude.md 4, ROADMAP.md 6, core/spatial-morph-render.js 4, core/spatial-morph.js 4, docs/claude-context.md 2, tools/ui/test-morph-view.js 4, ui-morph.js 2.
Bestätigt: in `core/`, `ui-morph.js` und dem Test ändern sich nur Kommentare und Teststrings (Diff gelesen, `node --check` ok).

## Ersetzte Texte (alt -> neu)
- core/spatial-morph-render.js, Kopf: „the face fills and the net warp are NOT drawn“ -> „the face fills are NOT drawn (…not yet implemented); the net warp IS applied to the lines“.
- core/spatial-morph-render.js, Statuscodes: „(the morph ignores the net)“ -> „(the net warps the LINES: activeNetWarp is set around the draw and restored in the finally; faces and colour are not yet part of the morph)“.
- core/spatial-morph.js: „drawn WITHOUT the net … (the prototype ignores the net as well)“ -> „drawn and a net warp is in force (the net warps the lines …)“.
- ui-morph.js, Kopf: „net ignored“ -> „net warps lines; faces follow“.
- test-morph-view.js: „a net ignored shows the seam“ -> „a net warp note shows the seam“; „net ignored“ -> „the net warp note“.
- ROADMAP.md (4 Stellen), docs/claude-context.md (2): Text „Netz wird ignoriert“ -> neuer Text mit „until task 004“; Stage-e2b-Stand und Offener Punkt (1) als erledigt markiert.
- Claude.md „Now“: „the net in the morph (options A / B / C…)“ -> „faces and colour in the morph (the net is done, task 004)“; 38 Zeilen.
Absichtlich stehen geblieben: „Netz wird ignoriert“ als Verlauf („until task 004“) in ROADMAP.md:276/279 und docs/claude-context.md:38; `reports/003.md`, `004.md`, `005.md` (Berichte, Historie).

## Prüfung
`tools/proof.sh L1 005`: 61/61, 57/57, files 3, PASS. Zusätzlich: test-morph-view 97/97, test-spatial-morph-render PASS, test-i18n PASS.
`git diff --quiet main` für sketch.js, core/tiling.js, off-path-golden.json, baseline-phone-5.json, baseline-cleanup-11.json: Exit 0. AUS-Pfad und die acht geschützten Funktionen nicht berührt.

## Offene Punkte
- „Flächen folgen“ / „faces follow“ kann als „Flächen folgen dem Netz“ gelesen werden; der Morph zeichnet aber noch keine Flächen. Eher Ankündigung als Ist-Stand: Wortlaut entscheiden.
- Zeilennummern oben per grep, nicht neu verifiziert nach den Edits.
