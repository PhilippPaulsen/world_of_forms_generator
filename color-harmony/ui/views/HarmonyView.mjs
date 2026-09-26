import {el,svg,color,colorButton,fieldAction,button} from '../components/dom.mjs';
import {hueHarmony} from '../state.mjs';
import {t} from '../i18n.mjs';
export function HarmonyView(state,dispatch) {
  const shell=el('div',{class:'harmony-view'});
  const choices=el('div',{class:'example-controls',role:'group','aria-label':t('example',state.locale)});
  for(const example of ['regular','shared','substitution','recursive']) choices.append(button(t(example,state.locale),example,state,()=>dispatch('harmonyExample',example),state.harmonyExample===example,`example-${example}`));
  shell.append(choices);
  const compound=state.selectedHarmony;
  if(!compound) {
    const harmony=hueHarmony(state),chart=svg('svg',{viewBox:'0 0 640 470',class:'harmony-chart','aria-label':t('harmony',state.locale)});
    const positions=harmony.fields.map((f,i)=>[320+Math.sin(i*2*Math.PI/harmony.parts)*177,235-Math.cos(i*2*Math.PI/harmony.parts)*160]);
    chart.append(svg('polygon',{points:positions.map(p=>p.join(',')).join(' '),class:'chord-line'}));
    harmony.fields.forEach((field,i)=>{
      const [x,y]=positions[i],foreign=svg('foreignObject',{x:x-36,y:y-36,width:72,height:72});
      foreign.append(colorButton(field,state,fieldAction(field,dispatch),field.hueIndex===state.selectedHue,`harmony-${field.label}`));
      chart.append(foreign,svg('text',{x,y:y+60,'text-anchor':'middle',class:'axis-label'},field.label));
    });
    const name=state.harmonyMode===2?'complementary':state.harmonyMode===3?'triad':'tetrad';
    chart.append(svg('text',{x:320,y:225,'text-anchor':'middle',class:'harmony-name'},t(name,state.locale)),
      svg('text',{x:320,y:252,'text-anchor':'middle',class:'axis-label'},harmony.classification.gaps.join(' · ')));
    shell.append(chart);
  } else {
    const tree=(group,depth=0,path='root')=>{
      const box=el('div',{class:`tree-node depth-${depth}`});
      const key=group.type==='compound-harmony'?(group.relation==='shared-member'?'shared':'substitution'):'gray';
      box.append(el('div',{class:'tree-heading'},t(key,state.locale),el('span',{},`${t('level',state.locale)} ${group.level}`)));
      if(group.groups)box.append(el('div',{class:'tree-branches'},group.groups.map((g,i)=>el('div',{class:'tree-branch'},el('span',{class:'branch-label'},t(group.relation==='substitution'?(i===0?'original':'replacement'):(i===0?'groupA':'groupB'),state.locale)),tree(g,depth+1,`${path}-${i}`)))));
      const members=el('div',{class:'tree-members'});
      group.members.forEach((field,i)=>members.append(colorButton(field,state,fieldAction(field,dispatch),state.selectedField.label===field.label,`tree-${path}-${i}-${field.label}`)));
      if(group.groups)box.append(el('span',{class:'branch-label'},t('active',state.locale)));
      box.append(members);
      if(group.provenance.replacedElement)box.append(el('p',{class:'tree-note'},`${t('substitution',state.locale)}: ${group.provenance.replacedElement.split(':')[1]} · ${t('retained',state.locale)}`));
      if(group.provenance.sharedElements?.length)box.append(el('p',{class:'tree-note'},`${t('shared',state.locale)}: ${group.provenance.sharedElements.map(k=>k.split(':')[1]).join(' · ')}`));
      return box;
    };
    shell.append(el('div',{class:'compound-tree'},tree(compound)));
  }
  return shell;
}
