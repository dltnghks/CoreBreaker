import type {
  CanonicalBall,
  CanonicalBrick,
  CanonicalItem,
  CanonicalOutcome,
  CanonicalState,
} from "./canonical-engine";

export type GameViewState = {
  tick: number;
  elapsed: number;
  waveElapsed: number;
  rowTimer: number;
  overdriveLevel: number;
  overdriveMultiplier: number;
  wave: number;
  targetWave: number;
  paddleX: number;
  paddleWidth: number;
  balls: ReadonlyArray<Readonly<CanonicalBall>>;
  bricks: ReadonlyArray<Readonly<CanonicalBrick>>;
  items: ReadonlyArray<Readonly<CanonicalItem>>;
  coreHp: number;
  maxCoreHp: number;
  score: number;
  combo: number;
  maxCombo: number;
  bricksBroken: number;
  upgrades: CanonicalState["upgrades"];
  bossEnhancements: CanonicalState["bossEnhancements"];
  outcome: CanonicalOutcome;
};

/** Pure, immutable projection consumed by React/HUD and future renderers. */
export function projectCanonicalState(state: CanonicalState): GameViewState {
  const outcome: CanonicalOutcome =
    state.phase === "awaiting-start-skill"
      ? { type: "start-skill", choices: state.pendingChoices, rerollsLeft: state.rerollsLeft }
      : state.phase === "wave-cleared"
        ? { type: "wave-clear", wave: state.clearedWave ?? state.wave, boss: state.clearedBoss }
        : state.phase === "awaiting-wave-skill"
          ? { type: "wave-skill", choices: state.pendingChoices, rerollsLeft: state.rerollsLeft }
          : state.phase === "awaiting-boss-reward"
            ? { type: "boss-reward", choices: state.pendingBossChoices }
            : state.phase === "ready-for-next-wave"
              ? { type: "ready-for-next-wave", wave: state.pendingWave ?? state.wave + 1 }
              : state.phase === "complete"
                ? { type: "complete" }
                : state.phase === "game-over"
                  ? { type: "game-over", reason: state.gameOverReason ?? "core" }
                  : { type: "running" };

  return {
    tick: state.tick,
    elapsed: state.elapsed,
    waveElapsed: state.waveElapsed,
    rowTimer: state.rowTimer,
    overdriveLevel: state.overdriveLevel,
    overdriveMultiplier: 1 + state.overdriveLevel * 0.01,
    wave: state.wave,
    targetWave: state.targetWave,
    paddleX: state.paddleX,
    paddleWidth: state.paddleWidth,
    balls: state.balls.map((ball) => ({ ...ball, cooldowns: { ...ball.cooldowns }, skillCharges: { ...ball.skillCharges }, payloads: { ...ball.payloads } })),
    bricks: state.bricks.map((brick) => ({ ...brick })),
    items: state.items.map((item) => ({ ...item })),
    coreHp: state.coreHp,
    maxCoreHp: state.maxCoreHp,
    score: state.score,
    combo: state.combo,
    maxCombo: state.maxCombo,
    bricksBroken: state.bricksBroken,
    upgrades: [...state.upgrades],
    bossEnhancements: { ...state.bossEnhancements },
    outcome,
  };
}
