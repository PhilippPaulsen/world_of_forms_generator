# CLAUDE.md

Project context for Claude Code sessions. See `ROADMAP.md` for current priorities and implementation status, and `docs/terminology.md` for naming conventions.

## Project

This repository is part of *The World of Forms* — a research project reviving and extending Wilhelm Ostwald's form theory (*Die Harmonie der Formen*, 1922; *Die Welt der Formen*, 1922–25), combining a bilingual critical digital edition with a generative pattern engine derived from Ostwald's rule system.

## Related repositories

- `world_of_forms_generator` (this repo) — the canonical, actively developed pattern generator (`sketch.js`, `forms.js`, `index.html`). All generator feature work happens here.
- `die-welt-der-formen` — website: Observable-notebook-derived `.js` files for the bilingual editions, plus a `p5_prototype/` folder that embeds a *copy* of this generator once it's stable. `p5_prototype/` is a deployment target, synced manually from here — not a second development location.
- `SpaceHarmony` — Three.js 3D extension; the target for Roadmap item 1.7 (solid forms)

## Key files (generator)

- `forms.js` — pure grid/node generation (`buildTriangleGrid`, `buildSquareGrid`, `buildHexGrid`). No rendering, no p5 dependency except `sqrt()` in the hex builder.
- `sketch.js` — p5 sketch: UI, symmetry engine (`drawConnectionWithSymmetry`, supports reflection and pure-rotation modes), tessellation (`tileTriangle`/`tileSquare`/`tileHex`), curve rendering (`drawCurvedBezier`), and export (`exportPNG`/`exportJSON`/`exportSVG`, via `buildExportData`).

## Workflow conventions

- **Analysis before action.** Read and reference specific files/lines first; get explicit go-ahead before implementing; verify (including live browser testing where relevant) before committing.
- **GitHub Pages deployment.** This repo is hosted via GitHub Pages and embedded via iframe elsewhere (see README). Edits only go live after commit + push — a locally opened `index.html` reflects uncommitted changes, but the embedded/hosted version does not until pushed.
- **Thematically isolated commits.** One topic per commit; push separately per topic rather than batching unrelated changes.
- **Step-by-step approval.** Prefer proposing a plan and getting confirmation per step over large unreviewed changes.
- **This repo is upstream of `die-welt-der-formen/p5_prototype/`.** Feature work happens here first; `p5_prototype/` is synced manually once a version is stable (see Related repositories above). Don't develop features directly against `p5_prototype/`.

## Terminology

German↔English terminology for Ostwald's vocabulary (mirror pair, rotational form, node, theme line, tip, star, wreath, portfolio/sheet, etc.) is documented in `docs/terminology.md`, along with a proposed systematic (Hinterreiter-style) pattern-naming scheme intended for Roadmap item 1.11. Use the established English terms consistently in code, UI labels, and comments — do not introduce new translations ad hoc.

## Current priorities

See `ROADMAP.md`. As of this writing, Stage 1 (net-order verification, pattern combination/"Verbindungen" logic) is the active near-term focus; the roadmap includes an implementation-status tag (✅/🟡/⛔) per item based on a code review — check that a task isn't already partially done before starting from scratch.