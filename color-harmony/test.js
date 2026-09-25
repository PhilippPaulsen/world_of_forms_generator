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

test('triangle: 36 discrete valid fields per hue and deterministic letter ordering', () => {
  const letters = ['a', 'c', 'e', 'g', 'i', 'l', 'n', 'p'];
  for (let hue = 1; hue <= 24; hue++) {
    const fields = OstwaldColor.triangle(hue);
    assert.equal(fields.length, 36);
    fields.forEach(complete);
    assert.equal(fields.filter(f => Math.abs(f.v) < 1e-10).length, 8);
    assert.deepEqual(fields.map(f => f.label), letters.flatMap((white, i) =>
      letters.slice(0, i + 1).map(black => `${hue}${white}${black}`)));
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
    for (const [key, share] of [['isotints', 'w'], ['isotones', 's'], ['shadowSeries', 'v']]) {
      const expected = triangle.filter(f => f.label !== field.label && Math.abs(f[share] - field[share]) <= 1e-10);
      assert.deepEqual(harmony[key], expected);
      harmony[key].forEach(f => { complete(f); near(f[share], field[share]); });
    }
  }
  const harmony = OstwaldColor.harmonies(selected);
  assert.equal(harmony.isotints.length, 4);
  assert.equal(harmony.isotones.length, 6);
  assert.deepEqual(harmony.shadowSeries, []);
  const neutral = triangle.find(f => f.label === '5aa');
  assert.equal(OstwaldColor.harmonies(neutral).shadowSeries.length, 7);
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
  const field = { ...selected, ...OstwaldColor.mix(custom[4].lab, selected.w, selected.s) };
  const result = OstwaldColor.harmonies(field, { hueCircle: custom });
  assert.equal(result.isotints.length, 4);
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

console.log(`\n${passed} tests passed.`);
