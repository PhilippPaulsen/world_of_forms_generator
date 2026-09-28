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
    selectedRegister:'ic',selectedField:fieldAt(1,'ic'),harmonyMode:3,relation:'shadowSeries',
    selectionKind:'color',resultOpen:false,harmonyExample:'regular',selectedHarmony:null,inspectorOpen:false,detailOpen:false};
  let state=initial;
  for(const [key,value] of Object.entries(overrides)) state=transition(state,{type:key,value});
  return state;
}
/** Pure transitions preserve the chromatic anchor when inspecting samples or shared grays. */
export function transition(state,action) {
  const {type,value}=action;
  let next={...state};
  switch(type) {
    case 'selectedHue': next.selectedHue=normalizeHue(value); break;
    case 'selectedRegister': if(!registers.includes(value)) throw new RangeError('Unknown register'); next.selectedRegister=value; break;
    case 'cell': next.selectedHue=normalizeHue(value.hue); if(!registers.includes(value.register)) throw new RangeError('Unknown register');next.selectedRegister=value.register;break;
    case 'activeView': if(!views.includes(value)) throw new RangeError('Unknown view');next.activeView=value;return next;
    case 'displayMode': if(!['atlas','continuum'].includes(value)) throw new RangeError('Unknown mode');next.displayMode=value;break;
    case 'harmonyMode':
      if(![2,3,4].includes(value)) throw new RangeError('Invalid cardinality');
      next.harmonyMode=value;next.harmonyExample='regular';next.selectedHarmony=null;
      next.selectionKind=state.selectionKind==='harmony'&&state.harmonyMode===value?'color':'harmony';
      next.selectedField=anchor(next);
      if(next.selectionKind==='color')next.resultOpen=false;
      return next;
    case 'relation': if(!relations.includes(value)) throw new RangeError('Unknown relation');next.relation=value;next.selectionKind='relation';next.selectedHarmony=null;next.resultOpen=false;break;
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
  next.selectedField=fieldAt(next.selectedHue,next.selectedRegister);
  return next;
}
export function anchor(state) {return fieldAt(state.selectedHue,state.selectedRegister);}
export function hueHarmony(state) {
  const subdivision=Engine.regularHueSubdivision(anchor(state),state.harmonyMode);
  return {...subdivision,classification:Engine.classifyHueSet(subdivision.fields.map(f=>f.hueIndex))};
}
export function fieldRelations(state) {return Engine.harmonies(anchor(state));}
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
export function selectionFields(state) {
  if (state.selectionKind === 'harmony') return hueHarmony(state).fields;
  if (state.selectionKind === 'compound') return state.selectedHarmony.members;
  if (state.selectionKind === 'relation') {
    const relation = fieldRelations(state);
    const key = {isotint:'isotints',isotone:'isotones',shadowSeries:'shadowSeries',isovalent:'isovalent'}[state.relation];
    return [anchor(state), ...relation[key]].filter((f,i,a)=>a.findIndex(x=>x.label===f.label)===i);
  }
  return [state.selectedField];
}
