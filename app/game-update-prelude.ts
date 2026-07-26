import type { GameState } from "./_types/game";

export type PreludeInput = {
  botActive: boolean;
  botMove: -1 | 0 | 1;
  keyboardLeft: boolean;
  keyboardRight: boolean;
  keyboardAimLeft: boolean;
  keyboardAimRight: boolean;
  aimHorizontalRatio: number;
};

export type PreludeOptions = {
  dt: number;
  input: PreludeInput;
  paddleSpeed: number;
  aimRatioSpeed: number;
  aimTargetDistance: number;
  maxAimRatio: number;
  paddleY: number;
  width: number;
  keyboardAimEnabled: boolean;
  onBotControls?: () => void;
};

/** Mutates only simulation state; no React, canvas, audio, or browser dependencies. */
export function advanceGamePrelude(game: GameState, options: PreludeOptions) {
  const { dt, input } = options;
  game.elapsed += dt;
  game.rowTimer += dt;
  game.itemBarrierTime = Math.max(0, game.itemBarrierTime - dt);
  game.bricks.forEach((brick) => {
    brick.traitLockTime = Math.max(0, brick.traitLockTime - dt);
  });

  Object.values(game.paddleCounters).forEach((counter) => {
    counter.missileReflections ??= 0;
    counter.safetyTimer = Number.isFinite(counter.safetyTimer) ? counter.safetyTimer - dt : 0;
    counter.gravityTimer = Number.isFinite(counter.gravityTimer) ? counter.gravityTimer - dt : 0;
    counter.lastShotTimer -= dt;
    counter.skillCooldowns ??= {};
    Object.keys(counter.skillCooldowns).forEach((id) => {
      counter.skillCooldowns[id as keyof typeof counter.skillCooldowns] = Math.max(0, (counter.skillCooldowns[id as keyof typeof counter.skillCooldowns] ?? 0) - dt);
    });
  });

  if (!input.botActive && options.keyboardAimEnabled) {
    const aimMovement = Number(input.keyboardAimRight) - Number(input.keyboardAimLeft);
    input.aimHorizontalRatio = Math.max(-options.maxAimRatio, Math.min(options.maxAimRatio, input.aimHorizontalRatio + aimMovement * options.aimRatioSpeed * dt));
  }
  const movement = input.botActive ? input.botMove : Number(input.keyboardRight) - Number(input.keyboardLeft);
  game.paddleX = Math.max(game.paddleWidth / 2, Math.min(options.width - game.paddleWidth / 2, game.paddleX + movement * options.paddleSpeed * dt));
  return input;
}

export function advanceTemporalState(game: GameState, dt: number) {
  game.elapsed += dt;
  game.rowTimer += dt;
  game.itemBarrierTime = Math.max(0, game.itemBarrierTime - dt);
  game.bricks.forEach((brick) => { brick.traitLockTime = Math.max(0, brick.traitLockTime - dt); });
  Object.values(game.paddleCounters).forEach((counter) => {
    counter.missileReflections ??= 0;
    counter.safetyTimer = Number.isFinite(counter.safetyTimer) ? counter.safetyTimer - dt : 0;
    counter.gravityTimer = Number.isFinite(counter.gravityTimer) ? counter.gravityTimer - dt : 0;
    counter.lastShotTimer -= dt;
    counter.skillCooldowns ??= {};
    Object.keys(counter.skillCooldowns).forEach((id) => {
      const key = id as keyof typeof counter.skillCooldowns;
      counter.skillCooldowns[key] = Math.max(0, (counter.skillCooldowns[key] ?? 0) - dt);
    });
  });
}

export function applyPaddleInput(game: GameState, direction: -1 | 0 | 1, speed: number, dt: number, width: number) {
  game.paddleX = Math.max(game.paddleWidth / 2, Math.min(width - game.paddleWidth / 2, game.paddleX + direction * speed * dt));
}
