# Compound harmonies — Phase 5

## 1. 1921 source scope: pp. 103–119

**Primary-source fact.** Wilhelm Ostwald, *Die Harmonie der Farben*, 2.–3.,
gänzlich umgearbeitete Auflage, I. Text, Leipzig: Unesma, 1921. The fourth part,
*Zusammengesetzte Wohlklänge*, printed pp.103–119, was directly inspected in the
provided scan, including case headings and Figures 20/21. These are PDF pages
121–137 (one-based), scan numbers 120–136. Local source: `Harmonie der Farben.pdf`;
SHA-256 `60cace764968986473d6323770151240ca54fe26bcc47cccf80b1daf2ac47d12`.

**Software abstraction.** Compound laws carry `sourceStatus:'primary-1921'` with
their specific pages. This authenticates the law, not every user-selected group,
its display colors or its aesthetic effect. API objects are contemporary plain
data. Oklab remains exclusively a contemporary screen realization.

**Open interpretation.** The complete catalog and qualitative judgments are not
transcribed. No claim of historical pigment or optical-mixture reconstruction.

## 2. First-level vs compound harmonies

**Primary-source fact.** Page 103 distinguishes groups organized by one law from
combinations of already organized groups; elementary groups have at least two
colors.

**Software abstraction.** `elementaryHarmony()` creates `type:'harmony-set'`,
`level:1` with complete atlas `members`, a domain and a relation. A compound has
`type:'compound-harmony'`, two complete child `groups` and an active `members`
view. Existing Phase-4 hue descriptors and `seriesHarmony()` results are unchanged;
resolve their hues to atlas colors or pass their `.fields` to the new constructor.
The constructor checks relation membership, not a complete historical interval
law. Arbitrary valid selections remain `structural-selection`.

**Open interpretation.** A geometrically valid selection is not automatically an
Ostwald-approved elementary harmony or a contemporary aesthetic recommendation.

## 3. G / F / W domains

**Primary-source fact.** Page 104 distinguishes G (Grau), F (farbtongleich) and W
(wertgleich). The case discussion combines these domains in different roles.

**Software abstraction.** Domains are `gray`, `same-hue`, `isovalent`. Gray groups
use actual shared gray-axis entries. Same-hue groups declare `isotint`, `isotone`
or `shadow-series`. A real gray endpoint may join a same-hue Weißgleiche or
Schwarzgleiche if it satisfies the same w or s. W groups preserve w/s/v across
hues. Compound `domains` is the ordered union of source domains, including the
domain of a replaced component; it describes structural ancestry.

**Open interpretation.** Mathematical analytical constant-v paths remain
available elsewhere; they are not silently relabeled as historical F shadow
series. No arbitrary cross-domain equality is introduced.

## 4. Gemeinschaft

**Primary-source fact.** Page 105 states connection through a common member.
Pages 108–109 discuss GGg, p.110 GFg, and pp.115–116 WFg connections.

**Software abstraction.** `combineBySharedMember(a,b)` requires at least one
shared active atlas identity. Chromatic identity is `atlas:<hue><white><black>`;
gray identity is `gray:<letter>`. Complete coordinates and colors are validated
before comparing keys. Byte RGB coincidence does not imply identity. Members
retain first occurrence order in A, then unseen members of B. All shared keys
and both complete child groups survive, including repeated structural occurrences.

**Open interpretation.** A gray companion and a chromatic field are related but
not identical. W cannot directly share a chromatic member with a gray-only G;
an explicit F bridge can connect both.

## 5. Spaltung as substitution

**Primary-source fact.** Pages 105–106 discuss gleichwertiger Ersatz and symmetric
replacement about an original member. Pages 107–108 allow whole or partial
replacement and show gray examples. Page 108 cautions that logarithmically spaced
gray neighbors do not reproduce their center as an exact arithmetic mixture.

**Software abstraction.** `substituteHarmony(source,target,replacement)` retains
both trees and replaces the target's active identity with the replacement group's
active members. Supported structural correspondence is symmetric paired offsets:

- Gray target: ordinal positions in `a,c,e,g,i,l,n,p`.
- Chromatic target, same register: hue offsets of at most six steps on either
  side, retaining the existing Phase-4 splitting range.
- Chromatic target, same-hue series: white-letter offsets for Schwarzgleiche or
  Schattenreihe, black-letter offsets for Weißgleiche. Existing family validation
  applies, including rounding-derived shadow tolerance and actual gray endpoints.

Every nonzero offset needs its opposite; at least one nonzero offset is required.
The center may remain (partial replacement). Multiple paired offsets are a
generic contemporary extension of the structural test, not a transcribed case
catalog. Replacement may itself be compound; its active members must satisfy
the same test. Unknown correspondence throws. No Oklab mixture equality is claimed.

**Open interpretation.** GFe's opposed-hue construction and GWe's approximate
achromatic substitution require additional rules; neither is guessed here.

## 6. Difference from Phase-4 split construction

**Primary-source fact.** Earlier Spaltung constructs hue sets (pp.93/99); the fourth
part uses replacement as a law connecting organized groups (pp.105–106).

**Software abstraction.** `splitHueSet()` returns a hue-set construction descriptor
for Dreier/Vierer. `substituteHarmony()` accepts formed atlas groups, returns a
recursive compound and preserves the original and replacement groups. These APIs
remain separate; no automatic conversion discards the original construction.

**Open interpretation.** Related terminology does not make the two software
layers interchangeable.

## 7. Provenance

**Primary-source fact.** The two laws can produce the same colors through different
constructions (pp.105–108).

**Software abstraction.** Provenance contains `operation`, indexed `inputs`,
`sharedElements`, `replacedElement`, `replacementGroup`, `replacementEvidence`,
`sourceCase`, `sourcePages`, and ordered `sequence`. Input/replacement indices refer
to retained `groups`; original target colors remain in the source tree. Generic
operations use `sourceCase:null`, law page 105 and narrower correspondence pages.
They do not assign a historical case code merely from a domain pair.

Validation recursively recomputes active members, levels, domains and provenance.
Forged caches, case codes or histories throw. JSON round trips are supported;
cycles, non-data objects and sparse arrays are not. The API is pure and returns
independent copies. Member equality is not structural equality: compare the whole
tree and its operation history when structure matters.

**Open interpretation.** Evidence authenticates a law; exact historical case
attribution is reserved for separately documented fixtures below.

## 8. Recursive composition

**Primary-source fact.** Pages 104–105 and 118–119 allow further combinations and
constructions involving newly introduced members.

**Software abstraction.** Children may be elementary or compound. `level` is
`1 + max(child.level)`, with elementary level 1. Flattening evaluates each
operation recursively: replaced historical members remain in provenance but
are absent from the active view unless reintroduced. Multiple source occurrences
of one identity are replaced in that active view; no occurrence-specific editing
is inferred. Shared input subtrees are accepted, cycles rejected.

**Open interpretation.** No exhaustive generator or complete historical
higher-order taxonomy is implemented.

## 9. Rang- und Zeitordnung

**Primary-source fact.** Pages 106–107 discuss rank and temporal order;
pp.118–119 distinguish successive construction stages and higher orders.

**Software abstraction.** Each compound records ordered input references and its
operation; recursive child histories permit reconstruction. Shared-member order
is a deterministic serialization convention, not a historical preference.
Substitution distinguishes source from replacement. `level` measures tree depth.

**Open interpretation.** No one-to-one equation between software depth and every
nuance of Stufe, Ordnung or Rangordnung is asserted. There is no time/UI model.

## 10. Historical cases vs generic software operations

The following headings were read directly; fixtures use one generic composer.
Except the identified printed example, concrete modern hue indices and register
selections instantiate source relations rather than transcribe full palettes.

| Case and pages | Source relation | Regression fixture |
| --- | --- | --- |
| GGe, 107–108 | Replace a gray by neighbors, wholly or partly | Printed `ceg`, `g → e(g)i`, gives `cegi`; full replacement gives `cei` |
| GGg, 108–109 | Gray groups share one or more grays | `ace` + `egi`, shared `e` |
| GFg, 110 | Gray endpoint connects F to G | Gray `i` in a Weißgleiche through `5ic`; gray `c` in its Schwarzgleiche |
| FWe, 114 | Replace an F member with W neighbors | `5ic → 4ic,6ic` within a same-hue source group |
| WFe, 114–116 | Replace a W member with F neighbors | `5ic → 5ia,5ie`, `5gc,5lc` or `5ga,5le` |
| WFg, 115–116 | Shared chromatic member connects W and F | W at `ic` joined to F through `5ic` |
| GWg discussion, 111–112 | Gray connections mediated by related one-hue series | W–F compound joined to G through actual gray `i`; explicitly a level-3 bridge |

**Software abstraction.** Fixture names cite cases; generic output keeps
`sourceCase:null`. No bespoke GG/GF/FW engine, implied aesthetic verdict, or
automatic attribution of arbitrary inputs to one of these source examples.

**Open interpretation.** The W–F–G bridge preserves its intermediate F structure;
it is not claimed to reproduce every nuance of the printed GWg class.

## 11. Figures 20 / 21

**Primary-source fact.** Figure 20 (p.117) summarizes relations in the same-hue
triangle; Figure 21 (p.118) relates them through the color double-cone and W circle.

**Software abstraction.** These are documentation references only. Paths remain
coordinate constraints, compounds remain relationship trees.

**Open interpretation.** No screen geometry, diagram layout or UI is derived here.

## 12. Deferred exhaustive case catalog

**Primary-source fact.** Pages 107–116 discuss cases beyond the selected fixtures;
p.119 leaves broader enumeration open. WGe (p.114) is described as an empty class,
not a license to replace a chromatic color with gray.

**Software abstraction.** Intentionally absent: special opposed-hue GFe branches;
GWe's achromatic-equivalent mixtures and weights; a complete fifteen-case catalog;
exhaustive higher-order enumeration; occurrence-specific edits; composition of
interpolated samples; spatial/area weights or aesthetic rankings. FGe and FF cases
may be expressible by the generic rules, but have no separately authenticated
fixture catalog here. Full Harmothek and complete one-hue interval laws remain
future research. Heraden remains the existing secondary-attested research note.

**Open interpretation.** Neither mathematical availability nor a successful
composition call establishes historical approval of every selected interval.
