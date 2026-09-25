# Ostwald Farborgel Engine

## Scope and interpretation

This standalone engine translates Ostwald's relational color organization into a
contemporary, perceptually oriented screen model. It follows the letter values,
coordinate interpretation and harmony definitions specified for this research
project. These implementation rules are not independent historical verification.

**The 24 full-color references are a contemporary Oklab construction inspired by
Ostwald's 24-part hue organization. They are not claimed to reproduce the
historical pigment or rotating-disc colors.**

**Oklab is used as the sole mixing space because this engine is intended as a
perceptually oriented contemporary screen translation of Ostwald's relational
color system.** Ostwald is not claimed to have used Lab or Oklab. This engine does
not simulate physical pigment mixtures or historical rotating discs.

The engine translates the regular chord relationships of the 24-part circle into
a contemporary programmatic form. It does not claim that Ostwald formulated every
relationship in exactly this API form. The shadow-series rule here is constant
full-color share `v`, as specified for this project.

There are no dependencies on p5.js, the DOM, browser globals, app state, external
color libraries or `core/color.js`. No existing project file needs modification.

## Running and importing

Run from the worktree root:

```sh
node color-harmony/test.js
node color-harmony/demo.js
```

The module exports the class directly through CommonJS. Node ESM can also use a
default import of the same CommonJS file. No package manifest changes are needed.

```js
const OstwaldColor = require('./color-harmony/ColorHarmonyEngine.js');
// In a Node ES module instead:
// import OstwaldColor from './color-harmony/ColorHarmonyEngine.js';

const hueCircle = OstwaldColor.hueCircle();
const triangle = OstwaldColor.triangle(5);
const field = triangle.find(item => item.label === '5ic');
const harmonies = OstwaldColor.harmonies(field, { hueCircle, triangle });
console.log(field, harmonies);
```

This module is not automatically attached to a browser global; later browser
integration can use a module toolchain without changing the engine's API.

## Coordinates and color representation

Every mixture has nonnegative `v`, `w`, `s`, summing to one:

- `v`: full-color share, calculated as `1 - w - s`.
- `w`: white share.
- `s`: black share.

These are relational weights in this model, not measured pigment fractions or
linear light intensities. All `lab` arrays are **Oklab** `[L, a, b]`, never CIELAB.
All `rgb` arrays contain gamma-encoded sRGB integer channels from 0 through 255.

Mixing uses ideal screen white `W = [1, 0, 0]` and black `B = [0, 0, 0]`:

```text
lab = v * fullColorLab + w * W + s * B
```

The operation is componentwise in Oklab. Output conversion is deterministic:

1. Convert the mixed Oklab coordinates to linear sRGB.
2. Clamp each linear channel to `[0, 1]`.
3. Apply the sRGB transfer function.
4. Round each channel times 255 with `Math.round`.

`lab` retains the unclipped mixture. Consequently, clipped or byte-quantized RGB
will not necessarily convert back to precisely the returned Oklab coordinates.
Clipping may alter displayed hue, chroma or lightness. No RGB mixing option exists.

The internal sRGB ↔ Oklab conversion uses the matrices in
[Björn Ottosson's Oklab reference implementation](https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab).
The forward conversion also supports future sRGB anchors through the private
anchor adapter. Screen white and black use their ideal Oklab coordinates explicitly.

## Letter scale

`OstwaldColor.letterScale()` returns fresh `{ letter, value }` objects in this order:

| Letter | Value / white share |
| --- | ---: |
| a | 0.8913 |
| c | 0.5623 |
| e | 0.3548 |
| g | 0.2239 |
| i | 0.1413 |
| l | 0.0891 |
| n | 0.0562 |
| p | 0.0355 |

The scale is nonlinear. There is no index-based interpolation. In a label
`<hueIndex><whiteLetter><blackLetter>`, the first letter sets `w = value` and the
second sets `s = 1 - value`. Thus `5ic` means:

```text
w = 0.1413
s = 1 - 0.5623 = 0.4377
v = 0.4210 (subject to floating-point roundoff)
```

No parameters or error conditions apply to `letterScale()`.

## `OstwaldColor.hueCircle(n = 24)`

Returns a fresh array of `n` references:

```js
{ index: 1, rgb: [/* r,g,b */], lab: [/* L,a,b */], group: 'Yellow', calibrated: false }
```

`n` must be a positive safe integer within JavaScript's array length limit
(`1..4294967295`); use practical small counts because memory grows with `n`.
Invalid counts throw `RangeError`. The default is 24; indices are ordered `1..n`.
Field and harmony methods always use the 24-part circle. Other counts are provided
for standalone circle sampling, not as alternate field-coordinate systems.

The current private builder uses Oklch `L = 0.72`, `C = 0.10` and angles
`115 - (index - 1) * 360 / n` degrees. For 24 references the angular step is 15°.
This gives equal distances between adjacent **Oklab reference coordinates**;
quantization and gamut clipping can affect display distances. The modest common
chroma and the starting angle are contemporary design choices, not historical
measurements. "Full color" names the `v=1` reference, not maximum sRGB saturation.

The semantic group order for the standard 24 references is:

| Indices | Group |
| --- | --- |
| 1–3 | Yellow |
| 4–6 | Orange / Kreß |
| 7–9 | Red |
| 10–12 | Violet |
| 13–15 | Ultramarine / Blue |
| 16–18 | Ice Blue |
| 19–21 | Sea Green |
| 22–24 | Leaf Green |

For other `n`, group names follow the same eight sectors using
`floor((index - 1) * 8 / n)`. Group labels denote semantic sectors, not measured
color-name boundaries.

### Future calibration

`hueCircle()` obtains every reference exclusively through the internal builder
and anchor adapter. The adapter understands Oklch, Oklab or sRGB anchor data.
Individual references can later be replaced by historical or empirical calibrated
anchors in that layer without changing the public methods or field schemas.
Consumers should use the returned coordinates and colors rather than reproduce
the builder formula. All current references are marked `calibrated: false`.

Calibration may deliberately change today's shared lightness/chroma or angular
positions; tests of the current construction would then need corresponding updates.
An explicit `context.hueCircle` can already supply alternative 24-part references
for harmony calculation without modifying internal state.

## `OstwaldColor.triangle(hueIndex, steps = 8)`

`hueIndex` must be an integer in `1..24`. `steps` must be exactly the number `8`.
Other resolutions are deliberately undefined and throw `RangeError`, including
zero, negative, fractional and positive non-eight values. The API never invents
extra letter levels or substitutes an equidistant barycentric grid.

The engine evaluates all 64 letter pairs and retains the 36 with nonnegative
`v`. Eight of these lie on the neutral `v=0` boundary. Pure white, black and the
pure full-color vertex are accessible with `mix`, but are not extra letter fields.

Every returned field is complete:

```js
{
  hueIndex: 5,
  w: 0.1413,
  s: 0.4377,
  v: 0.42100000000000004,
  label: '5ic',
  rgb: [102, 78, 61],
  lab: [0.44442000000000004, 0.024147567970379043, 0.03448630106456656]
}
```

Order is white-letter major and black-letter minor, each in `a,c,e,g,i,l,n,p`
order, omitting invalid pairs: `5aa, 5ca, 5cc, 5ea, 5ec, 5ee, …, 5pp`.
Neutral fields keep their hue index so their discrete positions remain addressable.

## `OstwaldColor.mix(fullColorLab, w, s)`

- `fullColorLab`: dense array of exactly three finite numbers `[L,a,b]` in Oklab.
  Out-of-sRGB-gamut coordinates are allowed; coordinates causing conversion
  overflow are rejected, even when their weight would be zero.
- `w`, `s`: finite numeric shares satisfying the triangle constraints.
- Returns `{ w, s, v, lab, rgb }`. It has no discrete label or hue index.
- Throws `TypeError` for malformed arrays or nonnumeric/nonfinite shares, and
  `RangeError` for invalid geometry or conversion overflow.

No coercion from strings or null is performed. There is no `mode` parameter.

```js
const V = OstwaldColor.hueCircle()[4].lab;
OstwaldColor.mix(V, 0, 0); // full color
OstwaldColor.mix(V, 1, 0); // white [255,255,255]
OstwaldColor.mix(V, 0, 1); // black [0,0,0]
OstwaldColor.mix(V, 0.6, 0.5); // throws RangeError
```

## `OstwaldColor.harmonies(field, context = {})`

`field` must be a complete, internally consistent discrete field object. A label
string alone or an arbitrary continuous mixture is not accepted.

Returns:

```js
{
  isotints: [/* other complete fields with equal w */],
  isotones: [/* other complete fields with equal s */],
  shadowSeries: [/* other complete fields with equal v */],
  hueHarmonies: [
    { type: 'complementary', fields: [/* +12 */] },
    { type: 'triad', fields: [/* +8, +16 */] },
    { type: 'tetrad', fields: [/* +6, +12, +18 */] }
  ]
}
```

All three series stay on the selected hue and exclude the selected field. Equal
shares are compared with absolute tolerance `1e-10`. Series contain only existing
discrete fields and preserve triangle order. `shadowSeries` means constant `v`,
**not constant `w:s`**. For `5ic` it is empty; a neutral field such as `5aa` has
seven other fields with `v=0` in the full triangle. No approximated/interpolated
neighbors are inserted.

Hue harmonies exclude the selected hue, retain its letter pair and `w/s/v`, and
wrap with `((hueIndex - 1 + offset) % 24) + 1`. The type order and offsets shown
above are fixed. Every member contains its own complete color. The original field
can be prepended by a consumer when presenting a complete chord.

### Explicit context

The only allowed keys are:

```js
{
  hueCircle: [/* exactly 24 ordered references with index, lab, rgb */],
  triangle: [/* nonempty same-hue subset of valid discrete fields */]
}
```

Both keys are optional. Omitted or `undefined` `hueCircle` uses `hueCircle()`;
omitted or `undefined` `triangle` builds the full triangle **from the supplied
circle**, at the selected hue. There is no cache or implicit application state.
Explicit null values are rejected.

A custom circle must have indices `1..24` in array order, finite Oklab arrays and
integer sRGB arrays matching the documented conversion. `group` and `calibrated`
metadata are optional and do not affect calculation.

A supplied triangle may intentionally restrict the available discrete neighbors,
but must contain the selected field, contain no duplicates, and contain only its
hue. Each field's letters, shares, Oklab and RGB must match the circle. Custom
triangle order determines series order. Hue harmonies use the full supplied
circle regardless of a triangle subset.

To use a custom circle without supplying a custom triangle:

```js
const customCircle = OstwaldColor.hueCircle();
// Replace an anchor and keep its RGB consistent with its new Oklab coordinates.
customCircle[4].lab = [0.70, 0.06, 0.07];
customCircle[4].rgb = OstwaldColor.mix(customCircle[4].lab, 0, 0).rgb;
const customField = {
  ...field,
  ...OstwaldColor.mix(customCircle[4].lab, field.w, field.s)
};
const customHarmonies = OstwaldColor.harmonies(customField, { hueCircle: customCircle });
```

Malformed data produces descriptive `TypeError`, `RangeError` or `Error` objects.
This includes unknown context keys, invalid hue indices, unknown/impossible
labels, missing selected fields, duplicates, wrong-hue triangles and inconsistent
coordinates or colors. In particular, a field generated against one circle is not
silently reinterpreted against a different circle.

## Numerical policy and ownership

Absolute tolerance is `1e-10` for triangle geometry, share equality and validation
of field shares/Oklab. Only roundoff within this tolerance may be normalized:
tiny negative shares become zero; a sum slightly over one is divided by that sum.
All other invalid geometry throws. RGB consistency requires exact byte equality.
Returned canonical fields may differ from accepted inputs by roundoff only.

All public methods return fresh data and never mutate their inputs. Harmony
results do not share their mutable color arrays with the supplied context or
with other returned fields. There is no mutable public global configuration.

The current suite covers the eight letter levels, pure-color/white/black endpoints,
Oklab interpolation, conversion and clipping, all 24 hue wraps, all discrete
triangle positions, nonempty neutral isochromes, empty `5ic` isochromes, custom
contexts, ownership and malformed input. The demo prints the selected field and
every harmony member as full color data.
