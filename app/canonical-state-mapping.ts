import type { Ball, GameState, PayloadId, Brick, DropItem, GravityWell, SkillRunMetric } from "./_types/game";
import type { CanonicalBall, CanonicalState, CanonicalPayloadId } from "./canonical-engine";

/** Numeric values cross the canonical/React boundary at runtime, where a
 * malformed skill/config payload must never turn the HUD into `NaN`. */
export function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Single boundary conversion for canonical balls consumed by the legacy
 * renderer. Simulation-only fields are preserved rather than reconstructed
 * from position/velocity, so attack and payload upgrades survive sync.
 */
export function canonicalBallToLegacy(ball: CanonicalBall, overrides: Partial<Pick<Ball, "owner" | "color" | "sourcePaddleId">> = {}): Ball {
  const payloads = { ...ball.payloads } as Partial<Record<PayloadId, number>>;
  return {
    x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, radius: ball.radius,
    owner: overrides.owner ?? "player", color: overrides.color ?? "#ffffff", sourcePaddleId: overrides.sourcePaddleId ?? "player",
    pierce: ball.pierce, maxPierce: ball.maxPierce, blast: payloads.blast ?? 0,
    payload: (ball.payload as PayloadId | null) ?? null, payloadLevel: ball.payloadLevel, payloads,
    attackPower: ball.attackPower, missileTime: 0, missileHitCooldown: 0, gravityRescueCooldown: 0,
    gravityBaseSpeed: null, explosionBaseSpeed: null, explosionBoostRatio: 1, explosionBoostTime: 0,
    canTriggerSkills: true, skillGeneration: 0, skillCharges: { ...ball.skillCharges }, skillCooldowns: { ...ball.cooldowns },
    visualSkill: null, temporaryTime: ball.temporary ? 1 : 0, waveBonus: false,
    respawnRecoveryTime: ball.respawnRecoveryTime, respawnRecoveryDuration: ball.respawnRecoveryDuration,
    respawnRecoveryBaseSpeed: ball.respawnRecoveryBaseSpeed,
  };
}

/** Apply canonical ball fields in-place without clobbering legacy-only metadata. */
export function syncCanonicalBallIntoLegacy(target: Ball, source: CanonicalBall) {
  Object.assign(target, canonicalBallToLegacy(source, { owner: target.owner, color: target.color, sourcePaddleId: target.sourcePaddleId }));
}

/** Copy the canonical simulation into an existing legacy game state boundary. */
export function syncCanonicalBallsIntoGame(target: GameState, source: CanonicalState) {
  target.balls = source.balls.map((ball, index) => canonicalBallToLegacy(ball, { owner: "player", sourcePaddleId: "player", color: index === 0 ? "#ffffff" : "#9a8cff" }));
  target.paddleX = source.paddleX;
  target.paddleWidth = source.paddleWidth;
  target.elapsed = source.elapsed;
  target.wave = source.wave;
  target.score = finiteNumber(source.score, finiteNumber(target.score));
  target.bricksBroken = source.bricksBroken;
  target.coreHp = source.coreHp;
  target.maxCoreHp = source.maxCoreHp;
}

/**
 * Synchronise the non-projectile portion of the canonical simulation into the
 * legacy renderer/state boundary.  This is deliberately an in-place update:
 * callers keep their existing GameState identity and legacy-only presentation
 * fields (hue, particles, effects, etc.) remain untouched.  The bridge is
 * opt-in, so the normal legacy run never traverses this function.
 */
export function syncCanonicalWorldIntoGame(target: GameState, source: CanonicalState) {
  syncCanonicalBallsIntoGame(target, source);
  target.level = source.wave;
  target.rowTimer = source.waveElapsed;
  target.combo = source.combo;
  target.maxCombo = source.maxCombo;
  target.pendingWave = source.complete ? null : target.pendingWave;
  target.bossEnhancements = { ...source.bossEnhancements };
  target.paddleBarriers = { canonical: source.barrierCharges };
  target.itemBarrierTime = source.barrierTime;
  target.bossSkillTimer = source.bossAttackTimer;
  target.bossAttackPattern = source.bossPattern;
  target.bossTimeRemaining = source.bossAttackTimer;
  target.bossActive = source.bricks.some((brick) => brick.kind === "boss-core" && brick.alive);
  target.bossPending = false;
  target.failed = source.gameOver;
  target.failureReason = source.gameOver ? (source.coreHp <= 0 ? "core" : "ball") : null;
  // Optional marker allows the UI bridge to observe a canonical target-wave
  // completion without changing the legacy lifecycle union.
  target.canonicalComplete = source.complete;

  const brickByPosition = new Map(target.bricks.map((brick) => [`${Math.round(brick.x)}:${Math.round(brick.y)}`, brick]));
  for (const canonicalBrick of source.bricks) {
    const brick = brickByPosition.get(`${Math.round(canonicalBrick.x)}:${Math.round(canonicalBrick.y)}`)
      ?? target.bricks[canonicalBrick.id - 1];
    if (!brick) continue;
    brick.hp = canonicalBrick.hp;
    brick.maxHp = canonicalBrick.maxHp;
    brick.alive = canonicalBrick.alive;
    brick.trait = canonicalBrick.trait;
    brick.guardReady = canonicalBrick.guardReady;
    brick.healTimer = canonicalBrick.healTimer;
    brick.healBlockTime = canonicalBrick.healBlockTime;
    brick.burnTime = canonicalBrick.burnTime;
    brick.burnTick = canonicalBrick.burnTick;
    brick.frostVulnerability = canonicalBrick.frostVulnerability;
    brick.traitLockTime = canonicalBrick.traitLockTime;
    brick.drop = canonicalBrick.drop;
    brick.kind = canonicalBrick.kind === "boss-core" ? "boss-core" : canonicalBrick.kind === "boss-minion" ? "boss-minion" : "normal";
  }

  // Canonical items do not need renderer identity; retain existing ids where
  // possible and allocate deterministic ids for newly spawned drops.
  const existingIds = target.items.map((item) => item.id);
  target.items = source.items.map((item, index): DropItem => ({
    id: existingIds[index] ?? index + 1,
    x: item.x,
    y: item.y,
    vy: item.vy,
    alive: item.alive,
    kind: item.kind,
  }));
  target.gravityWells = source.gravityWells.map((well): GravityWell => ({
    ownerPaddleId: "player", x: well.x, y: well.y, radius: well.radius,
    life: well.life, maxLife: Math.max(well.life, 1), color: "#a77bff",
    damagePerSecond: well.damagePerSecond, damageTick: well.damageTick,
  }));
  target.skillMetrics = Object.fromEntries(Object.entries(source.skillMetrics).map(([id, metric]) => [id, { ...(metric as SkillRunMetric) }])) as GameState["skillMetrics"];
  target.skillHistory = source.skillHistory.map((event) => ({ wave: event.wave, skillId: event.skillId, level: event.level, source: event.source }));
  target.bricksBroken = source.bricksBroken;
  target.score = finiteNumber(source.score, finiteNumber(target.score));
}

export type CanonicalBallField = keyof Pick<CanonicalBall, "attackPower" | "pierce" | "maxPierce" | "payload" | "payloadLevel" | "payloads" | "skillCharges" | "cooldowns">;
export const CANONICAL_PRESERVED_BALL_FIELDS: readonly CanonicalBallField[] = ["attackPower", "pierce", "maxPierce", "payload", "payloadLevel", "payloads", "skillCharges", "cooldowns"];
