'use strict';

const assert = require('node:assert/strict');
const OstwaldColor = require('./ColorHarmonyEngine.js');
let passed = 0;
function test(name, run) {
  run();
  passed++;
  console.log(`ok ${passed} - ${name}`);
}
const near = (actual, expected, epsilon = 1e-10) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const clone = value => JSON.parse(JSON.stringify(value));
const circle = OstwaldColor.hueCircle();
const triangle = OstwaldColor.triangle(5);
const selected = triangle.find(field => field.label === '5ic');

function complete(field) {
  assert.ok(Number.isInteger(field.hueIndex) && field.hueIndex >= 1 && field.hueIndex <= 24);
  assert.ok(field.w >= 0 && field.s >= 0 && field.v >= 0);
  near(field.w + field.s + field.v, 1);
  assert.match(field.label, /^[1-9][0-9]?[acegilnp]{2}$/);
  assert.equal(field.lab.length, 3);
  assert.equal(field.rgb.length, 3);
  assert.ok(field.lab.every(Number.isFinite));
  assert.ok(field.rgb.every(c => Number.isInteger(c) && c >= 0 && c <= 255));
}

test('letterScale: exact nonlinear values, order, independence', () => {
  const scale = OstwaldColor.letterScale();
  assert.equal(scale.length, 8);
  assert.deepEqual(scale.map(x => x.letter), ['a', 'c', 'e', 'g', 'i', 'l', 'n', 'p']);
  assert.deepEqual(scale.map(x => x.value), [0.8913, 0.5623, 0.3548, 0.2239, 0.1413, 0.0891, 0.0562, 0.0355]);
  assert.ok(scale.slice(1).every((x, i) => x.value < scale[i].value));
  near(scale[4].value, 0.1413);
  scale[0].value = 0;
  assert.equal(OstwaldColor.letterScale()[0].value, 0.8913);
});

test('mix: full color, ideal screen white, ideal screen black', () => {
  const full = circle[4];
  assert.deepEqual(OstwaldColor.mix(full.lab, 0, 0).lab, full.lab);
  assert.deepEqual(OstwaldColor.mix(full.lab, 0, 0).rgb, full.rgb);
  assert.deepEqual(OstwaldColor.mix(full.lab, 1, 0).lab, [1, 0, 0]);
  assert.deepEqual(OstwaldColor.mix(full.lab, 1, 0).rgb, [255, 255, 255]);
  assert.deepEqual(OstwaldColor.mix(full.lab, 0, 1).lab, [0, 0, 0]);
  assert.deepEqual(OstwaldColor.mix(full.lab, 0, 1).rgb, [0, 0, 0]);
});

test('mix: exclusively Oklab interpolation and known sRGB conversion', () => {
  const lab = [0.6, 0.08, -0.04];
  const input = lab.slice();
  const result = OstwaldColor.mix(lab, 0.2, 0.3);
  result.lab.forEach((c, i) => near(c, [0.5, 0.04, -0.02][i]));
  assert.deepEqual(lab, input);
  assert.deepEqual(OstwaldColor.mix([1, 0, 0], 0, 0.5).rgb, [99, 99, 99]);
  // sRGB red reference expressed in Oklab.
  assert.deepEqual(OstwaldColor.mix([0.6279553606, 0.2248630611, 0.1258462985], 0, 0).rgb, [255, 0, 0]);
});

test('mix: deterministic gamut clipping preserves original Oklab', () => {
  const lab = [0.7, 0.4, 0.3];
  const result = OstwaldColor.mix(lab, 0, 0);
  assert.deepEqual(result.lab, lab);
  assert.deepEqual(result.rgb, [255, 0, 0]);
  assert.deepEqual(OstwaldColor.mix(lab, 0, 0), result);
});

test('mix: strict malformed Lab and geometry errors', () => {
  for (const lab of [null, {}, [0.5, 0], [0.5, 0, 0, 0], [NaN, 0, 0], [0.5, Infinity, 0], ['0.5', 0, 0], Array(3)]) {
    assert.throws(() => OstwaldColor.mix(lab, 0, 0), /three finite/);
  }
  for (const [w, s] of [[-0.1, 0], [0, -0.1], [0.6, 0.5], [1.001, 0], [0, 1.001]]) {
    assert.throws(() => OstwaldColor.mix(circle[0].lab, w, s), /w >= 0/);
  }
  for (const bad of [NaN, Infinity, '0', null, undefined]) {
    assert.throws(() => OstwaldColor.mix(circle[0].lab, bad, 0), /finite/);
    assert.throws(() => OstwaldColor.mix(circle[0].lab, 0, bad), /finite/);
  }
  assert.throws(() => OstwaldColor.mix([1e308, 0, 0], 0, 0), /overflow/);
});

test('mix: only epsilon-sized coordinate errors are normalized', () => {
  for (const [w, s] of [[-1e-12, 0.4], [0.4, -1e-12], [0.6, 0.4 + 1e-12], [-1e-12, 1 + 1e-12]]) {
    const result = OstwaldColor.mix(circle[0].lab, w, s);
    assert.ok(result.w >= 0 && result.s >= 0 && result.v >= 0);
    near(result.w + result.s + result.v, 1);
  }
  assert.throws(() => OstwaldColor.mix(circle[0].lab, -1e-8, 0), RangeError);
});

test('hueCircle: 24 ordered references, common L/C and uniform opposite directions', () => {
  assert.equal(circle.length, 24);
  const groups = ['Yellow', 'Orange / Kreß', 'Red', 'Violet', 'Ultramarine / Blue', 'Ice Blue', 'Sea Green', 'Leaf Green'];
  circle.forEach((hue, i) => {
    assert.equal(hue.index, i + 1);
    assert.equal(hue.calibrated, false);
    assert.equal(hue.group, groups[Math.floor(i / 3)]);
    assert.ok(hue.rgb.every(c => Number.isInteger(c) && c >= 0 && c <= 255));
    assert.ok(hue.lab.every(Number.isFinite));
    near(hue.lab[0], 0.72);
    near(Math.hypot(hue.lab[1], hue.lab[2]), 0.1);
    const next = circle[(i + 1) % 24];
    near(Math.hypot(hue.lab[1] - next.lab[1], hue.lab[2] - next.lab[2]), 0.2 * Math.sin(Math.PI / 24));
    const opposite = circle[(i + 12) % 24];
    assert.equal(Math.abs(opposite.index - hue.index), 12);
    near(hue.lab[1] + opposite.lab[1], 0);
    near(hue.lab[2] + opposite.lab[2], 0);
  });
  const other = OstwaldColor.hueCircle();
  other[0].lab[0] = 0;
  assert.equal(OstwaldColor.hueCircle()[0].lab[0], 0.72);
});

test('hueCircle: custom counts and invalid counts', () => {
  for (const n of [1, 8, 12, 48]) assert.equal(OstwaldColor.hueCircle(n).length, n);
  for (const n of [0, -1, 2.5, NaN, Infinity, '24', null, 2 ** 32]) {
    assert.throws(() => OstwaldColor.hueCircle(n), RangeError);
  }
});

test('triangle: 28 chromatic atlas fields per hue and deterministic letter ordering', () => {
  const letters = ['a', 'c', 'e', 'g', 'i', 'l', 'n', 'p'];
  for (let hue = 1; hue <= 24; hue++) {
    const fields = OstwaldColor.triangle(hue);
    assert.equal(fields.length, 28);
    fields.forEach(complete);
    assert.ok(fields.every(f => f.v > 0 && f.source === 'atlas'));
    assert.deepEqual(fields.map(f => f.label), letters.flatMap((white, i) =>
      letters.slice(0, i).map(black => `${hue}${white}${black}`)));
  }
  near(selected.w, 0.1413);
  near(selected.s, 0.4377);
  near(selected.v, 0.4210);
  assert.deepEqual(OstwaldColor.triangle(5), triangle);
});

test('triangle: invalid hueIndex and undefined resolutions rejected', () => {
  for (const hue of [0, 25, -1, 1.1, NaN, Infinity, '5', null, undefined]) {
    assert.throws(() => OstwaldColor.triangle(hue), /hueIndex/);
  }
  for (const steps of [0, -1, 1, 4, 7, 9, 8.1, NaN, Infinity, '8', null]) {
    assert.throws(() => OstwaldColor.triangle(5, steps), /steps/);
  }
});

test('harmonies: all fields preserve exact discrete series relationships', () => {
  for (const field of triangle) {
    const harmony = OstwaldColor.harmonies(field);
    for (const [key, share] of [['isotints', 'w'], ['isotones', 's'], ['analyticIsochromes', 'v']]) {
      const expected = triangle.filter(f => f.label !== field.label && Math.abs(f[share] - field[share]) <= 1e-10);
      assert.deepEqual(harmony[key], expected);
      harmony[key].forEach(f => { complete(f); near(f[share], field[share]); });
    }
  }
  const harmony = OstwaldColor.harmonies(selected);
  assert.equal(harmony.isotints.length, 3);
  assert.equal(harmony.isotones.length, 5);
  assert.deepEqual(harmony.analyticIsochromes, []);
});

test('harmonies: complementary, triad and tetrad offsets, including wraparound', () => {
  const expectedOffsets = { complementary: [12], triad: [8, 16], tetrad: [6, 12, 18] };
  for (let hue = 1; hue <= 24; hue++) {
    const field = OstwaldColor.triangle(hue).find(f => f.label === `${hue}ic`);
    const chords = OstwaldColor.harmonies(field).hueHarmonies;
    assert.deepEqual(chords.map(c => c.type), Object.keys(expectedOffsets));
    for (const chord of chords) {
      assert.deepEqual(chord.fields.map(f => (f.hueIndex - hue + 24) % 24), expectedOffsets[chord.type]);
      chord.fields.forEach(f => {
        complete(f);
        for (const key of ['w', 's', 'v']) near(f[key], field[key]);
        assert.deepEqual(f, OstwaldColor.triangle(f.hueIndex).find(x => x.label === f.label));
      });
    }
  }
});

test('context: default equivalence, subset order, no mutation or shared result arrays', () => {
  const context = { hueCircle: clone(circle), triangle: clone(triangle) };
  const before = clone(context);
  assert.deepEqual(OstwaldColor.harmonies(selected, context), OstwaldColor.harmonies(selected));
  assert.deepEqual(context, before);
  const subset = [triangle.find(f => f.label === '5ie'), selected, triangle.find(f => f.label === '5ia')];
  const harmony = OstwaldColor.harmonies(selected, { triangle: subset });
  assert.deepEqual(harmony.isotints.map(f => f.label), ['5ie', '5ia']);
  harmony.isotints[0].rgb[0] = -1;
  assert.ok(subset[0].rgb[0] >= 0);
  const chords = OstwaldColor.harmonies(selected).hueHarmonies;
  chords[0].fields[0].lab[0] = -1;
  assert.ok(chords[2].fields[1].lab[0] >= 0);
});

test('context: custom Oklab anchors drive default triangles and hue transfer', () => {
  const custom = clone(circle);
  for (const hue of custom) {
    hue.lab = [0.6, hue.lab[1] * 0.8, hue.lab[2] * 0.8];
    hue.rgb = OstwaldColor.mix(hue.lab, 0, 0).rgb;
  }
  const field = { ...selected, ...OstwaldColor.mix(custom[4].lab, selected.w, selected.s), label: selected.label, source: 'atlas' };
  const result = OstwaldColor.harmonies(field, { hueCircle: custom });
  assert.equal(result.isotints.length, 3);
  const complement = result.hueHarmonies[0].fields[0];
  assert.deepEqual(complement.lab, OstwaldColor.mix(custom[16].lab, field.w, field.s).lab);
  assert.throws(() => OstwaldColor.harmonies(selected, { hueCircle: custom }), /lab/);
});

test('harmonies: unknown, malformed, inconsistent and impossible fields rejected', () => {
  for (const patch of [
    { label: '5zz' }, { label: '5ac' }, { label: '05ic' }, { label: '6ic' },
    { hueIndex: 0 }, { hueIndex: 25 }, { w: -0.1 }, { s: -0.1 },
    { w: 0.8, s: 0.8 }, { w: 0.2 }, { s: 0.3 }, { v: NaN }, { v: 0.5 },
    { lab: [0, 0] }, { lab: [0, 0, 0] }, { rgb: [999, 0, 0] }, { rgb: [0, 0, 0] }
  ]) assert.throws(() => OstwaldColor.harmonies({ ...selected, ...patch }), Error);
  for (const field of [null, undefined, {}, '5ic']) assert.throws(() => OstwaldColor.harmonies(field), Error);
  assert.throws(() => OstwaldColor.harmonies(selected, { triangle: [triangle[0]] }), /Unknown field/);
});

test('context: reject malformed circles, triangles and unknown settings', () => {
  for (const context of [null, [], 'context', { mode: 'rgb' }, { hueCircle: null },
    { hueCircle: circle.slice(1) }, { hueCircle: Array(24) }, { triangle: null },
    { triangle: [] }, { triangle: Array(1) }, { triangle: [selected, selected] },
    { triangle: [selected, OstwaldColor.triangle(6)[0]] }]) {
    assert.throws(() => OstwaldColor.harmonies(selected, context), Error);
  }
  for (const patch of [{ index: 2 }, { lab: [NaN, 0, 0] }, { rgb: [0, 0, 0] }]) {
    const invalid = clone(circle);
    Object.assign(invalid[0], patch);
    assert.throws(() => OstwaldColor.harmonies(selected, { hueCircle: invalid }), Error);
  }
});

test('atlas: 672 chromatic nodes and eight shared grays', () => {
  const atlas = circle.flatMap(hue => OstwaldColor.triangle(hue.index));
  assert.equal(atlas.length, 672);
  assert.equal(new Set(atlas.map(f => f.label)).size, 672);
  assert.ok(atlas.every(f => f.v > 0));
  const grays = OstwaldColor.grayAxis();
  assert.equal(grays.length, 8);
  assert.deepEqual(grays.map(g => g.letter), ['a', 'c', 'e', 'g', 'i', 'l', 'n', 'p']);
  grays.forEach((gray, i) => {
    assert.equal(gray.v, 0);
    assert.equal(gray.source, 'atlas');
    assert.equal(gray.label, gray.letter);
    assert.ok(!Object.hasOwn(gray, 'hueIndex'));
    near(gray.w, OstwaldColor.letterScale()[i].value);
    near(gray.w + gray.s, 1);
    assert.deepEqual(gray.lab, [gray.w, 0, 0]);
    assert.equal(new Set(gray.rgb).size, 1);
  });
});

test('shadow regression: ga–ic–le–ng–pi preserves rounded v/w, not v', () => {
  const series = OstwaldColor.harmonies(selected).shadowSeries;
  assert.deepEqual(series.map(f => f.label), ['5ga', '5ic', '5le', '5ng', '5pi']);
  const expected = [
    [0.2239, 0.1087, 0.6674], [0.1413, 0.4377, 0.4210],
    [0.0891, 0.6452, 0.2657], [0.0562, 0.7761, 0.1677], [0.0355, 0.8587, 0.1058]
  ];
  series.forEach((f, i) => {
    complete(f);
    [f.w, f.s, f.v].forEach((c, j) => near(c, expected[i][j]));
    if (i) assert.ok(f.s > series[i - 1].s);
    // First-order plus bounded-denominator propagation of ±0.00005 per letter.
    const ratioError = item => 0.00005 * ((1 - item.s) + item.w) /
      (item.w * (item.w - 0.00005));
    near(f.v / f.w, selected.v / selected.w, ratioError(f) + ratioError(selected));
  });
  assert.ok(new Set(series.map(f => f.v)).size > 1);
  assert.deepEqual(OstwaldColor.harmonies(selected, { triangle: [...triangle].reverse() }).shadowSeries, series);
});

test('isovalent: all 24 hues at the same register, independent of hue chords', () => {
  const harmony = OstwaldColor.harmonies(selected);
  assert.deepEqual(harmony.isovalent.map(f => f.hueIndex), Array.from({ length: 24 }, (_, i) => i + 1));
  harmony.isovalent.forEach(f => {
    complete(f);
    assert.equal(f.label, `${f.hueIndex}ic`);
    for (const key of ['w', 's', 'v']) near(f[key], selected[key]);
  });
  harmony.hueHarmonies.forEach(chord => chord.fields.forEach(f =>
    assert.deepEqual(f, harmony.isovalent[f.hueIndex - 1])));
  harmony.hueHarmonies[0].fields[0].rgb[0] = -1;
  assert.ok(harmony.isovalent[16].rgb[0] >= 0);
});

test('gray companions: actual shared gray nodes at equal w or s', () => {
  const grays = OstwaldColor.grayAxis();
  for (const field of triangle) {
    const { sameWhite, sameBlack } = OstwaldColor.harmonies(field).grayHarmonies;
    assert.deepEqual(sameWhite, grays.find(g => g.letter === field.label.at(-2)));
    assert.deepEqual(sameBlack, grays.find(g => g.letter === field.label.at(-1)));
    near(sameWhite.w, field.w);
    near(sameBlack.s, field.s);
  }
  grays[0].rgb[0] = -1;
  assert.ok(OstwaldColor.grayAxis()[0].rgb[0] >= 0);
});

const PATH_TYPES = ['isotint', 'isotone', 'analyticIsochrome', 'shadowSeries'];
function validSample(sample) {
  assert.equal(sample.source, 'interpolated');
  assert.equal(sample.label, null);
  assert.ok(sample.w >= 0 && sample.s >= 0 && sample.v >= 0);
  near(sample.w + sample.s + sample.v, 1);
  assert.equal(sample.lab.length, 3);
  assert.ok(sample.lab.every(Number.isFinite));
  assert.equal(sample.rgb.length, 3);
  assert.ok(sample.rgb.every(c => Number.isInteger(c) && c >= 0 && c <= 255));
}
function invariant(sample, type, source) {
  if (type === 'isotint') near(sample.w, source.w);
  else if (type === 'isotone') near(sample.s, source.s);
  else if (type === 'analyticIsochrome') near(sample.v, source.v);
  else {
    near(sample.v * source.w, sample.w * source.v);
    if (source.w > 0 && sample.w > 0) near(sample.v / sample.w, source.v / source.w);
  }
}

test('paths: explicit constraints and maximal endpoints for all four relations', () => {
  const paths = OstwaldColor.harmonies(selected).paths;
  assert.deepEqual(Object.keys(paths), PATH_TYPES);
  assert.deepEqual(paths.isotint.constraint, { kind: 'constant', coordinate: 'w', value: selected.w });
  assert.deepEqual(paths.isotone.constraint, { kind: 'constant', coordinate: 's', value: selected.s });
  assert.deepEqual(paths.analyticIsochrome.constraint, { kind: 'constant', coordinate: 'v', value: selected.v });
  for (const [type, path] of Object.entries(paths)) {
    assert.equal(path.type, type);
    assert.equal(path.hueIndex, 5);
    assert.deepEqual(path.sourceField, selected);
    assert.deepEqual(path.fullColorLab, circle[4].lab);
    assert.equal(path.domain.parameter, 't');
    assert.equal(path.domain.min, 0);
    assert.equal(path.domain.max, 1);
    for (const end of [path.domain.start, path.domain.end]) {
      near(end.w + end.s + end.v, 1);
      assert.ok([end.w, end.s, end.v].some(x => x === 0));
      invariant(end, type, selected);
    }
  }
  assert.equal(paths.shadowSeries.constraint.ratioStatus, 'finite');
  assert.equal(paths.shadowSeries.constraint.blackEndpoint, 'limit');
  near(paths.shadowSeries.domain.start.w, selected.w / (selected.w + selected.v));
  assert.deepEqual(paths.shadowSeries.domain.end, { w: 0, s: 1, v: 0 });
});

test('sampling: all paths through all 672 atlas nodes preserve analytical invariants', () => {
  for (const hue of circle) {
    for (const field of OstwaldColor.triangle(hue.index)) {
      for (const [type, path] of Object.entries(OstwaldColor.harmonies(field).paths)) {
        const samples = OstwaldColor.sampleHarmonyPath(path, 9);
        assert.equal(samples.length, 9);
        samples.forEach(sample => {
          validSample(sample);
          invariant(sample, type, field);
          assert.deepEqual(sample.lab, OstwaldColor.mix(hue.lab, sample.w, sample.s).lab);
        });
      }
    }
  }
});

test('sampling: path survives empty discrete matches and restricted atlas contexts', () => {
  const result = OstwaldColor.harmonies(selected, { triangle: [selected] });
  assert.deepEqual(result.analyticIsochromes, []);
  assert.deepEqual(result.isotints, []);
  assert.deepEqual(result.isotones, []);
  assert.deepEqual(result.shadowSeries, [selected]);
  assert.equal(result.isovalent.length, 24);
  assert.deepEqual(result.paths, OstwaldColor.harmonies(selected).paths);
  const samples = OstwaldColor.sampleHarmonyPath(result.paths.analyticIsochrome, 5);
  assert.equal(samples.length, 5);
  assert.ok(samples[0].w !== samples[4].w);
  samples.forEach(sample => invariant(sample, 'analyticIsochrome', selected));
});

test('sampling: JSON serialization, midpoint for count=1 and inclusive endpoints', () => {
  for (const path of Object.values(OstwaldColor.harmonies(selected).paths)) {
    const before = clone(path);
    const one = OstwaldColor.sampleHarmonyPath(path, 1);
    const three = OstwaldColor.sampleHarmonyPath(clone(path), 3);
    assert.deepEqual(one, [three[1]]);
    for (const key of ['w', 's', 'v']) {
      near(three[0][key], path.domain.start[key]);
      near(three[2][key], path.domain.end[key]);
    }
    assert.deepEqual(path, before);
    one[0].lab[0] = -1;
    assert.deepEqual(path, before);
  }
});

test('sampling: custom calibration is captured and does not depend on later context changes', () => {
  const custom = clone(circle);
  custom[4].lab = [0.6, 0.04, 0.02];
  custom[4].rgb = OstwaldColor.mix(custom[4].lab, 0, 0).rgb;
  const path = OstwaldColor.harmonyPath('shadowSeries', 5, selected.w, selected.s, { hueCircle: custom });
  const expected = OstwaldColor.sampleHarmonyPath(path, 3);
  custom[4].lab[0] = 0.1;
  assert.deepEqual(OstwaldColor.sampleHarmonyPath(path, 3), expected);
  expected.forEach(sample => assert.deepEqual(sample.lab,
    OstwaldColor.mix([0.6, 0.04, 0.02], sample.w, sample.s).lab));
  const paths = OstwaldColor.harmonies(selected).paths;
  paths.isotint.sourceField.lab[0] = -1;
  assert.equal(paths.isotone.sourceField.lab[0], selected.lab[0]);
  paths.isotint.fullColorLab[0] = -1;
  assert.equal(paths.isotone.fullColorLab[0], circle[4].lab[0]);
});

test('continuous sources: white-free shadow ray and zero-ratio gray ray', () => {
  const whiteFree = OstwaldColor.harmonyPath('shadowSeries', 5, 0, 0.4);
  assert.equal(whiteFree.constraint.ratioStatus, 'white-free');
  assert.deepEqual(whiteFree.domain.start, { w: 0, s: 0, v: 1 });
  const gray = OstwaldColor.harmonyPath('shadowSeries', 5, 0.5, 0.5);
  assert.equal(gray.constraint.ratioStatus, 'finite');
  assert.deepEqual(gray.domain.start, { w: 1, s: 0, v: 0 });
  for (const path of [whiteFree, gray]) {
    OstwaldColor.sampleHarmonyPath(path, 5).forEach(sample => {
      validSample(sample);
      invariant(sample, 'shadowSeries', path.sourceField);
    });
  }
  assert.throws(() => OstwaldColor.harmonyPath('shadowSeries', 5, 0, 1), /pure-black.*0:0/);
  // Other relations remain well-defined at black; constant s=1 is a point.
  const black = OstwaldColor.harmonyPath('isotone', 5, 0, 1);
  OstwaldColor.sampleHarmonyPath(black, 3).forEach(sample => {
    assert.deepEqual(sample.rgb, [0, 0, 0]);
    validSample(sample);
  });
});

test('continuous sources: edges, corners and non-atlas inputs retain unlabeled status', () => {
  for (const [w, s] of [[0, 0], [1, 0], [0, 1], [0.4, 0], [0, 0.8], [0.25, 0.75], [0.123, 0.321]]) {
    for (const type of PATH_TYPES) {
      if (type === 'shadowSeries' && w === 0 && s === 1) continue;
      const path = OstwaldColor.harmonyPath(type, 5, w, s);
      assert.equal(path.sourceField.label, null);
      assert.equal(path.sourceField.source, 'interpolated');
      OstwaldColor.sampleHarmonyPath(path, 11).forEach(sample => {
        validSample(sample);
        invariant(sample, type, path.sourceField);
      });
    }
  }
  // A sample landing exactly on a real gray node still does not claim atlas provenance.
  const end = OstwaldColor.sampleHarmonyPath(OstwaldColor.harmonies(selected).paths.isotint, 2)[1];
  near(end.w, OstwaldColor.grayAxis()[4].w);
  assert.equal(end.label, null);
  assert.equal(end.source, 'interpolated');
});

test('harmonyPath: invalid type, hue, geometry and context rejected', () => {
  for (const type of ['', 'isochrome', null, undefined, 42]) {
    assert.throws(() => OstwaldColor.harmonyPath(type, 5, 0.2, 0.3), /path type/);
  }
  for (const hue of [0, 25, 5.5, '5', NaN]) {
    assert.throws(() => OstwaldColor.harmonyPath('isotint', hue, 0.2, 0.3), /hueIndex/);
  }
  for (const [w, s] of [[-0.1, 0], [0, -0.1], [0.8, 0.8], [NaN, 0], [0, Infinity]]) {
    assert.throws(() => OstwaldColor.harmonyPath('isotint', 5, w, s), Error);
  }
  for (const context of [null, [], { triangle }, { mode: 'rgb' }, { hueCircle: circle.slice(1) }]) {
    assert.throws(() => OstwaldColor.harmonyPath('isotint', 5, 0.2, 0.3, context), Error);
  }
});

test('sampleHarmonyPath: malformed counts and adulterated descriptors rejected', () => {
  const path = OstwaldColor.harmonies(selected).paths.shadowSeries;
  for (const count of [0, -1, 1.5, '3', null, undefined, NaN, Infinity, 2 ** 32]) {
    assert.throws(() => OstwaldColor.sampleHarmonyPath(path, count), /count/);
  }
  for (const invalid of [null, undefined, {}, [], 'shadowSeries']) {
    assert.throws(() => OstwaldColor.sampleHarmonyPath(invalid, 3), Error);
  }
  const mutations = [
    p => { p.type = 'invented'; }, p => { p.hueIndex = 0; },
    p => { p.fullColorLab = [0, 0]; }, p => { p.fullColorLab[0] = Infinity; },
    p => { p.fullColorLab[0] = 0.1; }, p => { p.sourceField.v = 0.9; },
    p => { p.sourceField.w = -0.1; }, p => { p.sourceField.rgb[0] = -1; },
    p => { p.sourceField.lab[0] = NaN; }, p => { p.sourceField.label = '5zz'; },
    p => { p.sourceField.source = 'invented'; }, p => { p.sourceField.hueIndex = 6; },
    p => { p.constraint.white = 0.8; }, p => { p.constraint.ratioStatus = 'white-free'; },
    p => { p.domain.start.w = -0.1; }, p => { p.domain.end.v = 0.3; },
    p => { p.domain.max = 2; }, p => { p.domain.parameter = 's'; },
    p => { delete p.constraint; }, p => { p.domain = []; }
  ];
  mutations.forEach(mutate => {
    const invalid = clone(path);
    mutate(invalid);
    assert.throws(() => OstwaldColor.sampleHarmonyPath(invalid, 3), Error);
  });
  const continuous = OstwaldColor.harmonyPath('isotint', 5, 0.123, 0.321);
  for (const key of ['w', 's', 'v']) {
    const invalid = clone(continuous);
    invalid.sourceField[key] = -0.01;
    assert.throws(() => OstwaldColor.sampleHarmonyPath(invalid, 3), Error);
  }
});

test('shadow grouping: all letter-index diagonals, all hues, exclude neighboring ratios', () => {
  const letters = OstwaldColor.letterScale().map(x => x.letter);
  for (let hue = 1; hue <= 24; hue++) {
    for (const field of OstwaldColor.triangle(hue)) {
      const distance = letters.indexOf(field.label.at(-2)) - letters.indexOf(field.label.at(-1));
      const expected = letters.slice(distance).map((white, blackIndex) => `${hue}${white}${letters[blackIndex]}`);
      assert.deepEqual(OstwaldColor.harmonies(field).shadowSeries.map(f => f.label), expected);
    }
  }
});

test('provenance: references, arbitrary mixtures and atlas fields stay distinguishable', () => {
  assert.ok(circle.every(hue => hue.source === 'reference' && hue.calibrated === false));
  const mixed = OstwaldColor.mix(circle[4].lab, selected.w, selected.s);
  assert.equal(mixed.source, 'interpolated');
  assert.equal(mixed.label, null);
  assert.ok(triangle.every(field => field.source === 'atlas'));
  // Phase-1 chromatic objects without a source property remain valid.
  const oldField = clone(selected);
  delete oldField.source;
  assert.deepEqual(OstwaldColor.harmonies(oldField), OstwaldColor.harmonies(selected));
  assert.throws(() => OstwaldColor.harmonies({ ...selected, source: 'interpolated' }), /atlas/);
  assert.throws(() => OstwaldColor.harmonies({ ...selected, label: '5aa' }), /grayAxis/);
});

console.log(`\n${passed} tests passed.`);
