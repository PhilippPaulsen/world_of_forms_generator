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

---

## Part B — Proposed Systematic Naming Scheme (Roadmap 1.11)

### Rationale

Ostwald named patterns by hand and explicitly acknowledged the practice doesn't scale ("die Anzahl... übertrifft das beste Gedächtnis"). Hinterreiter's approach — strict, parametric, geometry-derived labels — replaces evocative naming with codes that are:

- **unambiguous**: the code alone reconstructs the geometry
- **generatable**: can be produced programmatically from the same data `buildExportData()` already emits, once combined with 1.9's combinatorics layer
- **scalable**: works identically for pattern #1 and pattern #10,000

Ostwald's names remain valuable as historical/editorial reference and stay attached as metadata — this scheme doesn't erase them, it adds a parallel, systematic identifier.

### Proposed grammar