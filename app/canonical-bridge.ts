import {
  createCanonicalState,
  grantCanonicalSkill,
  stepCanonicalEngine,
  type CanonicalControls,
  type CanonicalState,
  type CanonicalStepOptions,
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
  ghostRecords?: Array<{ upgrades: UpgradeId[] }>;
}) {
  const state = createCanonicalState({ ...options });
  for (const id of options.game?.upgrades ?? []) grantCanonicalSkill(state, id, "start");
  if (options.game) {
    // The visible run is created by the existing GameState factory.  During
    // the cutover the canonical simulation must start from that exact world,
    // otherwise its seeded wave layout (and random drop/trait choices) can
    // differ from what the player just saw.  Copy the initial world once at
    // the bridge boundary; subsequent frames are canonical-owned.
    state.paddleX = options.game.paddleX;
    state.paddleWidth = options.game.paddleWidth;
    const ghostCount = options.game.ghostPaddles?.length ?? 0;
    state.ghostPaddles = [...(options.game.ghostPaddles ?? [])];
    const ghostRecords = options.ghostRecords ?? [];
    const valueFor = (id: UpgradeId, level: number) => Number(state.skills.find((skill) => skill.id === id)?.levels[Math.max(0, level - 1)] ?? 0);
    state.ghostPaddleWidths = state.ghostPaddles.map((_, index) => {
      const upgrades = ghostRecords[index]?.upgrades ?? [];
      const level = Math.min(3, upgrades.filter((id) => id === "common-wide" || id === "wide").length);
      return Math.min(260, 92 + valueFor("common-wide", level));
    });
    state.ghostPaddleSpeeds = state.ghostPaddles.map((_, index) => {
      const upgrades = ghostRecords[index]?.upgrades ?? [];
      const level = upgrades.filter((id) => id === "common-move-speed" || id === "speed").length;
      return Math.max(125, 210 + level * 45 - (state.wave - 1) * 6);
    });
    state.ghostPaddleActive = state.ghostPaddles.map(() => true);
    state.ghostPaddleUpgrades = Array.from({ length: ghostCount }, (_, index) => [...(ghostRecords[index]?.upgrades ?? [])]);
    state.coreHp = options.game.coreHp;
    state.maxCoreHp = options.game.maxCoreHp;
    state.bricks = options.game.bricks.map((brick, index) => ({
      id: index + 1,
      x: brick.x,
      y: brick.y,
      w: brick.w,
      h: brick.h,
      hp: brick.hp,
      maxHp: brick.maxHp,
      alive: brick.alive,
      trait: brick.trait,
      guardReady: brick.guardReady,
      healTimer: brick.healTimer,
      healBlockTime: brick.healBlockTime,
      burnTime: brick.burnTime,
      burnTick: brick.burnTick,
      traitLockTime: brick.traitLockTime,
      frostVulnerability: brick.frostVulnerability,
      drop: brick.drop === "multiball" || brick.drop === "auto-barrier" || brick.drop === "core-repair" || brick.drop === "cooldown-reset" ? brick.drop : null,
      kind: brick.kind === "boss-core" ? "boss-core" : brick.kind === "boss-minion" ? "boss-minion" : "normal",
    }));
    state.nextBrickId = state.bricks.length + 1;
  }
  if (options.game?.balls[0]) {
    const source = options.game.balls[0];
    const target = state.balls[0];
    Object.assign(target, {
      x: source.x, y: source.y, vx: source.vx, vy: source.vy,
      radius: source.radius, temporary: source.temporaryTime > 0 || source.waveBonus,
      temporaryTime: source.temporaryTime, missileTime: source.missileTime,
      waveBonus: source.waveBonus, visualSkill: source.visualSkill as any,
      attackPower: source.attackPower, pierce: source.pierce, maxPierce: source.maxPierce,
      payload: source.payload, payloadLevel: source.payloadLevel, payloads: { ...source.payloads },
      cooldowns: { ...source.skillCooldowns }, skillCharges: { ...source.skillCharges },
      respawnRecoveryTime: source.respawnRecoveryTime, respawnRecoveryDuration: source.respawnRecoveryDuration,
      respawnRecoveryBaseSpeed: source.respawnRecoveryBaseSpeed,
    });
  }
  state.effects = (options.game?.effects ?? []).map((effect) => ({ ...effect }));
  state.particles = (options.game?.particles ?? []).map((particle) => ({ ...particle }));
  state.flashes = (options.game?.flashes ?? []).map((flash) => ({ ...flash }));
  const launch = state.balls[0];
  if (launch && options.game) {
    options.game.flashes.push({ text: "LAUNCH", x: launch.x, y: launch.y - 18, life: 0.4, color: "#ffffff" });
  }
  return state;
}

export function stepCanonicalBridge(state: CanonicalState, game: GameState, controls: CanonicalControls, dt: number, events?: GameEventBuffer, stepOptions?: CanonicalStepOptions) {
  stepCanonicalEngine(state, controls, dt, stepOptions);
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
