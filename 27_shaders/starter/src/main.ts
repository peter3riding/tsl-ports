import GUI from "lil-gui";
import * as THREE from "three/webgpu";
import {
  // Core
  color,
  uniform,
  vec3,
  attribute,
  float,

  // Math
  sin,

  // Geometry
  positionLocal,
  positionWorld,

  // UV & Texturing
  texture,

  // Post-processing & Fog
  pass,
  renderOutput,
} from "three/tsl";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * Base
 */
// Debug
const gui = new GUI({ width: 400 });

// Canvas
const canvas = document.querySelector("canvas.webgl") as HTMLCanvasElement;

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color("#0a0a0a");

/**
 * Textures
 */
const textureLoader = new THREE.TextureLoader();

// 1. Load the texture (same as before)
const flagTexture = textureLoader.load("/textures/flag-french.jpg");
flagTexture.colorSpace = THREE.SRGBColorSpace;

/**
 * Test mesh
 */
// Geometry
const geometry = new THREE.PlaneGeometry(1, 1, 32, 32);

// Material (TSL version - ready for anything)
const material = new THREE.MeshBasicNodeMaterial();

// ─── UNIFORMS ───
const uFrequency = uniform(new THREE.Vector2(10, 5));
const uTime = uniform(0);
const uColor = uniform(color("orange"));

const count = geometry.attributes.position.count;
const randoms = new Float32Array(count);

for (let i = 0; i < count; i++) {
  randoms[i] = Math.random();
}

geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 1));

const aRandom = float(attribute("aRandom"));

const elevation = sin(positionWorld.x.mul(uFrequency.x).sub(uTime))
  .mul(0.1)
  .add(sin(positionWorld.y.mul(uFrequency.y).sub(uTime)).mul(0.1));

material.positionNode = positionLocal.add(vec3(0, 0, elevation));

// Apply the texture directly (this is the TSL way)
material.colorNode = texture(flagTexture).mul(elevation.mul(2).add(0.5));

// Mesh
const mesh = new THREE.Mesh(geometry, material);
mesh.scale.y = 2 / 3;
scene.add(mesh);

// Tweaks
gui.add(uFrequency.value, "x").min(0).max(30).step(0.01).name("frequency X");
gui.add(uFrequency.value, "y").min(0).max(30).step(0.01).name("frequency Y");

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100,
);
camera.position.set(0.25, -0.25, 1);
scene.add(camera);

/**
 * Controls
 */
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/**
 * Renderer + Post-processing (modern WebGPU way)
 */
const renderer = new THREE.WebGPURenderer({
  canvas: canvas,
  forceWebGL: false,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Required for WebGPU
await renderer.init();

const postProcessing = new THREE.RenderPipeline(renderer);
postProcessing.outputColorTransform = false;

const scenePass = pass(scene, camera);
const outputPass = renderOutput(scenePass);

// Plain render (exactly like old renderer.render())
postProcessing.outputNode = outputPass;

/**
 * Resize handler
 */
window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/**
 * Animate
 */
const timer = new THREE.Timer();

const tick = () => {
  timer.update();
  const elapsedTime = timer.getElapsed();
  uTime.value = elapsedTime;

  controls.update();

  // Render (WebGPU version)
  postProcessing.render();
};

renderer.setAnimationLoop(tick);
