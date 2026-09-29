# Farborgel integration interface — Phase 6B.1

## Role and boundary

The standalone Farborgel explores, edits and classifies an explicit ordered harmony.
It ends at a neutral selection boundary. No generator module, pattern object,
face/polygon, symmetry object, drawing API or generator DOM is imported here.
The future simple Farbe menu and the Farborgel must share the existing engine,
composition operations and `HarmonySelection` builder. They must not acquire two
independent color/harmony models.

Historical coordinates, source identities and relation evidence survive transfer.
The current screen colors use the unchanged contemporary Phase-6A.2 Oklab display
calibration. Neither those colors nor the calibration are historical pigment
reconstructions. Source-page evidence refers to relationships, never to RGB.

## Version-1 HarmonySelection

`createHarmonySelection(composition)` in `HarmonySelection.mjs` accepts the current
pure composition state and returns a fresh serializable record. It validates and
canonicalizes colors through the engine, rejects duplicate identities or invalid
active indices, validates structural provenance and recomputes classification.
There are no timestamps, history stacks, DOM nodes or callback functions in the
payload. The same composition produces the same JSON. No composition state is
mutated. The builder consumes trusted reducer state, not arbitrary imported JSON.

```js
{
  version: 1,
  source: 'farborgel', // shared producing subsystem, also for a future simple menu
  members: [{
    identity: 'atlas:5ic',
    sourceType: 'atlas', // atlas | full-color | gray | interpolated
    historicalCoordinate: {
      hueIndex: 5, v: 0.42100000000000004, w: 0.1413, s: 0.4377,
      label: '5ic', letter: null
    },
    analyticalCoordinate: {hueIndex: 5, v: 0.42100000000000004, w: 0.1413, s: 0.4377},
    oklab: [/* unchanged engine L, a, b */],
    displayOklab: [/* calibrated and gamut-mapped L, a, b */],
    srgb: [207, 137, 87], // actual current screen RGB bytes
    displayColor: {space: 'srgb', channels: [207, 137, 87]},
    gamutMapped: false
  }],
  activeMemberIndex: 0,
  displayColors: [[207, 137, 87]],
  displayModel: {
    mixingSpace: 'Oklab', hueMapping: 'gamutAware', grayMapping: 'endpoint',
    historicallyCalibrated: false
  },
  classification: {
    cardinality: 1, historicalName: null, gapSignature: null,
    isovalent: true, hueGeometry: null, oppositePairs: [],
    compound: false, domain: null
  },
  provenance: {
    status: 'selected', // selected | generated | manual | compound | series
    construction: null,
    series: null, // {relation, anchor, rule} for an adopted engine series
    group: null, // validated engine HarmonySet/CompoundHarmony, recursively retained
    previousStructure: null // earlier compound retained after manual edits
  }
}
```

`members` always follows Active Harmony strip order; `activeMemberIndex` is zero
based and does not rotate that order. `historicalCoordinate` exists only for real
atlas nodes. Grays use their actual shared letter, `hueIndex:null`, `v:0`; full
colors and interpolations use `historicalCoordinate:null`. Their analytical
coordinates remain available. No rounded or inferred historical label is added.

Identity rules are shared with [COMPOSITION.md](COMPOSITION.md): `atlas:5ic`,
`gray:c`, `full-color:5`, or `interpolated:<hueIndex>:<w>:<s>` with canonical
unrounded coordinates. Equal RGB does not merge different identities.

`oklab` and engine records nested in provenance describe engine coordinates/colors.
For rendering use `srgb`, `displayColor`, or `displayColors`, which contain the
current calibrated screen realization. All RGB channels are integer bytes 0–255.
The record includes mapping identifiers so receivers can distinguish this from
raw engine RGB. `gamutMapped` reports the existing display conversion's correction.

`classification.hueGeometry` carries the existing engine's hue projection and
source confidence. `gapSignature` is its canonical cyclic gap signature, or null;
it need not have one entry per member when hues repeat or grays are included.
`historicalName` is only assigned by the existing classification rules.
`oppositePairs` contains zero-based member index pairs, without an aesthetic score.
The singleton `isovalent:true` follows the existing vacuous equality convention;
it does not claim a multi-hue historical chord.

A future incompatible schema requires a new `version`. Receivers should check
version and ignore unknown additive fields. Primary-source upgrades remain engine
metadata updates, not a new transfer format. No JSON import contract is introduced.

## Display accessor and pure callback

```js
import {
  createHarmonySelection, toDisplayColors, createHarmonyTransfer
} from './HarmonySelection.mjs';

const selection = createHarmonySelection(composition);
const colors = toDisplayColors(selection); // fresh [[r,g,b], ...] in member order
// selection.displayColors is also available, with independent RGB arrays.

const transfer = createHarmonyTransfer(onHarmonySelection);
transfer(composition); // build once, invoke receiver exactly once, return the record
```

`toDisplayColors()` checks version/source and valid RGB byte triples; it is a
convenience accessor, not a complete schema validator for untrusted external input.
Invalid composition data throws before the callback runs. Receiver exceptions
propagate to the caller; there is no retry or second delivery. A receiver owns
its delivered record and must not treat it as a reference to mutable UI state.
These exports work in Node ESM after the usual UI build, without `window` or DOM.

## Browser event and standalone behavior

The strip's transfer icon, **In Muster übernehmen / Apply to pattern**, invokes
the pure callback boundary. `app.mjs` connects that callback to exactly one local
browser event per activation:

```js
import {HARMONY_SELECTION_EVENT} from './HarmonySelection.mjs';
window.addEventListener(HARMONY_SELECTION_EVENT, event => {
  const selection = event.detail; // version 1
  // A future host can call its own applyHarmonyToPattern here.
});
// HARMONY_SELECTION_EVENT === 'farborgel:harmony-selection'
```

This is a same-window `CustomEvent`, not a network request or cross-window
`postMessage`. It is not replayed and does not mutate the composition or history.
Listeners should treat `event.detail` as read-only shared event data and clone it
if needed. There is no hidden global selection variable exposed as an API.

Standalone feedback is **Auswahl bereitgestellt · noch kein Muster verbunden** /
**Selection emitted · no pattern connected yet**. It never claims that a pattern
was changed. No payload is logged in normal mode. With `?integration=1`, a small
inspection disclosure shows only the last transferred JSON snapshot. It is not
live composition state or an export feature; there is no download/copy button.

## Proposed future Farbe menu (specification only)

```text
Farbe      [ color input / selected field ]
Harmonie   [ dropdown ]
           [ Farborgel ]
```

| German | English | Shared operation |
| --- | --- | --- |
| Keine | None | `reduceComposition(c, 'clearHarmony')` — keep active color |
| Gegenfarben | Complementary | `reduceComposition(c, 'generateHarmony', 2)` |
| Dreier | Three-color | `reduceComposition(c, 'generateHarmony', 3)` |
| Vierer | Four-color | `reduceComposition(c, 'generateHarmony', 4)` |
| Weiß | Equal white | `adoptSeries`, relation `isotint` |
| Schwarz | Equal black | `adoptSeries`, relation `isotone` |
| Schatten | Shadow | `adoptSeries`, relation `shadowSeries` |
| Wert | Isovalent | `adoptSeries`, relation `isovalent` |

A dropdown explicitly sets a relation, so it uses `generateHarmony`, not the
Farborgel digit button's `toggleCircleRelation`. Both delegate to the same engine
subdivision/classification rules. A series selection uses:

```js
const next = reduceComposition(composition, 'adoptSeries', {
  anchor: actualAtlasField, relation: 'shadowSeries'
});
const selection = createHarmonySelection(next);
```

`seriesMembers(anchor, relation)` supplies the exact same ordered preview members.
It requires an actual chromatic atlas anchor. A full-color, gray or interpolated
selection must not silently become an invented atlas node. The future simple menu
must expose or request a valid atlas context for these series, or show them as
unavailable. No unverified default gray interval law is introduced by 2/3/4.
Any future color input must likewise pass the shared model's validation boundary;
arbitrary RGB input-to-source classification is deferred, not a second model.

The standalone retains a separate visible atlas context for series previews, even
when a full-color vertex is active. The preview's short source label (e.g. `5ic`)
identifies it. Explicit adoption turns those actual nodes into the working set.
No letter label is assigned to the full-color vertex itself.

## Future pattern application boundary (not implemented)

```js
applyHarmonyToPattern(selection, patternContext)
```

This adapter belongs to the future generator/host, never the Farborgel. Both
Farbe menu and Farborgel must deliver the same versioned `HarmonySelection` to it.
A first fallback can assign M ordered display colors to N host-defined slots by
cyclic repetition: three members over eight slots → `A B C A B C A B`.
The host defines slot order. Assignment initializes editable colors; the user can
continue assigning/editing individual pattern colors afterwards. No lock or
permanent live binding is implied.

Deferred: generator UI and event receiver, slot enumeration, drawing updates,
undo integration in the host, RGB input semantics, cross-window transport and
allocation by symmetry, orbit, hierarchy, area or topology. There is no pattern
allocation algorithm inside the Farborgel, no new aesthetic ranking, no clipboard
or export feature, and no merge into main.
