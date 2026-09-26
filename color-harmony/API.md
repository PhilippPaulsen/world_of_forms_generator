# Ostwald Farborgel Engine — Phase 4

## Scope and historical status

This standalone engine translates Ostwald's relational color organization into a
contemporary screen model. Phase 2 uses the revised 1921 *Die Harmonie der Farben*
as its reference frame and implements the analytical/psychological distinctions
specified for this project. Phase 4 grounds the combinatorial grammar in direct inspection of the 1921 scan,
without changing that geometry. See [1921_HARMONY_GRAMMAR.md](1921_HARMONY_GRAMMAR.md)
for edition, page mapping, transcription corrections and construction limits.
See [INTERVAL_MODEL.md](INTERVAL_MODEL.md) for interval evidence and research status,
and [HARMONY_MODEL.md](HARMONY_MODEL.md) for the model,
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
Keep the internal `HarmonyGrammar.js` alongside `ColorHarmonyEngine.js` when
copying this module; no npm dependencies are needed.

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

Offsets wrap modulo 24. These named selections now delegate to the same generic
subdivision engine used by the public `regularHueSubdivision()` method below.
The field-local return convention is unchanged: `fields` excludes the source.
This is a contemporary programmatic representation of circle relationships,
not a claim about Ostwald's exact API formulation. The separate supplied 1921
musical distance analogy adds historical data; it does not redefine these selections.

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

RGB validation requires exact byte equality. Color-producing APIs and metadata
lookups return fresh data; inputs and contexts are never mutated, and mutable
color arrays are independent between fields, chords, paths and gray companions.
The generic `selectSeriesInterval()` intentionally returns a shallow array with
references to its input elements, as documented below.

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

## Regular subdivisions of the isovalent hue circle

### `regularHueSubdivision(field, parts, offset = 0, context = {})`

The mathematical rule is `step = 24 / parts`. Valid `parts` are exactly
`1,2,3,4,6,8,12,24`. Invalid/noninteger counts throw `RangeError`. This expresses
availability on the integer circle, not aesthetic preference.

`field` is a complete atlas field or a complete interpolated color with
`hueIndex`, `w/s/v`, `lab/rgb`, `label:null`, `source:'interpolated'`. Legacy
chromatic atlas fields without `source` are still accepted. Interpolated inputs
are not promoted to atlas status even if their coordinates happen to coincide.
A hue-free gray-axis entry is not a valid source; continuous sources require an
explicit hue index. `context` permits only an optional 24-entry `hueCircle`, under
the same validation rules as `harmonyPath()`.

`offset` is a safe integer in **hue steps**, not in subdivision steps. It is
normalized modulo 24 before arithmetic; negative and multi-turn offsets are
supported. The first returned position is `source.hueIndex + offset` (wrapped to
1..24). All following fields advance by `step`, wrapping in increasing-index
order. Thus offset zero includes the source as the first of exactly `parts`
positions; a nonzero offset need not include it.

```js
const triad = OstwaldColor.regularHueSubdivision(selected, 3);
// { parts:3, step:8, offset:0, historicalStatus:'explicit',
//   historicalName:'triad', implementationStatus:'implemented',
//   fields:[5ic,13ic,21ic] /* complete objects */ }
const six = OstwaldColor.regularHueSubdivision(selected, 6);
// step=4; fields at 5,9,13,17,21,1;
// historicalStatus='mathematical', historicalName=null
```

Only parts 2, 3, 4 are marked `historicalStatus:'explicit'`, with names
`complementary`, `triad`, `tetrad`. These now carry `sourceStatus:'primary-1921'`
and `sourcePages` (opposites: 74/98, Triade: 94, Tetrade: 98). Other divisors
are marked `'mathematical'`; their availability does not imply historical
privilege. `implementationStatus` records implemented geometry, separately from
historical evidence and pending research.

All returned colors preserve the source `w/s/v`. Atlas inputs preserve the
letter-register pair at each hue; interpolated inputs remain unlabeled. Every
color is resolved with the existing Oklab mixing and selected circle. Invalid
source data or context throws `TypeError`, `RangeError` or descriptive `Error`.

Named `harmonies().hueHarmonies` keeps its Phase-2 shape and excludes the source;
its fields equal the corresponding zero-offset subdivision's `fields.slice(1)`.
`harmonies()` does not embed the historical interval table.

## 1921 musical distance analogy — primary-source correction

### `intervalTable1921()`

Returns a fresh envelope with **12 rows**, directly inspected on printed p.89
(PDF page 107):

```js
{
  sourceStatus: 'primary-1921-p89', sourceConfidence: 'primary', primaryVerified: true,
  transcriptionBasis: 'direct-scan-inspection', model: 'musical-analogy-of-hue-distance',
  primaryReference: {author:'Wilhelm Ostwald', title:'Die Harmonie der Farben',
    edition:'2.–3., gänzlich umgearbeitete Auflage', year:1921, page:89, pdfPage:107},
  reference: {distance:12, colorEntry:12, role:'opposite-distance-octave-analogy'},
  entries: [/* distance, colorEntries, interval, german, consonant,
               sourceStatus:'primary-1921-p89', primaryVerified:true */]
}
```

`colorEntries` preserves the two printed distance columns: `[1,23]` through
`[11,13]`, followed by **`[12,12]`, Oktave, consonant=true**. These are distances
in opposite directions around the circle, not two literal hue indices to pair.
There is no identity/octave role for hue 24. The complete table is in
[INTERVAL_MODEL.md](INTERVAL_MODEL.md). Ostwald explicitly limits the analogy to
a comparison/memory aid; it is not the mathematical foundation of this engine.

### `intervalRelation1921(a, b)`

Accepts canonical integer hue indices `1..24` (no normalization); invalid indices
throw `RangeError`. Returns the envelope above without `entries`, plus sorted
`pair`, `distance` (minimal circular distance), `listed`, `entry` and
`applicationStatus:'mathematical-distance-lookup'`. All distances 1..12 have an
analogy row; identity has distance 0, `listed:false, entry:null`.

```js
OstwaldColor.intervalRelation1921(5,17).entry.interval; // 'octave', distance 12
OstwaldColor.intervalRelation1921(1,23).entry.interval; // 'major-second', distance 2
```

**Intentional Phase-3 correction:** the previous literal-dyad lookup, eleven-row
count, `entry.pair`, secondary provenance and hue-24 reference were incorrect.
Rows now expose `distance` and `colorEntries`; the top-level lookup `pair` still
means the actual input hue pair. Applying the distance table to any selected hue
pair is explicitly a mathematical operation, not a claim that the printed page
lists that particular pair. Colors and existing named-harmony behavior are unchanged.

### Historical consonance flags

`consonant` transcribes the printed asterisk only. False means unstarred, not an
engine verdict. No scores, weights, palette recommendations or ranking follow.

## Neutral hue geometry

### `hueDistance(a, b)`

Accepts canonical integer indices `1..24`; otherwise throws `RangeError`. Returns
`{clockwise,counterclockwise,minimal}`. Clockwise means **increasing index** by API
convention, independent of a rendering or the Oklch angular orientation. Directed
distances are in `0..23`; minimal distance in `0..12`. Identity has all zeros.

```js
OstwaldColor.hueDistance(23, 1);
// {clockwise:2, counterclockwise:22, minimal:2}
```

This is purely mathematical infrastructure and supplies no historical interval name.

### `isRegularHueSet(indices)`

Accepts a dense array of safe integer indices and normalizes them modulo 24 to
`1..24` (`0` becomes `24`, `25` becomes `1`, `-23` becomes `1`). Sorts a copy and
checks **all** circular gaps, including the closing gap. Array order, cyclic
permutations and input rotations do not affect the boolean result.

```js
OstwaldColor.isRegularHueSet([1,9,17]);    // true
OstwaldColor.isRegularHueSet([1,7,13,19]); // true
OstwaldColor.isRegularHueSet([1,5,12]);   // false
OstwaldColor.isRegularHueSet([1,25]);     // throws: duplicate after normalization
```

Empty arrays return false; singletons return true as one-part subdivisions.
Nonarrays throw `TypeError`; sparse/noninteger/unsafe entries and normalized
duplicates throw `RangeError`. No automatic deduplication or color lookup occurs.
Integer circle operations are exact and need no floating-point tolerance.

## Ordered series and discrete interval infrastructure

### `selectSeriesInterval(series, {start = 0, step = 1, count})`

A generic dense-array operation, independent of colors. Selects indices
`start + k*step`, for `k=0..count-1`. `start` is zero-based and nonnegative;
`step` and required `count` are positive safe integers. No wrapping, reverse
stride, truncation or automatic count reduction is performed.

```js
OstwaldColor.selectSeriesInterval(OstwaldColor.grayAxis(), {start:1, step:2, count:3});
// Actual gray entries c, g, l. This is an index selection, not a historical claim.
OstwaldColor.selectSeriesInterval(harmony.shadowSeries, {start:0, step:2, count:3});
// 5ga, 5le, 5pi, preserving the existing atlas nodes.
```

The result is a fresh **shallow array**; selected objects retain their references,
metadata and colors. The helper itself never mutates input. Unlike color-producing
methods, it does not clone arbitrary objects. Empty or out-of-bounds selections
throw `RangeError`. Nonarrays, holes, invalid options/unknown keys throw
`TypeError`; invalid integer options throw `RangeError`. Explicit `undefined`
elements in a dense array are valid. Bounds are checked without integer overflow.

The helper works on `grayAxis()`, Weißgleiche, Schwarzgleiche and Schattenreihe,
as well as any ordered discrete array. It measures **positions in that supplied
array**, not numerical `w/s/v` distances or letter gaps. Existing constant-w/s
arrays omit the source and preserve context order, so callers must intentionally
choose their series membership/order before selecting an interval. No allowed-step
table or claim of historically harmonious selection is attached.

## Primary terminology registry and research status

### `harmonyRuleRegistry()`

Returns fresh `{rules,researchPending,deferred,researchNotes}` metadata. Rules
include `id,germanTerm,englishTerm,domain,historicalStatus,sourceStatus,sourcePages,
implementationStatus`. Verified terms include Zweier, Dreier, Triade, Vierer,
Tetrade, Schattenreihe, Weißgleiche, Schwarzgleiche and Wertgleiche. Primary entries
also carry `primaryVerified`, `sourceConfidence` and `period`. This registry has
no execution callbacks or aesthetic judgments.

Complete interval-law reconstruction for the three historical one-hue series
remains `research-pending`. The Harmothek is a `future-catalog-layer`, supported
by pp.18–19, not a generator. Composed / compound harmonies are a **Phase 5
candidate**, outside this phase. Heraden is retained only in `researchNotes` as
`secondary-attested / not-required-for-current-primary-grammar`; it is not an
implemented rule or required task. No claim of historical nonexistence is made.

## Cyclic harmony grammar

All set APIs below accept dense arrays of safe integers, normalize modulo 24 to
1..24, reject duplicate normalized hues and leave inputs untouched. Integer
geometry is exact: no floating-point epsilon or silent deduplication is needed.
No labels or display colors are invented. To resolve a HarmonySet in register
`ic`, look up its hues in `harmonies(selected).isovalent`.

### `dyadsByDistance(distance)`

`distance` is an integer 1..12; otherwise `RangeError`. Returns numerically sorted
unordered `[a,b]` arrays with `a<b`: 24 pairs for each distance 1..11, 12 for
distance 12. Their union has 276 pairs. This realizes the organization of the
printed *Verzeichnis der Zweier*, pp.72–74. Source-number translation and printed
regression examples are documented in the source map; the complete table is generated.

### `cyclicGapSignature(hues)`

Accepts 2..24 distinct normalized hues. Sorts them, computes successive gaps
including the closing gap, then returns the numerically lexicographically least
cyclic rotation of that sequence. Gaps are positive and sum to 24. Invalid arrays,
cardinality, nonintegers, holes or duplicates throw `TypeError`/`RangeError`.

```js
OstwaldColor.cyclicGapSignature([1,9,17]); // [8,8,8]
OstwaldColor.cyclicGapSignature([1,3,8]);  // [2,5,17]
OstwaldColor.cyclicGapSignature([1,23,18]); // [2,17,5], mirror kept distinct
```

Input permutations and rotations preserve the signature. Reflection equivalence
is **not** used to canonicalize it. The canonical gaps need not start at the first
returned hue; they identify a rotation class, not an ordered traversal origin.

### `classifyHueSet(hues)`

Same validation as `cyclicGapSignature()`. Returns a plain HarmonySet:

```js
OstwaldColor.classifyHueSet([1,9,17]);
// { hues:[1,9,17], cardinality:3, gaps:[8,8,8], className:'Dreier',
//   symmetry:'dihedral', symmetries:{rotations:[0,8,16],reflections:[0,8,16]},
//   regular:true, construction:'division', historicalName:'Triade',
//   sourceStatus:'primary-1921', sourcePages:[94],
//   classificationStatus:'structural-no-aesthetic-verdict' }
```

`className` is Zweier/Dreier/Vierer for cardinality 2/3/4, otherwise null.
`historicalName` is Gegenfarben only at `[12,12]`, Triade only at `[8,8,8]`,
Tetrade only at `[6,6,6,6]`, otherwise null. Unnamed valid sets have mathematical
status; cardinality alone never authenticates a historical harmony.

`regular` tests all cyclic gaps. Symmetry is `asymmetric`, `reflection`,
`rotational` or `dihedral` (both). `rotations` lists invariant shifts 0..23,
including identity 0. `reflections` lists axis parameters k for the map
`x -> (k-x) mod 24`, where x=hue-1. These are exact mathematical symmetries.
A recognized named regular class defaults to construction `division`; arbitrary
sets use `unspecified`. Construction helpers overwrite that field with actual
provenance while retaining the independent geometric name.

### `divideHueDyad(dyad, direction='clockwise')`

Two distinct hues, with input order retained for arc direction. `clockwise` means
increasing index; `counterclockwise` means decreasing index. Inserts the exact
midpoint of the chosen arc. An odd arc throws `RangeError`, since its midpoint
is not a discrete hue. Both alternatives are described on pp.90–92.

```js
OstwaldColor.divideHueDyad([3,7]).hues; // [3,5,7], historical 08,17,25
OstwaldColor.divideHueDyad([3,7], 'counterclockwise').hues; // [3,7,17], 08,25,67
```

Returns HarmonySet with `construction:'division'` and `constructionEvidence`:
source status/pages, original ordered `baseDyad`, `direction`, `arc`, `addedHue`.

### `augmentHueDyad(dyad, thirdHue)`

Retains two distinct normalized hues and adds a distinct safe integer hue.
Returns HarmonySet with `construction:'augmentation'`; evidence retains sorted
`baseDyad`, its minimal `distance`, `addedHue`, `equalStep` and concept pages.
Continuation of the same directed step beyond either endpoint matches Aufbau
(pp.90/92) and has primary construction evidence. Arbitrary additions remain
`contemporary-implementation` with no claimed historical preference.
Duplicates or invalid input throw `TypeError`/`RangeError`.

### `splitHueSet(hues, target, distance)`

Accepts two or three distinct hues and a target member. Replaces the target with
`target-distance` and `target+distance`, modulo 24. The integer distance must be
1..6, the range explicitly discussed on p.93. Missing targets, collisions or
invalid parameters throw. It never silently drops coincident colors.

Returns HarmonySet with `construction:'split'`; `constructionEvidence` records
`sourceHues,target,distance,replacements` and pp.93/99. Repeating a split on the
returned `.hues` supports the documented Vierer construction. Each call records
its immediate input; callers can retain previous descriptors as a construction
history. A resulting Triade or Tetrade still has construction `split`.
No inferred optical-mixture equivalence is imposed on contemporary Oklab anchors.

## Linear series HarmonySet

### `seriesHarmony(series, relationFamily, indices, context={})`

Adds a validated descriptor around a discrete selection. Families are
`shadow-series`, `isotint`, `isotone`, and mathematical `analytic-isochrome`.
`series` must contain at least two complete chromatic atlas fields from one hue,
all satisfying the declared relation. Use existing rounding-derived shadow
comparison and `EPSILON=1e-10` for exact w/s/v relations. The supplied order must
be strictly monotone (either direction), with no duplicates. Order is checked
by s for isotint/shadow, by w for isotone/analytical isochrome.

`indices` contains at least two strictly increasing zero-based safe integers
within bounds. Neither indices nor series are silently reordered. Optional
`context` contains only `hueCircle`, validated like other calibration contexts.
Invalid input throws `TypeError`, `RangeError` or descriptive `Error`.

```js
const h = OstwaldColor.harmonies(selected);
OstwaldColor.seriesHarmony(h.shadowSeries, 'shadow-series', [0,2,4]);
// topology:'linear', indices:[0,2,4], gapsOrSteps:[2,2], step:2,
// cardinality:3, fields:[5ga,5le,5pi] (complete independent color objects)
```

The result also has `relationFamily,hueIndex,sourceStatus:'contemporary-implementation'`,
`classificationStatus:'structural-no-aesthetic-verdict'` and `relationEvidence`
with primary discussion pages (48–51), or mathematical status for constant-v.
`step` is null when successive index differences vary. No closing gap exists.
A subset's index steps describe that subset, not historical letter distances.
Gray-axis selection remains available through generic `selectSeriesInterval()`;
`seriesHarmony()` currently validates chromatic atlas nodes only.

## Phase-4 compatibility and boundaries

Oklab, anchors, letter values, 672+8 atlas nodes, Phase-2 geometry, sampling,
CommonJS/Node ESM and named field-local harmony shapes are preserved. New grammar
methods are additive. The incorrect Phase-3 p.89 table semantics are deliberately
corrected as described above; research registry metadata is updated. There is no
UI, p5 integration, ranking, full interval-law catalog or compound-harmony engine.
