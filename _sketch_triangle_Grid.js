let canvasWidth = 320;
let canvasHeight = canvasWidth * Math.sqrt(3) / 2; // Höhe für ein gleichseitiges Dreieck
let triangleBase, triangleHeight;
let centralTriangleNodes = [];
let selectedNodes = [];
let linesToRepeat = [];

// Festgelegte Verschiebung der Linien
let lineYOffsetAdjustment = -28;

function setup() {
  createCanvas(canvasWidth, canvasHeight);
  noLoop();

  // Berechnung der Basis und Höhe für die Dreiecke
  triangleHeight = canvasHeight / 5; // 5 Reihen
  triangleBase = triangleHeight * 2 / Math.sqrt(3);

  // Definiere das zentrale invertierte Dreieck
  defineCentralTriangleNodes();
}

function draw() {
  background(255); // Weißer Hintergrund

  // Zeichne die vollständige Kachelung
  drawTriangleTiling();

  // Zeichne die Nodes des zentralen invertierten Dreiecks
  drawCentralTriangleNodes();

  // Wiederhole gespeicherte Linien
  repeatLines();
}

function defineCentralTriangleNodes() {
  // Berechnet die Nodes des zentralen invertierten Dreiecks
  let centerX = canvasWidth / 2;
  let centerY = canvasHeight / 2;

  let bottom = { x: centerX, y: centerY + triangleHeight / 2 }; // Spitze unten
  let topLeft = { x: centerX - triangleBase / 2, y: centerY - triangleHeight / 2 }; // Links oben
  let topRight = { x: centerX + triangleBase / 2, y: centerY - triangleHeight / 2 }; // Rechts oben

  centralTriangleNodes = [bottom, topLeft, topRight];
}

function drawCentralTriangleNodes() {
  // Zeichnet die Nodes (Ecken) des zentralen invertierten Dreiecks
  fill(255, 0, 0); // Rot
  noStroke();
  centralTriangleNodes.forEach((node) => ellipse(node.x, node.y, 10, 10));
}

function mousePressed() {
  // Überprüfe, ob ein Node im mittleren Dreieck angeklickt wurde
  let clickedNode = centralTriangleNodes.find(
    (node) => dist(mouseX, mouseY, node.x, node.y) < 10
  );
  if (clickedNode) {
    selectedNodes.push(clickedNode);
    if (selectedNodes.length === 2) {
      let line = { start: selectedNodes[0], end: selectedNodes[1] };
      linesToRepeat.push(line);
      selectedNodes = [];
      redraw();
    }
  }
}

function drawLineBetweenNodes(start, end) {
  stroke(0);
  strokeWeight(2);
  line(start.x, start.y, end.x, end.y);
}

function repeatLines() {
  let rows = Math.ceil(canvasHeight / triangleHeight) + 1; // Extra Reihen für Abdeckung
  let cols = Math.ceil(canvasWidth / triangleBase) + 1; // Extra Spalten für Abdeckung

  // Wiederhole jede Linie über die gesamte Kachelung
  linesToRepeat.forEach((line) => {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let xOffset = col * triangleBase;
        let yOffset = row * triangleHeight + lineYOffsetAdjustment; // Festgelegte Linienverschiebung

        // Verschiebe jede zweite Reihe horizontal
        if (row % 2 === 1) {
          xOffset += triangleBase / 2; // Horizontale Verschiebung
        }

        // Transformiere die Start- und Endpunkte der Linie
        let transformedStart = transformNode(line.start, xOffset, yOffset);
        let transformedEnd = transformNode(line.end, xOffset, yOffset);

        drawLineBetweenNodes(transformedStart, transformedEnd);
      }
    }
  });
}

function transformNode(node, xOffset, yOffset) {
  // Transformiere den Knoten basierend auf Offset
  return {
    x: node.x + xOffset - canvasWidth / 2,
    y: node.y + yOffset - canvasHeight / 2,
  };
}

function drawTriangleTiling() {
  let rows = Math.ceil(canvasHeight / triangleHeight) + 1; // Extra Reihen für Abdeckung
  let cols = Math.ceil(canvasWidth / triangleBase) + 1; // Extra Spalten für Abdeckung

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let x = col * triangleBase;
      let y = row * triangleHeight;

      if (row % 2 === 1) x += triangleBase / 2;

      drawTriangleLines(x, y, row, col, rows, cols);
    }
  }
}

function drawTriangleLines(x, y, row, col, rows, cols) {
  stroke(0);
  noFill();

  let top = { x: x, y: y };
  let right = { x: x + triangleBase / 2, y: y + triangleHeight };
  let left = { x: x - triangleBase / 2, y: y + triangleHeight };

  if (col < cols - 1) line(top.x, top.y, right.x, right.y);
  if (col > 0) line(top.x, top.y, left.x, left.y);
  if (row < rows - 1) line(left.x, left.y, right.x, right.y);
}
