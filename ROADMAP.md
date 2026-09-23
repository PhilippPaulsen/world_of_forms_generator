# Roadmap

This roadmap is ordered by current priority, not by date. Near-term work concerns the generative fruitfulness of Ostwald's form theory; editorial framing follows; long-term platform phases are listed for reference.

Implementation status below reflects a code review of `world_of_forms_generator` (`sketch.js`, `forms.js`) as of the current commit. Status tags: ✅ implemented · 🟡 partially implemented · ⛔ not started.

---

## Priority 1 — Generative Extensions Suggested by Ostwald

Ostwald himself pointed, across both works, to extensions he did not carry out. These form the immediate development backlog for `world_of_forms_generator` and, where relevant, `SpaceHarmony`.

**Already in place, underlying all items below:** the core theme-line → pattern engine (`drawConnectionWithSymmetry()`) already supports both mirror-based patterns (Spiegelinge) and pure-rotation patterns (Drehlinge) via `none` / `reflection_only` / `rotation3` / `rotation6` / `rotation_reflection3` / `rotation_reflection6` modes, plus tessellation across the canvas (`tileTriangle()`, `tileSquare()`, `tileHex()`) and PNG/JSON/SVG export. Theme-line selection is already free-form: any polygon and node count can be chosen, and any two nodes connected by mouse click (`mousePressed()`). This is the foundation every item below builds on.

### Suggested build order

This sequence respects software dependencies first, and orders by value-to-effort within each dependency-safe step. It supersedes the numbering below for implementation purposes; the numbering (1.1–1.12) remains the reference index, tied to where each idea originates in Ostwald's text.

**Stage 1 — Foundation**
`1.1` (✅ verify only) → `1.3` (🟡 selection done, combination missing — build next)
Net order is already a free parameter (`nodeCount` in all three grid builders in `forms.js`) — 1.1 is a UI-range check, not a build task. Theme-line selection itself is already free-form via mouse click within the polygon. What's missing in 1.3 is (a) endpoints outside the sub-polygon, and (b) pattern combination/overlay logic — the latter is the true prerequisite for 1.9 and 1.12, and remains the largest concrete gap in this stage.

**Stage 2 — Combinatorics & analysis layer**
`1.9` → `1.10` (🟡 data layer ready) → `1.11`
1.9 formalizes the pair/triple/quadruple machinery once 1.3's combination logic exists. 1.10's prerequisite — an angle-sorted adjacency list with `edgeIndex`/`angleDeg` per node — is already built in `buildExportData()`, and its code comment explicitly anticipates a "face-detection pass" for pattern coloring; the face-detection algorithm and coloring UI themselves are the remaining work. 1.11 (enumeration, Burnside/Pólya orbit reduction) follows once 1.9 and 1.10's richer pattern description are in place.

**Stage 3 — Line representation**
`1.4` (🟡 extend existing) → `1.5` (⛔)
Curve substitution is partially implemented: `drawCurvedBezier()` with a `curveAmount` parameter already covers Ostwald's simplest case (single curvature). Remaining scope: multi-fold curvature (2-/3-fold), symmetric/asymmetric variants, and compound lines (straight+curve, two curves) — Ostwald's full 18-case system. Free "clothing" of lines (1.5) has no infrastructure of its own and is a direct extension of 1.4.

**Stage 4 — Structural extension & synthesis**
`1.2` (✅) → `1.12` (⛔)
Alternative net construction is safest to build once the downstream pipeline (coloring, curves, combination) is stable, so the new net type can plug in without rework. 1.12 (cross-order, cross-net combination) is the natural culmination of 1.1, 1.3, and 1.2 together.

**Stage 5 — Temporal layer**
`1.8` (⛔)
High conceptual value, but genuinely cross-cutting: it animates the continuous parameters introduced in 1.3, 1.4, and 1.12. Placed here not for lack of priority but because it needs those parameters to exist first — flagged explicitly since it would otherwise be an early candidate by value alone.

**Stage 6 — Spatial / long-horizon research**
`1.6` (⛔) → `1.7` (⛔)
Independent research track; 1.6's geodesic work is a natural (though not strictly required) stepping stone toward `SpaceHarmony`'s 3D mandate in 1.7.

---

### Reference listing (Ostwald-text order)

### 1.1 Higher orders of existing nets — ✅ mostly implemented
- Sixth and seventh triangle (Ostwald: "already drawn," never published)
- Fourth hexagon (200+ patterns, deliberately omitted for scope)
- Each of the three series (triangle / square / hexagon) is, per Ostwald, unboundedly extensible
- *Status: `nodeCount` already parametrizes grid order in `buildTriangleGrid()`, `buildSquareGrid()`, `buildHexGrid()` (`forms.js`). Remaining work is raising/testing UI limits, not building new logic.*
- *Order-quirk (verification session): triangle and square's `order` 1 and 2 produce geometrically identical node sets (same coordinates, confirmed by direct comparison) — their subdivision formulas only place a first edge-midpoint node starting at order 3, so order 1's explicit corners-only branch and order 2's general-case output coincide by construction. Hex differs: its ring-based subdivision already adds a full inner ring plus edge-midpoints at order 2 (order 1 ≠ order 2 there). An unintended byproduct of three independently-designed subdivision formulas, not a deliberate per-shape definition of "order" — left as-is (not worth a breaking semantic change), since it has caused no real impact: the shipped catalog (`1.11` phases a–c) always started batch generation at order 3 for both shapes, so no duplicate content exists. Related, independent finding: `_alignmentConditionMet()` (`core/forms.js`) treats `baseNodeCount < 2` as degenerate but not `=== 2`, despite order 1/2 being geometrically identical here — a minor inconsistency, not a bug (the order-2 alignment math itself is correct).*

### 1.2 Alternative net construction — ✅ implemented
- General method: connect any two nodes, complete to a regular triangle/square/hexagon, tile the plane with the result — not restricted to nearest-neighbor sub-polygons
- Ostwald announced this method but never published it (*Sixth Portfolio, Concluding Remark*) — no primary source exists to check the construction against; this project's own geometric reading (edge PQ completed to a regular n-gon, `side` disambiguating which side of PQ) is stated plainly as such, not attributed to Ostwald beyond his one-sentence description
- *Status: built in three passes, `1.2-A`/`1.2-B`/`1.2-C`.*
  - *`1.2-A` (`407bd86`/`e85abff`): `completeEdgeToRegularPolygon()` (`core/forms.js`) constructs the edge-to-regular-polygon geometry; the three default grid builders' interior-subdivision logic was extracted into reusable `_subdivide*Interior()` helpers, verified byte-identical (square: exact; triangle/hex: ~1e-13 floating-point noise) against their pre-refactor output.*
  - *`1.2-B` (`3674afc`/`10b077f`/`cce6a8b`): generalized `core/tiling.js`'s tessellation (`tileTriangle`/`tileSquare`/`tileHex`, `getMeshWidth()`) from axis-aligned-only scalar stepping to a corner-derived `v1`/`v2` lattice basis via a shared bounds helper, so tessellation works for an arbitrarily rotated/scaled net, not just the canvas-centered default. This surfaced and fixed a real, pre-existing edge-coverage bug in the original hex/triangle tiling (a fixed margin constant that didn't scale with `shapeSizeFactor`, leaving a real gap along the canvas edge at some configurations) — found via regression testing, not introduced by the change. Also added a tile-count safety cap (`MAX_TILES`) against a pathologically small construction edge, and generalized `core/symmetry.js`'s `reflectVerticallyAround()` (hardcoded to a vertical mirror axis, correct only by coincidence for the three default axis-aligned builders) into a coordinate-free `reflectAcrossLine()`.*
  - *`1.2-C` (UI/interaction): a 3-click construction flow (click P, click Q with a live preview, click again to confirm which side of PQ the polygon is built on) via a one-shot `#btn-alternative-net` toggle, reusing the existing shape-selector buttons for polygon order and raw canvas clicks for P/Q (no new input primitive). Wired `1.2-B`'s `reflectAcrossLine()` fix into actual rendering via `mirrorAxisDir()` (`core/symmetry.js`) — this had NOT been wired in yet before `1.2-C`, confirmed by reading the code directly rather than assuming it from the prior session. Found and fixed a second, independent instance of the same axis-assumption bug in `core/orbits.js`'s theme-line naming/orbit-reduction engine (1.11), which has its own separately-reimplemented reflection primitive and feeds both the live pattern-name display and the JSON export's `patternName` field — verified as a genuinely separate code path, not assumed fixed by the `core/symmetry.js` change alone. Added a UI-level minimum-edge-length safeguard (`MIN_EDGE_LENGTH`) ahead of the safety cap, a `rebuildGridFromConstruction()` combiner tying construction+subdivision together with the same connection/layer-clearing behavior as an ordinary shape change, and `meta.altNetSeed` (`{p,q,side,n}`) in the JSON export for construction-history reproducibility.*
  - *Not covered: curved/free-clothing lines and face-fill coloring were not specifically re-verified against an alternative net in this pass (though both are architecturally orthogonal to grid construction — curve substitution operates on already-placed connections, and face-fill's rotation/reflection copies are produced by reusing the same, now-fixed rendering pipeline rather than a separate implementation). `1.12` (cross-net combination) is the next natural extension, not part of this item's own scope.*

### 1.3 Freer theme lines — 🟡 partially implemented
- Allow theme-line endpoints outside the sub-polygon
- Offset overlays: superimpose two sheets shifted by whole mesh-widths (not aligned) for patterns of "diminished lawfulness, i.e. greater freedom"
- *Status: arbitrary theme-line selection via mouse click, between any two nodes within the chosen polygon/node-count, is already implemented (`mousePressed()`). Two things remain: (a) allowing endpoints to fall outside the sub-polygon boundary itself — not currently possible, since node placement is bounded by the polygon; (b) pattern combination/offset overlay ("Verbindungen") — still entirely absent, and the larger of the two remaining gaps.*

### 1.4 Curved substitution for straight lines — 🟡 partially implemented
- Curve variants along Ostwald's described dimensions: number of curvature bends (he gives "1-, 2-, 3-fold, etc." — explicitly open-ended, not capped at 3), symmetric/asymmetric about the midpoint, left-/right-leaning
- Compound lines (two straights, straight+curve, two curves) with inward/outward meeting angle
- Ostwald announced a dedicated portfolio of curve examples — never realized
- *Note: Ostwald states "this yields, to begin with [zunächst], 18 different cases" (Erste Mappe, "Benutzung der Muster," referencing his own Fig. 4) without deriving or enumerating them explicitly, and the "etc." after "1-, 2-, 3-fold" signals the bend-count list is open-ended. The exact combinatorics behind "18" cannot be reconstructed cleanly from the stated three variables alone. Implement as continuous/open-ended parameters (bend count, symmetry toggle, direction toggle) rather than a fixed 18-item enumeration — a closed gallery of "the 18 cases" would overstate the text's actual precision. Fig. 4 has been reviewed directly: it shows three example curves illustrating increasing fold-count (1-/2-/3-fold), confirming the bend-count interpretation used in the fold parameter — but does not itself enumerate all 18 cases (symmetric/asymmetric × leaning × fold-count remain unconfirmed in combination).*
- *Status: `drawCurvedBezier()` already implements the simplest (1-fold) case. Do not conflate with the separate "Curved Lines" passage in Harmonie der Formen (Ch. "Unlimited Surfaces," Fig. 103–106) — different book, independent figure numbering; verify whether those figures are even present in the current `harmony.js` before referencing them anywhere in the UI or documentation.*

### 1.5 Free "clothing" of lines — ✅ implemented
- Geometric or naturalistic free strokes around the theme lines, with the underlying straight lines either kept visible in the finished pattern or made to disappear — the latter carrying "the particular charm of the 'hidden law'" ("heimliches Gesetz")
- Primarily suited to "open" patterns — those consisting of free-standing lines that don't form closed figures — per Ostwald's own scoping
- Ostwald states he has confirmed that even entirely arbitrarily chosen lines, never repeated but different between every node-pair, yield usable patterns, provided the node points themselves are held exact — this residual lawfulness alone suffices for a beautiful effect, as long as the exercised freedom appears somehow motivated
- *Source: Die Welt der Formen, Erste Mappe (full passage reviewed directly). This passage directly follows and extends the curved-substitution text (1.4) — Ostwald presents "free clothing" as a further derivation step after continuous curves and compound lines are exhausted, not an independent idea.*
- *Status: implemented as `curveType.kind: 'free'` (`core/curves.js`, Roadmap 1.5-A/1.5-B) - a seeded, per-connection noise offset (deterministic, exported, reproducible - never random at render time), a single continuous `roughness` parameter spanning "geometric" through "naturalistic" rather than two hardcoded styles (Ostwald names both but doesn't specify how either is constructed), and `curveType.visible` for the "hidden law" toggle. "Primarily suited to open patterns" is implemented as a documented aesthetic note only, deliberately not enforced - matching this project's general stance against gatekeeping aesthetic recommendations (see `1.4-A`'s own unbounded `fold`), and checking it would mean running face-detection speculatively on every redraw just to show a warning. UI: `#btn-toggle-free`, a roughness number input, an eye/eye-off visibility toggle, and a reroll button for the seed (not a raw number field - a seed has no meaningful order to tune, unlike shape size/node count). Exported via the existing `meta.curveType` field (no schema change needed - re-verified against SpaceHarmony's `importFlatForm()`/`_isFlat2DExport()` with real `kind:'free'` data, non-breaking).

### 1.6 Projection onto other surfaces — ⛔ not started
- Perspectival transformation of a regular net onto a less regular one (straight lines stay straight; only length ratios change)
- Projection onto curved/spatial surfaces: straight lines become geodesics — Ostwald stops here explicitly, calling it a step into three-fold space

### 1.7 Solid forms (3D) — the explicit open problem — ⛔ not started
- *Harmonie der Formen*, Ch. 8: Ostwald states he cannot undertake a harmony of solid forms himself, cites crystallography as partial groundwork, and explicitly invites others to develop a new, aesthetically grounded systematics
- Direct conceptual mandate for `SpaceHarmony`

### 1.8 Temporal / dynamic form art — 🟡 partially implemented
- *Harmonie der Formen*, "The Two Sources of Art": Ostwald anticipates a future formal "light art" comparable to the art of tone, explicitly including "the great artistic means of temporal variation" — an implicit invitation to animate/parametrize form harmony over time
- *Status: layer-level transform animation (`offsetX`/`offsetY`/rotation/`shapeSizeFactor` interpolation), a pattern-to-pattern connection morph, and a persistent-layer keyframe timeline (N ordered, real, independently-editable layers as keyframes, each added individually via "Add to Timeline" while its tab is active; fixed per-segment duration, no auto-loop; live-resolved interpolation, fed by catalog-to-layer loading) are all shipped. One follow-on remains open: deprecating the earlier Set Start/End capture mechanism, which is still kept alongside the new timeline per the phased plan rather than removed.*
- *Stage D phase (i), line pairing (`eb713323`/`d04c6af2`/`20ae7472`): the Start→End line correspondence, previously implicit in click order (index i ↔ index i), is now editable per timeline segment — a "Line Pairing" panel with Up/Down buttons (not drag) swapping End assignments, a live preview parked at t=0.5 on every reorder, and a Σd² displacement readout (current vs. default order) as an orientation aid. Timeline path only; the legacy Set Start/End mechanism is unchanged. Per-line orbit-member choice (a much larger space than n!) and endpoint orientation: see phases (iv)/(iii) below. Measured finding: genuinely coincident/collapsed orderings are rare (≤3% in sampled 2-line cases, symmetric-copy patterns only — none seen in the triangle grids tested), so symmetry-equivalence dedup (via `1.11`'s orbit machinery) is deferred to a possible future pass, not solved here. Phase (ii) (`c88be801`/`6e4fd18b`/`46e06794`): a "Browse all" list (shown for 2≤n≤5) enumerates all n! pairings of the active segment, sortable/filterable by Σd²; picking an entry commits through the same `setTimelinePairing()` path the Up/Down buttons use, so it is identical to stepping there manually. Dedup was deliberately not built (collapse is rare per the measurement above — though larger for symmetric-copy rosette patterns at n≥3). Per-candidate thumbnail previews were considered but not built (numeric-only by design); measured render cost is low (~3.5 ms for 120), and they would help since many candidates share a Σd² value (15 distinct values across 120 at n=5 in the test pattern). Phase (iii) (`a8c74228`/`af672e98`/`71f8665f`): per-line endpoint orientation is now controllable independently of the correspondence — a ⇄ toggle per row, stored per End line (`segmentFlips[]`, so a flip survives Up/Down reordering; Σd² follows it; timelines without flips behave exactly as before, verified by a differential test against the prior code). This closes a gap surfaced by real use: at n=1 the correspondence is trivial, yet orientation alone yields two geometrically distinct transitions (what click order used to decide silently). "Browse all" is therefore now shown whenever the combined space n!·2ⁿ exceeds 1 (previously n!>1), i.e. from n=1, where it lists the two orientations; for n≥2 it stays the n! correspondence list (no flat n!·2ⁿ list). Thumbnails for that list remain considered but not built. Phase (iv) step 1 (`aa7967e5`/`0808d50e`/`b938ee31`/`15977e09`): which symmetry-equivalent concrete node-pair an End line resolves to is now a third independent dimension, `segmentMembers[]` (per End line, a group-element index, 0 = as clicked; `core/orbits.js` now exports the group elements with a per-grid cache). Applied at interpolation time only — the keyframe layer's own connections are never touched; timelines without it behave exactly as before (differential test against the prior code, 177,840 comparisons, 0 differences). Candidates are deduplicated per row by coordinates: each (element, flip) is compared by the picture it actually renders against that row's own Start line (all images under the full symmetry group, t=0.25/0.5/0.75, 1e-3 px), not by symbolic stabilizer reasoning — the equivalence depends on the paired line. Brute-force enumeration before and again against the shipped code confirmed: `1*/D3 2` (a median, 3 members × 2 orientations = 6 raw) has 4 distinct transitions when self-paired (not 6), and 6/3/3 against real second patterns of orbits 0/1/3; `2*/D3 0+2` self-paired (crossed orbit types included) has 12·4 + 6·6 = 84 distinct pictures in all 18 concrete member choices. This also caught an error in earlier symbolic measurements: the class key missed that (a,b) and (rev a, rev b) are the same moving line, understating flip redundancy about 2× (e.g. 13% instead of 6% on triangle order 3); correspondence-swap collapse (0% for distinct lines) was unaffected. The originally reported count of 5 transitions could not be reproduced as a count of distinct pictures (fixed lines give 8 at n=2); it may reflect the Σd² readout, which takes 5 distinct values for the identical-pattern case. The n=1 "Browse all" list now shows these deduplicated member+flip candidates. Phase (iv) step 2 (`c821a3f0`/`fd6c0de1`/`951ab637`): a "k/c" stepper per row in the Line Pairing editor now exposes member choice (with its paired flip, one step = one (element, flip) variant) for any n, not just via the n=1 list. `c`, the row's deduplicated variant count, is recomputed on every render from which two lines are currently matched (12 / 6 / 4 for orbit 0↔0 / 0↔2 / 2↔2 on triangle order 3, per step 1's verified numbers), so it changes after Up/Down; `k` is the current state's actual position in that row's list, found by its rendered-image key rather than the stored element index, so a reordered row shows its true position, not a stale one. The stored choice stays tied to the End line, not the row position — confirmed by reordering (12/4 → 6/6) and reversing back (12/4 restored); Reset pairing also clears member choice. Verified in a real browser on `2*/D3 0+2` against an independent coordinate computation. Thumbnails / whole-transition dedup (step 3) remain the one open, optional step of the original plan.*
- *Known issues (deferred to a future UI cleanup pass):*
  - *Stale `#timeline-status`: after removing a keyframe, the "Timeline removed: ..." message persists until the next animate/timeline action instead of clearing immediately. Cosmetic only.*
  - *Safari-specific layer-deletion bug: deleting a layer behaves correctly in Chrome but not in Safari (not yet root-caused; needs its own investigation session).*
  - *No feedback when a timeline has fewer than 2 keyframes: "Add to Timeline" adds only the active layer tab (unlike the old "Animate A→B"), so a person can end up with one keyframe and no hint why Play does nothing. Needs a UI affordance (placeholder text in the empty/single-entry list, or a status message) saying at least 2 keyframes are required and each layer must be added via its own tab.*

### 1.9 Higher-order combinatorics — ✅ implemented
- Pairs → triples → quadruples systematically applied throughout; Ostwald stops enumerating individually only for reasons of scope, not principle — the method itself is open-ended
- *Status: implemented via `additionalLayers[]` (`core/state.js`) — any number of additional pattern layers, each independently scalable/offsettable/rotatable, with its own net type and symmetry mode (`1.12` stages 1-5, all shipped — see that entry below for the per-stage breakdown).*

### 1.10 Line-intersection detection and pattern coloring — 🟡 data foundation ready
- Detect closed regions (faces) formed by line crossings, building on the adjacency-list structure already designed for this purpose (`edgeIndex`, `angleDeg` in the JSON export schema)
- Enables systematic coloring of patterns by enclosed area — Ostwald himself relied on this only informally ("man kann die Linien durch Farbe zur Geltung bringen," *Erste Mappe*, Sh. 6) without a computational method
- Foundation for later color-harmony integration (cf. Ostwald's *Farbharmonik*, referenced but not detailed in either work)
- *Status: `buildExportData()` already builds a full angle-sorted adjacency list per node, with an explicit code comment anticipating this exact "face-detection pass." The face-finding algorithm and coloring UI are the remaining work — the hardest prerequisite (correct adjacency data) is already done.*

### 1.11 Systematic enumeration and naming of patterns — ✅ implemented
- Ostwald named patterns individually and by hand (Carnation, Wine Star, Triple/Quadruple/Sextuple Cross, Wheel, etc.), with explicit acknowledgment that the naming was laborious and incomplete beyond the published sheets
- Develop a systematic enumeration scheme (net type, order, theme-line class) paired with either algorithmic descriptive naming or a curated naming interface
- Apply Burnside/Pólya orbit reduction to collapse symmetry-equivalent theme lines before naming/enumerating — directly addresses the combinatorial explosion Ostwald flags repeatedly ("die Anzahl... übertrifft das beste Gedächtnis")
- *Status: shipped in three parts. `1.11-A`: `core/orbits.js`'s symmetry-orbit engine (union-find partition, cross-checked against Burnside counts). `1.11-B`: the systematic theme-line naming format, shown per sheet and exported as `patternName`/`themeLineOrbits`. Pattern catalog (`gallery.html`, phases a–c): headless single-cell renderer + pre-generated manifest/thumbnails for triangle/square/hex orders through the shipped range, a filterable, paginated browser with symmetry-group filters and a detail view, and a live "Custom Orbit Combinations" builder; catalog patterns load back into the generator as the base sheet, a new layer, or via Copy/Paste Pattern.*
- *Naming scheme: see `docs/terminology.md`, Part B, for a proposed systematic (Hinterreiter-style) parametric naming grammar, cross-referenced to Ostwald's original names for historical traceability. Includes open sub-tasks (canonical node numbering, mapping script, backfill table, orbit-equivalence handling) that constitute the concrete first steps for this item.*

### 1.12 Pattern combination beyond same-order pairs — ✅ implemented
- Ostwald's "Verbindungen" sections combine patterns of the *same* polygon order (pairs, triples, quadruples) via direct overlay
- Extend this to:
  - combinations of patterns from polygons of *different* orders/sizes (e.g., third-triangle × fifth-triangle) — an extrapolation from Ostwald's combinatorial logic, not an idea he states explicitly (searched but no supporting passage found)
  - combinations across net types where compatible (triangle × hexagon, sharing the same underlying triangular lattice)
  - arbitrary sub-mesh-width shifts as a continuous parameter, generalizing the discrete "offset overlay" case already noted in 1.3
- Unlike 1.1–1.9, this entry is a genuine extension beyond Ostwald's own stated program, not an implementation of an announced-but-unrealized idea
- *Status: shipped across the five stages below — same net type at independent order/size, shared center (stage 1); independent per-layer offset (stage 2); independent per-layer rotation (stage 3); combination across different net types, e.g. triangle × hexagon (stage 4); and independent per-layer `symmetryMode` (stage 5). Stage 5 goes beyond the original four-stage build order below — noted honestly here rather than silently folded into stage 4 — added once per-layer shape/order independence made a single shared symmetry mode across differently-typed layers stop making sense.*

*Suggested build order for 1.12 (staged by degrees of freedom, not from a textual source - 1.12 is already flagged as a genuine extension beyond Ostwald's stated program, not a reconstruction):*
1. *Same net type, different order/size, shared center (no offset, no rotation) - the most constrained case, extending 1.9's `additionalLayers[]` model (currently one shared grid for all layers) to allow independent grid scale per layer while keeping center/orientation/type fixed.*
2. *Add independent per-layer offset (translation) - generalizing 1.9's existing offset mechanism, which currently only shifts a layer's connections relative to one shared grid, to also apply to an independently-scaled grid.*
3. *Add independent per-layer rotation.*
4. *Different net types combined (e.g. triangle × hexagon) - the case explicitly named in the roadmap text itself, built last since it requires the most machinery (independent grid type per layer, not just independent scale/position/rotation of the same type).*

### Future candidate: curve-aware face detection
- Currently, `core/faces.js`'s face detection and coloring is explicitly straight-line-only (`curveType.kind !== 'straight'` guard) — switching to any curved line type (`'curve'`, `'compound'`, `'free'`) disables face-fill entirely, both algorithmically and via the UI's mutual-exclusion toggle. This is a known, deliberate v1 limitation from `1.10a`/`1.5`, not a bug.
- Extending face-detection to curved geometry would need real Bézier-Bézier intersection math (numerical subdivision/root-finding), a materially harder problem than the straight-segment intersection `1.10` currently solves.
- Not currently scheduled in the Suggested Build Order — flagged here as a possible future item if curved+colored patterns become a priority. Natural placement would extend `1.10`'s existing work, though the required math is closer to `1.4`/`1.5`'s curve-construction domain.

### Planned extensions (prioritized, not yet started)
Agreed in a planning session, not yet reflected in code. Distinct from the numbered Ostwald-text items above — some extend already-shipped features (`1.8`, `1.9`, `1.12`), one (Group E) needs source research before design can even start. Recommended order: **A → B → C → D → (E in parallel throughout) → F.**

**Group A — small, independent, do first — ✅ shipped**
- Node-count UI limit raised from 5 to **7** (`0150d124`), not risk-free above that: `updatePatternNameStatus()`'s orbit-table computation (`core/orbits.js`) reruns uncached on every node click (not just on a node-count change) and grows fast with node count, especially for hex (~3n² nodes) — measured 21ms at hex order 5, 41ms at 6, 71ms at 7, 119ms at 8 (6.5s at 20). 7 was chosen against a 100ms per-click target, derived from `1.10b-ii-d`'s own established bar (its ~390ms uncached cross-layer face-fill was already judged too slow and fixed with a cache): order 8 misses it, order 7 clears it with margin. Real-browser check at hex order 7 (169 nodes): ~52–57ms per click, matching the headless figure; a catalog URL at order 7 loads end-to-end, order 8 is refused. All five hardcoded locations changed together — both `min`/`max` HTML attributes, both JS clamps, and the easily-missed, independent `isWellFormedCatalogPattern()` check (`sketch.js`). A materially higher limit still needs an orbit-table cache first (analogous to `1.8` Phase (iv)'s `getGroupElementsCached()`), not bundled into this pass.
- Curve-parameter controls (`06ccd21f`) — only `roughness` (`1.5-A`) was a genuine widget swap (number input → slider, same range, unchanged parsing). `fold` (stepped integer, 1–12) and `strength` (continuous, 0–200) are new controls where none existed — both had been hardcoded once at curve-mode activation and never re-read. `strength`'s range was resolved from the real geometry, not guessed: `core/curves.js`'s `mag < 0.0001` guard turns any negative strength into a plain straight line rather than a mirrored bulge, so bulge direction is `leaning`'s job (sign flip), not strength's — the control correctly stays non-negative; at `fold=2` (the true S-curve), strength 200 gives a ~58% peak deviation of the chord on each side, a full double bend with no self-intersection (checked up to 500). `fold`'s max of 12 comes from measured connection lengths at the new node-count ceiling (~38px shortest edge at hex order 7): a lobe's offset falls below half the 2px stroke width around fold ≈ 9.5 at the default strength. Two deliberate behavior changes: re-activating curve mode now resumes at the last-used fold/strength instead of resetting to 1/25, and `strength` is one shared control for `kind:'curve'` and `kind:'free'`, so free mode's first-ever starting strength moved from 20 to 25. `seed` was dropped from this group: `1.5-B`'s reroll-button design was a deliberate choice ("a seed has no meaningful order to tune"), not an oversight.

**Group B — deferred UI cleanup, now due**
- A general UI cleanup pass, bundling the three known issues already documented under `1.8` (stale `#timeline-status` message, Safari-specific layer-deletion bug, no feedback for a single-keyframe timeline) with a broader UI simplification/review.

**Group C — reproducibility**
- Seed-based reconstruction of random connections — `addRandomConnection()` currently uses unseeded `Math.random()`; reuse the existing `curveType.seed` pattern (`1.5-A`) rather than inventing a new mechanism.

**Group D — color system (largest, multi-step)**
1. Define an Ostwald color-harmony system — his color theory (*Die Harmonie der Farben* or equivalent), not yet touched by this project; to be verified against the actual primary source before implementation, matching this project's established practice of checking claims rather than assuming them (see `1.4`'s Fig. 4 correction as precedent).
2. Manual face-to-color assignment — an interaction pattern analogous to `1.8` Phase (iv)'s "step through possibilities" line-pairing UI, once faces exist to assign colors to; depends on `1.10`'s existing face-detection.
3. Extend to per-layer independent coloring, leveraging `1.12`'s already-shipped independent per-layer shape/scale/order/symmetryMode — color becomes another independent per-layer property, not a new architectural concept.
4. Extend to color as an animatable parameter within the existing `1.8` timeline/keyframe infrastructure — transform parameters already interpolate over time; color would be a new interpolation target using the same mechanism, building on (not replacing) the transform/connection-morph animation already shipped.

*Status (items 1–2 in progress; no UI yet — Phase 3):*
- **Phase 1 — color engine** (`4f79e20b`, `core/color.js`): sRGB/linear-light/Oklab/Oklch conversion, `resolveColor()`, an open harmony-rule registry, a 24-hue reference wheel (Oklch, C=0.10 — gamut-tested), and four rules (isotints, isotones, shadow series, tetrad). Mixing is in **linear light, deliberately not Oklab**: Ostwald's system is defined by physical disc-mixing (additive), and the measured Oklab-vs-linear divergence (ΔE 0.08–0.31, perceptual threshold ~0.02) means Oklab would be a different color system, not a better version of the same one. 50 headless tests (`tools/color/test-color.js`). Unverified constants — letter-step percentages, the shadow-series definition, the two-letter level notation, the ring's calibration — are tagged `verified:false`/`calibrated:false` in the data, and the suite fails if anything claims `'primary'` before it is checked against Ostwald's text.
- **Phase 2 — face-trail key + assignment store** (`86a1eefd`, `fe065d23`, `bae42b11`, `core/facecolor.js`): a geometric key (vertex set, canonical over the group elements, 0.01px) identifies a face's whole symmetry trail (finer than `connIndex`); assignments live in a per-sheet Map (base in `state.js`, each layer on the layer object), outside the per-redraw face objects, and override `orbitColor()` in `computeCellFaces()` for assigned trails only. Verified against 258 real patterns (10,112 faces): key stable across redraws, 0 collisions, unassigned rendering byte-identical, ~0.7ms per pattern (only paid when a sheet has assignments). Export untouched (Phase 4).
- **Open decisions from Phase 2's split/merge investigation** (675 real single-orbit edits; 63% of trails survive, the rest lose their assignment), deferred rather than resolved:
  - (a) *Orphans are kept*, not cleaned up, so Undo restores the color — deliberate, not an oversight.
  - (b) *Split/merge inheritance*: no color survives when a face splits or merges (~30% of single-edit cases in the sample). A non-trivial Phase 3 candidate needing a face-overlap heuristic; not built.
  - (c) *Stub-vertex key instability* (0.1%): a face's key changes when a dangling stub on its boundary is added/removed although the visible face is unchanged. Small candidate fix (filter stubs from the key); not built.
- **Independent finding, outside Group D's scope:** a pre-existing `findFaces()` bug (hex only, ~0.5% of faces in the sample: 53 of 10,112) — a face's image under a group element has no counterpart in the detected face set, although the raw segments are group-closed (0 of 55,804 violations). Not snap tolerance; not root-caused. Flagged for a future session.

**Group E — source research required before design**
- "Netzorgel" (net-organ) — net transformations mentioned by Ostwald and elaborated by Hinterreiter. Needs primary-source verification (which text, what's actually described) before any design session; the person's own research task, not yet started. Can proceed in parallel with any other group.

**Group F — experimental, depends on Group D**
- Extend time-based metamorphosis (currently theme-line/connection morphing, `1.8`) to surfaces/faces — once Group D's face-coloring exists, could faces themselves morph (in color, shape, or both) over time, analogous to how lines currently do. Explicitly speculative/exploratory, sequenced after Group D since it depends on Group D's output existing first.

---

## Priority 2 — Editorial Framing (planned, coming weeks)

- Diachronic framing: the project's place in the history of form theory (Truchet/Douat → Ostwald → today)
- Synchronic framing: how the two works relate to each other and to contemporary generative design
- Historical contextualization of dated or chauvinistic language in the source texts — situating without excusing
- Introductory essays for the Harmony and World editions (see also `docs/website-editorial-checklist.md`)

### Public visibility strategy

The repositories and live site are already technically public, but broader visibility should follow readiness, not precede it. Proposed sequence:

1. **Complete editorial framing above first.** Historical language in the source texts should be contextualized before actively directing outside attention to the site — not a blocker for the site existing, but a prerequisite for *promoting* it.
2. **Generator Stage 1–2** (`world_of_forms_generator` roadmap: pattern combination, enumeration) — makes the interactive centerpiece more compelling before drawing in the generative-design/creative-coding audience specifically.
3. **Informal outreach to relevant scholarly and practitioner communities** (design research, history of science/Ostwald studies, geometry-focused creative-coding circles) once (1) and (2) are in place — mailing lists, forums, relevant conferences (e.g. design history journals, Eyeo, Ars Electronica–adjacent circles), not paid growth/SEO services, which are a poor fit for an academic-editorial niche project.
4. **Wider public/press attention** bundled with the Spector Books publication (2027) as the natural announcement anchor, rather than sought earlier ad hoc.

---

## Priority 3 — Long-Term Platform Phases

### Phase A — Raumharmonik Module
Interactive complement to *Die Harmonie der Formen*, built step by step as p5.js / Observable tools:

| Component | Content |
|---|---|
| Lines | straight, curved, continuous/discontinuous; sine, substitute-sine, zigzag, sawtooth; jump/kink/shock; direction, curvature |
| Braids (Flechten) | wave overlays via shifting; single-/multi-strand; wavelength, phase, symmetry, density; water waves, meanders |
| Bands (Bänder) | translation/reflection/rotation combinations; edge/midline structure; loosening stages |
| Unlimited Surfaces | triangular/square/hexagonal nets; lawful coverage; golden ratio; loose vs. tiling distribution |
| Limited Surfaces | frames, borders, spandrels; central piece; gravity influence; harmonious subdivision |
| Pictorial Art & Solid Forms | balance, density, symmetry; 2D → 3D transition; outlook to spatial structures |

Planned tools: line generator, wave/braid generator, band generator, surface-pattern explorers, limited-surface and pictorial-balance modules.

### Phase B — Book Development
- Critical-edition commentary integration for both works
- Print-quality image reproduction
- Formalized DE/EN terminology glossary
- Visual index of all form categories
- Layout coordination with Spector Books; academic peer review

### Phase C — Expanded Digital Platform
- Ostwald Form Lexicon (DE/EN)
- Historical documents and unpublished material
- Gallery of user-generated/derived forms
- API-like access for educators/researchers
- Workshops and teaching material

### Phase D — Long-Term Vision
- Establish the platform as an open research tool for design education, computational arts, and mathematical/geometric art
- Physical prototyping (plotter, laser cutting, CNC)
- Partnerships with archives, museums, universities
- Second edition or extension volume: *Raumharmonik & Computation*

---

## See also
- `docs/website-editorial-checklist.md` — near-term editorial/UX polish plan (structure, readability, tone), independent of the generative-development priorities above.