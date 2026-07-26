import type { GameState } from "./_types/game";
import { advanceTemporalState, applyPaddleInput } from "./game-update-prelude";
import { ensureMinimumVerticalAngle } from "./collision-physics";

export type LegacyStepInput = { move: -1 | 0 | 1; aimX: number; aimY: number };
export type LegacyStepAdapters = {
  audio?: { play: (...args: unknown[]) => void };
  emit?: (...args: unknown[]) => void;
  setHud?: (game: GameState) => void;
};

/**
 * Injection boundary for incrementally extracting updateGame. The first
 * version deliberately delegates rules to the existing callback, allowing a
 * deterministic harness without changing live legacy behavior.
 */
export type LegacyPureStep = (game: GameState, input: LegacyStepInput, dt: number, adapters?: LegacyStepAdapters) => void;

export function createLegacyPureStep(step: (dt: number) => void): LegacyPureStep {
  return (_game, _input, dt) => step(dt);
}

/** Pure temporal + paddle phase used by parity harnesses before full rule extraction. */
export function stepLegacyPure(game: GameState, input: LegacyStepInput, dt: number, options: { paddleSpeed: number; width: number } = { paddleSpeed: 420, width: 900 }) {
  advanceTemporalState(game, dt);
  applyPaddleInput(game, input.move, options.paddleSpeed, dt, options.width);
  return game;
}

/** Ball-only movement phase. Brick/paddle collision remains in the live loop. */
export function advanceLegacyBallsPure(game: GameState, dt: number, width = 900, top = 0) {
  for (const ball of game.balls) {
    if (ball.owner !== "player") continue;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); ensureMinimumVerticalAngle(ball); }
    if (ball.x + ball.radius > width) { ball.x = width - ball.radius; ball.vx = -Math.abs(ball.vx); ensureMinimumVerticalAngle(ball); }
    if (ball.y - ball.radius < top) { ball.y = top + ball.radius; ball.vy = Math.abs(ball.vy); ensureMinimumVerticalAngle(ball, 1); }
  }
  return game;
}
