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

## License

This project is licensed under the MIT License.