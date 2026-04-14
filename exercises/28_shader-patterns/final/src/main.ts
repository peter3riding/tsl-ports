import * as THREE from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import GUI from "lil-gui";
import {
  pass,
  abs,
  atan,
  clamp,
  cos,
  distance,
  dot,
  floor,
  fract,
  length,
  max,
  min,
  mix,
  mod,
  PI,
  sin,
  step,
  uv,
  vec2,
  vec3,
  vec4,
  div,
  Fn,
  add,
  sub,
  mul,
  mx_noise_float,
} from "three/tsl";

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

  // Rotate function
  const rotate = Fn(([uv, rotation, mid]: any[]) => {
    return vec2(
      cos(rotation)
        .mul(uv.x.sub(mid.x))
        .add(sin(rotation).mul(uv.y.sub(mid.y)))
        .add(mid.x),

      cos(rotation)
        .mul(uv.y.sub(mid.y))
        .sub(sin(rotation).mul(uv.x.sub(mid.x)))
        .add(mid.y),
    );
  });
  /**
   * Test mesh
   */
  // Geometry
  const geometry = new THREE.PlaneGeometry(1, 1, 32, 32);

  // Material
  const material = new THREE.MeshBasicNodeMaterial();
  const angle = atan(uv().x.sub(0.5), uv().y.sub(0.5)).div(PI.mul(2)).add(0.5);

  const strength = step(0.9, sin(mx_noise_float(uv().mul(10)).mul(20)));

  const blackColor = vec3(0);
  const uvColor = vec3(uv(), 1);
  const mixedColor = mix(blackColor, uvColor, strength);

  // Color
  material.colorNode = vec4(mixedColor, 1.0);

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
