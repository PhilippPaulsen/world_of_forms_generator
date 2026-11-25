# World of Forms Generator

An interactive p5.js tool for generating symmetrical, tessellating patterns — connect nodes within a geometric net (triangle, square, hexagon), apply reflection and rotation symmetry, and tile the result across the canvas.

Part of the *World of Forms* research project, reviving and extending Wilhelm Ostwald's *Die Harmonie der Formen* / *Die Welt der Formen* through contemporary generative design. See [`ROADMAP.md`](./ROADMAP.md) for the current development plan and [`docs/terminology.md`](./docs/terminology.md) for naming conventions.

## Features

- **Interactive nodes** — click to draw connections (theme lines) within the chosen net
- **Symmetry engine** — reflection, rotation, or both, at 3-fold/6-fold multiplicities (covers both Ostwald's mirror pairs and rotational forms)
- **Tessellation** — patterns tile automatically across the canvas
- **Curve substitution** — replace straight connections with a single adjustable curve
- **Export** — PNG, SVG, and JSON (the JSON export includes a full adjacency list per node, prepared for future face-detection/coloring work)
- **Customizable canvas and node count**

## Setup

### Prerequisites
- [p5.js](https://p5js.org/) (local copy or CDN)
- A modern browser with JavaScript enabled

### Installation
```bash
git clone https://github.com/philipppaulsen/world_of_forms_generator.git
```
Open `index.html` in your browser, or load the code into the [p5.js Web Editor](https://editor.p5js.org/).

### Hosting
Deployed via GitHub Pages and embedded in [ReadyMag](https://readymag.com) via iframe:
```html
<iframe
  src="https://philipppaulsen.github.io/world_of_forms_generator/"
  style="width: 100%; height: 100vh; border: none;">
</iframe>
```

## Usage

1. Choose a net (triangle / square / hexagon) and node count.
2. Adjust canvas size as needed.
3. Select a symmetry mode (rotation only, or rotation + reflection).
4. Click a node, then a second node, to draw a connection.
5. The pattern tessellates across the canvas automatically.
6. Export as PNG, SVG, or JSON; use Clear/Back to reset or undo.

## Related Projects

- [**Die Welt der Formen**](https://www.die-welt-der-formen.de) — the bilingual critical edition this generator accompanies
- [**SpaceHarmony**](https://philipppaulsen.github.io/SpaceHarmony/) — 3D extension of the node-connection principle (Three.js)

## Development

See [`ROADMAP.md`](./ROADMAP.md) for planned features and current implementation status, [`CLAUDE.md`](./CLAUDE.md) for project/workflow conventions, and [`docs/terminology.md`](./docs/terminology.md) for the German↔English vocabulary and the proposed systematic pattern-naming scheme.

Dark mode theming exists in the codebase but is not currently wired into the UI.

## Credits

Developed by Philipp Paulsen, IU International University, 2025.
Inspired by Wilhelm Ostwald's *Die Harmonie der Formen* and *Die Welt der Formen*.

## Typeface

The UI is set in Suisse Int'l (family name `SuisseIntl`), a commercial typeface that is not in this repository. The website loads it from `https://bachmann-paulsen.de/fonts/` (CORS for that domain only). Locally and in forks that request is blocked and the page shows the fallback: `--font-ui` = `"SuisseIntl", "SuisseIntl Fallback" (Arial, metrics-matched), system-ui, "Helvetica Neue", Arial, sans-serif`. The browser console shows an expected CORS message for the font files. Please do not add Suisse font files to a fork; `.gitignore` and `tools/ui/test-no-suisse-fonts.js` guard against it.

## License

MIT, see [`LICENSE`](./LICENSE). The typeface Suisse Int'l is not part of this repository (own licence, see `assets/fonts/LICENSE-SuisseIntl.md`); `vendor/p5-1.9.0.js` is LGPL-2.1 (`vendor/VERSIONS.md`).

## Releases and rollback

Changes are listed in [`CHANGELOG.md`](./CHANGELOG.md). A release is a git tag (`vX.Y.Z`); the older merges carry `pre-*` tags. The live site is GitHub Pages from `main`, so a rollback is a commit on `main` that restores a known state; the old state stays in history.

```bash
# see what a tag contains, without changing anything
git tag -n1
git diff --stat <tag> main

# roll back the published files to a tag (new commit, history kept)
git checkout main
git revert --no-edit <bad-commit>        # one change, or
git restore --source=<tag> --staged --worktree -- .   # all files as in <tag>
git commit -m "Roll back to <tag>"
git push                                  # publishes (GitHub Pages)
```

After a rollback bump the shared `?v=` marker in `index.html`, `gallery.html` and `color-harmony/ui/index.html` so browsers do not serve cached files.