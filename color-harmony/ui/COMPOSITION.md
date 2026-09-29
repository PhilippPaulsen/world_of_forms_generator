# Interactive harmony composition — Phase 6B.1

## 1. Active Harmony

One explicit working set persists across Kreis, Dreieck and Register. It starts
with full color 1, not an atlas approximation. The bottom strip shows actual
calibrated display colors in adjacent square fields. There is no palette library.

`state.mjs` separates browse/view state from `state.composition`. All composition
mutations run through the pure reducer in `composition.mjs`:

```js
{
  activeHarmony: {
    members: [],                 // complete engine colors; at least one
    activeMemberIndex: 0,
    source: 'selected',           // selected | generated | manual | compound | series
    group: null,                 // validated HarmonySet / CompoundHarmony, if supported
    classification: {},         // cardinality, hue geometry, isovalence, opposites
    // series: {relation, anchor, rule} for an explicitly adopted series
    // construction: engine construction evidence for generated sets
    // previousStructure: retained compound before a manual edit
  },
  requestedCardinality: null,    // latest 2/3/4 request, independent of explicit size
  generation: null,             // original generation anchor and alternative index
  past: [], future: [],         // composition snapshots only
  pending: null,                // secondary compound workflow, not a color collection
  message: null                 // bilingual status key; no blocking modal
}
```

Engine code and display calibration are unchanged. Atlas size remains 24×28+8.
No new historical law is encoded in the UI.

## 2. Active member

Click or keyboard-activate a strip field to select that member. This changes the
active index and the viewed hue/register context, never the other members or
history. `aria-pressed` announces the selected member; an inset outline identifies
it visually. `setActiveMember(index)` validates bounds.

The circle shows every occupied hue, with separate radial markers when multiple
members share a hue. Clicking a marker selects that exact member. Register marks
all member cells that actually exist in the atlas. Shared grays, full colors and
samples are not fabricated as register cells. The triangle shows the selected
member when it belongs to the browsed hue; browsing another hue is independent.

## 3. 2/3/4 generation

`generateHarmony(n)` delegates to `regularHueSubdivision()` at the current active
color's w/s/v position. Defaults are opposite (+12), Triade (+8/+16) and Tetrade
(+6/+12/+18). The anchor is member 0 and stays active. Digit buttons use
`toggleCircleRelation(n)`: pressing the active digit again keeps only the active
member and clears the circle relation. A different digit generates its new set.
The explicit `generateHarmony(n)` API still regenerates (useful for a future
dropdown); × also keeps only the active member. Toggle-off retains browse state.
No score, preference ranking or recommended palette is computed.

For full-color vertices, the existing engine's unlabeled subdivision input is
used internally; results retain explicit full-color identity in UI records.
Interpolated anchors remain interpolated at every hue. Atlas anchors preserve
register labels through engine lookup.

There is **no verified default 2/3/4 selection rule for a gray anchor**. Such a
request leaves the set untouched and explains the limitation. Existing members
can individually be replaced by real gray-axis entries, including all-gray sets.
This avoids inventing gray interval laws to make a button appear functional.

Secondary ‹ / › controls in the inspector browse a deliberately small catalogue:

- 2: the regular pair only.
- 3: regular Triade, then clockwise and counterclockwise division of the opposite
  dyad through `divideHueDyad()`.
- 4: regular Tetrade, then `splitHueSet()` of the second member of the anchor's
  regular Triade, using the engine's distances 1..6 in ascending order.

The original generation anchor remains included. Duplicate sets are omitted.
Order is a contemporary presentation convention, not a historical ranking or a
claim to exhaust the grammar. Selecting another active member does not regenerate
or rebase this catalogue; a new 2/3/4 request does. Manual edits leave the catalogue.

## 4. Manual member replacement

`replaceActiveMember(color)` replaces exactly one member. All other members retain
identity and values. `chooseColor(color)` is the visualization-facing variant:
if that identity is already present it activates that member instead. Direct
replacement with another member's identity is rejected with a quiet status message.
No duplicate identity enters the set, and RGB equality is never used.

Selection semantics:

| Interaction | Composition effect |
| --- | --- |
| Ring field | Select the displayed hue at the displayed register; all other members stay. Ordinary hue changes preserve the current register. |
| Reference-ring field | Explicitly select that full-color vertex, label=null. |
| Ring member marker / existing register member | Activate the existing member. |
| Triangle atlas node | Replace active member with that hue/register node. |
| Register cell | Replace active member with that exact atlas color. |
| Shared gray | Replace active member with that shared gray node. |
| Verlauf point / sample strip | Replace active member with the exact unlabeled engine sample. |
| View, compact hue/register ‹/›, home, inspector Atlas/Verlauf, W/B/S/V preview | Browse only; retain every explicit member. |
| Preview swatch / ↓ | Adopt the entire series; clicked swatch / preview anchor becomes active. |

Thus browsing a different register changes the ring preview, not the harmony;
clicking a visible field explicitly commits that new register. Home shows full
references while the existing active color can still be an atlas field in the
center/strip. Reference members become atlas nodes only after explicit selection.

Circle/triangle/grid arrow keys move the browse cursor; Enter/Space selects its
color. Sample-strip arrows select successive exact samples. Switching to Atlas
does not relabel or discard an existing sample.

## 5. Live classification

Every generated, edited or compound set is classified immediately. Distinct hue
positions go to `classifyHueSet()`, which owns cyclic signatures and exact named
patterns. Gaps use the engine's canonical cyclic rotation; no reflection or
musical name is inferred by the view. `hueDistance()` supplies opposite pairs.

A named hue harmony additionally requires that **all** explicit members are
chromatic, occupy distinct hues and share w/s/v within `EPSILON=1e-10` (the engine's
analytical equality tolerance). An 8·8·8 projection with one different register
is displayed as Dreier with a different-register note, not a historical Triade.
Repeated hues/mixed grays explicitly qualify a signature as a hue projection.
Manual sets that still meet a known class display its name alongside “Manuell
geändert”; provenance does not switch back to “generated”.

For compound eligibility the UI tries the existing elementary domains through
`elementaryHarmony()`: gray, isovalent, and supported same-hue relations. The
engine validates each domain. Ineligible manual sets remain useful explicit sets.

## 6. Full-color, atlas, interpolated and gray identity

| Kind | Stable identity | Record status |
| --- | --- | --- |
| Chromatic atlas | `atlas:<label>` | source=atlas, real label |
| Shared gray | `gray:<letter>` | source=atlas, no hueIndex |
| Full-color vertex | `full-color:<hueIndex>` | source=reference (6A.2 compatibility), label=null, v=1,w=s=0 |
| Continuous sample | `interpolated:<hueIndex>:<w>:<s>` | source=interpolated, label=null |

`memberKind()` explicitly exposes full-color/atlas/interpolated/gray. Sample keys
use exact canonical JavaScript coordinates, not rounded display numbers or fake
atlas matching. A sample can coincide in coordinates/RGB with a real atlas node
and remain a distinct source identity. Input colors pass the existing engine
validation before use. Calibration only derives display records.

## 7. Compound substitution

In Info → Wissenschaftliche Details → Aufbau, ↳ starts **Glied ersetzen**.
The source group and target are captured explicitly. Selecting one displayed
replacement group commits immediately through `substituteHarmony()`; × cancels
staging. Both source and replacement remain independent child groups.

The engine still only permits atlas/gray compound members. Full-color and sample
sets are not silently converted; unavailable actions explain this boundary.
For a chromatic target the offered pairs come from `splitHueSet()` at distances
1..6; both pairs and pairs retaining the center are tested by the engine. For a
gray target, actual discrete pairs are offered only when `substituteHarmony()`
accepts their symmetry. Unsupported correspondences never become UI options.

The compact read-only tree shows source → replaced member → replacement group,
active result and provenance. Further substitutions retain recursive child trees.
Editing one resulting member freely changes its current classification and retains
the original compound under “Vorheriger Aufbau”; it never forges a modified
historical construction tree.

## 8. Shared-member composition

⋈ captures an existing compatible group as A. Generate or edit the working set
to form group B. The final **Gruppen verbinden** control is enabled only when
`combineBySharedMember(A,B)` succeeds with actual structural shared identities;
an unchanged identical group is not offered as its own second group.

A successful operation retains both trees, deduplicates only their active union
as specified by the engine, and records the shared identities. Shared swatches
are outlined in both child groups and their labels listed below. Similar-looking
RGB values never enable a connection. No general graph editor or saved-group
collection is introduced. Both compound operations remain secondary.

## 9. Undo model

↶/↷ restore at most 100 in-memory composition snapshots: members, active index,
requested cardinality, generation descriptor and structured provenance. Supported
operations include generation/alternative changes, replacement, clearing and
both compound operations, circle toggle-off and explicit series adoption. A new
composition edit discards redo history.

View, browse coordinates, inspector, locale and tooltip state are not restored.
Selecting an active member or staging/canceling an advanced operation does not
add history. Undo/redo cancels pending compound staging to avoid applying a stale
target. Reloading starts a fresh session. Pure transitions do not mutate inputs.

## 10. Preview and composition are separate

`circleRelation: null | 2 | 3 | 4` mirrors the composition reducer's requested
cardinality. It is restored with composition undo/redo. `seriesRelation: null |
'isotint' | 'isotone' | 'shadowSeries' | 'isovalent'` controls one contextual preview.
W/B/S/V toggles it on/off or replaces it with another preview without a history edit.
The retained `relation` field selects the scientific continuous path independently
of whether a discrete preview is currently visible. `harmonyMode` remains a legacy
research-fixture preference; button pressed state uses `circleRelation` only.

The compact upper-right hue code wraps 01…24; its separate register code uses the
engine's 28-node ordering. Circle adds the reference • state before those nodes;
triangle/register browse the 28 atlas positions only. View switches retain both
coordinates, both relation states and the reference context. Clicking the active
circle view icon returns to • in one action without changing composition.

Series come from `seriesMembers()` and actual engine atlas nodes. W/B include the
anchor and follow triangle order, S follows light-to-dark engine order, V follows
hues 1…24. The short preview source label states the retained atlas context. This
context remains distinct from any selected full-color vertex, sample or gray.

Click a preview swatch to adopt the entire series with that member active, or ↓
to adopt it with the context anchor active. `adoptRelation` calls the pure
`adoptSeries({anchor,relation,activeIdentity?})` reducer action. It stores ordered
members and `{relation,anchor,rule}` provenance, resets circle generation and
staging, and records one undo step. Preview state and navigation remain unchanged.
No historical letter is fabricated and no extra interval-selection law is applied.
The bottom strip can scroll for long series and keeps the active member visible.

Atlas/Verlauf remains in Info → Wissenschaftliche Details → Forschungsansicht.
There are no large workspace view headings or primary mode text buttons.

## 11. Transfer boundary and deferred work

The strip icon builds a version-1 `HarmonySelection` and emits
`farborgel:harmony-selection` through an explicit callback. It transfers the
current ordered working set, not the preview. This is not a history edit and does
not apply colors to a pattern. See [INTEGRATION_INTERFACE.md](INTEGRATION_INTERFACE.md)
for the schema, proposed Farbe menu, shared API and future adapter contract.

No persistence, export, clipboard copy, generator implementation, aesthetic scoring,
full historical interval-table browser or unrestricted graph editing. The p5.js
generator is untouched. No claim of historical RGB/pigment reconstruction.

## Verification

Run the engine tests, UI baseline, `node color-harmony/ui/composition.test.mjs`
and `node color-harmony/ui/integration.test.mjs`.
The baseline's intentional expectation updates concern persistence: no automatic
regeneration on member edit, no sample-to-atlas conversion on mode change, and no
loss of atlas members on home. Calibration/atlas/grammar assertions are unchanged.

Manual browser review covers the requested simple, structural and compound flows,
desktop 1280×1000 and mobile 390×844, keyboard selection, the active strip,
register highlights, bilingual inspector and shared-member validity. Display
perception and assistive technology beyond the browser review remain unmeasured.

Phase 6B.1 adds 37 integration/UI groups. All 28 composition groups are retained.
Browser QA additionally covers all seven on/off controls, both compact navigators,
series adoption/undo, the 24-member mobile strip, bilingual research controls and
the actual debug transfer record.
