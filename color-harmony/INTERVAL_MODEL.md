# Interval model — Phase 4

## 1. Geometry and interval grammar

Geometry supplies paths, distances and selections. Grammar identifies historical
constructions and their evidence. Neither implies aesthetic approval. Phase 4
uses the directly inspected 1921 scan; the detailed source map and edition
fingerprint are in [1921_HARMONY_GRAMMAR.md](1921_HARMONY_GRAMMAR.md).

## 2. Wertgleiche circle

One register fixes w/s/v across 24 hues. Printed p.64 explicitly describes 28
such circles, each with 24 colors. The screen anchors remain contemporary,
uncalibrated Oklab references; grammar does not enlarge the 672+8 atlas.

## 3. Regular subdivisions

`step=24/parts`, for divisors 1,2,3,4,6,8,12,24. This is a mathematical operation.
`regularHueSubdivision()` returns all positions, starting at source plus offset.
Other than named cases 2/3/4, metadata remains mathematical, even where the source
mentions larger groups: this phase does not implement their historical taxonomy.

## 4. Complement / Triade / Tetrade

Opposites have gap 12 (pp.74/98), Triaden gap 8 (p.94), Tetraden gap 6 (p.98).
Dreier and Vierer denote general cardinalities, distinct from those special
regular classes. `harmonies()` still excludes the source from counterpart fields;
regular subdivision includes it. Both delegate to the same selector.

## 5. 1921 musical analogy

On p.89 Ostwald compares twelve color-distance steps between opposite colors
with the chromatic scale. He emphasizes the comparison's limitations and mnemonic
use. The printed color columns give distances on the two halves of the circle.
They are neither literal hue dyads nor an acoustic basis for the color engine.

## 6. Verified historical table

| Distance | Printed color entries | Interval | German | Starred |
| --- | --- | --- | --- | --- |
| 1 | 1,23 | minor-second | kleine Sekunde | no |
| 2 | 2,22 | major-second | große Sekunde | no |
| 3 | 3,21 | minor-third | kleine Terz | yes |
| 4 | 4,20 | major-third | große Terz | yes |
| 5 | 5,19 | augmented-third | übermäßige Terz | no |
| 6 | 6,18 | fourth | Quarte | yes |
| 7 | 7,17 | augmented-fourth | übermäßige Quarte | no |
| 8 | 8,16 | fifth | Quinte | yes |
| 9 | 9,15 | sixth | Sexte | yes |
| 10 | 10,14 | minor-seventh | kleine Septime | no |
| 11 | 11,13 | major-seventh | große Septime | no |
| 12 | 12,12 | octave | Oktave | yes |

`intervalTable1921()` preserves these columns as `colorEntries` and adds explicit
`distance`. `intervalRelation1921(a,b)` now applies the minimal distance to this
analogy, with `applicationStatus:'mathematical-distance-lookup'`. Identity is
unlisted. This deliberately corrects Phase 3's literal-pair interpretation,
missing final row and erroneous hue-24 identity/octave reference.

## 7. Historical consonance metadata

`consonant` transcribes the printed asterisk. False means unstarred. Neither
value produces a score, preference, recommendation or contemporary taste claim.

## 8. Ordered series

`selectSeriesInterval()` remains a generic shallow array operation.
`seriesHarmony()` validates one chromatic atlas series and records a linear
selection, with indices, gapsOrSteps, step and full colors. There is no wrap gap.
Primary pp.48–51 discuss these families and enumerate examples; arbitrary index
selections do not inherit historical approval. Source examples are tested, while
complete rules, gray-inclusive catalogs and all allowed intervals remain deferred.

## 9. Gray Harmothek

The gray axis stays ordered a,c,e,g,i,l,n,p from light to dark. Generic selection
works on it. The Harmothek on pp.18–19 is an organized collection for retaining
and comparing harmony cases; metadata says `future-catalog-layer`. No generator
or full gray-harmony catalog is implemented.

## 10. Research boundaries

Complete interval laws for the three one-hue families remain research-pending.
Heraden is a secondary-attested research note, not required for this operational
grammar. No assertion that the term does not exist is made. Larger named classes,
full historical construction counts and center-retaining hue-set split variants
are not exhaustively reconstructed. Phase 5 implements shared-member composition
and structured substitution from pp.103–119, including partial group replacement
retaining the target. This composition layer does not add speculative allowed-step
tables or alter the Phase-4 hue-set API. See
[COMPOUND_HARMONIES.md](COMPOUND_HARMONIES.md). Its symmetric correspondence checks
do not confer historical interval approval on arbitrary selected groups.

## 11. Source confidence

| Label | Meaning |
| --- | --- |
| `primary` | Specific directly inspected passage; p.89 and the cited grammar pages |
| `secondary-citing-primary` | Earlier evidence level, superseded for the corrected p.89 table |
| `institutional-secondary` | Catalog evidence; not a substitute for reading a page |
| `mathematical` | Exact ring arithmetic, canonical signatures, symmetry and classification |
| `contemporary-implementation` | API shapes, normalization, array selections, Oklab display |
| `research-pending` | Not yet fully reconstructed historical laws |

Only verified passages receive `primary-1921` or `primary-1921-p89`. A primary
construction's provenance is separate from the resulting set's geometric class.
The software's increasing-index clockwise direction and index origin are
conventions, not a claim of historically calibrated display hues.
