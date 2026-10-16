// Drives the built page in headless Chromium and prints what it saw, as one JSON line on stdout.
// run.mjs starts it in a child process, as the entry's user: the page's code never runs in the check's.
//   node page.mjs <url> <load|keyboard|gamepad>
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const [url, scenario] = process.argv.slice(2);
const READY_MS = 90_000;

// playwright-core comes from the base's lockfile: the gate installs it under /tools; locally, from the clone.
const where = ["/tools/node_modules", join(process.cwd(), "node_modules")].find((d) => existsSync(join(d, "playwright-core")));
if (!where) {
  console.error("playwright-core is not installed: run npm ci");
  process.exit(3);
}
const { chromium } = createRequire(join(where, "x.js"))("playwright-core");

// A gamepad the page can poll: window.__fakePads[i] = { axes, buttons } (buttons: indices held).
const FAKE_PADS = () => {
  const pads = [];
  window.__fakePads = pads;
  const make = (i) => {
    const p = pads[i];
    if (!p) return null;
    return {
      id: `fake gamepad ${i}`, index: i, connected: true, mapping: "standard", timestamp: performance.now(),
      axes: [...p.axes], vibrationActuator: null,
      buttons: Array.from({ length: 17 }, (_, b) => {
        const on = p.buttons.includes(b);
        return { pressed: on, touched: on, value: on ? 1 : 0 };
      }),
    };
  };
  Object.defineProperty(Navigator.prototype, "getGamepads", { configurable: true, value: () => [make(0), make(1), null, null] });
  window.__connectPad = (i) => {
    pads[i] = { axes: [0, 0, 0, 0], buttons: [] };
    const e = new Event("gamepadconnected");
    e.gamepad = make(i);
    window.dispatchEvent(e);
  };
};

const result = { errors: [], model: null };
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.addInitScript(FAKE_PADS);
  page.on("pageerror", (e) => result.errors.push(String(e.message ?? e).slice(0, 300)));
  page.on("response", (r) => {
    if (new URL(r.url()).pathname.endsWith("/models/computerboi.glb")) result.model = r.status();
  });
  await page.goto(url, { waitUntil: "load", timeout: 30_000 });
  try {
    await page.waitForFunction(() => window.__crt?.ready === true, null, { timeout: READY_MS, polling: 250 });
  } catch {
    result.notReady = true;
  }
  const crt = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__crt ?? null)));
  // Holds an input for HOLD_FRAMES engine frames (or 20 s at most): software rendering can stall the page
  // for seconds, and an input released before the engine reads it would test nothing.
  const HOLD_FRAMES = 40;
  const hold = async () => {
    const from = (await crt())?.fight?.frame ?? 0;
    await page.waitForFunction((n) => (window.__crt?.fight?.frame ?? 0) >= n, from + HOLD_FRAMES, { timeout: 20_000, polling: 50 }).catch(() => {});
  };
  result.start = await crt();
  if (!result.notReady && scenario === "keyboard") {
    await page.keyboard.down("KeyD");
    await hold();
    await page.keyboard.up("KeyD");
    result.afterP1 = await crt();
    await page.keyboard.down("ArrowLeft");
    await hold();
    await page.keyboard.up("ArrowLeft");
    result.afterP2 = await crt();
  }
  if (!result.notReady && scenario === "gamepad") {
    await page.evaluate(() => { window.__connectPad(0); window.__connectPad(1); });
    await page.waitForTimeout(200);
    result.connected = await crt();
    await page.evaluate(() => { window.__fakePads[0].axes[0] = 1; });
    await hold();
    await page.evaluate(() => { window.__fakePads[0].axes[0] = 0; });
    result.afterP1 = await crt();
    await page.evaluate(() => { window.__fakePads[1].buttons = [14]; });
    await hold();
    await page.evaluate(() => { window.__fakePads[1].buttons = []; });
    result.afterP2 = await crt();
  }
} finally {
  await browser.close();
}
process.stdout.write(`${JSON.stringify(result)}\n`);
