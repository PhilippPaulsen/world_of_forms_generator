# Ostwald Farborgel Engine — Phase 2

## Scope and historical status

This standalone engine translates Ostwald's relational color organization into a
contemporary screen model. Phase 2 uses the revised 1921 *Die Harmonie der Farben*
as its reference frame and implements the analytical/psychological distinctions
specified for this project. See [HARMONY_MODEL.md](HARMONY_MODEL.md) for the model,
mathematical consequences, implementation choices and limits of historical claims.

**The 24 full-color references are a contemporary Oklab construction inspired by
Ostwald's 24-part hue organization. They are not claimed to reproduce the
historical pigment or rotating-disc colors.**

**Oklab is used as the sole mixing space because this engine is intended as a
perceptually oriented contemporary screen translation of Ostwald's relational
color system.** Oklab is not attributed to Ostwald. No physical pigment/disc
simulation, RGB mixing mode or historical colorimetric reconstruction is provided.

There are no dependencies on p5.js, the DOM, browser globals, app state, external
color libraries or `core/color.js`. No UI or integration is included.

## Running and importing

From the worktree root:

```sh
node color-harmony/test.js
node color-harmony/demo.js
```

The class is exported directly as CommonJS. Node ESM also supports a default
import of the same file; no package manifest or browser global is required.

```js
const OstwaldColor = require('./color-harmony/ColorHarmonyEngine.js');
// Node ESM alternative:
// import OstwaldColor from './color-harmony/ColorHarmonyEngine.js';

const hueCircle = OstwaldColor.hueCircle();
const triangle = OstwaldColor.triangle(5);
const selected = triangle.find(field => field.label === '5ic');
const harmony = OstwaldColor.harmonies(selected, { hueCircle, triangle });
const samples = OstwaldColor.sampleHarmonyPath(harmony.paths.shadowSeries, 5);
console.log(selected, harmony.shadowSeries, samples);
```

## Analytical triangle and Oklab output

The analytical coordinates are nonnegative full-color, white and black shares:

```text
v + w + s = 1
v = 1 - w - s
```

This is a **continuous barycentric triangle**, not a set of only 28 possible colors.
The shares describe this relational model, not measured pigment concentrations or
linear-light intensities. Every `lab` means Oklab `[L,a,b]`, never CIELAB.

Mixing is exclusively componentwise Oklab:

```text
lab = v * fullColorLab + w * [1,0,0] + s * [0,0,0]
```

Ideal screen white and black are explicit Oklab corners. Output conversion follows
Oklab → linear sRGB → clamp each channel to `[0,1]` → sRGB gamma → `Math.round(255*c)`.
`rgb` consists of three integers in `0..255`. `lab` retains the unclipped mixture;
clipped/quantized RGB need not invert to exactly that Oklab value. Clipping can
alter displayed hue, lightness and chroma.

The private sRGB ↔ Oklab conversion uses
[Ottosson's reference matrices](https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab).
There is no alternate mixing path or `mode` parameter.

## Practical Ostwald register system

The discrete atlas layer selects **28 chromatic register positions** in each of
24 hues: **24 × 28 = 672 chromatic norm colors**, plus **8 shared gray levels**.
This is an invariant of the implemented atlas; it does not limit the continuous
analytical domain. Gray positions are not counted again at each hue.

Only discrete atlas nodes receive Ostwald-style letter labels. The chosen screen
realization of those nodes remains contemporary even when `source` is `'atlas'`.

| Color status | Meaning | Labels |
| --- | --- | --- |
| `source: 'atlas'` | Discrete chromatic register or shared gray | Actual letter notation |
| `source: 'interpolated'` | `mix()`, continuous source or sampled path point | `label: null` |
| `source: 'reference'` | Full-color hue anchor, not a letter-register node | No letter label |

Interpolation never creates new historical notation. Even a sample exactly on an
atlas node remains unlabeled; no automatic nearest-node lookup/rounding is done.

## Letter scale — `letterScale()`

Returns fresh `{letter, value}` objects, in this order:

| Letter | Value (white share) |
| --- | ---: |
| a | 0.8913 |
| c | 0.5623 |
| e | 0.3548 |
| g | 0.2239 |
| i | 0.1413 |
| l | 0.0891 |
| n | 0.0562 |
| p | 0.0355 |

This is the rounded eight-step logarithmic scale, not linear index interpolation.
A chromatic label is `<hueIndex><whiteLetter><blackLetter>`: the first letter sets
`w = value`, the second `s = 1 - value`. Only pairs with `v > 0` are atlas fields.
The equal-letter positions have `v=0` and are represented by `grayAxis()` instead.
No parameters or error conditions apply to `letterScale()`.

## `hueCircle(n = 24)`

Returns `n` fresh, ordered references:

```js
{ index: 1, rgb: [/* r,g,b */], lab: [/* L,a,b */],
  group: 'Yellow', calibrated: false, source: 'reference' }
```

`n` must be a positive safe integer within JavaScript's array-length limit
(`1..4294967295`), otherwise `RangeError`. Memory grows with `n`; use practical
small counts. Field/path APIs use exactly 24 references; other counts only sample
the standalone circle.

The unchanged private builder uses Oklch `L=0.72`, `C=0.10`, angles
`115 - (index - 1) * 360/n` degrees. The standard circle has 15° angular steps,
equal reference chroma/lightness and equal adjacent Oklab distances. Display
quantization/clipping may affect these distances. "Full color" means the `v=1`
reference, not maximum display saturation.

| Indices | Semantic group |
| --- | --- |
| 1–3 | Yellow |
| 4–6 | Orange / Kreß |
| 7–9 | Red |
| 10–12 | Violet |
| 13–15 | Ultramarine / Blue |
| 16–18 | Ice Blue |
| 19–21 | Sea Green |
| 22–24 | Leaf Green |

For other counts the eight group sectors use `floor((index-1)*8/n)`. Names denote
semantic sectors, not empirically measured color-name boundaries.

The circle is exclusively supplied by an internal builder/anchor adapter, which
can accept Oklch, Oklab or sRGB anchors. Future per-hue calibration can replace
individual references without changing the API. Consumers must use returned
colors, not reproduce the builder formula. All current anchors are uncalibrated.
Calibration may change today's L/C/angle choices and corresponding construction
tests. Explicit alternative references are also supported through `context`.

## `triangle(hueIndex, steps = 8)`

`hueIndex` must be an integer in `1..24`; `steps` must be exactly the number `8`.
Invalid indices and all other resolutions throw `RangeError`. No interpolated
letter levels are invented.

Returns exactly **28 chromatic atlas fields** with `v>0`:

```js
{ hueIndex: 5, w: 0.1413, s: 0.4377, v: 0.42100000000000004,
  label: '5ic', source: 'atlas', rgb: [102,78,61],
  lab: [0.44442000000000004, 0.024147567970379043, 0.03448630106456656] }
```

Order is white-letter major, black-letter minor, each in scale order, omitting
invalid and achromatic pairs: `5ca, 5ea, 5ec, 5ga, …, 5pn`.

## `grayAxis()`

Returns eight fresh shared gray nodes in `a,c,e,g,i,l,n,p` order:

```js
{ letter: 'i', label: 'i', w: 0.1413, s: 0.8587, v: 0,
  lab: [0.1413,0,0], rgb: [9,9,9], source: 'atlas' }
```

No gray node has `hueIndex`. These are discrete atlas grays, not the pure screen
white/black endpoints. No parameters or error conditions apply.

## `mix(fullColorLab, w, s)`

`fullColorLab` is a dense array of three finite Oklab components. Out-of-gamut
coordinates are allowed, but conversion overflow is rejected even at zero weight.
`w` and `s` must be finite numbers inside the analytical triangle.

Returns `{w,s,v,lab,rgb,label:null,source:'interpolated'}`. No hue or atlas label is
inferred. Throws `TypeError` for malformed arrays/nonnumeric or nonfinite shares;
`RangeError` for invalid geometry or conversion overflow. Strings/null are not
coerced. Only tiny roundoff can be normalized (see numerical policy).

```js
const V = OstwaldColor.hueCircle()[4].lab;
OstwaldColor.mix(V, 0, 0); // full-color reference coordinates
OstwaldColor.mix(V, 1, 0); // screen white
OstwaldColor.mix(V, 0, 1); // screen black
OstwaldColor.mix(V, 0.6, 0.5); // throws RangeError
```

## Analytical versus psychological relations

All relations are stored using analytical `v/w/s` coordinates, but they mean
different geometries:

| Relation | Constraint | Interpretation |
| --- | --- | --- |
| Weißgleiche / isotint | `w = constant` | Same white content |
| Schwarzgleiche / isotone | `s = constant` | Same black content |
| Analytical Reingleiche | `v = constant` | Parallel to the white–black edge in the analytical triangle |
| Schattenreihe / psychological Reingleiche | `v:w = constant` | Common full-color/white proportion while black changes; straight family in the logarithmic/psychological organization |

Analytical Reingleiche is a mathematical relation, **not the practical shadow
series**. Constant `v:w` is a ray toward black when expressed analytically. A
continuous relation still exists when it contains no other exact atlas node.

For hue 5 the practical shadow series includes:

| Field | w | s | v |
| --- | ---: | ---: | ---: |
| 5ga | 0.2239 | 0.1087 | 0.6674 |
| 5ic | 0.1413 | 0.4377 | 0.4210 |
| 5le | 0.0891 | 0.6452 | **0.2657** |
| 5ng | 0.0562 | 0.7761 | 0.1677 |
| 5pi | 0.0355 | 0.8587 | 0.1058 |

Their `v/w` ratios are approximately 2.98; their `v` values differ. The task's
example value `v=0.2652` for `le` is an arithmetic inconsistency: with the binding
letter values, `1-0.0891-0.6452=0.2657`. No letter value has been changed.

## `harmonies(field, context = {})`

`field` is a complete chromatic atlas field, consistent with its label and circle.
Phase-1 chromatic field objects without `source` remain accepted; if supplied,
`source` must be `'atlas'`. Strings, arbitrary mixtures and old hue-specific gray
fields are rejected. Use `harmonyPath()` for continuous sources.

Returns these independent plain-data members:

| Property | Members and deterministic order |
| --- | --- |
| `isotints` | Other chromatic nodes at equal `w`, preserving triangle order |
| `isotones` | Other chromatic nodes at equal `s`, preserving triangle order |
| `analyticIsochromes` | Other chromatic nodes at equal `v`, preserving triangle order |
| `shadowSeries` | Rounded ratio matches, **including source**, sorted by increasing `s` |
| `isovalent` | All **24** hues at identical `w/s/v`, including source hue, ordered `1..24` |
| `grayHarmonies.sameWhite` | Actual shared gray with identical `w` |
| `grayHarmonies.sameBlack` | Actual shared gray with identical `s` |
| `hueHarmonies` | Complementary, triad, tetrad selections, in this order |
| `paths` | Continuous descriptors keyed by `isotint`, `isotone`, `analyticIsochrome`, `shadowSeries` |

For `5ic`, gray companions are `i` and `c`; `analyticIsochromes` is empty, but
`paths.analyticIsochrome` still describes a full segment.

### Wertgleiche and regular subdivisions

`isovalent` is the value-equal register: `1ic` through `24ic` for source `5ic`.
Every position repeats the same `w/s/v`, with colors resolved against each hue's
anchor. Value equality here does not mean equality of measured screen luminance.

Hue chords are regular **subselections of this isovalent register**, excluding
the source hue:

```js
[
  { type: 'complementary', fields: [/* +12 */] },
  { type: 'triad', fields: [/* +8, +16 */] },
  { type: 'tetrad', fields: [/* +6, +12, +18 */] }
]
```

Offsets wrap modulo 24. A private subdivision helper takes a count dividing the
circle size, so additional regular selections can be added independently later.
This is a contemporary programmatic representation of circle relationships,
not a claim about Ostwald's exact API formulation. The full 1921 interval taxonomy
and additional musical interval names are deliberately not implemented.

### Context and validation

The only allowed `harmonies()` context keys are:

```js
{ hueCircle: [/* 24 ordered references */], triangle: [/* same-hue chromatic nodes */] }
```

Both are optional. Omitted/`undefined` circle uses `hueCircle()`; omitted/`undefined`
triangle builds the full 28-node atlas triangle **using that circle**. Null is invalid.
Circle entries need ordered indices `1..24`, finite Oklab triples and exact integer
RGB matching the documented conversion; other reference metadata is optional.

A custom triangle must be nonempty, contain the selected field, contain no
duplicates and contain only chromatic nodes of that hue consistent with the
circle. Its order controls constant-w/s/v arrays, but shadow series always sort
by black content. A subset restricts discrete neighbors only: isovalent groups,
chords, gray companions and continuous paths retain their full domains.

Throws descriptive `TypeError`, `RangeError` or `Error` for invalid context keys,
indices, labels, impossible/gray pairs, missing fields, duplicates, inconsistent
shares/colors or wrong-hue triangles. No malformed field is silently remapped.

## Path descriptors

Each path is JSON-serializable and embeds the calibrated anchor it needs:

```js
{
  type: 'isotint', hueIndex: 5,
  sourceField: {/* complete source color */},
  fullColorLab: [/* snapshot of this hue's Oklab reference */],
  constraint: { kind: 'constant', coordinate: 'w', value: 0.1413 },
  domain: { parameter: 't', min: 0, max: 1,
    start: { w: 0.1413, s: 0, v: 0.8587 },
    end: { w: 0.1413, s: 0.8587, v: 0 } }
}
```

`sourceField` retains atlas provenance for `harmonies().paths`. The descriptor
contains no UI coordinates. With source shares `w0,s0,v0` and `q=w0+v0`, maximal
segment endpoints are shown below in **(w,s,v)** order:

| Type | Start (`t=0`) | End (`t=1`) |
| --- | --- | --- |
| `isotint` | `(w0,0,1-w0)` | `(w0,1-w0,0)` |
| `isotone` | `(0,s0,1-s0)` | `(1-s0,s0,0)` |
| `analyticIsochrome` | `(1-v0,0,v0)` | `(0,1-v0,v0)` |
| `shadowSeries` | `(w0/q,0,v0/q)` | `(0,1,0)` |

The first three constraints use `{kind:'constant',coordinate,value}`.
Shadow constraints use:

```js
{ kind: 'proportion', fullColor: v0, white: w0,
  equation: 'v * source.w = w * source.v',
  ratioStatus: 'finite', blackEndpoint: 'limit' }
```

For `w0=0,v0>0`, `ratioStatus` is `'white-free'`: `v/w` is undefined, and the
explicit limiting ray is `w=0` from full color to black. For `v0=0,w0>0`, the ratio
is zero and the ray is the gray axis. A pure-black source (`v0=w0=0`) cannot define
a direction and throws `RangeError`. Every shadow ray contains black as its limit
endpoint; at that endpoint `0/0` is undefined. The homogeneous cross-product
constraint remains valid, so no Infinity/NaN needs to be serialized.

## `harmonyPath(type, hueIndex, w, s, context = {})`

Constructs a descriptor from any continuous analytical point. `type` must be one
of the four keys above; hue index and shares follow `triangle()`/`mix()` validation.
The optional context accepts **only** `{hueCircle}` under the same circle rules.
Its complete `sourceField` has `source:'interpolated', label:null`, even if the
coordinates happen to coincide with an atlas node.

Returns a path descriptor. Invalid type/hue/geometry or ambiguous pure-black
shadow source throws `RangeError`; malformed context/color data throws
`TypeError` or descriptive `Error`. For an atlas source prefer `harmonies().paths`.

```js
const whiteFreeRay = OstwaldColor.harmonyPath('shadowSeries', 5, 0, 0.4);
```

## `sampleHarmonyPath(path, count)`

`path` must be a complete descriptor generated by the engine or a valid JSON copy.
Its source, anchor, constraint and endpoints are checked for consistency. No
arbitrary endpoint override is accepted. `count` must be a positive safe integer
within the JavaScript array-length limit; memory grows with count.

Returns exactly `count` complete colors `{hueIndex,w,s,v,lab,rgb,label:null,
source:'interpolated'}`. For count ≥ 2, parameters are `i/(count-1)`, including both
endpoints; count = 1 returns the midpoint. Sampling is uniform in analytical `t`,
**not** logarithmically uniform and not claimed to reconstruct historical steps.

All samples use Oklab `mix()` and remain within the triangle. Collapsed segments
at corners return repeated valid samples. Neutral endpoints retain the path's
hue as context but are unlabeled interpolated colors, not hue-specific atlas grays.
No sample claims atlas status even at an exact coincidence.

Throws `RangeError` for invalid counts or geometry, `TypeError`/`Error` for invalid
or inconsistent descriptors. The embedded anchor makes sampling independent of
later changes to a context circle; there is no hidden global lookup.

## Numerical tolerances and ownership

Two named constants serve different purposes:

- `EPSILON = 1e-10`: absolute computational tolerance for geometry, constant-w/s/v
  comparisons, field shares/Oklab and continuous descriptor validation. This is
  comfortably above accumulated double-precision roundoff for unit-scale
  operations, but far below the letter table's precision. Tiny negative shares
  become zero; a sum slightly above one is divided by that sum. Larger errors throw.
- `LETTER_ROUNDING_EPSILON = 0.00005`: half the last decimal unit of each four-place
  tabulated letter value. This is **data precision**, not permission to move points
  or broaden continuous constraints.

For an atlas field let `W=w`, `B=1-s` (the black-letter value) and `d=0.00005`.
Its possible ratio interval under rounding is:

```text
[(B-d)/(W+d)-1, (B+d)/(W-d)-1]
```

Two atlas fields belong to the selected discrete shadow series if these intervals
overlap, allowing only `EPSILON` at the boundary. This tolerance is propagated
from the input precision, not fitted to the five regression labels. No coordinates
are changed. As an uncertainty-overlap test it is not a general transitive
clustering rule; tests verify all seven letter diagonals for the supplied scale.

Continuous shadow samples follow the **exact source ratio**, up to computational
roundoff, rather than snapping to rounded neighbors. Thus rounded atlas shadow
members need not lie exactly on that source's continuous ray. Their permitted
ratio discrepancy can be bounded by the sum of each field's propagated error
`d*(B+W)/(W*(W-d))`. There is no arbitrary global ratio epsilon.

RGB validation requires exact byte equality. All public results are fresh data;
inputs and contexts are never mutated, and mutable color arrays are independent
between returned fields, chords, paths and gray companions.

## Phase-1 migration notes

Core Oklab mixing results, letter values, reference colors, labels of chromatic
fields, module formats and existing method signatures are preserved.

Required semantic corrections are explicit:

- `triangle()` returns 28 chromatic fields rather than 36 fields including grays.
  Use `grayAxis()` for the eight shared neutral nodes; old `5aa`-style inputs throw.
- Constant-v neighbors moved from `shadowSeries` to `analyticIsochromes`.
  `shadowSeries` now contains constant-v/w matches **including source**.
- `isotints`/`isotones` exclude gray entries; use `grayHarmonies` for those companions.
- Colors carry `source`; `mix()` also returns `label:null`. When manually assembling
  a real atlas field with object spread, apply its actual label and atlas status
  **after** the `mix()` result. Validation still requires an actual register node.

Tests retain Phase-1 conversion, validation, circle and chromatic-consumer checks;
only superseded shadow semantics and duplicated-gray assumptions are updated.
