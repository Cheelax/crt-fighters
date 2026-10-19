// The HUD, in the page over the canvas: both hp bars, the round wins, the clock, and what just happened.
// It reads the engine's state; it never changes it.
import { FPS, MAX_HP, ROUND_FRAMES, ROUNDS_TO_WIN } from "../engine/rules.mjs";
import "./hud.css";

const NAMES = { p1: "Player 1", p2: "Player 2" };

export function createHud(root = document.body) {
  const hud = el("div", "hud");
  const sides = {};
  for (const p of ["p1", "p2"]) {
    const side = el("div", `side ${p}`);
    const name = el("div", "name", NAMES[p]);
    const device = el("span", "device", "keyboard");
    name.append(device);
    const bar = el("div", "bar");
    const trail = el("div", "trail");
    const fill = el("div", "fill");
    bar.append(trail, fill);
    const wins = el("div", "wins");
    const pips = Array.from({ length: ROUNDS_TO_WIN }, () => wins.appendChild(el("i")));
    side.append(name, bar, wins);
    hud.append(side);
    sides[p] = { fill, trail, pips, device, hp: MAX_HP };
  }
  const clock = el("div", "clock", "60");
  hud.insertBefore(clock, sides.p2.fill.closest(".side"));
  const banner = el("div", "banner");
  const title = el("div", "title");
  const sub = el("div", "sub");
  banner.append(title, sub);
  const help = el("div", "help");
  help.innerHTML = "<b>Player 1</b> A D walk · U I J K attack · D+K high kick &nbsp;|&nbsp; <b>Player 2</b> ← → walk · Num 4 5 1 2 attack · ←+Num2 high kick &nbsp;|&nbsp; hold back to block · gamepads work too";
  root.append(hud, banner, help);

  return {
    /** Shows `fight`; `sinceEnd` is the frames since the round ended, while it has. */
    update(fight, sinceEnd) {
      for (const p of ["p1", "p2"]) {
        const s = sides[p];
        const hp = fight[p].hp;
        if (hp !== s.hp) {
          s.fill.style.width = `${(hp / MAX_HP) * 100}%`;
          s.trail.style.width = `${(hp / MAX_HP) * 100}%`;
          s.fill.classList.toggle("low", hp <= 25);
          s.hp = hp;
        }
        s.pips.forEach((pip, i) => pip.classList.toggle("won", fight.roundWins[p] > i));
      }
      clock.textContent = String(Math.ceil((ROUND_FRAMES - fight.clock) / FPS));
      clock.classList.toggle("low", !fight.ended && ROUND_FRAMES - fight.clock <= 10 * FPS);
      const [t, s] = bannerOf(fight, sinceEnd);
      if (title.textContent !== t) title.textContent = t;
      if (sub.textContent !== s) sub.textContent = s;
      banner.classList.toggle("shown", t !== "");
    },
    /** Which device each player last used: "keyboard" or "gamepad". */
    devices(d) {
      for (const p of ["p1", "p2"]) sides[p].device.textContent = d[p];
    },
  };
}

/** The banner's two lines for this moment of the match. */
export function bannerOf(fight, sinceEnd) {
  if (fight.ended) {
    const { winner, reason } = fight.rounds.at(-1);
    const what = reason === "time" ? "Time" : winner === null ? "Double K.O." : "K.O.";
    if (fight.over && sinceEnd >= 60) {
      return [fight.winner ? `${NAMES[fight.winner]} wins` : "Draw game", "Enter, Space or Start: rematch"];
    }
    return [what, winner ? `${NAMES[winner]} takes round ${fight.round}` : `Round ${fight.round}: no winner`];
  }
  if (fight.clock < 45) return [`Round ${fight.round}`, ""];
  if (fight.clock < 80) return ["Fight!", ""];
  return ["", ""];
}

function el(tag, className = "", text = "") {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}
