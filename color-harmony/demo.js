'use strict';

const OstwaldColor = require('./ColorHarmonyEngine.js');
const hueCircle = OstwaldColor.hueCircle();
const triangle = OstwaldColor.triangle(5);
const selected = triangle.find(field => field.label === '5ic');
const harmonies = OstwaldColor.harmonies(selected, { hueCircle, triangle });

console.log(`Contemporary Oklab references: ${hueCircle.length}; Hue 5 fields: ${triangle.length}`);
console.log('\nSelected:\n' + selected.label);
for (const key of ['w', 's', 'v', 'rgb', 'lab']) {
  console.log(`${key}: ${JSON.stringify(selected[key])}`);
}
function printFields(title, fields) {
  console.log(`\n${title}:`);
  if (fields.length === 0) console.log('(no other discrete fields at this value)');
  for (const field of fields) console.log(JSON.stringify(field));
}
printFields('Isotints', harmonies.isotints);
printFields('Isotones', harmonies.isotones);
printFields('Isochrome', harmonies.shadowSeries);
console.log('\nHue harmonies:');
const titles = { complementary: 'Complementary', triad: 'Triad', tetrad: 'Tetrad' };
for (const harmony of harmonies.hueHarmonies) printFields(titles[harmony.type], harmony.fields);
