import {el,button,svg} from './dom.mjs';
import {registers,isReferenceCircle} from '../state.mjs';
import {t} from '../i18n.mjs';
// P4 step 2 (visual alignment): the two browse controls wear the generator's .stepper chrome - an icon, the value, and
// two stacked chevrons (tokens.css holds the copied .stepper* CSS). Chrome ONLY: the value text, its aria-label and
// tooltip, the four button ids (data-focus previousHue/nextHue/previousRegister/nextRegister), the dispatch calls and
// the disabled states are exactly what they were as "‹ 01 › ‹ • ›"; integration.test.mjs pins that contract.
// Orientation follows the generator's stepper: the UP chevron goes forward (next), the DOWN chevron back (previous).
const chevron=direction=>svg('svg',{class:'ico',width:18,height:18,viewBox:'0 0 24 24','aria-hidden':'true'},
  svg('path',{d:direction==='up'?'M6 15 L12 9 L18 15':'M6 9 L12 15 L18 9'}));
// the same two icons the generator's #farbe-anchor-hue-stepper / -register-stepper use
const kindIcon=kind=>svg('svg',{class:'ico stepper-icon',width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':2,'aria-hidden':'true'},
  ...(kind==='hue'?[svg('circle',{cx:12,cy:12,r:9})]:[6,12,18].map(y=>svg('line',{x1:4,y1:y,x2:20,y2:y}))));
/** Two independent browse controls. Neither commits a composition edit. */
export function Navigator(state,dispatch) {
  const reference=isReferenceCircle(state),hue=String(state.selectedHue).padStart(2,'0');
  const group=(kind,value,label,previous,next,leftDisabled=false,rightDisabled=false)=>{
    // `previous` (left, disabled at the low bound) is now the down chevron; `next` (right) the up chevron
    const down=button(chevron('down'),previous,state,()=>dispatch(previous),false,previous);
    const up=button(chevron('up'),next,state,()=>dispatch(next),false,next);
    down.disabled=leftDisabled;up.disabled=rightDisabled;
    down.setAttribute('class','stepper-btn');up.setAttribute('class','stepper-btn');
    return el('div',{class:`code-navigator code-${kind} stepper`,role:'group','aria-label':label},kindIcon(kind),
      el('span',{class:'code-value stepper-display',tabindex:'0','aria-label':label,'data-tooltip':label,'data-focus':`code-${kind}`},value),
      el('div',{class:'stepper-chevrons'},up,down));
  };
  return el('div',{class:'code-navigation'},
    group('hue',hue,`${t('hue',state.locale)} ${hue}`,'previousHue','nextHue'),
    group('register',reference?'•':state.selectedRegister,reference?t('full',state.locale):`${t('register',state.locale)} ${state.selectedRegister}`,
      'previousRegister','nextRegister',reference||state.activeView!=='circle'&&state.selectedRegister===registers[0],!reference&&state.selectedRegister===registers.at(-1)));
}
