// The arena: the stage the engine's positions live on ([-400, 400] units), its lights, and the camera
// that keeps both fighters in view from the side.
import * as THREE from "three/webgpu";
import { STAGE_HALF_WIDTH } from "../engine/rules.mjs";
import { UNIT } from "./fighter.js";

const HALF = STAGE_HALF_WIDTH * UNIT; // 4 m
const DEPTH = 3;

export function createStage() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060c);
  scene.fog = new THREE.Fog(0x07060c, 9, 24);

  scene.add(new THREE.HemisphereLight(0x9aa8ff, 0x281420, 1.1));
  const key = new THREE.DirectionalLight(0xfff1e0, 2.4);
  key.position.set(-2, 6, 6);
  scene.add(key);
  const rimLeft = new THREE.DirectionalLight(0xff3d8b, 1.6);
  rimLeft.position.set(-6, 3, -4);
  scene.add(rimLeft);
  const rimRight = new THREE.DirectionalLight(0x35c8ff, 1.6);
  rimRight.position.set(6, 3, -4);
  scene.add(rimRight);

  // The floor around the stage, then the stage: exactly as wide as the engine's, its ends lit.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: 0x0d0b14, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.12;
  scene.add(floor);

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(HALF * 2, 0.12, DEPTH),
    new THREE.MeshStandardMaterial({ color: 0x1a1726, roughness: 0.45, metalness: 0.3 }),
  );
  deck.position.y = -0.06;
  scene.add(deck);

  const grid = new THREE.GridHelper(HALF * 2, 16, 0x3a2f66, 0x251f40);
  grid.scale.z = DEPTH / (HALF * 2);
  grid.position.y = 0.002;
  scene.add(grid);

  const neon = (color) => new THREE.MeshBasicMaterial({ color });
  for (const z of [DEPTH / 2, -DEPTH / 2]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 0.03, 0.03), neon(0x8c5cff));
    strip.position.set(0, 0.0, z);
    scene.add(strip);
  }
  for (const [x, color] of [[-HALF, 0xff3d8b], [HALF, 0x35c8ff]]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, DEPTH), neon(color));
    end.position.set(x, 0.0, 0);
    scene.add(end);
    for (const z of [DEPTH / 2, -DEPTH / 2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 10), neon(color));
      post.position.set(x, 0.65, z);
      scene.add(post);
    }
  }

  scene.add(backdrop());
  return scene;
}

/** A wall of old televisions behind the stage, their screens lit. */
function backdrop() {
  const group = new THREE.Group();
  const cabinet = new THREE.MeshStandardMaterial({ color: 0x1b1822, roughness: 0.7 });
  const colors = [0x35c8ff, 0xff3d8b, 0x8c5cff, 0x3ad6c8, 0xf2b134];
  const screens = colors.map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(0.22) }));
  const box = new THREE.BoxGeometry(1, 1, 1);
  const face = new THREE.PlaneGeometry(1, 1);
  let n = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = -7; col <= 7; col++) {
      const w = 1.25 + ((col * 7 + row * 3) % 3) * 0.12;
      const tv = new THREE.Mesh(box, cabinet);
      tv.scale.set(w, 0.95, 0.9);
      tv.position.set(col * 1.45, 0.55 + row * 1.0, -6.5 - Math.abs(col) * 0.12);
      group.add(tv);
      const screen = new THREE.Mesh(face, screens[n++ % screens.length]);
      screen.scale.set(w * 0.78, 0.7, 1);
      screen.position.set(tv.position.x, tv.position.y + 0.02, tv.position.z + 0.451);
      group.add(screen);
    }
  }
  return group;
}

/**
 * The camera: from the side, at the fighters' midpoint, pulled back as they part. It eases towards
 * that place, and `shake` (seconds left, strength) jolts it on a hit.
 */
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 60);
  const goal = new THREE.Vector3();
  const look = new THREE.Vector3();
  let shake = 0;
  let strength = 0;
  const rig = {
    camera,
    jolt(s) {
      shake = 0.18;
      strength = Math.max(strength, s);
    },
    /** Frames both fighters, at x1 and x2 metres, `dt` seconds after the last call. */
    follow(x1, x2, dt, snap = false) {
      const mid = (x1 + x2) / 2;
      const spread = Math.abs(x2 - x1);
      const fit = (spread / 2 + 1.1) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(camera.aspect, 0.6);
      const distance = Math.max(4.8, fit);
      goal.set(mid * 0.92, 1.05 + distance * 0.04, distance);
      const ease = snap ? 1 : 1 - Math.exp(-dt * 6);
      camera.position.lerp(goal, ease);
      look.lerp(new THREE.Vector3(mid, 0.85, 0), ease);
      camera.lookAt(look);
      if (shake > 0) {
        shake = Math.max(0, shake - dt);
        const k = strength * (shake / 0.18);
        camera.position.x += (Math.random() - 0.5) * k;
        camera.position.y += (Math.random() - 0.5) * k;
        if (shake === 0) strength = 0;
      }
    },
  };
  return rig;
}
