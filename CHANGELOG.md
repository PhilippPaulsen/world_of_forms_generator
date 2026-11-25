# Changelog

All notable changes to the World of Forms generator. Format after [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow `vMAJOR.MINOR.PATCH`. The detail per task is in `reports/NNN.md` and `ROADMAP.md`.

## [Unreleased]

### Added
- `LICENSE` (MIT, 2025-2026, Philipp Paulsen) with the exceptions for `assets/fonts/` (SuisseIntl, proprietary webfont licence) and `vendor/p5-1.9.0.js` (LGPL-2.1). A placeholder `assets/fonts/LICENSE-SuisseIntl.md` awaits the licence proof. (Task 129)
- `vendor/VERSIONS.md`: version, source and SHA-256 of the bundled p5.js. (Task 129)

### Changed
- p5.js 1.9.0 (the same non-minified build as before) is served from `vendor/p5-1.9.0.js`, no longer from jsDelivr. `tools/ui/test-p5-names.js` reads the local tag. (Task 129)
- Shared `?v=` marker 20270106rela in `index.html`, `gallery.html`, `color-harmony/ui/index.html`. (Task 129)

### Removed
- The Google Fonts request for Material Icons and its unused CSS rule (`.icon-btn .material-icons`); the UI icons are inline SVG. No layout change (before/after screenshots in `reports/129-bilder/`). (Task 129)

## Status as of 2026-11-25 (retrospective, grouped by task; state `39fcaa94`, Task 128)

### Möbius net 3C and net families (Tasks 119-128)
- Projective net (Netzart 3C) for square, triangle and hexagon (full format); net-type stepper; net-family name in the readout; first-ground visibility; plan for the half format (121-128).

### Animation export (Tasks 114-117)
- Timeline and spatial morph as ZIP of PNG frames and of SVG frames (`core/anim-export.js`).

### Net Field and even sizes (Tasks 086-113)
- Field net for square, triangle and hexagon at every size 3..9; face fills on a Field; hexagon layers on the base grid (086-113).
- Face fixes: collinear splitting, draw order of fills, shadow-line rule, concentric colour correspondence (095, 098, 100, 103).

### Non-square area, size, colour mapping (Tasks 073-084)
- Area X x Y within 1:3 with form-true side lengths; resize keeps lines, layers, timeline and colours (re-keyed); session, URL (`size=XxY`) and export carry it.

### Pattern grid, naming, transport v2 (Tasks 052-072)
- GridSpec, position 2 (Lage 2), systematic pattern names and glossary, session v2 (autosave), transport v2 (URL and paste), catalog v2.

### Internationalisation (Tasks 041-050)
- German/English UI (`ui-i18n.js`), `?lang=`, terminology alignment.

### Spatial morph, colours and SVG (Tasks 006-040)
- Spatial morph with faces, colours (playback and spatial), line switch (Task 024), SVG export of the morph, d3 filter, tile reuse, performance measurements.

### Test infrastructure (Tasks 001-002)
- `tools/proof.sh L0-L3`, proof output cache, `reports/` per task.

### Earlier (before the task numbering; see `ROADMAP.md`)
- Generator core, symmetry, curves, face detection and colouring, layers, timeline, net warp, UI rework and phone layout, Farborgel colour-harmony integration. Tags `pre-ui-rework` ... `pre-morph` mark the merges.
