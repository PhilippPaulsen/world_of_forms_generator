import Engine from './engine.generated.mjs';
import {validateColor,memberIdentity,memberKind,classifyMembers} from './composition.mjs';
import {historicalToDisplay,DEFAULT_MAPPING} from './DisplayCalibration.mjs';
import {DEFAULT_HUE_MAPPING} from './FullColorCalibration.mjs';

export const HARMONY_SELECTION_EVENT='farborgel:harmony-selection';
const copy=value=>JSON.parse(JSON.stringify(value));

/** Build a fresh, deterministic version-1 transfer record, without DOM/generator state.
 * @param {object} composition Composition reducer state (activeHarmony is required).
 * @returns {object} Serializable HarmonySelection; no timestamp, UI history or callbacks.
 * @throws {Error} Invalid colors, duplicates, active index or inconsistent group provenance.
 */
export function createHarmonySelection(composition) {
  const active=composition?.activeHarmony;
  if(!active||!Array.isArray(active.members)||!active.members.length)throw new TypeError('Expected nonempty active harmony');
  const fields=active.members.map(validateColor),identities=fields.map(memberIdentity);
  if(new Set(identities).size!==fields.length)throw new Error('Duplicate selection identity');
  if(!Number.isInteger(active.activeMemberIndex)||active.activeMemberIndex<0||active.activeMemberIndex>=fields.length)throw new RangeError('Invalid active member index');
  if(!['selected','generated','manual','compound','series'].includes(active.source))throw new Error('Unknown composition source');
  if(active.group) {
    const expected=Engine.flattenHarmonyMembers(active.group).map(memberIdentity);
    if(JSON.stringify(expected)!==JSON.stringify(identities))throw new Error('Group provenance does not match ordered members');
  }
  if(active.previousStructure)Engine.flattenHarmonyMembers(active.previousStructure);
  const classification=classifyMembers(fields,active.group);
  const members=fields.map(field=>{
    const display=historicalToDisplay(field);
    const analyticalCoordinate={hueIndex:field.hueIndex??null,v:field.v,w:field.w,s:field.s};
    return {identity:memberIdentity(field),sourceType:memberKind(field),
      historicalCoordinate:field.source==='atlas'?{...analyticalCoordinate,label:field.label,letter:field.letter??null}:null,
      analyticalCoordinate,oklab:field.lab.slice(),displayOklab:display.lab.slice(),srgb:display.rgb.slice(),
      displayColor:{space:'srgb',channels:display.rgb.slice()},gamutMapped:display.gamutMapped};
  });
  return {version:1,source:'farborgel',members,activeMemberIndex:active.activeMemberIndex,
    displayColors:members.map(m=>m.srgb.slice()),
    displayModel:{mixingSpace:'Oklab',hueMapping:DEFAULT_HUE_MAPPING,grayMapping:DEFAULT_MAPPING,historicallyCalibrated:false},
    classification:{cardinality:members.length,historicalName:classification.historicalName,
      gapSignature:classification.hueGeometry?.gaps||null,isovalent:classification.isovalent,
      hueGeometry:copy(classification.hueGeometry),oppositePairs:copy(classification.oppositePairs),compound:classification.compound,domain:classification.domain},
    provenance:{status:active.source,construction:copy(active.construction||null),series:copy(active.series||null),
      group:copy(active.group||null),previousStructure:copy(active.previousStructure||null)}};
}

/** Convenience RGB byte triples in member order, returned as independent arrays.
 * This accessor accepts version-1 records; it is not a general untrusted-input schema validator. */
export function toDisplayColors(selection) {
  if(selection?.version!==1||selection.source!=='farborgel'||!Array.isArray(selection.members)||!selection.members.length)throw new TypeError('Expected HarmonySelection version 1');
  return selection.members.map(member=>{
    if(!Array.isArray(member.srgb)||member.srgb.length!==3||!member.srgb.every(x=>Number.isInteger(x)&&x>=0&&x<=255))throw new TypeError('Invalid display sRGB');
    return member.srgb.slice();
  });
}

/** Explicit callback boundary. Each invocation builds once and calls the receiver once.
 * Browser event wiring belongs to app.mjs; this module requires no window or generator.
 * @param {function(object):void} onHarmonySelection Receiver for one HarmonySelection.
 * @returns {function(object):object} Transfer a composition and return its emitted payload.
 */
export function createHarmonyTransfer(onHarmonySelection) {
  if(typeof onHarmonySelection!=='function')throw new TypeError('Harmony selection receiver must be a function');
  return composition=>{const selection=createHarmonySelection(composition);onHarmonySelection(selection);return selection;};
}
