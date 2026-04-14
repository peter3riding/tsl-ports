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
  rotateUV,

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
  rotate,
} from "three/tsl";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

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
   * Loaders
   */
  const textureLoader = new THREE.TextureLoader();
  const gltfLoader = new GLTFLoader();

  /**
   * Baked Model
   */
  gltfLoader.load(
    "./bakedModel.glb",
    (gltf) => {
      const baked = gltf.scene.getObjectByName("baked");
      if (baked && baked instanceof THREE.Mesh && baked.material) {
        const material = baked.material as
          | THREE.MeshStandardMaterial
          | THREE.MeshBasicMaterial;
        if (material.map) {
          material.map.anisotropy = 8;
        }
      }

      scene.add(gltf.scene);
    },
    undefined,
    (error) => {
      console.error("❌ Error loading baked model:", error);
    },
  );

  /**
   * Sizes
   */
  const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  /**
   * Camera (same as your classic baked scene)
   */
  const camera = new THREE.PerspectiveCamera(
    25,
    sizes.width / sizes.height,
    0.1,
    100,
  );
  camera.position.set(8, 10, 12);
  scene.add(camera);

  /**
   * Controls (same as your classic baked scene)
   */
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 3, 0); // same as your original
  controls.enableDamping = true;

  /**
   * Renderer + Post-processing (WebGPU)
   */
  const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
    antialias: true,
  });

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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
   * Smoke
   */
  // Uniforms
  const uTime = uniform(float(0));
  // Geometry
  const smokeGeometry = new THREE.PlaneGeometry(1, 1, 16, 64);
  smokeGeometry.translate(0, 0.5, 0);
  smokeGeometry.scale(1.5, 6, 1.5);

  const smokeTexture = await textureLoader.loadAsync("./perlin.png");

  smokeTexture.wrapS = THREE.RepeatWrapping;
  smokeTexture.wrapT = THREE.RepeatWrapping;
  smokeTexture.colorSpace = THREE.NoColorSpace;

  const perlin = texture(smokeTexture);

  const smokeMaterial = new THREE.MeshBasicNodeMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    // wireframe: true,
  });

  const transformSmoke = Fn(() => {
    // Twist
    const twist = texture(
      perlin,
      vec2(0.5, uv().y.sub(time.mul(0.005)).mul(0.2)),
    ).r.mul(10);

    const positionXZ = rotateUV(positionLocal.xz, twist, vec2(0, 0));

    // Wind
    const windOffset = vec2(
      texture(perlin, vec2(0.25, time.mul(0.01))).r.sub(0.5),
      texture(perlin, vec2(0.75, time.mul(0.01))).r.sub(0.5),
    ).mul(uv().y.pow(2).mul(10));

    positionXZ.addAssign(windOffset);

    return vec3(positionXZ.x, positionLocal.y, positionXZ.y);
  });

  smokeMaterial.positionNode = transformSmoke();

  const smokeAlphaTransform = Fn(() => {
    const smokeUv = uv()
      .mul(vec2(0.5, 0.3))
      .sub(vec2(0, uTime.mul(0.03)));
    let smoke = perlin.sample(smokeUv).r;

    // Remap
    smoke = smoothstep(0.5, 1, smoke);

    // Edges
    const edgeFade = smoothstep(0.0, 0.1, uv().x) // left
      .mul(smoothstep(1.0, 0.9, uv().x)) // right
      .mul(smoothstep(1.0, 0.4, uv().y)) // top
      .mul(smoothstep(0.0, 0.1, uv().y)); // bottom

    return smoke.mul(edgeFade);
  });

  smokeMaterial.colorNode = vec4(0.6, 0.3, 0.2, smokeAlphaTransform());
  //smokeMaterial.colorNode = vec4(1.0, 0.0, 0.0, 1.0);

  const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
  smoke.position.y = 1.83;
  scene.add(smoke);

  /**
   * Animate
   */
  const timer = new THREE.Timer();

  const tick = () => {
    timer.update();
    uTime.value = timer.getElapsed();
    controls.update();

    // WebGPU render
    postProcessing.render();
  };

  renderer.setAnimationLoop(tick);
})();
