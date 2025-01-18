let canvasWidth = 320;
let canvasHeight = canvasWidth * Math.sqrt(3) / 2; // Höhe für ein gleichseitiges Dreieck
let triangleBase, triangleHeight;
let centralTriangleNodes = [];
let midEdgeNodes = [];
let selectedNodes = [];
let linesToRepeat = [];

function setup() {
  createCanvas(canvasWidth, canvasHeight);
  noLoop();

  // Berechnung der Basis und Höhe für die Dreiecke
  triangleHeight = canvasHeight / 5; // 5 Reihen
  triangleBase = triangleHeight * 2 / Math.sqrt(3);

  // Definiere das zentrale invertierte Dreieck
  defineCentralTriangleNodes();
  calculateMidEdgeNodes();
}

function draw() {
  background(255); // Weißer Hintergrund

  // Zeichne die vollständige Kachelung
  drawTriangleTiling();

  // Zeichne die Nodes des zentralen invertierten Dreiecks
  drawCentralTriangleNodes();

  // Zeichne die Mittelknoten jeder Kante
  drawMidEdgeNodes();

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

function calculateMidEdgeNodes() {
  // Berechnet die Mittelpunkte jeder Kante des Dreiecks
  midEdgeNodes = [
    {
      x: (centralTriangleNodes[0].x + centralTriangleNodes[1].x) / 2,
      y: (centralTriangleNodes[0].y + centralTriangleNodes[1].y) / 2,
    },
    {
      x: (centralTriangleNodes[1].x + centralTriangleNodes[2].x) / 2,
      y: (centralTriangleNodes[1].y + centralTriangleNodes[2].y) / 2,
    },
    {
      x: (centralTriangleNodes[2].x + centralTriangleNodes[0].x) / 2,
      y: (centralTriangleNodes[2].y + centralTriangleNodes[0].y) / 2,
    },
  ];
}

function drawCentralTriangleNodes() {
  // Zeichnet die Nodes (Ecken) des zentralen invertierten Dreiecks
  fill(255, 0, 0); // Rot
  noStroke();
  centralTriangleNodes.forEach((node) => ellipse(node.x, node.y, 10, 10));
}

function drawMidEdgeNodes() {
  // Zeichnet die Mittelpunkte jeder Kante
  fill(0, 0, 255); // Blau
  noStroke();
  midEdgeNodes.forEach((node) => ellipse(node.x, node.y, 8, 8));
}

function mousePressed() {
  // Überprüfe, ob ein Node angeklickt wurde
  let clickedNode = [...centralTriangleNodes, ...midEdgeNodes].find(
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
  // Wiederhole gespeicherte Linien durch Rotation um 120° und 240°
  linesToRepeat.forEach((line) => {
    drawLineBetweenNodes(line.start, line.end);

    // Rotierte Linien zeichnen
    let rotated120Start = rotateAroundCentroid(line.start, 120);
    let rotated120End = rotateAroundCentroid(line.end, 120);
    drawLineBetweenNodes(rotated120Start, rotated120End);

    let rotated240Start = rotateAroundCentroid(line.start, 240);
    let rotated240End = rotateAroundCentroid(line.end, 240);
    drawLineBetweenNodes(rotated240Start, rotated240End);
  });
}

function rotateAroundCentroid(node, angle) {
  // Rotiert einen Punkt um das Centroid des Dreiecks
  let centroid = calculateCentroid();
  let rad = radians(angle);
  let dx = node.x - centroid.x;
  let dy = node.y - centroid.y;

  return {
    x: centroid.x + dx * cos(rad) - dy * sin(rad),
    y: centroid.y + dx * sin(rad) + dy * cos(rad),
  };
}

function calculateCentroid() {
  // Berechnet das Centroid des zentralen invertierten Dreiecks
  let x =
    (centralTriangleNodes[0].x +
      centralTriangleNodes[1].x +
      centralTriangleNodes[2].x) /
    3;
  let y =
    (centralTriangleNodes[0].y +
      centralTriangleNodes[1].y +
      centralTriangleNodes[2].y) /
    3;

  return { x, y };
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
