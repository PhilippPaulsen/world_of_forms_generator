/**
 * tools/presets/test-presets.js
 * Task 160: the data under presets/ (manifest, session files, sources) and the pixel pins.
 *   node tools/presets/test-presets.js
 * 1 manifest (unique slugs, DE and EN complete, schema versions, files exist, bytes true, redirects sane)   2 every session valid (parse + plan, uiMode explicit, no null or duplicate
 * edge, only current colour entries, neutral anchor, grayTones 8)   3 roundtrip: load -> export = the source export (faces by nodes, edges, net 1e-9; colours by the order-keeping gray map)
 * 4 size budget   5 reproducibility (rebuilt in memory = committed)   6 pixel pins (tools/presets/pixel-pins.json, measured in the browser, see the file's own note).
 * NOTHING of the loaded state is compared by pixels here: the pixel comparison runs in the Browser pane (tools/presets/measure-pixels.js), its result is pinned.
 */
const fs = require('fs');
const path = require('path');
const { exportAfterLoad } = require('./convert.js');
const { buildAll, readQuelle, TABLE, OUT } = require('./build-presets.js');
const F = require('../session/fixtures.js');

let checks = 0, failures = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const J = JSON.stringify;
const near = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-9;
    if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => near(x, b[i]));
    if (a && typeof a === 'object') return b && typeof b === 'object' && J(Object.keys(a).sort()) === J(Object.keys(b).sort()) && Object.keys(a).every(k => near(a[k], b[k]));
    return a === b;
};
const SESSION_BUDGET = 20 * 1024, MANIFEST_BUDGET = 16 * 1024;

const manifestText = fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8');
const man = JSON.parse(manifestText);
const table = JSON.parse(fs.readFileSync(TABLE, 'utf8'));

// ---- 1 manifest
check('manifest: presetManifest 1, sessionSchema 2 (= SESSION_SCHEMA_VERSION of core/session.js)', man.presetManifest === 1 && man.sessionSchema === 2 && /SESSION_SCHEMA_VERSION = 2;/.test(fs.readFileSync(path.join(__dirname, '..', '..', 'core', 'session.js'), 'utf8')));
const slugs = man.presets.map(p => p.slug);
check('manifest: slugs unique and [a-z0-9-]+, no leading/trailing hyphen', new Set(slugs).size === slugs.length && slugs.every(s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)), slugs.length + ' presets');
const nonEmpty = s => typeof s === 'string' && s.trim().length > 0;
check('manifest: title and description complete in DE and EN', man.presets.every(p => ['title', 'description'].every(k => p[k] && nonEmpty(p[k].de) && nonEmpty(p[k].en))));
check('manifest: DE and EN texts differ (nothing left untranslated)', man.presets.every(p => p.title.de !== p.title.en && p.description.de !== p.description.en));
check('manifest: no forbidden word in slugs or texts (moebius)', !/m(ö|oe)bius/i.test(manifestText));
check('manifest: category non-empty, listed boolean, mode simple|advanced', man.presets.every(p => nonEmpty(p.category) && typeof p.listed === 'boolean' && (p.mode === 'simple' || p.mode === 'advanced')));
check('manifest: at least six listed (seven chosen), the reserve is not listed', man.presets.filter(p => p.listed).length === 7 && man.presets.filter(p => !p.listed).length === 3, man.presets.filter(p => p.listed).length + ' listed');
check('manifest: file exists and bytes is its length, for every preset', man.presets.every(p => fs.existsSync(path.join(OUT, p.file)) && fs.statSync(path.join(OUT, p.file)).size === p.bytes && p.file === p.slug + '.session.json'));
check('manifest: the table (tools/presets/presets-table.json) and the manifest name the same slugs in the same order', J(table.presets.map(p => p.slug)) === J(slugs));
const red = man.redirects || {};
check('manifest: redirects are an object; no old slug is also a current slug, no target missing, no chain', typeof red === 'object' && Object.keys(red).every(o => !slugs.includes(o) && slugs.includes(red[o])));
check('presets/ holds only the manifest, the session files and quellen/', fs.readdirSync(OUT).filter(f => f !== 'quellen' && f !== 'manifest.json' && !/\.session\.json$/.test(f)).length === 0);

// ---- 2 / 3 per preset
const ctx = F.makeContext({ state: true, export: true });
for (const p of man.presets) {
    const label = p.slug;
    const text = fs.readFileSync(path.join(OUT, p.file), 'utf8');
    const src = JSON.parse(readQuelle(p.slug));
    const parsed = ctx.sb.parseSession(text);
    check(label + ': parseSession ok', parsed.ok, parsed.ok ? '' : parsed.code + ' ' + parsed.detail);
    if (!parsed.ok) continue;
    const plan = ctx.sb.planSessionRestore(parsed.snapshot, { canvasW: 600, canvasH: 600 });
    check(label + ': planSessionRestore ok', plan.ok, plan.ok ? '' : plan.code + ' ' + plan.detail);
    const sn = JSON.parse(text), ent = table.presets.find(x => x.slug === p.slug);
    check(label + ': uiMode explicit and equal to the manifest, grayTones 8, anchor neutral, showFaces per table', sn.settings.uiMode === p.mode && sn.settings.grayTones === 8 && sn.base.faceAnchor && sn.base.faceAnchor.neutral === true && sn.settings.showFaces === ent.showFaces);
    const keys = new Set(), conns = sn.base.connections;
    check(label + ': no null edge, no duplicate, no pending single id', conns.every(c => c.length === 2 && c[0] !== c[1]) && conns.every(c => { const k = Math.min(...c) + '-' + Math.max(...c); if (keys.has(k)) return false; keys.add(k); return true; }), J(conns));
    check(label + ': no layers, no timeline, schema 2', sn.layers.length === 0 && sn.timeline === null && sn.schema === 2);
    let back;
    try { back = exportAfterLoad(text); } catch (e) { check(label + ': load', false, String(e)); continue; }
    const trailsOfFaces = new Set(back.geometry.faces.map(f => f.colorSpec && f.colorSpec.trail).filter(Boolean));
    const stored = sn.base.faceAssignments.map(([k]) => k);
    check(label + ': only the colour entries of current trails are stored (no orphans)', stored.length === trailsOfFaces.size && stored.every(k => trailsOfFaces.has(k)), `${stored.length} entries, ${trailsOfFaces.size} trails`);
    check(label + ': roundtrip faces: the same faces (nodes) as the source export', J(back.geometry.faces.map(f => f.nodeIds.join(','))) === J(src.geometry.faces.map(f => f.nodeIds.join(','))), back.geometry.faces.length + ' faces');
    const cleaned = []; const seen = new Set(); for (const [a, b] of src.geometry.edges) { const k = Math.min(a, b) + '-' + Math.max(a, b); if (a === b || seen.has(k)) continue; seen.add(k); cleaned.push([a, b]); }
    check(label + ': roundtrip lines = the source without null edges', J(back.geometry.edges) === J(cleaned));
    check(label + ': roundtrip net block equal (1e-9)', near(src.meta.netTransform, back.meta.netTransform));
    check(label + ': roundtrip meta: shape, grid, size, symmetry mode, curve, line colour', ['shapeType', 'shapeSizeFactor', 'grid', 'symmetryMode', 'curveType', 'lineColor'].every(k => near(src.meta[k], back.meta[k])));
    const col = (e) => e.geometry.faces.map(f => f.color);
    const so = col(src), sb = col(back);
    const map = new Map(); let fn = true, inj = true, mono = true;
    so.forEach((c, i) => { if (map.has(c) && map.get(c) !== sb[i]) fn = false; map.set(c, sb[i]); });
    const inv = new Map(); for (const [a, b] of map) { if (inv.has(b) && inv.get(b) !== a) inj = false; inv.set(b, a); }
    const lum = h => parseInt(h.slice(1, 3), 16);
    const ents = Array.from(map.entries());
    ents.forEach(([a1, b1]) => ents.forEach(([a2, b2]) => { if ((lum(a1) > lum(a2)) !== (lum(b1) > lum(b2)) && lum(a1) !== lum(a2)) mono = false; }));
    check(label + ': colours: the old->new gray map is a function, one to one, and keeps the light-to-dark order (the same faces share a tone)', fn && inj && mono, ents.length + ' tones');
    check(label + ': size budget (<= 20 KB)', Buffer.byteLength(text) <= SESSION_BUDGET, Buffer.byteLength(text) + ' B');
}
check('manifest size budget (<= 16 KB)', Buffer.byteLength(manifestText) <= MANIFEST_BUDGET, Buffer.byteLength(manifestText) + ' B');

// ---- 7 gallery block (task 169): the start page's order, captions and alt texts, all from the manifest
{
    const gal = man.presets.filter(p => p.gallery).sort((a, b) => a.gallery.order - b.gallery.order);
    const CAPTION_MAX = 56;   // chars; measured (task 169): with the Studio's face every DE and EN caption of the five is ONE line on desktop (440 px) and at most THREE on the phone (187 px); the longest is 54
    check('gallery: five exhibits, the listed presets of the first stage', gal.length === 5 && gal.every(p => p.listed === true), gal.map(p => p.slug).join(' '));
    check('gallery: order is an integer, unique, and runs 1..n without a gap', gal.every((p, i) => Number.isInteger(p.gallery.order) && p.gallery.order === i + 1));
    check('gallery: the order is "strictly additive" (task S1, variant B): lines, fill, sine net, projective net, rotation last', J(gal.map(p => p.slug)) === J(['quadrat-linien', 'quadrat-spiegelung-flaeche', 'quadrat-spiegelung-sinus', 'quadrat-spiegelung-projektiv', 'quadrat-drehung-flaeche']));
    check('gallery: caption and alt complete in DE and EN, non-empty, DE differs from EN', gal.every(p => ['caption', 'alt'].every(k => p.gallery[k] && nonEmpty(p.gallery[k].de) && nonEmpty(p.gallery[k].en) && p.gallery[k].de !== p.gallery[k].en)));
    check(`gallery: a caption is one short line (<= ${CAPTION_MAX} characters, DE and EN) and ends with a full stop`, gal.every(p => ['de', 'en'].every(l => p.gallery.caption[l].length <= CAPTION_MAX && /\.$/.test(p.gallery.caption[l]))), gal.map(p => Math.max(p.gallery.caption.de.length, p.gallery.caption.en.length)).join(' '));
    check('gallery: a caption is not the preset description (it names what is new against the previous image)', gal.every(p => p.gallery.caption.de !== p.description.de && p.gallery.caption.en !== p.description.en));
    check('gallery: no caption starts with "Neu:" / "New:" (task 174: the order itself says what is new); every caption starts with a capital letter', gal.every(p => ['de', 'en'].every(l => !/^(Neu|New):/i.test(p.gallery.caption[l]) && /^\p{Lu}/u.test(p.gallery.caption[l]))));
    check('gallery: image is "<slug>.svg", unique', gal.every(p => p.gallery.image === p.slug + '.svg') && new Set(gal.map(p => p.gallery.image)).size === gal.length);
    check('gallery: alt texts do not start with "Bild" / "Image" and do not repeat the title', gal.every(p => !/^(Bild|Image)\b/i.test(p.gallery.alt.de + ' ' + p.gallery.alt.en) && p.gallery.alt.de !== p.title.de && p.gallery.alt.en !== p.title.en));
    check('gallery: only the known keys (order, image, caption, alt), no schema bump (presetManifest stays 1)', gal.every(p => J(Object.keys(p.gallery).sort()) === J(['alt', 'caption', 'image', 'order'])) && man.presetManifest === 1);
    check('gallery: the other presets carry no gallery block', man.presets.filter(p => !p.gallery).length === 5);
}

// ---- 5 reproducibility
{
    const b = buildAll(table, readQuelle);
    const same = Object.entries(b.files).every(([f, t]) => fs.readFileSync(path.join(OUT, f), 'utf8') === t);
    check('reproducible: a rebuild from presets/quellen/ + the table gives exactly the committed files', same);
}

// ---- 6 pixel pins
{
    const pinsPath = path.join(__dirname, 'pixel-pins.json');
    const ok = fs.existsSync(pinsPath);
    check('pixel pins file exists', ok);
    if (ok) {
        const pins = JSON.parse(fs.readFileSync(pinsPath, 'utf8'));
        check('pixel pins: a note with the source (method of task 156), the canvas size and the server commit', typeof pins.source === 'string' && /156/.test(pins.source) && Number.isInteger(pins.canvasPx) && /^[0-9a-f]{7,}/.test(pins.measuredOn));
        check('pixel pins: every slug has integer diffPixels and maxDelta, nothing extra', J(Object.keys(pins.presets).sort()) === J(slugs.slice().sort()) && Object.values(pins.presets).every(v => Number.isInteger(v.diffPixels) && Number.isInteger(v.maxDelta) && v.diffPixels >= 0 && v.maxDelta >= 0));
    }
}
// ---- 8 image pins (task 170): the measured size of every preview image and the pixel difference of the five gallery SVGs against the Studio canvas
{
    const pinsPath = path.join(__dirname, 'svg-pixel-pins.json');
    const ok = fs.existsSync(pinsPath);
    check('svg pins file exists', ok);
    if (ok) {
        const pins = JSON.parse(fs.readFileSync(pinsPath, 'utf8'));
        const gal = man.presets.filter(p => p.gallery).map(p => p.slug).sort();
        check('svg pins: source note names the method, canvas size and the Studio commit it was measured on', typeof pins.source === 'string' && /render-images\.js/.test(pins.source) && pins.canvasPx === 1200 && /^[0-9a-f]{7,}/.test(pins.measuredOn));
        check('svg pins: every gallery slug has integer diffPixels / maxDelta, nothing extra', J(Object.keys(pins.svgPixelDifference).sort()) === J(gal) && Object.values(pins.svgPixelDifference).every(v => Number.isInteger(v.diffPixels) && Number.isInteger(v.maxDelta) && v.diffPixels >= 0 && v.maxDelta >= 0));
        check('svg pins: without a net the difference is one grey step (max 1 of 255, under 0.1 % of the pixels); with a net under 3 % of the pixels and no pixel off by more than 128', Object.entries(pins.svgPixelDifference).every(([slug, v]) => /sinus|projektiv|geometrisch/.test(slug) ? v.diffPixels < 0.03 * 1200 * 1200 && v.maxDelta <= 128 : v.maxDelta <= 1 && v.diffPixels < 0.001 * 1200 * 1200));
        check('image sizes: every preset has a final svg under 150 KB and a 600 px png under 150 KB (og:image)', J(Object.keys(pins.imageSizes).sort()) === J(slugs.slice().sort()) && Object.values(pins.imageSizes).every(v => v.svgFinalBytes > 0 && v.svgFinalBytes < 150 * 1024 && v.pngBytes > 0 && v.pngBytes < 150 * 1024), Math.max(...Object.values(pins.imageSizes).map(v => v.pngBytes)) + ' B largest png');
    }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
