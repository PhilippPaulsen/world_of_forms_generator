import Engine, {ColorSpace} from './engine.generated.mjs';
export const HUE_MAPPINGS = Object.freeze(['current','fixedHigh','gamutAware']);
export const DEFAULT_HUE_MAPPING = 'gamutAware';
export const GAMUT_EPSILON = 1e-9;
const GAMUT_FRACTION = .92;
const old = Engine.hueCircle();
const printed = ['00','04','08','13','17','21','25','29','33','38','42','46','50','54','58','63','67','71','75','79','83','88','92','96'];
const names = ['yellow','orange','red','violet','blue','iceBlue','seaGreen','leafGreen'];
/** Verified 1921 p.32 (PDF 50). Names denote groups of three, not singled-out primaries. */
export function hueIdentity(index) {
  if(!Number.isInteger(index)||index<1||index>24)throw new RangeError('Hue index must be 1..24');
  return {index,printed:printed[index-1],nameKey:names[Math.floor((index-1)/3)],ordinal:(index-1)%3+1,
    sourceStatus:'primary-1921-p32',sourcePage:32};
}
export function fromLch(L,C,h) {
  if(![L,C,h].every(Number.isFinite)||L<0||L>1||C<0)throw new RangeError('Invalid Oklch');
  return [L,C*Math.cos(h*Math.PI/180),C*Math.sin(h*Math.PI/180)];
}
export function inGamut(lab) {
  if(!Array.isArray(lab)||lab.length!==3||!lab.every(Number.isFinite))throw new TypeError('Expected finite Oklab triplet');
  return ColorSpace.oklabToLinear(lab).every(x=>x>=-GAMUT_EPSILON&&x<=1+GAMUT_EPSILON);
}
/** Radial gamut boundary at fixed L/h; 32 deterministic bisections, no channel clipping. */
export function maxChroma(L,h) {
  fromLch(L,0,h);
  let low=0,high=1;
  for(let i=0;i<32;i++){const middle=(low+high)/2;if(inGamut(fromLch(L,middle,h)))low=middle;else high=middle;}
  return low;
}
/** Preserve L/h, reduce only chroma when necessary; final encoder clamps numerical residue only. */
export function mapToGamut(lab) {
  if(!Array.isArray(lab)||lab.length!==3||!lab.every(Number.isFinite)||lab[0]<0||lab[0]>1)throw new RangeError('Invalid display Oklab');
  const rawInGamut=inGamut(lab);
  if(rawInGamut)return {lab:lab.slice(),gamutMapped:false,rawInGamut};
  const [L,a,b]=lab,h=Math.atan2(b,a)*180/Math.PI,C=maxChroma(L,h)*(1-1e-7);
  return {lab:fromLch(L,C,h),gamutMapped:true,rawInGamut};
}
const angles=old.map((_,i)=>(115-i*15+360)%360);
// Maximize chroma on a bounded L grid, then smooth neighboring cusp lightness.
// The L range, grid and smoothing are contemporary screen policy, not historical measures.
const cusps=angles.map(h=>{
  let best={L:.45,C:0};
  for(let i=0;i<=100;i++){const L=.45+i*.005,C=maxChroma(L,h);if(C>best.C)best={L,C};}
  return best.L;
});
const cache=Object.fromEntries(HUE_MAPPINGS.map(mapping=>[mapping,angles.map((h,i)=>{
  const L=mapping==='gamutAware'?(cusps[(i+23)%24]+2*cusps[i]+cusps[(i+1)%24])/4:.72;
  const C=mapping==='current'?.10:mapping==='fixedHigh'?.20:GAMUT_FRACTION*maxChroma(L,h);
  const lab=mapping==='current'?old[i].lab.slice():fromLch(L,C,h);
  return {...hueIdentity(i+1),mapping,lab,oklch:[L,C,h],rgb:ColorSpace.oklabToRgb(lab),
    inGamut:inGamut(lab),linearRgb:ColorSpace.oklabToLinear(lab),calibrated:false,source:'reference'};
})]));
/** Fresh records; historical index identity is independent of replaceable display anchors. */
export function fullColorAnchors(mapping=DEFAULT_HUE_MAPPING) {
  if(!HUE_MAPPINGS.includes(mapping))throw new RangeError('Unknown hue calibration');
  return cache[mapping].map(x=>({...x,lab:x.lab.slice(),oklch:x.oklch.slice(),rgb:x.rgb.slice(),linearRgb:x.linearRgb.slice()}));
}
