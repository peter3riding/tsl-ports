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
  rotate,
  Fn,
  transformNormalToView,
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
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

(async () => {
  /**
   * Base
   */
  // Debug
  const gui = new GUI({ width: 400 });

  // Canvas — explicit cast fixes TS error
  const canvas = document.querySelector("canvas.webgl") as HTMLCanvasElement;

  // Scene
  const scene = new THREE.Scene();

  /**
   * Loaders
   */
  const textureLoader = new THREE.TextureLoader();
  const gltfLoader = new GLTFLoader();
  const cubeTextureLoader = new THREE.CubeTextureLoader();

  /**
   * Update all materials
   */
  const updateAllMaterials = () => {
    scene.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.material instanceof THREE.MeshStandardNodeMaterial
      ) {
        child.material.envMapIntensity = 1;
        child.material.needsUpdate = true;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  };

  /**
   * Environment map
   */
  const environmentMap = cubeTextureLoader.load([
    "/textures/environmentMaps/0/px.jpg",
    "/textures/environmentMaps/0/nx.jpg",
    "/textures/environmentMaps/0/py.jpg",
    "/textures/environmentMaps/0/ny.jpg",
    "/textures/environmentMaps/0/pz.jpg",
    "/textures/environmentMaps/0/nz.jpg",
  ]);
  scene.background = environmentMap;
  scene.environment = environmentMap;

  /**
   * Uniforms
   */
  const uTime = uniform(0);
  /**
   * Material
   */
  const mapTexture = textureLoader.load("/models/LeePerrySmith/color.jpg");
  mapTexture.colorSpace = THREE.SRGBColorSpace;

  const normalTexture = textureLoader.load("/models/LeePerrySmith/normal.jpg");

  const material: THREE.MeshStandardNodeMaterial =
    new THREE.MeshStandardNodeMaterial({
      map: mapTexture,
      normalMap: normalTexture,
    });

  // Position twist
  material.positionNode = Fn(() => {
    const p = positionLocal.toVar();
    const angle = p.y.add(uTime).mul(0.9);
    const rotated = rotate(p.xz, angle);
    p.x = rotated.x;
    p.z = rotated.y;
    return p;
  })();

  // Normal correction

  material.normalNode = Fn(() => {
    const n = normalLocal.toVar();

    // Use the same angle as positionNode
    const angle = positionLocal.y.add(uTime).mul(0.9);

    const rotated = rotate(n.xz, angle);

    n.x = rotated.x;
    n.z = rotated.y;

    // This is the important part the article recommends
    return transformNormalToView(n.normalize());
  })();

  // Shadow fix
  material.castShadowPositionNode = material.positionNode;

  /**
   * Models
   */
  gltfLoader.load("/models/LeePerrySmith/LeePerrySmith.glb", (gltf) => {
    const mesh = gltf.scene.children[0] as THREE.Mesh;

    mesh.rotation.y = Math.PI * 0.5;
    mesh.material = material;

    const depthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
    });
    (depthMaterial as any).positionNode = material.positionNode;
    (depthMaterial as any).normalNode = material.normalNode;

    mesh.customDepthMaterial = depthMaterial;
    mesh.castShadow = true;

    scene.add(mesh);

    // Update materials
    updateAllMaterials();
  });

  /**
   * Plane
   */
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 15, 15),
    new THREE.MeshStandardNodeMaterial(),
  );
  plane.receiveShadow = true;
  plane.rotation.y = Math.PI;
  plane.position.y = -5;
  plane.position.z = 5;
  scene.add(plane);

  /**
   * Lights
   */
  const directionalLight = new THREE.DirectionalLight("#ffffff", 3);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(1024, 1024);
  directionalLight.shadow.camera.far = 15;
  directionalLight.shadow.normalBias = 0.05;
  directionalLight.position.set(0.25, 2, -2.25);
  scene.add(directionalLight);

  // Add to your GUI for live tuning
  gui
    .add(directionalLight.shadow, "normalBias", 0, 0.5, 0.001)
    .name("Shadow Normal Bias");

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
  camera.position.set(4, 1, -4);
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
    antialias: true,
  });
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Shadow & tone mapping
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

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
