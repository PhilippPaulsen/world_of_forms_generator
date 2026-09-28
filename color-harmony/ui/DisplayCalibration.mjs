import Engine from './engine.generated.mjs';
import {fullColorAnchors,DEFAULT_HUE_MAPPING,mapToGamut,inGamut,hueIdentity} from './FullColorCalibration.mjs';

export const MAPPINGS = Object.freeze(['current', 'perceptual', 'logarithmic', 'endpoint']);
export const DEFAULT_MAPPING = 'endpoint';
const EPSILON = 1e-10;
const scale = Engine.letterScale();
const pivot = scale.at(-1).value;
const logarithmic = q => Math.log1p(q / pivot) / Math.log1p(1 / pivot);
// Comparison B: equal ordinal Oklab L steps, sharing C's endpoints.
const light = logarithmic(scale[0].value), dark = logarithmic(pivot);
const knots = [[0, 0], ...scale.map(({value}, i) =>
  [value, light + (dark - light) * i / (scale.length - 1)]).reverse(), [1, 1]];

/** Map non-black content q to contemporary display attenuation; not historical data. */
export function displayAttenuation(q, mapping = DEFAULT_MAPPING) {
  if (!MAPPINGS.includes(mapping)) throw new RangeError('Unknown display mapping');
  if (!Number.isFinite(q) || q < 0 || q > 1) throw new RangeError('Non-black content must be in [0,1]');
  if (mapping === 'current') return q;
  if (mapping === 'logarithmic') return logarithmic(q);
  if (mapping === 'endpoint') {
    const a=scale[0].value,p=scale.at(-1).value;
    // Endpoints .99/.08 remain distinct from white/black vertices. Log-position
    // spacing respects the nearly geometric historical series without changing it.
    if(q<p)return .08*q/p;
    if(q>a)return .99+.01*(q-a)/(1-a);
    return .08+.91*Math.log(q/p)/Math.log(a/p);
  }
  const upper = knots.findIndex(([x]) => x >= q);
  if (upper === 0) return 0;
  const [x0, y0] = knots[upper - 1], [x1, y1] = knots[upper];
  return y0 + (y1 - y0) * (q - x0) / (x1 - x0);
}

/**
 * Return a separate display record. Never mutate/replace atlas coordinates or labels.
 * Re-mix original coordinates with replaceable display anchors in Oklab; q=w+v=1-s.
 * Scale by F(q)/q, then reduce radial chroma only if needed to enter sRGB gamut.
 * Historical Lab/coordinates stay untouched; requested and mapped Lab remain inspectable.
 * Explicit current/current reproduces the previous pipeline including its clipping policy.
 */
export function historicalToDisplay(field, mapping = DEFAULT_MAPPING, hueMapping = mapping === 'current' ? 'current' : DEFAULT_HUE_MAPPING) {
  if (!field || !['w', 's', 'v'].every(k => Number.isFinite(field[k]) && field[k] >= 0 && field[k] <= 1)
      || Math.abs(field.w + field.s + field.v - 1) > EPSILON
      || !Array.isArray(field.lab) || field.lab.length !== 3 || !field.lab.every(Number.isFinite)) {
    throw new TypeError('Display calibration requires valid analytical coordinates and Oklab');
  }
  if(field.hueIndex!==undefined)hueIdentity(field.hueIndex);
  const historicalNonBlack = Math.min(1, field.w + field.v);
  const displayNonBlack = displayAttenuation(historicalNonBlack, mapping);
  const gain = historicalNonBlack === 0 ? 1 : displayNonBlack / historicalNonBlack;
  const mixture = field.hueIndex ? Engine.mix(fullColorAnchors(hueMapping)[field.hueIndex-1].lab,field.w,field.s).lab : field.lab;
  const requestedLab = mixture.map(component => component * gain);
  const mapped = mapping==='current'&&hueMapping==='current' ? {lab:requestedLab,gamutMapped:false,rawInGamut:inGamut(requestedLab)} : mapToGamut(requestedLab);
  const lab=mapped.lab;
  const rgb = Engine.mix(lab, 0, 0).rgb;
  return {mapping, hueMapping, requestedLab, gamutMapped:mapped.gamutMapped, rawInGamut:mapped.rawInGamut, channelClipped:!inGamut(lab), historicalNonBlack, displayNonBlack, displayLightness: lab[0], lab, rgb};
}

/** Unrounded Oklab distances for comparison, not an aesthetic score. */
export function grayDiagnostic(mapping) {
  let previous;
  return Engine.grayAxis().map(field => {
    const display = historicalToDisplay(field, mapping);
    const deltaL = previous ? previous.lab[0] - display.lab[0] : null;
    const deltaE = previous ? Math.hypot(...display.lab.map((x, i) => x - previous.lab[i])) : null;
    previous = display;
    return {letter: field.letter, historicalValue: field.w, ...display, deltaL, deltaE};
  });
}
