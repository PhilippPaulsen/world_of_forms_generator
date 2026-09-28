import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
require('./build.js').build();
const {messages,t,DEFAULT_LOCALE}=await import('./i18n.mjs');
const {Engine,createState,transition,normalizeHue,fieldAt,registers,atlas,grays,hueHarmony,pathSamples,compoundExamples,relationFields}=await import('./state.mjs');
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
test('Initial selection uses explicit full-color home state and retains atlas anchor',()=>{
  const state=createState();assert.equal(state.activeView,'circle');assert.equal(state.displayMode,'atlas');
  assert.equal(state.selectedHue,1);assert.equal(state.selectedRegister,'ic');assert.equal(state.selectedField.label,null);assert.equal(state.selectedField.source,'reference');assert.equal(state.selectedField.v,1);
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
  for(const view of ['circle','triangle','register']){const result=step(original,'activeView',view);assert.equal(result.activeView,view);assert.deepEqual(result.selectedField,original.selectedField);}
  assert.equal(JSON.stringify(original),snapshot);
});
test('Atlas and continuum navigation preserves explicit samples without inventing notation',()=>{
  let state=step(createState(),'displayMode','continuum');state=step(state,'sample',17);
  assert.equal(state.selectedField.source,'interpolated');assert.equal(state.selectedField.label,null);
  assert.equal(state.selectedRegister,'ic');assert.equal(state.selectedHue,1);
  state=step(state,'activeView','triangle');assert.equal(state.selectedField.label,null);
  state=step(state,'displayMode','atlas');assert.equal(state.selectedField.label,null);assert.equal(state.selectedField.source,'interpolated');
});
test('All sample paths reuse engine colors and preserve unlabelled status',()=>{
  for(const relation of ['isotint','isotone','shadowSeries']){
    const state=step(createState(),'relation',relation),samples=pathSamples(state);assert.equal(samples.length,49);
    for(const sample of samples){assert.equal(sample.source,'interpolated');assert.equal(sample.label,null);assert.ok(Math.abs(sample.w+sample.s+sample.v-1)<1e-10);}
  }
});
test('Gray inspection keeps chromatic anchor for subsequent views',()=>{
  const state=step(step(createState(),'selectedHue',5),'gray','c');assert.equal(state.selectedField.label,'c');
  assert.equal(state.selectedHue,5);assert.equal(state.selectedRegister,'ic');for(const view of ['circle','triangle','register'])assert.equal(step(state,'activeView',view).selectedField.label,'c');assert.equal(step(state,'selectedHue',6).selectedField.source,'reference');assert.equal(step(state,'selectedHue',6).selectedField.hueIndex,6);
});
test('Cardinality updates use engine regular subdivisions and classification',()=>{
  for(const n of [2,3,4]){const harmony=hueHarmony(step(createState(),'harmonyMode',n));assert.equal(harmony.fields.length,n);assert.deepEqual(harmony.classification.gaps,Array(n).fill(24/n));}
});
test('Read-only compound examples preserve validated provenance and recursion',()=>{
  const examples=compoundExamples();assert.equal(examples.shared.relation,'shared-member');assert.equal(examples.substitution.relation,'substitution');assert.equal(Engine.compoundLevel(examples.recursive),3);
  for(const example of Object.values(examples))assert.deepEqual(Engine.flattenHarmonyMembers(example),example.members);
  const state=step(createState(),'harmonyExample','recursive');assert.equal(state.selectedHarmony.level,3);
  assert.equal(step(state,'harmonyMode',4).composition.activeHarmony.members.length,4);
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

const {fullColorAnchors,hueIdentity,HUE_MAPPINGS,maxChroma,fromLch,inGamut,mapToGamut}=await import('./FullColorCalibration.mjs');
const {MAPPINGS,DEFAULT_MAPPING,displayAttenuation,historicalToDisplay,grayDiagnostic}=await import('./DisplayCalibration.mjs');
const {views,selectionFields}=await import('./state.mjs');
test('Historical reflectance values and all engine fields remain unchanged after calibration',()=>{
  const expected=[.8913,.5623,.3548,.2239,.1413,.0891,.0562,.0355];
  assert.deepEqual(Engine.letterScale().map(x=>x.value),expected);
  const fields=[...atlas.flat(),...grays], before=JSON.stringify(fields);
  for(const mapping of MAPPINGS)for(const field of fields)historicalToDisplay(field,mapping);
  assert.equal(JSON.stringify(fields),before);
  assert.deepEqual(grays.map(x=>x.w),expected);
});
test('Comparison A exactly reproduces every Phase-6A atlas lab and RGB',()=>{
  for(const field of [...atlas.flat(),...grays]){
    const display=historicalToDisplay(field,'current');
    assert.deepEqual(display.lab,field.lab);assert.deepEqual(display.rgb,field.rgb);
  }
});
test('All four transfer functions are strictly monotonic with preserved endpoints',()=>{
  for(const mapping of MAPPINGS){
    assert.equal(displayAttenuation(0,mapping),0);assert.equal(displayAttenuation(1,mapping),1);
    let previous=-1;
    for(let i=0;i<=10000;i++){const value=displayAttenuation(i/10000,mapping);assert.ok(value>previous);previous=value;}
  }
});
test('Display gray neighbors are ordered and distinct after integer sRGB encoding',()=>{
  assert.equal(DEFAULT_MAPPING,'endpoint');
  for(const mapping of MAPPINGS){
    const rows=grayDiagnostic(mapping);
    assert.deepEqual(rows.map(x=>x.letter),['a','c','e','g','i','l','n','p']);
    for(let i=1;i<rows.length;i++){
      assert.ok(rows[i-1].displayLightness>rows[i].displayLightness);
      assert.ok(rows[i-1].rgb[0]>rows[i].rgb[0]);
      assert.ok(Math.abs(rows[i].deltaL-rows[i].deltaE)<1e-12);
    }
  }
  assert.ok(grayDiagnostic('logarithmic').at(-1).deltaL>grayDiagnostic('current').at(-1).deltaL);
});
test('Previous equal-spacing and soft-log comparisons retain their documented endpoints',()=>{
  const b=grayDiagnostic('perceptual'),c=grayDiagnostic('logarithmic');
  assert.equal(b[0].displayLightness,c[0].displayLightness);
  assert.ok(Math.abs(b[7].displayLightness-c[7].displayLightness)<1e-12);
  assert.ok(b.slice(1).every(x=>Math.abs(x.deltaL-b[1].deltaL)<1e-12));
  assert.ok(Math.abs(c[1].deltaL-c[7].deltaL)>.01);
});
test('Calibration applies to chromatic registers and preserves full anchors, hue direction and finite outputs',()=>{
  for(const hue of Engine.hueCircle()){
    const full={...Engine.mix(hue.lab,0,0),hueIndex:hue.index};assert.deepEqual(historicalToDisplay(full).lab,fullColorAnchors()[hue.index-1].lab);
    for(const register of ['ca','ic','pn']){
      const field=fieldAt(hue.index,register),display=historicalToDisplay(field);
      assert.ok(display.lab[0]>field.lab[0]);
      const calibrated=fullColorAnchors()[hue.index-1].lab;
      assert.ok(Math.abs(display.lab[1]*calibrated[2]-display.lab[2]*calibrated[1])<1e-12);
    }
  }
  for(const field of [...atlas.flat(),...grays])for(const mapping of MAPPINGS){
    const display=historicalToDisplay(field,mapping);
    assert.ok(display.lab.every(Number.isFinite));
    assert.ok(display.rgb.every(x=>Number.isInteger(x)&&x>=0&&x<=255));
  }
});
test('Display records never invent historical labels, including continuous black endpoints',()=>{
  for(const relation of ['isotint','isotone','shadowSeries'])for(const field of pathSamples(createState({relation}))){
    const before=JSON.stringify(field),display=historicalToDisplay(field);
    assert.equal(field.label,null);assert.equal(field.source,'interpolated');
    assert.equal('label' in display,false);assert.equal('source' in display,false);
    assert.equal(JSON.stringify(field),before);
  }
  const black=historicalToDisplay(Engine.mix([0,0,0],0,1));assert.deepEqual(black.rgb,[0,0,0]);
});
test('Invalid calibration requests fail explicitly',()=>{
  for(const bad of [-.01,1.01,NaN,Infinity,'0.5'])assert.throws(()=>displayAttenuation(bad));
  assert.throws(()=>displayAttenuation(.5,'unknown'));
  for(const bad of [null,{}, {...grays[0],w:-1}, {...grays[0],v:.5}, {...grays[0],lab:[NaN,0,0]}])assert.throws(()=>historicalToDisplay(bad));
});
test('Primary navigation is exactly three views; result expansion is independent',()=>{
  assert.deepEqual(views,['circle','triangle','register']);
  const state=step(createState(),'resultOpen',true);
  assert.equal(state.activeView,'circle');assert.equal(state.resultOpen,true);
  assert.throws(()=>step(state,'activeView','harmony'));assert.throws(()=>step(state,'resultOpen',1));
});
test('Explicit members persist across views; color edits replace one member instead of regenerating',()=>{
  let state=step(createState({selectedRegister:'ic'}),'selectedHue',5);assert.deepEqual(selectionFields(state).map(f=>f.label),['5ic']);
  state=step(state,'harmonyMode',3);
  for(const view of views){state=step(state,'activeView',view);assert.deepEqual(selectionFields(state).map(f=>f.label),['5ic','13ic','21ic']);}
  state=step(state,'selectedRegister','le');assert.deepEqual(selectionFields(state).map(f=>f.label),['5le','13ic','21ic']);
  state=step(state,'cell',{hue:24,register:'pn'});assert.deepEqual(selectionFields(state).map(f=>f.label),['24pn','13ic','21ic']);
  state=step(state,'harmonyMode',3);assert.deepEqual(selectionFields(state).map(f=>f.label),['24pn','8pn','16pn']);
});
test('Contextual relations and single gray/sample selections remain explicit persistent results',()=>{
  let state=createState({selectedHue:5,relation:'shadowSeries'});
  assert.equal(state.selectionKind,'relation');
  assert.deepEqual(new Set(relationFields(state).map(f=>f.label)),new Set(['5ga','5ic','5le','5ng','5pi']));
  for(const view of views)assert.deepEqual(selectionFields(step(state,'activeView',view)),selectionFields(state));
  state=step(state,'gray','p');assert.deepEqual(selectionFields(state),[grays[7]]);
  state=step(step(state,'displayMode','continuum'),'sample',15);
  assert.equal(selectionFields(state)[0].label,null);assert.equal(selectionFields(state).length,1);
});

test('Full-color candidates retain all hue identities and exact opposite index topology',()=>{
  for(const mapping of HUE_MAPPINGS){const anchors=fullColorAnchors(mapping);
    assert.equal(anchors.length,24);
    assert.deepEqual(anchors.map(x=>x.index),Array.from({length:24},(_,i)=>i+1));
    for(const anchor of anchors){
      assert.equal(Engine.hueDistance(anchor.index,normalizeHue(anchor.index+12)).minimal,12);
      assert.ok(anchor.lab.every(Number.isFinite));assert.ok(anchor.rgb.every(x=>Number.isInteger(x)&&x>=0&&x<=255));
      assert.equal(anchor.calibrated,false);assert.equal('referenceHue' in anchor,false);
    }
  }
});
test('Selected gamut-aware anchors use controlled radial chroma with bounded smooth lightness',()=>{
  const anchors=fullColorAnchors();
  for(let i=0;i<24;i++){
    const x=anchors[i];assert.ok(inGamut(x.lab));assert.ok(x.oklch[1]>.1);
    assert.ok(Math.abs(x.oklch[1]-.92*maxChroma(x.oklch[0],x.oklch[2]))<1e-12);
    assert.ok(Math.abs(x.oklch[0]-anchors[(i+1)%24].oklch[0])<.12);
  }
  assert.ok(fullColorAnchors('fixedHigh').some(x=>!x.inGamut));
  const snapshot=fullColorAnchors();snapshot[0].lab[0]=0;assert.notEqual(fullColorAnchors()[0].lab[0],0);
});
test('1921 p32 nomenclature maps all eight named groups and printed positions by ordinal index',()=>{
  const groups=['yellow','orange','red','violet','blue','iceBlue','seaGreen','leafGreen'];
  for(let i=1;i<=24;i++){
    const identity=hueIdentity(i);assert.equal(identity.nameKey,groups[Math.floor((i-1)/3)]);
    assert.equal(identity.ordinal,(i-1)%3+1);assert.equal(identity.sourceStatus,'primary-1921-p32');
  }
  for(const [i,printed] of [[1,'00'],[7,'25'],[13,'50'],[19,'75']])assert.equal(hueIdentity(i).printed,printed);
  for(const x of [0,25,1.1,NaN])assert.throws(()=>hueIdentity(x));
});
test('Radial gamut mapping preserves L and hue, reports correction and rejects invalid input',()=>{
  const input=fromLch(.7,.4,40),mapped=mapToGamut(input);
  assert.equal(mapped.gamutMapped,true);assert.equal(mapped.rawInGamut,false);assert.ok(inGamut(mapped.lab));
  assert.equal(mapped.lab[0],input[0]);assert.ok(Math.abs(mapped.lab[1]*input[2]-mapped.lab[2]*input[1])<1e-12);
  assert.deepEqual(mapToGamut([.5,0,0]).lab,[.5,0,0]);
  for(const x of [[-1,0,0],[2,0,0],[NaN,0,0],[]])assert.throws(()=>mapToGamut(x));
  assert.throws(()=>fullColorAnchors('unknown'));assert.throws(()=>maxChroma(-1,0));
});
test('Every atlas mixture is in gamut after display mapping, including all dark n/p registers',()=>{
  let mapped=0;
  for(const field of atlas.flat()){
    const display=historicalToDisplay(field);assert.ok(inGamut(display.lab));mapped+=Number(display.gamutMapped);
  }
  assert.ok(mapped>0,'Regression exercises mapping, not just already-in-gamut inputs');
  for(const register of ['nl','pn'])assert.equal(new Set(atlas.map((_,i)=>historicalToDisplay(fieldAt(i+1,register)).rgb.join(','))).size,24);
});
test('Endpoint gray mapping separates vertices and strongly reduces adjacent distance imbalance',()=>{
  const original=grayDiagnostic('logarithmic'),rows=grayDiagnostic('endpoint');
  assert.ok(Math.abs(rows[0].lab[0]-.99)<1e-12);assert.ok(Math.abs(rows[7].lab[0]-.08)<1e-12);
  assert.ok(rows[0].rgb[0]<255&&rows[0].rgb[0]>=250);assert.ok(rows[7].rgb[0]>0&&rows[7].rgb[0]<=3);
  const imbalance=xs=>Math.max(...xs.slice(1).map(x=>x.deltaE))/Math.min(...xs.slice(1).map(x=>x.deltaE));
  assert.ok(imbalance(rows)<1.01);assert.ok(imbalance(rows)<imbalance(original));
  assert.ok(rows[6].rgb[0]-rows[7].rgb[0]>=20);
});
test('White/black UI relations preserve their own coefficients at every register and hue',()=>{
  for(const field of atlas.flat())for(const [relation,key] of [['isotint','w'],['isotone','s']]){
    const state=createState({selectedHue:field.hueIndex,selectedRegister:field.label.replace(/^\d+/,''),relation});
    const members=relationFields(state);assert.ok(members.length>0);
    assert.ok(members.every(x=>Math.abs(x[key]-field[key])<1e-10));
  }
  assert.equal(t('isotint'),'Weiß · Gleicher Weißanteil');assert.equal(t('isotone'),'Schwarz · Gleicher Schwarzanteil');
});
test('Shared register navigation visits all 28 circles, stops at endpoints and preserves hue/chord/mode',()=>{
  let state=createState({selectedHue:5,harmonyMode:3});const visited=[];
  for(let i=0;i<28;i++){
    state=step(state,'nextRegister');visited.push(state.selectedRegister);
    assert.equal(state.selectedHue,5);assert.equal(state.harmonyMode,3);assert.equal(state.displayMode,'atlas');
    assert.equal(selectionFields(state).length,3);
  }
  assert.deepEqual(visited,registers);assert.deepEqual(step(state,'nextRegister'),state);
  for(let i=0;i<28;i++)state=step(state,'previousRegister');
  assert.equal(state.circleMode,'reference');assert.equal(state.selectedField.label,null);
  assert.deepEqual(step(state,'previousRegister'),state);
});
test('Shared hue navigation wraps all 24 triangles while preserving register and display state',()=>{
  let state=createState({selectedRegister:'pn',activeView:'triangle',harmonyMode:4,displayMode:'continuum'});
  const visited=[];
  for(let i=0;i<24;i++){visited.push(state.selectedHue);state=step(state,'nextHue');assert.equal(state.selectedRegister,'pn');assert.equal(state.displayMode,'continuum');assert.equal(state.harmonyMode,4);}
  assert.deepEqual(visited,Array.from({length:24},(_,i)=>i+1));assert.equal(state.selectedHue,1);
  assert.equal(step(state,'previousHue').selectedHue,24);
});
test('One home action restores reference circle without resetting hue, chord, locale or display preference',()=>{
  let state=createState({selectedHue:17,selectedRegister:'pn',activeView:'triangle',harmonyMode:4,displayMode:'continuum',locale:'en'});
  state=step(state,'goToDefaultCircle');assert.equal(state.activeView,'circle');assert.equal(state.circleMode,'reference');
  assert.equal(state.selectedHue,17);assert.equal(state.selectedRegister,'pn');assert.equal(state.harmonyMode,4);assert.equal(state.displayMode,'continuum');assert.equal(state.locale,'en');
  const fields=selectionFields(state);assert.equal(fields.length,4);assert.ok(fields.every(x=>x.source==='atlas'&&x.label.endsWith('pn')));
});
test('Register CSS separates square contiguous atlas geometry from rounded controls',()=>{
  const css=require('node:fs').readFileSync(new URL('./styles.css',import.meta.url),'utf8');
  assert.match(css,/\.register-grid \{ border-collapse:collapse; border-spacing:0;/);
  assert.match(css,/\.register-grid \.grid-swatch \{ border-radius:0; border:0; margin:0;/);
  assert.match(css,/border-radius:4px/);
});
console.log(`\n${passed} UI test groups passed.`);
