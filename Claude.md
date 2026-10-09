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

**`sketch.js` and p5's friendly-error reader (the non-minified `p5.js` is loaded, so it runs at every page load).** It reads the source of `setup()` and `draw()` only, and two things in it produce console output on every load: (1) **no block comments (`/* */`) inside `setup()` or `draw()`**: its comment stripper loops forever when a `*/` precedes the first `/*` (`setup()` has a line comment containing `*/`), and every load logs `Uncaught RangeError: Invalid string length` (`tools/session/test-session-wiring.js` fails on a `/*` in either function; ROADMAP "Gotcha: no block comments"). (2) **No variable or function named like a p5 member in `setup()` or `draw()`**: it takes every line that contains `let` or `const` and no `//`, extracts the declared names and compares them with the members of p5's 29 constructors (about 420 names, among them `dot`, `add`, `set`, `get`, `copy`, `size`, `value`, `width`, `height`, `fill`, `image`, `id`, `html`, `limit`, `position`; `name`, `parent`, `print`, `stop` and the lifecycle functions are exempt) and with p5's constants (about 125, `PI`, `TWO_PI`, ...); at the top level of any script it also compares globals with about 40 global p5 function names. A hit logs `you have used a p5.js reserved function "dot"`. **Checked (2026-10-09): a p5 name written in quotes inside a `//` comment does NOT trigger it** (a line with `//` is skipped); the trigger was a `const dot` declared in `setup()`. Guard test: not built (see ROADMAP, a cheap extension of the wiring guard: the same line filter and regexes against a frozen list of the p5@1.9.0 names).

**When you check a changed script in the browser, the same `?v=` URL may come from the cache:** a changed `sketch.js` under an unchanged `?v=` was served stale during a check on 2026-10-09 (an old `const dot` kept warning after it was renamed). Bump `?v=` (or load a different path) before trusting a load.

**Cache-busting note (⚠️ bump this on every local-script change):** `index.html` and `gallery.html` load their local scripts (`sketch.js`, every `core/*.js`, `gallery.js`, `gallery-render.js`) with a shared `?v=YYYYMMDDx` query string appended to each `<script src="...">`. This project has no build step/bundler, so GitHub Pages serves every local script at the exact same URL on every deploy — without a version bump, a browser that already cached an older script for that URL can keep serving it after a deploy instead of fetching the new one. This isn't hypothetical: commit `6e551654` fixed a real bug where a user's tab, already holding an older cached `sketch.js` from before the catalog-back-link commit (`05867686`), silently ran the stale script and ignored new URL parameters entirely — only a manual reload (forcing cache revalidation) picked up the fix. **Bump the version string in both files, kept in sync, on every commit that touches any of these local scripts** — the query string is the only thing invalidating the cache; forgetting to bump it means the fix does nothing for returning visitors. The p5.js CDN `<script>` tag is excluded/unaffected — its own URL already encodes a version (`p5@1.9.0`), so a version bump there naturally changes the URL instead. One-time transition caveat, not an ongoing concern: anyone with a tab already open from before this convention existed may still need one manual reload to pick up the fix itself.

**ES modules (Farborgel) — the same bump, one more place:** `core/farborgel-selection.mjs` and the standalone Farborgel page (`color-harmony/ui/`) are ES modules, whose own `import ... from './x.mjs'` lines cannot carry `?v=`. They are cache-busted by a `<script type="importmap">` in `index.html` and in `color-harmony/ui/index.html` that maps every module of the graph to its `?v=` URL, and `core/farborgel-engine.mjs` forwards its own `?v=` to the four engine files it fetches. So the **version string now lives in three HTML files — `index.html`, `gallery.html` and `color-harmony/ui/index.html` — and one find-and-replace over all three bumps everything** (for example `sed -i '' 's/20260929ah/20260929ai/g' index.html gallery.html color-harmony/ui/index.html`). A *new* ES module in either graph must also get an import-map entry; `node tools/color/test-esm-cachebust.js` fails if one is missing, if a version is out of step, or if anything references the gitignored `color-harmony/ui/engine.generated.mjs` (it must never be imported — it does not exist on GitHub Pages). A browser without import-map support (Safari < 16.4, Firefox < 108) ignores the maps and loads those modules unversioned: it still works, it just loses the cache-bust.

**Sync to `die-welt-der-formen/p5_prototype`:** not yet automated (deliberately - see the module-split planning session referenced in git history for reasoning). The `core/` subdirectory is the intended future "copy these files verbatim" boundary; revisit an actual copy mechanism once `core/`'s shape has survived 1.3(b) and later Stage 1-2 items without another reshuffle.

## Workflow conventions

- **Analysis before action.** Read and reference specific files/lines first; get explicit go-ahead before implementing; verify (including live browser testing where relevant) before committing.
- **GitHub Pages deployment.** This repo is hosted via GitHub Pages and embedded via iframe elsewhere (see README). Edits only go live after commit + push — a locally opened `index.html` reflects uncommitted changes, but the embedded/hosted version does not until pushed.
- **Thematically isolated commits.** One topic per commit; push separately per topic rather than batching unrelated changes.
- **Step-by-step approval.** Prefer proposing a plan and getting confirmation per step over large unreviewed changes.
- **This repo is upstream of `die-welt-der-formen/p5_prototype/`.** Feature work happens here first; `p5_prototype/` is synced manually once a version is stable (see Related repositories above). Don't develop features directly against `p5_prototype/`.

## Running the tests

There is no test runner or CI in the repo; the suites are plain Node scripts. One command, from the repo root, runs all of them - every `tools/*/test-*.js` (the glob picks up a new test directory by itself) and the four Farborgel suites - and prints each file's last line, flagging any non-zero exit:

```bash
fail=0; for f in tools/*/test-*.js color-harmony/test.js color-harmony/ui/test.mjs color-harmony/ui/composition.test.mjs color-harmony/ui/integration.test.mjs; do out=$(node "$f" 2>&1); rc=$?; printf '%-58s %s\n' "$f" "$(printf '%s\n' "$out" | tail -1)"; [ $rc -ne 0 ] && { echo "  ^ FAILED, exit $rc"; fail=1; }; done; echo "overall: $([ $fail -eq 0 ] && echo PASS || echo FAIL)"
```

**This full command is mandatory before every commit.** It takes about ten minutes, almost all of it three slow suites (`test-inherit-hook.js` ~260 s, `test-spread.js` ~120 s, `test-inherit.js` ~50 s). Last full run (2026-10-09, the tree of commit `a652e374`): 57 files (53 under `tools/` + 4 Farborgel), 2149 checks in `tools/*`, 182 Farborgel groups, `overall: PASS`. These numbers change with every new test file or check; refresh them when you run the full command for a commit that adds one.

**Fast variant - only while iterating, not before a commit that touches `core/faces.js` or `core/facecolor.js`** (those three suites are what guard face detection, trail keys and colour inheritance). It is the same command with the three slow files skipped, about a minute:

```bash
fail=0; for f in tools/*/test-*.js color-harmony/test.js color-harmony/ui/test.mjs color-harmony/ui/composition.test.mjs color-harmony/ui/integration.test.mjs; do case "$f" in *test-inherit-hook.js|*test-spread.js|*test-inherit.js) continue;; esac; out=$(node "$f" 2>&1); rc=$?; printf '%-58s %s\n' "$f" "$(printf '%s\n' "$out" | tail -1)"; [ $rc -ne 0 ] && { echo "  ^ FAILED, exit $rc"; fail=1; }; done; echo "overall (fast variant, 3 slow suites skipped): $([ $fail -eq 0 ] && echo PASS || echo FAIL)"
```

A single suite: `node tools/session/test-session.js`. `tools/ui/measure-layout.js`, `tools/ui/record-baseline.js` (records `tools/ui/baseline-rail-3.json`, the current layout baseline; `baseline-phase1.json` is the original one and stays as the "before" of the UI rework) and `check-pointer-mapping.js` are browser console scripts, not part of this run. A new test directory under `tools/` only needs a file named `test-*.js` that exits non-zero on failure.

**Clean-export check - run it before a merge, and whenever a page or a script tag changes.** It shows what only works in your checkout (an untracked or ignored file, a missing `<script>` tag, a global another page defines). Export the commit, serve the export, look at three pages:

```bash
d=$(mktemp -d) && git archive HEAD | tar -x -C "$d" && cd "$d" && python3 -m http.server 8990 --bind 127.0.0.1
```

1. `index.html`: no console error; a pattern draws; a click on a node selects it.
2. **`gallery.html`: "N entries loaded", then open one catalog pattern (click a tile) - the dialog shows the tessellation and no "Failed to render full tessellation" text; pick a shape, an order and a group - the orbit tiles draw and none says "render failed"; "Open in generator" opens the generator with that pattern.** The gallery loads only part of `core/` and not `core/state.js`; `gallery-render.js` stands in for it, and a global it lacks breaks the detail view without any error at load time (this happened from 2026-09-24 until 2026-10-08, see the ROADMAP).
3. `color-harmony/ui/index.html`: the page renders.

The headless counterpart of step 2 runs in the normal suite (`tools/gallery/test-gallery-smoke.js`, `tools/gallery/test-gallery-globals.js`) and takes the export as well: `GALLERY_ROOT="$d" node tools/gallery/test-gallery-smoke.js`.

## Terminology

German↔English terminology for Ostwald's vocabulary (mirror pair, rotational form, node, theme line, tip, star, wreath, portfolio/sheet, etc.) is documented in `docs/terminology.md`, along with a proposed systematic (Hinterreiter-style) pattern-naming scheme intended for Roadmap item 1.11. Use the established English terms consistently in code, UI labels, and comments — do not introduce new translations ad hoc.

## Current priorities

See `ROADMAP.md`. **State as of 2026-10-05:** the Farborgel colour integration (Phases A-B4, distribution strategies, gray-as-selection, per-trail override, and the standalone Farborgel sub-page P0-P4) and the UI rework phases 0-5a are done on `feature/farborgel-generator-integration` - pushed to origin, not merged; a merge into `main` is a fast-forward against `origin/main` (the local `main` is stale and not a base). **Next steps, in this order:** (1) run the Safari checklist in ROADMAP's "Merge readiness" and decide the merge (it publishes the whole unfinished UI rework); (2) finish the UI rework - 5b organ strip, 5c layers strip, 5d collapsed section, 5e old toolbar + keyboard gap, then Phases 2-5; (3) the open colour items under "Farborgel colour integration" (hex `findFaces` bug, hierarchy strategy, B5 picker, click-on-pattern colouring, Farborgel toolbar restructure). Pattern combination and enumeration (roadmap 1.9, 1.11, 1.12) are shipped; 1.3 and 1.10 still carry their 🟡 tags - read the per-item status before starting. The roadmap includes an implementation-status tag (✅/🟡/⛔) per item based on a code review - check that a task isn't already partially done before starting from scratch.