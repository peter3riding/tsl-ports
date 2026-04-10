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
  max,

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
  dot,
  length,

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
  sign,
  cameraPosition,
  reflect,
} from "three/tsl";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { normalize } from "three/src/math/MathUtils.js";
import { lightPosition } from "three/src/nodes/TSL.js";

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
   * Material
   */
  const material = new THREE.MeshBasicNodeMaterial();

  // Uniform
  const uColor = uniform(color("#ffffff"));

  material.colorNode = Fn(() => {
    let light = vec3(0);
    const viewDirection = positionWorld.sub(cameraPosition).normalize();
    // light.addAssign(
    //   pointLight(
    //     vec3(0.1, 0.1, 1), // Color
    //     1, // Intensity
    //     normalWorld, // Normal
    //     vec3(0, 0, 3), // Light Position
    //     viewDirection,
    //     20, // Specular Power
    //   ),
    // );

    const pointLight = (
      lightColor: any,
      lightIntensity: any,
      normal: any,
      lightPosition: any,
      viewDirection: any,
      specularPower: any,
      position: any,
      lightDecay: any,
    ) => {
      const lightDelta = lightPosition.sub(position);
      const lightDirection = lightDelta.normalize();
      const distanceToLight = length(lightDelta);
      const reflection = reflect(lightDirection, normal);

      // Decay
      const decay = distanceToLight.mul(lightDecay).oneMinus();

      // Shading
      const shading = dot(normal, lightDirection).max(0);

      // Specular
      const specular = dot(reflection, viewDirection).max(0).pow(specularPower);

      return lightColor
        .mul(lightIntensity)
        .mul(decay)
        .mul(shading.add(specular));
    };

    light.addAssign(
      pointLight(
        vec3(1.0, 0.1, 0.1), // Light color
        1.0, // Light intensity,
        normalWorld, // Normal
        vec3(0.0, 2.5, 0.0), // Light position
        viewDirection, // View direction
        20.0, // Specular power;
        positionWorld,
        0.3, // Light Decay
      ),
    );
    return uColor.rgb.mul(light);
  })();

  /**
   * GUI
   */
  const materialParameters = {
    color: "#ffffff",
  };

  gui.addColor(materialParameters, "color").onChange(() => {
    uColor.value.set(materialParameters.color);
  });

  /**
   * Light helpers
   */
  const directionalLightHelper = new THREE.Mesh(
    new THREE.PlaneGeometry(),
    new THREE.MeshBasicMaterial(),
  );
  directionalLightHelper.material.color.set(0.1, 0.1, 1);
  directionalLightHelper.material.side = THREE.DoubleSide;
  directionalLightHelper.position.set(0, 0, 3);
  scene.add(directionalLightHelper);

  const pointLightHelper = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.1, 2),
    new THREE.MeshBasicMaterial(),
  );
  pointLightHelper.material.color.set(1, 0.1, 0.1);
  pointLightHelper.position.set(0, 2.5, 0);
  scene.add(pointLightHelper);

  /**
   * Objects
   */
  // Sphere
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), material);
  sphere.position.x = -3;
  scene.add(sphere);

  // Torus Knot
  const torusKnot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.6, 0.25, 128, 32),
    material,
  );
  torusKnot.position.x = 3;
  scene.add(torusKnot);

  // Suzanne (GLTF)
  let suzanne: THREE.Group | null = null;
  const gltfLoader = new GLTFLoader();
  gltfLoader.load("./suzanne.glb", (gltf) => {
    suzanne = gltf.scene;
    suzanne.traverse((child) => {
      if (child instanceof THREE.Mesh) child.material = material;
    });
    scene.add(suzanne);
  });

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
    25,
    sizes.width / sizes.height,
    0.1,
    100,
  );
  camera.position.set(7, 7, 7);
  scene.add(camera);

  /**
   * Controls
   */
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  /**
   * Renderer
   */
  const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
    antialias: true,
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
    const elapsedTime = timer.getElapsed();

    // Rotate objects (exactly like your second snippet)
    if (suzanne) {
      suzanne.rotation.x = -elapsedTime * 0.1;
      suzanne.rotation.y = elapsedTime * 0.2;
    }

    sphere.rotation.x = -elapsedTime * 0.1;
    sphere.rotation.y = elapsedTime * 0.2;

    torusKnot.rotation.x = -elapsedTime * 0.1;
    torusKnot.rotation.y = elapsedTime * 0.2;

    controls.update();

    // Modern WebGPU render (kept your post-processing pipeline)
    postProcessing.render();
  };

  renderer.setAnimationLoop(tick);
})();

//  const ambientLight = (color: any, intensity: any) => {
//     return mul(color, intensity);
//   };

//   // Fragment
//   material.colorNode = Fn(() => {
//     const light = vec3(0, 0, 0).toVar();

//     // Safe to use with sign(), addAssign, etc.
//     light.addAssign(ambientLight(vec3(0, 0, 4), float(0.5)));

//     return uColor.rgb.mul(light);
//   })();

//__

// const directionalLight = (
//   lightColor: any,
//   lightIntensity: any,
//   normal: any,
//   lightPosition: any,
//   viewDirection: any,
//   specularPower: any,
// ) => {
//   const lightDirection = lightPosition.normalize();
//   const lightReflection = reflect(lightDirection, normal);

//   // Shading
//   const shading = max(0, dot(normal, lightDirection));

//   // Specular
//   const specular = dot(lightReflection, viewDirection)
//     .max(0)
//     .pow(specularPower);

//   return lightColor
//     .mul(lightIntensity)
//     .mul(shading)
//     .add(lightColor.mul(lightIntensity).mul(specular));
// };

// material.colorNode = Fn(() => {
//   let light = vec3(0).toVar();
//   const viewDirection = positionWorld.sub(cameraPosition).normalize();
//   light.addAssign(
//     directionalLight(
//       vec3(0.1, 0.1, 1), // Color
//       1, // Intensity
//       normalWorld, // Normal
//       vec3(0, 0, 3), // Light Position
//       viewDirection,
//       20, // Specular Power
//     ),
//   );
//   return uColor.rgb.mul(light);
// })();

// const material = new THREE.MeshBasicNodeMaterial();

// // Uniform
// const uColor = uniform(color("#ffffff"));

// const pointLight = (
//   lightColor: any,
//   lightIntensity: any,
//   normal: any,
//   lightPosition: any,
//   viewDirection: any,
//   specularPower: any,
//   position: any,
//   lightDecay: any,
// ) => {
//   const lightDelta = lightPosition.sub(position);
//   const lightDistance = length(lightDelta);
//   const lightDirection = lightDelta.normalize();
//   const reflection = reflect(lightDirection, normal);

//   // Decay
//   const decay = lightDistance.mul(lightDecay).oneMinus();

//   // Shading
//   const shading = dot(normal, lightDirection).max(0);

//   // Specular
//   const specular = dot(reflection, viewDirection).max(0).pow(20);

//   return lightColor.mul(lightIntensity).mul(decay).mul(shading.add(specular));
// };
