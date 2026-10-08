# Calibration review — Phase 6A.2

## Historical identity and display realization

All eight historical letter values, original engine w/s/v and Lab/RGB, labels,
672 chromatic atlas nodes, eight shared grays and harmony grammar remain unchanged.
The UI uses separate display records; historical fields are never overwritten.
The public engine still returns its provisional anchors. Display-only anchor
calibration and gray transfer functions are replaceable independently.

## Gray-axis display calibration

### Verified original pipeline

ColorHarmonyEngine.grayAxis calls mix(BLACK,value,1-value), with WHITE=[1,0,0]
and BLACK=[0,0,0]. Hence gray Oklab L=w and linear luminance is approximately w³.
Original chromatic Lab is v*V+w*WHITE+s*BLACK. With provisional L=.72 this means
L=.72*v+w. Historical coefficients were directly used as perceptual interpolation
weights. The inherited converter performs Oklab → linear sRGB → channel clamp →
sRGB gamma → integer RGB. Phase 6A.2 moves that unchanged math to ColorSpace.js,
shared by engine and diagnostic, avoiding a second conversion implementation.

### Candidates and decision

All gray mappings act on q=w+v=1-s, the non-black fraction. For chromatic fields,
the display mixture is first recomputed using the chosen display anchor and the
original w/s/v. Its full Oklab vector is scaled by F(q)/q; q=0 stays black.
This is a contemporary display policy, not a historical optical mixing law.

- A / current: F(q)=q; current/current explicitly reproduces Phase 6A output.
- B / perceptual: eight equal ordinal L steps between the former soft-log endpoints,
  joined piecewise-linearly in q, plus vertices (0,0) and (1,1).
- C / logarithmic (Phase 6A.1 default): F(q)=ln(1+q/p)/ln(1+1/p), p=.0355.
- D / endpoint (selected): gray a is targeted at L=.99, gray p at L=.08.
  Within [p,a], F(q)=.08+.91*ln(q/p)/ln(a/p). Below p interpolate from (0,0);
  above a interpolate to (1,1). Endpoints are contemporary display targets, not
  measured reflectances. They give RGB 252 and 2, distinct from white and black.

D uses logarithmic position in the existing near-geometric scale, not rounded
letter indexing. It therefore produces almost, but not exactly, equal adjacent
Oklab differences. This directly addresses the remaining upper/lower imbalance.
The joins are continuous and monotonic, with slope changes at p and a; no claim
of a historical psychophysical transfer formula is made.

| Letter | Historical w | Original L | Soft-log L | Selected L | Adjacent ΔL = ΔE | Selected RGB channel |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| a | 0.8913 | 0.8913 | 0.9671 | 0.9900 | — | 252 |
| c | 0.5623 | 0.5623 | 0.8371 | 0.8599 | 0.1301 | 209 |
| e | 0.3548 | 0.3548 | 0.7107 | 0.7299 | 0.1300 | 167 |
| g | 0.2239 | 0.2239 | 0.5896 | 0.6000 | 0.1300 | 128 |
| i | 0.1413 | 0.1413 | 0.4760 | 0.4700 | 0.1300 | 91 |
| l | 0.0891 | 0.0891 | 0.3722 | 0.3398 | 0.1302 | 56 |
| n | 0.0562 | 0.0562 | 0.2813 | 0.2097 | 0.1301 | 24 |
| p | 0.0355 | 0.0355 | 0.2055 | 0.0800 | 0.1297 | 2 |

Adjacent gaps are .129699–.130191, maximum/minimum ratio 1.0038, versus approximately
1.715 for the former soft-log policy. Neutral ΔE is Euclidean Oklab distance before
RGB quantization, not an instrumented monitor measurement. n/p now encode as 24/2.

## Full-color hue-circle calibration

### Audit of the inherited circle

The builder uses L=.72, C=.10, h=115°−15°*(index−1), with 24 equal angular steps.
It labels anchors uncalibrated contemporary references. Low constant chroma leaves
substantial unused gamut. Starting in ic compounded the muted appearance:
ic has w=.1413, s=.4377 and v=.421 rather than being a full-color reference.
No historical or mathematical reason requires all screen hues to share C=.10.

### Candidates and selected method

A retains L=.72/C=.10. B uses L=.72/C=.20: 21 of 24 anchors fall outside sRGB,
explicitly flagged in the diagnostic; their preview uses the original channel clamp.
C keeps the 24 angle positions and finds maximum radial in-gamut chroma for each
L/h using 32 bisections on C∈[0,1], with linear-channel tolerance 1e-9.
For each hue it searches L=.45… .95 in .005 steps for the largest chroma; then
smooths these cusp lightness values by cyclic weights [1,2,1]/4. At the smoothed
L it uses 92% of the available chroma. The bounded grid, smoothing and 92% margin
are explicit contemporary screen choices. No measured pigment data is implied.

The selected result has L=.4925… .9288 and C=.1340… .2828, smooth cyclic neighbors
(maximum adjacent ΔL below .12), and 24/24 anchors inside gamut. Hue index spacing,
opposites (+12), triads and tetrads are unchanged. Historical distance is an index
relation, not a demand for constant Euclidean distance between display colors.

### Complete anchor audit: previous and selected

Angles are normalized to [0,360). All A and C entries are in gamut; B outside
status and full coordinates for all three candidates are in ?calibration=1.

| Index | Old Oklab | Old Oklch | Old RGB | Selected Oklab | Selected Oklch | Selected RGB |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0.7200 / -0.0423 / 0.0906 | 0.7200 / 0.1000 / 115.0000 | 162/172/97 | 0.9287 / -0.0818 / 0.1755 | 0.9287 / 0.1936 / 115.0000 | 228/246/62 |
| 2 | 0.7200 / -0.0174 / 0.0985 | 0.7200 / 0.1000 / 100.0000 | 179/166/89 | 0.9000 / -0.0299 / 0.1695 | 0.9000 / 0.1721 / 100.0000 | 249/224/58 |
| 3 | 0.7200 / 0.0087 / 0.0996 | 0.7200 / 0.1000 / 85.0000 | 193/160/87 | 0.8438 / 0.0139 / 0.1585 | 0.8438 / 0.1591 / 85.0000 | 251/194/52 |
| 4 | 0.7200 / 0.0342 / 0.0940 | 0.7200 / 0.1000 / 70.0000 | 205/153/92 | 0.7900 / 0.0538 / 0.1479 | 0.7900 / 0.1574 / 70.0000 | 250/166/47 |
| 5 | 0.7200 / 0.0574 / 0.0819 | 0.7200 / 0.1000 / 55.0000 | 213/148/102 | 0.7375 / 0.0964 / 0.1376 | 0.7375 / 0.1680 / 55.0000 | 248/137/42 |
| 6 | 0.7200 / 0.0766 / 0.0643 | 0.7200 / 0.1000 / 40.0000 | 218/143/116 | 0.6825 / 0.1498 / 0.1257 | 0.6825 / 0.1956 / 40.0000 | 248/99/38 |
| 7 | 0.7200 / 0.0906 / 0.0423 | 0.7200 / 0.1000 / 25.0000 | 220/140/133 | 0.6450 / 0.2007 / 0.0936 | 0.6450 / 0.2214 / 25.0000 | 247/61/66 |
| 8 | 0.7200 / 0.0985 / 0.0174 | 0.7200 / 0.1000 / 10.0000 | 219/138/150 | 0.6400 / 0.2308 / 0.0407 | 0.6400 / 0.2343 / 10.0000 | 247/43/107 |
| 9 | 0.7200 / 0.0996 / -0.0087 | 0.7200 / 0.1000 / 355.0000 | 214/138/168 | 0.6538 / 0.2450 / -0.0214 | 0.6538 / 0.2459 / 355.0000 | 248/44/152 |
| 10 | 0.7200 / 0.0940 / -0.0342 | 0.7200 / 0.1000 / 340.0000 | 207/140/184 | 0.6700 / 0.2516 / -0.0916 | 0.6700 / 0.2678 / 340.0000 | 246/45/199 |
| 11 | 0.7200 / 0.0819 / -0.0574 | 0.7200 / 0.1000 / 325.0000 | 197/143/199 | 0.6575 / 0.2317 / -0.1622 | 0.6575 / 0.2828 / 325.0000 | 224/45/237 |
| 12 | 0.7200 / 0.0643 / -0.0766 | 0.7200 / 0.1000 / 310.0000 | 184/147/212 | 0.6013 / 0.1747 / -0.2081 | 0.6013 / 0.2717 / 310.0000 | 177/48/245 |
| 13 | 0.7200 / 0.0423 / -0.0906 | 0.7200 / 0.1000 / 295.0000 | 169/152/221 | 0.5388 / 0.1127 / -0.2417 | 0.5388 / 0.2666 / 295.0000 | 129/42/244 |
| 14 | 0.7200 / 0.0174 / -0.0985 | 0.7200 / 0.1000 / 280.0000 | 152/158/226 | 0.4925 / 0.0469 / -0.2660 | 0.4925 / 0.2701 / 280.0000 | 84/39/243 |
| 15 | 0.7200 / -0.0087 / -0.0996 | 0.7200 / 0.1000 / 265.0000 | 134/164/228 | 0.5150 / -0.0217 / -0.2483 | 0.5150 / 0.2493 / 265.0000 | 30/78/243 |
| 16 | 0.7200 / -0.0342 / -0.0940 | 0.7200 / 0.1000 / 250.0000 | 115/169/225 | 0.6288 / -0.0560 / -0.1539 | 0.6288 / 0.1637 / 250.0000 | 34/140/231 |
| 17 | 0.7200 / -0.0574 / -0.0819 | 0.7200 / 0.1000 / 235.0000 | 97/175/218 | 0.7350 / -0.0823 / -0.1175 | 0.7350 / 0.1434 / 235.0000 | 47/182/246 |
| 18 | 0.7200 / -0.0766 / -0.0643 | 0.7200 / 0.1000 / 220.0000 | 81/179/208 | 0.8000 / -0.1027 / -0.0861 | 0.8000 / 0.1340 / 220.0000 | 54/209/249 |
| 19 | 0.7200 / -0.0906 / -0.0423 | 0.7200 / 0.1000 / 205.0000 | 72/183/194 | 0.8550 / -0.1217 / -0.0568 | 0.8550 / 0.1343 / 205.0000 | 61/232/249 |
| 20 | 0.7200 / -0.0985 / -0.0174 | 0.7200 / 0.1000 / 190.0000 | 74/185/178 | 0.8875 / -0.1389 / -0.0245 | 0.8875 / 0.1410 / 190.0000 | 65/247/238 |
| 21 | 0.7200 / -0.0996 / 0.0087 | 0.7200 / 0.1000 / 175.0000 | 87/185/161 | 0.8900 / -0.1538 / 0.0135 | 0.8900 / 0.1544 / 175.0000 | 65/251/213 |
| 22 | 0.7200 / -0.0940 / 0.0342 | 0.7200 / 0.1000 / 160.0000 | 104/184/143 | 0.8787 / -0.1719 / 0.0626 | 0.8787 / 0.1829 / 160.0000 | 64/251/173 |
| 23 | 0.7200 / -0.0819 / 0.0574 | 0.7200 / 0.1000 / 145.0000 | 124/181/125 | 0.8800 / -0.1842 / 0.1290 | 0.8800 / 0.2249 / 145.0000 | 97/252/113 |
| 24 | 0.7200 / -0.0643 / 0.0766 | 0.7200 / 0.1000 / 130.0000 | 144/177/109 | 0.9087 / -0.1446 / 0.1724 | 0.9087 / 0.2250 / 130.0000 | 174/253/60 |

### Gamut policy for mixtures

Display anchor mixing remains exclusively Oklab. After the gray transfer,
mapToGamut preserves L and hue direction and reduces radial chroma only where
needed, using the same gamut boundary search (and a 1e-7 boundary safety margin).
No CSS saturation or hue adjustment is used. Eight current atlas mixtures need
this reduction; all 680 displayed atlas colors are subsequently in gamut.
The inspector and diagnostic disclose gamut reduction. requestedLab and rawInGamut
remain inspectable alongside final lab, gamutMapped and channelClipped metadata.
The encoder clamps only floating-point residue after this mapping. An explicitly
requested original/original diagnostic retains the original clamp behavior.

### Named hues: source verification, not visual inference

Direct visual inspection of the supplied 1921 scan, printed pp.31–33 (PDF49–51),
confirms on p.32 eight main groups, each divided into first/second/third norms.
Their printed 100-circle numbers match the existing ordinal-index convention:

| Engine indices | Printed numbers | Name on p.32 | UI semantic name |
| --- | --- | --- | --- |
| 1–3 | 00 / 04 / 08 | Gelb | Gelb |
| 4–6 | 13 / 17 / 21 | Kreß | Kreß / Orange |
| 7–9 | 25 / 29 / 33 | Rot | Rot |
| 10–12 | 38 / 42 / 46 | Veil | Veil / Violet |
| 13–15 | 50 / 54 / 58 | Ublau | Ublau / Blau |
| 16–18 | 63 / 67 / 71 | Eisblau | Eisblau |
| 19–21 | 75 / 79 / 83 | Seegrün | Seegrün |
| 22–24 | 88 / 92 / 96 | Laubgrün | Laubgrün |

Source: Wilhelm Ostwald, Die Harmonie der Farben, revised 1921 edition,
local Harmonie der Farben.pdf; SHA-256 and edition details remain in
../1921_HARMONY_GRAMMAR.md. Printed p.32 is Deutsches Museum scan 49:
http://nbn-resolving.de/urn:nbn:de:bvb:210-14-004662798-0049-9 .
Names are verified at the group-and-ordinal level. No solitary Urfarbe index is
invented or inferred from current RGB. The normal circle has no special markers;
all hues share one rendering path. Names appear in inspector/diagnostic only.

## Default circle, navigation and relation audit

Home is an explicit circleMode='reference' with v=1,w=s=0, source='reference',
label=null. It is a display-reference circle, not a 29th historical register.
The last atlas selectedRegister is retained separately (initially ic).
Circle previous/next visits reference then the 28 deterministic engine registers,
stopping at each end. Triangle previous/next changes hue and wraps 1↔24.
Clicking the active circle icon restores references while preserving hue, cardinality,
locale and display preference. Entering Triangle/Register uses the retained atlas
register. Grid arrows delegate to the same shared navigation actions.

Weiß/isotint was correctly wired to Engine.harmonies().isotints; all members keep w
constant. Schwarz/isotone correctly uses isotones with constant s. No label swap
or historical rule correction was made. Tooltips now explicitly name the fixed
content, avoiding the impression of moving toward a white/black endpoint.

## Chromatic review and limits

The diagnostic holds the new anchors fixed across ca/ic/nl/pn gray-policy comparisons
to isolate the transfer effect, and compares A/B/C full anchors separately.
Under the selected combination all 24 RGB triples are distinct in both nl and pn.
For hue5, nl=[56,45,37], pn=[24,18,14]. No remaining out-of-gamut atlas Lab was found.
The complete register grid is square and gutter-free, with inset selection marks.

This remains a screen-oriented contemporary interpretation. Cusp optimization does
not guarantee equal perceptual salience; blue anchors are much darker than yellows,
and smooth progression is assessed visually and by bounded neighbor differences.
Historical pigments, rotating discs, physical luminance and observer conditions
are not reconstructed. Future measured per-hue anchors, observer trials and monitor
profiles can replace the two calibration layers without changing historical identity
or harmony APIs. RGB-byte distinctness is not a guarantee of perceptual discrimination.

## Manual QA — requested review questions

These are local desktop/mobile browser observations plus the cited numeric checks,
not a claim about all displays or observers.

| # | Question | Result |
| --- | --- | --- |
| 1 | Opens directly in Kreis? | Yes; reference mode, one selected hue. |
| 2 | Saturated starting point? | Yes in the inspected screen rendering; gamut-aware reference ring. |
| 3 | Gelb naturally discoverable? | Yes; group 1–3, especially the yellow appearance at 2; no extra marker. |
| 4 | Rot naturally discoverable? | Yes; group 7–9, with a red appearance at 7; no extra marker. |
| 5 | Blau naturally discoverable? | Yes; group 13–15, with a blue appearance at 15; no extra marker. |
| 6 | Seegrün naturally discoverable? | Yes; group 19–21, with turquoise/sea-green appearances; no extra marker. |
| 7 | a reads very light? | Yes; RGB 252, still below the white vertex. |
| 8 | p reads very dark? | Yes; RGB 2, still above the black vertex. |
| 9 | n and p distinct? | Yes in the review, RGB 24 versus 2. |
| 10 | Upper intervals less disproportionately large? | Yes relative to lower intervals: max/min ΔL is 1.0038. The absolute a/c gap remains near .13, similar to 6A.1; the lower gaps increase. |
| 11 | Weiß preserves white content? | Yes; all 672 atlas-source regressions keep w fixed. |
| 12 | Schwarz preserves black content? | Yes; all 672 atlas-source regressions keep s fixed. |
| 13 | Browse all 28 circles without Register? | Yes; previous/next traverses all 28 and stops at bounds. |
| 14 | Browse all 24 triangles without Register? | Yes; hue navigator wraps 24↔1. |
| 15 | Reach default circle with one action? | Yes while Kreis is active: click its icon again. From another view, first switch to Kreis at the retained register, then click again; preserving that register on ordinary view switches is intentional. |
