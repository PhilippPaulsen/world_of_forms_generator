/**
 * gallery.js
 * Roadmap 1.11 pattern catalog, Phase (c). Pass 1: manifest loading + a
 * filtered, paginated grid of the pre-generated single-cell SVG
 * thumbnails from Phase (a)/(b) (gallery/manifest.jsonl, 28,722 entries)
 * - every thumbnail is an existing static SVG file, referenced by
 * <img src>, not computed. Pass 2: clicking a thumbnail opens a detail
 * view rendering that entry's full tessellation on demand, via
 * gallery-render.js's renderFullTessellationSVG() (core/*.js, loaded
 * alongside this file - see gallery.html). Interactive orbit selection
 * (pass 3) remains deliberately out of scope here (see the Phase (c)
 * design session).
 *
 * Pass 3: below a Shape+Order selection, a "Custom Orbit Combinations"
 * section shows that configuration's full orbit table (one on-demand
 * single-cell preview per orbit, via gallery-render.js's
 * buildOrbitTable()/renderSingleCellSVG()) and lets the user select a
 * subset to generate C(selected, k) combinations from - live, never
 * looked up (the manifest only stores the full k=2,3,4 enumeration,
 * never an arbitrary user-chosen subset).
 *
 * Standalone page script for gallery.html, paired with it the same way
 * sketch.js pairs with index.html.
 */

// Manifest loading strategy (Phase (c) design session, point 1): the
// real measured size is 5.9MB raw / ~187KB gzip for all 28,722 entries -
// small enough to fetch and parse whole on page load, no pagination or
// server-side index needed for the DATA itself. Pagination below is a
// DOM-rendering concern only (point 2/3) - never re-fetching or
// re-parsing per page.
const PAGE_SIZE = 200;

let manifest = [];   // every parsed manifest entry, loaded once
let filtered = [];   // current filter result over `manifest`
let currentPage = 0;

// Roadmap 1.11 gallery Phase (ii): groupFilter is the single canonical
// symmetry-group filter value - both the Mode/Fold row (the Ostwald-
// terminology-accurate framing: Spiegeling/Drehling + hex-only fold)
// and the direct Group row (an exact groupToken like 'D3') write into
// this SAME field rather than keeping independent state, so they can
// never disagree about what's currently selected, and the Custom Orbit
// Combinations picker (see resolveSingleToken(), updateOrbitBuilder())
// has exactly one place to read the answer from ("one source of
// truth" - see the design session). Shape:
//   { kind: 'all' }
//   { kind: 'category', category: 'spiegeling'|'drehling', fold: 'all'|3|6 }
//   { kind: 'token', token: 'D3' }
// 'category' with fold='all' matches every reflection-containing (resp.
// pure-rotation) token for the current shape at once - e.g. Spiegeling
// alone on triangle matches both Z2 and D3, since Ostwald's own single
// term covers the full reflection-containing case (docs/terminology.md,
// confirmed in an earlier session) - fold narrows to one specific n.
const filterState = { shape: 'all', order: 'all', k: 'all', groupFilter: { kind: 'all' } };

function resetGroupFilter() {
  filterState.groupFilter = { kind: 'all' };
}

// Does entry.groupToken satisfy the current filterState.groupFilter?
// Pure predicate over the manifest's own groupToken strings - never
// needs a raw symmetryMode value (that's only needed by the orbit
// builder's own mirroring, see resolveSingleToken()/rawModeForToken()
// below - a separate concern from filtering the already-generated
// manifest rows).
function groupFilterMatches(entry) {
  const gf = filterState.groupFilter;
  if (gf.kind === 'all') return true;
  if (gf.kind === 'token') return entry.groupToken === gf.token;
  // kind === 'category'
  const t = entry.groupToken;
  if (gf.category === 'spiegeling') {
    if (t === 'Z2') return gf.fold === 'all'; // Z2 has no fold variant of its own - only matches the un-narrowed category (in practice fold is hidden for any shape/Z2 combination anyway, since Z2 never occurs for hex, the only shape with a fold row)
    const m = /^D(\d+)$/.exec(t);
    return !!m && (gf.fold === 'all' || Number(m[1]) === gf.fold);
  }
  if (gf.category === 'drehling') {
    const m = /^C(\d+)$/.exec(t);
    return !!m && (gf.fold === 'all' || Number(m[1]) === gf.fold);
  }
  return false;
}

// Real per-shape token list (Roadmap 1.11 gallery Phase (ii), design
// session point 4) - always derived from the manifest itself, never
// hardcoded, so it can never silently span shapes (the exact concern
// flagged in the design session: a raw 'C3' button must only ever be
// offered while looking at triangle, the one real shape it belongs to
// today, even though hex could in principle have its own C3 later).
// Fixed display order (mirror-only, then rotation-only, then dihedral,
// ascending fold) rather than alphabetical - reads as a progression.
const GROUP_TOKEN_ORDER = ['Z2', 'C3', 'C4', 'C6', 'D3', 'D4', 'D6'];

function availableGroupTokens(shape) {
  if (shape === 'all') return [];
  const present = new Set(manifest.filter(e => e.shape === shape).map(e => e.groupToken));
  return GROUP_TOKEN_ORDER.filter(t => present.has(t));
}

// Does the CURRENT filterState.groupFilter narrow the CURRENT shape
// selection down to exactly one real groupToken? Used by the Custom
// Orbit Combinations picker (updateOrbitBuilder()) to decide whether
// there's a single, unambiguous group to build a live orbit table for -
// never guesses when the filter is broader than one token (e.g. 'all',
// or a category spanning >1 token for this shape).
function resolveSingleToken(shape) {
  const gf = filterState.groupFilter;
  const tokens = availableGroupTokens(shape);
  if (gf.kind === 'token') return tokens.includes(gf.token) ? gf.token : null;
  if (gf.kind === 'all') return tokens.length === 1 ? tokens[0] : null;
  const matching = tokens.filter(t => {
    if (gf.category === 'spiegeling') {
      if (t === 'Z2') return gf.fold === 'all';
      const m = /^D(\d+)$/.exec(t);
      return !!m && (gf.fold === 'all' || Number(m[1]) === gf.fold);
    }
    const m = /^C(\d+)$/.exec(t);
    return !!m && (gf.fold === 'all' || Number(m[1]) === gf.fold);
  });
  return matching.length === 1 ? matching[0] : null;
}

// A real raw symmetryMode string that produces the given groupToken for
// the given shape, for buildOrbitTable() (which needs an actual mode,
// not a token) - see the group-verification session's own collapse
// table: triangle/square never distinguish the "3" vs "6" variant
// (rotation3≡rotation6, rotation_reflection3≡rotation_reflection6), so
// either works there; hex genuinely does distinguish them, so the fold
// digit must come from the token's own n for hex specifically.
function rawModeForToken(shape, token) {
  if (token === 'Z2') return 'reflection_only';
  const m = /^([CD])(\d+)$/.exec(token);
  if (!m) return null;
  const fold = shape === 'hex' ? Number(m[2]) : 3;
  return m[1] === 'C' ? `rotation${fold}` : `rotation_reflection${fold}`;
}

let orbitBuilderState = null;      // {shape, order, symmetryMode, grid, table} from gallery-render.js's buildOrbitTable() - cached per shape+order+symmetryMode, rebuilt only when the selection actually changes
let selectedOrbitIds = new Set();  // orbit ids the user has toggled on, for THIS orbitBuilderState only

function $(id) { return document.getElementById(id); }

async function loadManifest() {
  const res = await fetch('gallery/manifest.jsonl');
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  return text.split('\n').filter(Boolean).map(line => JSON.parse(line));
}

// Ostwald plate backfill (docs/terminology.md Part B's "backfill
// table" sub-task, ROADMAP.md 1.11) - a small, hand-curated, ongoing
// mapping from a catalog entry's path to its historical plate name/
// citation, kept in its OWN file (gallery/ostwald-backfill.csv) rather
// than merged into gallery/manifest.jsonl: different update rhythm
// (hand-edited in small increments vs. machine-generated in batch)
// and different ownership (editorial vs. generated), matching this
// project's general practice of not conflating hand-curated and
// generated content. CSV, not JSON, specifically because this is
// spreadsheet-shaped curatorial work (going plate-by-plate through
// Ostwald's book) - opens directly in Excel/Numbers/Sheets, not
// because CSV is simpler to parse (it isn't; JSON.parse would need no
// code at all here).
//
// Handles RFC4180-style quoted fields (a plate label will eventually
// contain a comma) rather than a naive per-line split(',').
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Column order in the file doesn't matter (indexOf, not fixed
// positions) - a person reordering columns in a spreadsheet app
// shouldn't break the lookup. A missing/unrecognized header degrades
// to an empty map rather than throwing (point 4 - never break the
// page over a malformed curatorial file).
function buildBackfillMap(rows) {
  const map = new Map();
  if (rows.length === 0) return map;
  const header = rows[0];
  const pathIdx = header.indexOf('catalogPath');
  const labelIdx = header.indexOf('label');
  const urlIdx = header.indexOf('url');
  if (pathIdx === -1 || labelIdx === -1 || urlIdx === -1) return map;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const path = row[pathIdx];
    if (!path) continue;
    map.set(path, { label: row[labelIdx] || '', url: row[urlIdx] || '' });
  }
  return map;
}

// Never rejects - a missing file (404), an empty file, a network
// error, or a malformed CSV all degrade to "no mappings yet" (an empty
// Map), exactly today's behavior with zero backfill data. This file is
// genuinely optional and expected to start small/empty for a long
// time (ongoing manual curation), so its absence must never be an
// error condition.
async function loadBackfill() {
  try {
    const res = await fetch('gallery/ostwald-backfill.csv');
    if (!res.ok) return new Map();
    const text = await res.text();
    if (!text.trim()) return new Map();
    return buildBackfillMap(parseCsv(text));
  } catch (err) {
    return new Map();
  }
}

let backfillMap = new Map();

// Client-side reimplementation of tools/gallery/catalogPath.js's
// catalogRelativePath() - same "small local port" precedent as
// patternNameFor() below, and even simpler here: a template literal
// does the identical string join catalogPath.js needs Node's `path`
// module for, so there's no path.posix.join-style shim to write at
// all.
function catalogRelativePath(shape, order, groupToken, orbitIds) {
  const sortedIds = [...orbitIds].sort((a, b) => a - b);
  return `gallery/${shape}/${order}/k${sortedIds.length}/${groupToken}/${sortedIds.join('+')}.svg`;
}

// The backfill lookup key for ANY entry, manifest-backed or ad-hoc
// (Phase c task point 2, worked out in the design session): a
// manifest entry already carries the exact path it was generated at
// (entry.path); an ad-hoc Pass 3 entry (an orbit-table tile or a
// generated combination) never had one written to manifest.jsonl, but
// is fully identified by the same (shape, order, groupToken, orbitIds)
// tuple, so the same path formula applies - a backfill mapping is
// about the PATTERN's structural coordinates, not about whether that
// exact combination happened to be pre-generated.
function entryCatalogPath(entry) {
  return entry.path || catalogRelativePath(entry.shape, entry.order, entry.groupToken, entry.orbitIds);
}

// Shared badge for a backfill hit, reused identically across grid
// thumbnails, orbit-table tiles, and combination tiles (the detail
// view gets its own fuller citation instead - see openDetailView()).
// Returns null when there's no match, so every call site can just do
// `if (badge) cell.appendChild(badge)` - purely additive, zero change
// for any entry without one.
function backfillBadgeFor(catalogPath) {
  const info = backfillMap.get(catalogPath);
  if (!info) return null;
  const a = document.createElement('a');
  a.className = 'backfill-badge';
  a.href = info.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = info.label;
  a.title = `Ostwald: ${info.label}`;
  // The badge is its own link inside an otherwise-clickable cell (cell
  // click opens the detail view) - without this, clicking the badge
  // would ALSO trigger the cell's own click handler underneath it.
  a.addEventListener('click', e => e.stopPropagation());
  return a;
}

// Canonical display order for shapes actually present in the data -
// "dynamically populated" means never assuming a shape/order/k exists,
// not that a sensible fixed ordering can't be applied to whichever
// values ARE present (matches index.html's own triangle/square/hex
// icon order).
const SHAPE_ORDER = ['triangle', 'square', 'hex'];

// Roadmap 1.11 gallery Phase (ii): shape icon glyphs, byte-identical
// path/viewBox data to index.html's own .shape-icon-btn SVGs (see that
// file's Shape control-group) - reused rather than redrawn, so the
// catalog's shape row reads as literally the same shapes as the main
// generator's, not a lookalike redrawing that could drift.
const SHAPE_ICON_SVG = {
  triangle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4L4 20h16L12 4z" /></svg>',
  square: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" /></svg>',
  hex: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8.66 5v10L12 22 3.34 17V7L12 2z" /></svg>',
};

// Roadmap 1.11 gallery Phase (ii): Mode row icon glyphs + tooltips,
// byte-identical to index.html's own icon-ified #btn-mode-spiegeling/
// #btn-mode-drehling (see that file's Mode control-group) - same glyph
// vocabulary in both places (mirror pair across a dashed axis;
// circular rotation arrow), same tooltip wording (English description
// first, German term in parens - kept visible, not dropped, per the
// design session). "None" has no catalog equivalent (excluded below -
// zero matching entries), so only these two are needed here.
const MODE_ICON_SVG = {
  spiegeling: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="2,2" /><path d="M4 12 L9 8 L9 16 Z" fill="currentColor" stroke="none" /><path d="M20 12 L15 8 L15 16 Z" fill="currentColor" stroke="none" /></svg>',
  drehling: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12a8 8 0 1 1-2.7-6" /><path d="M20 4v6h-6" /></svg>',
};
const MODE_TOOLTIP = {
  spiegeling: 'Mirror symmetry (Spiegeling)',
  drehling: 'Rotational symmetry (Drehling)',
};

function distinctSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

// Cascading filter option lists: order options depend on the current
// shape selection (or the union across all shapes if shape='all'); k
// options depend on the current shape+order selection the same way.
function availableOrders() {
  const pool = filterState.shape === 'all' ? manifest : manifest.filter(e => e.shape === filterState.shape);
  return distinctSorted(pool.map(e => e.order));
}

function availableKs() {
  let pool = filterState.shape === 'all' ? manifest : manifest.filter(e => e.shape === filterState.shape);
  pool = filterState.order === 'all' ? pool : pool.filter(e => e.order === filterState.order);
  return distinctSorted(pool.map(e => e.count));
}

function applyFilters() {
  filtered = manifest.filter(e =>
    (filterState.shape === 'all' || e.shape === filterState.shape) &&
    (filterState.order === 'all' || e.order === filterState.order) &&
    (filterState.k === 'all' || e.count === filterState.k) &&
    groupFilterMatches(e)
  );
  currentPage = 0;
  $('result-status').textContent = `${filtered.length} entries match the current filter.`;
  renderGrid();
  updateOrbitBuilder();
}

// Pagination (design session point 2/3): never render more than
// PAGE_SIZE <img> elements at once, regardless of how large `filtered`
// is (up to 9,086 for a single shape+order) - the manifest DATA is
// already fully loaded (point 1), this only bounds DOM node count.
function renderGrid() {
  const container = $('gallery-grid');
  container.innerHTML = '';
  const start = currentPage * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const frag = document.createDocumentFragment();
  pageItems.forEach(entry => {
    const cell = document.createElement('div');
    cell.className = 'gallery-cell';

    const img = document.createElement('img');
    img.src = entry.path;
    img.loading = 'lazy';
    img.alt = `${entry.count}*/${entry.groupToken} ${entry.orbitIds.join('+')}`;

    const label = document.createElement('div');
    label.className = 'gallery-cell-label';
    label.textContent = entryLabel(entry);

    cell.appendChild(img);
    cell.appendChild(label);
    const badge = backfillBadgeFor(entryCatalogPath(entry));
    if (badge) cell.appendChild(badge);
    cell.addEventListener('click', () => openDetailView(entry));
    frag.appendChild(cell);
  });
  container.appendChild(frag);

  renderPager();
}

function renderPager() {
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageLabel = `Page ${currentPage + 1} / ${totalPages} (${filtered.length} entries)`;
  const isFirst = currentPage === 0;
  const isLast = currentPage >= totalPages - 1;

  [$('page-info'), $('page-info-bottom')].forEach(el => { el.textContent = pageLabel; });
  [$('prev-page'), $('prev-page-bottom')].forEach(btn => { btn.disabled = isFirst; });
  [$('next-page'), $('next-page-bottom')].forEach(btn => { btn.disabled = isLast; });
}

function goToPage(delta) {
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const next = currentPage + delta;
  if (next < 0 || next >= totalPages) return;
  currentPage = next;
  renderGrid();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function wirePagerControls() {
  $('prev-page').addEventListener('click', () => goToPage(-1));
  $('next-page').addEventListener('click', () => goToPage(1));
  $('prev-page-bottom').addEventListener('click', () => goToPage(-1));
  $('next-page-bottom').addEventListener('click', () => goToPage(1));
}

// One row of "All" + one button per available value; `active` marks the
// current filterState value. `onSelect` gets the raw value ('all' or a
// number) and owns updating filterState + any downstream cascading.
function renderFilterRow(containerId, values, active, onSelect) {
  const container = $(containerId);
  container.innerHTML = '';
  const makeBtn = (label, value) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (value === active ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      // Fix (found during Pass 3 testing): onSelect() below only
      // re-renders DOWNSTREAM rows (e.g. Shape's onSelect rebuilds
      // Order/k, never Shape's own row) plus applyFilters() - so
      // without this, THIS row's own .active class stayed on whatever
      // button was active before the click, since no later render
      // pass ever revisits it. Updating it directly, immediately, on
      // the actual clicked element is simpler and more robust than
      // making every onSelect() remember to re-invoke its own render
      // function too.
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onSelect(value);
    });
    container.appendChild(btn);
  };
  makeBtn('All', 'all');
  values.forEach(v => makeBtn(String(v), v));
}

// Icon-ified variant of renderFilterRow() (Roadmap 1.11 gallery Phase
// (ii)) - "All" stays a plain text button (per the design session:
// there's no single shape glyph for "any shape"), each real shape gets
// its icon (SHAPE_ICON_SVG) instead of a text label, title carries the
// name so it's still identifiable without the label. Same active-
// tracking/click-handler structure as renderFilterRow(), just not
// reusable from it directly since that helper assumes a plain text
// label throughout.
function renderShapeFilter() {
  const shapes = SHAPE_ORDER.filter(s => manifest.some(e => e.shape === s));
  const container = $('shape-filter');
  container.innerHTML = '';
  const makeBtn = (label, value, iconHtml) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (value === filterState.shape ? ' active' : '');
    if (iconHtml) {
      btn.innerHTML = iconHtml;
      btn.title = label;
    } else {
      btn.textContent = label;
    }
    btn.addEventListener('click', () => {
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterState.shape = value;
      filterState.order = 'all';
      filterState.k = 'all';
      // A shape change invalidates any shape-scoped Group selection (the
      // whole point of scoping it - see availableGroupTokens()) and any
      // in-progress Mode/Fold narrowing, so both reset to 'all' rather
      // than silently carrying a now-meaningless token across shapes.
      resetGroupFilter();
      renderOrderFilter();
      renderKFilter();
      renderModeFilter();
      updateFoldVisibility();
      renderFoldFilter();
      renderGroupFilter();
      applyFilters();
    });
    container.appendChild(btn);
  };
  makeBtn('All', 'all', null);
  shapes.forEach(s => makeBtn(s.charAt(0).toUpperCase() + s.slice(1), s, SHAPE_ICON_SVG[s]));
}

function renderOrderFilter() {
  renderFilterRow('order-filter', availableOrders(), filterState.order, value => {
    filterState.order = value;
    filterState.k = 'all';
    renderKFilter();
    applyFilters();
  });
}

function renderKFilter() {
  renderFilterRow('k-filter', availableKs(), filterState.k, value => {
    filterState.k = value;
    applyFilters();
  });
}

// Mode row: "All" + icon buttons for Spiegeling/Drehling (see
// MODE_ICON_SVG/MODE_TOOLTIP above) - "None"/C1 deliberately not
// offered, zero matching catalog entries (the gallery batch generation
// excluded it; unlike index.html, this page browses a fixed generated
// set rather than rendering one live pattern). Clicking a Mode button
// sets filterState.groupFilter to a 'category' value with fold='all'
// (narrowed later by the Fold row, hex only) and re-renders the Group
// row's own active-highlighting, since a category pick and a specific-
// token pick are mutually exclusive views of the same underlying value
// (see the filterState.groupFilter docblock above).
function renderModeFilter() {
  const container = $('mode-filter');
  container.innerHTML = '';
  const gf = filterState.groupFilter;
  const makeBtn = (label, category, iconHtml) => {
    const btn = document.createElement('button');
    const isActive = category === 'all' ? gf.kind === 'all' : (gf.kind === 'category' && gf.category === category);
    btn.className = 'filter-btn' + (isActive ? ' active' : '');
    if (iconHtml) {
      btn.innerHTML = iconHtml + `<span>${label}</span>`;
      btn.title = MODE_TOOLTIP[category];
    } else {
      btn.textContent = label;
    }
    btn.addEventListener('click', () => {
      filterState.groupFilter = category === 'all' ? { kind: 'all' } : { kind: 'category', category, fold: 'all' };
      renderModeFilter();
      updateFoldVisibility();
      renderFoldFilter();
      renderGroupFilter();
      applyFilters();
    });
    container.appendChild(btn);
  };
  makeBtn('All', 'all', null);
  makeBtn('Spiegeling', 'spiegeling', MODE_ICON_SVG.spiegeling);
  makeBtn('Drehling', 'drehling', MODE_ICON_SVG.drehling);
}

// Fold sub-row - hex only, and only meaningful once a Mode category is
// actually selected (unlike index.html, whose Mode always has a
// category by default since the live generator always renders
// something - this page defaults to 'All', where "3-fold vs 6-fold"
// has no meaning yet). Clicking a fold button narrows the CURRENT
// category's fold; it's a no-op (and the row is hidden - see
// updateFoldVisibility()) whenever groupFilter isn't a 'category' kind.
function renderFoldFilter() {
  const container = $('fold-filter');
  container.innerHTML = '';
  const gf = filterState.groupFilter;
  [3, 6].forEach(n => {
    const btn = document.createElement('button');
    const isActive = gf.kind === 'category' && gf.fold === n;
    btn.className = 'filter-btn' + (isActive ? ' active' : '');
    btn.textContent = `${n}-fold`;
    btn.addEventListener('click', () => {
      if (filterState.groupFilter.kind !== 'category') return;
      filterState.groupFilter = { kind: 'category', category: filterState.groupFilter.category, fold: n };
      renderFoldFilter();
      renderGroupFilter();
      applyFilters();
    });
    container.appendChild(btn);
  });
}

function updateFoldVisibility() {
  $('mode-fold-group').hidden = !(filterState.shape === 'hex' && filterState.groupFilter.kind === 'category');
}

// Direct Group (groupToken) filter row - design session point 4. A
// second, additional filter axis, not a replacement for Mode/Fold (see
// the design session for the full reasoning): lets a technically-
// inclined user isolate an exact algebraic group directly, including
// Z2 (mirror-only), which Mode/Fold's Spiegeling category covers but
// can't isolate on its own. Hidden entirely while Shape='all'
// (availableGroupTokens() returns [] - enforces the shape-scoping the
// design session flagged, so a token button is never offered spanning
// more than one real shape's data). Writes the SAME filterState.
// groupFilter value Mode/Fold does, resetting it to 'all' on click of
// "All" here or to a 'token' kind otherwise - mutually exclusive with a
// 'category' selection, per the shared-state design above.
function renderGroupFilter() {
  const wrap = $('group-filter-group');
  const container = $('group-filter');
  container.innerHTML = '';
  const tokens = availableGroupTokens(filterState.shape);
  if (filterState.shape === 'all') {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const gf = filterState.groupFilter;
  const makeBtn = (label, token) => {
    const btn = document.createElement('button');
    const isActive = token === 'all' ? gf.kind === 'all' : (gf.kind === 'token' && gf.token === token);
    btn.className = 'filter-btn' + (isActive ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      filterState.groupFilter = token === 'all' ? { kind: 'all' } : { kind: 'token', token };
      renderGroupFilter();
      renderModeFilter();
      updateFoldVisibility();
      renderFoldFilter();
      applyFilters();
    });
    container.appendChild(btn);
  };
  makeBtn('All', 'all');
  tokens.forEach(t => makeBtn(t, t));
}

// Custom orbit combinations (Roadmap 1.11 gallery Phase (c) pass 3;
// Phase (ii) rewired this to mirror filterState.groupFilter instead of
// a single hardcoded mode - see that field's own docblock for "one
// source of truth"). Called on every filter change (from
// applyFilters(), below) - shows a placeholder unless Shape+Order are
// concrete AND the group filter resolves to exactly one real
// groupToken (resolveSingleToken()) - computeThemeLineOrbits() needs
// one specific grid and one specific symmetryMode, never "all modes"
// or an ambiguous category spanning several. Rebuilding the grid+orbit
// table (and clearing the user's selection) only happens when the
// resolved (shape, order, symmetryMode) triple actually changed - an
// unrelated k-filter click still calls applyFilters(), and shouldn't
// discard an in-progress orbit selection.
function updateOrbitBuilder() {
  const shape = filterState.shape;
  const order = filterState.order;
  const placeholder = $('orbit-builder-placeholder');
  const content = $('orbit-builder-content');

  if (shape === 'all' || order === 'all') {
    placeholder.hidden = false;
    placeholder.textContent = 'Select a specific Shape and Order above to build custom orbit combinations.';
    content.hidden = true;
    orbitBuilderState = null;
    selectedOrbitIds = new Set();
    clearComboResults();
    $('combo-summary').innerHTML = '';
    return;
  }

  const token = resolveSingleToken(shape);
  if (!token) {
    placeholder.hidden = false;
    placeholder.textContent = 'Narrow the Mode/Fold or Group filter above to a single symmetry group to build custom orbit combinations.';
    content.hidden = true;
    orbitBuilderState = null;
    selectedOrbitIds = new Set();
    clearComboResults();
    $('combo-summary').innerHTML = '';
    return;
  }
  const symmetryMode = rawModeForToken(shape, token);

  if (orbitBuilderState && orbitBuilderState.shape === shape && orbitBuilderState.order === order && orbitBuilderState.symmetryMode === symmetryMode) {
    placeholder.hidden = true;
    content.hidden = false;
    return; // same selection as before - keep the existing orbit table and the user's in-progress selection
  }

  selectedOrbitIds = new Set();
  try {
    orbitBuilderState = buildOrbitTable(shape, order, symmetryMode);
  } catch (err) {
    // Fail visibly, matching this project's general practice (and Pass
    // 2's own error-handling precedent) - shouldn't happen for any real
    // shape/order pair reachable through the filter bar, but a broken
    // orbit table should show an explicit message, not silently leave
    // stale content or throw an uncaught error.
    orbitBuilderState = null;
    placeholder.hidden = false;
    placeholder.textContent = `Failed to build orbit table: ${err.message}`;
    content.hidden = true;
    return;
  }

  placeholder.hidden = true;
  content.hidden = false;
  $('orbit-builder-heading').textContent = `${shape} order ${order} — ${orbitBuilderState.table.orbits.length} orbits (${orbitBuilderState.table.groupToken})`;
  renderOrbitGrid();
  renderOrbitSelectionStatus();
  clearComboResults();
  renderComboSummary();
}

function renderOrbitGrid() {
  const container = $('orbit-grid');
  container.innerHTML = '';
  const frag = document.createDocumentFragment();

  orbitBuilderState.table.orbits.forEach(orbit => {
    const tile = document.createElement('div');
    tile.className = 'orbit-tile';

    const preview = document.createElement('div');
    preview.className = 'orbit-tile-preview';
    try {
      preview.innerHTML = renderSingleCellSVG(orbitBuilderState, [orbit.orbitId]);
    } catch (err) {
      preview.textContent = 'render failed';
    }

    const label = document.createElement('label');
    label.className = 'orbit-tile-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'orbit-checkbox';
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(`#${orbit.orbitId}`));

    tile.appendChild(preview);
    tile.appendChild(label);
    const badge = backfillBadgeFor(catalogRelativePath(orbitBuilderState.shape, orbitBuilderState.order, orbitBuilderState.table.groupToken, [orbit.orbitId]));
    if (badge) tile.appendChild(badge);
    tile.addEventListener('click', () => toggleOrbitSelection(orbit.orbitId, tile, checkbox));
    frag.appendChild(tile);
  });

  container.appendChild(frag);
}

function toggleOrbitSelection(orbitId, tile, checkbox) {
  if (selectedOrbitIds.has(orbitId)) {
    selectedOrbitIds.delete(orbitId);
  } else {
    selectedOrbitIds.add(orbitId);
  }
  const isSelected = selectedOrbitIds.has(orbitId);
  tile.classList.toggle('selected', isSelected);
  checkbox.checked = isSelected;
  renderOrbitSelectionStatus();
  // The selection changed, so any already-generated combination grid is
  // now stale (built from the previous selection) - clear it rather
  // than leave a misleading result on screen (same "no stale content"
  // principle as Pass 2's detail view).
  clearComboResults();
  renderComboSummary();
}

function renderOrbitSelectionStatus() {
  const n = selectedOrbitIds.size;
  $('orbit-selection-status').textContent = n === 0
    ? 'No orbits selected yet — click tiles above to select.'
    : `${n} orbit${n === 1 ? '' : 's'} selected.`;
}

// Scale guard (Phase c task, point 4): a generated combination is
// computed and rendered live (never looked up, never pre-generated),
// so - unlike the manifest grid's PAGE_SIZE, which only bounds DOM
// node count against an already-loaded/generated set - this bounds
// whether GENERATING is even a reasonable, meaningful interactive
// action in the first place. 2,000 is a deliberately conservative
// ceiling: roughly 10 pages at COMBO_PAGE_SIZE (still genuinely
// browsable), comfortably under the largest already-shipped Pass 1/2
// case (9,086, hex order 2) even though these are computed live rather
// than static assets, and it rules out the kind of blowup a large
// orbit selection produces (e.g. C(41,4) = 101,270 for all of triangle
// order 6) without needing to be anywhere near a real performance
// limit (on-demand single-cell renders are the cheap case, ~0.05-0.1ms
// each per the design session's own measurement - see gallery-render.js).
const MAX_COMBINATIONS_TO_GENERATE = 2000;
const COMBO_PAGE_SIZE = PAGE_SIZE;

let comboResults = []; // arrays of orbit ids, one per generated combination
let comboK = null;
let comboPage = 0;

function nChooseK(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

// Live counts (Phase c task, point 2) - computed and shown BEFORE
// anything is generated, via a closed-form nCk rather than calling
// kCombinations() just to count (that would mean enumerating up to
// hundreds of thousands of arrays purely to display a number).
function renderComboSummary() {
  const container = $('combo-summary');
  container.innerHTML = '';
  const n = selectedOrbitIds.size;
  if (n === 0) return;

  [2, 3, 4].forEach(k => {
    const count = nChooseK(n, k);
    const row = document.createElement('div');
    row.className = 'combo-summary-row';

    const label = document.createElement('span');
    label.textContent = `k=${k}: C(${n},${k}) = ${count.toLocaleString()} combination${count === 1 ? '' : 's'}`;
    row.appendChild(label);

    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.textContent = `Generate k=${k}`;
    row.appendChild(btn);

    if (count === 0) {
      btn.disabled = true;
      btn.title = `Select at least ${k} orbits.`;
    } else if (count > MAX_COMBINATIONS_TO_GENERATE) {
      btn.disabled = true;
      const warn = document.createElement('span');
      warn.className = 'combo-warn';
      warn.textContent = `Too many combinations (${count.toLocaleString()}) — narrow your selection (max ${MAX_COMBINATIONS_TO_GENERATE.toLocaleString()}) or choose fewer orbits.`;
      row.appendChild(warn);
    } else {
      btn.addEventListener('click', () => generateCombinations(k));
    }

    container.appendChild(row);
  });
}

// kCombinations(n,k) (tools/gallery/combinations.js) returns arrays of
// local INDICES 0..n-1 into the selection, not real orbit ids - mapped
// back via selectedArray below (same indirection
// tools/gallery/generate.js's own batch driver uses for the
// pre-generated manifest, just over an arbitrary user-chosen subset
// here instead of the full 0..orbitCount-1 range).
function generateCombinations(k) {
  const selectedArray = [...selectedOrbitIds].sort((a, b) => a - b);
  const n = selectedArray.length;
  const count = nChooseK(n, k);
  if (count === 0 || count > MAX_COMBINATIONS_TO_GENERATE) return; // defensive only - the button is already disabled in this case

  comboResults = kCombinations(n, k).map(localIds => localIds.map(i => selectedArray[i]));
  comboK = k;
  comboPage = 0;
  renderComboGrid();
}

// Renders exactly like a manifest-backed grid cell (Phase c task, point
// 3 - "should look and behave like manifest-backed grid entries
// visually") but with an inline on-demand <svg> instead of <img src>
// (nothing to reference - these were never pre-generated), and reuses
// openDetailView() unchanged on click: it only ever reads
// (shape, order, symmetryMode, orbitIds) from an entry, which this
// synthetic object has exactly like a real manifest row.
function renderComboGrid() {
  const container = $('combo-grid');
  container.innerHTML = '';
  $('combo-results-heading').textContent = comboResults.length
    ? `k=${comboK} combinations (${comboResults.length.toLocaleString()} total)`
    : '';

  if (comboResults.length === 0) {
    $('combo-pager').hidden = true;
    return;
  }

  const start = comboPage * COMBO_PAGE_SIZE;
  const pageItems = comboResults.slice(start, start + COMBO_PAGE_SIZE);
  const frag = document.createDocumentFragment();

  pageItems.forEach(orbitIds => {
    const entry = {
      shape: orbitBuilderState.shape,
      order: orbitBuilderState.order,
      symmetryMode: orbitBuilderState.symmetryMode,
      groupToken: orbitBuilderState.table.groupToken,
      count: orbitIds.length,
      orbitIds: orbitIds,
    };

    const cell = document.createElement('div');
    cell.className = 'gallery-cell';

    const preview = document.createElement('div');
    preview.className = 'inline-preview';
    try {
      preview.innerHTML = renderSingleCellSVG(orbitBuilderState, orbitIds);
    } catch (err) {
      preview.textContent = `Failed to render: ${err.message}`;
    }

    const label = document.createElement('div');
    label.className = 'gallery-cell-label';
    label.textContent = entryLabel(entry);

    cell.appendChild(preview);
    cell.appendChild(label);
    const badge = backfillBadgeFor(entryCatalogPath(entry));
    if (badge) cell.appendChild(badge);
    cell.addEventListener('click', () => openDetailView(entry));
    frag.appendChild(cell);
  });
  container.appendChild(frag);

  renderComboPager();
}

function renderComboPager() {
  const pagerRow = $('combo-pager');
  pagerRow.hidden = false;
  const totalPages = Math.max(1, Math.ceil(comboResults.length / COMBO_PAGE_SIZE));
  $('combo-page-info').textContent = `Page ${comboPage + 1} / ${totalPages} (${comboResults.length} combinations)`;
  $('combo-prev-page').disabled = comboPage === 0;
  $('combo-next-page').disabled = comboPage >= totalPages - 1;
}

function goToComboPage(delta) {
  const totalPages = Math.max(1, Math.ceil(comboResults.length / COMBO_PAGE_SIZE));
  const next = comboPage + delta;
  if (next < 0 || next >= totalPages) return;
  comboPage = next;
  renderComboGrid();
}

function wireComboPagerControls() {
  $('combo-prev-page').addEventListener('click', () => goToComboPage(-1));
  $('combo-next-page').addEventListener('click', () => goToComboPage(1));
}

function clearComboResults() {
  comboResults = [];
  comboK = null;
  comboPage = 0;
  $('combo-grid').innerHTML = '';
  $('combo-results-heading').textContent = '';
  $('combo-page-info').textContent = '';
  $('combo-pager').hidden = true;
}

// Roadmap 1.11 gallery Phase (c), pass 3: client-side reimplementation
// of tools/gallery/catalogPath.js's patternNameFor() - that file itself
// is NOT safely loadable in a browser (its top-level `const path =
// require('path')` throws a SyntaxError if pre-shimmed, aborting the
// whole script block - confirmed by direct testing in the design
// session), so this is a small local port of just the one function
// actually needed here, mirroring how gallery-render.js already
// reimplements toTileLocal() locally rather than loading core/state.js.
// Byte-identical output to the real function for the same inputs
// (${count}*/${groupToken} ${sortedIds.join('+')}) - verified against
// it in that file's own Node test suite.
function patternNameFor(groupToken, orbitIds) {
  const sortedIds = [...orbitIds].sort((a, b) => a - b);
  return `${sortedIds.length}*/${groupToken} ${sortedIds.join('+')}`;
}

// Detail view (Roadmap 1.11 gallery Phase (c), pass 2): full
// tessellation rendered on demand from (shape, order, symmetryMode,
// orbitIds) via gallery-render.js's renderFullTessellationSVG() - no
// pre-generated asset involved, nothing looked up. Reconstructed and
// discarded on every open/close (point 6 - no stale content carried
// between entries, no lingering DOM cost once closed).
function entryLabel(entry) {
  return `${entry.shape} ${entry.order} — ${patternNameFor(entry.groupToken, entry.orbitIds)}`;
}

// Roadmap: catalog -> generator back-link (design session, points 1/4).
// entry already carries exactly the four fields the URL scheme needs
// (manifest-backed rows and Pass 3 ad-hoc combinations alike - see
// renderGrid()/renderComboGrid() above, both build the same shape) -
// groupToken is NOT part of the URL, since symmetryMode is the portable/
// authoritative value the generator's own orbit-table lookup consumes
// directly (core/orbits.js), not a value derived from groupToken.
// orbitIds joined with a comma, not '+' (the pattern-name display
// format's own separator) - '+' in a URL query VALUE is reserved and
// silently decodes to a space unless percent-encoded, which would
// corrupt the id list.
// Roadmap: catalog -> NEW LAYER back-link extension. `extra` (optional)
// is merged into the same params object - {layer: 'new'} is the only
// value the generator side (sketch.js's parseCatalogUrlParams())
// currently recognizes. A specific EXISTING layer index isn't
// offerable from here at all: this page has no knowledge of any
// generator session's own layer state (a separate page, opened fresh
// via target="_blank") - see the design session point 3.
function catalogEntryGeneratorUrl(entry, extra) {
  const params = new URLSearchParams({
    shape: entry.shape,
    order: entry.order,
    symmetryMode: entry.symmetryMode,
    orbitIds: entry.orbitIds.join(','),
    ...extra,
  });
  return `index.html?${params.toString()}`;
}

function openDetailView(entry) {
  const container = $('detail-svg-container');
  container.innerHTML = '';
  $('detail-title').textContent = entryLabel(entry) + ' — full tessellation';
  $('detail-open-generator').href = catalogEntryGeneratorUrl(entry);
  // Roadmap: catalog -> NEW LAYER back-link extension - a second link,
  // alongside (not replacing) the base-only one above. Replacing it
  // would be a regression for the common case (exploring/editing one
  // pattern standalone) - see the design session point 4.
  $('detail-open-new-layer').href = catalogEntryGeneratorUrl(entry, { layer: 'new' });
  // Roadmap: catalog -> clipboard extension - lets an already-open
  // generator session bring a pattern in as a new layer without
  // navigating (sketch.js's #btn-paste-pattern/applyCatalogPatternToNewLayer()).
  // .onclick (not addEventListener) is deliberate: exactly one handler
  // at a time, closing over THIS entry - reassigned fresh on every
  // openDetailView() call, same "rebuilt on every open, no stale
  // content between entries" rule the two hrefs above already follow,
  // just as a click handler instead of an href (this button has no
  // destination to link to, so it can't be a plain <a> the way the
  // other two are).
  $('detail-copy-pattern').onclick = async () => {
    const payload = JSON.stringify({
      shape: entry.shape,
      order: entry.order,
      symmetryMode: entry.symmetryMode,
      orbitIds: entry.orbitIds,
    });
    const btn = $('detail-copy-pattern');
    const original = btn.textContent;
    try {
      await navigator.clipboard.writeText(payload);
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = original; }, 1500);
    } catch (err) {
      // writeText() is broadly frictionless (unlike the generator
      // side's readText()) but can still fail in an insecure context or
      // a very old browser - reported, not silently swallowed.
      console.warn('Failed to copy pattern to clipboard:', err.message);
      btn.textContent = 'Copy failed';
      setTimeout(() => { btn.textContent = original; }, 1500);
    }
  };

  // Fuller citation than the grid/tile badges (Phase c task point 3) -
  // cleared and rebuilt on every open, same "no stale content between
  // entries" rule as the SVG container itself.
  const citation = $('detail-citation');
  citation.innerHTML = '';
  const info = backfillMap.get(entryCatalogPath(entry));
  if (info) {
    citation.append('Ostwald’s original plate: ');
    const a = document.createElement('a');
    a.href = info.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = info.label;
    citation.appendChild(a);
  }

  try {
    container.innerHTML = renderFullTessellationSVG(entry);
  } catch (err) {
    // Fail visibly (this project's general practice), not silently -
    // shouldn't happen for any real manifest entry (every one was
    // generated and verified during Phase (a)/(b)), but a malformed or
    // hand-edited manifest row should show an explicit message here,
    // not a blank dialog or a swallowed console error.
    container.textContent = `Failed to render full tessellation: ${err.message}`;
  }
  $('detail-overlay').classList.remove('hidden');
}

function closeDetailView() {
  $('detail-overlay').classList.add('hidden');
  // Drop the (possibly several-thousand-element) SVG from the DOM once
  // closed, not just hidden - matches point 6's "no accumulation"
  // requirement and frees the memory rather than leaving it parked
  // behind [hidden].
  $('detail-svg-container').innerHTML = '';
  $('detail-citation').innerHTML = '';
}

function wireDetailView() {
  $('detail-close').addEventListener('click', closeDetailView);
  // Close on background click - same convention as index.html's
  // #help-overlay/#export-overlay (sketch.js: e.target.id check so a
  // click inside the dialog itself doesn't bubble-close it).
  $('detail-overlay').addEventListener('click', e => {
    if (e.target.id === 'detail-overlay') closeDetailView();
  });
}

function init() {
  wirePagerControls();
  wireDetailView();
  wireComboPagerControls();
  // Loaded in parallel, not sequentially - the backfill file is tiny
  // (low hundreds of rows at most) so this adds no meaningful latency,
  // and loadBackfill() never rejects (point 4), so Promise.all here
  // only ever fails due to the manifest itself failing to load.
  Promise.all([loadManifest(), loadBackfill()]).then(([entries, backfill]) => {
    manifest = entries;
    backfillMap = backfill;
    $('manifest-status').textContent = `${manifest.length} entries loaded.`;
    renderShapeFilter();
    renderOrderFilter();
    renderKFilter();
    renderModeFilter();
    updateFoldVisibility();
    renderFoldFilter();
    renderGroupFilter();
    applyFilters();
  }).catch(err => {
    $('manifest-status').textContent = `Failed to load manifest: ${err.message} (this page needs to be served over http(s), not opened directly via file://).`;
  });
}

init();
