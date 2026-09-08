# CLAUDE.md

Project context for Claude Code sessions. See `ROADMAP.md` for current priorities and implementation status, and `docs/terminology.md` for naming conventions.

## Project

This repository is part of *The World of Forms* — a research project reviving and extending Wilhelm Ostwald's form theory (*Die Harmonie der Formen*, 1922; *Die Welt der Formen*, 1922–25), combining a bilingual critical digital edition with a generative pattern engine derived from Ostwald's rule system.

**⚠️ Open question, verify before assuming repo layout:** This repo may contain a `p5_prototype/` copy of the generator (`sketch.js`, `forms.js`) that duplicates or diverges from the standalone `world_of_forms_generator` repo. Before editing generator code, confirm which copy is canonical — check for drift between `p5_prototype/` here and the equivalent files in `world_of_forms_generator`, and consolidate if needed rather than editing both independently.

## Related repositories

- `world_of_forms_generator` (this repo) — the canonical, actively developed pattern generator (`sketch.js`, `forms.js`, `index.html`). All generator feature work happens here.
- `die-welt-der-formen` — website: Observable-notebook-derived `.js` files for the bilingual editions, plus a `p5_prototype/` folder that embeds a *copy* of this generator once it's stable. `p5_prototype/` is a deployment target, synced manually from here — not a second development location.
- `SpaceHarmony` — Three.js 3D extension; the target for Roadmap item 1.7 (solid forms)

## Key files (generator)

- `forms.js` — pure grid/node generation (`buildTriangleGrid`, `buildSquareGrid`, `buildHexGrid`). No rendering, no p5 dependency except `sqrt()` in the hex builder.
- `sketch.js` — p5 sketch: UI, symmetry engine (`drawConnectionWithSymmetry`, supports reflection and pure-rotation modes), tessellation (`tileTriangle`/`tileSquare`/`tileHex`), curve rendering (`drawCurvedBezier`), and export (`exportPNG`/`exportJSON`/`exportSVG`, via `buildExportData`).

## Workflow conventions

- **Analysis before action.** Read and reference specific files/lines first; get explicit go-ahead before implementing; verify (including live browser testing where relevant) before committing.
- **Isolated sandbox filesystem.** Claude Code's edits do not reach the locally running dev server until committed and pushed (and sometimes the local checkout needs a pull too). Don't assume a live browser test reflects an uncommitted edit — this has caused confusion before.
- **Thematically isolated commits.** One topic per commit; push separately per topic rather than batching unrelated changes.
- **Step-by-step approval.** Prefer proposing a plan and getting confirmation per step over large unreviewed changes, especially for anything touching the published website content (the two Observable-derived `.js` files are large and hand-verified — regenerate via the documented export pipeline, don't hand-edit generated sections).

## Terminology

German↔English terminology for Ostwald's vocabulary (mirror pair, rotational form, node, theme line, tip, star, wreath, portfolio/sheet, etc.) is documented in `docs/terminology.md`, along with a proposed systematic (Hinterreiter-style) pattern-naming scheme intended for Roadmap item 1.11. Use the established English terms consistently in code, UI labels, and comments — do not introduce new translations ad hoc.

## Current priorities

See `ROADMAP.md`. As of this writing, Stage 1 (net-order verification, pattern combination/"Verbindungen" logic) is the active near-term focus; the roadmap includes an implementation-status tag (✅/🟡/⛔) per item based on a code review — check that a task isn't already partially done before starting from scratch.