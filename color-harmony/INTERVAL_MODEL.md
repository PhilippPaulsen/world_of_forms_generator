# Interval model — Phase 3

## 1. Why Phase 3 separates geometry from interval grammar

Geometry describes what can be calculated: paths, ring gaps and equally spaced
selections. Grammar describes named historical relations and their evidence.
Neither mathematical availability nor a name is an aesthetic recommendation.
Phase-2 analytical/psychological geometry and Oklab display realization are intact.

## 2. Wertgleiche circle

A register fixes `w/s/v` and repeats it at all 24 hue indices. Atlas fields retain
their letter pair; continuous fields retain their coordinates and unlabeled
status. Display anchors remain contemporary and uncalibrated. The 672 chromatic
atlas nodes plus eight shared grays are not enlarged by interval grammar.

## 3. Regular subdivisions

Mathematical rule: `step=24/parts`. Integer divisors `1,2,3,4,6,8,12,24` yield exact
subsets. The public selector starts at source plus an integer hue-step offset,
returns all positions, and wraps in increasing-index order. Offset normalization
is a contemporary mathematical operation, not a rotation of the historical table.
Generic counts have `historicalStatus:'mathematical'`, with no invented names.

## 4. Complement / triad / tetrad

The established named model relations are counts 2/3/4, with steps 12/8/6. They
have `historicalStatus:'explicit'` in the project model, which does not assert
primary verification. `harmonies()` preserves its earlier convention of returning
only counterpart fields; the public general selector includes the starting field
at offset zero. Both use the same private selection algorithm.

## 5. 1921 musical-interval analogy

The supplied transcription contains musical interval names around reference hue
24, described as identity/octave. These labels belong to that mapping; they are
not a function of minimal circular distance. No acoustic frequencies, modern
harmony judgments or algorithm for unnamed historical concepts are inferred.
No extra dyad or label is created for the reference or for hue 12.

## 6. Historical interval table

The raw table is fixed in its supplied frame:

| Pair | Interval | German | Marked consonant |
| --- | --- | --- | --- |
| 1,23 | minor-second | kleine Sekunde | no |
| 2,22 | major-second | große Sekunde | no |
| 3,21 | minor-third | kleine Terz | yes |
| 4,20 | major-third | große Terz | yes |
| 5,19 | augmented-third | übermäßige Terz | no |
| 6,18 | fourth | Quarte | yes |
| 7,17 | augmented-fourth | übermäßige Quarte | no |
| 8,16 | fifth | Quinte | yes |
| 9,15 | sixth | Sexte | yes |
| 10,14 | minor-seventh | kleine Septime | no |
| 11,13 | major-seventh | große Septime | no |

`intervalTable1921()` returns entries plus a provenance envelope.
`intervalRelation1921()` recognizes these unordered pairs only. It returns
`listed:false,entry:null` for absent pairs, including identities; it does not
infer names through rotation or distance. For example `(1,23)` and `(11,13)`
both have minimal gap 2 but different names; `(1,3)` has gap 2 and is unlisted.
No rotation helper is implemented. Any future rotation must explicitly identify
itself as a contemporary/generalized operation on the historical pattern.

## 7. Historical consonance metadata

The boolean `consonant` records only the supplied historical marking. False means
not marked consonant in this transcription. Unlisted pairs are not assigned
false: their entry is null. No beauty score, ranking, recommendation weight or
modern taste judgment is derived from any of these values.

## 8. Ordered series and future interval selection

`selectSeriesInterval()` selects zero-based indices `start+k*step` in a supplied
ordered array. It is generic, bounds-checked, nonwrapping and shallow. It works on
the existing Weißgleiche, Schwarzgleiche, Schattenreihe and gray axis without
altering colors, provenance or labels. Array strides are not automatically
historical letter-step laws, especially if an array is a restricted subset.
Complete allowed intervals in each kind of series remain research-pending.

## 9. Gray Harmothek as future work

`grayAxis()` remains ordered from lightest to darkest: `a,c,e,g,i,l,n,p`.
Generic interval selection can use this order, but does not reconstruct the
Harmothek or authenticate any particular three-gray combination. The full gray
harmony collection remains a separate research task with no invented counts or
selection rules added here.

## 10. Research-pending terminology

The registry separates implemented relations from pending records. Heraden is
marked `historicalStatus:'attested'`, `implementationStatus:'research-pending'`:
its algorithmic definition is deliberately absent. Other pending records cover
complete interval laws for Schattenreihen, Weißgleiche and Schwarzgleiche, and
full Harmothek reconstruction. They have no execution callbacks or allowed-step
tables. The analytical constant-v relation keeps its distinct mathematical status.

## 11. Source-confidence levels

| Label | Meaning and use in this phase |
| --- | --- |
| `primary` | A directly inspected primary passage; **not claimed for p.89** |
| `secondary-citing-primary` | The supplied eleven-row transcription citing Ostwald 1921 p.89 |
| `institutional-secondary` | Reserved for identifiable institutional accounts; not assigned to this table |
| `mathematical` | Divisibility, ring distance, equal-spacing detection and analytical consequences |
| `contemporary-implementation` | API shapes, normalization, source inclusion, array selection and Oklab output |
| `research-pending` | Incomplete definitions, series laws and Harmothek reconstruction |

The table explicitly stores `sourceStatus:'secondary-citing-1921-p89'`,
`sourceConfidence:'secondary-citing-primary'`, `primaryVerified:false` and
`transcriptionBasis:'project-supplied-transcription'`. The cited primary work is
Wilhelm Ostwald, *Die Harmonie der Farben*, revised 1921 edition, p.89. This phase
has not directly inspected that page. The project's supplied secondary source
has no bibliographic identity in the brief, recorded as `secondaryReference:null`.
This must not be read as an independently authenticated scholarly citation.

Later source work can fill that identity, compare a direct primary transcription
and upgrade the provenance without changing consumer APIs. Named subdivisions
and inherited geometric relations use a separate project-established status;
'explicit' is not a substitute for a source-confidence level. No historical claim
is made for arbitrary divisor counts, arbitrary series strides or Oklab itself.
