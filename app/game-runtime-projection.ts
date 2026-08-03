import type { Ball, GameState, PayloadId, DropItem, GravityWell, SkillRunMetric } from "./_types/game";
import { PLAYER_LINE_Y, type CanonicalBall, type CanonicalState } from "./canonical-engine";

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
export function projectCanonicalBall(ball: CanonicalBall, overrides: Partial<Pick<Ball, "owner" | "color" | "sourcePaddleId">> = {}): Ball {
  const payloads = { ...ball.payloads } as Partial<Record<PayloadId, number>>;
  return {
    x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, radius: ball.radius,
    owner: overrides.owner ?? "player", color: overrides.color ?? "#ffffff", sourcePaddleId: overrides.sourcePaddleId ?? "player",
    pierce: ball.pierce, maxPierce: ball.maxPierce, blast: payloads.blast ?? 0,
    payload: (ball.payload as PayloadId | null) ?? null, payloadLevel: ball.payloadLevel, payloads,
    attackPower: ball.attackPower, missileTime: finiteNumber(ball.missileTime), missileHitCooldown: 0, gravityRescueCooldown: 0,
    gravityBaseSpeed: ball.gravityBaseSpeed, explosionBaseSpeed: ball.explosionBaseSpeed, explosionBoostRatio: ball.explosionBoostRatio, explosionBoostTime: ball.explosionBoostTime,
    canTriggerSkills: ball.canTriggerSkills, skillGeneration: ball.skillGeneration, skillCharges: { ...ball.skillCharges }, skillCooldowns: { ...ball.cooldowns },
    visualSkill: ball.visualSkill as Ball["visualSkill"], temporaryTime: finiteNumber(ball.temporaryTime), waveBonus: Boolean(ball.waveBonus),
    respawnRecoveryTime: ball.respawnRecoveryTime, respawnRecoveryDuration: ball.respawnRecoveryDuration,
    respawnRecoveryBaseSpeed: ball.respawnRecoveryBaseSpeed,
  };
}

/** Apply canonical ball fields in-place without clobbering legacy-only metadata. */
export function projectCanonicalBallIntoView(target: Ball, source: CanonicalBall) {
  Object.assign(target, projectCanonicalBall(source, { owner: target.owner, color: target.color, sourcePaddleId: target.sourcePaddleId }));
}

/** Project canonical simulation fields into the mutable presentation model. */
export function projectCanonicalBallsIntoGameView(target: GameState, source: CanonicalState) {
  target.balls = source.balls.map((ball, index) => projectCanonicalBall(ball, { owner: "player", sourcePaddleId: "player", color: index === 0 ? "#ffffff" : "#9a8cff" }));
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
 * Project the non-projectile portion of the canonical simulation into the
 * presentation model. The renderer-only buffers (particles, effects, flashes)
 * remain owned by the presentation layer and are never copied back to the
 * canonical state.
 */
function applyCanonicalStateProjection(target: GameState, source: CanonicalState) {
  projectCanonicalBallsIntoGameView(target, source);
  target.upgrades = [...source.upgrades];
  target.bossRewards = source.skillHistory.filter((event) => event.source === "boss").map((event) => event.skillId);
  target.level = source.wave;
  target.rowTimer = source.rowTimer;
  target.overdriveLevel = source.overdriveLevel;
  target.combo = source.combo;
  target.maxCombo = source.maxCombo;
  target.pendingWave = source.complete ? null : target.pendingWave;
  target.bossEnhancements = { ...source.bossEnhancements };
  target.paddleBarriers = { canonical: source.barrierCharges };
  target.itemBarrierTime = source.itemBarrierTime;
  // Re-materialize paddle-owned presentation state that used to be updated by
  // the legacy collision loop.  Canonical simulation owns the barrier and
  // ball cooldowns, so the renderer must not be left with stale empty arrays.
  if (source.barrierCharges > 0 || source.barrierTime > 0 || source.itemBarrierTime > 0) {
    target.safetyBlocks = source.safetyBlocks.length
      ? source.safetyBlocks.map((block) => ({ ownerPaddleId: "player", ...block }))
      : [{ ownerPaddleId: "player", x: source.paddleX, y: PLAYER_LINE_Y, width: Math.min(150, source.paddleWidth * 0.9), color: "#55d6ff" }];
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
    brick.poisonTime = canonicalBrick.poisonTime;
    brick.poisonTick = canonicalBrick.poisonTick;
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
  target.physicalPower = source.combatStats.physicalPower;
  target.magicPower = source.combatStats.magicPower;
  target.physicalDamage = source.physicalDamage;
  target.magicDamage = source.magicDamage;
  target.skillHistory = source.skillHistory.map((event) => ({ wave: event.wave, skillId: event.skillId, level: event.level, source: event.source }));
  target.bricksBroken = source.bricksBroken;
  target.score = finiteNumber(source.score, finiteNumber(target.score));
}

/**
 * Pure runtime projection. It returns a fresh view object and never writes
 * presentation data back into CanonicalState or mutates the previous view.
 */
export function projectCanonicalStateIntoGameView(previous: GameState, source: CanonicalState): GameState {
  const target: GameState = {
    ...previous,
    balls: previous.balls.map((ball) => ({ ...ball, payloads: { ...ball.payloads }, skillCharges: { ...ball.skillCharges }, skillCooldowns: { ...ball.skillCooldowns } })),
    bricks: previous.bricks.map((brick) => ({ ...brick })),
    items: previous.items.map((item) => ({ ...item })),
    gravityWells: previous.gravityWells.map((well) => ({ ...well })),
    safetyBlocks: previous.safetyBlocks.map((block) => ({ ...block })),
    paddleCounters: Object.fromEntries(Object.entries(previous.paddleCounters).map(([id, counter]) => [id, { ...counter, skillCooldowns: { ...counter.skillCooldowns } }])),
    upgrades: [...previous.upgrades],
    bossRewards: [...previous.bossRewards],
    bossEnhancements: { ...previous.bossEnhancements },
    skillHistory: previous.skillHistory.map((event) => ({ ...event })),
    skillMetrics: Object.fromEntries(Object.entries(previous.skillMetrics).map(([id, metric]) => [id, { ...metric }])) as GameState["skillMetrics"],
  };
  applyCanonicalStateProjection(target, source);
  return target;
}

export type CanonicalBallField = keyof Pick<CanonicalBall, "attackPower" | "pierce" | "maxPierce" | "payload" | "payloadLevel" | "payloads" | "skillCharges" | "cooldowns">;
export const CANONICAL_PRESERVED_BALL_FIELDS: readonly CanonicalBallField[] = ["attackPower", "pierce", "maxPierce", "payload", "payloadLevel", "payloads", "skillCharges", "cooldowns"];

