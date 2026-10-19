// The players' inputs for one engine frame: the keyboard and the gamepads together.
import { keyButtons } from "./keyboard.js";
import { padButtons, pressed, readPads, START } from "./gamepad.js";

const or = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] || b[k]]));

/** { p1, p2 } for the engine's step(). Holding forward and back together holds neither (see the engine). */
export function readInputs(keyboard) {
  const pads = readPads();
  return {
    p1: or(keyButtons(keyboard.down, "p1"), padButtons(pads.p1, "p1")),
    p2: or(keyButtons(keyboard.down, "p2"), padButtons(pads.p2, "p2")),
  };
}

/** Enter or Space on the keyboard, or Start on either gamepad: the rematch, once a match is over. */
export function wantsRematch(keyboard) {
  const pads = readPads();
  return keyboard.down.has("Enter") || keyboard.down.has("Space") || pressed(pads.p1, START) || pressed(pads.p2, START);
}
