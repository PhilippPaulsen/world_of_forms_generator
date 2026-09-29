import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
createRequire(import.meta.url)('./build.js').build();
const {Engine,createState,transition,fieldAt,registers,grays,views,relations,relationFields}=await import('./state.mjs');
const {createComposition,reduceComposition,memberIdentity,activeColor,fullColor,seriesMembers}=await import('./composition.mjs');
const {createHarmonySelection,toDisplayColors,createHarmonyTransfer,HARMONY_SELECTION_EVENT}=await import('./HarmonySelection.mjs');
const {historicalToDisplay}=await import('./DisplayCalibration.mjs');
const {Navigator}=await import('./components/Navigator.mjs');
const {Toolbar,RelationControls}=await import('./components/Toolbar.mjs');
const {Inspector}=await import('./components/Inspector.mjs');
const {TriangleView}=await import('./views/TriangleView.mjs');
let passed=0;
const test=(name,run)=>{run();console.log(`ok ${++passed} - ${name}`);};
const step=(s,type,value)=>transition(s,{type,value});
const seeded=()=>step(createState(),'cell',{hue:5,register:'ic'});
const generated=n=>step(seeded(),'harmonyMode',n);
const keys=s=>s.composition.activeHarmony.members.map(memberIdentity);
const navigation=s=>[s.activeView,s.selectedHue,s.selectedRegister,s.circleMode];

for(const n of [2,3,4])test(`${n} toggles off to the active member without losing navigation; undo restores it`,()=>{
  let s=step(generated(n),'setActiveMember',1);s=step(step(s,'nextHue'),'nextRegister');
  const before=s,next=step(s,'harmonyMode',n);
  assert.deepEqual(keys(next),[memberIdentity(activeColor(before.composition))]);
  assert.equal(next.circleRelation,null);assert.deepEqual(navigation(next),navigation(before));
  assert.deepEqual(step(next,'undoComposition').composition.activeHarmony,before.composition.activeHarmony);
});
test('Switching cardinality keeps exactly one circle relation; API generation remains explicit',()=>{
  let s=createState();assert.equal(s.circleRelation,null);
  for(const n of [2,3,4,3,2]){s=step(s,'harmonyMode',n);assert.equal(s.circleRelation,n);assert.equal(keys(s).length,n);}
  s=step(s,'generateHarmony',2);assert.equal(keys(s).length,2);assert.equal(s.circleRelation,2);
});
for(const relation of relations)test(`${relation} preview toggles independently without composition/history changes`,()=>{
  const initial=generated(3),preview=step(initial,'relation',relation),off=step(preview,'relation',relation);
  assert.equal(preview.seriesRelation,relation);assert.equal(off.seriesRelation,null);
  assert.equal(preview.circleRelation,3);assert.equal(off.composition,initial.composition);
  assert.deepEqual(navigation(off),navigation(initial));
});
test('Switching series only changes one preview, and switching circle relation preserves that preview',()=>{
  let s=generated(3);
  for(const relation of relations){s=step(s,'relation',relation);assert.equal(s.seriesRelation,relation);assert.equal(s.circleRelation,3);}
  s=step(s,'harmonyMode',4);assert.equal(s.seriesRelation,'isovalent');assert.equal(s.circleRelation,4);
});
test('Independent hue and engine-order register navigation preserve all explicit members in every view',()=>{
  for(const view of views){
    let s=step(step(step(generated(4),'relation','shadowSeries'),'activeView',view),'setActiveMember',1);
    const before=s.composition,register=s.selectedRegister,hue=s.selectedHue;
    s=step(s,'nextHue');assert.equal(s.selectedHue,hue%24+1);assert.equal(s.selectedRegister,register);
    s=step(s,'nextRegister');assert.equal(s.selectedRegister,registers[registers.indexOf(register)+1]);
    assert.equal(s.composition,before);assert.equal(s.circleRelation,4);assert.equal(s.seriesRelation,'shadowSeries');
    for(let i=0;i<23;i++)s=step(s,'nextHue');assert.equal(s.selectedHue,hue);
  }
});
test('View switches retain active index, both relation families, hue, register and reference context',()=>{
  for(const original of [step(step(generated(3),'setActiveMember',1),'relation','isotint'),step(createState(),'relation','isotone')]){
    let s=original;
    for(const view of ['triangle','register','circle']){
      s=step(s,'activeView',view);assert.equal(s.composition,original.composition);
      for(const key of ['selectedHue','selectedRegister','circleMode','circleRelation','seriesRelation'])assert.equal(s[key],original[key]);
    }
  }
});
test('Full-color home is one action and compact navigator traverses all 28 actual register positions',()=>{
  let s=step(generated(3),'goToDefaultCircle');const before=s.composition;
  assert.equal(s.circleMode,'reference');
  for(const register of registers){s=step(s,'nextRegister');assert.equal(s.selectedRegister,register);assert.equal(s.composition,before);}
  assert.deepEqual(step(s,'nextRegister'),s);
  s=step(s,'goToDefaultCircle');assert.equal(s.circleMode,'reference');assert.equal(s.composition,before);
});
for(const relation of relations)test(`${relation} can become Active Harmony, retaining engine order and undoing exactly`,()=>{
  const original=step(generated(3),'setActiveMember',1),preview=step(original,'relation',relation);
  const fields=relationFields(preview),adopted=step(preview,'adoptRelation');
  assert.deepEqual(keys(adopted),fields.map(memberIdentity));assert.equal(adopted.circleRelation,null);
  assert.equal(adopted.seriesRelation,relation);assert.equal(adopted.composition.activeHarmony.source,'series');
  assert.equal(memberIdentity(activeColor(adopted.composition)),memberIdentity(fieldAt(preview.selectedHue,preview.selectedRegister)));
  assert.deepEqual(navigation(adopted),navigation(preview));
  const undo=step(step(adopted,'nextHue'),'undoComposition');
  assert.deepEqual(undo.composition.activeHarmony,original.composition.activeHarmony);
  assert.equal(undo.circleRelation,3);assert.equal(undo.selectedHue,adopted.selectedHue%24+1);
  assert.deepEqual(step(undo,'redoComposition').composition.activeHarmony,adopted.composition.activeHarmony);
});
test('5ic shadow adoption preserves canonical light-to-dark series and clicked-member identity',()=>{
  const preview=step(seeded(),'relation','shadowSeries'),s=step(preview,'adoptRelation','atlas:5ng');
  assert.deepEqual(keys(s),['5ga','5ic','5le','5ng','5pi'].map(x=>'atlas:'+x));
  assert.equal(s.composition.activeHarmony.activeMemberIndex,3);
  assert.ok(s.composition.activeHarmony.series.rule.sourcePages.length);
});
test('Single-node series and invalid adoption are explicit; no source is silently converted to atlas',()=>{
  const s=step(step(createState(),'cell',{hue:5,register:'ca'}),'relation','isotint');
  assert.equal(step(s,'adoptRelation').composition.activeHarmony.members.length,1);
  assert.throws(()=>step(seeded(),'adoptRelation'));
  assert.throws(()=>step(s,'adoptRelation','atlas:5ic'));
  for(const field of [fullColor(5),grays[0],{hueIndex:5,...Engine.mix(Engine.hueCircle()[4].lab,.2,.3)}])assert.throws(()=>seriesMembers(field,'isotint'));
  assert.throws(()=>seriesMembers(fieldAt(5,'ic'),'unknown'));
});
test('Single atlas selection serializes with analytical, historical and calibrated display coordinates',()=>{
  const c=seeded().composition,s=createHarmonySelection(c),field=activeColor(c),display=historicalToDisplay(field);
  assert.equal(s.version,1);assert.equal(s.source,'farborgel');assert.equal(s.members.length,1);
  const m=s.members[0];assert.equal(m.identity,'atlas:5ic');assert.equal(m.sourceType,'atlas');
  assert.equal(m.historicalCoordinate.label,'5ic');assert.equal(m.historicalCoordinate.hueIndex,5);
  assert.deepEqual(m.oklab,field.lab);assert.deepEqual(m.displayOklab,display.lab);assert.deepEqual(m.srgb,display.rgb);
  assert.deepEqual(m.displayColor,{space:'srgb',channels:display.rgb});assert.equal(s.classification.cardinality,1);
  assert.deepEqual(JSON.parse(JSON.stringify(s)),s);assert.equal(s.provenance.status,'selected');
});
for(const n of [2,3,4])test(`${n}-member transfer keeps ordered register, classification and active index`,()=>{
  const c=step(generated(n),'setActiveMember',1).composition,s=createHarmonySelection(c);
  assert.equal(s.members.length,n);assert.equal(s.activeMemberIndex,1);
  assert.deepEqual(s.members.map(m=>m.identity),c.activeHarmony.members.map(memberIdentity));
  assert.deepEqual(s.classification.gapSignature,Array(n).fill(24/n));assert.ok(s.classification.historicalName);
  assert.deepEqual(s.provenance.group,c.activeHarmony.group);assert.deepEqual(s.provenance.construction,c.activeHarmony.construction);
});
test('Gray transfer uses shared letter and no fabricated hue identity',()=>{
  const m=createHarmonySelection(createComposition(grays[2])).members[0];
  assert.equal(m.identity,'gray:e');assert.equal(m.sourceType,'gray');assert.equal(m.historicalCoordinate.letter,'e');
  assert.equal(m.historicalCoordinate.hueIndex,null);assert.equal(m.analyticalCoordinate.v,0);
});
test('Full-color transfer retains non-atlas source, coordinates and calibrated display realization',()=>{
  const s=createHarmonySelection(createComposition(fullColor(5))),m=s.members[0];
  assert.equal(m.identity,'full-color:5');assert.equal(m.sourceType,'full-color');assert.equal(m.historicalCoordinate,null);
  assert.deepEqual(m.analyticalCoordinate,{hueIndex:5,v:1,w:0,s:0});
  assert.deepEqual(m.srgb,historicalToDisplay(fullColor(5)).rgb);assert.equal(s.displayModel.historicallyCalibrated,false);
});
test('Interpolation keeps exact stable identity and never acquires a historical label at coincident atlas coordinates',()=>{
  const atlas=fieldAt(5,'ic'),f={hueIndex:5,...Engine.mix(Engine.hueCircle()[4].lab,atlas.w,atlas.s)};
  const m=createHarmonySelection(createComposition(f)).members[0];
  assert.equal(m.sourceType,'interpolated');assert.equal(m.historicalCoordinate,null);assert.equal(m.identity,memberIdentity(f));
  assert.notEqual(m.identity,memberIdentity(atlas));
});
test('Recursive compound provenance is preserved independently, with flattening order intact',()=>{
  let s=generated(3);
  for(let i=0;i<2;i++)s=step(step(s,'beginSubstitution'),'applySubstitution',0);
  const selection=createHarmonySelection(s.composition);
  assert.equal(selection.provenance.group.level,3);assert.equal(selection.classification.compound,true);
  assert.deepEqual(selection.provenance.group,s.composition.activeHarmony.group);
  assert.deepEqual(selection.members.map(m=>m.identity),Engine.flattenHarmonyMembers(selection.provenance.group).map(memberIdentity));
  selection.provenance.group.groups.length=0;assert.ok(s.composition.activeHarmony.group.groups.length>0);
});
test('Manual compound edits transfer the previous tree without claiming current compound status',()=>{
  let s=step(step(generated(3),'beginSubstitution'),'applySubstitution',0),tree=s.composition.activeHarmony.group;
  s=step(s,'cell',{hue:20,register:'pn'});const selection=createHarmonySelection(s.composition);
  assert.equal(selection.provenance.status,'manual');assert.equal(selection.classification.compound,false);
  assert.deepEqual(selection.provenance.previousStructure,tree);
});
test('Adopted series transfer includes relation, actual anchor and existing rule evidence',()=>{
  const c=step(step(seeded(),'relation','shadowSeries'),'adoptRelation').composition,s=createHarmonySelection(c);
  assert.equal(s.provenance.status,'series');assert.equal(s.provenance.series.relation,'shadowSeries');
  assert.equal(s.provenance.series.anchor.label,'5ic');assert.deepEqual(s.provenance.series.rule,c.activeHarmony.series.rule);
});
test('Serialization is deterministic and detached from state and prior transfer records',()=>{
  const c=generated(3).composition,before=JSON.stringify(c),one=createHarmonySelection(c),two=createHarmonySelection(c);
  assert.equal(JSON.stringify(one),JSON.stringify(two));
  one.members[0].srgb[0]=0;one.members[0].analyticalCoordinate.w=0;one.classification.gapSignature[0]=0;
  assert.equal(JSON.stringify(c),before);assert.deepEqual(two,createHarmonySelection(c));
});
test('Display accessors preserve deterministic order and return independent valid RGB byte triples',()=>{
  const s=createHarmonySelection(generated(4).composition),colors=toDisplayColors(s);
  assert.deepEqual(colors,s.displayColors);assert.deepEqual(colors,s.members.map(m=>m.displayColor.channels));
  colors[0][0]=-1;assert.notEqual(s.members[0].srgb[0],-1);assert.notEqual(s.displayColors[0][0],-1);
  for(const x of [null,{version:2},{...s,members:[{srgb:[256,0,0]}]}])assert.throws(()=>toDisplayColors(x));
});
test('Malformed composition and stale group provenance fail before invoking a receiver',()=>{
  const c=generated(3).composition;let calls=0;const send=createHarmonyTransfer(()=>calls++);
  for(const active of [null,{...c.activeHarmony,members:[]},{...c.activeHarmony,activeMemberIndex:3},
    {...c.activeHarmony,members:[c.activeHarmony.members[0],c.activeHarmony.members[0]]},
    {...c.activeHarmony,source:'unknown'},{...c.activeHarmony,members:c.activeHarmony.members.toReversed()}])assert.throws(()=>send({...c,activeHarmony:active}));
  assert.equal(calls,0);assert.throws(()=>createHarmonyTransfer(null));
});
test('Namespaced event hook emits exactly one complete payload per invocation, without generator or DOM',()=>{
  const receiver=new EventTarget(),received=[];
  receiver.addEventListener(HARMONY_SELECTION_EVENT,event=>received.push(event.detail));
  const send=createHarmonyTransfer(selection=>receiver.dispatchEvent(new CustomEvent(HARMONY_SELECTION_EVENT,{detail:selection})));
  const c=generated(3).composition,payload=send(c);
  assert.equal(received.length,1);assert.equal(received[0],payload);assert.deepEqual(payload,createHarmonySelection(c));
  send(c);assert.equal(received.length,2);
});

// A small component host tests attributes and action wiring without a browser dependency.
// Actual focus, layout, native keyboard behavior and ESM startup are checked in browser QA.
class Node {
  constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.listeners={};this.classList={add:value=>{this.attrs.class=((this.attrs.class||'')+' '+value).trim();}};}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  append(...children){this.children.push(...children);}
  click(){if(!this.disabled)for(const fn of this.listeners.click||[])fn({target:this});}
}
const all=node=>[node,...node.children.filter(c=>c instanceof Node).flatMap(all)];
const byId=(node,id)=>all(node).find(n=>n.attrs['data-focus']===id);
const text=node=>typeof node==='string'?node:node.children.map(text).join('');
const originalDocument=globalThis.document;
globalThis.document={createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag)};
try {
  test('Numeric/register code controls wire independent browse actions and accessible labels',()=>{
    let s=generated(3);const original=s.composition,dispatch=(type,value)=>{s=step(s,type,value);};
    let nav=Navigator(s,dispatch);
    assert.equal(text(byId(nav,'code-hue')),'05');assert.equal(byId(nav,'code-hue').attrs['aria-label'],'Farbton 05');
    assert.equal(text(byId(nav,'code-register')),'ic');byId(nav,'nextHue').click();byId(nav,'nextRegister').click();
    assert.equal(s.selectedHue,6);assert.equal(s.selectedRegister,registers[registers.indexOf('ic')+1]);assert.equal(s.composition,original);
    nav=Navigator(step(s,'goToDefaultCircle'),dispatch);assert.equal(text(byId(nav,'code-register')),'•');
    assert.equal(byId(nav,'code-register').attrs['data-tooltip'],'Vollfarbe');assert.equal(byId(nav,'previousRegister').disabled,true);
  });
  test('All minimal relation buttons have bilingual tooltip/aria names and exclusive pressed states',()=>{
    for(const locale of ['de','en']){
      let s=step(createState(),'locale',locale),dispatch=(type,value)=>{s=step(s,type,value);};
      for(const n of [2,3,4]){byId(Toolbar(s,dispatch),`chord-${n}`).click();assert.equal(s.circleRelation,n);byId(Toolbar(s,dispatch),`chord-${n}`).click();assert.equal(s.circleRelation,null);}
      for(const relation of relations){
        let controls=RelationControls(s,dispatch),b=byId(controls,`relation-${relation}`);
        assert.ok(b.attrs['aria-label'].length>5);assert.equal(b.attrs['aria-label'],b.attrs['data-tooltip']);b.click();
        controls=RelationControls(s,dispatch);assert.equal(all(controls).filter(x=>x.attrs['aria-pressed']==='true').length,1);
        byId(controls,`relation-${relation}`).click();assert.equal(s.seriesRelation,null);
      }
    }
  });
  test('Triangle preview includes its browsed anchor even when Active Harmony is at another hue',()=>{
    for(const relation of relations){
      const s=step(step(seeded(),'nextHue'),'relation',relation),tree=TriangleView(s,()=>{});
      const marked=all(tree).filter(n=>n.attrs.role==='button'&&n.children.some(c=>c instanceof Node&&c.attrs.class==='relation-ring')).map(n=>n.attrs['aria-label']);
      const expected=relationFields(s).filter(f=>f.hueIndex===s.selectedHue).map(f=>f.label);
      assert.deepEqual(marked,expected);assert.ok(marked.includes('6ic'));assert.equal(activeColor(s.composition).label,'5ic');
    }
  });
  test('Transfer icon invokes the explicit hook once with the current strip contents',()=>{
    const s=generated(4),received=[],send=createHarmonyTransfer(selection=>received.push(selection));
    const {bar,panel}=Inspector(s,type=>{assert.equal(type,'transferHarmony');send(s.composition);});
    assert.equal(panel,null);const b=byId(bar,'transferHarmony');assert.equal(b.attrs['aria-label'],'In Muster übernehmen');b.click();
    assert.equal(received.length,1);assert.deepEqual(received[0].members.map(m=>m.identity),keys(s));
  });
  test('Atlas/Verlauf controls exist only in scientific inspector; workspace has no repeated view title',()=>{
    const s=step(step(createState(),'inspectorOpen',true),'detailOpen',true),{panel}=Inspector(s,()=>{});
    assert.ok(byId(panel,'mode-atlas'));assert.ok(byId(panel,'mode-continuum'));
    const app=readFileSync(new URL('./app.mjs',import.meta.url),'utf8');
    assert.ok(!app.includes('ModeControls'));assert.ok(!app.includes('workspace-heading'));assert.ok(!app.includes("el('h2',{},t(state.activeView"));
    assert.ok(app.includes("'aria-label':t(state.activeView,state.locale)"));
  });
} finally {if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
console.log(`\n${passed} integration/UI refinement test groups passed.`);
