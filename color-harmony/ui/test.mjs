import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
require('./build.js').build();
const {messages,t,DEFAULT_LOCALE}=await import('./i18n.mjs');
const {Engine,createState,transition,normalizeHue,fieldAt,registers,atlas,grays,hueHarmony,pathSamples,compoundExamples}=await import('./state.mjs');
const CJS=require('../ColorHarmonyEngine.js');
let passed=0;
function test(name,run){run();passed++;console.log(`ok ${passed} - ${name}`);}
const step=(state,type,value)=>transition(state,{type,value});
test('Bilingual dictionary is complete; German default; missing keys fail explicitly',()=>{
  assert.equal(DEFAULT_LOCALE,'de');assert.equal(t('circle'),'Kreis');assert.equal(t('circle','en'),'Circle');
  for(const pair of Object.values(messages))for(const locale of ['de','en'])assert.ok(typeof pair[locale]==='string'&&pair[locale].length>0);
  for(const key of ['circle','triangle','register','harmony','complementary','three','four','triad','tetrad','white','black','shadow','value','gray','atlas','continuum','compound','shared','substitution','level','info','noAtlas'])assert.ok(messages[key]);
  assert.throws(()=>t('missing'));assert.throws(()=>t('circle','fr'));
});
test('Browser adapter is behaviorally identical to CommonJS engine',()=>{
  assert.deepEqual(Engine.hueCircle(),CJS.hueCircle());assert.deepEqual(Engine.triangle(5),CJS.triangle(5));
  assert.deepEqual(Engine.harmonies(fieldAt(5,'ic')),CJS.harmonies(fieldAt(5,'ic')));
  assert.deepEqual(Engine.intervalTable1921(),CJS.intervalTable1921());
});
test('Initial selection matches required state and actual atlas color',()=>{
  const state=createState();assert.equal(state.activeView,'circle');assert.equal(state.displayMode,'atlas');
  assert.equal(state.selectedHue,1);assert.equal(state.selectedRegister,'ic');assert.equal(state.selectedField.label,'1ic');
  assert.equal(state.harmonyMode,3);assert.equal(state.inspectorOpen,false);
});
test('Hue normalization handles cyclic and safe integer boundaries',()=>{
  for(const [input,expected] of [[1,1],[24,24],[25,1],[0,24],[-1,23],[-24,24],[49,1]])assert.equal(normalizeHue(input),expected);
  for(const n of [Number.MAX_SAFE_INTEGER,Number.MIN_SAFE_INTEGER])assert.ok(normalizeHue(n)>=1&&normalizeHue(n)<=24);
  for(const bad of [NaN,Infinity,'1',1.1,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>normalizeHue(bad));
});
test('Hue and register selections synchronize while preserving the other coordinate',()=>{
  let state=step(createState(),'selectedHue',5);state=step(state,'selectedRegister','le');
  assert.equal(state.selectedField.label,'5le');state=step(state,'selectedHue',30);assert.equal(state.selectedField.label,'6le');
  state=step(state,'cell',{hue:13,register:'ic'});assert.equal(state.selectedField.label,'13ic');
});
test('All 672 cells resolve through the engine with eight nonduplicated grays',()=>{
  assert.equal(registers.length,28);assert.equal(new Set(registers).size,28);
  let count=0;for(let hue=1;hue<=24;hue++)for(const register of registers){const field=fieldAt(hue,register);assert.ok(field.v>0);assert.equal(field.label,`${hue}${register}`);count++;}
  assert.equal(count,672);assert.equal(grays.length,8);assert.ok(grays.every(g=>!('hueIndex'in g)));
});
test('View switches preserve selected color and register without mutating input',()=>{
  const original=step(createState(),'cell',{hue:5,register:'ng'});const snapshot=JSON.stringify(original);
  for(const view of ['circle','triangle','register','harmony']){const result=step(original,'activeView',view);assert.equal(result.activeView,view);assert.deepEqual(result.selectedField,original.selectedField);}
  assert.equal(JSON.stringify(original),snapshot);
});
test('Atlas and continuum transitions clear samples without generating atlas notation',()=>{
  let state=step(createState(),'displayMode','continuum');state=step(state,'sample',17);
  assert.equal(state.selectedField.source,'interpolated');assert.equal(state.selectedField.label,null);
  assert.equal(state.selectedRegister,'ic');assert.equal(state.selectedHue,1);
  state=step(state,'activeView','triangle');assert.equal(state.selectedField.label,null);
  state=step(state,'displayMode','atlas');assert.equal(state.selectedField.label,'1ic');
});
test('All sample paths reuse engine colors and preserve unlabelled status',()=>{
  for(const relation of ['isotint','isotone','shadowSeries']){
    const state=step(createState(),'relation',relation),samples=pathSamples(state);assert.equal(samples.length,49);
    for(const sample of samples){assert.equal(sample.source,'interpolated');assert.equal(sample.label,null);assert.ok(Math.abs(sample.w+sample.s+sample.v-1)<1e-10);}
  }
});
test('Gray inspection keeps chromatic anchor for subsequent views',()=>{
  const state=step(step(createState(),'selectedHue',5),'gray','c');assert.equal(state.selectedField.label,'c');
  assert.equal(state.selectedHue,5);assert.equal(state.selectedRegister,'ic');assert.equal(step(state,'selectedHue',6).selectedField.label,'6ic');
});
test('Cardinality updates use engine regular subdivisions and classification',()=>{
  for(const n of [2,3,4]){const harmony=hueHarmony(step(createState(),'harmonyMode',n));assert.equal(harmony.fields.length,n);assert.deepEqual(harmony.classification.gaps,Array(n).fill(24/n));}
});
test('Read-only compound examples preserve validated provenance and recursion',()=>{
  const examples=compoundExamples();assert.equal(examples.shared.relation,'shared-member');assert.equal(examples.substitution.relation,'substitution');assert.equal(Engine.compoundLevel(examples.recursive),3);
  for(const example of Object.values(examples))assert.deepEqual(Engine.flattenHarmonyMembers(example),example.members);
  const state=step(createState(),'harmonyExample','recursive');assert.equal(state.selectedHarmony.level,3);
  assert.equal(step(state,'harmonyMode',4).selectedHarmony,null);
});
test('Locale and inspector transitions do not affect analytical coordinates',()=>{
  const before=createState(),after=step(step(before,'locale','en'),'inspectorOpen',true);
  assert.equal(after.locale,'en');assert.equal(after.inspectorOpen,true);assert.deepEqual(before.selectedField,after.selectedField);
});
test('Invalid state input is rejected without silent corrections',()=>{
  for(const [type,value] of [['selectedRegister','zz'],['activeView','unknown'],['displayMode','rgb'],['harmonyMode',5],['locale','fr'],['relation','unknown'],['gray','b'],['sample',1],['inspectorOpen','yes'],['harmonyExample','edit'],['unknown',0],['cell',{hue:5,register:'zz'}]])assert.throws(()=>step(createState(),type,value));
  assert.throws(()=>step(step(createState(),'displayMode','continuum'),'sample',-1));
});
test('Isovalence never silently falls back to an unrelated continuous path',()=>{
  const state=step(step(createState(),'displayMode','continuum'),'relation','isovalent');
  assert.deepEqual(pathSamples(state),[]);assert.throws(()=>step(state,'sample',1));
});
test('Scientific disclosure remains explicit shared UI state',()=>{
  const state=step(createState(),'detailOpen',true);assert.equal(step(state,'selectedHue',5).detailOpen,true);
  assert.throws(()=>step(state,'detailOpen',1));
});
console.log(`\n${passed} UI test groups passed.`);
