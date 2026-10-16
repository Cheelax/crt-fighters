# Architecture

CRT Fighters is a 3D fighting game in the browser, in the spirit of Tekken. Each fighter has a cathode-ray
TV for a head, and the TV shows its player's NFT. Two players fight a best of 3 rounds. It is built in
rounds on Hotpod: each round adds one layer, on top of the winning entry of the round before.

The names, commands, formats and numbers below are fixed: the checks of every round depend on them.
Entries differ inside these lines, never on them.

## Modules

```
index.html, src/main.js     the page: three.js WebGPURenderer (falls back to WebGL 2), built with vite
src/engine/rules.mjs        the fight's fixed numbers and the moves table (given, never changed)
src/engine/fight.mjs        the engine: pure and deterministic, no DOM, no three.js
src/input/                  keyboard and Gamepad API, turned into the engine's inputs
src/scene/                  the arena, the model, its animations, the CRT screen
bin/simulate.mjs            the simulator: replays inputs through the engine, prints JSON
public/models/computerboi.glb   the fighter (served at /models/computerboi.glb)
```

The engine is the single source of truth. The page and the simulator only feed it inputs and read its
state; the online server of round 3 will run the same engine.

## The model

`public/models/computerboi.glb` is a Mixamo rig with a CRT TV head. Its screen is the material named
`square`. Its hitbox meshes (`hitboxbody`, `hitboxlefthand`, `hitboxrighthand`, `hitboxleftfoot`,
`hitboxrightfoot`) are for debugging only: they stay hidden, and the engine's ranges decide every hit.
Its clips are named in `ANIMS` and in each move's `anim` (`src/engine/rules.mjs`): `idle`,
`stepfroward` (sic), `stepbackward`, `leftpunch`, `rightpunch`, `lowkick`, `middlekick`, `highkick`,
`headhit`, `middlehit`, `ko`, `victory`.

## The engine

`src/engine/fight.mjs` exports `createFight()` and `step(state, inputs)`. Each call to `step` advances one
frame (60 frames per second). `inputs` is `{ p1, p2 }`, each `{ forward, back, lp, rp, lk, rk }`
(booleans). The constants are in `src/engine/rules.mjs`; positions are whole units (1 unit = 1 cm).

**The start of a round.** Player 1 at x = -150, player 2 at x = +150, 100 hp each, no move, no stun.
Player 1 is always on the left: `forward` means +x for player 1 and -x for player 2.

**A fighter is free** when it is in no move and its stun is 0. Only a free fighter acts.

**One frame**, in this order:

1. **Timers.** A fighter in a move counts one more frame of it; once it has counted
   `startup + active + recovery` frames, the move is over and the fighter is free again. A fighter in
   stun counts it down by 1.
2. **Inputs**, for each free fighter:
   - an attack button starts that move (`rk` while holding `forward` starts `forward+rk`, the high kick).
     The move's first frame is this frame, and the fighter does not walk;
   - otherwise `forward` walks 3 units towards the opponent, `back` walks 2 units away;
   - a free fighter holding `back` with no attack button is **blocking** this frame.

   A held button keeps acting: holding `lp` starts a new punch on the first frame the fighter is free.
3. **Positions.** Player 1 moves first, then player 2. Each new position is kept within [-400, 400], then
   kept at least 60 units from the other fighter.
4. **Hits.** A move's active frames are the frames `startup` to `startup + active - 1` after its first
   frame (frame 0): a left punch started on frame f is active on frames f+6, f+7 and f+8. On an active
   frame, a move that has not hit yet hits if the distance between the fighters is at most its `range`.
   Both fighters' hits are resolved together, from the positions of step 3, so two attacks can trade.
   - **Blocked**: the defender is blocking (step 2) and the move is `high` or `mid`. No damage; the
     defender's stun becomes the move's `blockstun`.
   - **Hit**: anything else, lows included. The defender loses the move's `damage` (never below 0), its
     stun becomes the move's `hitstun`, and the move it was doing, if any, is cancelled.

   Either way the move has hit, and does not hit again.
5. **Knockout.** A fighter at 0 hp is knocked out: the round ends, won by the other one, by `"ko"`. If both
   are at 0 hp, the round ends with no winner and both fighters win a round.
6. **Time.** Otherwise the round has lasted one more frame. After 3600 frames it ends by `"time"`: won by
   the fighter with more hp, or, with equal hp, by no one, and both fighters win a round.

**The end of a round.** The first fighter to win 2 rounds wins the match. If both reach 2 rounds together,
the match ends with no winner. The match over, every later frame changes nothing. Otherwise the next 90
frames are a pause in which nothing moves and inputs are ignored; on the frame after them, a new round
starts, as above.

## The simulator

`node bin/simulate.mjs <inputs.json>` replays inputs through the engine and prints the result.

The input file:

```json
{ "frames": [ { "p1": "forward", "p2": "", "repeat": 40 }, { "p1": "lp", "p2": "back" }, { "p1": "forward+rk" } ] }
```

- `frames`: a list, possibly empty. Each item is one frame of input, or `repeat` frames of the same input.
- `p1`, `p2`: the buttons held, joined by `+`, among `forward`, `back`, `lp`, `rp`, `lk`, `rk`. An empty
  string, or no key, holds nothing.
- `repeat`: a whole number from 1 to 100000, 1 when left out.

It refuses, with a reason on stderr, nothing on stdout and exit code 2: no argument, a file it cannot
read, a file that is not JSON, no `frames` list, a frame that is not an object, a button it does not know,
`forward` and `back` together, more than one attack button in one frame, a `repeat` that is not a whole
number from 1 to 100000, and more than 1,000,000 frames in all.

Otherwise it prints one JSON object on stdout and exits 0:

```json
{
  "frame": 4130,
  "winner": "p1",
  "roundWins": { "p1": 2, "p2": 0 },
  "rounds": [ { "winner": "p1", "reason": "ko" }, { "winner": "p1", "reason": "time" } ],
  "p1": { "hp": 100, "x": -150 },
  "p2": { "hp": 88, "x": 150 },
  "events": [ { "frame": 73, "type": "hit", "attacker": "p1", "move": "lp", "damage": 5, "blocked": false } ]
}
```

- `frame`: the number of frames read. Frames are numbered from 0, pauses included.
- `winner`: `"p1"`, `"p2"`, or `null` while the match goes on or when it ends with no winner.
- `rounds`: every round that has ended, in order; `winner` is `null` for a round with no winner.
- `p1`, `p2`: each fighter's hp and position after the last frame.
- `events`: one per hit or block, in order (player 1's first within a frame). `move` is the input that
  started it (`"lp"`, `"rp"`, `"lk"`, `"rk"`, `"forward+rk"`); `damage` is 0 when `blocked`.

The same file always prints the same bytes.

## The page

`npm run build` writes the static site to `dist/`; any static server serves it, with no network beyond
it. The page renders with three.js's `WebGPURenderer`, which falls back to WebGL 2 where WebGPU is missing.
It runs the engine at a fixed 60 steps per second, whatever the display's refresh rate.

**Controls.** Keyboard (by `KeyboardEvent.code`) and gamepads work together.

| Action | Player 1 keys | Player 2 keys | Gamepad (standard mapping) |
| --- | --- | --- | --- |
| forward | `KeyD` | `ArrowLeft` | stick or d-pad towards the opponent |
| back | `KeyA` | `ArrowRight` | stick or d-pad away from the opponent |
| `lp` | `KeyU` | `Numpad4` | button 2 (X / Square) |
| `rp` | `KeyI` | `Numpad5` | button 3 (Y / Triangle) |
| `lk` | `KeyJ` | `Numpad1` | button 0 (A / Cross) |
| `rk` | `KeyK` | `Numpad2` | button 1 (B / Circle) |

Gamepad 0 (`navigator.getGamepads()[0]`) is player 1, gamepad 1 is player 2. The stick counts past half
way (`axes[0]` above 0.5 or below -0.5); the d-pad is buttons 14 (left) and 15 (right). Player 1 faces
right, so right is forward; player 2 faces left, so left is forward.

**The page's state**, for the checks and for debugging, in `window.__crt`:

```js
{
  ready: true,                // the model is loaded and the fight runs
  renderer: "webgpu",         // or "webgl2": the backend in use
  fight: { frame, winner, roundWins: { p1, p2 }, p1: { hp, x }, p2: { hp, x } }  // updated every engine frame
}
```

## Rounds

| # | Title | What it adds | How it is checked | Prize |
| --- | --- | --- | --- | --- |
| 1 | The fight | The engine and the simulator; the 3D arena with the animated model; two players on one screen, keyboard and gamepad | Simulations (range, blocks, knockouts, time, best of 3, determinism, refusals); the built page loads offline, reports its state and answers the keyboard and a gamepad | 1,000,000 |
| 2 | The TV | The screen shows the player's NFT (ERC-721 `tokenURI` metadata and image) with a CRT shader | Offline test metadata; the page reports the image shown on each screen | 1,000,000 |
| 3 | Online | An authoritative WebSocket server running the same engine; a lobby; online matches | The check starts the server and connects two clients | 1,000,000 |
| 4 | The stake | A wallet, an escrow contract, the NFT goes to the winner: on the Sepolia testnet only | Contract tests on a local chain | 1,000,000 |

Each round's checks also run every earlier round's checks: an entry keeps everything before it working.
Real money is out of scope: round 4 stays on testnet until the contract is audited and the legal
questions are answered.

## Judging

Once the checks pass, the judges rank the entries on:

- Fight feel (counts double): readable hits, responsive inputs, animations of the model in sync with the
  engine's frames.
- Controls: keyboard and gamepad smooth, two players on one screen.
- Rendering: WebGPU, or WebGL 2 as a fallback, and smooth.
- Code quality: the engine apart from the rendering, readable.
