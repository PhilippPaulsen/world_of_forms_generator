import {el} from '../components/dom.mjs';
import {t} from '../i18n.mjs';
import {fieldAt} from '../state.mjs';
import {MAPPINGS,grayDiagnostic,historicalToDisplay} from '../DisplayCalibration.mjs';

/** Development-only side-by-side display diagnostic, with original field identities. */
export function CalibrationView(state) {
  const locale=state.locale;
  const root=el('main',{class:'calibration'},el('header',{},el('h1',{},t('calibration',locale)),el('a',{href:'./'},t('back',locale))),
    el('p',{},t('calibrationNote',locale)));
  const comparisons=el('div',{class:'calibration-columns'});
  for(const mapping of MAPPINGS) {
    const rows=grayDiagnostic(mapping);
    const section=el('section',{},el('h2',{},t(mapping,locale)));
    section.append(el('div',{class:'calibration-grays'},rows.map(row=>el('div',{},
      el('div',{class:'calibration-tile',style:`background:rgb(${row.rgb.join(' ')})`}),el('span',{},row.letter)))));
    const table=el('table',{},el('thead',{},el('tr',{},['gray','historicalValue','displayL','deltaL','deltaE'].map(key=>el('th',{scope:'col'},t(key,locale))))));
    table.append(el('tbody',{},rows.map(row=>el('tr',{},[row.letter,row.historicalValue.toFixed(4),row.lab[0].toFixed(4),row.deltaL?.toFixed(4)??'—',row.deltaE?.toFixed(4)??'—'].map(value=>el('td',{},value))))));
    section.append(table,el('h3',{},t('chromaticComparison',locale)));
    for(const hue of [1,5,9,13,17,21])section.append(el('div',{class:'calibration-chromatic'},['ca','ic','pn'].map(register=>{
      const field=fieldAt(hue,register),display=historicalToDisplay(field,mapping);
      return el('div',{},el('div',{class:'calibration-tile',style:`background:rgb(${display.rgb.join(' ')})`}),
        el('span',{},field.label),el('span',{class:'status'},`${t('displayL',locale)} ${display.lab[0].toFixed(4)}`));
    })));
    comparisons.append(section);
  }
  root.append(comparisons);return root;
}
