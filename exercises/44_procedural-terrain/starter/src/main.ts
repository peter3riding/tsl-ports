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
  Fn,
  normalize,
  cross,
  sign,
  dot,

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
  mx_fractal_noise_float,
  transformNormalToView,

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
  mx_noise_float,
} from "three/tsl";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { simplexNoise2D } from "./simplexNoise2d";

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
  // Geometry
  const geometry = new THREE.PlaneGeometry(10, 10, 500, 500);
  geometry.rotateX(-Math.PI * 0.5);

  const material = new THREE.MeshStandardNodeMaterial({
    metalness: 0,
    roughness: 0.5,
    color: "#85d534",
  });

  //const material = new THREE.MeshNormalNodeMaterial();

  // Uniforms
  const debugObject = {
    positionFrequency: 0.2,
    strength: 1.4,
    warpFrequency: 10.0,
    warpStrength: 0.5,
    colorWaterDeep: "#002b3d",
    colorWaterSurface: "#66a8ff",
    colorSand: "#ffe894",
    colorGrass: "#85d534",
    colorSnow: "#ffffff",
    colorRock: "#bfbd8d",
  };

  // TSL uniforms (reactive)
  const uPositionFrequency = uniform(float(debugObject.positionFrequency));
  const uStrength = uniform(float(debugObject.strength));
  const uWarpFrequency = uniform(float(debugObject.warpFrequency));
  const uWarpStrength = uniform(float(debugObject.warpStrength));
  const uColorWaterDeep = uniform(new THREE.Color(debugObject.colorWaterDeep));
  const uColorWaterSurface = uniform(
    new THREE.Color(debugObject.colorWaterSurface),
  );
  const uColorSand = uniform(new THREE.Color(debugObject.colorSand));
  const uColorGrass = uniform(new THREE.Color(debugObject.colorGrass));
  const uColorSnow = uniform(new THREE.Color(debugObject.colorSnow));
  const uColorRock = uniform(new THREE.Color(debugObject.colorRock));

  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  scene.add(terrain);

  // Displacement node
  const getElevation = Fn(([position]: [any]) => {
    const warpedPosition = position.toVar();
    warpedPosition.addAssign(
      mx_noise_float(
        position.mul(uPositionFrequency).mul(uWarpFrequency),
        1,
        0,
      ).mul(uWarpStrength),
    );
    let elevation = mx_fractal_noise_float(
      warpedPosition.mul(uPositionFrequency), // base frequency
      float(3), // 3 octaves
      float(2.0), // lacunarity (frequency multiplier)
      float(0.8), // diminish / persistence (amplitude multiplier)
    );

    elevation = abs(elevation).pow(2).mul(sign(elevation));
    elevation.mulAssign(uStrength);

    return elevation;
  });

  const displacementNode = getElevation(positionLocal.xz);

  // Vertex
  material.positionNode = positionLocal.add(vec3(0, displacementNode, 0));

  // Shadow synchronization
  material.castShadowPositionNode = displacementNode;
  material.receivedShadowPositionNode = displacementNode;

  // Fix normals
  material.normalNode = Fn(() => {
    const shift = float(0.001);

    const p = positionLocal.toVar();
    const pA = p.add(vec3(shift, 0, 0));
    const pB = p.add(vec3(0, 0, shift.negate()));

    const h = getElevation(p.xz);
    const hA = getElevation(pA.xz);
    const hB = getElevation(pB.xz);

    const pos = vec3(p.x, h, p.z);
    const posA = vec3(pA.x, hA, pA.z);
    const posB = vec3(pB.x, hB, pB.z);

    const tangent = posA.sub(pos);
    const bitangent = posB.sub(pos);

    return transformNormalToView(normalize(cross(tangent, bitangent)));
  })();

  // Fragment
  material.colorNode = Fn(() => {
    const depth = positionLocal.y.toVar();

    // Water
    const watermix = depth.smoothstep(-1, 0);
    let color = mix(uColorWaterDeep, uColorWaterSurface, watermix);

    // Sand
    const sandMix = depth.step(-0.075);
    color = mix(color, uColorSand, sandMix);

    // Grass
    const grassMix = depth.step(-0.05);
    color = mix(color, uColorGrass, grassMix);

    // Rock
    const upDirection = vec3(0, 1, 0).normalize();
    const gradient = dot(upDirection, normalWorld).step(0.8).oneMinus();
    const slopeMix = depth.step(0.01);
    color = mix(color, uColorRock, slopeMix.mul(gradient));

    // Snow
    const snowFloat = float(0.45).add(
      mx_noise_float(positionLocal.xz.mul(50), 0.1, 0),
    );
    const snowMix = depth.step(snowFloat);
    color = mix(color, uColorSnow, snowMix);

    return vec4(color, 1.0);
  })();

  /**
   * Water
   */
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10, 1, 1),
    new THREE.MeshPhysicalNodeMaterial({ transmission: 1, roughness: 0.3 }),
  );
  water.rotation.x = -Math.PI * 0.5;
  water.position.y = -0.075;
  scene.add(water);

  /**
   * Board
   */
  // Brushes
  const boardFill = new Brush(new THREE.BoxGeometry(11, 2, 11));
  const boardHole = new Brush(new THREE.BoxGeometry(10, 2.1, 10));

  // Evaluate
  const evaluator = new Evaluator();
  const board = evaluator.evaluate(boardFill, boardHole, SUBTRACTION);
  board.geometry.clearGroups();
  const boardMaterial = new THREE.MeshStandardNodeMaterial({
    color: "#ffffff",
    metalness: 0,
    roughness: 0.3,
  });

  board.material = boardMaterial;

  // Shadows
  board.castShadow = true;
  board.receiveShadow = true;
  scene.add(board);

  // Tweaks
  gui
    .add(debugObject, "positionFrequency", 0, 2, 0.001)
    .name("Position Frequency")
    .onChange(() => (uPositionFrequency.value = debugObject.positionFrequency));

  gui
    .add(debugObject, "strength", 0, 10, 0.01)
    .name("Strength")
    .onChange(() => (uStrength.value = debugObject.strength));

  gui
    .add(debugObject, "warpFrequency", 0, 20, 0.01)
    .name("Warp Frequency")
    .onChange(() => (uWarpFrequency.value = debugObject.warpFrequency));

  gui
    .add(debugObject, "warpStrength", 0, 2, 0.001)
    .name("Warp Strength")
    .onChange(() => (uWarpStrength.value = debugObject.warpStrength));
  gui
    .addColor(debugObject, "colorWaterDeep")
    .name("Water Deep")
    .onChange(() => uColorWaterDeep.value.set(debugObject.colorWaterDeep));

  gui
    .addColor(debugObject, "colorWaterSurface")
    .name("Water Surface")
    .onChange(() =>
      uColorWaterSurface.value.set(debugObject.colorWaterSurface),
    );

  gui
    .addColor(debugObject, "colorSand")
    .name("Sand")
    .onChange(() => uColorSand.value.set(debugObject.colorSand));

  gui
    .addColor(debugObject, "colorGrass")
    .name("Grass")
    .onChange(() => uColorGrass.value.set(debugObject.colorGrass));

  gui
    .addColor(debugObject, "colorSnow")
    .name("Snow")
    .onChange(() => uColorSnow.value.set(debugObject.colorSnow));

  gui
    .addColor(debugObject, "colorRock")
    .name("Rock")
    .onChange(() => uColorRock.value.set(debugObject.colorRock));

  /**
   * Lights
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
   * Animate
   */
  const tick = () => {
    controls.update();

    // Render
    renderer.render(scene, camera);
  };

  renderer.setAnimationLoop(tick);
})();
