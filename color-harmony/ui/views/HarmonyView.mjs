import {el,colorButton,fieldLabel} from '../components/dom.mjs';
import {memberIdentity} from '../composition.mjs';
import {t} from '../i18n.mjs';
/** Read-only structural tree; selecting a live leaf only changes the active member. */
export function HarmonyView(state,dispatch,structure=state.composition.activeHarmony.group) {
  const members=state.composition.activeHarmony.members;
  const shared=new Set(structure?.provenance.sharedElements||[]);
  const tree=(group,depth=0,path='root')=>{
    const box=el('div',{class:`tree-node depth-${depth}`});
    const key=group.type==='compound-harmony'?(group.relation==='shared-member'?'shared':'substitution'):group.domain==='gray'?'gray':'harmony';
    box.append(el('div',{class:'tree-heading'},t(key,state.locale),el('span',{},`${t('level',state.locale)} ${group.level}`)));
    if(group.groups)box.append(el('div',{class:'tree-branches'},group.groups.map((g,i)=>el('div',{class:'tree-branch'},el('span',{class:'branch-label'},t(group.relation==='substitution'?(i===0?'original':'replacement'):(i===0?'groupA':'groupB'),state.locale)),tree(g,depth+1,`${path}-${i}`)))));
    const colors=el('div',{class:'tree-members'});
    group.members.forEach((field,i)=>{
      const activeIndex=members.findIndex(f=>memberIdentity(f)===memberIdentity(field));
      const node=colorButton(field,state,()=>dispatch('setActiveMember',activeIndex),activeIndex===state.composition.activeHarmony.activeMemberIndex,`tree-${path}-${i}`);
      node.disabled=activeIndex<0;
      if(shared.has(memberIdentity(field))){node.classList.add('shared-member');node.setAttribute('aria-label',`${t('shared',state.locale)} · ${fieldLabel(field,state.locale)}`);}
      colors.append(node);
    });
    if(group.groups)box.append(el('span',{class:'branch-label'},t('active',state.locale)));
    box.append(colors);
    if(group.provenance.replacedElement)box.append(el('p',{class:'tree-note'},`${t('substitution',state.locale)}: ${group.provenance.replacedElement} · ${t('retained',state.locale)}`));
    if(group.provenance.sharedElements?.length)box.append(el('p',{class:'tree-note'},`${t('shared',state.locale)}: ${group.provenance.sharedElements.join(' · ')}`));
    return box;
  };
  return structure?el('div',{class:'compound-tree'},tree(structure)):el('div',{class:'tree-members'},members.map((f,i)=>colorButton(f,state,()=>dispatch('setActiveMember',i),i===state.composition.activeHarmony.activeMemberIndex,`set-${i}`)));
}
