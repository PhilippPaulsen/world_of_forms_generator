import {el,color,button} from './dom.mjs';
import {t} from '../i18n.mjs';
import {hueHarmony,Engine} from '../state.mjs';
export function Inspector(state,dispatch) {
  const field=state.selectedField,locale=state.locale,group=state.activeView==='harmony'?state.selectedHarmony:null;
  const label=field.label||t('noAtlas',locale),status=t(field.source==='atlas'?'atlas':'continuum',locale);
  const heading=el('div',{class:'selection-summary'},el('span',{class:'selection-color',style:`--color:${color(field)}`}),el('div',{},el('strong',{},label),el('span',{class:'status'},status)));
  const brief=el('div',{class:'selection-brief'},field.hueIndex?
    `${t('hue',locale)} ${field.hueIndex} / ${t(field.source==='atlas'?'register':'originRegister',locale)} ${state.selectedRegister}`:t('graySelected',locale));
  const bar=el('section',{class:'selection-bar','aria-label':t('selection',locale)},heading,brief,
    button(t('info',locale),'info',state,()=>dispatch('inspectorOpen',!state.inspectorOpen),state.inspectorOpen,'inspector-info'));
  const panel=el('aside',{id:'inspector',class:'inspector','aria-label':t('info',locale)});
  if(!state.inspectorOpen)return {bar,panel:null};
  panel.append(el('div',{class:'inspector-heading'},el('h2',{},t('selection',locale)),button('×','close',state,()=>dispatch('inspectorOpen',false),false,'close-inspector')));
  panel.append(heading.cloneNode(true),el('p',{class:'inspector-context'},brief.textContent));
  if(group) {
    panel.append(el('h3',{},t('compound',locale)),el('p',{},t(group.relation==='shared-member'?'shared':'substitution',locale)),el('p',{},`${t('level',locale)} ${group.level}`));
  } else if(state.activeView==='triangle'||field.source==='interpolated') {
    panel.append(el('h3',{},t(state.relation,locale)));
  } else {
    const harmony=hueHarmony(state);
    panel.append(el('h3',{},t(state.harmonyMode===2?'complementary':state.harmonyMode===3?'three':'four',locale)),
      el('p',{},state.harmonyMode===2?harmony.classification.gaps.join(' · '):`${t(state.harmonyMode===3?'triad':'tetrad',locale)} / ${harmony.classification.gaps.join(' · ')}`));
  }
  const details=el('details',{...(state.detailOpen?{open:''}:{}),ontoggle:event=>{if(event.target.open!==state.detailOpen)dispatch('detailOpen',event.target.open);}},el('summary',{'data-focus':'scientific-detail'},t('detail',locale))),table=el('dl',{class:'value-table'});
  for(const [key,value] of [['white',field.w.toFixed(4)],['black',field.s.toFixed(4)],['full',field.v.toFixed(4)],
    ['lab',field.lab.map(x=>x.toFixed(5)).join(' / ')],['rgb',field.rgb.join(' / ')]])table.append(el('dt',{},t(key,locale)),el('dd',{},value));
  const relationEvidence=Engine.harmonyRuleRegistry().rules.find(rule=>rule.id===state.relation);
  const sourcePages=group?.provenance.sourcePages||((state.activeView==='triangle'||field.source==='interpolated')?relationEvidence.sourcePages:hueHarmony(state).classification.sourcePages);
  details.append(table,el('h3',{},t('source',locale)),
    el('p',{},t('primary',locale)),
    el('p',{},`${t('pages',locale)} ${sourcePages.join(', ')}`),el('p',{class:'source-note'},t('sourceNote',locale)),
    el('p',{class:'source-note'},t('displayNote',locale)));
  if(group)details.append(el('p',{class:'source-note'},t('depthNote',locale)));
  panel.append(details);
  return {bar,panel};
}
