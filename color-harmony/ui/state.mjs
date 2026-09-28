import {createComposition,reduceComposition,compositionActions,activeColor,colorAtHue} from './composition.mjs';
import Engine from './engine.generated.mjs';
import { DEFAULT_LOCALE } from './i18n.mjs';
// All atlas colors, classifications and composition operations come from the engine.
export const circle = Engine.hueCircle();
export const atlas = circle.map(h=>Engine.triangle(h.index));
export const registers = atlas[0].map(f=>f.label.replace(/^\d+/,''));
export const grays = Engine.grayAxis();
export const letters = Engine.letterScale().map(entry=>entry.letter);
export const views = ['circle','triangle','register'];
export const relations = ['isotint','isotone','shadowSeries','isovalent'];
export function normalizeHue(hue) {
  if (!Number.isSafeInteger(hue)) throw new RangeError('Hue must be a safe integer');
  return ((hue % 24)+23)%24+1;
}
export function fieldAt(hue,register) {
  const index=registers.indexOf(register);
  if(index<0) throw new RangeError('Unknown atlas register');
  return atlas[normalizeHue(hue)-1][index];
}
export function createState(overrides={}) {
  const initial={locale:DEFAULT_LOCALE,activeView:'circle',displayMode:'atlas',selectedHue:1,
    selectedRegister:'ic',circleMode:'reference',selectedField:referenceAt(1),harmonyMode:3,relation:'shadowSeries',
    selectionKind:'color',resultOpen:false,harmonyExample:'regular',selectedHarmony:null,inspectorOpen:false,detailOpen:false};
  let state={...initial,composition:createComposition(initial.selectedField)};
  for(const [key,value] of Object.entries(overrides)) state=transition(state,{type:key,value});
  return state;
}
/** Pure transitions preserve the chromatic anchor when inspecting samples or shared grays. */
function viewTransition(state,action) {
  const {type,value}=action;
  let next={...state};
  switch(type) {
    case 'previousHue': return viewTransition(state,{type:'selectedHue',value:state.selectedHue-1});
    case 'nextHue': return viewTransition(state,{type:'selectedHue',value:state.selectedHue+1});
    case 'previousRegister': case 'nextRegister': {
      const sequence=state.activeView==='circle'?['reference',...registers]:registers;
      const current=state.activeView==='circle'&&state.circleMode==='reference'?'reference':state.selectedRegister;
      const index=Math.max(0,Math.min(sequence.length-1,sequence.indexOf(current)+(type==='nextRegister'?1:-1)));
      return sequence[index]==='reference'?viewTransition(state,{type:'goToDefaultCircle'}):viewTransition(state,{type:'selectedRegister',value:sequence[index]});
    }
    case 'goToDefaultCircle':
      next.activeView='circle';next.circleMode='reference';next.resultOpen=false;next.selectedHarmony=null;
      next.selectionKind=state.selectionKind==='harmony'?'harmony':'color';next.selectedField=referenceAt(next.selectedHue);return next;
    case 'browseCell': return viewTransition(state,{type:'cell',value});
    case 'selectedHue': next.selectedHue=normalizeHue(value); break;
    case 'selectedRegister': if(!registers.includes(value)) throw new RangeError('Unknown register'); next.selectedRegister=value;next.circleMode='atlas'; break;
    case 'cell': next.selectedHue=normalizeHue(value.hue); if(!registers.includes(value.register)) throw new RangeError('Unknown register');next.selectedRegister=value.register;next.circleMode='atlas';break;
    case 'activeView': if(!views.includes(value)) throw new RangeError('Unknown view');next.activeView=value;if(value!=='circle'&&next.circleMode==='reference'){next.circleMode='atlas';if(next.selectedField.source==='reference')next.selectedField=fieldAt(next.selectedHue,next.selectedRegister);}return next;
    case 'displayMode': if(!['atlas','continuum'].includes(value)) throw new RangeError('Unknown mode');next.displayMode=value;next.circleMode='atlas';break;
    case 'harmonyMode':
      if(![2,3,4].includes(value)) throw new RangeError('Invalid cardinality');
      next.harmonyMode=value;next.harmonyExample='regular';next.selectedHarmony=null;
      next.selectionKind=state.selectionKind==='harmony'&&state.harmonyMode===value?'color':'harmony';
      next.selectedField=anchor(next);
      if(next.selectionKind==='color')next.resultOpen=false;
      return next;
    case 'relation': if(!relations.includes(value)) throw new RangeError('Unknown relation');next.relation=value;next.circleMode='atlas';next.selectionKind='relation';next.selectedHarmony=null;next.resultOpen=false;break;
    case 'locale': if(!['de','en'].includes(value)) throw new RangeError('Unknown locale');next.locale=value;return next;
    case 'inspectorOpen': case 'detailOpen': case 'resultOpen': if(typeof value!=='boolean') throw new TypeError('Expected boolean');next[type]=value;return next;
    case 'gray': {const gray=grays.find(g=>g.letter===value);if(!gray) throw new RangeError('Unknown gray');next.selectedField=gray;next.selectionKind='color';next.resultOpen=false;return next;}
    case 'sample': {
      if(state.displayMode!=='continuum' || !Number.isInteger(value)) throw new RangeError('Invalid sample');
      const sample=pathSamples(state)[value];if(!sample) throw new RangeError('Sample outside path');next.selectedField=sample;next.selectionKind='color';next.resultOpen=false;return next;
    }
    case 'harmonyExample': if(!['regular','shared','substitution','recursive'].includes(value)) throw new RangeError('Unknown example');
      next.selectionKind=value==='regular'?'harmony':'compound';next.harmonyExample=value;next.selectedHarmony=value==='regular'?null:compoundExamples()[value];
      next.selectedField=next.selectedHarmony?next.selectedHarmony.members[0]:anchor(next);return next;
    default: throw new RangeError('Unknown state transition');
  }
  if(next.selectionKind==='compound'){next.selectionKind='color';next.selectedHarmony=null;next.harmonyExample='regular';next.resultOpen=false;}
  next.selectedField=anchor(next);
  return next;
}
/** Orchestrate explicit color edits separately from view-only navigation. */
export function transition(state,action) {
  const {type,value}=action;
  let next=state,composition=state.composition;
  if(compositionActions.includes(type))composition=reduceComposition(composition,type,value);
  else if(type==='harmonyMode')composition=reduceComposition(composition,'generateHarmony',value);
  else {
    next=viewTransition(state,action);
    if(['selectedHue','selectedRegister','cell','gray','sample'].includes(type)) {
      const field=type==='selectedHue'?colorAtHue(activeColor(composition),normalizeHue(value)):next.selectedField;
      composition=reduceComposition(composition,'chooseColor',field);
    }
  }
  next={...next,composition,selectedField:activeColor(composition),harmonyMode:composition.requestedCardinality||state.harmonyMode};
  if(composition!==state.composition&&!['undoComposition','redoComposition','beginSubstitution','beginConnection','cancelCompound'].includes(type)) {
    const field=next.selectedField;
    if(field.hueIndex)next.selectedHue=field.hueIndex;
    if(field.source==='atlas'&&field.hueIndex){next.selectedRegister=field.label.slice(-2);next.circleMode='atlas';}
    else if(field.source==='reference'&&next.activeView==='circle')next.circleMode='reference';
  }
  return next;
}
/** Reference colors are explicit non-atlas vertices; they never receive letter labels. */
export function referenceAt(hue) {const h=normalizeHue(hue);return {...Engine.mix(circle[h-1].lab,0,0),hueIndex:h,source:'reference'};}
export function isReferenceCircle(state) {return state.activeView==='circle'&&state.circleMode==='reference';}
export function circleField(state,hue) {return isReferenceCircle(state)?referenceAt(hue):fieldAt(hue,state.selectedRegister);}
export function anchor(state) {return circleField(state,state.selectedHue);}

export function hueHarmony(state) {
  const field=anchor(state);
  const subdivision=Engine.regularHueSubdivision(field.source==='reference'?{...field,source:'interpolated'}:field,state.harmonyMode);
  if(isReferenceCircle(state))subdivision.fields=subdivision.fields.map(f=>referenceAt(f.hueIndex));
  return {...subdivision,classification:Engine.classifyHueSet(subdivision.fields.map(f=>f.hueIndex))};
}
export function fieldRelations(state) {return Engine.harmonies(fieldAt(state.selectedHue,state.selectedRegister));}
export function pathSamples(state,count=49) {
  const paths=fieldRelations(state).paths;
  // No invented continuous isovalent path: that relation remains an atlas circle.
  if(state.relation==='isovalent') return [];
  return Engine.sampleHarmonyPath(paths[state.relation],count);
}
export function compoundExamples() {
  const grayGroup=sequence=>Engine.elementaryHarmony('gray',sequence.map(letter=>grays.find(g=>g.letter===letter)));
  // Instantiations of the documented Phase-5 fixtures, not a new composition rule.
  const a=grayGroup(['a','c','e']),b=grayGroup(['e','g','i']);
  const shared=Engine.combineBySharedMember(a,b);
  const substitution=Engine.substituteHarmony(grayGroup(['c','e','g']),grays.find(g=>g.letter==='g'),grayGroup(['e','i']));
  const recursive=Engine.combineBySharedMember(shared,grayGroup(['i','l','n']));
  return {shared,substitution,recursive};
}
export { Engine };

/** Current result is derived from the same state across all three primary views. */
export function selectionFields(state) {return state.composition.activeHarmony.members;}
/** Relation highlights describe the browsed atlas context, independently of composition. */
export function relationFields(state) {
  const data=fieldRelations(state),key={isotint:'isotints',isotone:'isotones',shadowSeries:'shadowSeries',isovalent:'isovalent'}[state.relation];
  return [anchor(state),...data[key]].filter((f,i,a)=>a.findIndex(x=>x.label===f.label)===i);
}
