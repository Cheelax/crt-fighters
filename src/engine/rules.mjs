// The fight's fixed numbers. Every entry uses these values unchanged: the checks expect them.
// Positions are whole units along the stage (1 unit = 1 cm), so every implementation agrees to the unit.

/** Simulation frames per second. The engine always advances one frame at a time. */
export const FPS = 60;
/** Hit points at the start of each round. */
export const MAX_HP = 100;
/** A round lasts 60 s: after this many frames, it ends on time. */
export const ROUND_FRAMES = 3600;
/** Round wins needed to win the match (best of 3). */
export const ROUNDS_TO_WIN = 2;
/** Frames between the end of a round and the start of the next one; inputs are ignored meanwhile. */
export const ROUND_PAUSE_FRAMES = 90;

/** Player 1 starts at -START_X, player 2 at +START_X. Player 1 is always on the left. */
export const START_X = 150;
/** Units per frame walking towards the opponent. */
export const WALK_FORWARD = 3;
/** Units per frame walking away from the opponent. */
export const WALK_BACK = 2;
/** The fighters never get closer than this. */
export const MIN_DISTANCE = 60;
/** Positions stay within [-STAGE_HALF_WIDTH, STAGE_HALF_WIDTH]. */
export const STAGE_HALF_WIDTH = 400;

/** The buttons of one player's input, as written in a simulation file. */
export const BUTTONS = ["forward", "back", "lp", "rp", "lk", "rk"];
/** The attack buttons: at most one of them per frame. */
export const ATTACK_BUTTONS = ["lp", "rp", "lk", "rk"];

/**
 * The moves, keyed by the input that starts them. `forward+rk` is `rk` pressed while holding forward.
 * Frames: `startup` frames, then `active` frames (the move can hit), then `recovery` frames.
 * `range` is the largest distance between the fighters at which an active frame hits.
 * `height`: "high" and "mid" are blocked by holding back, "low" is not.
 * `hitstun` and `blockstun`: frames the defender cannot act after being hit or after blocking.
 * `anim` is the clip's name in public/models/computerboi.glb.
 */
export const MOVES = {
  lp: { name: "left punch", anim: "leftpunch", damage: 5, startup: 6, active: 3, recovery: 10, range: 100, height: "high", hitstun: 12, blockstun: 8 },
  rp: { name: "right punch", anim: "rightpunch", damage: 7, startup: 8, active: 3, recovery: 12, range: 100, height: "high", hitstun: 14, blockstun: 9 },
  lk: { name: "low kick", anim: "lowkick", damage: 7, startup: 10, active: 3, recovery: 16, range: 110, height: "low", hitstun: 16, blockstun: 10 },
  rk: { name: "middle kick", anim: "middlekick", damage: 9, startup: 12, active: 3, recovery: 18, range: 120, height: "mid", hitstun: 18, blockstun: 12 },
  "forward+rk": { name: "high kick", anim: "highkick", damage: 12, startup: 15, active: 3, recovery: 22, range: 130, height: "high", hitstun: 22, blockstun: 14 },
};

/** Clips of the model for the other states. */
export const ANIMS = {
  idle: "idle",
  forward: "stepfroward",
  back: "stepbackward",
  hitHigh: "headhit",
  hitMid: "middlehit",
  ko: "ko",
  victory: "victory",
};
