# Terminology

Two parts: (A) the operational vocabulary — structural/mechanical terms used throughout the code, UI, and bilingual editions, translated from Ostwald's German; (B) a proposed systematic naming scheme for individual named patterns, replacing Ostwald's evocative names with a Hinterreiter-style parametric code, cross-referenced to his originals for historical traceability. Part B is a design proposal tied to Roadmap item 1.11, not yet implemented.

---

## Part A — Operational Vocabulary

These terms describe structures and operations, independent of any specific pattern's name. Established during the bilingual edition work; use consistently in code, UI, and documentation.

| German | English | Notes |
|---|---|---|
| Knoten | node | |
| Knotenlinie | node line | |
| Thema / Themalinie | theme (line) | the seed line a pattern is generated from |
| Spiegellinie | mirror line | not "axis of symmetry" |
| Spiegelbild | mirror image | |
| Spiegeling | mirror pair | Ostwald's term for a mirror-generated compound form |
| Drehling | rotational form | Ostwald's term for a rotation-generated compound form |
| Drehpunkt | center of rotation | |
| spiegelgleich | mirror-equal | not "mirror-symmetric" |
| bar / netzbar | parallel / net-parallel | "bar" = parallel to a reference line; "netzbar" includes diagonal net directions |
| schlüssig | tiling | forms that tile the plane without gaps |
| Netz | net | |
| Masche | mesh | |
| unbegrenzt / begrenzt | unlimited / limited | not "infinite" / "finite" |
| Verbindung(en) | connection(s) | Ostwald's term for pattern combinations (pairs/triples/quadruples); see Roadmap 1.3, 1.9 |
| Mappe | portfolio | |
| Blatt / Bl. | sheet / Sh. | not "plate" (reserved for "Tafel", the print-run numbering) |
| Lage | position | "erste/zweite/dritte Lage" = first/second/third position |
| paarzahlig / unpaarzahlig | of even / odd order | |
| Stern | star | open form from crossing lines |
| Spitze | tip | closed, star-like form; "Dreispitz" = three-tip, "Zwölfspitz" = twelve-tip, etc. |
| Sechsspitz | hexagram | exception to the -tip pattern: two overlaid equilateral triangles, established English term |
| gestachelt | spiked | |
| verschränkt (petals) | interlocked | e.g. Carnation |
| verschränkt (lines/stars) | interlaced | e.g. Interlaced Six-Point Star |
| Nelke | carnation | |
| Weinspitz | wine star | |
| Brillant | brilliant | |
| Rad | wheel | |
| Feuerrad | Catherine wheel | |
| Drudenfuß | triple / quadruple / sextuple cross | named by line count (3/4/6), not "pentagram" — Ostwald's usage is not the pentagram sense |
| Rautenkranz | rhombus wreath | |
| Eckspitz | corner-tip | |
| Dreisechs | tri-hex | |
| Zweier / Dreier / Vierer | pairs / triples / quadruples | not "-fold" (reserved for "-faltig", symmetry multiplicity) |
| heimliches Gesetz | hidden law | Ostwald's term (Die Welt der Formen, Erste Mappe, the "free clothing" passage - see Roadmap 1.5) for the effect when a free/naturalistic stroke's underlying theme-line is hidden rather than shown - the pattern still follows a strict rule, but that rule isn't visible on its face. Implemented as `curveType.visible` (`core/curves.js`, `kind: 'free'`) - `false` hides the underlying chord (the "hidden law" case Ostwald names), `true` shows both. |

---

## Part B — Proposed Systematic Naming Scheme (Roadmap 1.11)

### Rationale

Ostwald named patterns by hand and explicitly acknowledged the practice doesn't scale ("die Anzahl... übertrifft das beste Gedächtnis"). Hinterreiter's approach — strict, parametric, geometry-derived labels — replaces evocative naming with codes that are:

- **unambiguous**: the code alone reconstructs the geometry
- **generatable**: can be produced programmatically from the same data `buildExportData()` already emits, once combined with 1.9's combinatorics layer
- **scalable**: works identically for pattern #1 and pattern #10,000

Ostwald's names remain valuable as historical/editorial reference and stay attached as metadata — this scheme doesn't erase them, it adds a parallel, systematic identifier.

### Proposed grammar

Format: `{count}*/{GroupToken} {orbitId}+{orbitId}+...` — implemented in `core/orbits.js` (`formatThemeLineName()` / `computeThemeLineName()`), Roadmap 1.11-B.

- `{count}`: the number of theme-lines actually drawn in one sheet (Zweier/Dreier/Vierer, Part A above) — not the number of distinct symmetry classes among them.
- `{GroupToken}`: the active dihedral/cyclic group's structure (`D4`, `C3`, `Z2`, `C1`, ...), derived from the shape's actual rotation-angle set plus whether reflection is active — not from the raw `symmetryMode` string, since `core/symmetry.js`'s `rotation3`/`rotation6` give identical angle sets for triangle/square (`core/orbits.js`'s `groupTokenFor()` collapses those two mode names to the same token).
- `{orbitId}+...`: one canonical orbit id (`core/orbits.js`'s `computeThemeLineOrbits()` — orbits sorted by their lexicographically-smallest member node-pair) per theme-line, listed in **ascending** order rather than click order, so the name is an invariant of the constructed pattern, not of the sequence it was drawn in — and **not deduplicated**, so the list length always matches `{count}`.

**Source and divergence.** This `{count}*/{group} {segments}` structure is adapted from Hans Hinterreiter's own working notation, confirmed via primary-source research: Hart, G., "Hans Hinterreiter's Flowing Fields," *Bridges 2024 Conference Proceedings*. A documented example from Hinterreiter's notes reads `4*/6 98a+82a+52e+75a` — "4 basic segments, 6-fold rotational symmetry (no mirror), four segment codes." That independently confirms this project's own Zweier/Dreier/Vierer reading (a count of base theme-lines within one sheet, under one symmetry group) matches Hinterreiter's real structure.

What this scheme does **not** reproduce: Hinterreiter's exact digit+letter segment-coding convention (what makes a segment `98a` rather than `98b`) is not publicly documented — Hart's paper explicitly declines to explain it, and it exists only in Hinterreiter's rare 800-page book *Die Kunst der reinen Form* (1978), which the project's maintainer owns a copy of but whose specific conventions have not been confirmed to help rather than add idiosyncratic friction. Rather than guess at or reverse-engineer that convention, this scheme uses its own logical, documented segment identifier instead — a canonical orbit id from a plain Burnside orbit-reduction over the active symmetry group (`core/orbits.js`). Stated plainly rather than overclaiming fidelity to Hinterreiter's original notation.

**Editorial aside**, not a design consideration for 1.11 itself: Hinterreiter was directly influenced by Ostwald's color theory (also noted in Hart's paper) — a genuine historical link worth flagging given this project's own Ostwald focus. He also deliberately avoided infinite tessellation in his own work, describing it as "too crystalline" and lacking "inherent closure" — a real point of divergence from Ostwald's (and this project's) tessellating approach. Worth noting in the project's editorial framing (see `ROADMAP.md`, Priority 2) at some point, not a blocker here.

### Proposed grammar