# CLAUDE.md

Project context for Claude Code sessions. See `ROADMAP.md` for current priorities and implementation status, and `docs/terminology.md` for naming conventions.

## Project

This repository is part of *The World of Forms* — a research project reviving and extending Wilhelm Ostwald's form theory (*Die Harmonie der Formen*, 1922; *Die Welt der Formen*, 1922–25), combining a bilingual critical digital edition with a generative pattern engine derived from Ostwald's rule system.

## Related repositories

- `world_of_forms_generator` (this repo) — the canonical, actively developed pattern generator (`sketch.js`, `core/`, `index.html`). All generator feature work happens here.
- `die-welt-der-formen` — website: Observable-notebook-derived `.js` files for the bilingual editions, plus a `p5_prototype/` folder that embeds a *copy* of this generator once it's stable. `p5_prototype/` is a deployment target, synced manually from here — not a second development location.
- `SpaceHarmony` — Three.js 3D extension; the target for Roadmap item 1.7 (solid forms)

## Key files (generator)

The generator is split into a portable `core/` engine and a `sketch.js` UI shell, loaded as plain global `<script>` tags (no bundler, no ES modules - see "Loading mechanism" below for why). Dependencies point one way: `sketch.js` → `core/*`, never the reverse. This is what lets `die-welt-der-formen/p5_prototype` embed the same engine under a different, reduced UI shell without needing to diff the whole file.

- `core/forms.js` — pure grid/node generation (`buildTriangleGrid`, `buildSquareGrid`, `buildHexGrid`). No rendering, no p5 dependency (uses `Math.sqrt()`, not p5's global `sqrt()`).
- `core/state.js` — shared mutable state (canvas/shape params, `nodes`/`connections`/`centroid`/`outerCorners`, `svgPathCollector`) plus `rebuildGrid()` and `toTileLocal()`, the two functions most tightly coupled to it.
- `core/symmetry.js` — the Ostwald symmetry-group engine: `rotateAround`/`reflectVerticallyAround` and `drawConnectionWithSymmetry` (supports reflection and pure-rotation modes). Where roadmap 1.9/1.11 (combinatorics, Burnside/Pólya enumeration) will extend.
- `core/curves.js` — curve substitution (`drawCurvedBezier`), dual-mode (canvas draw or SVG path collection via `svgPathCollector`). Where roadmap 1.4/1.5 (systematic curve variants, free "clothing") will grow.
- `core/tiling.js` — plane tessellation (`drawTessellation`, `drawShapeCell`, `tileTriangle`/`tileSquare`/`tileHex`). Where roadmap 1.3(b) (offset overlays / pattern combination) hooks in.
- `core/export.js` — `buildExportData` (the documented prerequisite for roadmap 1.10's face-detection pass), `exportPNG`/`exportJSON`/`exportSVG`.
- `sketch.js` — the UI shell: `setup()` (DOM/event wiring for every control), `draw()`/`mouseMoved()` (render loop), `mousePressed()`/`addRandomConnection()` (interaction), `normSym()`. Expected to diverge from `p5_prototype`'s own shell by design (dropdown/color-picker/free-endpoint toggle presence differs) - do not force this file into a shared module.

**Loading mechanism note:** p5 runs in *global mode* here, which requires `setup`/`draw`/`mousePressed`/`mouseMoved` to be plain `window` properties for its auto-bootstrap to find them. Switching any of these files to `type="module"` would break that silently (module-scoped declarations aren't `window` properties) unless every lifecycle hook were explicitly reassigned or the whole sketch migrated to p5 *instance mode* - out of scope for a file-organization change. Cross-file communication works via ordinary shared globals; `<script>` tag order in `index.html` only needs `core/*.js` before `sketch.js` (nothing does a top-level, module-eval-time read of another file's state).

**Sync to `die-welt-der-formen/p5_prototype`:** not yet automated (deliberately - see the module-split planning session referenced in git history for reasoning). The `core/` subdirectory is the intended future "copy these files verbatim" boundary; revisit an actual copy mechanism once `core/`'s shape has survived 1.3(b) and later Stage 1-2 items without another reshuffle.

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