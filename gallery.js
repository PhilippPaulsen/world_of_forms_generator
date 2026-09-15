/**
 * gallery.js
 * Roadmap 1.11 pattern catalog, Phase (c) pass 1: manifest loading + a
 * filtered, paginated grid of the pre-generated single-cell SVG
 * thumbnails from Phase (a)/(b) (gallery/manifest.jsonl, 28,722 entries).
 * No rendering pipeline involved in this pass - every thumbnail is an
 * existing static SVG file, referenced by <img src>, not computed. On-
 * demand full-tessellation (pass 2) and interactive orbit selection
 * (pass 3) are deliberately out of scope here (see the Phase (c) design
 * session).
 *
 * Standalone page script for gallery.html, paired with it the same way
 * sketch.js pairs with index.html - but this page has no p5/core/*.js
 * dependency in this pass (core/*.js is only needed once on-demand
 * rendering exists, in pass 2).
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

function $(id) { return document.getElementById(id); }

async function loadManifest() {
  const res = await fetch('gallery/manifest.jsonl');
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  return text.split('\n').filter(Boolean).map(line => JSON.parse(line));
}

function init() {
  loadManifest().then(entries => {
    manifest = entries;
    filtered = manifest;
    $('manifest-status').textContent = `${manifest.length} entries loaded.`;
  }).catch(err => {
    $('manifest-status').textContent = `Failed to load manifest: ${err.message} (this page needs to be served over http(s), not opened directly via file://).`;
  });
}

init();
