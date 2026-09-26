import {el,svg,button} from './dom.mjs';
import {t} from '../i18n.mjs';
import {views,relations} from '../state.mjs';
// Same 24-unit, unfilled, 2px SVG stroke language as the generator's local shape icons.
function icon(type) {
  const root=svg('svg',{viewBox:'0 0 24 24',width:24,height:24,fill:'none',stroke:'currentColor','stroke-width':1.7,'aria-hidden':'true'});
  if(type==='circle')root.append(svg('circle',{cx:12,cy:12,r:8}));
  if(type==='triangle')root.append(svg('path',{d:'M12 3 22 21H2Z'}));
  if(type==='register')root.append(svg('path',{d:'M3 3H21V21H3ZM3 9H21M3 15H21M9 3V21M15 3V21'}));
  if(type==='harmony')root.append(svg('path',{d:'M5 18 12 5 19 18Z'}),...[ [5,18],[12,5],[19,18]].map(([cx,cy])=>svg('circle',{cx,cy,r:2.5,fill:'currentColor'})));
  if(type==='info')root.append(svg('circle',{cx:12,cy:12,r:9}),svg('path',{d:'M12 10V17M12 6V8'}));
  return root;
}
export const relationKeys={isotint:'white',isotone:'black',shadowSeries:'shadow',isovalent:'value'};
export function Toolbar(state,dispatch) {
  const nav=el('nav',{'aria-label':t('views',state.locale),class:'toolbar'});
  const section=(key,children)=>el('div',{class:'tool-group',role:'group','aria-label':t(key,state.locale)},children);
  nav.append(section('views',views.map(view=>button(icon(view),view,state,()=>dispatch('activeView',view),state.activeView===view,`view-${view}`))));
  nav.append(section('cardinality',[2,3,4].map(n=>button(String(n),n===2?'complementary':`chord${n}`,state,()=>dispatch('harmonyMode',n),state.harmonyMode===n,`chord-${n}`))));
  nav.append(section('mode',['atlas','continuum'].map(mode=>button(t(mode,state.locale),mode,state,()=>dispatch('displayMode',mode),state.displayMode===mode,`mode-${mode}`))));
  nav.append(button(icon('info'),'info',state,()=>dispatch('inspectorOpen',!state.inspectorOpen),state.inspectorOpen,'info'));
  return nav;
}
export function RelationControls(state,dispatch) {
  const group=el('div',{class:'relation-controls',role:'group','aria-label':t('relation',state.locale)});
  for(const key of relations)group.append(button(t(relationKeys[key],state.locale),key,state,()=>dispatch('relation',key),state.relation===key,`relation-${key}`));
  return group;
}
