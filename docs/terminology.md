# Terminology

Two parts: (A) the operational vocabulary — structural/mechanical terms used throughout the code, UI, and bilingual editions, translated from Ostwald's German; (B) the systematic naming scheme (v2) for individual patterns, replacing Ostwald's evocative names with a Hinterreiter-style parametric code, cross-referenced to his originals for historical traceability. Part B describes the implemented v2 scheme (Roadmap 1.11, tasks 054-066); the live name display still shows the legacy name, see the end of Part B.

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
| Farborgel | Color Organ | proper name (the color tool), visible text only, US spelling; not in file, function or variable names |
| Formorgel | Form Organ | proper name (the pattern catalog), visible text only, US spelling; not in file, function or variable names |
| Netzorgel | Net Organ | proper name, visible text only, US spelling; not in file, function or variable names |
| Atlas | Atlas | proper name / view of the Farborgel page (the 28 registers x 24 hues); "Atlasfarben" = atlas colors; not translated further |
| Weißgleiche / Schwarzgleiche | isotints / Black (isotints) | UI text on the main page and the Farborgel page ("White (isotints)", "Black (isotints)"); core/color.js still says "Isotones (Schwarzgleiche)" - to be unified (type K) |
| Wertgleich / Wertgleiche | Value (equal value) | UI text; "isovalent" stays only in code identifiers (relation keys), not in visible English |

---

## Part B — Systematic Naming Scheme (v2; Roadmap 1.11, tasks 054–066)

### Rationale

Ostwald named patterns by hand and explicitly acknowledged the practice doesn't scale ("die Anzahl... übertrifft das beste Gedächtnis"). Hinterreiter's approach — strict, parametric, geometry-derived labels — replaces evocative naming with codes that are:

- **unambiguous**: the code alone reconstructs the geometry
- **generatable**: produced programmatically from the grid and its lines (the export carries it, `meta.grid` + `geometry.lineKeys` + `name`)
- **scalable**: works identically for pattern #1 and pattern #10,000

Ostwald's names remain valuable as historical/editorial reference and stay attached as metadata (the Ostwald backfill of the catalog) — this scheme doesn't erase them, it adds a parallel, systematic identifier.

### Grammar (v2)

Name: `{ordnung}{d|q|*}{lage}/{3*|4*|6*} {token}+{token}+...` — implemented in `core/orbits.js` (`formatGridName()` / `parseGridName()`), pure functions of a grid and its line keys.

- `{ordnung}{d|q|*}{lage}`: the grid. `ordnung` = the divisions per side of the net (an integer ≥ 1); `d` triangle, `q` square, `*` hexagon; `lage` 1 (the nodes of the net) or 2 (lage 1 plus the centres of all smallest meshes; locked in the app, built by the tests through `allowLage2`). Example: `3d1`.
- `{3*|4*|6*}`: the main group of the shape (the full rotation-reflection group, 2K elements): only this group has a systematic name. A reduced symmetry mode (rotation only, one mirror, hexagon 3-fold) has none.
- `{token}`: one **line key**, `{family}{letter}[~]`. *Family* = the two node numbers `z1 z2` (`z1 ≥ z2`; written `{z1}{z2}`, or `{z1}.{z2}` when a number is ≥ 10). *Node number* (Knotenzahl) = the rank of a node orbit under the main group by its distance from the centre perpendicular to the side, ties by the position along it. *Letter* = the number `n` of sectors the straight segment touches, read from the end `z1` moved into the shaded sector, in `abcdefghiklmn` at equal spacing. `~` (ASCII transport; displayed as an overline, *Überstrich*) = the segment runs counter-clockwise from the shaded sector. A capital letter (`aA`) marks that a Drehling is also a Spiegeling (a derived property, not part of the key; the parser accepts the capital only where it is true).
- The tokens are listed in ascending order of `(z1, z2, letter rank, bar)` — compared NUMERICALLY (`compareLineKeys`), never as strings — and **not deduplicated**, so the number of tokens is the number of lines drawn (Zweier/Dreier/Vierer, Part A).

**What a key names.** A line key names the **undirected straight line orbit**: the set of lines the whole main group maps onto one another within one grid `{shape, ordnung, lage}`. The direction of travel is free (task 065, `tools/gitter/test-member-geometry.js`): every member of the orbit draws the same geometry; only the direction of a member's segments may differ, which matters for a leaning curve and for a free curve (seeded by node ids), never for a straight line. The representative a key resolves to (`pairForLineKey`) runs from the end with the larger node number to the other; for `z1 = z2` the two directions are not told apart by the key.

**Transport.** A pattern travels as its grid and its tokens: URL `?v=2&shape=&ordnung=&lage=&group=&lines=...[&layer=new]`, paste `{"version":2,"grid":{shape,ordnung,lage},"group","lines":[...]}`; all tokens are checked against the grid's line table before anything is loaded, unsorted tokens are sorted. The old orbit-id format is not read any more (tasks 063, 066: refused with a version note). The catalog (`gallery/v2/`) addresses an entry by `gallery/v2/{shape}/{ordnung}/lage{lage}/k{count}/{3|4|6}star/{tokens}.svg` through the one codec `core/catalog.js`.

**Reference.** The rule was measured against the source images (`reports/054.md`, `docs/quellen/`, not committed); the oracle is `tools/gitter/measure-name-rule.js`, and `tools/gitter/test-name-rule.js` compares the core with it by coordinates (two known deviations, 5q2: 261 → 262 and 64 → 65, are tracked there).

### Legacy name (still displayed)

The live name display (`#pattern-name-status`, `core/orbits.js` `computeThemeLineName()` / `formatThemeLineName()`) still shows the **legacy** name `{count}*/{GroupToken} {orbitId}+{orbitId}+...`: `{count}` the number of lines drawn, `{GroupToken}` the active group (`D4`, `C3`, `Z2`, ..., from the shape's rotation angles and whether a reflection is active), `{orbitId}` the canonical orbit id of `computeThemeLineOrbits()` in ascending order, not deduplicated. It also names reduced symmetry modes, which v2 does not. **Follow-up (UI step, not done):** switch the display to the v2 name and decide what a reduced symmetry shows (a message, or the legacy name).

**Source and divergence.** This `{count}*/{group} {segments}` structure is adapted from Hans Hinterreiter's own working notation, confirmed via primary-source research: Hart, G., "Hans Hinterreiter's Flowing Fields," *Bridges 2024 Conference Proceedings*. A documented example from Hinterreiter's notes reads `4*/6 98a+82a+52e+75a` — "4 basic segments, 6-fold rotational symmetry (no mirror), four segment codes." That independently confirms this project's own Zweier/Dreier/Vierer reading (a count of base theme-lines within one sheet, under one symmetry group) matches Hinterreiter's real structure.

Where this scheme goes beyond Hinterreiter's published notation, the segment code (family and letter) follows the rule measured in task 054 rather than a reproduction of his 1978 book's conventions, which are not publicly documented.

**Editorial aside**, not a design consideration for 1.11 itself: Hinterreiter was directly influenced by Ostwald's color theory (also noted in Hart's paper) — a genuine historical link worth flagging given this project's own Ostwald focus. He also deliberately avoided infinite tessellation in his own work, describing it as "too crystalline" and lacking "inherent closure" — a real point of divergence from Ostwald's (and this project's) tessellating approach. Worth noting in the project's editorial framing (see `ROADMAP.md`, Priority 2) at some point, not a blocker here.
