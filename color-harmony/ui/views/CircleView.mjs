import {svg,el,color,activateSVG,fieldLabel} from '../components/dom.mjs';
import {hueHarmony,circleField,circle} from '../state.mjs';
import {t} from '../i18n.mjs';
const point=(angle,r)=>[320+Math.sin(angle)*r,320-Math.cos(angle)*r];
export function CircleView(state,dispatch) {
  const chart=svg('svg',{viewBox:'0 0 640 640',class:'circle-chart','aria-label':t('circle',state.locale)});
  const harmony=hueHarmony(state),selected=new Set(state.selectionKind==='harmony'?harmony.fields.map(f=>f.hueIndex):[state.selectedHue]);
  const points=harmony.fields.map(f=>point((f.hueIndex-1)*Math.PI/12,199));
  if(state.selectionKind==='harmony')chart.append(svg('polygon',{points:points.map(p=>p.join(',')).join(' '),class:'chord-line'}));
  for(const h of circle) {
    const field=circleField(state,h.index),a=(h.index-1)*Math.PI/12;
    const start=a-Math.PI/24+.012,end=a+Math.PI/24-.012;
    const [p1,p2,p3,p4]=[point(start,277),point(end,277),point(end,222),point(start,222)];
    const path=svg('path',{d:`M${p1}A277 277 0 0 1 ${p2}L${p3}A222 222 0 0 0 ${p4}Z`,fill:color(field),
      class:`hue-segment ${state.selectedHue===h.index?'selected':''}`});
    activateSVG(path,()=>dispatch('selectedHue',h.index),`${t('hue',state.locale)} ${h.index} · ${fieldLabel(field,state.locale)}`,`hue-${h.index}`,state.selectedHue===h.index);
    chart.append(path);
    const label=point(a,303);
    chart.append(svg('text',{x:label[0],y:label[1]+4,'text-anchor':'middle',class:`hue-number ${selected.has(h.index)?'marked':''}`},String(h.index).padStart(2,'0')));
    if(state.selectionKind==='harmony'&&selected.has(h.index)) {
      const [cx,cy]=point(a,199),node=svg('g',{},
        svg('circle',{cx,cy,r:22,fill:'transparent'}),
        svg('circle',{cx,cy,r:7,fill:color(field),stroke:'#171717','stroke-width':2}));
      activateSVG(node,()=>dispatch('selectedHue',h.index),`${t('harmony',state.locale)} · ${fieldLabel(field,state.locale)}`,`chord-point-${h.index}`);
      chart.append(node);
    }
  }
  chart.append(svg('rect',{x:275,y:270,width:90,height:90,fill:color(circleField(state,state.selectedHue))}),
    svg('text',{x:320,y:398,'text-anchor':'middle',class:'center-label'},fieldLabel(circleField(state,state.selectedHue),state.locale)));
  chart.addEventListener('keydown',event=>{
    if(['ArrowRight','ArrowLeft'].includes(event.key)){event.preventDefault();dispatch(event.key==='ArrowRight'?'nextHue':'previousHue');}
  });
  return el('div',{class:'circle-view'},chart);
}
