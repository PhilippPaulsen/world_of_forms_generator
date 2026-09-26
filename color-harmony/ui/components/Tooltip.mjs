/** One lightweight tooltip for hover, keyboard focus and tap. Escape dismisses it. */
export function installTooltip() {
  const node=document.createElement('div');node.id='tooltip';node.role='tooltip';node.hidden=true;
  document.body.append(node);let owner=null,dismissed=false;
  const hide=()=>{node.hidden=true;owner?.removeAttribute('aria-describedby');owner=null;};
  const show=event=>{
    if(dismissed)return;
    const target=event.target.closest?.('[data-tooltip]');if(!target){hide();return;}
    hide();owner=target;node.textContent=target.dataset.tooltip;node.hidden=false;target.setAttribute('aria-describedby','tooltip');
    const rect=target.getBoundingClientRect(),width=node.offsetWidth;
    node.style.left=`${Math.max(8,Math.min(innerWidth-width-8,rect.left+rect.width/2-width/2))}px`;
    node.style.top=`${Math.max(8,Math.min(innerHeight-node.offsetHeight-8,rect.bottom+8))}px`;
  };
  document.addEventListener('pointerover',show);document.addEventListener('focusin',show);
  document.addEventListener('pointerdown',event=>{dismissed=false;show(event);});
  document.addEventListener('pointermove',event=>{if(dismissed){dismissed=false;show(event);}});
  document.addEventListener('pointerout',hide);document.addEventListener('focusout',hide);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){dismissed=true;hide();}else if(event.key==='Tab')dismissed=false;});
  document.addEventListener('scroll',hide,true);
  return hide;
}
