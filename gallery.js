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
}

function renderOrbitSelectionStatus() {
  const n = selectedOrbitIds.size;
  $('orbit-selection-status').textContent = n === 0
    ? 'No orbits selected yet — click tiles above to select.'
    : `${n} orbit${n === 1 ? '' : 's'} selected.`;
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
