import * as THREE from './assets/vendor/three.module.js';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';

const getEl = id => document.getElementById(id);
const canvas = getEl('scorpion');
const motion = getEl('motion-toggle');
const loading = getEl('scene-loading');
const rotateLeft = getEl('rotate-left');
const rotateRight = getEl('rotate-right');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

let auto = !reduced.matches;
let renderer, scene, camera, model;
let visible = true, rotation = 0.35, drag = false, lastX = 0;
let targetZoom = 3.25;
const root = new THREE.Group();

function motionState() {
  if (motion) {
    motion.textContent = auto ? 'Ⅱ' : '▶';
    motion.setAttribute('aria-pressed', String(!auto));
    motion.setAttribute('aria-label', auto ? 'إيقاف الحركة' : 'تشغيل الحركة');
  }
}

if (motion) {
  motion.onclick = () => {
    auto = !auto;
    motionState();
  };
  motionState();
}

reduced.addEventListener('change', e => {
  if (e.matches) {
    auto = false;
    motionState();
  }
});

async function init() {
  if (renderer || !canvas) return;

  // 1. WebGL Renderer with ACES Filmic Tone Mapping and preserved drawing buffer
  renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  // 2. Camera Setup (Elevated front-angled perspective)
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(0, 1.45, targetZoom);
  camera.lookAt(0, 0.1, 0);

  // 3. Multi-Source Lighting Environment
  const hemiLight = new THREE.HemisphereLight(0xfff5ea, 0x4a443b, 2.4);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffecd2, 3.2);
  keyLight.position.set(3, 4, 3);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xa6c9df, 2.0);
  fillLight.position.set(-3, 3, 2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xd7bb80, 2.5);
  rimLight.position.set(0, 4, -3);
  scene.add(rimLight);

  scene.add(root);

  // 4. Load Owner-Supplied 3D Model with cache-busting
  try {
    if (loading) {
      loading.hidden = false;
      loading.textContent = 'جارٍ إعداد المجسّم…';
    }

    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('assets/scorpion.glb?v=sprint05_owner_v2');
    model = gltf.scene;
    model.updateMatrixWorld(true);

    // 5. Normalization & Centering
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.55 / (maxDim || 1);

    model.scale.multiplyScalar(scale);
    model.position.sub(center.multiplyScalar(scale));
    model.position.y += 0.12;

    // 6. Preserve Original Geometry and Materials
    model.traverse(o => {
      if (o.isMesh) {
        o.frustumCulled = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          if (m) {
            m.side = THREE.DoubleSide;
            m.needsUpdate = true;
          }
        });
      }
    });

    root.add(model);
    canvas.dataset.modelLoaded = 'true';
    if (loading) loading.hidden = true;

    // Trigger initial resize & synchronous first render
    resize();
    renderer.render(scene, camera);
  } catch (err) {
    console.error('Failed to load owner-supplied 3D model:', err);
    if (loading) {
      loading.textContent = 'تعذّر تحميل المجسّم؛ الرجاء التحقق من دعم WebGL.';
    }
  }
}

function resize() {
  if (!renderer || !canvas) return;
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  if (scene && camera) {
    renderer.render(scene, camera);
  }
}

const spec = getEl('specimen');
if (spec) {
  new ResizeObserver(resize).observe(spec);
}

// 7. Interactive Controls: Pointer Drag & Wheel Zoom
if (canvas) {
  canvas.addEventListener('pointerdown', e => {
    drag = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (drag) {
      rotation += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    }
  });

  canvas.addEventListener('pointerup', () => { drag = false; });
  canvas.addEventListener('pointercancel', () => { drag = false; });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    targetZoom = Math.max(2.2, Math.min(4.8, targetZoom + e.deltaY * 0.0025));
  }, { passive: false });

  canvas.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      rotation -= 0.25;
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      rotation += 0.25;
    }
  });
}

// 8. Toolbar Buttons: Left/Right Rotate
if (rotateLeft) rotateLeft.onclick = () => { rotation -= 0.35; };
if (rotateRight) rotateRight.onclick = () => { rotation += 0.35; };

// 9. Smooth Animation Frame Loop
let last = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  // Never block render if visible flag fluctuates; only pause if page is hidden
  if (!renderer || !model || document.hidden) return;

  if (auto && !drag) {
    rotation += 0.28 * dt;
  }

  root.rotation.y = THREE.MathUtils.damp(root.rotation.y, rotation, 8, dt);
  camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZoom, 6, dt);

  renderer.render(scene, camera);
}

// 10. Automatically Render on Initial Page Load
init().then(() => {
  requestAnimationFrame(animate);
});
