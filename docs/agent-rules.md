# Agent rules

The standing rules for every session in this repo, once. Detail and history: `docs/claude-context.md`.

## Working
- Analysis before action: read and cite files/lines first, show the plan, then work; verify before committing.
- One topic per commit; no push unless asked (GitHub Pages publishes on push).
- Feature work happens here, never in `die-welt-der-formen/p5_prototype/` (a manual copy target).
- Dependencies point one way: `sketch.js` -> `core/*`, never back. `core/` stays p5-free where it is today.
- Plain global `<script>` tags, no ES modules for the p5 files (global mode needs `setup`/`draw` on `window`).
- Use the terms of `docs/terminology.md`; no ad-hoc translations.

## Proof
- Before every commit: the full suite, `tools/proof.sh L3 NNN` (about ten minutes). `tools/proof.sh L2 NNN`
  (the three slow face/inherit suites skipped) only while iterating, never before a commit touching
  `core/faces.js` or `core/facecolor.js`.
- `tools/proof.sh L1 NNN`: `test-p5-names.js` and the two protected netwarp tests (61 and 57, each alone).
- `tools/guard.sh BASIS` when a task says `sketch.js` and `core/` stay unchanged.
- A new test is a `tools/<dir>/test-*.js` that exits non-zero on failure; the glob picks it up.
- Clean-export check before a merge or when a page or script tag changes (`git archive HEAD`, serve, check
  `index.html`, `gallery.html`, `color-harmony/ui/index.html`).

## Code traps
- Bump `?v=` on every local-script change, in `index.html`, `gallery.html` and `color-harmony/ui/index.html`
  together; a new ES module needs an import-map entry (`tools/color/test-esm-cachebust.js`). The same `?v=`
  may be served stale in the browser: bump before trusting a load.
- No `/* */` inside `setup()` or `draw()`, no variable named like a p5 member there (`test-p5-names.js`).
- Phone CSS: every rule of the phone block sits in `@media (max-width: 767px)` and starts with `html.ph`;
  nothing above it mentions `html.ph` or `.ph-`. A new `html.ph` rule needs its surface twin or a listing
  as phone-only (`tools/ui/test-phone-config.js`).
- Phone views re-parent existing elements (never clone) and forward ONE click to hidden models; German as
  authored, English only in `ui-i18n.js`.
- Baseline files `tools/ui/baseline-*.json` are history once superseded: never edit them, record a new one
  (`docs/baselines.md`).

## Reports
- A task `tasks/NNN-*.md` ends with `reports/NNN.md`: status, commit, `git diff --stat`, proof output,
  deviations. Raw logs stay in `reports/logs/` (not committed).
