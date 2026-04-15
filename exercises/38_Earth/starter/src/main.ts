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
  cameraPosition,

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
  negate,
  reflect,

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

  // Loaders
  const textureLoader = new THREE.TextureLoader();

  // Textures
  const earthDayTexture = await textureLoader.loadAsync("./earth/day.jpg");
  earthDayTexture.colorSpace = THREE.SRGBColorSpace;
  earthDayTexture.anisotropy = 8;

  const earthNightTexture = await textureLoader.loadAsync("./earth/night.jpg");
  earthNightTexture.colorSpace = THREE.SRGBColorSpace;
  earthNightTexture.anisotropy = 8;

  const specularCloudsTexture = await textureLoader.loadAsync(
    "./earth/specularClouds.jpg",
  );
  specularCloudsTexture.anisotropy = 8;

  /**
   * Earth
   */
  const earthParameters = {
    atmosphereDayColor: "#00aaff",
    atmosphereTwilightColor: "#ff6600",
  };

  // Uniforms
  const atmosphereDayColor = uniform(color(earthParameters.atmosphereDayColor));
  const atmosphereTwilightColor = uniform(
    color(earthParameters.atmosphereTwilightColor),
  );

  const earthGeometry = new THREE.SphereGeometry(2, 64, 64);
  const material = new THREE.MeshBasicNodeMaterial();
  const earth = new THREE.Mesh(earthGeometry, material);
  scene.add(earth);

  // Atmosphere
  const atmosphereMaterial = new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide,
    transparent: true,
  });
  const atmosphere = new THREE.Mesh(earthGeometry, atmosphereMaterial);
  atmosphere.scale.set(1.04, 1.04, 1.04);
  scene.add(atmosphere);

  /**
   * Sun
   */
  const sunSpherical = new THREE.Spherical(1, Math.PI * 0.5, 0.5);
  const sunDirectionVec = new THREE.Vector3();

  // placeholder values
  const sunDirection = uniform(vec3(0, 0, 1));

  const debugSun = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.1, 2),
    new THREE.MeshBasicMaterial({ color: "#ffdd88" }),
  );
  scene.add(debugSun);

  const updateSun = () => {
    sunDirectionVec.setFromSpherical(sunSpherical);

    // Move debug sun outside the Earth
    debugSun.position.copy(sunDirectionVec).multiplyScalar(5);

    // Update the uniform that the shader uses
    sunDirection.value.copy(sunDirectionVec);
  };

  updateSun();

  /**
   * Day / Night Color
   */
  material.colorNode = Fn(() => {
    const viewDirection = positionWorld.sub(cameraPosition).normalize();
    const sunOrientation = normalWorld.dot(sunDirection);

    // Textures
    const dayColor = texture(earthDayTexture, uv()).rgb;
    const nightColor = texture(earthNightTexture, uv()).rgb;
    const specularCloudColor = texture(specularCloudsTexture, uv()).rg;

    // Day Mix
    const dayMix = smoothstep(-0.25, 0.5, sunOrientation);
    let color = mix(nightColor, dayColor, dayMix);

    // Clouds
    const clouds = specularCloudColor.g.smoothstep(0.5, 1).mul(dayMix);
    color = mix(color, vec3(1), clouds);

    // Fresnel
    const fresnel = viewDirection.dot(normalWorld).add(1).pow(2);

    // Atmosphere
    const atmosphereMix = sunOrientation.smoothstep(-0.5, 1);
    const atmosphereColor = mix(
      atmosphereTwilightColor,
      atmosphereDayColor,
      atmosphereMix,
    );
    color = mix(color, atmosphereColor, fresnel.mul(atmosphereMix));

    // Specular
    const reflection = reflect(sunDirection, normalWorld);
    const specular = viewDirection
      .dot(reflection)
      .saturate()
      .pow(32)
      .mul(specularCloudColor.r);
    const specularColor = mix(vec3(1), atmosphereColor, fresnel);

    return color.add(specular.mul(specularColor));
  })();

  atmosphereMaterial.colorNode = Fn(() => {
    const viewDirection = positionWorld.sub(cameraPosition).normalize();
    const sunOrientation = normalWorld.dot(sunDirection.negate());

    // Atmosphere
    const atmosphereDayMix = smoothstep(-0.5, 1, sunOrientation);
    const atmosphereColor = mix(
      atmosphereTwilightColor,
      atmosphereDayColor,
      atmosphereDayMix,
    );

    const color = mix(vec3(0), atmosphereColor, atmosphereDayMix);

    // Edge Alpha
    const edgeAlpha = viewDirection
      .dot(normalWorld.negate())
      .smoothstep(0, 0.5);

    // Day Alpha
    const dayAlpha = sunOrientation.smoothstep(-0.5, 0);

    const alpha = edgeAlpha.mul(dayAlpha);

    return vec4(color, alpha);
  })();

  // GUI
  gui
    .add(sunSpherical, "phi")
    .min(0)
    .max(Math.PI)
    .name("sun phi")
    .onChange(updateSun);

  gui
    .add(sunSpherical, "theta")
    .min(-Math.PI)
    .max(Math.PI)
    .name("sun theta")
    .onChange(updateSun);
  gui.addColor(earthParameters, "atmosphereDayColor").onChange(() => {
    atmosphereDayColor.value.set(earthParameters.atmosphereDayColor);
  });

  gui.addColor(earthParameters, "atmosphereTwilightColor").onChange(() => {
    atmosphereTwilightColor.value.set(earthParameters.atmosphereTwilightColor);
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
  camera.position.set(12, 5, 4);
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

  await renderer.init();

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
  const tick = () => {
    controls.update();

    // Modern WebGPU render
    postProcessing.render();
  };

  renderer.setAnimationLoop(tick);
})();
