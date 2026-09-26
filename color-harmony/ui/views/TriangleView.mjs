import {svg,el,color,activateSVG} from '../components/dom.mjs';
import {atlas,letters,fieldRelations,anchor,pathSamples,registers} from '../state.mjs';
import {t} from '../i18n.mjs';
export function TriangleView(state,dispatch) {
  const chart=svg('svg',{viewBox:state.displayMode==='continuum'&&state.relation!=='isovalent'?'0 0 720 580':'85 10 550 525',class:'triangle-chart','aria-label':t('triangle',state.locale)});
  const selected=anchor(state),data=fieldRelations(state);
  const set=new Set([selected.label,...(state.relation==='isovalent'?[]:data[state.relation==='isotint'?'isotints':state.relation==='isotone'?'isotones':'shadowSeries']).map(f=>f.label)]);
  if(state.displayMode==='continuum'&&state.relation!=='isovalent') {
    const position=f=>[65*f.w+655*f.s+360*f.v,500*(f.w+f.s)+55*f.v];
    chart.append(svg('path',{d:'M65 500 360 55 655 500Z',class:'triangle-outline'}));
    const samples=pathSamples(state);
    chart.append(svg('polyline',{points:samples.map(f=>position(f).join(',')).join(' '),class:'chord-line'}));
    samples.forEach((sample,i)=>{
      const chosen=state.selectedField.source==='interpolated'&&sample.w===state.selectedField.w&&sample.s===state.selectedField.s;
      const [cx,cy]=position(sample),node=svg('circle',{cx,cy,r:chosen?13:9,fill:color(sample),class:`sample-node ${chosen?'selected':''}`});
      activateSVG(node,()=>dispatch('sample',i),`${t('sample',state.locale)} ${i+1} · ${t('noAtlas',state.locale)}`,`triangle-sample-${i}`,chosen);
      if(i===0&&!samples.some(f=>state.selectedField.source==='interpolated'&&f.w===state.selectedField.w&&f.s===state.selectedField.s))node.setAttribute('tabindex','0');
      chart.append(node);
    });
    for(const [key,x,y] of [['whiteCorner',65,536],['blackCorner',655,536],['full',360,30]])chart.append(svg('text',{x,y,'text-anchor':'middle',class:'axis-label'},t(key,state.locale)));
  } else {
    // Display layout in letter-index space, explicitly not a barycentric interpolation.
    for(const field of atlas[state.selectedHue-1]) {
      const pair=field.label.replace(/^\d+/,''),white=letters.indexOf(pair[0]),black=letters.indexOf(pair[1]);
      const row=6-(white-black-1),cx=360+(black-row/2)*79,cy=65+row*70;
      const group=svg('g',{class:`atlas-node ${field.label===selected.label?'selected':''}`});
      group.append(svg('circle',{cx,cy,r:34,fill:'transparent'}));
      if(set.has(field.label))group.append(svg('circle',{cx,cy,r:29,class:'relation-ring'}));
      group.append(svg('circle',{cx,cy,r:24,fill:color(field)}));
      if(field.label===selected.label)group.append(svg('path',{d:`M${cx-5} ${cy+34}h10`,stroke:'currentColor','stroke-width':3}));
      activateSVG(group,()=>dispatch('selectedRegister',pair),field.label,`triangle-${pair}`,field.label===selected.label);chart.append(group);
    }
  }
  chart.addEventListener('keydown',event=>{
    if(state.displayMode==='atlas'&&['ArrowLeft','ArrowRight'].includes(event.key)) {
      event.preventDefault();const n=registers.indexOf(state.selectedRegister);dispatch('selectedRegister',registers[(n+(event.key==='ArrowRight'?1:registers.length-1))%registers.length]);
    }
  });
  return el('div',{class:'triangle-view'},chart);
}
