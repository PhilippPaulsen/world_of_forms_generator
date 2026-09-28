import {activeColor,memberIdentity} from '../composition.mjs';
import {svg,el,color,activateSVG,fieldLabel} from '../components/dom.mjs';
import {circleField,circle} from '../state.mjs';
import {t} from '../i18n.mjs';
const point=(angle,r)=>[320+Math.sin(angle)*r,320-Math.cos(angle)*r];
export function CircleView(state,dispatch) {
  const chart=svg('svg',{viewBox:'0 0 640 640',class:'circle-chart','aria-label':t('circle',state.locale)});
  const members=state.composition.activeHarmony.members, current=activeColor(state.composition);
  const selected=new Set(members.map(f=>f.hueIndex).filter(Boolean));
  const positions=[...selected].sort((a,b)=>a-b);
  const points=positions.map(h=>point((h-1)*Math.PI/12,199));
  if(positions.length>1)chart.append(svg('polygon',{points:points.map(p=>p.join(',')).join(' '),class:'chord-line'}));
  for(const h of circle) {
    const field=circleField(state,h.index),a=(h.index-1)*Math.PI/12;
    const start=a-Math.PI/24+.012,end=a+Math.PI/24-.012;
    const [p1,p2,p3,p4]=[point(start,277),point(end,277),point(end,222),point(start,222)];
    const path=svg('path',{d:`M${p1}A277 277 0 0 1 ${p2}L${p3}A222 222 0 0 0 ${p4}Z`,fill:color(field),
      class:`hue-segment ${current.hueIndex===h.index?'selected':''}`});
    activateSVG(path,()=>dispatch('chooseColor',field),`${t('hue',state.locale)} ${h.index} · ${fieldLabel(field,state.locale)}`,`hue-${h.index}`,memberIdentity(field)===memberIdentity(current));
    path.setAttribute('tabindex',state.selectedHue===h.index?'0':'-1');
    chart.append(path);
    const label=point(a,303);
    chart.append(svg('text',{x:label[0],y:label[1]+4,'text-anchor':'middle',class:`hue-number ${selected.has(h.index)?'marked':''}`},String(h.index).padStart(2,'0')));
    members.map((member,index)=>({member,index})).filter(x=>x.member.hueIndex===h.index).forEach(({member,index},rank)=>{
      const [cx,cy]=point(a,199-rank*24),node=svg('g',{},
        svg('circle',{cx,cy,r:12,fill:'transparent'}),
        svg('circle',{cx,cy,r:7,fill:color(member),stroke:'#171717','stroke-width':2}));
      activateSVG(node,()=>dispatch('setActiveMember',index),`${t('activeMember',state.locale)} ${index+1} · ${fieldLabel(member,state.locale)}`,`chord-member-${index}`,index===state.composition.activeHarmony.activeMemberIndex);
      chart.append(node);
    });
  }
  chart.append(svg('rect',{x:275,y:270,width:90,height:90,fill:color(current)}),
    svg('text',{x:320,y:398,'text-anchor':'middle',class:'center-label'},fieldLabel(current,state.locale)));
  chart.addEventListener('keydown',event=>{
    if(['ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();dispatch(event.key==='ArrowRight'?'nextHue':'previousHue');}
  });
  return el('div',{class:'circle-view'},chart);
}
