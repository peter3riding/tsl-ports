import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import GUI from "lil-gui";
import { uv, pass, vec4 } from "three/tsl"; // ← pass is now imported here

(async () => {
  /**
   * Base
   */
  // Debug
  const gui = new GUI();

  // Canvas
  const canvas = document.querySelector("canvas.webgl") as HTMLCanvasElement;

  // Scene
  const scene = new THREE.Scene();

  /**
   * Test mesh – fully TSL (no GLSL files)
   */
  // Geometry
  const geometry = new THREE.PlaneGeometry(1, 1, 32, 32);

  // Material
  const material = new THREE.MeshBasicNodeMaterial();

  // Color
  material.colorNode = vec4(0.5, 0.0, 1.0, 1.0);

  // Mesh
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  /**
   * Sizes
   */
  let sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  /**
   * Camera
   */
  const camera = new THREE.PerspectiveCamera(
    75,
    sizes.width / sizes.height,
    0.1,
    100,
  );
  camera.position.set(0.25, -0.25, 1);
  scene.add(camera);

  // Controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  /**
   * Renderer
   */
  const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
  });
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  renderer.setClearColor(0x000000);

  await renderer.init();

  /**
   * Post-processing (modern way)
   */
  const postProcessing = new THREE.RenderPipeline(renderer);

  const scenePass = pass(scene, camera); // ← fixed: now using the imported pass()
  postProcessing.outputNode = scenePass;

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
  const tick = () => {
    controls.update();
    postProcessing.render();
  };

  renderer.setAnimationLoop(tick);
})();
