# World of Forms Generator

A creative tool for generating symmetrical tessellations with interactive connections and customizable settings. The pattern generator lets users connect nodes in a central square, apply symmetry rules (rotation and reflection), and tessellate the resulting designs across a grid of tiles.

## Features

- **Interactive Nodes**: Click on nodes to draw connections.
- **Symmetry Modes**: Choose between "Rotation" or "Rotation and Reflection" for symmetrical patterns.
- **Tessellation**: Patterns are tessellated across tiles.
- **Customizable Canvas**: Adjust the canvas size and the number of nodes dynamically.
- **Reset Options**: Use "Clear" to reset all connections and "Back" to remove the last connection.

## Getting Started

### Prerequisites
- [p5.js](https://p5js.org/) library installed locally or use the [p5.js Web Editor](https://editor.p5js.org/).

### Setup
1. Clone or download this repository.
2. Open the `index.html` file in your browser or load the code into the p5.js Web Editor.
3. Adjust settings using sliders and buttons to explore the pattern generator.

### Usage
1. Adjust the **Number of Nodes** slider to change the grid density.
2. Use the **Canvas Size** slider to resize the drawing area.
3. Select symmetry modes from the dropdown menu:
   - **Rotation and Reflection**: Apply reflection and rotational symmetry.
   - **Rotation Only**: Apply rotational symmetry without reflection.
4. Click nodes to create connections.
5. View tessellations across tiles.

## Current State

The current version includes:
- Node and connection rendering.
- Symmetry rules for rotation and reflection.
- Dynamic canvas size adjustments.
- Buttons for clearing and undoing connections.

## Testing Checklist

1. **Initial Rendering**:
   - The canvas should display a grid of nodes.
   - Connections should tessellate across tiles.

2. **Node Interaction**:
   - Clicking one node starts a connection.
   - Clicking another node completes the connection.

3. **Symmetry**:
   - **Rotation and Reflection**: Connections are mirrored and rotated correctly.
   - **Rotation Only**: Connections are rotated without reflection.

4. **Tessellation**:
   - Connections are replicated across the tiles.

5. **UI Elements**:
   - Sliders and dropdowns work as expected.
   - Buttons for clearing and undoing connections function correctly.

## Next Steps

### User Interface Enhancements
- **Tooltips**: Add tooltips explaining sliders, dropdowns, and buttons. *(Difficulty: Easy)*
- **Responsive Design**: Improve layout for mobile and desktop users. *(Difficulty: Easy)*
- **Theming**: Add light and dark mode options. *(Difficulty: Easy)*
- **Node Toggle**: Allow users to show or hide nodes dynamically. *(Difficulty: Easy)*
- **Farbschema speichern**: Save color selections for lines and nodes to persist after reload. *(Difficulty: Easy)*

### Functional Improvements
- **Export Options**: Allow users to save patterns as PNG or SVG files. *(Difficulty: Medium)*
- **Custom Symmetry**: Enable users to define their own symmetry rules. *(Difficulty: High)*
- **Color Customization**: Add options for coloring connections or tiles. *(Difficulty: Medium)*
- **Dynamic Node Management**: Allow users to add or remove nodes dynamically. *(Difficulty: Medium)*
- **Undo/Redo Stack**: Extend "Back" functionality for multiple undo/redo actions. *(Difficulty: Medium)*
- **State Saving**: Enable saving and loading patterns for future editing. *(Difficulty: Medium)*
- **Drag-and-Drop Nodes**: Allow users to create connections by dragging between nodes. *(Difficulty: Medium)*

### Visual Enhancements
- **Curved Connections**: Provide an option to draw curved lines. *(Difficulty: Medium)*
- **Animated Connections**: Animate the drawing process for better visualization. *(Difficulty: Medium)*
- **Flächenfärbung**: Detect closed areas formed by connections and allow users to fill them with color. *(Difficulty: High)*
- **Unterschiedliche Knotentypen**: Add support for different node shapes (circles, squares, triangles). *(Difficulty: Easy)*

### Advanced Features
- **Undo/Redo Stack**: Extend "Back" functionality for multiple undo/redo actions. *(Difficulty: Medium)*
- **Automatic Pattern Generation**: Implement algorithms to auto-generate complex patterns. *(Difficulty: High)*
- **3D Patterns**: Transform the canvas into a 3D object using `webgl`. *(Difficulty: High)*
- **Live Sharing**: Add the ability to share patterns via public links. *(Difficulty: High)*
- **Kaleidoscope Symmetry**: Add support for advanced symmetry modes, such as kaleidoscope effects. *(Difficulty: High)*
- **Dynamic Symmetry Animation**: Introduce animations that dynamically modify symmetry in real time. *(Difficulty: Medium)*


# World of Forms Generator

A creative tool for generating **symmetrical tessellations** with **interactive connections**, **customizable nodes**, and a **refined visual interface** inspired by geometric harmony and artistic design systems.

## Overview

The **World of Forms Generator** lets you connect nodes within a single geometric form (triangle, square, hexagon), apply **symmetry rules** (rotation and reflection), and tessellate the resulting patterns seamlessly across the canvas.  
It combines geometry, design research, and aesthetic experimentation — bridging Wilhelm Ostwald’s *“Die Harmonie der Formen”* with contemporary computational design.

## Features

- 🎨 **Interactive Nodes** – Click nodes to draw connections dynamically.  
- ♻️ **Symmetry Modes** – Choose between *Rotation* or *Rotation + Reflection* for balanced designs.  
- 🧩 **Tessellation Engine** – Automatically tiles the pattern across the canvas.  
- ⚙️ **Custom Controls** – Sliders to adjust the number of nodes and form size.  
- 🌗 **Light/Dark Mode** – Adaptive background and line colors for different visual contexts.  
- 💡 **Tooltips & Clean UI** – Minimal, glass-like interface with contextual hints.  
- 🔄 **Reset & Undo** – Quickly clear the canvas or undo the last connection.  
- 🧮 **Random Initialization** – Each session starts with a subtle random pattern for inspiration.

## Setup

### Prerequisites
- [p5.js](https://p5js.org/) library (local or via CDN)
- A modern browser with JavaScript enabled

### Installation
1. Clone or download this repository:
   ```bash
   git clone https://github.com/philipppaulsen/world_of_forms_generator.git
   ```
2. Open the `index.html` file in your browser.  
3. Adjust settings, explore symmetry, and connect forms interactively.

### Hosting
The project is hosted via **GitHub Pages** and embedded in [ReadyMag](https://readymag.com) via an iframe:
```html
<iframe 
  src="https://philipppaulsen.github.io/world_of_forms_generator/" 
  style="width: 100%; height: 100vh; border: none;">
</iframe>
```

---

## Current State (October 2025)

- ✅ Stable tessellation for **hexagon**, **square**, and **triangle**
- ✅ Correct alignment and proportional scaling
- ✅ Canvas-centered geometry
- ✅ Integrated dark mode with white lines and black background
- ✅ Refined node system (outer nodes visible, hover turns red)
- ✅ Simplified UI with glass effect and consistent spacing
- ✅ Frame and shadow styling aligned with control panel

---

## Planned Improvements

### Visual & UX
- Fine-tuned **color theming** for adaptive contrast  
- Additional **line weight** and **style customization**
- Option to **toggle node visibility**
- **Responsive layout** for mobile embedding in ReadyMag  

### Functional
- Export as **PNG** or **SVG**  
- Custom symmetry definitions  
- Curved or animated line rendering  
- Fill closed areas with colors  
- Pattern saving and reloading  

---

## Related Projects

- [**Space Harmony**](https://philipppaulsen.github.io/SpaceHarmony/) – exploring proportional and spatial relations based on geometric harmonics.  
- Both projects are part of *Die Welt der Formen* research framework.

---

## Credits

Developed by **Philipp Paulsen**  
IU International University, 2025  
Inspired by *Wilhelm Ostwald’s "Die Harmonie der Formen"*  