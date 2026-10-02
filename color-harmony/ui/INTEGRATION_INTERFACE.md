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
if needed. There is no hidden global selection variable exposed as an API. (A page opened from the generator
additionally hands the same record to that generator tab - see "Return handoff to the generator" below; the
event itself is unchanged.)

Standalone feedback is **Auswahl bereitgestellt · noch kein Muster verbunden** /
**Selection emitted · no pattern connected yet**. It never claims that a pattern
was changed. No payload is logged in normal mode. With `?integration=1`, a small
inspection disclosure shows only the last transferred JSON snapshot. It is not
live composition state or an export feature; there is no download/copy button.

## Inbound: anchor pre-fill (URL)

The selection boundary above is outbound only (Farborgel → host). The one inbound channel is a start
position, passed in the page URL when a host opens the standalone page (the generator's Farbe-tab link does):

```text
color-harmony/ui/index.html?hue=9&reg=pa     // atlas field 9pa
color-harmony/ui/index.html?hue=9            // hue-only: the reference circle at hue 9, no register
color-harmony/ui/index.html                  // no parameters: the default start state (unchanged)
```

| Parameter | Value | Meaning |
| --- | --- | --- |
| `hue` | integer 1–24 (plain digits: no sign, padding, space or decimal) | the engine's own 1-based hue index |
| `reg` | one of the 28 two-letter atlas registers (`ca … pn`, lowercase) | register at that hue; omitted = hue-only |

`anchorOverridesFromSearch()` (`state.mjs`) turns this into the overrides object for `createState()` and is
deliberately strict, because `createState()` itself is not safe on raw URL values (hue 0 / 25 silently wrap, a
string, decimal or unknown register throws, and a throw at start-up would be a blank page):

- an invalid `hue` ignores **both** parameters and opens the default start state;
- an invalid `reg` with a valid `hue` falls back to hue-only;
- `reg` without `hue` is ignored;
- each unusable parameter logs one `console.warn`; absent parameters are silent; a repeated parameter uses its first value;
- it never throws, and `integration` / `calibration` are unaffected.

The register travels as its letters, not an index, so the page does not depend on any host's register
ordering. This is **not** a selection import: it only sets the starting colour, the composition begins as
that single member, and no payload crosses the boundary. The host-side builder is
`farborgelPageUrl(anchor)` in the generator's `core/farborgel-bridge.js`. Parameters for a return trip
(`from`, `sheet`) are reserved for a later phase and are not read yet.

## Return handoff to the generator (cross-tab)

When the standalone page was opened by a generator tab (the link carries `from=<12 hex>`, the id that tab gave
itself), **In Muster übernehmen** also sends the same version-1 record back to that tab. Without `from`
(opened directly, bookmarked) nothing is written and the notice above stays. The Farborgel only moves a record:
it imports nothing from the generator and knows nothing about trails, faces or the assignment store.

Transport: a `localStorage` mailbox and the `storage` event, which the browser fires in the *other* same-origin
tabs only. Two keys, one per direction, each with exactly one writer (`handoff.mjs` ↔ `core/farborgel-bridge.js`):

```text
wof:farborgel:handoff   page -> generator   { "v":1, "id":"<unique per emit>", "to":"<tabId>", "at":<ms>, "selection":{ …the v1 record, unmodified… } }
wof:farborgel:ack       generator -> page   { "v":1, "id":"<the handoff id>", "ok":true,  "sheet":"base" | <layer index>, "at":<ms> }
                                            { "v":1, "id":"<the handoff id>", "ok":false, "reason":"<code>", "at":<ms> }
```

- `id` is unique per emit and has to be: storing a value identical to the stored one fires **no** `storage` event
  (measured in Chromium), so re-emitting the same selection would otherwise vanish.
- Only the tab whose id the envelope is addressed to reacts; the generator also remembers the last 20 handled ids so a
  re-delivered event cannot apply twice. Each side removes the other's key after reading it.
- The payload is **untrusted cross-page input** (any script on the origin can write that key). The generator checks it
  field by field before anything is applied: envelope at most 512 K characters and well-formed; `version === 1`,
  `source === 'farborgel'`; 1–256 members, each with `hueIndex` null or an integer 1–24, `w` and `s` finite numbers in
  0–1 and `srgb` three integers 0–255; `classification.cardinality` equal to the member count; `activeMemberIndex` in
  range. A bad record is a `console.warn` and a rejection ack, never an exception.
- A valid selection is applied through the generator's existing `applyHarmonyToPattern` path, to the sheet that is
  **active when it arrives**, and remembered as that sheet's `custom` selection (it has no `(anchor, type)` recipe to
  regenerate from): a later distribution-strategy change reapplies it, an anchor change leaves it alone, and only an
  explicit new harmony (a harmony button, or another handoff) or Reset Color replaces it.
- Rejection reasons (`reason`): `fill-off`, `sheet-unavailable`, `no-trails`, `invalid-selection`, `invalid-envelope`,
  `internal-error` - each has a German and English message on the page.
- The page shows **pending** → **Ins Muster übernommen · Basis / Ebene N**, or **Kein Generator-Fenster offen** after 3 s
  without an ack (a late ack still turns that into "übernommen"), **Vom Generator abgelehnt · <reason>**, or
  **Speicher nicht verfügbar** when `localStorage` is unusable.

Known limits (documented, not bugs to chase):

- **An embedded generator will not receive it.** Browsers partition `localStorage` for third-party frames, so a
  generator embedded in an `<iframe>` on another site shares no storage with a Farborgel tab opened as a top-level
  page. The handoff then times out with "Kein Generator-Fenster offen" instead of failing silently. (Reasoned from
  how storage partitioning works; not tested.)
- **Verified in Chromium only**, in two tabs of the same profile (the headless tests cover the validation, dedup,
  sender state machine and wiring with fakes). Firefox and Safari behaviour of `storage` events, and a background
  tab the browser has frozen or discarded, are untested; the failure mode is the same timeout message.
- The 20-id dedup window is bounded: an id that has aged out would be accepted again.

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

## Pattern application boundary (the original sketch; implemented in the generator since Phase A/B4)

> Implemented as `applyHarmonyToPattern(selection, store, trails, strategy, context)` in the generator's
> `core/farborgel-bridge.js`, with pluggable distribution strategies; the sketch below is the original contract.

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

Still deferred: undo integration in the host, RGB input semantics and
allocation by orbit or hierarchy (the generator already distributes by cycle, area, symmetry and rings). There is no pattern
allocation algorithm inside the Farborgel, no new aesthetic ranking, no clipboard
or export feature, and no merge into main.
