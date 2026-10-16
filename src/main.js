// The page: renders the arena with three.js (WebGPU, WebGL 2 as a fallback) and drives the engine.
// Round 1 builds the fight; this base only proves that the renderer starts.
import * as THREE from "three/webgpu";

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b10);
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 6);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// The page's state, read by the checks: see ARCHITECTURE.md, "The page".
window.__crt = { ready: false, renderer: null, fight: null };

await renderer.init();
window.__crt.renderer = renderer.backend.isWebGPUBackend ? "webgpu" : "webgl2";
document.getElementById("status").textContent = "CRT Fighters: round 1 builds the fight.";
renderer.setAnimationLoop(() => renderer.render(scene, camera));
