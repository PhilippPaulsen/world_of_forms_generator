import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
createRequire(import.meta.url)('./build.js').build();
const {Engine,createState,transition,fieldAt,grays,pathSamples,registers}=await import('./state.mjs');
const {createComposition,reduceComposition,activeColor,fullColor,memberIdentity,memberKind,classifyMembers,harmonyCandidates,substitutionCandidates,connectionResult,validateColor}=await import('./composition.mjs');
let passed=0;
const test=(name,run)=>{run();console.log(`ok ${++passed} - ${name}`);};
const step=(s,type,value)=>transition(s,{type,value});
const members=s=>s.composition.activeHarmony.members;
const keys=s=>members(s).map(memberIdentity);
const seeded=()=>step(createState(),'cell',{hue:5,register:'ic'});
const generated=(n=3)=>step(seeded(),'generateHarmony',n);

test('2/3/4 preserve selected full anchor and derive exact regular engine patterns',()=>{
  for(const n of [2,3,4]){
    const state=step(step(createState(),'selectedHue',5),'generateHarmony',n);
    assert.equal(members(state).length,n);assert.equal(members(state)[0].hueIndex,5);
    assert.equal(state.composition.activeHarmony.activeMemberIndex,0);
    assert.deepEqual(state.composition.activeHarmony.classification.hueGeometry.gaps,Array(n).fill(24/n));
    assert.ok(members(state).every(f=>f.source==='reference'&&f.v===1&&f.label===null));
  }
});
test('Generated atlas harmony preserves register, anchor and engine HarmonySet',()=>{
  const state=generated();assert.deepEqual(keys(state),['atlas:5ic','atlas:13ic','atlas:21ic']);
  assert.equal(state.composition.activeHarmony.classification.historicalName,'Triade');
  assert.deepEqual(Engine.flattenHarmonyMembers(state.composition.activeHarmony.group),members(state));
});
test('Active member selection never regenerates the explicit set or adds undo entries',()=>{
  const original=generated(),next=step(original,'setActiveMember',1);
  assert.deepEqual(keys(next),keys(original));assert.equal(next.composition.activeHarmony.activeMemberIndex,1);
  assert.equal(next.selectedHue,13);assert.equal(next.composition.past.length,original.composition.past.length);
});
test('Replacement only edits the active member, immediately reclassifies gaps and preserves cardinality',()=>{
  const before=step(generated(),'setActiveMember',1),after=step(before,'cell',{hue:9,register:'ic'});
  assert.deepEqual(keys(after),['atlas:5ic','atlas:9ic','atlas:21ic']);
  assert.equal(after.composition.activeHarmony.source,'manual');assert.equal(after.composition.requestedCardinality,3);
  assert.equal(after.composition.activeHarmony.classification.historicalName,null);
  assert.deepEqual(after.composition.activeHarmony.classification.hueGeometry.gaps,[4,12,8]);
  assert.deepEqual(members(after)[0],members(before)[0]);assert.deepEqual(members(after)[2],members(before)[2]);
});
test('A changed register removes Triade naming even when the hue projection stays regular',()=>{
  const state=step(step(generated(),'setActiveMember',1),'selectedRegister','le'),classification=state.composition.activeHarmony.classification;
  assert.deepEqual(classification.hueGeometry.gaps,[8,8,8]);assert.equal(classification.isovalent,false);assert.equal(classification.historicalName,null);
});
test('Manual edits can regain a known class without pretending to be generated',()=>{
  let state=step(step(generated(),'setActiveMember',1),'selectedRegister','le');
  state=step(state,'selectedRegister','ic');assert.equal(state.composition.activeHarmony.classification.historicalName,'Triade');assert.equal(state.composition.activeHarmony.source,'manual');
});
test('Duplicate replacement is rejected quietly; clicking an existing member activates it',()=>{
  const before=step(generated(),'setActiveMember',1);
  const rejected=step(before,'replaceActiveMember',members(before)[0]);
  assert.deepEqual(keys(rejected),keys(before));assert.equal(rejected.composition.message,'duplicateMember');assert.equal(rejected.composition.past.length,before.composition.past.length);
  const selected=step(before,'cell',{hue:5,register:'ic'});assert.equal(selected.composition.activeHarmony.activeMemberIndex,0);assert.deepEqual(keys(selected),keys(before));
});
test('Identity distinguishes full, atlas, gray and interpolation without RGB equality',()=>{
  const f=fieldAt(5,'ic'),sample={hueIndex:5,...Engine.mix(Engine.hueCircle()[4].lab,f.w,f.s)};
  assert.deepEqual(sample.rgb,f.rgb);assert.notEqual(memberIdentity(sample),memberIdentity(f));
  assert.equal(memberIdentity(fullColor(5)),'full-color:5');assert.equal(memberIdentity(grays[0]),'gray:a');
  assert.equal(memberKind(sample),'interpolated');assert.equal(memberKind(fullColor(5)),'full-color');
  const c=reduceComposition(createComposition(f),'chooseColor',sample);assert.equal(activeColor(c).label,null);assert.equal(activeColor(c).source,'interpolated');
});
test('Same hue at different registers is not a duplicate and has no fake cyclic class',()=>{
  const state=step(step(generated(),'setActiveMember',1),'cell',{hue:5,register:'le'});
  assert.equal(members(state).length,3);assert.equal(new Set(keys(state)).size,3);assert.equal(state.composition.activeHarmony.classification.historicalName,null);
});
test('Opposite relationships remain neutral geometric metadata',()=>{
  const c=generated(4).composition.activeHarmony.classification;
  assert.deepEqual(c.oppositePairs,[[0,2],[1,3]]);assert.equal(c.historicalName,'Tetrade');
});
test('Clear keeps the current member and is undoable',()=>{
  const before=step(generated(4),'setActiveMember',2),cleared=step(before,'clearHarmony');
  assert.deepEqual(members(cleared),[members(before)[2]]);assert.equal(cleared.composition.requestedCardinality,null);
  assert.deepEqual(keys(step(cleared,'undoComposition')),keys(before));
});
test('Views, home, hue/register browsing, inspector and mode never alter composition',()=>{
  const original=generated(),saved=JSON.stringify(original.composition);
  let state=original;
  for(const [type,value] of [['activeView','triangle'],['nextHue'],['previousHue'],['nextRegister'],['previousRegister'],['activeView','register'],['browseCell',{hue:24,register:'pn'}],['displayMode','continuum'],['relation','isotone'],['inspectorOpen',true],['detailOpen',true],['locale','en'],['goToDefaultCircle']]){
    state=step(state,type,value);assert.equal(JSON.stringify(state.composition),saved,type);
  }
});
test('Full-color members move into the atlas only through explicit node selection',()=>{
  let state=step(createState(),'generateHarmony',3);
  state=step(step(state,'activeView','triangle'),'nextHue');assert.ok(members(state).every(f=>f.source==='reference'));
  state=step(state,'selectedRegister','le');assert.equal(members(state)[0].label,'2le');assert.ok(members(state).slice(1).every(f=>f.source==='reference'));
});
test('Circle hue selection preserves active member register and other members',()=>{
  const state=step(step(generated(),'setActiveMember',1),'selectedHue',14);
  assert.deepEqual(keys(state),['atlas:5ic','atlas:14ic','atlas:21ic']);
});
test('Selected continuous path samples retain exact identity through modes and views',()=>{
  let state=step(step(step(generated(),'setActiveMember',1),'activeView','triangle'),'displayMode','continuum');
  const expected=pathSamples(state)[17];state=step(state,'sample',17);
  assert.deepEqual(members(state)[1],expected);const identity=memberIdentity(expected);
  for(const view of ['register','circle','triangle']){state=step(state,'activeView',view);assert.equal(memberIdentity(members(state)[1]),identity);}
  state=step(state,'displayMode','atlas');assert.equal(memberIdentity(members(state)[1]),identity);
});
test('Undo/redo only restore composition and retain current navigation/inspector state',()=>{
  const original=generated();let state=step(original,'cell',{hue:9,register:'le'});
  state=step(step(state,'activeView','register'),'inspectorOpen',true);
  const edited=keys(state);state=step(state,'undoComposition');assert.deepEqual(keys(state),keys(original));assert.equal(state.activeView,'register');assert.equal(state.inspectorOpen,true);
  state=step(state,'redoComposition');assert.deepEqual(keys(state),edited);assert.equal(state.activeView,'register');
  state=step(step(state,'undoComposition'),'cell',{hue:10,register:'le'});assert.equal(state.composition.future.length,0);
});
test('Undo navigation does not change its browse coordinates',()=>{
  let state=step(generated(),'selectedRegister','le');state=step(state,'browseCell',{hue:24,register:'pn'});
  state=step(state,'undoComposition');assert.equal(state.selectedHue,24);assert.equal(state.selectedRegister,'pn');
});
test('History is bounded, immutable, and records generation changes',()=>{
  let state=generated(),saved=JSON.stringify(state),before=state;
  for(let i=0;i<110;i++)state=step(state,'generateHarmony',i%2?3:4);
  assert.equal(state.composition.past.length,100);assert.equal(JSON.stringify(before),saved);
  assert.equal(step(state,'undoComposition').composition.activeHarmony.members.length,4);
});
test('Alternative order is deterministic, retains anchor, and delegates classification to engine',()=>{
  for(const n of [2,3,4]) {
    const choices=harmonyCandidates(fieldAt(5,'ic'),n);assert.deepEqual(choices,harmonyCandidates(fieldAt(5,'ic'),n));
    for(const choice of choices){assert.equal(choice.members.length,n);assert.equal(choice.members[0].label,'5ic');assert.deepEqual(Engine.classifyHueSet(choice.members.map(f=>f.hueIndex)).gaps,classifyMembers(choice.members).hueGeometry.gaps);}
  }
  let state=generated();state=step(state,'nextAlternative');assert.equal(state.composition.activeHarmony.classification.historicalName,null);
  state=step(state,'previousAlternative');assert.equal(state.composition.activeHarmony.classification.historicalName,'Triade');
});
test('Gray default generation has no invented interval law and leaves gray unchanged',()=>{
  const state=step(step(createState(),'gray','c'),'generateHarmony',3);
  assert.deepEqual(keys(state),['gray:c']);assert.equal(state.composition.message,'grayGenerationUnavailable');
});
test('Atlas substitution uses the exact engine result and retains both source and replacement',()=>{
  let state=step(generated(),'setActiveMember',1);const source=state.composition.activeHarmony.group,target=activeColor(state.composition);
  state=step(state,'beginSubstitution');const candidate=substitutionCandidates(state.composition)[0];
  state=step(state,'applySubstitution',0);const group=state.composition.activeHarmony.group;
  assert.deepEqual(group,Engine.substituteHarmony(source,target,candidate.replacement));
  assert.deepEqual(group.groups[0],source);assert.equal(group.provenance.replacedElement,'atlas:13ic');assert.equal(group.relation,'substitution');
  assert.equal(group.members.length,4);assert.equal(state.composition.activeHarmony.classification.compound,true);
  const undone=step(state,'undoComposition');assert.deepEqual(undone.composition.activeHarmony.group,source);
});
test('Recursive substitution retains earlier compound as a subtree',()=>{
  let state=step(step(generated(),'beginSubstitution'),'applySubstitution',0);
  const original=state.composition.activeHarmony.group;
  state=step(step(state,'beginSubstitution'),'applySubstitution',0);
  assert.equal(state.composition.activeHarmony.group.level,3);assert.deepEqual(state.composition.activeHarmony.group.groups[0],original);
  assert.equal(Engine.compoundLevel(state.composition.activeHarmony.group),3);
});
test('Connection requires two actual groups sharing a canonical member',()=>{
  let state=step(generated(),'beginConnection'),first=state.composition.pending.source;
  assert.equal(connectionResult(state.composition),null);
  state=step(state,'generateHarmony',2);const second=state.composition.activeHarmony.group;
  assert.ok(connectionResult(state.composition));state=step(state,'connectGroups');
  assert.deepEqual(state.composition.activeHarmony.group,Engine.combineBySharedMember(first,second));
  assert.deepEqual(state.composition.activeHarmony.group.provenance.sharedElements,['atlas:5ic']);
});
test('No-shared-member connection stays disabled and rejects quietly',()=>{
  let state=step(generated(),'beginConnection');state=step(state,'cell',{hue:6,register:'le'});state=step(state,'generateHarmony',2);
  assert.equal(connectionResult(state.composition),null);const before=keys(state);state=step(state,'connectGroups');
  assert.deepEqual(keys(state),before);assert.equal(state.composition.message,'noSharedMember');
});
test('Full colors and samples are not relabeled to enter atlas-only compounds',()=>{
  let state=step(createState(),'generateHarmony',3);assert.equal(state.composition.activeHarmony.group,null);
  state=step(state,'beginSubstitution');assert.equal(state.composition.pending,null);assert.equal(state.composition.message,'compoundUnavailable');
  assert.ok(members(state).every(f=>f.source==='reference'));
});
test('Manual editing of compound preserves its previous structure and does not forge provenance',()=>{
  let state=step(step(generated(),'beginSubstitution'),'applySubstitution',0),tree=state.composition.activeHarmony.group;
  state=step(state,'cell',{hue:20,register:'pn'});
  assert.equal(state.composition.activeHarmony.source,'manual');assert.equal(state.composition.activeHarmony.classification.compound,false);
  assert.deepEqual(state.composition.activeHarmony.previousStructure,tree);assert.deepEqual(Engine.flattenHarmonyMembers(tree),tree.members);
});
test('Gray compound substitution and recursive shared groups remain supported',()=>{
  let c=createComposition(grays[1]);
  // Import an engine-created elementary group as a fixture; UI builds gray sets by explicit edits.
  const group=Engine.elementaryHarmony('gray',[grays[1],grays[2],grays[3]]);
  c={...c,activeHarmony:{members:group.members,activeMemberIndex:2,source:'manual',group,classification:classifyMembers(group.members,group)}};
  c=reduceComposition(c,'beginSubstitution');assert.ok(substitutionCandidates(c).length>0);
  c=reduceComposition(c,'applySubstitution',0);assert.equal(Engine.compoundLevel(c.activeHarmony.group),2);
});
test('Invalid identities, cardinalities and member indices fail clearly',()=>{
  for(const x of [-1,3,1.2,NaN])assert.throws(()=>step(generated(),'setActiveMember',x));
  for(const n of [0,1,5,NaN])assert.throws(()=>step(createState(),'generateHarmony',n));
  for(const f of [null,{},{...fullColor(5),w:.1},{...fieldAt(5,'ic'),label:'5zz'}])assert.throws(()=>validateColor(f));
  assert.throws(()=>step(generated(),'applySubstitution',0));
});
console.log(`\n${passed} composition test groups passed.`);
