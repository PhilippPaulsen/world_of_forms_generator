# Farborgel — standalone research instrument (Phase 6A.1)

A browser interface to the existing Ostwald engine. It is separate from the p5.js
generator and has no external runtime dependencies, network fonts, export actions,
palette ranking or editing of compound harmonies.

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

Tab, Enter and Space operate controls. Left/Right move the circle anchor or the
atlas triangle selection; all four arrows navigate the register grid. Arrow keys
also move through the sample strip. Escape dismisses the inspector and tooltip.
Small screens get a bottom inspector; the register and sample rails scroll within
the workspace. Larger SVG hit regions improve triangle selection. The narrow
circle view also provides explicit previous/next hue buttons.

## Views

- **Kreis:** the 24 engine colors at the selected register, with an engine-generated
  regular 2/3/4-part relation when activated. Clicking a hue or another harmony point reanchors it.
  Inspector classification distinguishes Dreier/Triade and Vierer/Tetrade.
- **Dreieck:** 28 actual atlas nodes in a regular **letter-index display layout**.
  This is an ordered atlas diagram, not the continuous analytical barycentric
  triangle. Weiß/Schwarz/Schatten highlight existing discrete neighbors; Wert
  exposes the 24 actual isovalent counterparts below the diagram. In Verlauf,
  the three one-hue paths use analytical v/w/s positions with labeled vertices.
- **Register:** 28 register rows by 24 hue columns. Row and column marks identify
  the selection; a double outline marks the selected cell. The 672 cells use engine
  data only. Sticky headers and a scroll container retain their ordered structure.
- **Aufbau (expandable result, not primary navigation):** spatial hue chords with their engine classification, or read-only
  Phase-5 examples of shared-member connection, substitution and recursion.
  Child groups, original/replacement roles, active results and repeated members
  remain visible. The examples do not provide a compound editor.

Eight shared grays appear separately, never duplicated per hue. Inspecting a gray
preserves the last chromatic hue/register anchor for subsequent chromatic work.

## State model and source of truth

`state.mjs` owns pure initialization, validation, transitions and derived views.
State contains `locale`, `activeView`, `displayMode`, `selectedHue`,
`selectedRegister`, `selectedField`, `harmonyMode`, `relation`, `harmonyExample`,
`selectedHarmony`, `inspectorOpen`, `detailOpen`, `selectionKind` and `resultOpen`.
Initial values are German, Kreis, Atlas, hue 1, register ic, single-color selection
and a closed inspector. Cardinality 3 is retained as the inactive initial setting.

View changes preserve selection. Hue changes preserve the register, register
changes preserve hue, and a grid cell changes both. Gray/sample inspection does
not invent a new register; the last discrete anchor remains explicit. Returning
to Atlas restores that anchor. Choosing a compound example inspects its first
active member while retaining the chromatic anchor; choosing the regular relation
restores the anchor. These gray examples are fixed research fixtures, not palettes
adapted to the current chromatic hue. Construction depth is a software tree depth.

All colors, path samples, classifications and compound trees come from public
`OstwaldColor` methods. UI geometry only places those results on the screen.
DisplayCalibration.mjs provides a separate contemporary display transfer function.
There is no duplicate color-space conversion, hue reference table or harmony grammar
in CSS, markup or view modules. The original three engine modules are unchanged.

## i18n

All visible UI wording is in `i18n.mjs`, with `de` and `en` entries. Change the
single `DEFAULT_LOCALE` constant to `'en'` to switch the interface, accessible
names, tooltips and document language. German is the committed default; there is
no visible language switcher yet. Atlas labels, numeric values and mathematical
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
Verlauf enables 49 contemporary Oklab samples from an engine harmony path. They
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
[COMPOUND_HARMONIES.md](../COMPOUND_HARMONIES.md) explains the composition fixtures.

## Validation and browser QA

```sh
node color-harmony/test.js
node color-harmony/ui/test.mjs
node color-harmony/demo.js
```

The engine retains all 79 prior test groups. The UI retains the 16 existing groups (the four-view presentation test now checks
three primary views) and adds 11 calibration/selection groups, for 106 total.
The existing groups cover:
bilingual lookup, initial state, normalization, register/cell transitions, view
persistence, gray/sample status, discrete isovalence, engine adapter parity,
cardinality, compound examples, scientific disclosure and invalid inputs.
`ui/test.mjs` regenerates the adapter before importing it. No browser test framework
or package manifest is introduced.

Phase-6A.1 browser checks cover desktop, tablet and mobile portrait: three-size
local typography, outlined rounded controls, selection synchronization, keyboard
activation, persistent triads across register/view changes, gray axis, optional
inspector, construction details and unlabelled continuous samples. The dedicated
comparison shows A/B/C gray ladders and light/middle/dark chromatic fixtures.
Narrow register views intentionally scroll rather than shrinking 672 cells.
Real-device touch, screen-reader and measured-display studies remain follow-up work.

## Refined interaction

The primary navigation is **Kreis / Dreieck / Register**. Start with one color;
press **2 / 3 / 4** to see a chord immediately. Press its active digit again to
return to single-color selection. Hue and register changes reanchor an active
chord; the same sticky result swatches remain visible across all three views.
Weiß / Schwarz / Schatten / Wert are contextual to Dreieck and Register and
immediately populate the result. Selecting a gray or path sample selects one color.

**Aufbau** expands the former HarmonyView below the main visualization, including
the read-only compound examples. **Info** remains optional. Atlas/Verlauf appears
only alongside the triangle, leaving the primary toolbar focused on exploration.
No tutorial, editing, export or copying controls were added.

The page is white. Controls reuse generator `index.html` .icon-btn/.layer-btn:
1px black border, 4px corner radius, 40px height, 10px word-button horizontal
padding, #f0f0f0 hover and black/white selected inversion. Touch controls use a
44px height. Icons use the generator's 24-unit / 2px stroke convention.
Three font-size tokens (22 / 13 / 11px) replace the former scattered size values;
weight and spacing provide hierarchy. Small SVG ring numbers use the primary
size in SVG space to remain readable after viewBox scaling on phones.

## Display calibration diagnostic

Open **http://127.0.0.1:4173/?calibration=1** (substitute your selected port).
It compares the exact previous mapping, equal Oklab gray spacing and the selected
soft logarithmic mapping, with L/ΔL/ΔE and chromatic ca/ic/pn registers at six hues.
The normal interface has no calibration controls. See [CALIBRATION.md](CALIBRATION.md)
for the code audit, formulas, measurements, decision and limits. Historical field
objects, labels, w/s/v, 28×24+8 atlas and harmony grammar remain unchanged.

## Limitations and next phase

- Only regular 2/3/4-part hue chords are selectable in this prototype; the richer
  engine grammar is available through its API, not an additional control panel.
- Compound examples are read-only gray fixtures, not a full G/F/W case browser.
- No persistent sessions, full provenance editor, animated performance mode or
  exhaustive exploration/search. All selection state resets on page reload.
- Phase 6B: compound construction/editing, palette/JSON/image export or copying,
  and further exploration controls. Generator integration remains a later,
  separately reviewed phase. Nothing is merged into `main`.
