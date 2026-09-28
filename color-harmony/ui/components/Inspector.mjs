import {historicalToDisplay} from '../DisplayCalibration.mjs';
import {el,color,button,colorButton,fieldAction,fieldLabel,fieldStatus} from './dom.mjs';
import {hueIdentity} from '../FullColorCalibration.mjs';
import {t} from '../i18n.mjs';
import {hueHarmony,Engine,selectionFields} from '../state.mjs';
export function Inspector(state,dispatch) {
  const field=state.selectedField,locale=state.locale,group=state.selectionKind==='compound'?state.selectedHarmony:null;
  const label=fieldLabel(field,locale),status=fieldStatus(field,locale);
  const heading=el('div',{class:'selection-summary'},el('span',{class:'selection-color',style:`--color:${color(field)}`}),el('div',{},el('strong',{},label),el('span',{class:'status'},status)));
  const brief=el('div',{class:'selection-brief'},field.hueIndex?
    `${t('hue',locale)} ${field.hueIndex} / ${t(field.source==='atlas'?'register':'originRegister',locale)} ${state.selectedRegister}`:t('graySelected',locale));
  const members=selectionFields(state);
  const result=el('div',{class:'result-swatches'},members.map(member=>colorButton(member,state,
    member.source!=='interpolated'?fieldAction(member,dispatch):()=>{},member.hueIndex===field.hueIndex&&member.label===field.label,`result-${member.label||member.hueIndex||'sample'}`)));
  const resultLabel=state.selectionKind==='harmony'?t(state.harmonyMode===2?'complementary':state.harmonyMode===3?'three':'four',locale):
    state.selectionKind==='relation'?t({isotint:'white',isotone:'black',shadowSeries:'shadow',isovalent:'value'}[state.relation],locale):
    state.selectionKind==='compound'?t('compound',locale):label;
  const canExpand=['harmony','compound'].includes(state.selectionKind);
  const detailAction=()=>canExpand?dispatch('resultOpen',!state.resultOpen):dispatch('inspectorOpen',!state.inspectorOpen);
  const bar=el('section',{class:'selection-bar','aria-label':t('selection',locale)},
    el('div',{class:'result-heading'},el('strong',{},resultLabel),el('span',{class:'status'},members.length===1?status:String(members.length))),result,
    button(t(canExpand?'resultDetail':'info',locale),canExpand?'resultDetail':'info',state,detailAction,canExpand?state.resultOpen:state.inspectorOpen,'result-detail'));
  bar.querySelector('[data-focus="result-detail"]').setAttribute('aria-expanded',String(canExpand?state.resultOpen:state.inspectorOpen));
  bar.querySelector('[data-focus="result-detail"]').setAttribute('aria-controls',canExpand?'result-detail':'inspector');
  const panel=el('aside',{id:'inspector',class:'inspector','aria-label':t('info',locale)});
  if(!state.inspectorOpen)return {bar,panel:null};
  panel.append(el('div',{class:'inspector-heading'},el('h2',{},t('selection',locale)),button('×','close',state,()=>dispatch('inspectorOpen',false),false,'close-inspector')));
  panel.append(heading.cloneNode(true),el('p',{class:'inspector-context'},brief.textContent));
  if(field.hueIndex){const identity=hueIdentity(field.hueIndex);panel.append(el('p',{},`${t(identity.nameKey,locale)} ${identity.ordinal} · 1921 / 32`));}
  if(group) {
    panel.append(el('h3',{},t('compound',locale)),el('p',{},t(group.relation==='shared-member'?'shared':'substitution',locale)),el('p',{},`${t('level',locale)} ${group.level}`));
  } else if(state.selectionKind==='relation'||field.source==='interpolated') {
    panel.append(el('h3',{},t(state.relation==='isotint'?'isotintTerm':state.relation==='isotone'?'isotoneTerm':state.relation,locale)));
  } else if(state.selectionKind==='harmony') {
    const harmony=hueHarmony(state);
    panel.append(el('h3',{},t(state.harmonyMode===2?'complementary':state.harmonyMode===3?'three':'four',locale)),
      el('p',{},state.harmonyMode===2?harmony.classification.gaps.join(' · '):`${t(state.harmonyMode===3?'triad':'tetrad',locale)} / ${harmony.classification.gaps.join(' · ')}`));
  }
  const details=el('details',{...(state.detailOpen?{open:''}:{}),ontoggle:event=>{if(event.target.open!==state.detailOpen)dispatch('detailOpen',event.target.open);}},el('summary',{'data-focus':'scientific-detail'},t('detail',locale))),table=el('dl',{class:'value-table'});
  const display=historicalToDisplay(field);
  for(const [key,value] of [['white',field.w.toFixed(4)],['black',field.s.toFixed(4)],['full',field.v.toFixed(4)],
    ['engineLab',field.lab.map(x=>x.toFixed(5)).join(' / ')],['displayLab',display.lab.map(x=>x.toFixed(5)).join(' / ')],['rgb',display.rgb.join(' / ')],['gamut',t(display.gamutMapped?'mapped':'inGamut',locale)]])table.append(el('dt',{},t(key,locale)),el('dd',{},value));
  const relationEvidence=Engine.harmonyRuleRegistry().rules.find(rule=>rule.id===state.relation);
  const sourcePages=group?.provenance.sourcePages||
    ((state.selectionKind==='relation'||field.source==='interpolated')?relationEvidence.sourcePages:
      state.selectionKind==='harmony'?hueHarmony(state).classification.sourcePages:null);
  details.append(table);
  if(sourcePages)details.append(el('h3',{},t('source',locale)),el('p',{},t('primary',locale)),
    el('p',{},`${t('pages',locale)} ${sourcePages.join(', ')}`));
  details.append(el('p',{class:'source-note'},t('sourceNote',locale)),el('p',{class:'source-note'},t('displayNote',locale)));
  if(group)details.append(el('p',{class:'source-note'},t('depthNote',locale)));
  panel.append(details);
  return {bar,panel};
}
