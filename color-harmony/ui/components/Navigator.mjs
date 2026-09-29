import {el,button} from './dom.mjs';
import {registers,isReferenceCircle} from '../state.mjs';
import {t} from '../i18n.mjs';
/** Two independent browse controls. Neither commits a composition edit. */
export function Navigator(state,dispatch) {
  const reference=isReferenceCircle(state),hue=String(state.selectedHue).padStart(2,'0');
  const group=(kind,value,label,previous,next,leftDisabled=false,rightDisabled=false)=>{
    const left=button('‹',previous,state,()=>dispatch(previous),false,previous);
    const right=button('›',next,state,()=>dispatch(next),false,next);
    left.disabled=leftDisabled;right.disabled=rightDisabled;
    return el('div',{class:`code-navigator code-${kind}`,role:'group','aria-label':label},left,
      el('span',{class:'code-value',tabindex:'0','aria-label':label,'data-tooltip':label,'data-focus':`code-${kind}`},value),right);
  };
  return el('div',{class:'code-navigation'},
    group('hue',hue,`${t('hue',state.locale)} ${hue}`,'previousHue','nextHue'),
    group('register',reference?'•':state.selectedRegister,reference?t('full',state.locale):`${t('register',state.locale)} ${state.selectedRegister}`,
      'previousRegister','nextRegister',reference||state.activeView!=='circle'&&state.selectedRegister===registers[0],!reference&&state.selectedRegister===registers.at(-1)));
}
