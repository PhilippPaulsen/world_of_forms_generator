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
const filterState = { shape: 'all', order: 'all', k: 'all' };

// Custom orbit combinations (Roadmap 1.11 gallery Phase (c), pass 3).
// The only symmetry mode any manifest entry or the live app currently
// supports - no selector needed yet (Phase (c) design session: the
// manifest schema already accommodates a future mode axis with zero
// restructuring, but building the UI for it ahead of a second mode
// existing would be speculative).
const ORBIT_BUILDER_SYMMETRY_MODE = 'rotation_reflection6';
let orbitBuilderState = null;      // {shape, order, symmetryMode, grid, table} from gallery-render.js's buildOrbitTable() - cached per shape+order, rebuilt only when the selection actually changes
let selectedOrbitIds = new Set();  // orbit ids the user has toggled on, for THIS orbitBuilderState only

function $(id) { return document.getElementById(id); }

async function loadManifest() {
  const res = await fetch('gallery/manifest.jsonl');
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  return text.split('\n').filter(Boolean).map(line => JSON.parse(line));
}

// Canonical display order for shapes actually present in the data -
// "dynamically populated" means never assuming a shape/order/k exists,
// not that a sensible fixed ordering can't be applied to whichever
// values ARE present (matches index.html's own triangle/square/hex
// icon order).
const SHAPE_ORDER = ['triangle', 'square', 'hex'];

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
    (filterState.k === 'all' || e.count === filterState.k)
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
    btn.addEventListener('click', () => onSelect(value));
    container.appendChild(btn);
  };
  makeBtn('All', 'all');
  values.forEach(v => makeBtn(String(v), v));
}

function renderShapeFilter() {
  const shapes = SHAPE_ORDER.filter(s => manifest.some(e => e.shape === s));
  renderFilterRow('shape-filter', shapes, filterState.shape, value => {
    filterState.shape = value;
    filterState.order = 'all';
    filterState.k = 'all';
    renderOrderFilter();
    renderKFilter();
    applyFilters();
  });
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

// Custom orbit combinations (Roadmap 1.11 gallery Phase (c), pass 3).
// Called on every filter change (from applyFilters(), below) - shows
// the placeholder unless BOTH Shape and Order are a concrete value
// (computeThemeLineOrbits() needs one specific grid, not "all shapes"
// or "all orders"). Rebuilding the grid+orbit table (and clearing the
// user's selection) only happens when the shape+order pair actually
// changed - an unrelated k-filter click still calls applyFilters(),
// and shouldn't discard an in-progress orbit selection.
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

  if (orbitBuilderState && orbitBuilderState.shape === shape && orbitBuilderState.order === order) {
    placeholder.hidden = true;
    content.hidden = false;
    return; // same selection as before - keep the existing orbit table and the user's in-progress selection
  }

  selectedOrbitIds = new Set();
  try {
    orbitBuilderState = buildOrbitTable(shape, order, ORBIT_BUILDER_SYMMETRY_MODE);
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

function openDetailView(entry) {
  const container = $('detail-svg-container');
  container.innerHTML = '';
  $('detail-title').textContent = entryLabel(entry) + ' — full tessellation';
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
  loadManifest().then(entries => {
    manifest = entries;
    $('manifest-status').textContent = `${manifest.length} entries loaded.`;
    renderShapeFilter();
    renderOrderFilter();
    renderKFilter();
    applyFilters();
  }).catch(err => {
    $('manifest-status').textContent = `Failed to load manifest: ${err.message} (this page needs to be served over http(s), not opened directly via file://).`;
  });
}

init();
