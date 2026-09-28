import {historicalToDisplay} from '../DisplayCalibration.mjs';
import {el,color,button,colorButton,fieldLabel,fieldStatus} from './dom.mjs';
import {hueIdentity} from '../FullColorCalibration.mjs';
import {t} from '../i18n.mjs';
import {activeColor,substitutionCandidates,connectionResult} from '../composition.mjs';
import {HarmonyView} from '../views/HarmonyView.mjs';
export function compositionTitle(state) {
  const a=state.composition.activeHarmony,n=a.members.length;
  return n===1?fieldLabel(a.members[0],state.locale):a.classification.compound?t('compound',state.locale):t(n===2?'pair':n===3?'three':n===4?'four':'harmony',state.locale);
}
const nameKey={Gegenfarben:'complementary',Triade:'triad',Tetrade:'tetrad'};
export function Inspector(state,dispatch) {
  const c=state.composition,a=c.activeHarmony,field=activeColor(c),locale=state.locale,group=a.group;
  const title=compositionTitle(state),label=fieldLabel(field,locale);
  const result=el('div',{class:'result-swatches',role:'group','aria-label':t('activeHarmony',locale)});
  a.members.forEach((f,i)=>{
    const node=colorButton(f,state,()=>dispatch('setActiveMember',i),i===a.activeMemberIndex,`member-${i}`);
    node.setAttribute('aria-label',`${t('activeMember',locale)} ${i+1} · ${fieldLabel(f,locale)} · ${fieldStatus(f,locale)}`);
    result.append(node);
  });
  const actions=el('div',{class:'composition-actions'});
  for(const [symbol,key,disabled] of [['×','clearHarmony',a.members.length===1],['↶','undoComposition',!c.past.length],['↷','redoComposition',!c.future.length]]) {
    const node=button(symbol,key,state,()=>dispatch(key));node.disabled=disabled;actions.append(node);
  }
  const bar=el('section',{class:'selection-bar composition-bar','aria-label':t('activeHarmony',locale)},
    el('div',{class:'result-heading'},el('strong',{},title),el('span',{class:'status'},`${a.activeMemberIndex+1} / ${a.members.length}`)),result,actions,
    el('span',{class:'composition-message',role:'status','aria-live':'polite'},c.message?t(c.message,locale):''));
  const panel=el('aside',{id:'inspector',class:'inspector','aria-label':t('info',locale)});
  if(!state.inspectorOpen)return {bar,panel:null};
  panel.append(el('div',{class:'inspector-heading'},el('h2',{},t('activeHarmony',locale)),button('×','close',state,()=>dispatch('inspectorOpen',false),false,'close-inspector')));
  panel.append(el('div',{class:'selection-summary'},el('span',{class:'selection-color',style:`--color:${color(field)}`}),el('div',{},el('strong',{},label),el('span',{class:'status'},`${t('activeMember',locale)} ${a.activeMemberIndex+1} · ${fieldStatus(field,locale)}`))));
  if(field.hueIndex){const identity=hueIdentity(field.hueIndex);panel.append(el('p',{},`${t(identity.nameKey,locale)} ${identity.ordinal} · 1921 / 32`));}
  panel.append(el('h3',{class:'composition-title'},title));
  if(a.members.length>1){
    const classification=a.classification;
    if(classification.historicalName)panel.append(el('p',{'data-classification':'name'},t(nameKey[classification.historicalName],locale)));
    if(classification.hueGeometry&&classification.hueGeometry.cardinality!==a.members.length)panel.append(el('p',{class:'status'},t('hueProjection',locale)));
    if(classification.hueGeometry)panel.append(el('p',{'data-classification':'gaps'},classification.hueGeometry.gaps.join(' · ')));
    if(classification.hueGeometry&&!classification.isovalent)panel.append(el('p',{class:'status'},t('differentRegisters',locale)));
    if(classification.oppositePairs.length)panel.append(el('p',{class:'status'},`${t('oppositePairs',locale)}: ${classification.oppositePairs.map(pair=>pair.map(i=>i+1).join('↔')).join(', ')}`));
    panel.append(el('p',{class:'status'},t(a.source==='manual'?'manual':a.source==='compound'?'compound':'generated',locale)));
  }
  if(c.generation?.total>1)panel.append(el('div',{class:'alternative-nav',role:'group','aria-label':t('alternatives',locale)},
    button('‹','previousAlternative',state,()=>dispatch('previousAlternative')),el('span',{},`${c.generation.index+1} / ${c.generation.total}`),button('›','nextAlternative',state,()=>dispatch('nextAlternative'))));
  const details=el('details',{...(state.detailOpen?{open:''}:{}),ontoggle:event=>{if(event.target.open!==state.detailOpen)dispatch('detailOpen',event.target.open);}},el('summary',{'data-focus':'scientific-detail'},t('detail',locale))),table=el('dl',{class:'value-table'});
  const display=historicalToDisplay(field);
  for(const [key,value] of [['white',field.w.toFixed(4)],['black',field.s.toFixed(4)],['full',field.v.toFixed(4)],['engineLab',field.lab.map(x=>x.toFixed(5)).join(' / ')],['displayLab',display.lab.map(x=>x.toFixed(5)).join(' / ')],['rgb',display.rgb.join(' / ')]])table.append(el('dt',{},t(key,locale)),el('dd',{},value));
  details.append(table);
  const sourcePages=(group?.provenance.sourcePages.length?group.provenance.sourcePages:null)||a.construction?.constructionEvidence?.sourcePages||
    (a.classification.historicalName?a.classification.hueGeometry.sourcePages:[]);
  if(sourcePages.length)details.append(el('h3',{},t('source',locale)),el('p',{},`${t('primary',locale)} · ${t('pages',locale)} ${sourcePages.join(', ')}`));
  const advanced=el('div',{class:'advanced-composition'});
  const sub=button('↳','beginSubstitution',state,()=>dispatch('beginSubstitution'));
  sub.disabled=!group||!substitutionCandidates(c).length;
  const connect=button('⋈','beginConnection',state,()=>dispatch('beginConnection'));connect.disabled=!group;
  advanced.append(sub,connect);
  details.append(el('h3',{},t('resultDetail',locale)),advanced);
  if(!group)details.append(el('p',{class:'source-note'},t('compoundAtlasOnly',locale)));
  if(c.pending){
    details.append(button('×','cancelCompound',state,()=>dispatch('cancelCompound')));
    if(c.pending.type==='substitution') {
      details.append(el('p',{},`${t('chooseReplacement',locale)} · ${fieldLabel(c.pending.target,locale)}`));
      const options=el('div',{class:'replacement-options'});
      substitutionCandidates(c).forEach((candidate,i)=>{
        const text=candidate.replacement.members.map(f=>fieldLabel(f,locale)).join(' · ');
        options.append(el('button',{type:'button','aria-label':`${t('replacement',locale)} ${text}`,'data-focus':`replacement-${i}`,onclick:()=>dispatch('applySubstitution',i)},text));
      });details.append(options);
    }else {
      details.append(el('p',{},t('connectionHint',locale)),el('p',{},`${t('groupA',locale)}: ${c.pending.source.members.map(f=>fieldLabel(f,locale)).join(' · ')}`));
      const confirm=button('⋈','connectGroups',state,()=>dispatch('connectGroups'));confirm.disabled=!connectionResult(c);details.append(confirm);
      if(!connectionResult(c))details.append(el('p',{class:'status'},t('noSharedMember',locale)));
    }
  }
  if(group?.type==='compound-harmony')details.append(HarmonyView(state,dispatch));
  if(a.previousStructure)details.append(el('h3',{},t('previousStructure',locale)),HarmonyView(state,dispatch,a.previousStructure));
  details.append(el('p',{class:'source-note'},t('sourceNote',locale)),el('p',{class:'source-note'},t('displayNote',locale)),
    el('div',{class:'language-controls',role:'group','aria-label':t('language',locale)},['de','en'].map(lang=>el('button',{type:'button','aria-label':lang==='de'?'Deutsch':'English','aria-pressed':locale===lang,'data-focus':`locale-${lang}`,onclick:()=>dispatch('locale',lang)},lang.toUpperCase()))));
  panel.append(details);
  return {bar,panel};
}
