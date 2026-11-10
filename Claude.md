# CLAUDE.md

*The World of Forms*: Wilhelm Ostwald's form theory as a bilingual digital edition and a generative pattern
engine. This repo is the canonical generator (`sketch.js` UI shell, portable `core/` engine, `index.html`);
`die-welt-der-formen/p5_prototype/` is a manual copy target, `SpaceHarmony` the 3D extension.

## Read first
- `docs/agent-rules.md` - the standing rules (workflow, proof, code traps, reports). Binding.
- `docs/claude-context.md` - the full project context: key files, phone layout, sheets, patterns block,
  spatial morph, fixes, p5 reader, cache-busting, test history. Read the section you need.
- `docs/baselines.md` - the history of the layout baselines.
- `ROADMAP.md` - priorities and status per item (check before starting: much is partly done).
- `docs/terminology.md` - German/English terms and naming.

## Proof
- `tools/proof.sh L0|L1|L2|L3 NNN` - L0 syntax, L1 p5 names + protected tests (61, 57), L2 fast, L3 full.
  Before a commit: the level the task names. Short output; `VERBOSE=1` and `reports/logs/` have the rest.
- `tools/guard.sh BASIS` - `sketch.js` and `core/` unchanged against BASIS.
- Last full run: 2026-11-05, tree `1d393eda`, 95 files (91 `tools/` + 4 Farborgel), 0 failed.

## Current references
- Phone: `tools/ui/baseline-phone-5.json` (407 KB). Widths >= 768: `tools/ui/baseline-cleanup-11.json`
  (944 KB, 104 KB headroom to 1 MB: the next extension needs a trim). Both morph stage e2c, tree `b8723e9c`.
- Compare: `node tools/ui/compare-baseline.js <reference> <new file>`; 0 differences for no layout change.

## Recording a baseline
1. Serve the repo root, open a page of that origin in the pane, inject `tools/ui/record-baseline.js`.
2. Desktop: `recordBaseline({ width, pointer: 'native', expect })` for 375, 768, 768c, 936, 1032c, 1100,
   1100c, 1440, 1440c (c = real coarse pointer, Mobile preset; fine = Desktop preset).
3. Phone: `recordPhone({ width, expect: 'coarse', postTo })` for 320 / 375 / 430 (about 100 s each: poll),
   then `node tools/ui/merge-baseline.js out.json p320.json p375.json p430.json`.
4. All widths within ONE turn (the pane clears the viewport emulation when a turn ends).
5. Save as a NEW `baseline-*.json` with a `before` note; never edit an old one (`docs/baselines.md`).

## Now
State and next steps: `ROADMAP.md` ("Spatial morph: staged plan" > "Stand 2026-11-10", "Patterns block - STATUS",
"Sheets redesign - STATUS", "Merge readiness"). Morph state after task 038: d3 filter, line switch, playback and
spatial colours, SVG export and the frame memo are done; open: d3 relaxation, small items, Browser timing (ROADMAP).
