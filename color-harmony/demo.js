'use strict';

const OstwaldColor = require('./ColorHarmonyEngine.js');
const hueCircle = OstwaldColor.hueCircle();
const triangle = OstwaldColor.triangle(5);
const selected = triangle.find(field => field.label === '5ic');
const harmonies = OstwaldColor.harmonies(selected, { hueCircle, triangle });
const grays = OstwaldColor.grayAxis();

console.log(`Atlas: ${hueCircle.length} × ${triangle.length} = ${hueCircle.length * triangle.length} chromatic colors + ${grays.length} shared grays`);
console.log('Contemporary, uncalibrated Oklab display colors');
function printColor(field) {
  const ratio = field.w > 0 ? (field.v / field.w).toFixed(6) : 'undefined (w=0)';
  console.log(`[${field.source}] ${field.label === null ? 'label=null' : field.label} ` +
    `w=${field.w.toFixed(4)} s=${field.s.toFixed(4)} v=${field.v.toFixed(4)} v/w=${ratio} ` +
    `rgb=${JSON.stringify(field.rgb)} lab=${JSON.stringify(field.lab)}`);
}
function printFields(title, fields) {
  console.log(`\n${title}:`);
  if (fields.length === 0) console.log('(no other atlas nodes; the continuous path still exists)');
  fields.forEach(printColor);
}
printFields('Selected field', [selected]);
printFields('Weißgleiche', harmonies.isotints);
printFields('Schwarzgleiche', harmonies.isotones);
printFields('Analytical Reingleiche (constant v)', harmonies.analyticIsochromes);
printFields('Schattenreihe (rounded constant v/w)', harmonies.shadowSeries);
console.log('\nWertgleiche summary:');
console.log(`[atlas] ${harmonies.isovalent.length} hues at the same w/s/v: ` + harmonies.isovalent.map(f => f.label).join(', '));
printFields('Gray companion: same white', [harmonies.grayHarmonies.sameWhite]);
printFields('Gray companion: same black', [harmonies.grayHarmonies.sameBlack]);
const titles = { complementary: 'Complement', triad: 'Triad', tetrad: 'Tetrad' };
for (const harmony of harmonies.hueHarmonies) printFields(titles[harmony.type], harmony.fields);
printFields('Sampled continuous shadow path', OstwaldColor.sampleHarmonyPath(harmonies.paths.shadowSeries, 5));
console.log('The black limit endpoint has v=w=0: v/w is undefined, not a different shadow ratio.');

console.log('\nMathematical generalization: regular subdivisions of 5ic');
for (const parts of [2, 3, 4, 6]) {
  const result = OstwaldColor.regularHueSubdivision(selected, parts);
  console.log(`${result.historicalName || 'generic subdivision'}: parts=${parts}, step=${result.step}, ` +
    `historicalStatus=${result.historicalStatus}; all positions: ` + result.fields.map(f => f.label).join(', '));
}
console.log('\nHistorical data: primary 1921 musical distance analogy (separate from grammar)');
const table1921 = OstwaldColor.intervalTable1921();
console.log(`${table1921.entries.length} distance rows; ${table1921.sourceStatus}; primaryVerified=${table1921.primaryVerified}`);
console.log(`Octave analogy: distance ${table1921.reference.distance}; color entry ${table1921.reference.colorEntry}`);
for (const entry of table1921.entries) {
  console.log(`distance ${entry.distance}, printed ${entry.colorEntries.join(' / ')}: ${entry.interval} (${entry.german}), historical consonant=${entry.consonant}`);
}
console.log('Historical consonant distance analogy:', JSON.stringify(OstwaldColor.intervalRelation1921(1, 4).entry));
console.log('Historical non-consonant marking:', JSON.stringify(OstwaldColor.intervalRelation1921(1, 2).entry));
console.log('\nMathematical generalization: neutral distance and equal-spacing detection');
console.log('hueDistance(23,1):', JSON.stringify(OstwaldColor.hueDistance(23, 1)));
console.log('isRegularHueSet([1,9,17]):', OstwaldColor.isRegularHueSet([1, 9, 17]));
console.log('isRegularHueSet([1,5,12]):', OstwaldColor.isRegularHueSet([1, 5, 12]));
console.log('Generic gray selection (no historical validity claim):',
  OstwaldColor.selectSeriesInterval(grays, { start: 1, step: 2, count: 3 }).map(gray => gray.letter).join(', '));


console.log('\nPhase 4: hue grammar in register ic');
for (const hues of [OstwaldColor.dyadsByDistance(1)[0], OstwaldColor.dyadsByDistance(12)[0],
    [1,3,8], [1,9,17], [1,3,5,7], [1,7,13,19]]) {
  const set = OstwaldColor.classifyHueSet(hues);
  const label = set.historicalName ? 'PRIMARY-SOURCE NAMED CLASS' : 'STRUCTURAL / MATHEMATICAL CLASSIFICATION';
  console.log(`[${label}] ${set.className}: ${set.historicalName || 'unnamed'} ` +
    `hues=${set.hues} gaps=${set.gaps} symmetry=${set.symmetry}`);
  console.log('  [atlas]', set.hues.map(hue => harmonies.isovalent[hue-1].label).join(', '));
}
console.log('PRIMARY-SOURCE CONSTRUCTION: division of historical 08–25',
  JSON.stringify(OstwaldColor.divideHueDyad([3,7])));
console.log('PRIMARY-SOURCE CONSTRUCTION: symmetric split retaining its own provenance',
  JSON.stringify(OstwaldColor.splitHueSet([1,13],13,4)));
for (const [family,series,indices] of [
  ['shadow-series',harmonies.shadowSeries,[0,2,4]],
  ['isotint',triangle.filter(f=>f.w===selected.w),[0,1,2]],
  ['isotone',triangle.filter(f=>f.s===selected.s),[0,1,2]]
]) {
  const result=OstwaldColor.seriesHarmony(series,family,indices);
  console.log(`[STRUCTURAL / MATHEMATICAL CLASSIFICATION] ${family}: ` +
    `linear indices=${result.indices}, gaps=${result.gapsOrSteps}, no cyclic closing gap`);
  console.log('  [atlas]',result.fields.map(f=>f.label).join(', '));
}
