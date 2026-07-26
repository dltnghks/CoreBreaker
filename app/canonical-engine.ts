import { DEFAULT_BALANCE_CONFIG, type BalanceConfig, type BotWaveSample } from "./balance-config";
import { DEFAULT_SKILLS, type LegacyUpgradeId, type SkillConfig, type UpgradeId } from "./skill-config";
import { WAVE_DEFINITIONS, waveDefinitionFrom, type WaveDefinition } from "./wave-config";

export const ENGINE_VERSION = "canonical-fixed-step-v2-boss-tuning" as const;
export const ENGINE_PARITY = "fixed-step-canonical-rules" as const;
export const POLICY_VERSION = "predictive-controls-v4-primary-ball-priority" as const;
export const FIXED_STEP_SECONDS = 1 / 120;
export const GAME_WIDTH = 900;
export const GAME_HEIGHT = 600;
export const PLAYER_PADDLE_Y = GAME_HEIGHT - 70;
export const BRICK_ROW_Y = 74;
export const BRICK_ROW_STEP = 34;
export const BASE_BALL_VX = 240;
export const BASE_BALL_VY = 320;
export const PADDLE_SPEED = 460;
export const BASE_PADDLE_WIDTH = 128;
export const MAX_AIM_HORIZONTAL_RATIO = 0.84;
export const MIN_AIM_VERTICAL_DISTANCE = 52;
export const MIN_VERTICAL_SPEED_RATIO = 0.32;
export const OVERDRIVE_RATE_PER_SECOND = 0.01;
export const MAX_OVERDRIVE_LEVEL = 50;
export const RESPAWN_SPEED_RECOVERY_SECONDS = 5;

export type CanonicalTrait = "standard" | "guard" | "explosive" | "indestructible" | "healer" | "reflector";
export type CanonicalItemKind = "multiball" | "auto-barrier" | "core-repair" | "cooldown-reset";
export type CanonicalPayloadId = "pierce" | "blast" | "glass" | "link";
export type CanonicalControls = { move: -1 | 0 | 1; aimX: number; aimY: number };
export type CanonicalBall = { x: number; y: number; vx: number; vy: number; radius: number; temporary: boolean; temporaryTime: number; missileTime: number; waveBonus: boolean; visualSkill: UpgradeId | null; visualSkillTime: number; cooldowns: Record<string, number>; skillCharges: Partial<Record<UpgradeId, number>>; attackPower: number; pierce: number; maxPierce: number; payload: CanonicalPayloadId | null; payloadLevel: number; payloads: Partial<Record<CanonicalPayloadId, number>>; respawnRecoveryTime: number; respawnRecoveryDuration: number; respawnRecoveryBaseSpeed: number };
export type CanonicalBrick = { id: number; x: number; y: number; w: number; h: number; hp: number; maxHp: number; alive: boolean; trait: CanonicalTrait; guardReady: boolean; healTimer: number; healBlockTime: number; burnTime: number; burnTick: number; traitLockTime: number; frostVulnerability: number; drop: CanonicalItemKind | null; kind: "normal" | "boss-core" | "boss-minion" };
export type CanonicalItem = { x: number; y: number; vy: number; kind: CanonicalItemKind; alive: boolean };
export type CanonicalGravityWell = { x: number; y: number; radius: number; life: number; damagePerSecond: number; damageTick: number };
export type CanonicalVisualEvent = {
  kind: "skill" | "ultimate" | "impact";
  skillId: UpgradeId;
  x: number;
  y: number;
  radius: number;
  duration: number;
  /** Optional presentation metadata retained at the simulation boundary. */
  variant?: number;
  color?: string;
  text?: string;
  x2?: number;
  y2?: number;
};
export type CanonicalSkillEvent = { wave: number; skillId: UpgradeId; level: number; evolved?: boolean; source: "start" | "wave" | "boss"; ballCost?: 0 | 1 | 2 };
/**
 * Canonical effect envelope used at the legacy/canonical migration boundary.
 * Every skill runtime may populate any subset; the dispatcher is responsible
 * for applying the result to the canonical state in one place.
 */
export type SkillResult = {
  damage?: number;
  control?: { duration: number; kind?: string };
  barrier?: { duration?: number; charges?: number };
  pierce?: number;
  burn?: { duration: number; damage: number };
  disableHealing?: number;
  summon?: { count: number; temporary?: boolean };
};
export type CanonicalWaveMetric = BotWaveSample & { clearTime: number; skillChoices: UpgradeId[] };
export type CanonicalState = {
  seed: number;
  random: () => number;
  balance: BalanceConfig;
  skills: SkillConfig[];
  waves: WaveDefinition[];
  targetWave: number;
  wave: number;
  waveElapsed: number;
  elapsed: number;
  paddleX: number;
  paddleWidth: number;
  balls: CanonicalBall[];
  bricks: CanonicalBrick[];
  items: CanonicalItem[];
  gravityWells: CanonicalGravityWell[];
  visualEvents: CanonicalVisualEvent[];
  upgrades: UpgradeId[];
  bossEnhancements: Partial<Record<UpgradeId, number>>;
  skillHistory: CanonicalSkillEvent[];
  skillMetrics: Partial<Record<UpgradeId, { activations: number; damage: number; kills: number }>>;
  waveMetrics: CanonicalWaveMetric[];
  coreHp: number;
  maxCoreHp: number;
  score: number;
  bricksBroken: number;
  combo: number;
  maxCombo: number;
  ballLosses: number;
  maxBalls: number;
  totalDamage: number;
  lastDamageElapsed: number;
  reflectorBlockedHits: number;
  barrierTime: number;
  barrierCharges: number;
  bossAttackTimer: number;
  bossPattern: number;
  nextBrickId: number;
  complete: boolean;
  gameOver: boolean;
  /** Legacy enchantment counters retained during the incremental migration. */
  legacyEnchantments: Partial<Record<LegacyUpgradeId, number>>;
  echoSplitReflections: number;
  /** Presentation state mirrored by the UI adapter in canonical-only runs. */
  safetyBlocks: Array<{ x: number; y: number; width: number; color: string }>;
  ultimateAuras: Partial<Record<UpgradeId, boolean>>;
  paddleChargePulse: number;
  paddleChargeColor: string;
  coreBreakTime: number;
  coreBreakDuration: number;
  coreBreakX: number;
  coreBreakY: number;
  ghostPaddles: number[];
};

export function seededRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function paddleAimDirection(fromX: number, fromY: number, targetX: number, targetY: number) {
  const dx = targetX - fromX;
  const dy = Math.min(-MIN_AIM_VERTICAL_DISTANCE, targetY - fromY);
  const distance = Math.max(1, Math.hypot(dx, dy));
  const raw = dx / distance;
  const horizontalRatio = Math.max(-MAX_AIM_HORIZONTAL_RATIO, Math.min(MAX_AIM_HORIZONTAL_RATIO, raw));
  return { horizontalRatio, verticalRatio: -Math.sqrt(Math.max(0, 1 - horizontalRatio * horizontalRatio)), limited: Math.abs(raw) > MAX_AIM_HORIZONTAL_RATIO };
}

export function overdriveLevelAt(seconds: number) { return Math.min(MAX_OVERDRIVE_LEVEL, Math.max(0, Math.floor(seconds))); }
export function overdriveMultiplier(level: number) { return 1 + Math.max(0, Math.min(MAX_OVERDRIVE_LEVEL, level)) * OVERDRIVE_RATE_PER_SECOND; }
export function reflectWallX(x: number, radius: number) {
  const span = GAME_WIDTH - radius * 2;
  if (span <= 0) return GAME_WIDTH / 2;
  let folded = (x - radius) % (span * 2);
  if (folded < 0) folded += span * 2;
  return radius + (folded <= span ? folded : span * 2 - folded);
}

function pickCount(state: CanonicalState, id: UpgradeId) { return state.upgrades.filter((entry) => entry === id).length; }
function levelOf(state: CanonicalState, id: UpgradeId) { return Math.min(3, pickCount(state, id)); }
function skill(state: CanonicalState, id: UpgradeId) { return state.skills.find((entry) => entry.id === id); }
function evolved(state: CanonicalState, id: UpgradeId) { return Boolean(skill(state, id)?.evolution) && pickCount(state, id) >= 4; }
function skillValue(state: CanonicalState, id: UpgradeId) {
  const level = levelOf(state, id);
  const base = level ? Number(skill(state, id)?.levels[level - 1] ?? 0) : 0;
  if (!base) return 0;
  const config = skill(state, id);
  const enhancement = state.bossEnhancements[id] ?? 0;
  if (!config || enhancement <= 0) return base;
  const step = Math.max(config.direction === "down" ? 0.2 : 1, Math.abs(config.levels[2] - config.levels[1]));
  return config.direction === "down" ? Math.max(0.2, base - enhancement * step) : base + enhancement * step;
}
function lateWaveHpMultiplier(wave: number) { return wave >= 16 ? 2.5 : wave >= 11 ? 1.9 : wave >= 6 ? 1.45 : wave >= 4 ? 1.15 : 1; }

function traitFor(cell: string): CanonicalTrait {
  return cell === "g" ? "guard" : cell === "e" ? "explosive" : cell === "x" ? "indestructible" : cell === "c" ? "healer" : cell === "r" ? "reflector" : "standard";
}

function makeBrick(state: CanonicalState, x: number, y: number, w: number, h: number, hp: number, trait: CanonicalTrait, kind: CanonicalBrick["kind"], drop: CanonicalItemKind | null = null): CanonicalBrick {
  return { id: state.nextBrickId++, x, y, w, h, hp, maxHp: hp, alive: true, trait, guardReady: trait === "guard", healTimer: 3, healBlockTime: 0, burnTime: 0, burnTick: 0, traitLockTime: 0, frostVulnerability: 0, drop: trait === "indestructible" ? null : drop, kind };
}

function scheduledMultiball(wave: number) { return [2, 4, 6, 8, 11, 13, 16, 18].includes(wave); }

function buildWave(state: CanonicalState, wave: number) {
  const definition = waveDefinitionFrom(state.waves, wave);
  state.nextBrickId = 1;
  if (definition.boss) {
    const stage = definition.boss === "final" ? 4 : definition.boss === "late" ? 3 : definition.boss === "mid" ? 2 : 1;
    const hpMultiplier = [1, 0.85, 0.95, 1.05, 1.2][stage];
    const earlyBossHealthScale = stage <= 2 ? 0.4 : 1;
    const hp = Math.round((state.balance.bossBaseHp + stage * state.balance.bossHpPerStage * 0.55) * hpMultiplier * definition.hpMultiplier * 0.5 * earlyBossHealthScale);
    state.bricks = [makeBrick(state, (GAME_WIDTH - 416) / 2, 94, 416, 102, hp, "standard", "boss-core", "multiball")];
    state.bossAttackTimer = Math.max(4.4, 6 - stage * 0.3);
    state.bossPattern = 0;
    return;
  }
  const gap = 7;
  const margin = 36;
  const width = (GAME_WIDTH - margin * 2 - gap * 11) / 12;
  const baseHp = 1 + Math.floor((wave - 1) / Math.max(1, Math.round(state.balance.baseHpWaveStep)));
  const occupied = definition.pattern.flatMap((row, rowIndex) => [...row].map((cell, col) => ({ cell, rowIndex, col }))).filter((cell) => cell.cell !== ".");
  const dropCandidates = occupied.filter(({ cell }) => cell !== "x");
  const dropCell = scheduledMultiball(wave) && dropCandidates.length ? dropCandidates[Math.floor(state.random() * dropCandidates.length)] : null;
  state.bricks = occupied.map(({ cell, rowIndex, col }) => {
    const bonus = cell === "h" ? 1 + Math.floor((wave - 1) / 8) : cell === "c" ? 2 : 0;
    const hp = Math.ceil((baseHp + bonus) * lateWaveHpMultiplier(wave) * definition.hpMultiplier);
    const drop = dropCell?.rowIndex === rowIndex && dropCell.col === col ? "multiball" : state.random() < 0.055 ? (["auto-barrier", "core-repair", "cooldown-reset"] as CanonicalItemKind[])[Math.floor(state.random() * 3)] : null;
    return makeBrick(state, margin + col * (width + gap), BRICK_ROW_Y + rowIndex * BRICK_ROW_STEP, width, 24, hp, traitFor(cell), "normal", drop);
  });
}

function makeBall(state: CanonicalState, x = GAME_WIDTH / 2, temporary = false, recovering = false, temporaryTime = 0): CanonicalBall {
  const baseSpeed = Math.hypot(BASE_BALL_VX, BASE_BALL_VY);
  const speed = baseSpeed * (recovering ? 1 : overdriveMultiplier(overdriveLevelAt(state.waveElapsed)));
  const aim = paddleAimDirection(x, PLAYER_PADDLE_Y, GAME_WIDTH / 2, GAME_HEIGHT / 3);
  return { x, y: PLAYER_PADDLE_Y - 11, vx: aim.horizontalRatio * speed, vy: aim.verticalRatio * speed, radius: 8 + skillValue(state, "common-ball-size"), temporary, temporaryTime, missileTime: 0, waveBonus: temporary, visualSkill: null, visualSkillTime: 0, cooldowns: {}, skillCharges: {}, attackPower: Math.max(1, 1 + skillValue(state, "common-damage")), pierce: 0, maxPierce: 0, payload: null, payloadLevel: 0, payloads: {}, respawnRecoveryTime: recovering ? RESPAWN_SPEED_RECOVERY_SECONDS : 0, respawnRecoveryDuration: recovering ? RESPAWN_SPEED_RECOVERY_SECONDS : 0, respawnRecoveryBaseSpeed: recovering ? baseSpeed : 0 };
}
/** Common passive values are resolved by the canonical simulation so the
 * benchmark/watch bridge observes the same modifiers as normal gameplay. */
export function canonicalCommonPassiveValues(state: CanonicalState) {
  return {
    moveSpeedMultiplier: 1 + skillValue(state, "common-move-speed") / 100,
    comboScoreBonus: skillValue(state, "common-combo") / 100,
    luckChance: skillValue(state, "common-luck") / 100,
    magnetRange: skillValue(state, "common-magnet"),
    paddleWidth: Math.min(280, BASE_PADDLE_WIDTH + skillValue(state, "common-wide")),
  };
}

/**
 * Echo Split is a legacy enchantment (not a class SkillConfig entry). Keep its
 * reflection cadence explicit at the canonical boundary until the legacy
 * catalog is fully moved into the skill registry. Callers may provide a
 * catalog-resolved threshold through legacyEnchantments.echo-split; the
 * fallback values match the three legacy levels' cadence.
 */
export function canonicalEchoSplitThreshold(state: CanonicalState) {
  const level = Math.min(3, state.upgrades.filter((id) => id === "echo-split").length);
  if (!level) return 0;
  const configured = state.legacyEnchantments["echo-split"];
  if (configured && configured > 0) return configured;
  return [0, 8, 6, 4][level];
}

function cloneEchoSplitBall(state: CanonicalState, source: CanonicalBall) {
  const split = makeBall(state, source.x + (source.vx >= 0 ? -12 : 12), true, false, 0);
  split.vx = -source.vx * 0.92;
  split.vy = source.vy;
  split.attackPower = source.attackPower;
  split.pierce = source.pierce;
  split.maxPierce = source.maxPierce;
  split.payload = source.payload;
  split.payloadLevel = source.payloadLevel;
  split.payloads = { ...source.payloads };
  split.skillCharges = { ...source.skillCharges };
  split.cooldowns = { ...source.cooldowns };
  split.temporary = true;
  split.temporaryTime = Math.max(1, source.temporary ? source.temporaryTime : 4);
  return split;
}

function damageBrick(state: CanonicalState, brick: CanonicalBrick, damage: number, sourceBall: CanonicalBall, directBallHit = false) {
  if (!brick.alive || brick.trait === "indestructible") return 0;
  if (directBallHit && brick.guardReady) { brick.guardReady = false; brick.trait = "standard"; return 0; }
  const applied = Math.min(brick.hp, Math.max(0, damage));
  if (applied > 0) {
    state.totalDamage += applied;
    state.lastDamageElapsed = state.elapsed;
    // Keep ordinary ball/brick impacts visible in canonical-only runs. The
    // legacy loop used to materialize these as spark/particle feedback; emit
    // the same declarative visual at the simulation boundary instead.
    state.visualEvents.push({
      kind: "impact",
      skillId: "original" as UpgradeId,
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h / 2,
      radius: 28,
      duration: 0.28,
    });
  }
  brick.hp -= applied;
  if (brick.hp > 0) return applied;
  brick.alive = false;
  state.bricksBroken++;
  state.combo++;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.score += 100 + Math.round(applied * 12 + state.combo * 4 * (1 + skillValue(state, "common-combo") / 100));
  // Legacy parity: luck grants an extra multiball only when the brick had no
  // scheduled drop; the configured level is already expressed as a percent.
  const drop = brick.drop ?? (state.random() < skillValue(state, "common-luck") / 100 ? "multiball" : null);
  if (drop) state.items.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, vy: 120, kind: drop, alive: true });
  if (brick.trait === "explosive") {
    for (const near of state.bricks) {
      if (!near.alive || near === brick || near.trait === "indestructible") continue;
      const distance = Math.hypot(near.x + near.w / 2 - (brick.x + brick.w / 2), near.y + near.h / 2 - (brick.y + brick.h / 2));
      if (distance <= 105) damageBrick(state, near, 2, sourceBall, false);
    }
    const dx = sourceBall.x - (brick.x + brick.w / 2);
    const dy = sourceBall.y - (brick.y + brick.h / 2);
    const length = Math.max(1, Math.hypot(dx, dy));
    sourceBall.vx += dx / length * 110;
    sourceBall.vy += dy / length * 110;
  }
  return applied;
}

function recordSkill(state: CanonicalState, id: UpgradeId, damage: number, kills: number) {
  const previous = state.skillMetrics[id] ?? { activations: 0, damage: 0, kills: 0 };
  state.skillMetrics[id] = { activations: previous.activations + 1, damage: previous.damage + damage, kills: previous.kills + kills };
}

function applySkillResult(state: CanonicalState, result: SkillResult, sourceBall: CanonicalBall, targets: CanonicalBrick[]) {
  let damage = 0;
  if (result.damage) {
    for (const target of targets) {
      if (!target.alive || target.trait === "indestructible") continue;
      damage += damageBrick(state, target, result.damage, sourceBall, false);
    }
  }
  if (result.disableHealing) {
    for (const target of targets) target.healBlockTime = Math.max(target.healBlockTime, result.disableHealing);
  }
  if (result.control) {
    for (const target of targets) target.traitLockTime = Math.max(target.traitLockTime, result.control.duration);
  }
  if (result.burn) {
    for (const target of targets) {
      target.burnTime = Math.max(target.burnTime, result.burn.duration);
      target.burnTick = Math.min(target.burnTick || 1, 1);
    }
  }
  if (result.barrier) {
    state.barrierTime = Math.max(state.barrierTime, result.barrier.duration ?? 0);
    state.barrierCharges = Math.max(state.barrierCharges, result.barrier.charges ?? 0);
  }
  if (result.summon) {
    for (let i = 0; i < result.summon.count; i++) state.balls.push(makeBall(state, state.paddleX, result.summon.temporary ?? true));
  }
  return damage;
}

function triggerCollisionSkills(state: CanonicalState, ball: CanonicalBall, hit: CanonicalBrick) {
  const cooldownReduction = Math.min(0.75, skillValue(state, "common-cooldown") / 100);
  const rangeMultiplier = 1 + skillValue(state, "common-skill-range") / 100;
  for (const config of state.skills) {
    const level = levelOf(state, config.id);
    // Ultimates are dispatched through the same collision registry. Their
    // specialized visuals/effects can be layered on later without silently
    // skipping activation in the canonical simulation.
    if (!level || config.category === "common") continue;
    const remaining = ball.cooldowns[config.id] ?? 0;
    if (remaining > 0) continue;
    const cooldown = Math.max(0.2, Number(config.cooldown[level - 1] ?? 1) * (1 - cooldownReduction));
    ball.cooldowns[config.id] = cooldown;
    ball.visualSkill = config.id;
    ball.visualSkillTime = Math.max(ball.visualSkillTime, 0.42);
    let damage = 0;
    let kills = 0;
    const result: SkillResult = {};
    const radius = (config.category === "warrior" ? 105 : config.category === "mage" ? 125 : 85) * rangeMultiplier;
    const targets = state.bricks.filter((brick) => brick.alive && brick.trait !== "indestructible").sort((a, b) => Math.hypot(a.x - hit.x, a.y - hit.y) - Math.hypot(b.x - hit.x, b.y - hit.y));
    const count = Math.max(1, 1 + Math.floor(skillValue(state, "common-chain")) + (evolved(state, config.id) ? 1 : 0));
    if (config.id === "mage-fireball") {
      const duration = Number(config.levels[level - 1] ?? 0);
      result.disableHealing = duration;
      if (evolved(state, config.id)) result.burn = { duration, damage: 1 };
      const affected = targets.filter((target) => Math.hypot(target.x - hit.x, target.y - hit.y) <= radius).slice(0, count + 2);
      damage += applySkillResult(state, result, ball, affected);
    } else if (config.id === "warrior-guard") {
      // Guard is a timed, single-use CORE barrier.  Refreshing the skill
      // extends its window but never silently grants more than one charge.
      result.barrier = { duration: Number(config.levels[level - 1] ?? 4), charges: 1 };
      applySkillResult(state, result, ball, []);
    } else if (config.id === "archer-rapid") {
      result.summon = { count: 2, temporary: true };
      applySkillResult(state, result, ball, []);
      for (const spawned of state.balls.slice(-2)) spawned.temporaryTime = Number(config.levels[level - 1] ?? 4.75);
    } else if (config.id === "archer-pierce") {
      // A prepared ball receives the configured consecutive penetration count.
      const pierceCount = Math.max(1, Math.round(Number(config.levels[level - 1] ?? 1)));
      ball.maxPierce = Math.max(ball.maxPierce, pierceCount);
      ball.pierce = Math.max(ball.pierce, pierceCount);
    } else if (config.id === "archer-ricochet") {
      const ricochetCount = Math.max(1, Math.round(Number(config.levels[level - 1] ?? 1)));
      const affected = targets.filter((target) => target !== hit && Math.hypot(target.x - hit.x, target.y - hit.y) <= radius).slice(0, ricochetCount);
      result.damage = Math.max(1, ball.attackPower);
      applySkillResult(state, result, ball, affected);
    } else if (config.id === "mage-lightning") {
      // Legacy parity: lightning always chains to 2/3/4 nearby targets.
      const chainCount = Math.max(1, Math.round(Number(config.levels[level - 1] ?? 1)));
      const affected = targets.filter((target) => Math.hypot(target.x - hit.x, target.y - hit.y) <= radius).slice(0, chainCount);
      for (const target of affected) {
        const wasAlive = target.alive;
        const dealt = damageBrick(state, target, Math.max(1, 1 + level), ball);
        damage += dealt;
        if (wasAlive && !target.alive) kills++;
      }
    } else if (config.id === "mage-freeze") {
      // The mark is consumed by the next direct hit for bonus damage and
      // seals healer/reflector behavior for the configured duration.
      const frostDamage = Math.max(1, Math.round(Number(config.levels[level - 1] ?? level)));
      result.control = { duration: 2 + level, kind: "freeze" };
      const affected = targets.filter((target) => Math.hypot(target.x - hit.x, target.y - hit.y) <= radius).slice(0, count);
      for (const target of affected) {
        target.frostVulnerability = Math.max(target.frostVulnerability, frostDamage);
        target.traitLockTime = Math.max(target.traitLockTime, 2 + level);
      }
    } else if (config.id === "mage-mana-blast") {
      const duration = Math.max(1, Math.round(Number(config.levels[level - 1] ?? 1)));
      result.control = { duration, kind: "mana-seal" };
      const affected = targets.filter((target) => Math.hypot(target.x - hit.x, target.y - hit.y) <= radius).slice(0, count);
      for (const target of affected) target.traitLockTime = Math.max(target.traitLockTime, duration);
      if (evolved(state, config.id)) result.damage = 1;
      applySkillResult(state, result, ball, affected);
    } else if (config.id === "mage-black-hole") {
      // Radius is a skill value (and therefore includes boss enhancements),
      // while the evolved DPS scales with the player's passive damage.
      const radius = Math.max(40, skillValue(state, config.id) * rangeMultiplier);
      const next = { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2, radius, life: 4, damagePerSecond: evolved(state, config.id) ? Math.max(1, 1 + skillValue(state, "common-damage") + (state.bossEnhancements[config.id] ?? 0)) : 0, damageTick: 1 };
      if (state.gravityWells[0]) Object.assign(state.gravityWells[0], next);
      else state.gravityWells.push(next);
      state.visualEvents.push({ kind: "skill", skillId: config.id, x: next.x, y: next.y, radius, duration: next.life, color: config.color });
    } else if (config.id === "warrior-earthquake") {
      const affected = targets.filter((target) => Math.hypot(target.x - hit.x, target.y - hit.y) <= radius).slice(0, count + level);
      result.damage = Math.max(1, 1 + level + skillValue(state, "common-damage"));
      damage += applySkillResult(state, result, ball, affected);
      state.visualEvents.push({ kind: "ultimate", skillId: config.id, x: hit.x + hit.w / 2, y: hit.y + hit.h / 2, radius, duration: 0.9, color: config.color });
    } else if (config.id === "warrior-berserker") {
      // Berserker is a permanent amplifier; each triggered dispatch also
      // emits an impact and applies its level-scaled burst to nearby bricks.
      ball.skillCharges[config.id] = level;
      ball.attackPower = Math.max(ball.attackPower, 4 + level + skillValue(state, "common-damage"));
      result.damage = Math.max(1, level + 2);
      damage += applySkillResult(state, result, ball, [hit]);
      state.visualEvents.push({ kind: "ultimate", skillId: config.id, x: ball.x, y: ball.y, radius: 72 + level * 8, duration: 0.8, color: config.color });
    } else if (config.id === "archer-arrow-rain") {
      const affected = targets.slice(0, Math.max(1, Math.round(skillValue(state, config.id))));
      result.damage = Math.max(1, 1 + level + skillValue(state, "common-damage"));
      damage += applySkillResult(state, result, ball, affected);
      state.visualEvents.push({ kind: "ultimate", skillId: config.id, x: GAME_WIDTH / 2, y: BRICK_ROW_Y, radius: GAME_WIDTH - 80, duration: 0.85, color: config.color });
    } else if (config.id === "archer-infinite") {
      result.summon = { count: 3, temporary: true };
      applySkillResult(state, result, ball, []);
      for (const spawned of state.balls.slice(-3)) spawned.temporaryTime = Math.max(1, skillValue(state, config.id));
      state.visualEvents.push({ kind: "ultimate", skillId: config.id, x: state.paddleX, y: PLAYER_PADDLE_Y - 24, radius: 88 + level * 8, duration: 0.85, color: config.color });
    } else if (config.id === "mage-elemental-storm") {
      const affected = targets.slice(0, Math.max(1, Math.round(skillValue(state, config.id))));
      result.damage = Math.max(1, level);
      result.control = { duration: 2 + level, kind: "freeze" };
      result.burn = { duration: 4, damage: Math.max(1, level) };
      damage += applySkillResult(state, result, ball, affected);
      state.visualEvents.push({ kind: "ultimate", skillId: config.id, x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, radius: 210, duration: 1.1, color: config.color });
    } else if (config.id === "mage-meteor") {
      const afflicted = targets.filter((target) => target.burnTime > 0 || target.frostVulnerability > 0 || target.traitLockTime > 0);
      const affected = (afflicted.length ? afflicted : targets).slice(0, 1 + Math.floor(afflicted.length / 4));
      result.damage = Math.max(1, Math.round(skillValue(state, config.id)));
      damage += applySkillResult(state, result, ball, affected);
      state.visualEvents.push({ kind: "ultimate", skillId: config.id, x: hit.x + hit.w / 2, y: hit.y, radius: 120 + level * 15, duration: 0.95, color: config.color });
    } else {
      for (const target of targets.filter((target) => Math.hypot(target.x - hit.x, target.y - hit.y) <= radius).slice(0, count)) {
        const wasAlive = target.alive;
        damage += damageBrick(state, target, Math.max(1, Math.round(Number(config.levels[level - 1] ?? level))), ball);
        if (wasAlive && !target.alive) kills++;
      }
    }
    // Keep all contract fields on a single post-processing path. Existing
    // specialized branches still mutate their richer state directly, while
    // generic and future runtimes can return effects without losing them.
    const effectTargets = targets.filter((target) => Math.hypot(target.x - hit.x, target.y - hit.y) <= radius).slice(0, count);
    // Specialized branches may have consumed the result already; applying it
    // again is harmless for idempotent timers but would duplicate damage.
    if (config.id !== "mage-fireball" && config.id !== "mage-mana-blast" && config.id !== "mage-black-hole" && config.id !== "warrior-earthquake" && config.id !== "warrior-berserker" && config.id !== "archer-arrow-rain" && config.id !== "archer-infinite" && config.id !== "mage-elemental-storm" && config.id !== "mage-meteor") damage += applySkillResult(state, result, ball, effectTargets);
    recordSkill(state, config.id, damage, kills);
  }
}

function circleRect(ball: CanonicalBall, brick: CanonicalBrick) {
  const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
  const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  if (dx * dx + dy * dy > ball.radius * ball.radius) return null;
  if (Math.abs(dx) > Math.abs(dy)) return { nx: Math.sign(dx) || 1, ny: 0 };
  return { nx: 0, ny: Math.sign(dy) || 1 };
}

function normalizeBallAngle(ball: CanonicalBall) {
  const speed = Math.max(1, Math.hypot(ball.vx, ball.vy));
  const minimum = speed * MIN_VERTICAL_SPEED_RATIO;
  if (Math.abs(ball.vy) >= minimum) return;
  const sign = ball.vy < 0 ? -1 : 1;
  ball.vy = sign * minimum;
  ball.vx = (ball.vx < 0 ? -1 : 1) * Math.sqrt(Math.max(1, speed * speed - minimum * minimum));
}

function bossReinforcements(state: CanonicalState) {
  const gap = 7;
  const margin = 36;
  const width = (GAME_WIDTH - margin * 2 - gap * 11) / 12;
  const definition = waveDefinitionFrom(state.waves, state.wave);
  const stage = definition.boss === "final" ? 4 : definition.boss === "late" ? 3 : definition.boss === "mid" ? 2 : 1;
  const patterns: Array<Array<[number, number, CanonicalTrait]>> = stage === 1
    ? [[[2, 0, "standard"], [3, 1, "guard"], [8, 1, "guard"], [9, 0, "standard"]], [[5, 0, "explosive"], [6, 1, "standard"]]]
    : stage === 2
      ? [[[1, 0, "standard"], [4, 1, "explosive"], [7, 0, "standard"], [10, 1, "explosive"]], [[2, 1, "guard"], [3, 0, "standard"], [8, 0, "standard"], [9, 1, "guard"]]]
      : stage === 3
        ? [[[0, 0, "reflector"], [2, 1, "guard"], [5, 0, "healer"], [9, 1, "guard"], [11, 0, "reflector"]], [[1, 0, "explosive"], [4, 1, "guard"], [7, 1, "guard"], [10, 0, "explosive"]]]
        : [[[0, 0, "reflector"], [3, 1, "guard"], [5, 0, "healer"], [6, 1, "healer"], [8, 1, "guard"], [11, 0, "reflector"]], [[1, 1, "explosive"], [4, 0, "guard"], [7, 0, "guard"], [10, 1, "explosive"]]];
  for (const [col, row, trait] of patterns[state.bossPattern++ % patterns.length]) {
    if (state.bricks.some((brick) => brick.alive && Math.abs(brick.x - (margin + col * (width + gap))) < 2 && Math.abs(brick.y - (214 + row * BRICK_ROW_STEP)) < 2)) continue;
    state.bricks.push(makeBrick(state, margin + col * (width + gap), 214 + row * BRICK_ROW_STEP, width, 24, Math.min(3, Math.max(1, stage - 1)), trait, "boss-minion"));
  }
}

function completeWave(state: CanonicalState) {
  const definition = waveDefinitionFrom(state.waves, state.wave);
  state.waveMetrics.push({ wave: state.wave, elapsed: state.elapsed, clearTime: state.waveElapsed, balls: state.balls.length, coreHp: state.coreHp, aliveBricks: state.bricks.filter((brick) => brick.alive).length, brickHp: 0, score: state.score, bossActive: Boolean(definition.boss), skillChoices: state.skillHistory.filter((event) => event.wave === state.wave).map((event) => event.skillId) });
  if (state.wave >= state.targetWave) { state.complete = true; return; }
  state.wave++;
  state.waveElapsed = 0;
  state.paddleX = GAME_WIDTH / 2;
  state.balls = [makeBall(state, state.paddleX)];
  state.items = [];
  state.gravityWells = [];
  state.visualEvents = [];
  state.barrierTime = 0;
  state.barrierCharges = 0;
  buildWave(state, state.wave);
}

export function createCanonicalState(options: { seed: number; targetWave?: number; balance?: BalanceConfig; skills?: SkillConfig[]; waves?: WaveDefinition[]; legacyEnchantments?: Partial<Record<LegacyUpgradeId, number>> }): CanonicalState {
  const state: CanonicalState = {
    seed: options.seed, random: seededRandom(options.seed), balance: { ...DEFAULT_BALANCE_CONFIG, ...options.balance }, skills: options.skills?.length ? options.skills : DEFAULT_SKILLS, waves: options.waves?.length === WAVE_DEFINITIONS.length ? options.waves : WAVE_DEFINITIONS, targetWave: options.targetWave ?? 20,
    wave: 1, waveElapsed: 0, elapsed: 0, paddleX: GAME_WIDTH / 2, paddleWidth: BASE_PADDLE_WIDTH, balls: [], bricks: [], items: [], gravityWells: [], visualEvents: [], upgrades: [], bossEnhancements: {}, legacyEnchantments: { ...(options.legacyEnchantments ?? {}) }, echoSplitReflections: 0, safetyBlocks: [], ultimateAuras: {}, paddleChargePulse: 0, paddleChargeColor: "#ffffff", coreBreakTime: 0, coreBreakDuration: 0, coreBreakX: GAME_WIDTH / 2, coreBreakY: PLAYER_PADDLE_Y + 36, ghostPaddles: [], skillHistory: [], skillMetrics: {}, waveMetrics: [], coreHp: 8, maxCoreHp: 8, ballLosses: 0, maxBalls: 1, totalDamage: 0, lastDamageElapsed: 0, reflectorBlockedHits: 0, barrierTime: 0, barrierCharges: 0, bossAttackTimer: 0, bossPattern: 0, nextBrickId: 1, complete: false, gameOver: false,
  };
  buildWave(state, 1);
  state.balls = [makeBall(state)];
  return state;
}

export function grantCanonicalSkill(state: CanonicalState, skillId: UpgradeId, source: CanonicalSkillEvent["source"], ballCost: 0 | 1 | 2 = 0) {
  const config = skill(state, skillId);
  const maxPicks = config?.evolution ? 4 : 3;
  if (pickCount(state, skillId) >= maxPicks) return false;
  const previousLevel = levelOf(state, skillId);
  state.upgrades.push(skillId);
  const nextLevel = levelOf(state, skillId);
  state.skillHistory.push({ wave: state.wave, skillId, level: nextLevel, evolved: evolved(state, skillId), source, ballCost });
  if (skillId === "common-xp") {
    const config = skill(state, skillId);
    const gain = Number(config?.levels[nextLevel - 1] ?? 0) - Number(config?.levels[previousLevel - 1] ?? 0);
    state.maxCoreHp += gain;
    state.coreHp += gain;
  }
  state.paddleWidth = Math.min(280, BASE_PADDLE_WIDTH + skillValue(state, "common-wide"));
  return true;
}

export function grantCanonicalEnhancement(state: CanonicalState, skillId: UpgradeId) {
  if (!state.upgrades.includes(skillId)) return false;
  state.bossEnhancements[skillId] = (state.bossEnhancements[skillId] ?? 0) + 1;
  state.skillHistory.push({ wave: state.wave, skillId, level: levelOf(state, skillId), source: "boss" });
  return true;
}

export function stepCanonicalEngine(state: CanonicalState, controls: CanonicalControls, dt = FIXED_STEP_SECONDS) {
  if (state.complete || state.gameOver) return;
  // Keep externally visible metrics safe even if a malformed optional skill
  // result/config reaches the simulation. A NaN score would poison HUD,
  // benchmark records, and subsequent comparisons.
  if (!Number.isFinite(state.score)) state.score = 0;
  state.visualEvents = [];
  const step = Math.max(0, Math.min(FIXED_STEP_SECONDS, dt));
  state.elapsed += step;
  state.waveElapsed += step;
  state.barrierTime = Math.max(0, state.barrierTime - step);
  const moveMultiplier = 1 + skillValue(state, "common-move-speed") / 100;
  state.paddleX = Math.max(state.paddleWidth / 2, Math.min(GAME_WIDTH - state.paddleWidth / 2, state.paddleX + controls.move * PADDLE_SPEED * moveMultiplier * step));
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    brick.healBlockTime = Math.max(0, brick.healBlockTime - step);
    brick.traitLockTime = Math.max(0, brick.traitLockTime - step);
    brick.frostVulnerability = Math.max(0, brick.frostVulnerability - step);
    if (brick.trait === "healer" && brick.traitLockTime <= 0) {
      brick.healTimer -= step;
      if (brick.healTimer <= 0) {
        brick.healTimer += 3;
        for (const near of state.bricks) if (near.alive && near !== brick && near.healBlockTime <= 0 && Math.hypot(near.x - brick.x, near.y - brick.y) < 120) near.hp = Math.min(near.maxHp, near.hp + 1);
      }
    }
    if (brick.burnTime > 0) {
      brick.burnTime -= step;
      brick.burnTick -= step;
      if (brick.burnTick <= 0) { brick.burnTick += 1; damageBrick(state, brick, 1, state.balls[0], false); }
    }
  }
  for (const well of state.gravityWells) {
    well.life -= step;
    well.damageTick -= step;
    if (well.damagePerSecond <= 0 || well.damageTick > 0) continue;
    well.damageTick += 1;
    for (const brick of state.bricks) {
      if (!brick.alive || brick.trait === "indestructible") continue;
      if (Math.hypot(brick.x + brick.w / 2 - well.x, brick.y + brick.h / 2 - well.y) <= well.radius) damageBrick(state, brick, well.damagePerSecond, state.balls[0], false);
    }
  }
  state.gravityWells = state.gravityWells.filter((well) => well.life > 0);
  if (waveDefinitionFrom(state.waves, state.wave).boss) {
    state.bossAttackTimer -= step;
    if (state.bossAttackTimer <= 0) { bossReinforcements(state); state.bossAttackTimer = Math.max(2.6, state.balance.bossAttackInterval - (state.wave >= 20 ? 2 : 1) * state.balance.bossAttackAcceleration); }
  }
  for (const item of state.items) {
    if (!item.alive) continue;
    item.y += item.vy * step;
    const magnetRange = skillValue(state, "common-magnet");
    if (magnetRange > 0 && Math.hypot(item.x - state.paddleX, item.y - PLAYER_PADDLE_Y) <= magnetRange) {
      item.x += (state.paddleX - item.x) * Math.min(1, step * 9);
    }
    if (item.y >= PLAYER_PADDLE_Y - 8 && item.y <= PLAYER_PADDLE_Y + 22 && Math.abs(item.x - state.paddleX) <= state.paddleWidth / 2) {
      item.alive = false;
      if (item.kind === "multiball") state.balls.push(makeBall(state, state.paddleX, true));
      else if (item.kind === "auto-barrier") { state.barrierTime = 10; state.barrierCharges = 1; }
      else if (item.kind === "core-repair") state.coreHp = Math.min(state.maxCoreHp, state.coreHp + 1);
      else for (const ball of state.balls) ball.cooldowns = {};
    } else if (item.y > GAME_HEIGHT + 20) item.alive = false;
  }
  state.items = state.items.filter((item) => item.alive);
  const overdrive = overdriveMultiplier(overdriveLevelAt(state.waveElapsed));
  for (const ball of [...state.balls]) {
    ball.visualSkillTime = Math.max(0, ball.visualSkillTime - step);
    if (ball.visualSkillTime <= 0) ball.visualSkill = null;
    ball.missileTime = Math.max(0, ball.missileTime - step);
    if (ball.temporary && ball.temporaryTime > 0) {
      ball.temporaryTime = Math.max(0, ball.temporaryTime - step);
      if (ball.temporaryTime <= 0) { state.balls.splice(state.balls.indexOf(ball), 1); continue; }
    }
    for (const id of Object.keys(ball.cooldowns)) ball.cooldowns[id] = Math.max(0, ball.cooldowns[id] - step);
    if (ball.respawnRecoveryTime > 0) {
      ball.respawnRecoveryTime = Math.max(0, ball.respawnRecoveryTime - step);
      const progress = 1 - ball.respawnRecoveryTime / Math.max(0.001, ball.respawnRecoveryDuration);
      const easedProgress = progress * progress * (3 - progress * 2);
      const desiredSpeed = ball.respawnRecoveryBaseSpeed * (1 + (overdrive - 1) * easedProgress);
      const currentSpeed = Math.max(1, Math.hypot(ball.vx, ball.vy));
      ball.vx *= desiredSpeed / currentSpeed;
      ball.vy *= desiredSpeed / currentSpeed;
    }
    const well = state.gravityWells.find((entry) => Math.hypot(entry.x - ball.x, entry.y - ball.y) < entry.radius);
    if (well) {
      const dx = well.x - ball.x;
      const dy = well.y - ball.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const speed = Math.max(1, Math.hypot(ball.vx, ball.vy));
      const inwardX = dx / distance;
      const inwardY = dy / distance;
      let tangentX = -inwardY;
      let tangentY = inwardX;
      if (ball.vx * tangentX + ball.vy * tangentY < 0) { tangentX *= -1; tangentY *= -1; }
      const orbitRadius = well.radius * 0.46;
      const correction = Math.max(-0.72, Math.min(0.72, (distance - orbitRadius) / Math.max(1, orbitRadius)));
      const targetX = tangentX + inwardX * correction;
      const targetY = tangentY + inwardY * correction;
      const length = Math.max(0.001, Math.hypot(targetX, targetY));
      ball.vx = targetX / length * speed;
      ball.vy = targetY / length * speed;
    }
    ball.x += ball.vx * step;
    ball.y += ball.vy * step;
    if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); }
    if (ball.x + ball.radius > GAME_WIDTH) { ball.x = GAME_WIDTH - ball.radius; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.radius < 0) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); }
    if (ball.vy > 0 && ball.y + ball.radius >= PLAYER_PADDLE_Y && ball.y - ball.radius <= PLAYER_PADDLE_Y + 18 && Math.abs(ball.x - state.paddleX) <= state.paddleWidth / 2 + ball.radius) {
      ball.y = PLAYER_PADDLE_Y - ball.radius - 0.1;
      const speed = ball.respawnRecoveryTime > 0 ? Math.max(300, Math.hypot(ball.vx, ball.vy)) : Math.max(300, Math.hypot(BASE_BALL_VX, BASE_BALL_VY) * overdrive);
      const aim = paddleAimDirection(state.paddleX, PLAYER_PADDLE_Y, controls.aimX, controls.aimY);
      ball.vx = aim.horizontalRatio * speed;
      ball.vy = aim.verticalRatio * speed;
      state.combo = 0;
      const echoThreshold = canonicalEchoSplitThreshold(state);
      if (echoThreshold > 0 && ++state.echoSplitReflections >= echoThreshold) {
        state.echoSplitReflections = 0;
        state.balls.push(cloneEchoSplitBall(state, ball));
        state.visualEvents.push({ kind: "skill", skillId: "echo-split" as UpgradeId, x: state.paddleX, y: PLAYER_PADDLE_Y, radius: 68, duration: 0.6, color: "#fff27a" });
      }
    }
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      const collision = circleRect(ball, brick);
      if (!collision) continue;
      const protectedUnderside = brick.trait === "reflector" && brick.traitLockTime <= 0 && collision.ny > 0 && ball.vy < 0;
      if (!protectedUnderside) {
        const baseDamage = Math.max(1, 1 + skillValue(state, "common-damage") + Math.max(0, brick.frostVulnerability));
        brick.frostVulnerability = 0;
        const guardWasReady = brick.guardReady;
        damageBrick(state, brick, baseDamage, ball, true);
        if (ball.pierce > 0) ball.pierce--;
        if (!guardWasReady) triggerCollisionSkills(state, ball, brick);
      } else state.reflectorBlockedHits++;
      if (collision.nx) ball.vx = collision.nx * Math.abs(ball.vx); else ball.vy = collision.ny * Math.abs(ball.vy);
      ball.x += collision.nx * 1.5;
      ball.y += collision.ny * 1.5;
      normalizeBallAngle(ball);
      break;
    }
    if (ball.y - ball.radius > GAME_HEIGHT) {
      if (state.barrierTime > 0 && state.barrierCharges > 0) { state.barrierCharges--; ball.y = GAME_HEIGHT - ball.radius; ball.vy = -Math.abs(ball.vy); }
      else state.balls.splice(state.balls.indexOf(ball), 1);
    }
  }
  if (!state.balls.length) {
    state.ballLosses++;
    state.coreHp--;
    if (state.coreHp <= 0) state.gameOver = true;
    else state.balls = [makeBall(state, state.paddleX, false, true)];
  }
  state.maxBalls = Math.max(state.maxBalls, state.balls.length);
  if (!state.bricks.some((brick) => brick.alive && brick.trait !== "indestructible")) completeWave(state);
}

export function canonicalSnapshot(state: CanonicalState) {
  return {
    wave: state.wave, elapsed: Number(state.elapsed.toFixed(6)), waveElapsed: Number(state.waveElapsed.toFixed(6)), paddleX: Number(state.paddleX.toFixed(4)), coreHp: state.coreHp, score: Number.isFinite(state.score) ? state.score : 0, bricksBroken: state.bricksBroken,
    balls: state.balls.map((ball) => ({ x: Number(ball.x.toFixed(4)), y: Number(ball.y.toFixed(4)), vx: Number(ball.vx.toFixed(4)), vy: Number(ball.vy.toFixed(4)), attackPower: ball.attackPower, pierce: ball.pierce, maxPierce: ball.maxPierce, payload: ball.payload, payloadLevel: ball.payloadLevel, payloads: { ...ball.payloads }, skillCharges: { ...ball.skillCharges }, cooldowns: { ...ball.cooldowns } })),
    bricks: state.bricks.filter((brick) => brick.alive).map((brick) => [brick.id, Number(brick.hp.toFixed(3)), brick.guardReady, Number(brick.traitLockTime.toFixed(3)), Number(brick.frostVulnerability.toFixed(3))]),
    upgrades: [...state.upgrades], skillHistory: state.skillHistory.map((event) => ({ ...event })), complete: state.complete, gameOver: state.gameOver, totalDamage: Number(state.totalDamage.toFixed(3)), lastDamageElapsed: Number(state.lastDamageElapsed.toFixed(3)), reflectorBlockedHits: state.reflectorBlockedHits, barrierTime: Number(state.barrierTime.toFixed(3)), barrierCharges: state.barrierCharges, echoSplitReflections: state.echoSplitReflections,
    safetyBlocks: state.safetyBlocks.map((block) => ({ ...block })), ultimateAuras: { ...state.ultimateAuras }, paddleChargePulse: state.paddleChargePulse, paddleChargeColor: state.paddleChargeColor, coreBreakTime: state.coreBreakTime, coreBreakDuration: state.coreBreakDuration, coreBreakX: state.coreBreakX, coreBreakY: state.coreBreakY, ghostPaddles: [...state.ghostPaddles],
  };
}
