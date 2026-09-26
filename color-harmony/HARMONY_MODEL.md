# Harmony model — implementation notes

The historical frame is Wilhelm Ostwald, *Die Harmonie der Farben*, revised
1921 edition. Phase 4 directly inspected the local primary scan; edition, page
mapping and verified grammar facts are recorded in
[1921_HARMONY_GRAMMAR.md](1921_HARMONY_GRAMMAR.md). The earlier color geometry and
contemporary display decisions remain unchanged; primary verification of grammar
is not a claim of historical Oklab colorimetry.

## 1. Analytical v/w/s coordinate model

Historical structure: full-color, white and black components. Mathematical model:
`v,w,s >= 0`, `v+w+s=1`. Implementation: store these shares and reject invalid
geometry beyond computational `EPSILON=1e-10`; resolve display colors in Oklab.

## 2. Continuous triangle

Mathematical consequence: the feasible analytical domain is a continuous simplex,
with full-color, white and black vertices. Its geometry exists independently of
any finite atlas. Path descriptors use shares and segment endpoints, not pixels or
screen coordinates. `mix()` and `harmonyPath()` can address non-atlas positions.

## 3. Eight-step logarithmic letter scale

Historical structure adopted by this project: `a c e g i l n p`, a logarithmic
rather than linear organization. Implementation retains the prescribed four-place
values `0.8913,0.5623,0.3548,0.2239,0.1413,0.0891,0.0562,0.0355` unchanged.
The first letter gives white content, the second gives `s=1-value`.

## 4. 28 chromatic register positions

Mathematical consequence: strictly positive `v` means the white-letter value is
less than the black-letter value. Eight ordered levels yield `8*7/2=28` pairs.
Implementation: `triangle(hue,8)` emits only these chromatic atlas nodes, in
white-letter-major then black-letter-minor order. Across 24 hues there are 672.
These are practical register selections, not all possible theoretical colors.

## 5. Shared gray axis

Equal-letter coordinates give `v=0`. They are eight shared achromatic norm colors,
not 24 independent sets. `grayAxis()` emits letter, shares and complete display
color, with `source:'atlas'` and no hue index. The invariant is **672 + 8 = 680**
discrete atlas entries. Display-byte coincidences do not change the node count.

## 6. Weißgleiche

Constraint: `w=w0`. Mathematical segment `(w0,0,1-w0)` → `(w0,1-w0,0)` in
**(w,s,v)** order. `isotints` lists other chromatic atlas matches; `paths.isotint`
exists regardless of match count. `grayHarmonies.sameWhite` is the actual gray
entry at the source's white letter, not an invented interpolated label.

## 7. Schwarzgleiche

Constraint: `s=s0`. Segment `(0,s0,1-s0)` → `(1-s0,s0,0)`.
`isotones` lists other chromatic atlas matches; `paths.isotone` describes the
continuous geometry. `grayHarmonies.sameBlack` is the gray of the black letter.

## 8. Analytical Reingleiche

Constraint: `v=v0`, the straight line parallel to the white–black edge in the
analytical triangle. This is a direct mathematical relation, **not the practical
Schattenreihe**. `analyticIsochromes` lists other discrete matches, possibly none;
`paths.analyticIsochrome` still gives `(1-v0,0,v0)` → `(0,1-v0,v0)`.

## 9. Schattenreihe / psychological Reingleiche

Historical/practical distinction adopted here: `v:w` remains constant while black
changes. It corresponds to a straight family in the logarithmic/psychological
organization; the engine stores it in analytical coordinates as a ray to black.
It must never be collapsed into the constant-v relation above.

For source `(w0,s0,v0)`, let `q=w0+v0`. The continuous ray is
`((1-t)*w0/q, t, (1-t)*v0/q)`, `0<=t<=1`. Its homogeneous constraint is
`v*w0=w*v0`. `w0=0,v0>0` explicitly denotes the white-free ray. `w0=v0=0` is an
ambiguous source and throws. At black, `v/w=0/0` is undefined; black is the limit
endpoint, not a newly assigned ratio. `v0=0,w0>0` gives the gray ray with ratio zero.

Implementation separates computational tolerance from atlas precision. The four
printed decimals imply `LETTER_ROUNDING_EPSILON=0.00005`. For `W=w, B=1-s`, propagate
this to the ratio interval `[(B-d)/(W+d)-1,(B+d)/(W-d)-1]`. Discrete shadow matches
have overlapping intervals, with only `EPSILON=1e-10` for boundary roundoff. This is
not a fitted threshold or a change to the analytical coordinates. See API.md for
the error bound and the limited, non-transitive meaning of interval overlap.

Regression: **5ga–5ic–5le–5ng–5pi**, sorted by increasing black content and including
the source. All have `v/w≈2.98`, but decreasing `v`. With the unchanged table,
`5le` has **v=0.2657**, correcting the prompt's arithmetic value 0.2652.
Continuous samples use the exact selected source ratio, not the wider atlas
rounding allowance. Thus rounded atlas neighbors may lie slightly off that ray.

## 10. Wertgleiche

Historical structure: a register repeats the same analytical `w/s/v` at each hue.
`isovalent` returns all 24 complete atlas fields, including the selected hue, in
index order. It is distinct from any chord and does not imply equal measured
screen luminance. Custom anchor calibration does not alter register coordinates.

## 11. Regular hue-circle subdivisions

Mathematical consequence: regular subsets of the isovalent circle have offsets
`k*24/count`. The internal helper selects complement (count 2), triad (3) and
tetrad (4), excluding the source from chord output. Phase 3 exposes every divisor
count through `regularHueSubdivision()` without
changing atlas or path logic. Only the established counts 2/3/4 receive names;
other counts remain mathematical. The verified p.89 musical distance analogy
is a separate model, described in [INTERVAL_MODEL.md](INTERVAL_MODEL.md).

## 12. Atlas nodes versus continuous Oklab samples

Contemporary implementation: paths are plain JSON data containing type, hue,
source color, Oklab anchor snapshot, constraint and analytical endpoints.
`sampleHarmonyPath` samples uniformly in analytical parameter t, not psychological
log spacing. Count 1 means the midpoint; larger counts include both endpoints.
Collapsed segments return repeated valid samples. Descriptors are validated
against their source, including JSON round trips and custom calibrated anchors.

Samples always have `source:'interpolated',label:null`, even at an atlas
coincidence. Only actual atlas lookup supplies a historical-style label. Gray
endpoints of sampled paths do not create hue-specific gray atlas entries.
Full-color anchors use `source:'reference'`; atlas nodes use `source:'atlas'`.

## 13. Historical structure versus contemporary implementation

Ostwald's structural vocabulary and the project's 1921 interpretation guide the
atlas and relationships. Endpoint equations, counts and regular subdivisions
follow mathematically from that model. They are distinct from display choices:
Oklab-only mixing, a common-L/C uncalibrated reference circle, gamut clipping,
byte RGB, sampling rules, metadata and serialization are contemporary decisions.
The 24 hue anchors are not historical pigment or rotating-disc reconstructions.

Per-hue calibration remains replaceable behind the existing API. Historical
colorimetry and complete series-interval laws remain future research. Phase 4
adds cyclic HarmonySets and validated linear series selections without altering
these geometric relations. Printed p.51 confirms the ga–ic–le–ng–pi series;
p.64 confirms the 28 Wertgleiche circles. The p.89 analogy is now directly
verified and corrected. No UI or p5 integration is included.

## 14. Combinatorial grammar and topology

Cyclic gap signatures include the closing gap and sum to 24. Linear series
selections have only successive index differences. Dreier is not a synonym for
Triade; Vierer is not a synonym for Tetrade. Construction (division, augmentation,
split) is distinct from final geometric symmetry. See INTERVAL_MODEL.md and API.md.
Harmothek is a future catalog layer. Phase 5 candidate: composed / compound
harmonies (Zusammengesetzte Wohlklänge), outside Phase 4.
