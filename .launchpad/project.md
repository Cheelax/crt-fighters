---
title: CRT Fighters
payout: top3-60-25-15
pick: creator-in-judging
build_hours: 48
reveal_hours: 12
rank_hours: 12
---

# Pitch

A Tekken-style 3D fighting game in the browser, built with three.js and WebGPU. Each fighter has a
cathode-ray TV for a head, and the TV shows its player's NFT. Two players fight a best of 3 rounds, with
the keyboard or a gamepad. In the last round the winner takes the loser's NFT, on a testnet only.

# Round 1: The fight

prize: 1000000
criteria:
- Fight feel (counts double): readable hits, responsive inputs, the model's animations in sync with the engine's frames
- Controls: keyboard and gamepad smooth, two players on one screen
- Rendering: WebGPU, or WebGL 2 as a fallback, smooth, with a clear arena and HUD
- Code quality: the engine apart from the rendering, small and readable

Build the fight: a deterministic engine, a simulator that replays it, and the 3D page where two players
fight on one screen. `ARCHITECTURE.md` is the specification: its rules, formats and names are what the
checks test, to the unit and to the frame.

- **The engine**, `src/engine/fight.mjs`: `createFight()` and `step(state, inputs)`, pure, one frame per
  call, with the numbers and the moves of `src/engine/rules.mjs` (do not change them). Walking, ranges,
  blocks (holding back blocks high and mid, not low), hitstun and blockstun, a hit cancelling the
  defender's move, knockouts, the 60 s timer, the 90-frame pause, best of 3. The order of one frame is
  in ARCHITECTURE.md, "The engine": follow it exactly.
- **The simulator**, `node bin/simulate.mjs inputs.json`: reads the input file, prints the JSON result,
  and refuses bad files with exit code 2, a reason on stderr and nothing on stdout (ARCHITECTURE.md,
  "The simulator").
- **The page**, built by `npm run build` into `dist/`: three.js `WebGPURenderer` (WebGL 2 as its
  fallback), an arena, two fighters from `public/models/computerboi.glb` facing each other, their clips
  played from the engine's state (walks, each move timed to its frames, hits, KO, victory), a HUD with
  both hp bars, the round wins and the result. The engine runs at a fixed 60 steps per second.
  Keyboard and gamepads, mapped as in ARCHITECTURE.md, "Controls"; the page polls
  `navigator.getGamepads()` every frame. It keeps `window.__crt` up to date (`ready`, `renderer`,
  `fight`), and loads nothing from the network beyond its own server.

The checks run your entry offline in a headless Chromium without a GPU: the page must work there through
the WebGL 2 fallback. Keep `vite.config.js`'s alias, so that three.js's addons and the page share one copy
of three.js. Dependencies come from `package-lock.json`, registry packages only.

## How to run it

`npm ci`, then `npm run dev` and open the address it prints; or `npm run build && npx vite preview`.
Player 1: `A`/`D` to walk, `U` `I` `J` `K` to attack. Player 2: arrows to walk, numpad `4` `5` `1` `2`.
Or plug in two gamepads.

- Fight feel: play two full rounds, hold `D` then tap `U` at close range, block a high kick by holding
  back, and watch whether each hit lands on the frame the animation shows it.
- Controls: play one round with a gamepad against the keyboard.
- Rendering: note the backend in `window.__crt.renderer`, the frame rate, the HUD and the arena.
- Code quality: read `src/engine/fight.mjs`, then how `src/scene/` reads the engine's state.

# Round 2: The TV

prize: 1000000
criteria:
- Correctness: each screen shows its player's NFT from valid ERC-721 metadata, and bad metadata is refused clearly
- Look (counts double): a convincing cathode-ray effect (scanlines, curvature, glow) that keeps the NFT readable
- Code quality: the metadata reader apart from the shader, round 1's code reused

Each fighter's TV screen (material `square`) shows its player's NFT. A player picks a token's ERC-721
metadata (a `tokenURI` JSON document: `name`, `image`, optional `attributes`), from a file or an
`ipfs://`, `https://` or `data:` URI; the image is drawn on the screen through a cathode-ray shader
(scanlines, curvature, glow, a little flicker). No wallet yet. The exact interface (the metadata command,
the page's state for the screens, the test fixtures) is set in this round's brief, on top of round 1's
winning code. Round 1's checks keep running.

## How to run it

Load two metadata files from the round's examples, one per player, and fight a round.

- Correctness: try each example, then a broken one.
- Look: compare the screens close up and from the fighting camera.
- Code quality: read the metadata reader and the shader.

# Round 3: Online

prize: 1000000
criteria:
- Correctness: two browsers play the same match, the server deciding every hit
- Netcode (counts double): inputs feel responsive despite latency, no desync
- Code quality: the server runs round 1's engine, unchanged

An authoritative WebSocket server (`node server.mjs --port <n>`) runs the same engine: clients send
their inputs per frame, the server steps the match and sends back the state. A lobby pairs two players,
each with their NFT from round 2. The exact protocol is set in this round's brief. Rounds 1 and 2's
checks keep running.

## How to run it

Start the server, open the game in two browsers, and play a match.

- Correctness: play a match to the end in two browsers.
- Netcode: add 100 ms of latency in the browser's devtools, and play.
- Code quality: read the server and how it uses the engine.

# Round 4: The stake

prize: 1000000
criteria:
- Safety (counts double): the escrow contract cannot lose, lock or misdirect an NFT, and is well tested
- Correctness: wallet connection, staking both NFTs, the server's result paying the winner
- Code quality: clear contract, clear flow in the game

Players connect a wallet and stake their NFT in an escrow contract before an online match; the server
signs the result and the contract sends both NFTs to the winner (a draw returns each to its owner, and a
timeout refunds). On the Sepolia testnet only: real money and mainnet are out of scope. The contract is
tested on a local chain. The exact interface is set in this round's brief. Earlier rounds' checks keep
running.

## How to run it

Run the contract's tests, then play a staked match on Sepolia with two test wallets.

- Safety: read the contract and its tests; try to withdraw twice or claim someone else's NFT.
- Correctness: stake, fight, and check the winner's wallet.
- Code quality: read the contract and the staking flow.
