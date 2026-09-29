import Engine from './engine.generated.mjs';

const EPSILON=1e-10;
const hues=Engine.hueCircle(), grays=Engine.grayAxis();
const atlas=hues.map(h=>Engine.triangle(h.index));
export const normalizeHue=h=>{if(!Number.isSafeInteger(h))throw new RangeError('Invalid hue');return ((h%24)+23)%24+1;};
export const fullColor=h=>({hueIndex:normalizeHue(h),...Engine.mix(hues[normalizeHue(h)-1].lab,0,0),source:'reference'});
export const memberKind=f=>f.source==='reference'?'full-color':f.source==='interpolated'?'interpolated':f.hueIndex?'atlas':'gray';
/** Identity uses coordinates and source, never display RGB or a rounded atlas guess. */
export function memberIdentity(field) {
  const kind=memberKind(field);
  if(kind==='full-color')return `full-color:${field.hueIndex}`;
  if(kind==='atlas')return `atlas:${field.label}`;
  if(kind==='gray')return `gray:${field.letter}`;
  return `interpolated:${field.hueIndex}:${field.w}:${field.s}`;
}
/** Canonicalize through the engine's existing validation boundary. */
export function validateColor(field) {
  if(!field||typeof field!=='object')throw new TypeError('Expected color');
  if(field.source==='reference') {
    const expected=fullColor(field.hueIndex);
    if(field.label!==null||field.w!==0||field.s!==0||field.v!==1||!Array.isArray(field.lab)||field.lab.length!==3||!field.lab.every((v,i)=>v===expected.lab[i]))throw new Error('Invalid full-color identity');
    return expected;
  }
  if(field.hueIndex!==undefined)return Engine.regularHueSubdivision(field,1).fields[0];
  const expected=grays.find(g=>g.letter===field.letter);
  if(!expected)throw new Error('Unknown gray');
  // Compound validation accepts gray nodes and checks their complete analytical data.
  Engine.elementaryHarmony('gray',[field,grays.find(g=>g.letter!==field.letter)]);
  return {...expected,lab:expected.lab.slice(),rgb:expected.rgb.slice()};
}
export function colorAtHue(field,hue) {
  hue=normalizeHue(hue);
  if(memberKind(field)==='gray')return fullColor(hue); // Explicit hue selection leaves shared gray axis.
  if(field.source==='reference')return fullColor(hue);
  if(field.source==='atlas')return atlas[hue-1].find(f=>f.label.slice(-2)===field.label.slice(-2));
  return {hueIndex:hue,...Engine.mix(hues[hue-1].lab,field.w,field.s)};
}
/** A compatible elementary group is discovered by engine validation, not UI harmony laws. */
export function structuredGroup(members) {
  if(members.length<2||members.some(f=>f.source!=='atlas'))return null;
  for(const [domain,relation] of [['gray',undefined],['isovalent',undefined],['same-hue','isotint'],['same-hue','isotone'],['same-hue','shadow-series']]) {
    try{return Engine.elementaryHarmony(domain,members,relation?{relation}:{});}catch{/* Try the next declared engine domain. */}
  }
  return null;
}
export function classifyMembers(members,group=null) {
  const hueIndices=members.filter(f=>f.hueIndex).map(f=>f.hueIndex);
  const distinct=[...new Set(hueIndices)];
  const hueGeometry=distinct.length>=2?Engine.classifyHueSet(distinct):null;
  const isovalent=hueIndices.length===members.length&&distinct.length===members.length&&members.every(f=>['w','s','v'].every(k=>Math.abs(f[k]-members[0][k])<=EPSILON));
  const oppositePairs=[];
  for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++)if(members[i].hueIndex&&members[j].hueIndex&&Engine.hueDistance(members[i].hueIndex,members[j].hueIndex).minimal===12)oppositePairs.push([i,j]);
  return {cardinality:members.length,hueGeometry,isovalent,historicalName:isovalent?hueGeometry?.historicalName||null:null,
    oppositePairs,compound:group?.type==='compound-harmony',domain:group?.domain||null};
}
function active(members,index,source,group=null,extra={}) {
  const canonical=members.map(validateColor);
  if(!canonical.length||new Set(canonical.map(memberIdentity)).size!==canonical.length)throw new Error('Duplicate member identity');
  if(!Number.isInteger(index)||index<0||index>=canonical.length)throw new RangeError('Invalid active member');
  return {members:canonical,activeMemberIndex:index,source,group,classification:classifyMembers(canonical,group),...extra};
}
export const activeColor=c=>c.activeHarmony.members[c.activeHarmony.activeMemberIndex];
export function createComposition(field) {return {activeHarmony:active([field],0,'selected'),requestedCardinality:null,generation:null,past:[],future:[],pending:null,message:null};}
const snapshot=c=>({activeHarmony:c.activeHarmony,requestedCardinality:c.requestedCardinality,generation:c.generation});
function commit(c,changes) {return {...c,...changes,past:[...c.past,snapshot(c)].slice(-100),future:[],message:null};}

/** Default subdivisions and a small deterministic catalogue of engine constructions.
 * Ordering is presentation policy, not historical ranking. Every entry retains the anchor. */
export function harmonyCandidates(field,parts) {
  if(![2,3,4].includes(parts))throw new RangeError('Cardinality must be 2, 3 or 4');
  if(!field.hueIndex)return []; // No verified default step law for gray series.
  const seed=field.source==='reference'?{...field,source:'interpolated'}:field;
  const regular=Engine.regularHueSubdivision(seed,parts).fields.map(f=>colorAtHue(field,f.hueIndex));
  const result=[{members:regular,construction:'regular',evidence:Engine.classifyHueSet(regular.map(f=>f.hueIndex))}];
  const dyad=Engine.regularHueSubdivision(seed,2).fields.map(f=>f.hueIndex);
  const append=evidence=>{
    const indices=[field.hueIndex,...evidence.hues.filter(h=>h!==field.hueIndex)];
    const members=indices.map(h=>colorAtHue(field,h));
    const key=members.map(memberIdentity).sort().join('|');
    if(!result.some(x=>x.members.map(memberIdentity).sort().join('|')===key))result.push({members,construction:evidence.construction,evidence});
  };
  if(parts===3)for(const direction of ['clockwise','counterclockwise'])append(Engine.divideHueDyad(dyad,direction));
  if(parts===4){const triad=Engine.regularHueSubdivision(seed,3).fields.map(f=>f.hueIndex);for(let distance=1;distance<=6;distance++)append(Engine.splitHueSet(triad,triad[1],distance));}
  return result;
}
function generate(c,parts,index=0,seed=activeColor(c)) {
  const options=harmonyCandidates(seed,parts);
  if(!options.length)return {...c,message:'grayGenerationUnavailable'};
  const choice=options[index];if(!choice)throw new RangeError('Unknown alternative');
  const group=structuredGroup(choice.members);
  return commit(c,{activeHarmony:active(choice.members,0,'generated',group,{construction:choice.evidence}),requestedCardinality:parts,generation:{anchor:seed,index,total:options.length}});
}
/** Candidate replacements use engine splitting or real discrete series entries;
 * substituteHarmony itself validates symmetry/correspondence before any option is exposed. */
export function substitutionCandidates(c) {
  const source=c.pending?.type==='substitution'?c.pending.source:c.activeHarmony.group;
  const target=c.pending?.type==='substitution'?c.pending.target:activeColor(c);
  if(!source||target.source!=='atlas')return [];
  const groups=[];
  const add=(members,domain,relation)=>{try{
    const replacement=Engine.elementaryHarmony(domain,members,relation?{relation}:{});
    const compound=Engine.substituteHarmony(source,target,replacement);
    const key=replacement.members.map(memberIdentity).sort().join('|');
    if(!groups.some(g=>g.key===key))groups.push({key,replacement,compound});
  }catch{/* Unsupported correspondence is deliberately unavailable. */}};
  if(target.hueIndex){
    const dyad=Engine.regularHueSubdivision(target,2).fields.map(f=>f.hueIndex);
    for(let distance=1;distance<=6;distance++){
      const split=Engine.splitHueSet(dyad,target.hueIndex,distance);
      const pair=split.constructionEvidence.replacements.map(h=>colorAtHue(target,h));
      add(pair,'isovalent');add([pair[0],target,pair[1]],'isovalent');
    }
  } else for(let i=0;i<grays.length;i++)for(let j=i+1;j<grays.length;j++)add([grays[i],grays[j]],'gray');
  return groups;
}
export function connectionResult(c) {
  if(c.pending?.type!=='connection'||!c.activeHarmony.group)return null;
  if(JSON.stringify(c.pending.source)===JSON.stringify(c.activeHarmony.group))return null;
  try{return Engine.combineBySharedMember(c.pending.source,c.activeHarmony.group);}catch{return null;}
}
/** Public shared series operation: actual discrete nodes in engine-defined order.
 * No gray/interpolated-to-atlas coercion and no inferred series interval law. */
export function seriesMembers(anchor,relation) {
  const keys={isotint:'isotints',isotone:'isotones',shadowSeries:'shadowSeries',isovalent:'isovalent'};
  if(!Object.hasOwn(keys,relation))throw new RangeError('Unknown series relation');
  const field=validateColor(anchor);
  if(field.source!=='atlas'||!field.hueIndex)throw new Error('Series selection requires a chromatic atlas anchor');
  const data=Engine.harmonies(field),values=data[keys[relation]];
  if(relation==='shadowSeries'||relation==='isovalent')return values;
  const labels=new Set([field.label,...values.map(f=>f.label)]);
  return Engine.triangle(field.hueIndex).filter(f=>labels.has(f.label));
}
/** Central pure composition actions; navigation never enters this reducer. */
export function reduceComposition(c,type,value) {
  const a=c.activeHarmony;
  if(type==='setActiveMember') {
    if(!Number.isInteger(value)||value<0||value>=a.members.length)throw new RangeError('Invalid active member');
    return {...c,activeHarmony:{...a,activeMemberIndex:value},message:null};
  }
  if(type==='replaceActiveMember'||type==='chooseColor') {
    const field=validateColor(value),key=memberIdentity(field),existing=a.members.findIndex(f=>memberIdentity(f)===key);
    if(existing>=0){
      if(type==='chooseColor')return reduceComposition(c,'setActiveMember',existing);
      return existing===a.activeMemberIndex?c:{...c,message:'duplicateMember'};
    }
    const members=a.members.map((f,i)=>i===a.activeMemberIndex?field:f),group=structuredGroup(members);
    return commit(c,{activeHarmony:active(members,a.activeMemberIndex,a.members.length>1?'manual':'selected',group,
      a.group?.type==='compound-harmony'?{previousStructure:a.group}:a.previousStructure?{previousStructure:a.previousStructure}:{}),generation:null});
  }
  if(type==='toggleCircleRelation') {
    if(![2,3,4].includes(value))throw new RangeError('Cardinality must be 2, 3 or 4');
    return c.requestedCardinality===value?reduceComposition(c,'clearHarmony'):generate(c,value);
  }
  if(type==='adoptSeries') {
    const members=seriesMembers(value.anchor,value.relation);
    const identity=value.activeIdentity||memberIdentity(value.anchor),index=members.findIndex(f=>memberIdentity(f)===identity);
    if(index<0)throw new Error('Active member is not in the series');
    const rule=Engine.harmonyRuleRegistry().rules.find(r=>r.id===value.relation);
    return commit(c,{activeHarmony:active(members,index,'series',structuredGroup(members),{
      series:{relation:value.relation,anchor:validateColor(value.anchor),rule}}),requestedCardinality:null,generation:null,pending:null});
  }
  if(type==='generateHarmony')return generate(c,value);
  if(type==='previousAlternative'||type==='nextAlternative') {
    if(!c.generation)return c;
    const g=c.generation,index=(g.index+(type==='nextAlternative'?1:g.total-1))%g.total;
    return generate(c,c.requestedCardinality,index,g.anchor);
  }
  if(type==='clearHarmony')return a.members.length===1?c:commit(c,{activeHarmony:active([activeColor(c)],0,'selected'),requestedCardinality:null,generation:null,pending:null});
  if(type==='undoComposition'||type==='redoComposition') {
    const undo=type==='undoComposition',from=undo?c.past:c.future;
    if(!from.length)return c;
    return {...c,...from.at(-1),past:undo?from.slice(0,-1):[...c.past,snapshot(c)],future:undo?[...c.future,snapshot(c)]:from.slice(0,-1),pending:null,message:null};
  }
  if(type==='beginSubstitution')return a.group&&substitutionCandidates(c).length?{...c,pending:{type:'substitution',source:a.group,target:activeColor(c)},message:null}:{...c,message:'compoundUnavailable'};
  if(type==='applySubstitution') {
    if(c.pending?.type!=='substitution')throw new Error('No substitution in progress');
    const candidate=substitutionCandidates(c)[value];if(!Number.isInteger(value)||!candidate)throw new RangeError('Unknown replacement');
    const index=candidate.compound.members.findIndex(f=>memberIdentity(f)===memberIdentity(candidate.replacement.members[0]));
    return commit(c,{activeHarmony:active(candidate.compound.members,index,'compound',candidate.compound),generation:null,pending:null});
  }
  if(type==='beginConnection')return a.group?{...c,pending:{type:'connection',source:a.group},message:null}:{...c,message:'compoundUnavailable'};
  if(type==='connectGroups') {
    const group=connectionResult(c);if(!group)return {...c,message:'noSharedMember'};
    return commit(c,{activeHarmony:active(group.members,group.members.findIndex(f=>memberIdentity(f)===memberIdentity(activeColor(c))),'compound',group),generation:null,pending:null});
  }
  if(type==='cancelCompound')return {...c,pending:null,message:null};
  throw new RangeError('Unknown composition action');
}
export const compositionActions=['toggleCircleRelation','adoptSeries','setActiveMember','replaceActiveMember','chooseColor','generateHarmony','previousAlternative','nextAlternative','clearHarmony','undoComposition','redoComposition','beginSubstitution','applySubstitution','beginConnection','connectGroups','cancelCompound'];
