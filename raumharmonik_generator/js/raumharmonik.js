import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const CUBE_HALF_SIZE = 0.5;
const INITIAL_CANVAS_SIZE = 320;
const DRAG_THRESHOLD_SQ = 9;
const RAY_PICK_THRESHOLD = 0.05;

class SymmetryEngine {
  constructor() {
    this.settings = {
      reflections: {
        xy: true,
        yz: true,
        zx: true,
      },
      rotation: {
        axis: 'all',
        steps: 4,
      },
      translation: {
        axis: 'none',
        count: 0,
        step: 0.5,
      },
    };
  }

  setReflection(plane, enabled) {
    if (Object.prototype.hasOwnProperty.call(this.settings.reflections, plane)) {
      this.settings.reflections[plane] = Boolean(enabled);
    }
  }

  setRotation(axis) {
    this.settings.rotation.axis = axis;
  }

  setTranslation(axis, count, step) {
    this.settings.translation.axis = axis;
    this.settings.translation.count = Math.max(0, count || 0);
    this.settings.translation.step = Math.max(0, step || 0);
    if (axis === 'none') {
      this.settings.translation.count = 0;
    }
  }

  getTransforms() {
    let transforms = [new THREE.Matrix4().identity()];
    const { reflections, rotation, translation } = this.settings;

    if (reflections.xy) {
      transforms = this._expand(transforms, this._reflectionMatrix('xy'));
    }
    if (reflections.yz) {
      transforms = this._expand(transforms, this._reflectionMatrix('yz'));
    }
    if (reflections.zx) {
      transforms = this._expand(transforms, this._reflectionMatrix('zx'));
    }

    if (rotation.axis !== 'none' && rotation.steps > 1) {
      const axes = rotation.axis === 'all' ? ['x', 'y', 'z'] : [rotation.axis];
      const angleChoices = axes.map((ax) => {
        const delta = (Math.PI * 2) / rotation.steps;
        const options = [null];
        for (let i = 1; i < rotation.steps; i += 1) {
          options.push({ axis: ax, angle: delta * i });
        }
        return options;
      });

      const combos = this._cartesianProduct(angleChoices);
      const baseTransforms = transforms.slice();
      combos.forEach((combo) => {
        let combined = new THREE.Matrix4().identity();
        let hasRotation = false;
        combo.forEach((spec) => {
          if (!spec) {
            return;
          }
          hasRotation = true;
          combined = combined.multiply(this._rotationMatrix(spec.axis, spec.angle));
        });
        if (!hasRotation) {
          return;
        }
        baseTransforms.forEach((matrix) => {
          transforms.push(matrix.clone().multiply(combined));
        });
      });
    }

    if (translation.axis !== 'none' && translation.count > 0 && translation.step > 0) {
      const axes = translation.axis === 'all' ? ['x', 'y', 'z'] : [translation.axis];
      const perAxisOptions = axes.map((ax) => {
        const options = [null];
        for (let i = 1; i <= translation.count; i += 1) {
          const offset = translation.step * i;
          options.push(this._translationMatrix(ax, offset));
          options.push(this._translationMatrix(ax, -offset));
        }
        return options;
      });

      const combos = this._cartesianProduct(perAxisOptions);
      const baseTransforms = transforms.slice();
      combos.forEach((combo) => {
        let combined = new THREE.Matrix4().identity();
        let hasTranslation = false;
        combo.forEach((matrix) => {
          if (!matrix) {
            return;
          }
          hasTranslation = true;
          combined = combined.multiply(matrix);
        });
        if (!hasTranslation) {
          return;
        }
        baseTransforms.forEach((matrix) => {
          transforms.push(matrix.clone().multiply(combined));
        });
      });
    }

    return this._deduplicate(transforms);
  }

  _reflectionMatrix(plane) {
    switch (plane) {
      case 'xy':
        return new THREE.Matrix4().makeScale(1, 1, -1);
      case 'yz':
        return new THREE.Matrix4().makeScale(-1, 1, 1);
      case 'zx':
        return new THREE.Matrix4().makeScale(1, -1, 1);
      default:
        return new THREE.Matrix4().identity();
    }
  }

  _rotationMatrix(axis, angle) {
    const matrix = new THREE.Matrix4();
    switch (axis) {
      case 'x':
        return matrix.makeRotationX(angle);
      case 'y':
        return matrix.makeRotationY(angle);
      case 'z':
        return matrix.makeRotationZ(angle);
      default:
        return matrix.identity();
    }
  }

  _translationMatrix(axis, distance) {
    const matrix = new THREE.Matrix4();
    switch (axis) {
      case 'x':
        return matrix.makeTranslation(distance, 0, 0);
      case 'y':
        return matrix.makeTranslation(0, distance, 0);
      case 'z':
        return matrix.makeTranslation(0, 0, distance);
      default:
        return matrix.identity();
    }
  }

  _expand(baseTransforms, extraMatrix) {
    const result = baseTransforms.map((m) => m.clone());
    baseTransforms.forEach((matrix) => {
      const combined = matrix.clone().multiply(extraMatrix);
      result.push(combined);
    });
    return result;
  }

  _deduplicate(transforms) {
    const seen = new Set();
    const unique = [];
    transforms.forEach((matrix) => {
      const key = Array.from(matrix.elements)
        .map((value) => {
          const v = Math.abs(value) < 1e-10 ? 0 : value;
          return v.toFixed(5);
        })
        .join(',');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(matrix);
      }
    });
    return unique;
  }

  _cartesianProduct(arrays) {
    if (!arrays.length) {
      return [[]];
    }
    const [first, ...rest] = arrays;
    const restProduct = this._cartesianProduct(rest);
    const result = [];
    first.forEach((item) => {
      restProduct.forEach((combo) => {
        result.push([item, ...combo]);
      });
    });
    return result;
  }
}

class RaumharmonikApp {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);

    const aspect = 1;
    const frustumSize = 2;
    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.01,
      20
    );
    this.camera.position.set(1.8, 1.8, 1.8);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(INITIAL_CANVAS_SIZE, INITIAL_CANVAS_SIZE, false);
    this.renderer.setClearColor(0xffffff, 1);
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.minZoom = 1.0;
    this.controls.maxZoom = 4.0;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.8;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pointerDown = false;
    this.dragging = false;
    this.pointerDownPos = new THREE.Vector2();
    this.cubeBounds = new THREE.Box3(
      new THREE.Vector3(-CUBE_HALF_SIZE, -CUBE_HALF_SIZE, -CUBE_HALF_SIZE),
      new THREE.Vector3(CUBE_HALF_SIZE, CUBE_HALF_SIZE, CUBE_HALF_SIZE)
    );

    this.symmetry = new SymmetryEngine();
    this.pointGeometry = new THREE.SphereGeometry(0.02, 16, 16);
    this.pointMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.activePointGeometry = new THREE.SphereGeometry(0.028, 16, 16);
    this.activePointMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });

    this.gridDivisions = 1;
    this.axisPositions = this._axisPositions(this.gridDivisions);
    this.gridPoints = [];
    this.baseSegments = [];
    this.activePointIndex = null;
    this.showPoints = true;
    this.symmetryGroup = null;

    this._addCubeFrame();
    this._registerEvents();
    this.updateGrid(this.gridDivisions);
    this._onResize();
    window.addEventListener('resize', () => this._onResize());

    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  updateGrid(divisions) {
    const sanitized = Math.max(1, Math.floor(divisions || 1));
    this.gridDivisions = sanitized;
    this.axisPositions = this._axisPositions(sanitized);
    this.gridPoints = this._generateGridPoints();
    this.baseSegments = [];
    this.activePointIndex = null;
    this._rebuildSymmetryObjects();
  }

  reset() {
    this.baseSegments = [];
    this.activePointIndex = null;
    this._rebuildSymmetryObjects();
  }

  updateReflections({ xy, yz, zx }) {
    this.symmetry.setReflection('xy', xy);
    this.symmetry.setReflection('yz', yz);
    this.symmetry.setReflection('zx', zx);
    this._rebuildSymmetryObjects();
  }

  updateRotation(axis) {
    this.symmetry.setRotation(axis);
    this._rebuildSymmetryObjects();
  }

  updateTranslation(axis, count, step) {
    this.symmetry.setTranslation(axis, count, step);
    this._rebuildSymmetryObjects();
  }

  updateShowPoints(flag) {
    this.showPoints = Boolean(flag);
    this._rebuildSymmetryObjects();
  }

  _generateGridPoints() {
    const points = [];
    const axisValues = this.axisPositions;
    axisValues.forEach((x) => {
      axisValues.forEach((y) => {
        axisValues.forEach((z) => {
          points.push(new THREE.Vector3(x, y, z));
        });
      });
    });
    const hasCenter = axisValues.some((value) => Math.abs(value) < 1e-8);
    if (!hasCenter) {
      points.push(new THREE.Vector3(0, 0, 0));
    }
    return points;
  }

  _axisPositions(divisions) {
    const count = Math.max(1, divisions);
    const segments = count + 1;
    const step = (CUBE_HALF_SIZE * 2) / segments;
    const positions = [];
    for (let i = 0; i <= segments; i += 1) {
      const value = -CUBE_HALF_SIZE + step * i;
      positions.push(parseFloat(value.toFixed(10)));
    }
    return positions;
  }

  _addCubeFrame() {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const frameMaterial = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 });
    const frame = new THREE.LineSegments(edges, frameMaterial);
    this.scene.add(frame);
  }

  _registerEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', (event) => this._onPointerDown(event));
    canvas.addEventListener('pointermove', (event) => this._onPointerMove(event));
    canvas.addEventListener('pointerup', (event) => this._onPointerUp(event));
    canvas.addEventListener('pointerleave', () => this._onPointerCancel());
    canvas.addEventListener('pointercancel', () => this._onPointerCancel());
  }

  _onPointerDown(event) {
    if (event.button !== 0) {
      return;
    }
    this.pointerDown = true;
    this.dragging = false;
    this.controls.autoRotate = false;
    this.pointerDownPos.set(event.clientX, event.clientY);
  }

  _onPointerMove(event) {
    if (!this.pointerDown) {
      return;
    }
    const dx = event.clientX - this.pointerDownPos.x;
    const dy = event.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > DRAG_THRESHOLD_SQ) {
      this.dragging = true;
    }
  }

  _onPointerUp(event) {
    if (!this.pointerDown) {
      return;
    }
    const wasDragging = this.dragging;
    this.pointerDown = false;
    this.dragging = false;
    if (wasDragging) {
      this.controls.autoRotate = true;
      return;
    }
    this._registerPointFromEvent(event);
    this.controls.autoRotate = true;
  }

  _onPointerCancel() {
    this.pointerDown = false;
    this.dragging = false;
    this.controls.autoRotate = true;
  }

  _registerPointFromEvent(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const ray = this.raycaster.ray;
    let pointIndex = this._findNearestPointOnRay(ray);

    if (pointIndex === null) {
      const intersection = new THREE.Vector3();
      if (ray.intersectBox(this.cubeBounds, intersection)) {
        pointIndex = this._findNearestGridPoint(intersection);
      }
    }

    if (pointIndex !== null) {
      this._handlePointSelection(pointIndex);
    }
  }

  _findNearestPointOnRay(ray) {
    let minDistSq = Infinity;
    let index = null;
    const thresholdSq = RAY_PICK_THRESHOLD * RAY_PICK_THRESHOLD;

    for (let i = 0; i < this.gridPoints.length; i += 1) {
      const point = this.gridPoints[i];
      const distSq = ray.distanceSqToPoint(point);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        index = i;
      }
    }

    if (index !== null && minDistSq <= thresholdSq) {
      return index;
    }
    return null;
  }

  _findNearestGridPoint(position) {
    let minDistSq = Infinity;
    let index = null;
    for (let i = 0; i < this.gridPoints.length; i += 1) {
      const distSq = position.distanceToSquared(this.gridPoints[i]);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        index = i;
      }
    }
    return index;
  }

  _handlePointSelection(index) {
    if (index === null) {
      return;
    }

    if (this.activePointIndex === null) {
      this.activePointIndex = index;
      this._rebuildSymmetryObjects();
      return;
    }

    if (this.activePointIndex === index) {
      this.activePointIndex = null;
      this._rebuildSymmetryObjects();
      return;
    }

    const start = this.gridPoints[this.activePointIndex];
    const end = this.gridPoints[index];

    if (!start.equals(end)) {
      this.baseSegments.push({
        start: start.clone(),
        end: end.clone(),
      });
    }

    this.activePointIndex = null;
    this._rebuildSymmetryObjects();
  }

  _rebuildSymmetryObjects() {
    if (this.symmetryGroup) {
      this.scene.remove(this.symmetryGroup);
      this.symmetryGroup.traverse((child) => {
        if (child.geometry && child.geometry !== this.pointGeometry && child.geometry !== this.activePointGeometry) {
          child.geometry.dispose();
        }
      });
      this.symmetryGroup = null;
    }

    const transforms = this.symmetry.getTransforms();
    const group = new THREE.Group();
    if (this.showPoints) {
      const pointsGroup = new THREE.Group();
      transforms.forEach((matrix) => {
        this.gridPoints.forEach((pt) => {
          const mesh = new THREE.Mesh(this.pointGeometry, this.pointMaterial);
          mesh.position.copy(pt).applyMatrix4(matrix);
          pointsGroup.add(mesh);
        });
      });
      group.add(pointsGroup);

      if (this.activePointIndex !== null) {
        const highlightGroup = new THREE.Group();
        const basePoint = this.gridPoints[this.activePointIndex];
        transforms.forEach((matrix) => {
          const marker = new THREE.Mesh(this.activePointGeometry, this.activePointMaterial);
          marker.position.copy(basePoint).applyMatrix4(matrix);
          highlightGroup.add(marker);
        });
        group.add(highlightGroup);
      }
    }

    if (this.baseSegments.length) {
      const positions = [];
      transforms.forEach((matrix) => {
        this.baseSegments.forEach((segment) => {
          const start = segment.start.clone().applyMatrix4(matrix);
          const end = segment.end.clone().applyMatrix4(matrix);
          positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
        });
      });

      if (positions.length) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const lines = new THREE.LineSegments(geometry, this.lineMaterial);
        group.add(lines);
      }
    }

    this.symmetryGroup = group;
    this.scene.add(group);
  }

  _onResize() {
    const size = Math.min(INITIAL_CANVAS_SIZE, window.innerWidth - 40);
    this.renderer.setSize(size, size, false);
    const aspect = 1;
    const frustumSize = 2;
    this.camera.left = (frustumSize * aspect) / -2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;
    this.camera.updateProjectionMatrix();
  }
}

function init() {
  const container = document.getElementById('canvas-container');
  if (!container) {
    return;
  }

  const app = new RaumharmonikApp(container);
  const reflections = {
    xy: document.getElementById('reflection-xy'),
    yz: document.getElementById('reflection-yz'),
    zx: document.getElementById('reflection-zx'),
  };
  const rotationAxisEl = document.getElementById('rotation-axis');
  const translationAxisEl = document.getElementById('translation-axis');
  const translationCountEl = document.getElementById('translation-count');
  const translationStepEl = document.getElementById('translation-step');
  const showPointsEl = document.getElementById('toggle-points');
  const gridDensityEl = document.getElementById('grid-density');
  const clearButton = document.getElementById('clear-button');

  if (clearButton) {
    clearButton.addEventListener('click', () => app.reset());
  }

  Object.values(reflections).forEach((checkbox) => {
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        app.updateReflections({
          xy: reflections.xy ? reflections.xy.checked : false,
          yz: reflections.yz ? reflections.yz.checked : false,
          zx: reflections.zx ? reflections.zx.checked : false,
        });
      });
    }
  });
  app.updateReflections({
    xy: reflections.xy ? reflections.xy.checked : false,
    yz: reflections.yz ? reflections.yz.checked : false,
    zx: reflections.zx ? reflections.zx.checked : false,
  });

  if (rotationAxisEl) {
    const applyRotation = () => {
      app.updateRotation(rotationAxisEl.value);
    };
    rotationAxisEl.addEventListener('change', applyRotation);
    applyRotation();
  }

  if (translationAxisEl && translationCountEl && translationStepEl) {
    const applyTranslation = () => {
      const axis = translationAxisEl.value;
      const count = parseInt(translationCountEl.value, 10) || 0;
      const step = parseFloat(translationStepEl.value) || 0;
      app.updateTranslation(axis, count, step);
    };
    translationAxisEl.addEventListener('change', applyTranslation);
    translationCountEl.addEventListener('change', applyTranslation);
    translationCountEl.addEventListener('input', applyTranslation);
    translationStepEl.addEventListener('change', applyTranslation);
    translationStepEl.addEventListener('input', applyTranslation);
    applyTranslation();
  }

  if (showPointsEl) {
    const applyShowPoints = () => {
      app.updateShowPoints(showPointsEl.checked);
    };
    showPointsEl.addEventListener('change', applyShowPoints);
    applyShowPoints();
  }

  if (gridDensityEl) {
    const updateGrid = () => {
      const divisions = parseInt(gridDensityEl.value, 10) || 1;
      app.updateGrid(divisions);
    };
    gridDensityEl.addEventListener('change', updateGrid);
    gridDensityEl.addEventListener('input', updateGrid);
    updateGrid();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { RaumharmonikApp };
