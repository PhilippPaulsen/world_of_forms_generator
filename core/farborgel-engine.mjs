/**
 * core/farborgel-engine.mjs
 * Group D Phase B4: a thin, hand-written ESM wrapper around the real Farborgel color-harmony
 * engine's CommonJS files (color-harmony/ColorSpace.js, HarmonyGrammar.js, CompoundHarmony.js,
 * ColorHarmonyEngine.js). Pure load/re-export - no engine logic is reimplemented here.
 *
 * WHY THIS FILE EXISTS: color-harmony/ui/composition.mjs, HarmonySelection.mjs and their own
 * dependencies (FullColorCalibration.mjs, DisplayCalibration.mjs) import an ESM adapter at
 * './engine.generated.mjs' - but that file is a BUILD ARTIFACT (color-harmony/ui/build.js),
 * listed in color-harmony/ui/.gitignore, and not committed. This generator has no build step
 * (CLAUDE.md: plain <script> tags, deployed straight from committed files via GitHub Pages), so
 * nothing here can depend on a gitignored file existing. This wrapper is committed instead,
 * fetching the real engine files' ACTUAL CURRENT source at runtime (never a copied/embedded
 * snapshot) and wiring them together with the same require()/module.exports factory-registry
 * approach build.js's own generated output uses - so it exposes the identical shape
 * (`ColorSpace` named, the engine class as default) that ./engine.generated.mjs would.
 *
 * color-harmony/ui/composition.mjs, HarmonySelection.mjs, FullColorCalibration.mjs and
 * DisplayCalibration.mjs each had their one `import ... from './engine.generated.mjs'` line
 * changed to import from here instead - their only edit, see the Phase B4 report for exactly
 * which lines. Nothing else in those files was touched.
 *
 * tools/color/test-farborgel-engine-wrapper.js runs color-harmony/ui/build.js for real and
 * compares its actual generated output's exports against this wrapper's, so a future change to
 * the CJS engine files that this wrapper hasn't kept pace with fails loudly instead of drifting
 * silently.
 *
 * NODE SUPPORT: browsers get here via fetch(); Node's native fetch does not support file:// URLs
 * (confirmed directly), so under Node this reads the same files with fs instead - same bytes,
 * same require()/module.exports wiring below, just a different way to get the text in. This lets
 * tools/color/test-farborgel-selection.js import color-harmony/ui/composition.mjs and
 * HarmonySelection.mjs DIRECTLY and unmodified in a headless test, rather than needing a second,
 * hand-reconstructed copy of their logic (like test-farborgel-engine-wrapper.js's own comparison
 * has to, for the engine files alone - this file being loadable in Node removes that need for
 * everything built ON TOP of it).
 */

const ENGINE_BASE = new URL('../color-harmony/', import.meta.url);
// Cache-busting (P0): this module is itself loaded as `farborgel-engine.mjs?v=<project version>` - via the
// <script type="importmap"> in index.html / color-harmony/ui/index.html, see CLAUDE.md's cache-busting note -
// but the four engine files it fetches below are NOT ES-module imports, so no import map reaches them. They
// get the SAME `?v=` from this module's own URL (one source of truth: the import map). Absent (Node, a bare
// load without the map) = no suffix, i.e. today's behavior.
const VERSION = new URL(import.meta.url).searchParams.get('v');
const MODULE_NAMES = ['ColorSpace.js', 'HarmonyGrammar.js', 'CompoundHarmony.js', 'ColorHarmonyEngine.js'];
const isNode = typeof process !== 'undefined' && !!process.versions && !!process.versions.node;

async function readModuleText(name) {
    const url = new URL(name, ENGINE_BASE);
    if (isNode) {
        const { readFile } = await import('node:fs/promises');
        return readFile(url, 'utf8');
    }
    if (VERSION) url.searchParams.set('v', VERSION);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`core/farborgel-engine.mjs: failed to fetch ${name} (${res.status})`);
    return res.text();
}

// All four files are read up front (their require() calls below run synchronously against this
// in-memory text, exactly mirroring how build.js embeds their text at build time - the only
// difference is WHEN the text is captured: here, at load time, from the real files on disk).
const sources = {};
for (const name of MODULE_NAMES) {
    sources['./' + name] = await readModuleText(name);
}

const cache = {};
function requireEngine(id) {
    if (!(id in sources)) throw new Error('core/farborgel-engine.mjs: unknown engine module ' + id);
    if (!cache[id]) {
        const module = { exports: {} };
        cache[id] = module;
        // eslint-disable-next-line no-new-func -- the real engine files' own CJS source, evaluated verbatim
        const factory = new Function('module', 'exports', 'require', sources[id]);
        factory(module, module.exports, requireEngine);
    }
    return cache[id].exports;
}

export const ColorSpace = requireEngine('./ColorSpace.js');
export default requireEngine('./ColorHarmonyEngine.js');
