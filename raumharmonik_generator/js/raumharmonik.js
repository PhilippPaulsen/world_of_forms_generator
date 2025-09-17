import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js?module';

const CUBE_HALF_SIZE = 0.5;
const INITIAL_CANVAS_SIZE = 320;

class SymmetryEngine {
  constructor() {
    this.settings = {
      reflections: {
        xy: false,
        yz: false,
        zx: false,
      },
      rotation: {
        axis: 'none',
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

  setRotation(axis, steps) {
    this.settings.rotation.axis = axis;
    this.settings.rotation.steps = Math.max(1, steps || 1);
    if (axis === 'none') {
      this.settings.rotation.steps = 1;
    }
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
      const delta = (Math.PI * 2) / rotation.steps;
      for (let i = 1; i < rotation.steps; i += 1) {
        transforms = this._expand(transforms, this._rotationMatrix(rotation.axis, delta * i));
      }
    }

    if (translation.axis !== 'none' && translation.count > 0 && translation.step > 0) {
      for (let i = 1; i <= translation.count; i += 1) {
        const offset = translation.step * i;
        transforms = this._expand(transforms, this._translationMatrix(translation.axis, offset));
        transforms = this._expand(transforms, this._translationMatrix(translation.axis, -offset));
      }
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
    this.controls.minZoom = 1.0;
    this.controls.maxZoom = 4.0;
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

    this.basePoints = [];
    this.baseSegments = [];
    this.pendingPointIndex = null;

    this.symmetry = new SymmetryEngine();
    this.pointGeometry = new THREE.SphereGeometry(0.02, 16, 16);
    this.pointMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
    this.symmetryGroup = null;

    this._addCubeFrame();
    this._registerEvents();
    this._onResize();
    window.addEventListener('resize', () => this._onResize());

    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
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
    this.pointerDownPos.set(event.clientX, event.clientY);
  }

  _onPointerMove(event) {
    if (!this.pointerDown) {
      return;
    }
    const dx = event.clientX - this.pointerDownPos.x;
    const dy = event.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 9) {
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
      return;
    }
    this._registerPointFromEvent(event);
  }

  _onPointerCancel() {
    this.pointerDown = false;
    this.dragging = false;
  }

  _registerPointFromEvent(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersection = new THREE.Vector3();
    if (this.raycaster.ray.intersectBox(this.cubeBounds, intersection)) {
      this._addPoint(intersection.clone());
    }
  }

  _addPoint(point) {
    this.basePoints.push(point.clone());
    if (this.pendingPointIndex === null) {
      this.pendingPointIndex = this.basePoints.length - 1;
    } else {
      const previousPoint = this.basePoints[this.pendingPointIndex];
      this.baseSegments.push({
        start: previousPoint.clone(),
        end: point.clone(),
      });
      this.pendingPointIndex = null;
    }
    this._rebuildSymmetryObjects();
  }

  reset() {
    this.basePoints = [];
    this.baseSegments = [];
    this.pendingPointIndex = null;
    this._rebuildSymmetryObjects();
  }

  updateReflections({ xy, yz, zx }) {
    this.symmetry.setReflection('xy', xy);
    this.symmetry.setReflection('yz', yz);
    this.symmetry.setReflection('zx', zx);
    this._rebuildSymmetryObjects();
  }

  updateRotation(axis, steps) {
    this.symmetry.setRotation(axis, steps);
    this._rebuildSymmetryObjects();
  }

  updateTranslation(axis, count, step) {
    this.symmetry.setTranslation(axis, count, step);
    this._rebuildSymmetryObjects();
  }

  _rebuildSymmetryObjects() {
    if (this.symmetryGroup) {
      this.scene.remove(this.symmetryGroup);
      this.symmetryGroup.traverse((child) => {
        if (child.geometry && child.geometry !== this.pointGeometry) {
          child.geometry.dispose();
        }
      });
      this.symmetryGroup = null;
    }

    const transforms = this.symmetry.getTransforms();
    const group = new THREE.Group();
    const pointsGroup = new THREE.Group();

    transforms.forEach((matrix) => {
      this.basePoints.forEach((pt) => {
        const mesh = new THREE.Mesh(this.pointGeometry, this.pointMaterial);
        mesh.position.copy(pt).applyMatrix4(matrix);
        pointsGroup.add(mesh);
      });
    });

    group.add(pointsGroup);

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
  const rotationStepsEl = document.getElementById('rotation-steps');
  const translationAxisEl = document.getElementById('translation-axis');
  const translationCountEl = document.getElementById('translation-count');
  const translationStepEl = document.getElementById('translation-step');
  const clearButton = document.getElementById('clear-button');

  if (clearButton) {
    clearButton.addEventListener('click', () => app.reset());
  }

  Object.entries(reflections).forEach(([plane, checkbox]) => {
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

  if (rotationAxisEl && rotationStepsEl) {
    const updateRotation = () => {
      const axis = rotationAxisEl.value;
      const steps = parseInt(rotationStepsEl.value, 10) || 1;
      app.updateRotation(axis, steps);
    };
    rotationAxisEl.addEventListener('change', updateRotation);
    rotationStepsEl.addEventListener('change', updateRotation);
    rotationStepsEl.addEventListener('input', updateRotation);
  }

  if (translationAxisEl && translationCountEl && translationStepEl) {
    const updateTranslation = () => {
      const axis = translationAxisEl.value;
      const count = parseInt(translationCountEl.value, 10) || 0;
      const step = parseFloat(translationStepEl.value) || 0;
      app.updateTranslation(axis, count, step);
    };
    translationAxisEl.addEventListener('change', updateTranslation);
    translationCountEl.addEventListener('change', updateTranslation);
    translationCountEl.addEventListener('input', updateTranslation);
    translationStepEl.addEventListener('change', updateTranslation);
    translationStepEl.addEventListener('input', updateTranslation);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { RaumharmonikApp };
