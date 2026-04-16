import GUI from "lil-gui";
import * as THREE from "three/webgpu";
import {
  // Core
  color,
  uniform,
  vec2,
  vec3,
  vec4,
  float,

  // Time & Animation
  time,

  // Math
  sin,
  cos,
  tan,
  pow,
  sqrt,
  abs,
  clamp,
  mix,
  step,
  smoothstep,
  add,
  sub,
  mul,
  div,

  // Geometry
  positionLocal,
  positionWorld,
  normalLocal,
  normalWorld,

  // UV & Texturing
  uv,
  texture,

  // Post-processing & Fog
  pass,
  renderOutput,
  fog,
  rangeFogFactor,
} from "three/tsl";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
(async () => {
  /**
   * Base
   */
  // Debug
  const gui = new GUI({ width: 400 });
  const debugObject = {};

  // Canvas
  const canvas = document.querySelector("canvas.webgl") as HTMLCanvasElement;

  // Scene
  const scene = new THREE.Scene();

  /**
   * Environment map
   */
  const hdrLoader = new HDRLoader();

  hdrLoader.load("/spruit_sunrise.hdr", (environmentMap) => {
    environmentMap.mapping = THREE.EquirectangularReflectionMapping;

    scene.background = environmentMap;
    scene.backgroundBlurriness = 0.5;
    scene.environment = environmentMap;
  });

  /**
   * Terrain
   */
  const geometry = new THREE.IcosahedronGeometry(2, 5);
  const material = new THREE.MeshPhysicalMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  /**
   * Lights (from the second snippet)
   */
  const directionalLight = new THREE.DirectionalLight("#ffffff", 2);
  directionalLight.position.set(6.25, 3, 4);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(1024, 1024);
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.far = 30;
  directionalLight.shadow.camera.top = 8;
  directionalLight.shadow.camera.right = 8;
  directionalLight.shadow.camera.bottom = -8;
  directionalLight.shadow.camera.left = -8;
  scene.add(directionalLight);

  /**
   * Sizes
   */
  const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: Math.min(window.devicePixelRatio, 2),
  };

  /**
   * Camera (updated from the second snippet)
   */
  const camera = new THREE.PerspectiveCamera(
    35,
    sizes.width / sizes.height,
    0.1,
    100,
  );
  camera.position.set(-10, 6, -2);
  scene.add(camera);

  /**
   * Controls
   */
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  /**
   * Renderer (WebGPU from your original + toneMapping/shadows from second snippet)
   */
  const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
    antialias: true,
  });

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(sizes.pixelRatio);

  // Required for WebGPU
  try {
    await renderer.init();
  } catch (error) {
    console.error("WebGPU init failed:", error);
    return;
  }

  /**
   * Resize handler (updated from the second snippet)
   */
  window.addEventListener("resize", () => {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    sizes.pixelRatio = Math.min(window.devicePixelRatio, 2);

    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(sizes.pixelRatio);
  });

  /**
   * Animate (updated from the second snippet but using WebGPU's setAnimationLoop)
   */
  const clock = new THREE.Clock();

  const tick = () => {
    const elapsedTime = clock.getElapsedTime();

    controls.update();

    // Render
    renderer.render(scene, camera);
  };

  renderer.setAnimationLoop(tick);
})();
