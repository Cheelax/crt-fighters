// The fight engine: pure, deterministic, no DOM and no three.js. Round 1 builds it.
// See ARCHITECTURE.md, "The engine", for the exact rules.

/** A new match: both fighters at their start, MAX_HP each, round 1 about to begin. */
export function createFight() {
  throw new Error("not implemented yet: round 1 builds the engine");
}

/**
 * Advances the fight by one frame and returns the new state.
 * @param state a state from createFight() or step()
 * @param inputs { p1: Buttons, p2: Buttons }, where Buttons is { forward, back, lp, rp, lk, rk } (booleans)
 */
export function step(state, inputs) {
  throw new Error("not implemented yet: round 1 builds the engine");
}
