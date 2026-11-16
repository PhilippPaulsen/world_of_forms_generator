// Task 078b: a NON-square canvas is also limited by the window height (style.css --canvas-hfit / --canvas-wu, sketch.js canvasFitSync). Source text of style.css and sketch.js + the arithmetic; no browser
// (the measurements in the browser are in reports/078b.md).   STYLE_CSS / SKETCH_JS = mutated copies (sabotage runs)
//   1. a square canvas: both variables are removed (canvasFitSync) and the CSS defaults (100000px, 0) make the new terms inert: --canvas-w = --canvas-w0, for every window height
//   2. a non-square canvas: --canvas-hfit = window height - the head above the canvas (measured: the container's top + the scroll) - the --gap below it; --canvas-wu = W
//   3. the scale s = w / W: min(old scale, height limit), never under 0.4 from the height limit alone; the phone layout (html.ph) does not use it
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const CSS = read('STYLE_CSS', 'style.css'), SK = read('SKETCH_JS', 'sketch.js');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) pass++; else { fail++; console.log('FAIL', n, d === undefined ? '' : d); } };
const css = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const root = (css.match(/:root \{[^}]*--canvas-max[^}]*\}/) || [''])[0];
const decl = (name) => { const m = root.match(new RegExp('--' + name + ':\\s*([^;]+);')); return m ? m[1].replace(/\s+/g, ' ').trim() : null; };
const fn = (SK.match(/\nfunction canvasFitSync\([\s\S]*?\n\}\n/) || [''])[0];

// the CSS formula, evaluated: min(w0, max(hfit * r, 0.4 * wu))
const FORMULA = 'min(var(--canvas-w0), max(calc(var(--canvas-hfit) * var(--canvas-ratio)), calc(0.4px * var(--canvas-wu))))';
check('(1) --canvas-w is min(--canvas-w0, max(--canvas-hfit * ratio, 0.4px * --canvas-wu))', decl('canvas-w') === FORMULA, decl('canvas-w'));
check('(1) the defaults make the new terms inert for a square canvas: --canvas-hfit 100000px, --canvas-wu 0', decl('canvas-hfit') === '100000px' && decl('canvas-wu') === '0', decl('canvas-hfit') + ' ' + decl('canvas-wu'));
const wCss = (w0, hfit, r, wu) => Math.min(w0, Math.max(hfit * r, 0.4 * wu));
check('(1) with the defaults --canvas-w = --canvas-w0 (560 and a narrow 300) at every ratio 1', [560, 300, 632].every(w0 => wCss(w0, 100000, 1, 0) === w0));

// canvasFitSync in a sandbox
const run = (W, H, innerH, headTop, scrollY) => {
    const props = {}, setP = (k, v) => { props[k] = v; }, delP = (k) => { delete props[k]; };
    const sb = { canvasW: W, canvasH: H, document: { documentElement: { style: { setProperty: setP, removeProperty: delP } }, querySelector: () => ({ getBoundingClientRect: () => ({ top: headTop }) }) }, window: { innerHeight: innerH, scrollY }, getComputedStyle: () => ({ getPropertyValue: () => '8px' }), parseFloat, Math, String };
    vm.createContext(sb); vm.runInContext(fn, sb);
    props['--canvas-hfit'] = 'stale'; props['--canvas-wu'] = 'stale';
    sb.canvasFitSync();
    return props;
};
check('(1) a square canvas removes both variables (nothing about it changes, whatever the window height)', fn !== '' && [300, 600, 800, 1024].every(h => { const p = run(600, 600, h, 128, 0); return !('--canvas-hfit' in p) && !('--canvas-wu' in p); }));
const p2 = run(600, 1000, 800, 128, 0);
check('(2) 600 x 1000 in an 800 px window, head 128: --canvas-hfit = 800 - 128 - 8 = 664px, --canvas-wu = 600', p2['--canvas-hfit'] === '664px' && p2['--canvas-wu'] === '600', JSON.stringify(p2));
const p2b = run(1000, 600, 900, 128, 40);
check('(2) the head is the container top PLUS the scroll (168), the window 900: --canvas-hfit = 900 - 168 - 8 = 724px', p2b['--canvas-hfit'] === '724px', JSON.stringify(p2b));
check('(2) a window shorter than the head gives 0px, never negative', run(600, 1000, 100, 128, 0)['--canvas-hfit'] === '0px');
check('(2) it runs from canvasSizeSync() and on resize and orientationchange', /canvasFitSync\(\);\s*\n\}/.test(SK) && /addEventListener\('resize', canvasFitSync\)/.test(SK) && /addEventListener\('orientationchange', canvasFitSync\)/.test(SK));

// the scale: 3/5 (600 x 1000, r = 0.6) in 1280 x 800: hfit 664 -> w = 398.4 (s = 0.664); 3/9 (600 x 1800, r = 1/3): the height limit 664 -> 221 < 0.4 * 600 = 240 -> the floor 240 (s = 0.4)
const w0 = 560 * Math.max(1, 0.6);
check('(3) 3/5 at 1280 x 800: s = 0.664 (the height limit); 5/3 (1000 x 600): the old scale 0.933 stays (it fits)', Math.abs(wCss(w0, 664, 0.6, 600) / 600 - 0.664) < 1e-9 && Math.abs(wCss(560 * 1000 / 600, 664, 1000 / 600, 1000) / 1000 - 0.9333333) < 1e-6);
check('(3) 3/9 at 1280 x 800: the height limit would give s = 0.368, the floor holds it at 0.4 (240 x 720: the page scrolls)', Math.abs(wCss(560, 664, 1 / 3, 600) / 600 - 0.4) < 1e-9);
check('(3) the floor does not lift a width-limited canvas: 9/3 at 768 px (w0 = 632, s = 0.351) stays 0.351', Math.abs(wCss(632, 664, 3, 1800) / 1800 - 632 / 1800) < 1e-9);
// the phone layout defines its own pair and never reads the new variables
const ph = (css.match(/html\.ph \{[^}]*--canvas-ratio[^}]*\}/) || [''])[0];
check('(3) html.ph defines its own --canvas-h / --canvas-w and does not read --canvas-hfit or --canvas-wu', /--canvas-h:/.test(ph) && /--canvas-w:/.test(ph) && !/hfit|--canvas-wu/.test(ph), ph.slice(0, 80));
check('(3) the new variables are read in :root only (one definition of --canvas-w there)', (css.match(/canvas-hfit/g) || []).length === 2 && (css.match(/--canvas-wu/g) || []).length === 2, (css.match(/canvas-hfit/g) || []).length + ' ' + (css.match(/--canvas-wu/g) || []).length);
console.log(`${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
