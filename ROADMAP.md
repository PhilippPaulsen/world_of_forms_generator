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

### 1.8 Temporal / dynamic form art — ⛔ not started
- *Harmonie der Formen*, "The Two Sources of Art": Ostwald anticipates a future formal "light art" comparable to the art of tone, explicitly including "the great artistic means of temporal variation" — an implicit invitation to animate/parametrize form harmony over time

### 1.9 Higher-order combinatorics — ⛔ not started (depends on 1.3)
- Pairs → triples → quadruples systematically applied throughout; Ostwald stops enumerating individually only for reasons of scope, not principle — the method itself is open-ended

### 1.10 Line-intersection detection and pattern coloring — 🟡 data foundation ready
- Detect closed regions (faces) formed by line crossings, building on the adjacency-list structure already designed for this purpose (`edgeIndex`, `angleDeg` in the JSON export schema)
- Enables systematic coloring of patterns by enclosed area — Ostwald himself relied on this only informally ("man kann die Linien durch Farbe zur Geltung bringen," *Erste Mappe*, Sh. 6) without a computational method
- Foundation for later color-harmony integration (cf. Ostwald's *Farbharmonik*, referenced but not detailed in either work)
- *Status: `buildExportData()` already builds a full angle-sorted adjacency list per node, with an explicit code comment anticipating this exact "face-detection pass." The face-finding algorithm and coloring UI are the remaining work — the hardest prerequisite (correct adjacency data) is already done.*

### 1.11 Systematic enumeration and naming of patterns — ⛔ not started (depends on 1.9)
- Ostwald named patterns individually and by hand (Carnation, Wine Star, Triple/Quadruple/Sextuple Cross, Wheel, etc.), with explicit acknowledgment that the naming was laborious and incomplete beyond the published sheets
- Develop a systematic enumeration scheme (net type, order, theme-line class) paired with either algorithmic descriptive naming or a curated naming interface
- Apply Burnside/Pólya orbit reduction to collapse symmetry-equivalent theme lines before naming/enumerating — directly addresses the combinatorial explosion Ostwald flags repeatedly ("die Anzahl... übertrifft das beste Gedächtnis")
- *Naming scheme: see `docs/terminology.md`, Part B, for a proposed systematic (Hinterreiter-style) parametric naming grammar, cross-referenced to Ostwald's original names for historical traceability. Includes open sub-tasks (canonical node numbering, mapping script, backfill table, orbit-equivalence handling) that constitute the concrete first steps for this item.*

### 1.12 Pattern combination beyond same-order pairs — ⛔ not started (depends on 1.1, 1.3, 1.2)
- Ostwald's "Verbindungen" sections combine patterns of the *same* polygon order (pairs, triples, quadruples) via direct overlay
- Extend this to:
  - combinations of patterns from polygons of *different* orders/sizes (e.g., third-triangle × fifth-triangle) — an extrapolation from Ostwald's combinatorial logic, not an idea he states explicitly (searched but no supporting passage found)
  - combinations across net types where compatible (triangle × hexagon, sharing the same underlying triangular lattice)
  - arbitrary sub-mesh-width shifts as a continuous parameter, generalizing the discrete "offset overlay" case already noted in 1.3
- Unlike 1.1–1.9, this entry is a genuine extension beyond Ostwald's own stated program, not an implementation of an announced-but-unrealized idea

### Future candidate: curve-aware face detection
- Currently, `core/faces.js`'s face detection and coloring is explicitly straight-line-only (`curveType.kind !== 'straight'` guard) — switching to any curved line type (`'curve'`, `'compound'`, `'free'`) disables face-fill entirely, both algorithmically and via the UI's mutual-exclusion toggle. This is a known, deliberate v1 limitation from `1.10a`/`1.5`, not a bug.
- Extending face-detection to curved geometry would need real Bézier-Bézier intersection math (numerical subdivision/root-finding), a materially harder problem than the straight-segment intersection `1.10` currently solves.
- Not currently scheduled in the Suggested Build Order — flagged here as a possible future item if curved+colored patterns become a priority. Natural placement would extend `1.10`'s existing work, though the required math is closer to `1.4`/`1.5`'s curve-construction domain.

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