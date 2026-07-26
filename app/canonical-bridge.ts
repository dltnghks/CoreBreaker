import {
  createCanonicalState,
  grantCanonicalSkill,
  stepCanonicalEngine,
  type CanonicalControls,
  type CanonicalState,
} from "./canonical-engine";
import { syncCanonicalBallsIntoGame, syncCanonicalWorldIntoGame } from "./canonical-state-mapping";
import type { BalanceConfig } from "./balance-config";
import type { SkillConfig, UpgradeId } from "./skill-config";
import type { WaveDefinition } from "./wave-config";
import type { GameState } from "./_types/game";
import { emitCanonicalVisualEvents, type GameEventBuffer } from "./game-events";

/** Explicit capability gate used by both normal and benchmark runs. */
export function canonicalEngineEnabledForRun(options: { explicit?: boolean; benchmarkMode?: boolean }) {
  return Boolean(options.explicit || options.benchmarkMode);
}

/**
 * Narrow migration boundary for the visible runtime. The caller explicitly
 * opts into this bridge; the default remains legacy-owned for parity.
 */
export function createCanonicalBridge(options: {
  seed: number;
  balance: BalanceConfig;
  skills: SkillConfig[];
  waves: WaveDefinition[];
  targetWave?: number;
  game?: GameState;
}) {
  const state = createCanonicalState({ ...options });
  for (const id of options.game?.upgrades ?? []) grantCanonicalSkill(state, id, "start");
  if (options.game?.balls[0]) {
    const source = options.game.balls[0];
    const target = state.balls[0];
    target.x = source.x;
    target.y = source.y;
    target.vx = source.vx;
    target.vy = source.vy;
  }
  return state;
}

export function stepCanonicalBridge(state: CanonicalState, game: GameState, controls: CanonicalControls, dt: number, events?: GameEventBuffer) {
  stepCanonicalEngine(state, controls, dt);
  if (events && state.visualEvents.length) emitCanonicalVisualEvents(events, state.visualEvents);
  // Keep the explicit projectile boundary visible for migration tooling and
  // older consumers; the world sync below applies the remaining fields.
  syncCanonicalBallsIntoGame(game, state);
  syncCanonicalWorldIntoGame(game, state);
}

/** Keep skill choices made by the React/legacy UI in sync with the canonical
 * simulation during the incremental cutover. */
export function grantCanonicalBridgeSkill(state: CanonicalState | null, id: UpgradeId, source: "start" | "wave" | "boss" = "wave", ballCost: 0 | 1 | 2 = 0) {
  if (!state) return;
  grantCanonicalSkill(state, id, source, ballCost);
}
