import {el} from '../components/dom.mjs';
import {t} from '../i18n.mjs';
import {fieldAt} from '../state.mjs';
import {fullColorAnchors,HUE_MAPPINGS} from '../FullColorCalibration.mjs';
import {MAPPINGS,grayDiagnostic,historicalToDisplay} from '../DisplayCalibration.mjs';

/** Development-only side-by-side display diagnostic, with original field identities. */
export function CalibrationView(state) {
  const locale=state.locale;
  const root=el('main',{class:'calibration'},el('header',{},el('h1',{},t('calibration',locale)),el('a',{href:'./'},t('back',locale))),
    el('p',{},t('calibrationNote',locale)));
  root.append(el('h2',{},t('grayMappings',locale)));
  const comparisons=el('div',{class:'calibration-columns'});
  for(const mapping of MAPPINGS) {
    const rows=grayDiagnostic(mapping);
    const section=el('section',{},el('h2',{},t(mapping,locale)));
    section.append(el('div',{class:'calibration-grays'},rows.map(row=>el('div',{},
      el('div',{class:'calibration-tile',style:`background:rgb(${row.rgb.join(' ')})`}),el('span',{},row.letter)))));
    const table=el('table',{},el('thead',{},el('tr',{},['gray','historicalValue','displayL','deltaL','deltaE'].map(key=>el('th',{scope:'col'},t(key,locale))))));
    table.append(el('tbody',{},rows.map(row=>el('tr',{},[row.letter,row.historicalValue.toFixed(4),row.lab[0].toFixed(4),row.deltaL?.toFixed(4)??'—',row.deltaE?.toFixed(4)??'—'].map(value=>el('td',{},value))))));
    section.append(table,el('h3',{},t('chromaticComparison',locale)));
    for(const hue of [1,5,9,13,17,21])section.append(el('div',{class:'calibration-chromatic'},['ca','ic','nl','pn'].map(register=>{
      const field=fieldAt(hue,register),display=historicalToDisplay(field,mapping,'gamutAware');
      return el('div',{},el('div',{class:'calibration-tile',style:`background:rgb(${display.rgb.join(' ')})`}),
        el('span',{},field.label),el('span',{class:'status'},`${t('displayL',locale)} ${display.lab[0].toFixed(4)} · ${t(display.gamutMapped?'mapped':'inGamut',locale)}`));
    })));
    comparisons.append(section);
  }
  root.append(comparisons);
  const anchors=el('section',{class:'anchor-comparison'},el('h2',{},t('anchors',locale)));
  const table=el('table',{},el('thead',{},el('tr',{},el('th',{},t('hueName',locale)),HUE_MAPPINGS.map(m=>el('th',{},t(m==='current'?'anchorCurrent':m,locale))))));
  const candidates=HUE_MAPPINGS.map(m=>fullColorAnchors(m));
  table.append(el('tbody',{},candidates[0].map((identity,i)=>el('tr',{},
    el('th',{scope:'row'},`${identity.index} · ${t(identity.nameKey,locale)} ${identity.ordinal} / ${identity.printed}`),
    candidates.map(list=>{const anchor=list[i];return el('td',{},
      el('span',{class:'anchor-preview',style:`background:rgb(${anchor.rgb.join(' ')})`}),
      el('span',{},t(anchor.inGamut?'inGamut':'clipped',locale)),
      el('span',{class:'anchor-data'},`${t('lab',locale)} ${anchor.lab.map(x=>x.toFixed(4)).join(' / ')}`),
      el('span',{class:'anchor-data'},`${t('lch',locale)} ${anchor.oklch.map(x=>x.toFixed(4)).join(' / ')}`),
      el('span',{class:'anchor-data'},`${t('rgb',locale)} ${anchor.rgb.join(' / ')}`));})))));
  anchors.append(table);root.append(anchors);return root;
}
