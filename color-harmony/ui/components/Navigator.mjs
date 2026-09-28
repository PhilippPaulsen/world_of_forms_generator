import {el,button} from './dom.mjs';
import {registers,isReferenceCircle} from '../state.mjs';
import {t} from '../i18n.mjs';
/** All stepping and endpoint policy live in shared state transitions. */
export function Navigator(state,dispatch) {
  const circle=state.activeView==='circle';
  const previous=circle?'previousRegister':'previousHue',next=circle?'nextRegister':'nextHue';
  const left=button('‹',previous,state,()=>dispatch(previous),false,previous);
  const right=button('›',next,state,()=>dispatch(next),false,next);
  if(circle){left.disabled=isReferenceCircle(state);right.disabled=!isReferenceCircle(state)&&state.selectedRegister===registers.at(-1);}
  return el('div',{class:'sequence-nav',role:'group','aria-label':t(circle?'register':'hue',state.locale)},left,
    el('span',{},circle?(isReferenceCircle(state)?t('reference',state.locale):state.selectedRegister):String(state.selectedHue).padStart(2,'0')),right);
}
