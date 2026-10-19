// One fighter on the stage: a copy of computerboi.glb at the engine's position, facing the opponent,
// showing the pose pose.js reads from the engine's state.
import * as THREE from "three/webgpu";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { POSE_CLIPS } from "./pose.js";

/** The engine counts centimetres; the scene, metres. */
export const UNIT = 0.01;
/** The fighters' height on the stage, in metres. */
export const HEIGHT = 1.45;

/** Each player's colours, by the model's material names: the TV's casing and its trim. */
const LOOKS = {
  p1: { "Material.005": 0xd8402f, "Material.006": 0xf2b134 },
  p2: { "Material.005": 0x2456d8, "Material.006": 0x35c8ff },
};

export class Fighter {
  /** `gltf` is the loaded model, shared by both fighters; `player` is "p1" or "p2". */
  constructor(gltf, player) {
    this.player = player;
    this.root = new THREE.Group();
    this.root.rotation.y = player === "p1" ? Math.PI / 2 : -Math.PI / 2; // the model faces +z
    this.model = cloneSkinned(gltf.scene);
    this.root.add(this.model);

    this.materials = [];
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      if (o.name.startsWith("hitbox")) {
        o.visible = false; // debugging only: the engine's ranges decide every hit
        return;
      }
      o.frustumCulled = false; // the skinned bounds lag the pose
      o.material = o.material.clone(); // each fighter its own colours and flash
      const m = o.material;
      if (m.name in LOOKS[player]) m.color.set(LOOKS[player][m.name]);
      if (m.name === "square") {
        // The TV's screen glows: round 2 shows the player's NFT on it.
        m.emissive = new THREE.Color(0xffffff);
        m.emissiveMap = m.map;
        m.emissiveIntensity = 0.9;
      } else {
        this.materials.push(m);
      }
    });
    this.flashLeft = 0;

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const name of POSE_CLIPS) {
      const clip = gltf.animations.find((a) => a.name === name);
      if (clip) this.actions[name] = this.mixer.clipAction(clip);
    }
    this.current = null;

    fitHeight(this.model, HEIGHT);
  }

  /** Shows `pose` (from poseOf) at engine position `x`, `dt` seconds after the last call. */
  update(pose, x, dt) {
    this.root.position.x = x * UNIT;
    const action = this.actions[pose.clip];
    if (action && action !== this.current) {
      action.reset();
      action.setLoop(pose.time === null ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = true;
      action.play();
      if (this.current) this.current.crossFadeTo(action, pose.fade, false);
      this.current = action;
    }
    if (action) {
      action.setEffectiveTimeScale(pose.time === null ? pose.rate : 0);
      if (pose.time !== null) action.time = Math.min(pose.time, action.getClip().duration);
    }
    this.mixer.update(dt);

    if (this.flashLeft > 0 || this.glowing) {
      this.flashLeft = Math.max(0, this.flashLeft - dt);
      const glow = (this.flashLeft / FLASH_SECONDS) * 0.45;
      for (const m of this.materials) m.emissive.setScalar(glow);
      this.glowing = this.flashLeft > 0;
    }
  }

  /** A short white flash: the fighter was hit. */
  flash() {
    this.flashLeft = FLASH_SECONDS;
    this.glowing = true;
  }
}

const FLASH_SECONDS = 0.1;

/** Scales `model` to `height` metres tall in its first pose, its feet on the floor. */
function fitHeight(model, height) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const size = box.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(height / size.y);
  model.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(model, true);
  model.position.y -= fitted.min.y;
}
