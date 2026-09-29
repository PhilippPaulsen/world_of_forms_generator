# Farborgel — standalone research instrument (Phase 6B.1)

A browser interface to the existing Ostwald engine. It is separate from the p5.js
generator and has no external runtime dependencies, network fonts, export actions,
palette ranking. The active harmony supports member editing and structured compound actions.

## Run locally

From this worktree's root, with Node 22 or later:

```sh
node color-harmony/ui/serve.js
```

Open **http://127.0.0.1:4173/**. Stop the process with Ctrl+C.
If that port is occupied, use `PORT=4174 node color-harmony/ui/serve.js`.
The server binds only to the local loopback address and serves only the UI folder.
It is a development server, not a deployment service. Opening `index.html` directly
as a `file:` URL is unsupported because native modules require an HTTP origin.

At startup, `build.js` wraps the existing CommonJS engine files into an ESM adapter,
`engine.generated.mjs`. That generated file is ignored by Git; do not edit it.
The adapter copies current engine sources mechanically, with an explicit private
module registry and no `eval`, dependency installation or browser-global engine.
Restart the server after changing engine code. Reload the page after UI edits.
An existing static HTTP server also works after `node color-harmony/ui/build.js`.

## UI principles

A neutral grid, local Suisse Intl, thin lines and a single principal view. Color
is reserved for calibrated display realizations of actual engine fields. View icons follow the generator's existing
24-unit outlined SVG shape language; no unrelated icon library is loaded.
Controls are short German words or geometry. Every icon/digit control has a
translated accessible name, focus styling and a tooltip. Selected state includes
outlines, marks or inversion, not only color. Tooltips appear on hover/focus/tap;
important selection information is also available in the compact inspector.

## Compose and explore

Choose a color → press **2 / 3 / 4** → select a strip member → choose its new color.
Only the active member changes. The square harmony strip remains visible in every
view. **×** keeps only the active color; **↶ / ↷** undo/redo composition edits.
Clicking an existing member activates it without duplication or regeneration.

The default is the saturated full-color reference circle, v=1,w=s=0,label=null.
Two compact upper-right navigators, **‹ 01 › ‹ • ›**, independently browse hue
(wrapping 01…24) and register (engine order, stopping at bounds). Circle adds the
reference • state before its 28 atlas registers; the other views show the retained
atlas register. Clicking the active circle icon returns to • in one action.
Navigation and view switching preserve the explicit harmony and relation state.
Click a displayed field to commit a color selection.

**2 / 3 / 4 toggle:** pressing an active digit again keeps only the active member;
pressing another generates that cardinality. **W / B / S / V toggle** one contextual
series preview independently. They sit vertically near the view icons. The compact
preview shows its actual atlas anchor (e.g. 5ic); it never invents atlas coordinates
for the selected full-color vertex. Click a preview swatch to adopt the whole
series with that member active, or **↓** to adopt with the context anchor active.
Adoption participates in undo/redo. Turning off a preview retains the adopted set.

Circle shows occupied hue positions; markers activate exact members. Triangle
shows 28 atlas nodes; Register shows all 672 chromatic cells and actual members.
Eight shared grays remain separately selectable. No large view titles repeat the
icon state. Atlas/Verlauf is available only under **Info → Wissenschaftliche Details
→ Forschungsansicht**; continuous engine paths remain available there.

The strip's new **In Muster übernehmen / Apply to pattern** icon emits a neutral
version-1 selection. Standalone confirms delivery without claiming a changed
pattern. `?integration=1` shows the last emitted payload for development inspection;
normal mode has no JSON display, logging, copy or export. The schema and future
Farbe menu contract are in [INTEGRATION_INTERFACE.md](INTEGRATION_INTERFACE.md).

Tab, Enter and Space operate controls. Circle/triangle/grid arrows move the browse
cursor; Enter/Space commits a selection. Sample-strip arrows select samples.
The inspector displays live cardinality, exact named class where applicable,
cyclic hue geometry and manual/generated status. Alternative structures are
secondary ‹/› controls there. **Info → Wissenschaftliche Details → Aufbau** exposes
substitution and shared-member composition with intact recursive provenance.
The engine's atlas-only compound boundary is explicit; no full-color/sample is
silently converted. No default gray interval law is invented.

`composition.mjs` owns the pure composition reducer, stable identities, engine
orchestration and bounded undo/redo. `state.mjs` keeps navigation separate and
projects the active color for inspection. Detailed actions, identity rules,
alternative ordering, compound limits and exact selection semantics are documented
in [COMPOSITION.md](COMPOSITION.md). Historical logic remains in the engine.

DisplayCalibration.mjs derives contemporary display records from unchanged engine
coordinates using the Phase-6A.2 gamut-aware full colors and gray transfer. Shared
ColorSpace.js supplies conversion; no harmony or colorimetry is duplicated in views.

## i18n

All visible UI wording is in `i18n.mjs`, with `de` and `en` entries. Change the
single `DEFAULT_LOCALE` constant to `'en'` to switch the interface, accessible
names, tooltips and document language. German is the committed default; a compact
DE/EN switch is also available in the inspector's scientific details. Atlas labels, numeric values and mathematical
symbols are data, not translated prose. Missing translation keys throw explicitly.

## Typography

The supplied local fonts are copied from the Phase-5 worktree into `assets/fonts/`:

| File | CSS weight/style |
| --- | --- |
| `SuisseIntl-Book.woff2` | 400 normal |
| `SuisseIntl-Semibold.woff2` | 600 normal |
| `SuisseIntl-Bold.woff2` | 700 normal |
| `SuisseIntl-BookIt.woff2` | 400 italic |

The actual filenames differ slightly from the suggested names. CSS declares each
face explicitly and uses `"Suisse Intl", Arial, sans-serif`. `font-synthesis:none`
prevents simulated weight/style; `font-variant-numeric:tabular-nums` applies
throughout. Bold is limited to the current hue readout. Source notes use italic.

## Historical vs contemporary display

Atlas nodes retain their actual engine labels (`5ic`, gray `c`) and `source:'atlas'`.
The inspector’s Verlauf mode enables 49 contemporary Oklab samples from an engine harmony path. They
remain `label:null`, `source:'interpolated'`, including coincident atlas positions.
The inspector says **Kein Atlaswert / Verlauf**. Analytical vertices and source
coordinates are not assigned historical letters by rounding.

Wert is discrete: this engine has no continuous isovalent hue path. Selecting it
shows the actual 24-node circle and an explicit note, rather than silently using
a different path. Other views keep their discrete reference structures visible; the continuous
path strip belongs to Dreieck. The path is always tied to the
retained chromatic anchor; it is not a continuous interpolation of a compound tree.

Primary-source status and pages in the inspector refer to the engine's **relation**
metadata, never to historically verified RGB colors. All 24 uncalibrated references
and displayed mixtures remain the contemporary Oklab realization described in
[API.md](../API.md). The details drawer exposes w/s/v, engine Oklab, display Oklab, sRGB and evidence;
[COMPOUND_HARMONIES.md](../COMPOUND_HARMONIES.md) explains the underlying composition laws.

## Validation and browser QA

```sh
node color-harmony/test.js
node color-harmony/ui/test.mjs
node color-harmony/ui/composition.test.mjs
node color-harmony/ui/integration.test.mjs
node color-harmony/demo.js
```

The engine retains 79 groups; the 38 UI baseline groups retain calibration,
historical identity and grammar checks. 28 composition groups cover generation,
member edits, live classification, exact identities, duplicates, view/navigation
persistence, alternatives, bounded undo/redo, substitution, shared connections,
recursive provenance and invalid inputs. 37 new groups cover compact navigation,
independent toggles, ordered series adoption/undo, all transfer source types,
serialization, structural provenance and exactly-once callbacks. **182 test groups
total (145 retained + 37 new).** The one new baseline expectation change makes
pressing an already active digit toggle it off. All UI suites rebuild the ESM
adapter before import.
CommonJS, Node ESM and browser ESM are checked. No test framework is required.

Browser checks cover the simple workflow (choose → 3 → second member → triangle
variant → circle), generic Dreier after editing and Triade after undo, and actual
atlas substitution/shared-member workflows. Desktop and mobile maintain visible
square swatches, focus styling and 44px primary touch controls; compact code arrows use 32×44px mobile targets. Register scrolling stays
inside its own container. Real-device and screen-reader studies remain follow-up work.

The page remains white with local Suisse Intl, generator-style 1px outlined controls,
4px control corners, square contiguous atlas cells and three type sizes (22/13/11px).
The new composition strip uses adjacent square fields, not rounded palette chips.

## Display calibration diagnostic

Open **http://127.0.0.1:4173/?calibration=1** (substitute your selected port).
It compares the exact previous mapping, equal Oklab gray spacing, soft-log and the selected
endpoint-anchored mapping, with L/ΔL/ΔE and chromatic ca/ic/nl/pn registers at six hues.
A separate full-anchor table compares original, fixed higher chroma and gamut-aware
calibrations at all 24 positions, reporting Lab/Lch/RGB and out-of-gamut candidates.
The normal interface has no calibration controls. See [CALIBRATION.md](CALIBRATION.md)
for the code audit, formulas, measurements, decision and limits. Historical field
objects, labels, w/s/v, 28×24+8 atlas and harmony grammar remain unchanged.

## Limits and scope

No export, clipboard palette copy, generator integration, persistent sessions,
full provenance editor, exhaustive grammar search or aesthetic recommendations.
Compound actions apply to engine-supported atlas/gray groups only. Arbitrary
manual sets remain editable even when they do not form such a group. Reloading
starts a fresh single-color session. Nothing is merged into main.

Source-verified hue names, gamut-aware references and gray endpoint calibration
remain exactly the Phase-6A.2 baseline; see [CALIBRATION.md](CALIBRATION.md).
No special Urfarben markers were introduced. Weiß/Schwarz still preserve w/s
respectively across all 672 atlas fields. Home retains the active harmony.

## Files changed in Phase 6B.1

All paths below are relative to `color-harmony/ui/`:

- New: `HarmonySelection.mjs`, `integration.test.mjs`, `INTEGRATION_INTERFACE.md`.
- Updated: `composition.mjs`, `state.mjs`, `app.mjs`, `i18n.mjs`, `styles.css`,
  `test.mjs`, `README.md`, `COMPOSITION.md`, `components/Navigator.mjs`,
  `components/Toolbar.mjs`, `components/Inspector.mjs`, `views/CircleView.mjs`,
  `views/TriangleView.mjs`.

Engine files, calibration modules and generator files are unchanged.

## Phase-6B.1 browser verification

Desktop (1280px) and mobile (390×844px) checks cover the compact hue/register
controls, • home action, absence of primary headings/mode toggles, vertical
W/B/S/V, every toggle-off action, direct preview adoption, composition persistence
across views, undo/redo, keyboard controls and bilingual tooltips. A 24-member
isovalent transfer retains ordered identities, active index 23 and 24 calibrated
display colors; the mobile strip scrolls to keep that active member visible.
The actual browser ESM app emits a serializable record visible at `?integration=1`.
The callback/event unit tests require no generator. No page-wide horizontal
overflow was observed at mobile width. Real-device and screen-reader studies
remain follow-up work.
