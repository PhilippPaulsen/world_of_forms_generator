import {memberIdentity} from './composition.mjs';
import {createHarmonyTransfer,HARMONY_SELECTION_EVENT} from './HarmonySelection.mjs';
import {createState,transition,pathSamples,grays,atlas,circle,relationFields,fieldAt} from './state.mjs';
import {t} from './i18n.mjs';
import {el,colorButton,fieldLabel,button} from './components/dom.mjs';
import {Toolbar,RelationControls} from './components/Toolbar.mjs';
import {Navigator} from './components/Navigator.mjs';
import {Inspector} from './components/Inspector.mjs';
import {installTooltip} from './components/Tooltip.mjs';
import {CircleView} from './views/CircleView.mjs';
import {TriangleView} from './views/TriangleView.mjs';
import {RegisterView} from './views/RegisterView.mjs';
import {HarmonyView} from './views/HarmonyView.mjs';
import {CalibrationView} from './views/CalibrationView.mjs';
let state=createState(),lastSelection=null;
const transfer=createHarmonyTransfer(selection=>{
  window.dispatchEvent(new CustomEvent(HARMONY_SELECTION_EVENT,{detail:selection}));
  if(new URLSearchParams(location.search).get('integration')==='1')lastSelection=selection;
});
const root=document.querySelector('#app'),hideTooltip=installTooltip();
const viewComponents={circle:CircleView,triangle:TriangleView,register:RegisterView};
function dispatch(type,value) {
  const focused=document.activeElement?.dataset.focus;
  const scroll=root.querySelector('.register-scroll');const scrollPosition=scroll&&[scroll.scrollLeft,scroll.scrollTop];
  const previousView=state.activeView;
  if(type==='transferHarmony'){transfer(state.composition);state={...state,transferNotice:true};}
  else state={...transition(state,{type,value}),transferNotice:false};
  hideTooltip();render();
  let restore=focused;
  if(['selectedHue','chooseColor','nextHue','previousHue'].includes(type)&&focused?.startsWith('hue-'))restore=`hue-${state.selectedHue}`;
  if(['selectedRegister','browseCell'].includes(type)&&focused?.startsWith('triangle-'))restore=`triangle-${state.selectedRegister}`;
  if(['cell','browseCell','previousHue','nextHue','previousRegister','nextRegister'].includes(type)&&focused?.startsWith('cell-'))restore=`cell-${state.selectedHue}${state.selectedRegister}`;
  if(restore)root.querySelector(`[data-focus="${CSS.escape(restore)}"]`)?.focus({preventScroll:true});
  const newScroll=root.querySelector('.register-scroll');
  if(newScroll&&scrollPosition){newScroll.scrollLeft=scrollPosition[0];newScroll.scrollTop=scrollPosition[1];}
  if(type==='resultOpen'&&value)root.querySelector('#result-detail')?.scrollIntoView({block:'start'});
  if(state.activeView==='register'&&(previousView!=='register'||['cell','browseCell','previousHue','nextHue','previousRegister','nextRegister'].includes(type)))root.querySelector(`[data-focus="cell-${state.selectedHue}${state.selectedRegister}"]`)?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function sampleStrip() {
  const strip=el('section',{class:'sample-section','aria-label':t('samples',state.locale)});
  strip.append(el('div',{class:'sample-heading'},el('span',{},t('continuum',state.locale)),el('span',{},t(state.relation==='isovalent'?'shadowSeries':state.relation,state.locale))));
  const rail=el('div',{class:'sample-scroll'});
  const samples=pathSamples(state);
  samples.forEach((sample,i)=>{
    const selected=state.selectedField.source==='interpolated'&&sample.hueIndex===state.selectedField.hueIndex&&sample.w===state.selectedField.w&&sample.s===state.selectedField.s;
    const node=colorButton(sample,state,()=>dispatch('sample',i),selected,`sample-${i}`);
    node.setAttribute('aria-label',`${t('sample',state.locale)} ${i+1} · ${t('noAtlas',state.locale)}`);
    node.setAttribute('tabindex',selected||i===0?'0':'-1');
    node.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const n=Math.max(0,Math.min(samples.length-1,i+(event.key==='ArrowRight'?1:-1)));dispatch('sample',n);root.querySelector(`[data-focus="sample-${n}"]`)?.focus();}});
    rail.append(node);
  });strip.append(rail,el('p',{class:'sample-note'},t('pathNote',state.locale)));return strip;
}
function render() {
  document.documentElement.lang=state.locale;document.title=t('title',state.locale);
  if(new URLSearchParams(location.search).get('calibration')==='1'){root.replaceChildren(CalibrationView(state));return;}
  const header=el('header',{class:'site-header'},el('div',{class:'brand'},el('h1',{},t('title',state.locale)),el('span',{},t('subtitle',state.locale))),
    el('span',{class:'edition'},t('research',state.locale)));
  const main=el('main',{id:'workspace',tabindex:'-1','aria-label':t(state.activeView,state.locale)});
  main.append(el('div',{class:'workspace-chrome'},RelationControls(state,dispatch),Navigator(state,dispatch)));
  main.append(viewComponents[state.activeView](state,dispatch));
  if(state.seriesRelation){
    const preview=el('section',{class:'series-preview','aria-label':t('relationPreview',state.locale)});
    const take=button('↓','adoptRelation',state,()=>dispatch('adoptRelation'));
    const fields=relationFields(state),rail=el('div',{class:'preview-swatches'});
    fields.forEach(field=>{
      const node=colorButton(field,state,()=>dispatch('adoptRelation',memberIdentity(field)),false,`preview-${field.label}`);
      node.setAttribute('aria-label',`${t('adoptRelation',state.locale)} · ${fieldLabel(field,state.locale)}`);
      node.setAttribute('data-tooltip',`${t('adoptRelation',state.locale)} · ${fieldLabel(field,state.locale)}`);
      rail.append(node);
    });
    preview.append(take,el('span',{class:'preview-origin'},fieldAt(state.selectedHue,state.selectedRegister).label),rail);main.append(preview);
  }
  if(state.displayMode==='continuum'&&state.activeView==='triangle')main.append(sampleStrip());
  const axis=el('section',{class:'gray-axis','aria-label':t('sharedAxis',state.locale)},el('span',{class:'axis-caption'},t('gray',state.locale)));
  grays.forEach(gray=>axis.append(el('div',{class:'gray-step'},colorButton(gray,state,()=>dispatch('gray',gray.letter),state.selectedField.label===gray.label,`gray-${gray.letter}`),el('span',{},gray.letter))));
  main.append(axis);
  if(state.resultOpen)main.append(el('section',{id:'result-detail',class:'result-detail','aria-label':t('resultDetail',state.locale)},
    el('div',{class:'inspector-heading'},el('h2',{},t('resultDetail',state.locale)),el('button',{'aria-label':t('close',state.locale),'data-focus':'close-result',onclick:()=>dispatch('resultOpen',false)},'×')),HarmonyView(state,dispatch)));
  if(lastSelection&&new URLSearchParams(location.search).get('integration')==='1')main.append(el('details',{class:'integration-preview',open:''},el('summary',{},t('integrationPreview',state.locale)),el('pre',{'data-integration-payload':''},JSON.stringify(lastSelection,null,2))));
  const inspector=Inspector(state,dispatch);
  const layout=el('div',{class:`layout ${state.inspectorOpen?'inspector-open':''}`},main,inspector.panel);
  root.replaceChildren(el('a',{class:'skip-link',href:'#workspace'},t('skip',state.locale)),header,Toolbar(state,dispatch),layout,inspector.bar,
    el('footer',{},el('span',{},t('displayNote',state.locale)),el('span',{},`${circle.length} × ${atlas[0].length} + ${grays.length}`)));
  // Keep the active member visible even in a long isovalent series on mobile.
  const rail=root.querySelector('.result-swatches'),active=rail.querySelector('[aria-pressed="true"]');
  const bounds=rail.getBoundingClientRect(),member=active.getBoundingClientRect();
  if(member.left<bounds.left)rail.scrollLeft+=member.left-bounds.left;
  else if(member.right>bounds.right)rail.scrollLeft+=member.right-bounds.right;
  root.querySelector('[data-focus="info"]').setAttribute('aria-expanded',String(state.inspectorOpen));
  root.querySelector('[data-focus="info"]').setAttribute('aria-controls','inspector');
}
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.inspectorOpen){dispatch('inspectorOpen',false);root.querySelector('[data-focus="info"]')?.focus();hideTooltip();}});
render();
