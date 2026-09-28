# Display calibration review — Phase 6A.1

## 1. Historical values preserved

The engine retains a=.8913, c=.5623, e=.3548, g=.2239, i=.1413,
l=.0891, n=.0562, p=.0355, all w/s/v coordinates, labels and 672+8 nodes.
Display calibration is a UI-only realization; engine output is never overwritten.

## 2. Previous display mapping — code audit before rendering changes

Verified in ColorHarmonyEngine.js: WHITE=[1,0,0], BLACK=[0,0,0].
grayAxis calls mix(BLACK, value, 1-value). mix calculates
Lab = v*fullColorLab + w*WHITE + s*BLACK, then oklabToRgb converts to
linear sRGB, clamps channels, applies sRGB gamma and rounds to integers.
Thus neutral gray has Oklab L=w, with linear luminance approximately w³.
The historical coefficient is used directly as a perceptual Oklab mixing weight,
not as linear screen luminance. Chromatic anchors currently have L=.72;
chromatic fields therefore have L=.72*v+w and a/b=v*anchor.a/b.

## 3. Observed perceptual problem

The descending logarithmic coefficients become directly descending Oklab L.
Adjacent gray ΔL shrinks from .3290 (a/c) to .0207 (n/p). Gamma encoding
cannot undo this perceptual compression. Integer RGB quantization makes the
near-black differences still less useful. This diagnosis concerns the display
realization, not an error in the historical scale.

## 4. Mappings compared

The development comparison is available at ?calibration=1.
All mappings act on q = w+v = 1-s, the non-black fraction. For q>0,
DisplayLab = EngineLab * F(q)/q, componentwise. q=0 stays black. This is a
contemporary display attenuation policy in Oklab. It preserves hue direction and
the normalized white/full-color mixture; it changes both L and chroma together.
Full-color anchors (q=1), pure white and pure black are unchanged. Historical
relations continue to use original engine coordinates, never display coordinates.

- **A / current:** F(q)=q. Exact Phase-6A Lab and RGB, verified across all 680 nodes.
- **B / perceptual:** eight ordinal positions get equal Oklab L gaps between
  C's a and p endpoints. Continuous F uses piecewise-linear interpolation through
  these eight knots and (0,0)/(1,1). The endpoints isolate spacing from range;
  the comparison does not assert that equal spacing is historically required.
- **C / logarithmic:** F(q)=ln(1+q/p)/ln(1+1/p), where p=.0355 is the darkest
  existing coefficient. The logarithmic shape is motivated by the supplied
  logarithmic/psychophysical organization. The soft toe, normalization and choice
  of p as pivot are contemporary implementation decisions, not Ostwald's formula
  or a measured historical transfer curve. No arbitrary eight-value fit is used.

The diagnostic displays neighboring ΔL and Euclidean Oklab ΔE before RGB rounding.
For neutral gray they coincide. They describe model spacing, not measured monitor
output or a guarantee of a just-noticeable difference.

| Letter | Historical w / A L | B L | C L | C adjacent ΔL | A gray RGB | C gray RGB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| a | .8913 | .9671 | .9671 | — | 219 | 244 |
| c | .5623 | .8583 | .8371 | .1300 | 117 | 201 |
| e | .3548 | .7495 | .7107 | .1264 | 60 | 162 |
| g | .2239 | .6407 | .5896 | .1211 | 27 | 125 |
| i | .1413 | .5319 | .4760 | .1136 | 9 | 92 |
| l | .0891 | .4231 | .3722 | .1037 | 2 | 64 |
| n | .0562 | .3143 | .2813 | .0909 | 1 | 41 |
| p | .0355 | .2055 | .2055 | .0758 | 0 | 23 |

B's adjacent ΔL is .1088 throughout. RGB columns show the common neutral channel.
The diagnostic also compares hues 1, 5, 9, 13, 17, 21 in registers ca (light),
ic (middle), pn (dark); these are review fixtures, not new historical rules.

## 5. Selected/default display mapping

C (`logarithmic`) is the default in `DisplayCalibration.mjs`. Change
`DEFAULT_MAPPING` there to replace the display policy; the public harmony API
and every consumer of historical fields remain unchanged. `historicalToDisplay`
returns a separate record with historicalNonBlack, displayNonBlack,
displayLightness, lab and rgb. It creates no historical label/status.

All normal UI swatches use the central `color()` helper. The diagnostic requests
A/B/C explicitly. The inspector exposes original Engine-Oklab alongside
Display-Oklab and displayed sRGB. Conversion is reused through Engine.mix(lab,0,0),
so there is no duplicate color-space converter or alternate RGB mixing path.

## 6. Why selected, including chromatic review

C separates dark neighbors, reduces the oversized a/c gap, remains strictly
monotonic and smooth, and does not force equal ordinal spacing. B is useful as
a comparison but introduces slope changes at knots and an equal-spacing rule.
The inspected comparison makes A's dark collapse and C's separated gray steps
visible. This choice is a provisional screen realization for further user review.

The same mapping changes chromatic dark registers. Across the sampled hues,
ca changes L=.79918 → .86717, ic .44442 → .66163, pn .05040 → .25232.
For hue 5, pn changes RGB [1,0,0] → [38,33,30]. Dark hue differences become
visible instead of collapsing to almost black; light and middle registers also
brighten. All 672 chromatic fields and eight grays produce finite Oklab and valid
integer RGB. The pn row has 3 distinct integer RGB triples under A, 24 under B and 23 under C;
two adjacent dark hues still coincide after rounding under C. No chromatic C
output reaches channel 0 or 255 in the current atlas. Full anchors remain untouched.
Browser comparison covers multiple
hues, and the register grid shows the whole atlas under the selected transform.

## 7. Known limitations

This is not colorimetric calibration, pigment reconstruction, historical disc
simulation or a monitor profile. Hue/chroma/lightness are unmeasured references.
The engine's existing deterministic linear-sRGB channel clamp remains in use;
pre-clamp Oklab distances do not certify post-clamp perceptual spacing. Brightened
chroma could require a different gamut policy with future anchors. Browser review
found no visibly broken color output in the inspected fixtures; it is not an
instrumented gamut or observer study. Absolute brightness depends on the screen,
viewing conditions and color management. Relative analytical invariants remain
historical metadata and need not be straight lines in calibrated display Lab.

## 8. Future colorimetric calibration questions

Measure historical materials and their illuminant/observer conditions before
claiming historical color fidelity. Determine suitable per-hue anchors and their
gamut, a measured neutral transfer curve, and whether a global attenuation policy
is adequate. Review shadow chroma, near-white range and near-black separation on
actual calibrated displays with observers. A future policy can replace this
module without changing atlas labels, harmony grammar or the engine API.
