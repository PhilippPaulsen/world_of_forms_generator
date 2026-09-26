import {el,color} from '../components/dom.mjs';
import {atlas,registers,circle} from '../state.mjs';
import {t} from '../i18n.mjs';
export function RegisterView(state,dispatch) {
  const grid=el('table',{class:'register-grid','aria-label':t('registerNote',state.locale)});
  grid.append(el('thead',{},el('tr',{},el('th',{scope:'col'},t('register',state.locale)),circle.map(h=>el('th',{scope:'col',class:h.index===state.selectedHue?'selected-column':''},String(h.index).padStart(2,'0'))))));
  const body=el('tbody');
  registers.forEach((pair,row)=>{
    const tr=el('tr',{class:pair===state.selectedRegister?'selected-row':''},el('th',{scope:'row'},pair));
    atlas.forEach((triangle,col)=>{
      const field=triangle[row],selected=field.label===`${state.selectedHue}${state.selectedRegister}`;
      const cell=el('button',{type:'button',style:`--color:${color(field)}`,class:`grid-swatch ${selected?'selected':''}`,
        tabindex:selected?0:-1,'aria-pressed':selected,'aria-label':field.label,'data-tooltip':field.label,'data-focus':`cell-${field.label}`,
        onclick:()=>dispatch('cell',{hue:col+1,register:pair}),onkeydown:event=>{
          const deltas={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
          if(deltas[event.key]) {event.preventDefault();const [dx,dy]=deltas[event.key];dispatch('cell',{hue:col+1+dx,register:registers[Math.max(0,Math.min(registers.length-1,row+dy))]});}
        }});
      tr.append(el('td',{class:col+1===state.selectedHue?'selected-column':''},cell));
    });body.append(tr);
  });grid.append(body);
  return el('div',{class:'register-scroll',tabindex:'-1'},grid);
}
