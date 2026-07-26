import type { Ball, Brick, GameState } from "./_types/game";
import { advanceTemporalState, applyPaddleInput } from "./game-update-prelude";
import { circleRectangleCollision, ensureMinimumVerticalAngle, sweptPaddleContact } from "./collision-physics";
import type { SkillResult } from "./canonical-engine";

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

export function resolveLegacyBrickCollisionsPure(game: GameState, previous: Map<Ball, { x: number; y: number }>, onEvent?: (event: { type: "brick-hit" | "brick-destroyed"; brick: Brick; damage: number }) => void) {
  for (const ball of game.balls) {
    if (ball.owner !== "player") continue;
    const prior = previous.get(ball) ?? { x: ball.x, y: ball.y };
    for (const brick of game.bricks) {
      if (!brick.alive || brick.trait === "indestructible") continue;
      const collision = circleRectangleCollision(ball, brick, prior.x, prior.y);
      if (!collision) continue;
      const damage = Math.max(1, ball.attackPower);
      brick.hp -= damage;
      brick.lastHitPaddleId = ball.sourcePaddleId;
      onEvent?.({ type: brick.hp <= 0 ? "brick-destroyed" : "brick-hit", brick, damage });
      if (brick.hp <= 0) { brick.hp = 0; brick.alive = false; game.bricksBroken += 1; }
      if (collision.normalX) ball.vx = collision.normalX * Math.abs(ball.vx); else ball.vy = collision.normalY * Math.abs(ball.vy);
      break;
    }
  }
  return game;
}

export function resolveLegacyPaddleCollisionPure(game: GameState, previous: Map<Ball, { x: number; y: number }>, input: LegacyStepInput, options: { paddleY: number; paddleSpeed?: number; slop?: number; sideDepth?: number; forgiveness?: number; width?: number } = { paddleY: 530, width: 900 }) {
  const width = options.width ?? 900;
  for (const ball of game.balls) {
    if (ball.owner !== "player" || ball.vy <= 0) continue;
    const prior = previous.get(ball) ?? { x: ball.x, y: ball.y };
    const contact = sweptPaddleContact(ball, prior.x, prior.y, { x: game.paddleX, previousX: game.paddleX, y: options.paddleY, width: game.paddleWidth }, options.slop ?? 4, options.sideDepth ?? 18, options.forgiveness ?? 10);
    if (!contact) continue;
    ball.x = contact.contactX; ball.y = options.paddleY - ball.radius - 0.1;
    const speed = Math.max(300, Math.hypot(ball.vx, ball.vy));
    const ratio = Math.max(-0.84, Math.min(0.84, (input.aimX - contact.contactX) / Math.max(1, width / 2)));
    ball.vx = ratio * speed; ball.vy = -Math.sqrt(Math.max(1, speed * speed - ball.vx * ball.vx));
    ensureMinimumVerticalAngle(ball, -1);
    return { contactX: contact.contactX, hitRatio: contact.hitRatio };
  }
  return null;
}

export type LegacySkillEffect = { type: "damage" | "control" | "barrier" | "pierce" | "burn" | "disable-healing" | "summon"; value: unknown };

/** Normalizes canonical SkillResult fields for the legacy event/result consumer. */
export function normalizeLegacySkillResult(result: SkillResult): LegacySkillEffect[] {
  const effects: LegacySkillEffect[] = [];
  if (result.damage !== undefined) effects.push({ type: "damage", value: result.damage });
  if (result.control) effects.push({ type: "control", value: result.control });
  if (result.barrier) effects.push({ type: "barrier", value: result.barrier });
  if (result.pierce !== undefined) effects.push({ type: "pierce", value: result.pierce });
  if (result.burn) effects.push({ type: "burn", value: result.burn });
  if (result.disableHealing !== undefined) effects.push({ type: "disable-healing", value: result.disableHealing });
  if (result.summon) effects.push({ type: "summon", value: result.summon });
  return effects;
}
