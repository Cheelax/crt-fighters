// The page's pure parts, without a browser: the controls, and the poses read from the engine's state.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFight, step } from "../src/engine/fight.mjs";
import { ANIMS, MOVES } from "../src/engine/rules.mjs";
import { keyButtons } from "../src/input/keyboard.js";
import { padButtons } from "../src/input/gamepad.js";
import { MOVE_CLIPS, moveClipTime } from "../src/scene/clips.js";
import { poseOf } from "../src/scene/pose.js";

const pad = (axes0, buttons = []) => ({ axes: [axes0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i) })) });

test("the keys of ARCHITECTURE.md: D and ArrowLeft are each player's forward", () => {
  const down = new Set(["KeyD", "KeyU", "ArrowLeft", "Numpad2"]);
  assert.deepEqual(keyButtons(down, "p1"), { forward: true, back: false, lp: true, rp: false, lk: false, rk: false });
  assert.deepEqual(keyButtons(down, "p2"), { forward: true, back: false, lp: false, rp: false, lk: false, rk: true });
});

test("a gamepad's stick or d-pad towards the opponent is forward: right for player 1, left for player 2", () => {
  assert.equal(padButtons(pad(1), "p1").forward, true);
  assert.equal(padButtons(pad(0.4), "p1").forward, false, "the stick counts past half way");
  assert.equal(padButtons(pad(0, [14]), "p2").forward, true);
  assert.equal(padButtons(pad(0, [14]), "p1").back, true);
  assert.deepEqual(padButtons(pad(0, [2, 1]), "p1"), { forward: false, back: false, lp: true, rp: false, lk: false, rk: true });
  assert.equal(padButtons(null, "p1").forward, false);
});

test("each move's clip shows its strike at the range on the move's first active frame", () => {
  for (const [key, move] of Object.entries(MOVES)) {
    const c = MOVE_CLIPS[key];
    assert.equal(moveClipTime(key, 0), c.from, key);
    assert.equal(moveClipTime(key, move.startup), c.impact, key);
    assert.equal(moveClipTime(key, move.startup + move.active + move.recovery), c.to, key);
    let last = -1;
    for (let f = 0; f <= move.startup + move.active + move.recovery; f += 0.25) {
      assert.ok(moveClipTime(key, f) >= last, `${key} never plays backwards`);
      last = moveClipTime(key, f);
    }
  }
});

test("poses follow the engine: walking, a move, a hit, then the knockout and the victory", () => {
  let s = step(createFight(), { p1: { forward: true } });
  assert.equal(poseOf(s, "p1").clip, ANIMS.forward);
  assert.equal(poseOf(s, "p2").clip, ANIMS.idle);
  for (let i = 0; i < 66; i++) s = step(s, { p1: { forward: true } });
  s = step(s, { p1: { lp: true } });
  assert.deepEqual([poseOf(s, "p1").clip, poseOf(s, "p1").time], [MOVES.lp.anim, MOVE_CLIPS.lp.from]);
  for (let i = 0; i < 6; i++) s = step(s, {});
  assert.equal(poseOf(s, "p2").clip, ANIMS.hitHigh, "a punch is high");
  for (let i = 0; i < 400; i++) s = step(s, { p1: { lp: true } });
  assert.equal(s.ended, true);
  assert.equal(poseOf(s, "p2", 0, 30).clip, ANIMS.ko);
  assert.equal(poseOf(s, "p1", 0, 30).clip, ANIMS.victory);
  assert.equal(poseOf(s, "p1", 0, 30).time, 0.5);
});
