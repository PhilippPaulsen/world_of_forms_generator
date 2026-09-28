import {historicalToDisplay} from '../DisplayCalibration.mjs';
import {t} from '../i18n.mjs';
export const el=(tag,attrs={},...children)=>{
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(attrs)) {
    if(key.startsWith('on'))node.addEventListener(key.slice(2),value);
    else if(value!==undefined&&value!==null) node.setAttribute(key,String(value));
  }
  children.flat().forEach(child=>{if(child!==undefined&&child!==null)node.append(child);});
  return node;
};
export const svg=(tag,attrs={},...children)=>{
  const node=document.createElementNS('http://www.w3.org/2000/svg',tag);
  Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,String(v)));
  children.flat().forEach(child=>node.append(child));return node;
};
export const color=field=>`rgb(${historicalToDisplay(field).rgb.join(' ')})`;
export function button(text,key,state,run,selected=false,id=key) {
  return el('button',{type:'button','aria-label':t(key,state.locale),'data-tooltip':t(key,state.locale),
    'data-focus':id,'aria-pressed':String(selected),onclick:run},text);
}
export function colorButton(field,state,run,selected=false,id=field.label) {
  return el('button',{type:'button',class:`swatch ${selected?'selected':''}`,style:`--color:${color(field)}`,
    'aria-label':`${field.label||t('noAtlas',state.locale)} · ${t(field.source==='atlas'?'atlas':'continuum',state.locale)}`,
    'data-tooltip':field.label||t('noAtlas',state.locale),'data-focus':id,'aria-pressed':selected,onclick:run});
}
export function activateSVG(node,run,label,id,selected=false) {
  node.setAttribute('role','button');node.setAttribute('aria-label',label);node.setAttribute('aria-pressed',String(selected));
  node.setAttribute('tabindex',selected?'0':'-1');node.setAttribute('data-focus',id);
  node.setAttribute('data-tooltip',label);node.classList.add('color-node');
  node.addEventListener('click',run);
  node.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();run();}});
  node.append(svg('title',{},label));return node;
}
export function fieldAction(field,dispatch) {
  return ()=>field.hueIndex?dispatch('cell',{hue:field.hueIndex,register:field.label.replace(/^\d+/,'')}):dispatch('gray',field.letter);
}
