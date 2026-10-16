// Round 1's checks: the engine through the simulator, then the built page in headless Chromium.
// Run them yourself from the repository's root:
//   node .launchpad/checks/round-1/run.mjs
// The rules they test are in ARCHITECTURE.md ("The engine", "The simulator", "The page").
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { check, harness } from "./lib/harness.mjs";
import { entry, input, refuses, ROOT, succeeds, workspace } from "./lib/entry.mjs";

const { test, done } = harness();
const HERE = dirname(fileURLToPath(import.meta.url));
const simulate = entry("node", ["bin/simulate.mjs"]);

/** Runs the simulator on `frames` and returns its parsed output. */
async function sim(frames, what) {
  const r = await succeeds(simulate, [input({ frames })], what);
  let out;
  try {
    out = JSON.parse(r.out);
  } catch {
    throw new Error(`${what}: stdout is not one JSON object: ${JSON.stringify(r.out.slice(0, 200))}`);
  }
  check(out && typeof out === "object" && out.p1 && out.p2 && Array.isArray(out.events) && Array.isArray(out.rounds) && out.roundWins,
    `${what}: the output lacks frame, winner, roundWins, rounds, p1, p2 or events: ${r.out.slice(0, 200)}`);
  return out;
}

const eq = (got, want, what) => check(JSON.stringify(got) === JSON.stringify(want), `${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
const hits = (out) => out.events.map(({ frame, attacker, move, damage, blocked }) => ({ frame, attacker, move, damage, blocked }));

// Player 1 walks 67 frames: from -150 to 51, 99 units from player 2, in range of every move.
const CLOSE = { p1: "forward", repeat: 67 };
// Player 1 holds the left punch from frame 67: a hit every 19 frames, the 20th (frame 434) knocks out.
const KO_ROUND = [CLOSE, { p1: "lp", repeat: 368 }];

await test("an empty fight prints the starting state: no winner, 100 hp each, player 1 at -150 and player 2 at 150", async () => {
  const out = await sim([], "an empty fight");
  eq(out.frame, 0, "frame");
  eq(out.winner, null, "winner");
  eq(out.roundWins, { p1: 0, p2: 0 }, "roundWins");
  eq(out.rounds, [], "rounds");
  eq(out.p1, { hp: 100, x: -150 }, "p1");
  eq(out.p2, { hp: 100, x: 150 }, "p2");
  eq(out.events, [], "events");
  const idle = await sim([{ repeat: 10 }], "10 idle frames");
  eq(idle.frame, 10, "frame after 10 idle frames");
  eq([idle.p1, idle.p2], [{ hp: 100, x: -150 }, { hp: 100, x: 150 }], "fighters after 10 idle frames");
});

await test("walking moves 3 units forward and 2 back per frame, within the stage and never closer than 60", async () => {
  eq((await sim([{ p1: "forward", repeat: 10 }], "player 1 forward 10 frames")).p1.x, -120, "player 1 after 10 frames forward");
  eq((await sim([{ p2: "forward", repeat: 10 }], "player 2 forward 10 frames")).p2.x, 120, "player 2 after 10 frames forward");
  eq((await sim([{ p1: "back", repeat: 10 }], "player 1 back 10 frames")).p1.x, -170, "player 1 after 10 frames back");
  eq((await sim([{ p2: "back", repeat: 10 }], "player 2 back 10 frames")).p2.x, 170, "player 2 after 10 frames back");
  eq((await sim([{ p1: "back", p2: "back", repeat: 200 }], "both back 200 frames")).p1.x, -400, "player 1 after 200 frames back (the stage ends at -400)");
  const close = await sim([{ p1: "forward", p2: "forward", repeat: 100 }], "both forward 100 frames");
  eq([close.p1.x, close.p2.x], [-30, 30], "positions after both walk forward 100 frames (they stop 60 apart)");
  const order = await sim([{ p2: "forward" }, { p1: "forward", repeat: 78 }, { p1: "forward", p2: "forward" }], "both forward from 63 units apart");
  eq([order.p1.x, order.p2.x], [87, 147], "player 1 moves first: from 84 and 147, both walking forward");
});

await test("a left punch in range hits on its 7th frame for 5 damage, and only once", async () => {
  const out = await sim([CLOSE, { p1: "lp" }, { repeat: 30 }], "a left punch at 99 units");
  eq(out.p1.x, 51, "player 1 after 67 frames forward");
  eq(hits(out), [{ frame: 73, attacker: "p1", move: "lp", damage: 5, blocked: false }], "events (the punch starts on frame 67)");
  eq(out.p2.hp, 95, "player 2's hp");
  const p2 = await sim([{ p2: "forward", repeat: 67 }, { p2: "rp" }, { repeat: 30 }], "player 2's right punch at 99 units");
  eq(hits(p2), [{ frame: 75, attacker: "p2", move: "rp", damage: 7, blocked: false }], "events of player 2's right punch (startup 8)");
  eq(p2.p1.hp, 93, "player 1's hp");
});

await test("an attack hits only within its range: at 123 units a middle kick misses and a high kick hits", async () => {
  const far = await sim([{ p1: "lp" }, { repeat: 40 }], "a left punch at 300 units");
  eq(hits(far), [], "events of a punch at 300 units");
  eq(far.p2.hp, 100, "player 2's hp after a punch at 300 units");
  const mid = await sim([{ p1: "forward", repeat: 59 }, { p1: "rk" }, { repeat: 40 }], "a middle kick (range 120) at 123 units");
  eq(hits(mid), [], "events of a middle kick at 123 units");
  const high = await sim([{ p1: "forward", repeat: 59 }, { p1: "forward+rk" }, { repeat: 40 }], "a high kick (range 130) at 123 units");
  eq(hits(high), [{ frame: 74, attacker: "p1", move: "forward+rk", damage: 12, blocked: false }], "events of a high kick at 123 units (startup 15)");
  eq(high.p1.x, 27, "player 1 does not walk on the frame it starts the high kick");
});

await test("holding back blocks high and mid attacks for no damage, but low kicks still hit", async () => {
  // Player 2 backs into the wall at 400, player 1 follows to 97 units, then attacks while player 2 holds back.
  const out = await sim([
    { p1: "forward", p2: "back", repeat: 151 },
    { p1: "lp", p2: "back" }, { p2: "back", repeat: 39 },
    { p1: "rk", p2: "back" }, { p2: "back", repeat: 39 },
    { p1: "lk", p2: "back" }, { p2: "back", repeat: 39 },
  ], "attacks on a fighter holding back at the wall");
  eq([out.p1.x, out.p2.x], [303, 400], "positions");
  eq(hits(out), [
    { frame: 157, attacker: "p1", move: "lp", damage: 0, blocked: true },
    { frame: 203, attacker: "p1", move: "rk", damage: 0, blocked: true },
    { frame: 241, attacker: "p1", move: "lk", damage: 7, blocked: false },
  ], "events");
  eq(out.p2.hp, 93, "player 2's hp");
});

await test("a hit cancels the defender's attack: it does no damage", async () => {
  const out = await sim([CLOSE, { p1: "lp", p2: "rk" }, { repeat: 40 }], "a left punch against a slower middle kick");
  eq(hits(out), [{ frame: 73, attacker: "p1", move: "lp", damage: 5, blocked: false }], "events (the kick, cancelled, never hits)");
  eq([out.p1.hp, out.p2.hp], [100, 95], "hp");
  const trade = await sim([CLOSE, { p1: "lp", p2: "lp" }, { repeat: 40 }], "two left punches on the same frame");
  eq(hits(trade), [
    { frame: 73, attacker: "p1", move: "lp", damage: 5, blocked: false },
    { frame: 73, attacker: "p2", move: "lp", damage: 5, blocked: false },
  ], "events of a trade (both hit on the same frame)");
});

await test("a knockout ends the round, and the next round starts after the 90-frame pause at full hp", async () => {
  const ko = await sim(KO_ROUND, "a round won by knockout");
  eq(ko.events.length, 20, "number of hits to knock out 100 hp with 5-damage punches");
  eq(ko.events.at(-1)?.frame, 434, "frame of the last hit");
  eq(ko.p2.hp, 0, "player 2's hp");
  eq(ko.rounds, [{ winner: "p1", reason: "ko" }], "rounds");
  eq(ko.roundWins, { p1: 1, p2: 0 }, "roundWins");
  eq(ko.winner, null, "winner (the match goes on)");
  // Player 1 holds forward through the pause: only the 6 frames after it (525 to 530) move it.
  const next = await sim([...KO_ROUND, { p1: "forward", repeat: 96 }], "the pause after a knockout");
  eq(next.frame, 531, "frame");
  eq([next.p1, next.p2], [{ hp: 100, x: -132 }, { hp: 100, x: 150 }], "fighters, reset, after the pause");
});

await test("the first fighter to win 2 rounds wins the match, and later frames change nothing", async () => {
  const out = await sim([...KO_ROUND, { repeat: 90 }, ...KO_ROUND, { p2: "forward", repeat: 50 }, { p1: "lp", repeat: 50 }], "two rounds won by knockout");
  eq(out.winner, "p1", "winner");
  eq(out.roundWins, { p1: 2, p2: 0 }, "roundWins");
  eq(out.rounds, [{ winner: "p1", reason: "ko" }, { winner: "p1", reason: "ko" }], "rounds");
  eq(out.events.length, 40, "number of hits");
  eq(out.events.at(-1)?.frame, 959, "frame of the knockout of round 2");
  eq(out.frame, 1060, "frame");
  eq([out.p1, out.p2], [{ hp: 100, x: 51 }, { hp: 0, x: 150 }], "fighters, as at the knockout");
});

await test("after 3600 frames the round ends by time, won by the fighter with more hp", async () => {
  const short = await sim([{ repeat: 3599 }], "3599 idle frames");
  eq(short.rounds, [], "rounds after 3599 frames");
  const draw = await sim([{ repeat: 3600 }], "3600 idle frames");
  eq(draw.rounds, [{ winner: null, reason: "time" }], "rounds after 3600 idle frames (equal hp)");
  eq(draw.roundWins, { p1: 1, p2: 1 }, "roundWins after a round with no winner");
  const won = await sim([CLOSE, { p1: "lp" }, { repeat: 3532 }], "a round with one punch");
  eq(won.rounds, [{ winner: "p1", reason: "time" }], "rounds");
  eq(won.roundWins, { p1: 1, p2: 0 }, "roundWins");
  const both = await sim([{ repeat: 3600 }, { repeat: 90 }, { repeat: 3600 }, { repeat: 10 }], "two rounds with no winner");
  eq([both.winner, both.roundWins], [null, { p1: 2, p2: 2 }], "a match where both reach 2 rounds together has no winner");
});

await test("the same inputs print the same bytes", async () => {
  const frames = [{ p1: "forward", p2: "back", repeat: 40 }, { p1: "forward+rk", p2: "lk" }, { p1: "lp", p2: "forward", repeat: 25 }, { p1: "back", p2: "rp", repeat: 30 }, { p1: "lk", p2: "back", repeat: 60 }];
  const file = input({ frames });
  const a = await succeeds(simulate, [file], "first run");
  const b = await succeeds(simulate, [file], "second run");
  check(a.out !== "" && a.out === b.out, "two runs on the same file printed different bytes");
});

await test("refuses bad input files with exit code 2, a reason on stderr and nothing on stdout", async () => {
  await sim([{ p1: "forward+lp", p2: "back+rk", repeat: 3 }], "a valid file");
  const bad = [
    [[], "no argument"],
    [[join(workspace().inputs, "does-not-exist.json")], "a file that does not exist"],
    [[input("{ nope")], "a file that is not JSON"],
    [[input({})], "no frames list"],
    [[input({ frames: {} })], "frames that is not a list"],
    [[input({ frames: [1] })], "a frame that is not an object"],
    [[input({ frames: [{ p1: "jump" }] })], "an unknown button"],
    [[input({ frames: [{ p2: "forward+back" }] })], "forward and back together"],
    [[input({ frames: [{ p1: "lp+rk" }] })], "two attack buttons in one frame"],
    [[input({ frames: [{ repeat: 0 }] })], "repeat 0"],
    [[input({ frames: [{ repeat: 1.5 }] })], "repeat 1.5"],
    [[input({ frames: [{ repeat: 100001 }] })], "repeat 100001"],
    [[input({ frames: Array.from({ length: 11 }, () => ({ repeat: 100000 })) })], "1,100,000 frames"],
  ];
  for (const [args, what] of bad) {
    const r = await refuses(simulate, args, what);
    check(r.code === 2, `${what}: exited with ${r.code ?? r.signal}, expected 2`);
  }
});

// The page: built once with npm run build, served from dist/ on the loopback, driven by lib/page.mjs.
const npm = entry("npm", ["run", "build"], { timeoutMs: 240_000 });
const probe = entry("node", [join(HERE, "lib", "page.mjs")], { timeoutMs: 150_000, env: process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH } : {} });
const DIST = join(ROOT, "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".ktx2": "image/ktx2", ".bin": "application/octet-stream" };

let built = null;
function build() {
  built ??= succeeds(npm, [], "npm run build").then(() => {
    check(existsSync(join(DIST, "index.html")), "npm run build wrote no dist/index.html");
  });
  return built;
}

let server = null;
async function serve() {
  await build();
  if (server) return server;
  const root = resolve(DIST);
  const http = createServer((req, res) => {
    let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    let file = resolve(join(root, path));
    if (file !== root && !file.startsWith(root + sep)) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  });
  await new Promise((r) => http.listen(0, "127.0.0.1", r));
  server = { http, url: `http://127.0.0.1:${http.address().port}/` };
  return server;
}

async function page(scenario) {
  const { url } = await serve();
  const r = await succeeds(probe, [url, scenario], `the page (${scenario})`);
  let seen;
  try {
    seen = JSON.parse(r.out.trim().split("\n").at(-1));
  } catch {
    throw new Error(`the page probe printed no result: ${r.out.slice(0, 200)} ${r.err.slice(-300)}`);
  }
  check(!seen.notReady, `window.__crt.ready never became true (90 s). __crt: ${JSON.stringify(seen.start)}; page errors: ${JSON.stringify(seen.errors)}`);
  return seen;
}

const at = (crt, p) => crt?.fight?.[p]?.x;

try {
  await test("the built page loads offline with no error, loads the model and reports ready with webgpu or webgl2", async () => {
    const seen = await page("load");
    eq(seen.errors, [], "uncaught page errors");
    eq(seen.model, 200, "status of the request for models/computerboi.glb");
    check(["webgpu", "webgl2"].includes(seen.start.renderer), `window.__crt.renderer is ${JSON.stringify(seen.start.renderer)}, expected "webgpu" or "webgl2"`);
    const f = seen.start.fight;
    check(f && f.p1?.hp === 100 && f.p2?.hp === 100 && f.winner === null && f.roundWins?.p1 === 0 && f.roundWins?.p2 === 0 && Number.isInteger(f.frame),
      `window.__crt.fight at the start: ${JSON.stringify(f)}`);
  });

  await test("the keyboard walks player 1 forward with KeyD and player 2 forward with ArrowLeft", async () => {
    const seen = await page("keyboard");
    eq(seen.errors, [], "uncaught page errors");
    const [x1, x2] = [at(seen.start, "p1"), at(seen.start, "p2")];
    check(at(seen.afterP1, "p1") >= x1 + 30, `player 1 at ${x1}, then at ${at(seen.afterP1, "p1")} after holding KeyD for 40 engine frames`);
    eq(at(seen.afterP1, "p2"), x2, "player 2's position while player 1 walks");
    check(at(seen.afterP2, "p2") <= x2 - 30, `player 2 at ${x2}, then at ${at(seen.afterP2, "p2")} after holding ArrowLeft for 40 engine frames`);
    check(seen.afterP2.fight.frame > seen.start.fight.frame, "window.__crt.fight.frame did not advance");
  });

  await test("gamepads walk the players: player 1 with the stick of gamepad 0, player 2 with the d-pad of gamepad 1", async () => {
    const seen = await page("gamepad");
    eq(seen.errors, [], "uncaught page errors");
    const [x1, x2] = [at(seen.connected, "p1"), at(seen.connected, "p2")];
    check(at(seen.afterP1, "p1") >= x1 + 30, `player 1 at ${x1}, then at ${at(seen.afterP1, "p1")} after gamepad 0's stick held right for 40 engine frames`);
    check(at(seen.afterP2, "p2") <= x2 - 30, `player 2 at ${x2}, then at ${at(seen.afterP2, "p2")} after gamepad 1's d-pad held left (button 14) for 40 engine frames`);
  });
} finally {
  server?.http.close();
}

done();
