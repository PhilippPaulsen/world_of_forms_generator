'use strict';

// Internal, color-independent combinatorics. Public access is through OstwaldColor.
// Page numbers refer to the directly inspected revised 1921 edition; see the source map.
const PERIOD = '1921-system';

/** Safe integer normalization without overflowing at Number.MAX_SAFE_INTEGER. */
function normalizeHue(hue) {
  if (!Number.isSafeInteger(hue)) throw new RangeError('Hue must be a safe integer');
  return ((hue % 24 + 23) % 24) + 1;
}

/** Dense, distinct circular set; reject collisions instead of silently deduplicating. */
function hueSet(hues, min = 2, max = 24) {
  if (!Array.isArray(hues)) throw new TypeError('hues must be a dense array');
  if (hues.length < min || hues.length > max) throw new RangeError(`Require ${min}..${max} hues`);
  const normalized = Array.from(hues, normalizeHue);
  if (new Set(normalized).size !== normalized.length) throw new RangeError('Duplicate hue positions');
  return normalized.sort((a, b) => a - b);
}

/** Numeric lexicographic order, not JavaScript's string array order. */
function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Positive full-circle gaps, canonical under rotation only; never reflect. */
function cyclicGapSignature(hues) {
  const sorted = hueSet(hues);
  const gaps = sorted.map((h, i) => (sorted[i + 1] || sorted[0] + 24) - h);
  return gaps.map((_, i) => gaps.slice(i).concat(gaps.slice(0, i))).sort(compare)[0];
}

/** Exact group symmetries: shifts and axes use zero-based circular coordinates. */
function symmetryOf(hues) {
  const positions = new Set(hues.map(h => h - 1));
  const rotations = [], reflections = [];
  for (let k = 0; k < 24; k++) {
    if ([...positions].every(x => positions.has((x + k) % 24))) rotations.push(k);
    if ([...positions].every(x => positions.has((k - x + 24) % 24))) reflections.push(k);
  }
  const rotational = rotations.length > 1;
  const reflection = reflections.length > 0;
  return { type: rotational ? (reflection ? 'dihedral' : 'rotational') :
    (reflection ? 'reflection' : 'asymmetric'), rotations, reflections };
}

/** Plain structural classification: historical names apply only to exact named patterns. */
function classifyHueSet(input) {
  const hues = hueSet(input), gaps = cyclicGapSignature(hues), cardinality = hues.length;
  const regular = gaps.every(g => g === gaps[0]);
  const historicalName = regular ? ({ 2: 'Gegenfarben', 3: 'Triade', 4: 'Tetrade' }[cardinality] || null) : null;
  const sourcePages = historicalName ? ({ 2: [74, 98], 3: [94], 4: [98] }[cardinality]) : [];
  const symmetry = symmetryOf(hues);
  return { hues, cardinality, gaps, className: ({ 2: 'Zweier', 3: 'Dreier', 4: 'Vierer' }[cardinality] || null),
    symmetry: symmetry.type, symmetries: { rotations: symmetry.rotations, reflections: symmetry.reflections },
    regular, construction: historicalName ? 'division' : 'unspecified', historicalName,
    sourceStatus: historicalName ? 'primary-1921' : 'mathematical', sourcePages,
    classificationStatus: 'structural-no-aesthetic-verdict' };
}

/** All unordered pairs at one minimal circular distance, numeric lexicographic order. */
function dyadsByDistance(distance) {
  if (!Number.isInteger(distance) || distance < 1 || distance > 12) throw new RangeError('distance must be an integer in 1..12');
  const pairs = [];
  for (let a = 1; a <= 24; a++) for (let b = a + 1; b <= 24; b++) {
    if (Math.min(b - a, 24 - b + a) === distance) pairs.push([a, b]);
  }
  return pairs;
}

/** Attach construction evidence without replacing the independent geometric class. */
function constructed(hues, construction, sourcePages, details, status = 'primary-1921') {
  return { ...classifyHueSet(hues), construction,
    constructionEvidence: { sourceStatus: status, sourcePages, ...details } };
}

/** Bisect the selected directed arc, one of the two alternatives on pp.90–92. */
function divideHueDyad(dyad, direction = 'clockwise') {
  hueSet(dyad, 2, 2);
  if (!['clockwise', 'counterclockwise'].includes(direction)) throw new RangeError('direction must be clockwise or counterclockwise');
  const [a, b] = dyad.map(normalizeHue);
  const sign = direction === 'clockwise' ? 1 : -1;
  const arc = ((b - a) * sign + 24) % 24;
  if (arc % 2 !== 0) throw new RangeError('Arc midpoint is not a discrete hue: an even arc is required');
  const midpoint = normalizeHue(a + sign * arc / 2);
  return constructed([a, b, midpoint], 'division', [90, 91, 92],
    { baseDyad: [a, b], direction, arc, addedHue: midpoint });
}

/** Add a specified third hue; only equal-step continuation matches p.92 Aufbau. */
function augmentHueDyad(dyad, thirdHue) {
  const baseDyad = hueSet(dyad, 2, 2), third = normalizeHue(thirdHue);
  const [a, b] = baseDyad;
  const equalStep = third === normalizeHue(2 * b - a) || third === normalizeHue(2 * a - b);
  return constructed([...baseDyad, third], 'augmentation', equalStep ? [90, 92] : [],
    { baseDyad, distance: Math.min(b - a, 24 - b + a), addedHue: third,
      equalStep, conceptSourcePages: [90, 92, 96] }, equalStep ? 'primary-1921' : 'contemporary-implementation');
}

/** Replace one member by symmetric neighbors, p.93; repeat on a Dreier for p.99 Vierer. */
function splitHueSet(input, target, distance) {
  const hues = hueSet(input, 2, 3), hue = normalizeHue(target);
  if (!hues.includes(hue)) throw new RangeError('Split target must be a member of the source set');
  if (!Number.isInteger(distance) || distance < 1 || distance > 6) throw new RangeError('Split distance must be an integer in 1..6 (p.93)');
  const replacements = [normalizeHue(hue - distance), normalizeHue(hue + distance)];
  return constructed([...hues.filter(h => h !== hue), ...replacements], 'split', hues.length === 2 ? [93] : [93, 99],
    { sourceHues: hues, target: hue, distance, replacements });
}

/** Fresh terminology metadata. The registry describes evidence, never executes judgments. */
function registry() {
  const primary = (id, germanTerm, englishTerm, domain, sourcePages, extra = {}) => ({
    id, germanTerm, englishTerm, domain, sourcePages,
    relation: ({complementary:'regular-subdivision',triad:'regular-subdivision',tetrad:'regular-subdivision',
      dyad:'circular-distance',dreier:'cyclic-gap-classification',vierer:'cyclic-gap-classification',
      isotint:'constant-w',isotone:'constant-s',shadowSeries:'constant-v:w',isovalent:'constant-w-s-v'})[id],
    historicalStatus: 'explicit',
    sourceStatus: 'primary-1921', sourceConfidence: 'primary', primaryVerified: true,
    period: PERIOD, implementationStatus: 'implemented', ...extra
  });
  return {
    rules: [
      primary('complementary', 'Gegenfarben', 'opposite pair', 'isovalent-hue-circle', [74, 98], { parts: 2 }),
      primary('triad', 'Triade', 'regular threefold division', 'isovalent-hue-circle', [94], { parts: 3 }),
      primary('tetrad', 'Tetrade', 'regular fourfold division', 'isovalent-hue-circle', [98], { parts: 4 }),
      primary('dyad', 'Zweier', 'two-color set', 'isovalent-hue-circle', [72, 73, 74]),
      primary('dreier', 'Dreier', 'three-color set', 'isovalent-hue-circle', [90, 96, 97]),
      primary('vierer', 'Vierer', 'four-color set', 'isovalent-hue-circle', [97, 98, 99]),
      primary('isotint', 'Weißgleiche', 'constant-white series', 'one-hue-triangle', [48, 49, 50]),
      primary('isotone', 'Schwarzgleiche', 'constant-black series', 'one-hue-triangle', [48, 50, 51]),
      primary('shadowSeries', 'Schattenreihe', 'shadow series', 'one-hue-triangle', [47, 48, 51]),
      primary('isovalent', 'Wertgleiche', 'isovalent circle', 'isovalent-hue-circle', [64]),
      { id: 'analyticIsochrome', germanTerm: 'Analytische Reingleiche', englishTerm: 'analytical isochrome',
        domain: 'analytical-triangle', relation:'constant-v', period:null, historicalStatus: 'mathematical', sourceStatus: 'mathematical',
        sourcePages: [], implementationStatus: 'implemented' },
      { id: 'regularHueSubdivision', germanTerm: 'Regelmäßige Kreisteilung', englishTerm: 'regular subdivision',
        domain: 'isovalent-hue-circle', relation:'regular-subdivision', period:null, historicalStatus: 'mathematical', sourceStatus: 'mathematical',
        sourcePages: [], implementationStatus: 'implemented' },
      primary('intervalRelation1921', 'Vergleich mit der Musik', 'musical interval analogy', 'hue-distance-analogy', [89],
        { sourceStatus: 'primary-1921-p89', relation: 'distance-analogy-lookup' })
    ],
    researchPending: ['shadow-series', 'isotint', 'isotone'].map(family => ({
      id: `${family}-interval-laws`, term: `Complete interval laws: ${family}`,
      historicalStatus: 'research-pending', sourceConfidence: 'research-pending', implementationStatus: 'research-pending'
    })),
    deferred: [
      { id: 'harmothek', germanTerm: 'Harmothek', sourceStatus: 'primary-1921', sourcePages: [18, 19],
        implementationStatus: 'future-catalog-layer' },
      { id: 'compound-harmonies', germanTerm: 'Zusammengesetzte Wohlklänge', sourceStatus: 'primary-1921',
        sourcePages: ['contents X'], implementationStatus: 'phase-5-candidate' }
    ],
    researchNotes: [{ term: 'Heraden', historicalStatus: 'secondary-attested',
      implementationStatus: 'not-required-for-current-primary-grammar' }]
  };
}

module.exports = { cyclicGapSignature, classifyHueSet, dyadsByDistance,
  divideHueDyad, augmentHueDyad, splitHueSet, registry };
