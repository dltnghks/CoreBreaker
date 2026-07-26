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
    attackPower: ball.attackPower, missileTime: finiteNumber(ball.missileTime), missileHitCooldown: 0, gravityRescueCooldown: 0,
    gravityBaseSpeed: null, explosionBaseSpeed: null, explosionBoostRatio: 1, explosionBoostTime: 0,
    canTriggerSkills: true, skillGeneration: 0, skillCharges: { ...ball.skillCharges }, skillCooldowns: { ...ball.cooldowns },
    visualSkill: ball.visualSkill as Ball["visualSkill"], temporaryTime: finiteNumber(ball.temporaryTime), waveBonus: Boolean(ball.waveBonus),
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
  // Re-materialize paddle-owned presentation state that used to be updated by
  // the legacy collision loop.  Canonical simulation owns the barrier and
  // ball cooldowns, so the renderer must not be left with stale empty arrays.
  if (source.barrierCharges > 0 || source.barrierTime > 0) {
    target.safetyBlocks = source.safetyBlocks.length
      ? source.safetyBlocks.map((block) => ({ ownerPaddleId: "player", ...block }))
      : [{ ownerPaddleId: "player", x: source.paddleX, y: 707, width: Math.min(150, source.paddleWidth * 0.9), color: "#55d6ff" }];
  } else {
    target.safetyBlocks = [];
  }
  target.paddleCounters ??= {};
  const baseBall = source.balls[0];
  const playerCounter = target.paddleCounters.player ?? {
    reflections: 0, barrierReflections: 0, missileReflections: 0,
    safetyTimer: 0, gravityTimer: 0, directKills: 0, pierceKills: 0,
    feverMilestone: 0, lastShotTimer: 0, combo: source.combo,
    comboTimer: 0, skillCooldowns: {}, chargePulse: 0, chargeColor: "#ffffff",
  };
  playerCounter.combo = source.combo;
  playerCounter.comboTimer = 0;
  playerCounter.skillCooldowns = { ...(baseBall?.cooldowns ?? {}) };
  playerCounter.chargePulse = Math.max(0, finiteNumber(baseBall?.visualSkillTime));
  playerCounter.chargeColor = baseBall?.visualSkill ? "#c18cff" : "#ffffff";
  target.paddleCounters.player = playerCounter;
  target.ultimateAuras = { ...(source.ultimateAuras as GameState["ultimateAuras"]) };
  for (const ball of source.balls) {
    if (ball.visualSkill && ["warrior-earthquake", "warrior-berserker", "archer-arrow-rain", "archer-infinite", "mage-elemental-storm", "mage-meteor"].includes(ball.visualSkill)) {
      target.ultimateAuras[ball.visualSkill as keyof typeof target.ultimateAuras] = true;
    }
  }
  target.coreBreakTime = finiteNumber(source.coreBreakTime);
  target.coreBreakDuration = finiteNumber(source.coreBreakDuration);
  target.coreBreakX = finiteNumber(source.coreBreakX, source.paddleX);
  target.coreBreakY = finiteNumber(source.coreBreakY, 742);
  target.ghostPaddles = source.ghostPaddles.length ? [...source.ghostPaddles] : target.ghostPaddles;
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
  // Rebuild the visible brick collection from canonical geometry. Mapping
  // only hp/alive used to leave the previous wave's positions in the canvas
  // (and silently dropped newly spawned boss/minion bricks). Geometry and
  // collection membership are simulation state too, so carry them across in
  // one deterministic pass while retaining renderer-only presentation fields.
  target.bricks = source.bricks.map((canonicalBrick, index) => {
    const existing = brickByPosition.get(`${Math.round(canonicalBrick.x)}:${Math.round(canonicalBrick.y)}`)
      ?? target.bricks[canonicalBrick.id - 1];
    const brick = existing ?? {
      x: canonicalBrick.x, y: canonicalBrick.y, w: canonicalBrick.w, h: canonicalBrick.h,
      hp: canonicalBrick.hp, maxHp: canonicalBrick.maxHp, hue: 178 + source.wave * 9 + index * 2,
      alive: canonicalBrick.alive, kind: "normal" as const, drop: canonicalBrick.drop,
      trait: canonicalBrick.trait, guardReady: canonicalBrick.guardReady,
      healTimer: canonicalBrick.healTimer, healBlockTime: canonicalBrick.healBlockTime,
      poisonTime: 0, poisonTick: 0, poisonSourcePaddleId: null,
      burnTime: canonicalBrick.burnTime, burnTick: canonicalBrick.burnTick, burnLevel: 0, burnSourcePaddleId: null,
      blastVulnerability: 1, blastVulnerabilitySourcePaddleId: null,
      frostVulnerability: canonicalBrick.frostVulnerability, traitLockTime: canonicalBrick.traitLockTime,
      lastHitPaddleId: null,
    };
    brick.x = canonicalBrick.x;
    brick.y = canonicalBrick.y;
    brick.w = canonicalBrick.w;
    brick.h = canonicalBrick.h;
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
    return brick;
  });

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
