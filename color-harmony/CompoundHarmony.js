'use strict';

// Internal composition layer. The engine supplies canonical atlas validation and
// existing relation tolerances; no color conversion or mixing is duplicated here.

/** Copy JSON-like data, accepting shared subtrees but rejecting cycles and non-data. */
function copyData(value, active = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object') throw new TypeError('Harmony structure must contain only finite plain data');
  if (active.has(value)) throw new Error('Cyclic harmony structure or provenance');
  const array = Array.isArray(value);
  if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new TypeError('Harmony structure must use plain objects');
  }
  active.add(value);
  const result = array ? [] : {};
  const keys = Reflect.ownKeys(value).filter(key => !(array && key === 'length'));
  if (array && (keys.length !== value.length || keys.some((k, i) => k !== String(i)))) {
    throw new TypeError('Harmony arrays must be dense, without additional properties');
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new TypeError('Harmony structure must contain enumerable data properties');
    }
    Object.defineProperty(result, key, { value: copyData(descriptor.value, active), enumerable: true, writable: true, configurable: true });
  }
  active.delete(value);
  return result;
}

/** Structural comparison independent of object property insertion order. */
function equalData(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && equalData(a[k], b[k]));
}

/** Stable atlas identities: chromatic labels already include hue and register. */
function memberKey(member) {
  return Object.hasOwn(member, 'hueIndex') ? `atlas:${member.label}` : `gray:${member.letter}`;
}

/** First occurrence order; structural occurrences remain in the child groups. */
function uniqueMembers(members) {
  const seen = new Set();
  return members.filter(member => {
    const key = memberKey(member);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Bind pure structural operations to one explicit engine calibration context. */
function createAPI({ resolveMember, sameShadowSeries, epsilon, letters }) {
  const near = (a, b) => Math.abs(a - b) <= epsilon;
  const chromatic = member => Object.hasOwn(member, 'hueIndex');
  const letterIndex = letter => letters.indexOf(letter);
  const onRelation = (a, b, relation) => {
    if (chromatic(a) && chromatic(b) && a.hueIndex !== b.hueIndex) return false;
    if (relation === 'isotint') return near(a.w, b.w);
    if (relation === 'isotone') return near(a.s, b.s);
    return relation === 'shadow-series' && chromatic(a) && chromatic(b) && sameShadowSeries(a, b);
  };

  /** Elementary groups establish domain/relation membership, not aesthetic approval. */
  function elementary(domain, input, relation) {
    if (!['gray', 'same-hue', 'isovalent'].includes(domain)) throw new RangeError('Unknown elementary harmony domain');
    if (!Array.isArray(input) || input.length < 2) throw new TypeError('Harmony members must contain at least two atlas colors');
    const members = input.map(resolveMember);
    if (uniqueMembers(members).length !== members.length) throw new Error('Duplicate member within elementary harmony');
    if (domain === 'gray') {
      relation = relation === undefined ? 'gray-series' : relation;
      if (relation !== 'gray-series' || members.some(chromatic)) throw new Error('Gray group requires gray-axis members and gray-series relation');
    } else if (domain === 'isovalent') {
      relation = relation === undefined ? 'isovalent' : relation;
      if (relation !== 'isovalent' || members.some(m => !chromatic(m) ||
          !['w', 's', 'v'].every(k => near(m[k], members[0][k])))) {
        throw new Error('Isovalent group requires chromatic members at one register');
      }
    } else {
      if (!['isotint', 'isotone', 'shadow-series'].includes(relation)) throw new RangeError('Same-hue group requires isotint, isotone or shadow-series relation');
      const anchor = members.find(chromatic);
      if (!anchor || !members.every(m => onRelation(anchor, m, relation))) {
        throw new Error('Members do not belong to the declared same-hue relation');
      }
    }
    return { type: 'harmony-set', domain, domains: [domain], level: 1, relation, members,
      historicalStatus: 'structural-selection', sourceStatus: 'contemporary-implementation',
      provenance: { operation: 'elementary', sourceCase: null, sourcePages: [],
        sequence: [{ step: 1, action: 'select-members' }] } };
  }

  /** Require paired nonzero offsets, allowing the center for partial replacement. */
  function symmetric(offsets) {
    const set = new Set(offsets);
    return offsets.some(x => x !== 0) && offsets.every(x => set.has(-x));
  }

  /** Explicit structural correspondence, never an assertion of Oklab mixture equality. */
  function correspondence(target, members) {
    if (!chromatic(target) && members.every(m => !chromatic(m))) {
      const center = letterIndex(target.letter);
      const offsets = members.map(m => letterIndex(m.letter) - center);
      if (symmetric(offsets)) return { basis: 'gray-letter-symmetry', offsets, sourcePages: [107, 108] };
    }
    if (chromatic(target) && members.every(m => chromatic(m) &&
        ['w', 's', 'v'].every(k => near(m[k], target[k])))) {
      const offsets = members.map(m => ((m.hueIndex - target.hueIndex + 36) % 24) - 12);
      // The implemented hue-splitting range is the existing Phase-4 1..6 steps.
      if (offsets.every(x => Math.abs(x) <= 6) && symmetric(offsets)) {
        return { basis: 'isovalent-hue-symmetry', offsets, sourcePages: [105, 114, 116] };
      }
    }
    if (chromatic(target)) {
      for (const relation of ['isotint', 'isotone', 'shadow-series']) {
        if (!members.every(m => onRelation(target, m, relation))) continue;
        const letter = m => !chromatic(m) ? m.letter : m.label.at(relation === 'isotint' ? -1 : -2);
        const center = letterIndex(letter(target));
        const offsets = members.map(m => letterIndex(letter(m)) - center);
        if (symmetric(offsets)) return { basis: 'same-hue-letter-symmetry', relation, offsets, sourcePages: [113, 115, 116] };
      }
    }
    throw new Error('Replacement group has no supported symmetric structural correspondence to the target');
  }

  /** Compose validated trees. Source input survives intact; active members follow the operation. */
  function compose(a, b, operation, replacedKey = null) {
    const bKeys = new Set(b.members.map(memberKey));
    const shared = a.members.filter(m => bKeys.has(memberKey(m))).map(memberKey);
    let members, replacementEvidence = null;
    if (operation === 'shared-member') {
      if (replacedKey !== null) throw new Error('Shared-member provenance cannot declare a substitution target');
      if (!shared.length) throw new Error('Shared-member composition requires at least one common member');
      members = uniqueMembers([...a.members, ...b.members]);
    } else if (operation === 'substitution') {
      const target = a.members.find(m => memberKey(m) === replacedKey);
      if (!target) throw new Error('Substitution target not found among active source members');
      replacementEvidence = correspondence(target, b.members);
      members = uniqueMembers(a.members.flatMap(m => memberKey(m) === replacedKey ? b.members : [m]));
    } else throw new RangeError('Unknown compound relation');
    return { type: 'compound-harmony', domain: 'compound',
      domains: [...new Set([...a.domains, ...b.domains])],
      level: 1 + Math.max(a.level, b.level), groups: [a, b], members,
      relation: operation, historicalStatus: 'source-backed-law', sourceStatus: 'primary-1921',
      provenance: { operation,
        inputs: [{ group: 0, role: operation === 'substitution' ? 'source' : 'component' },
          { group: 1, role: operation === 'substitution' ? 'replacement' : 'component' }],
        sharedElements: shared, replacedElement: replacedKey,
        replacementGroup: operation === 'substitution' ? 1 : null,
        replacementEvidence, sourceCase: null, sourcePages: [105],
        sequence: [{ step: 1, action: 'use-input', group: 0 },
          { step: 2, action: 'use-input', group: 1 }, { step: 3, action: operation }] } };
  }

  /** Recursively recompute all derived fields and provenance; reject forged caches/history. */
  function validateNode(node) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) throw new TypeError('Invalid harmony group structure');
    let expected;
    if (node.type === 'harmony-set') expected = elementary(node.domain, node.members, node.relation);
    else if (node.type === 'compound-harmony') {
      if (!Array.isArray(node.groups) || node.groups.length !== 2) throw new TypeError('Compound groups must contain two structured inputs');
      if (!node.provenance || typeof node.provenance !== 'object') throw new TypeError('Missing compound provenance');
      expected = compose(validateNode(node.groups[0]), validateNode(node.groups[1]), node.relation, node.provenance.replacedElement);
    } else throw new TypeError('Unknown harmony group type');
    if (!equalData(node, expected)) throw new Error('Malformed harmony structure, members, level or provenance');
    return expected;
  }
  const validate = group => validateNode(copyData(group));
  return {
    elementary: (domain, members, relation) => copyData(elementary(domain, copyData(members), relation)),
    combine: (a, b) => copyData(compose(validate(a), validate(b), 'shared-member')),
    substitute: (source, member, replacement) => copyData(compose(validate(source), validate(replacement),
      'substitution', memberKey(resolveMember(copyData(member))))),
    flatten: group => copyData(validate(group).members),
    level: group => validate(group).level
  };
}

module.exports = { createAPI };
