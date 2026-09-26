# 1921 harmony grammar — primary-source map

## 1. Source and edition

**Primary-source fact.** Wilhelm Ostwald, *Die Harmonie der Farben*, 2.–3.,
gänzlich umgearbeitete Auflage, I. Text, Leipzig: Verlag Unesma, 1921. Title page
inspected at PDF page 9. Source supplied locally as `Harmonie der Farben.pdf`,
a Deutsches Museum scan, 158 PDF pages. SHA-256:
`60cace764968986473d6323770151240ca54fe26bcc47cccf80b1daf2ac47d12`.

Printed Arabic page p corresponds to PDF page p+18 and scan number p+17.
Direct visual inspection covered pp.18–19, 47–51, 64, 72–74, 89–94, 96–100,
and contents VIII–X. This is scoped verification, not a claim to have critically
transcribed the entire volume. For example, the footer of p.89 identifies
[Deutsches Museum scan 106](http://nbn-resolving.de/urn:nbn:de:bvb:210-14-004662798-0106-0).
The footer of p.72 identifies
[scan 89](http://nbn-resolving.de/urn:nbn:de:bvb:210-14-004662798-0089-3).
Verification used the supplied local scan, not these links as independent evidence.

**Software representation.** Only inspected facts receive primary metadata.
Algorithms, numerical normalization, signatures and Oklab remain contemporary
implementations. Earlier branches preserve the previous interpretations.

**Corrections from Phase 3.** Page 89 has twelve analogy rows, not eleven literal
hue dyads. Its two color columns contain complementary directed distances, and
its final row is distance 12 / Oktave / 12, starred. Hue 24 is not an identity or
octave endpoint. `entry.pair` becomes `colorEntries` plus `distance`;
`intervalRelation1921()` now uses minimal distance with mathematical application
metadata. The analogy is explicitly limited by Ostwald; it does not determine
which sets the combinatorial grammar can represent. See INTERVAL_MODEL.md.

## 2. Zweier

**Primary-source fact.** The *Verzeichnis der Zweier*, pp.72–74, enumerates 276
pairs of a Wertgleiche circle, organized into twelve distance classes.
**Mathematical consequence.** C(24,2)=276 unordered distinct pairs.
**Software representation.** `dyadsByDistance(d)` returns sorted canonical pairs,
without reversed duplicates. It does not attach aesthetic rankings.

## 3. Distance classes and printed-number translation

**Primary-source fact.** The printed table labels its 24 positions:

```text
00 04 08 13 17 21 25 29 33 38 42 46 50 54 58 63 67 71 75 79 83 88 92 96
```

**Software convention.** Their ordinal positions map to engine indices 1..24,
respectively. This preserves adjacency and distance, not historical pigment or
absolute color-anchor calibration. The printed 100-part numbers are not engine
hue indices and are not linearly rounded into labels.

| Printed page | Distance | Selected printed pairs | Engine pairs (unordered) |
| --- | --- | --- | --- |
| 72 | 1 | 00–04, 46–50, 96–00 | 1–2, 12–13, 1–24 |
| 72 | 2 | 00–08, 92–00, 96–04 | 1–3, 1–23, 2–24 |
| 73 | 6 | 00–25, 75–00, 96–21 | 1–7, 1–19, 6–24 |
| 73 | 8 | 00–33, 67–00, 96–29 | 1–9, 1–17, 8–24 |
| 74 | 12 | 00–50, 25–75, 46–96 | 1–13, 7–19, 12–24 |

**Mathematical consequence.** Distances 1..11 each have 24 unordered pairs;
distance 12 has 12. The tests use these independently transcribed examples as
regression oracles, while the engine generates the full table.

## 4. Dreier

**Primary-source fact.** Discussion starts at p.90; free Dreier on pp.96–97
include the combinatorial count 2024 per circle. **Software representation.**
Every valid three-hue set has className Dreier. A contemporary cyclic signature
has three positive gaps summing to 24, canonical under rotation only.
Reflection equivalence is not silently identified with rotation equivalence.
An arbitrary Dreier receives no verdict of historical harmoniousness.

## 5. Dreier durch Teilung

**Primary-source fact.** Pages 90–92 describe bisecting an even dyad arc and
also the alternative, longer arc. Printed 08–25 yields 08–17–25 or 08–25–67.
**Software representation.** `divideHueDyad([3,7], direction)` yields [3,5,7] or
[3,7,17]. Direction explicitly selects the arc from the first supplied hue to
the second. Odd arcs throw: this engine does not insert a fractional atlas hue.
**Scope.** Only exact bisection and existing regular subdivisions are implemented;
no unverified unequal division ratios are inferred.

## 6. Dreier durch Aufbau

**Primary-source fact.** Pages 90/92 describe adding the same distance to a Zweier;
08–25–42 is the example (engine 3–7–11). **Software representation.**
`augmentHueDyad()` retains the original dyad and its distance. Equal-step
continuations beyond either endpoint receive primary construction evidence.
Arbitrary additions are useful plain combinatorics, explicitly contemporary;
the source's qualitative preferences are not turned into algorithms.

## 7. Dreier durch Spaltung

**Primary-source fact.** Page 93 defines replacement of one hue by two hues
symmetrically placed about it, discussing side distances 1..6 and collisions.
**Software representation.** `splitHueSet()` implements this replacement, records
the original set and rejects collisions rather than silently changing cardinality.
**Open interpretation.** The passage's exhaustive counting and qualitative
inheritance claims are not implemented as classification or selection policies.
Historical optical-mixture discussion does not override Oklab-only mixing.

## 8. Triaden

**Primary-source fact.** Page 94 reserves Triaden for equal division of the whole
circle into three. **Mathematical consequence.** Gaps [8,8,8]; eight unique sets
on a 24-circle. **Software representation.** The classifier recognizes every
rotation, names it Triade and normally describes the division construction.
An explicitly split- or augmentation-derived instance retains that provenance.

## 9. Vierer and equal-step constructions

**Primary-source fact.** Pages 97–98 discuss Vierer and give 10626 per circle.
Page 99's *Gleichabständige Vierer* builds three successive equal intervals;
this is an open construction path, whose closing gap need not equal the step.
For step 8 the fourth position coincides with the first, so it is not a Vierer.
**Mathematical consequence.** Four equal *cyclic* gaps can only be [6,6,6,6].
For example [1,3,5,7] has equal construction steps 2 but cyclic gaps [2,2,2,18].
**Software representation.** General classification supports both. `regular`
always means all cyclic gaps equal; no extra fictional regular class is added.

Page 99 describes Vierer from a split Dreier or repeated splitting of a Zweier.
`splitHueSet()` accepts both cardinalities 2 and 3, so repeated calls implement
those exact replacement operations. It retains construction separately from
geometric class. The center-retaining variant described across pp.99–100 is
outside this replacement helper; no implied optical weights are invented.

## 10. Tetraden

**Primary-source fact.** Page 98 defines perfect fourfold division, six steps
apart, and six unique Tetraden. **Software representation.** Only [6,6,6,6]
receives the name Tetrade. Other Vierer, including reflective or split-derived
sets, do not inherit that name unless their geometry actually matches it.
The test suite checks all 10626 Vierer and every rotation of the named pattern.

## 11. Larger groups

**Primary-source fact.** Page 100 continues with Fünfer, Sechser and larger groups.
**Software representation.** Signatures and HarmonySets accept 2..24 distinct
hues. Larger groups remain unnamed in this implementation; mathematically
available divisors do not automatically receive historical status.
**Scope.** No exhaustive larger-group taxonomy is attempted.

## 12. Farbtongleiche series harmonies

**Primary-source fact.** Page 48 discusses two-member one-hue combinations.
Pages 49–50 enumerate Weißgleiche Dreier, pp.50–51 Schwarzgleiche Dreier,
and p.51 Schattenreihe/Reingleiche Dreier. Page 51 explicitly prints
`ga ic le ng pi`, including triple `ga le pi` (no.87). Page 50 includes
`ia ic ie` (no.28); p.51 includes `ec gc ic` (no.48).

**Software representation.** `seriesHarmony()` records actual discrete fields,
linear indices and successive index gaps. These three printed chromatic triples
are regression examples at hue 5. Generic `selectSeriesInterval()` still works
on any dense array, including the shared gray axis.

**Boundary.** The descriptor's arbitrary selection is contemporary, while the
family's discussion has primary evidence. It does not encode a complete allowed-
interval table. A subset's index gaps cannot silently stand for letter-step gaps.
Gray-inclusive catalog enumeration and complete laws remain research work.
Analytical constant-v selection is mathematical and stays separate from the
historical shadow series. Existing tolerance and Oklab implementations are unchanged.

## 13. Harmothek

**Primary-source fact.** Pages 18–19 describe retaining harmony examples in an
organized card collection for repeated examination and comparison.
**Software representation.** Registry status `future-catalog-layer`; no
Harmothek generation primitive. This is an organizational concept, not a new
mixing or hue-combination law.

## 14. Composed harmonies — deferred

**Primary-source fact.** Contents X lists the fourth part, *Zusammengesetzte
Wohlklänge*, beginning p.103. Only the contents reference is verified here;
its detailed combination laws are not claimed as transcribed.
**Roadmap within this module:** Phase 5 candidate: composed / compound harmonies.
No implementation or repository-wide roadmap modification is part of Phase 4.

## 15. Historical terms versus software abstractions

The registry separates source terminology, exact mathematical consequences and
implementation status. Symmetry detection, sorted arrays, canonical rotations,
provenance fields and Oklab samples are modern representations. They carry no
numeric taste judgments. Heraden remains only a secondary-attested note, not
required for this operational grammar; no historical nonexistence claim is made.

Remaining limits: complete one-hue interval laws and gray-inclusive catalogs;
full splitting counts and qualitative categories; unequal division constructions;
center-retaining split variants; exhaustive larger-group taxonomy; compound
harmony laws. The implemented bisection, equal-step augmentation and symmetric
replacement have explicit numeric readings in the inspected source. More general
variants are not guessed.
