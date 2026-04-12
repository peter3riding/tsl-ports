import GUI from "lil-gui";
import * as THREE from "three/webgpu";
import {
  // Core
  MeshNormalNodeMaterial,
  color,
  uniform,
  vec2,
  vec3,
  vec4,
  float,
  Loop,
  Fn,
  transformNormalToView,
  normalize,

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
  cross,

  // Geometry
  positionLocal,
  positionWorld,
  normalLocal,
  normalWorld,

  // Noise
  mx_noise_float,

  // UV & Texturing
  uv,
  texture,

  // Post-processing & Fog
  pass,
  renderOutput,
  fog,
  rangeFogFactor,
  modelPosition,
} from "three/tsl";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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
  scene.background = new THREE.Color("#0a0a0a");

  /**
   * Water
   */
  // Colors
  type debugObjectType = {
    depthColor: string;
    surfaceColor: string;
  };

  const debugObject: debugObjectType = {
    depthColor: "#ff4000",
    surfaceColor: "#151c37",
  };

  // ─── UNIFORMS ───
  const uTime = uniform(0);
  const uColor = uniform(color(0.5, 0.8, 1.0));
  const uBigWavesElevation = uniform(0.2);
  const uBigWavesFrequency = uniform(vec2(4, 1.5));
  const uBigWavesSpeed = uniform(0.75);
  const uDepthColor = uniform(color(debugObject.depthColor));
  const uSurfaceColor = uniform(color(debugObject.surfaceColor));
  const uColorOffset = uniform(0.925);
  const uColorMultiplier = uniform(1);
  const uSmallWavesFrequency = uniform(3);
  const uSmallWavesElevation = uniform(0.15);
  const uSmallIterations = uniform(4);
  const uSmallWavesSpeed = uniform(0.2);

  // Geometry
  const waterGeometry = new THREE.PlaneGeometry(2, 2, 512, 512);

  // Material
  const waterMaterial = new THREE.MeshNormalNodeMaterial();

  // Mesh
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  waterGeometry.rotateX(-Math.PI * 0.5);
  scene.add(water);

  // Vertex
  const wavesElevation = Fn(([position]: [any]) => {
    // Big waves
    let elevation = mul(
      sin(position.x.mul(uBigWavesFrequency.x).add(uTime.mul(uBigWavesSpeed))),
      sin(position.z.mul(uBigWavesFrequency.y).add(uTime.mul(uBigWavesSpeed))),
    );
    elevation.mulAssign(uBigWavesElevation);

    // Small waves
    Loop({ start: float(1), end: uSmallIterations }, ({ i }) => {
      const noiseInput = vec3(
        position.xz.add(1).mul(uSmallWavesFrequency).mul(i), // +1 avoids seam
        uTime.mul(uSmallWavesSpeed),
      );

      const wave = abs(
        mx_noise_float(noiseInput, 1, 0) // amplitude=1, pivot=0 → -1 to 1
          .mul(uSmallWavesElevation)
          .div(i),
      );

      elevation.subAssign(wave);
    });

    return elevation;
  });

  // Update Normals
  const updateNormals = Fn(() => {
    const shift = float(0.01);
    let positionL = positionLocal.toVar();

    // Calculate positions
    const positionA = positionLocal.xyz.add(vec3(shift, 0, 0));
    const positionB = positionLocal.xyz.add(vec3(0, 0, shift.negate()));

    // Update Elevation
    positionL.y.addAssign(wavesElevation(positionL));
    positionA.y.addAssign(wavesElevation(positionA));
    positionB.y.addAssign(wavesElevation(positionB));

    // Calculate Distance
    const toA = positionA.sub(positionL);
    const toB = positionB.sub(positionL);

    return transformNormalToView(normalize(cross(toA, toB)));
  });

  waterMaterial.normalNode = updateNormals();

  // Apply to material 'Y' position
  const elevation = wavesElevation(positionLocal);
  waterMaterial.positionNode = positionLocal.add(vec3(0, elevation, 0));

  // Fragment
  const mixStrength = elevation.add(uColorOffset).mul(uColorMultiplier);
  waterMaterial.colorNode = mix(uDepthColor, uSurfaceColor, mixStrength);

  // Tweaks
  // gui
  //   .add(uBigWavesElevation, "value")
  //   .min(0)
  //   .max(1)
  //   .step(0.001)
  //   .name("uBigWavesElevation");
  // gui
  //   .add(uBigWavesFrequency.value, "x")
  //   .min(0)
  //   .max(10)
  //   .step(0.001)
  //   .name("uBigWavesFrequencyX");
  // gui
  //   .add(uBigWavesFrequency.value, "y")
  //   .min(0)
  //   .max(10)
  //   .step(0.001)
  //   .name("uBigWavesFrequencyY");
  // gui
  //   .addColor(debugObject, "depthColor")
  //   .onChange(() => uDepthColor.value.set(debugObject.depthColor));

  // gui
  //   .addColor(debugObject, "surfaceColor")
  //   .onChange(() => uSurfaceColor.value.set(debugObject.surfaceColor));
  // gui
  //   .add(uBigWavesSpeed, "value")
  //   .min(0)
  //   .max(4)
  //   .step(0.001)
  //   .name("uBigWavesSpeed");
  // gui.add(uColorOffset, "value").min(0).max(1).step(0.001).name("uColorOffset");

  // gui
  //   .add(uColorMultiplier, "value")
  //   .min(0)
  //   .max(10)
  //   .step(0.001)
  //   .name("uColorMultiplier");
  gui
    .add(uSmallWavesElevation, "value")
    .min(0)
    .max(1)
    .step(0.001)
    .name("Small Waves Elevation");

  gui
    .add(uSmallWavesFrequency, "value")
    .min(0)
    .max(30)
    .step(0.1)
    .name("Small Waves Frequency");

  gui
    .add(uSmallWavesSpeed, "value")
    .min(0)
    .max(4)
    .step(0.01)
    .name("Small Waves Speed");

  gui
    .add(uSmallIterations, "value")
    .min(1)
    .max(5)
    .step(1)
    .name("Small Waves Iterations");
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
  const camera = new THREE.PerspectiveCamera(
    75,
    sizes.width / sizes.height,
    0.1,
    100,
  );
  camera.position.set(1, 1, 1);
  scene.add(camera);

  /**
   * Controls
   */
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  /**
   * Renderer + Post-processing
   */
  const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
    forceWebGL: false,
    antialias: true, // ← nice default
  });

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Required for WebGPU
  try {
    await renderer.init();
  } catch (error) {
    console.error("WebGPU init failed:", error);
    return;
  }

  const postProcessing = new THREE.RenderPipeline(renderer);
  postProcessing.outputColorTransform = false;

  const scenePass = pass(scene, camera);
  const outputPass = renderOutput(scenePass);

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
    uTime.value = timer.getElapsed();

    controls.update();

    // Modern WebGPU render
    postProcessing.render();
  };

  renderer.setAnimationLoop(tick);
})();
