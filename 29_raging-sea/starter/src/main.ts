import GUI from "lil-gui";
import * as THREE from "three/webgpu";
import {
  sin,
  positionLocal,
  time,
  vec2,
  vec3,
  vec4,
  uv,
  uniform,
  color,
  fog,
  rangeFogFactor,
  pass,
  renderOutput,
} from "three/tsl";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { sobel } from "three/addons/tsl/display/SobelOperatorNode.js";

(async () => {
  /**
   * Base
   */
  // Debug
  const gui = new GUI({ width: 400 });

  // Canvas
  const canvas = document.querySelector("canvas.webgl") as HTMLCanvasElement;

  // Scene
  const scene = new THREE.Scene();

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
    25,
    sizes.width / sizes.height,
    0.1,
    100,
  );
  camera.position.set(6, 3, 10);
  scene.add(camera);

  // Controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  /**
   * Renderer
   */
  const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
    forceWebGL: false,
  });
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  //renderer.setClearColor(fogColor.value);

  // Required for new WebGPU / RenderPipeline API
  await renderer.init();

  /**
   * Post-processing (updated API)
   */
  const postProcessing = new THREE.RenderPipeline(renderer);
  postProcessing.outputColorTransform = false;

  const scenePass = pass(scene, camera);
  const outputPass = renderOutput(scenePass);

  postProcessing.outputNode = sobel(outputPass);

  /**
   * Water
   */
  // Geometry
  const waterGeometry = new THREE.PlaneGeometry(2, 2, 128, 128);

  // Material
  const waterMaterial = new THREE.MeshBasicMaterial();

  // Mesh
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI * 0.5;
  scene.add(water);

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
    postProcessing.render(); //
  };

  renderer.setAnimationLoop(tick);
})();
