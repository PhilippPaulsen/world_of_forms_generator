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
- **Tooltips**: Add tooltips explaining sliders, dropdowns, and buttons.
- **Responsive Design**: Improve layout for mobile and desktop users.
- **Theming**: Add light and dark mode options.

### Functional Improvements
- **Export Options**: Allow users to save patterns as PNG or SVG files.
- **Custom Symmetry**: Enable users to define their own symmetry rules.
- **Color Customization**: Add options for coloring connections or tiles.

### Visual Enhancements
- **Curved Connections**: Provide an option to draw curved lines.
- **Animated Connections**: Animate the drawing process for better visualization.

### Advanced Features
- **Undo/Redo Stack**: Extend "Back" functionality for multiple undo/redo actions.
- **Dynamic Node Management**: Allow users to add or remove nodes dynamically.
- **State Saving**: Enable saving and loading patterns for future editing.
