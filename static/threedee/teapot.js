// teapot.js
import * as THREE from "three";
import { TeapotGeometry } from "three/examples/jsm/geometries/TeapotGeometry.js";

/**
 * Spawns a teapot 3D scene into the given container.
 * @param {HTMLElement} container - The DOM element to host the 3D canvas.
 * @param {Object} [options] - Optional settings.
 * @returns {Object} An object containing scene, camera, renderer, and the teapot mesh.
 */
export function spawnTeapot(container, options = {}) {
  // Set container size (in pixels)
  const containerSize = options.containerSize || 150;
  const teapotSize = options.teapotSize || 0.8;
  const tessellation = options.tessellation || 10;
  const baseSpeed = options.baseSpeed || 0.01;
  const hoverSpeed = options.hoverSpeed || 0.05;
  const cameraZ = options.cameraZ || 3;

  // Create scene, camera, and renderer.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    containerSize / containerSize,
    0.1,
    1000
  );
  camera.position.z = cameraZ;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(containerSize, containerSize);
  container.appendChild(renderer.domElement);

  // Load a cubemap for realistic reflections
  const cubemapUrls = options.cubemapUrls || [
    "https://threejs.org/examples/textures/cube/Bridge2/posx.jpg",
    "https://threejs.org/examples/textures/cube/Bridge2/negx.jpg",
    "https://threejs.org/examples/textures/cube/Bridge2/posy.jpg",
    "https://threejs.org/examples/textures/cube/Bridge2/negy.jpg",
    "https://threejs.org/examples/textures/cube/Bridge2/posz.jpg",
    "https://threejs.org/examples/textures/cube/Bridge2/negz.jpg",
  ];
  const loader = new THREE.CubeTextureLoader();
  const cubemap = loader.load(cubemapUrls);
//   scene.background = cubemap;

  // Create a glossy material that uses the cubemap for reflections.
  const material = new THREE.MeshStandardMaterial({
    color: options.color || 0xffffff,
    metalness: 1.0,
    roughness: 0,
    envMap: cubemap,
    envMapIntensity: 1.0,
  });

  // Create the teapot geometry and mesh.
  const teapotGeometry = new TeapotGeometry(
    teapotSize,
    tessellation,
    true,
    true,
    true,
    true
  );
  const teapotMesh = new THREE.Mesh(teapotGeometry, material);
  scene.add(teapotMesh);

  // Add lighting to the scene.
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  // Set up animation loop with rotation speed control.
  let currentSpeed = baseSpeed;
  function animate() {
    requestAnimationFrame(animate);
    teapotMesh.rotation.x += currentSpeed;
    teapotMesh.rotation.y += currentSpeed;
    renderer.render(scene, camera);
  }
  animate();

  // Increase rotation speed when hovering over the container.
  container.addEventListener("mouseenter", () => {
    scene.background = cubemap;
    currentSpeed = hoverSpeed;
  });
  container.addEventListener("mouseleave", () => {
    scene.background = 0x0;
    currentSpeed = baseSpeed;
  });

  // Return an object in case you want to control the scene later.
  return { scene, camera, renderer, teapotMesh };
}
