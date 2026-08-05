import { DEFAULT_BALANCE_CONFIG, type BalanceConfig, type BotWaveSample } from "./balance-config";
import { DEFAULT_SKILLS, SKILL_MECHANIC_LABELS, type LegacyUpgradeId, type SkillConfig, type SkillDamageType, type SkillTrait, type UpgradeId } from "./skill-config";
import { WAVE_DEFINITIONS, waveDefinitionFrom, type WaveDefinition } from "./wave-config";
import { circleRectangleCollision, sweptPaddleContact } from "./collision-physics";
import type { GameEvent } from "./game-events";
import type { Upgrade, UpgradeChoice } from "./_types/game";

export const ENGINE_VERSION = "canonical-command-contract-v17-trait-values" as const;
export const ENGINE_PARITY = "canonical-semantic-events-projection" as const;
export const POLICY_VERSION = "predictive-controls-v12-focused-builds" as const;
export const FIXED_STEP_SECONDS = 1 / 120;
const EXPLOSION_BOOST_DURATION = 1.25;
const EXPLOSION_BOOST_MULTIPLIER = 1.18;
const EXPLOSION_BOOST_MAX_BONUS = 110;
const EXPLOSION_RADIUS = 112;
export const GAME_WIDTH = 900;
export const GAME_HEIGHT = 600;
export const PLAYER_PADDLE_Y = GAME_HEIGHT - 70;
export const PLAYER_LINE_Y = GAME_HEIGHT - 84;
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
export type CanonicalInput = CanonicalControls;
export type CanonicalPhase =
  | "awaiting-start-skill"
  | "running"
  | "wave-cleared"
  | "awaiting-wave-skill"
  | "awaiting-boss-reward"
  | "ready-for-next-wave"
  | "complete"
  | "game-over";
export type CanonicalOutcome =
  | { type: "running" }
  | { type: "start-skill"; choices: UpgradeChoice[]; rerollsLeft: number }
  | { type: "wave-clear"; wave: number; boss: boolean }
  | { type: "wave-skill"; choices: UpgradeChoice[]; rerollsLeft: number }
  | { type: "boss-reward"; choices: UpgradeId[] }
  | { type: "ready-for-next-wave"; wave: number }
  | { type: "complete" }
  | { type: "game-over"; reason: "ball" | "core" };
export type CanonicalCommand =
  | { type: "choose-start-skill"; skillId: UpgradeId; ballCost: 0 | 1 | 2 }
  | { type: "choose-wave-skill"; skillId: UpgradeId; ballCost: 0 | 1 | 2 }
  | { type: "reroll-skills" }
  | { type: "skip-wave-skill" }
  | { type: "acknowledge-wave-clear" }
  | { type: "choose-boss-reward"; skillId: UpgradeId }
  | { type: "start-next-wave" };
export type CanonicalStepResult = { outcome: CanonicalOutcome; events: GameEvent[] };
export type DamageType = "physical" | "magic";
export type DamageDelivery = "ball" | "skill" | "dot" | "skill-projectile" | "environment";
export type DamagePacket = {
  amount: number;
  damageType: DamageType;
  delivery: DamageDelivery;
  sourceBall?: CanonicalBall;
  sourceSkillId?: UpgradeId;
  respectGuard?: boolean;
};
export type DamageReceipt = { requested: number; applied: number; guardBroken: boolean; killed: boolean };
export type CanonicalCombatStats = { physicalPower: number; magicPower: number };
export type CanonicalRunConfig = {
  balance: BalanceConfig;
  skills: SkillConfig[];
  waves: WaveDefinition[];
  targetWave: number;
  startingSkills: UpgradeId[];
};
export type CanonicalRngState = { world: number; reward: number };
/** Step policy is explicit so parity runs can use the legacy variable frame
 * delta while production fixed-step runs retain their bounded 120Hz tick. */
export type CanonicalStepOptions = { clampToFixedStep?: boolean };
export type CanonicalBall = { x: number; y: number; vx: number; vy: number; radius: number; temporary: boolean; temporaryTime: number; missileTime: number; waveBonus: boolean; visualSkill: UpgradeId | null; visualSkillTime: number; cooldowns: Record<string, number>; skillCharges: Partial<Record<UpgradeId, number>>; attackPower: number; pierce: number; maxPierce: number; payload: CanonicalPayloadId | null; payloadLevel: number; payloads: Partial<Record<CanonicalPayloadId, number>>; canTriggerSkills: boolean; skillGeneration: number; lastHitBrickId: number | null; gravityBaseSpeed: number | null; explosionBaseSpeed: number | null; explosionBoostRatio: number; explosionBoostTime: number; respawnRecoveryTime: number; respawnRecoveryDuration: number; respawnRecoveryBaseSpeed: number };
export type CanonicalBrick = { id: number; x: number; y: number; w: number; h: number; hp: number; maxHp: number; alive: boolean; trait: CanonicalTrait; guardReady: boolean; healTimer: number; healBlockTime: number; burnTime: number; burnTick: number; burnDamage: number; burnDamageType: SkillDamageType; burnSourceSkillId: UpgradeId | null; poisonTime: number; poisonTick: number; traitLockTime: number; frostVulnerability: number; frostSourceSkillId: UpgradeId | null; drop: CanonicalItemKind | null; kind: "normal" | "boss-core" | "boss-minion" };
export type CanonicalItem = { x: number; y: number; vy: number; kind: CanonicalItemKind; alive: boolean };
export type CanonicalGravityWell = { x: number; y: number; radius: number; life: number; damagePerSecond: number; damageType: SkillDamageType; damageTick: number; sourceSkillId: UpgradeId };
export type CanonicalVisualEvent = {
  kind: "skill" | "impact";
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
  damageType?: SkillDamageType;
  control?: { duration: number; kind?: string };
  barrier?: { duration?: number; charges?: number; stackable?: boolean };
  pierce?: number;
  burn?: { duration: number; damage: number };
  disableHealing?: number;
  summon?: { count: number; temporary?: boolean };
};
export type CanonicalSkillEffect = { type: "damage" | "control" | "barrier" | "pierce" | "burn" | "disable-healing" | "summon"; value: unknown };
export function normalizeCanonicalSkillResult(result: SkillResult): CanonicalSkillEffect[] {
  const effects: CanonicalSkillEffect[] = [];
  if (result.damage !== undefined) effects.push({ type: "damage", value: result.damage });
  if (result.control) effects.push({ type: "control", value: result.control });
  if (result.barrier) effects.push({ type: "barrier", value: result.barrier });
  if (result.pierce !== undefined) effects.push({ type: "pierce", value: result.pierce });
  if (result.burn) effects.push({ type: "burn", value: result.burn });
  if (result.disableHealing !== undefined) effects.push({ type: "disable-healing", value: result.disableHealing });
  if (result.summon) effects.push({ type: "summon", value: result.summon });
  return effects;
}
export type CanonicalItemEffect = { type: CanonicalItemKind; value: number };
export function normalizeCanonicalItemEffect(kind: CanonicalItemKind, amount = 1): CanonicalItemEffect { return { type: kind, value: amount }; }
export type CanonicalWaveOutcome = { type: "wave-clear" | "reward" | "complete" | "game-over"; wave: number; rewardIds: string[] };
export function normalizeCanonicalWaveOutcome(type: CanonicalWaveOutcome["type"], wave: number, rewardIds: string[] = []): CanonicalWaveOutcome { return { type, wave, rewardIds: [...rewardIds] }; }
export type CanonicalWaveMetric = BotWaveSample & { clearTime: number; skillChoices: UpgradeId[] };
export type CanonicalState = {
  seed: number;
  rng: CanonicalRngState;
  runConfig: CanonicalRunConfig;
  tick: number;
  eventSequence: number;
  phase: CanonicalPhase;
  interactive: boolean;
  pendingChoices: UpgradeChoice[];
  pendingBossChoices: UpgradeId[];
  rerollsLeft: number;
  pendingWave: number | null;
  clearedWave: number | null;
  clearedBoss: boolean;
  gameOverReason: "ball" | "core" | null;
  /** Cleared after every step/command; excluded from snapshots and persistence. */
  stepEvents: GameEvent[];
  balance: BalanceConfig;
  skills: SkillConfig[];
  waves: WaveDefinition[];
  targetWave: number;
  wave: number;
  waveElapsed: number;
  /** Legacy temporal fields retained for exact parity snapshots. */
  rowTimer: number;
  itemBarrierTime: number;
  overdriveLevel: number;
  elapsed: number;
  paddleX: number;
  paddleWidth: number;
  lastMove: -1 | 0 | 1;
  moveBoostTime: number;
  balls: CanonicalBall[];
  bricks: CanonicalBrick[];
  items: CanonicalItem[];
  gravityWells: CanonicalGravityWell[];
  upgrades: UpgradeId[];
  bossEnhancements: Partial<Record<UpgradeId, number>>;
  skillHistory: CanonicalSkillEvent[];
  skillMetrics: Partial<Record<UpgradeId, { activations: number; damage: number; kills: number }>>;
  sharedSkillCooldowns: Partial<Record<UpgradeId, number>>;
  combatStats: CanonicalCombatStats;
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
  physicalDamage: number;
  magicDamage: number;
  lastDamageElapsed: number;
  reflectorBlockedHits: number;
  barrierTime: number;
  barrierCharges: number;
  bossAttackTimer: number;
  bossPattern: number;
  lastShotTimer: number;
  nextBrickId: number;
  complete: boolean;
  gameOver: boolean;
  /** Legacy enchantment counters retained during the incremental migration. */
  legacyEnchantments: Partial<Record<LegacyUpgradeId, number>>;
  echoSplitReflections: number;
  /** Gameplay barrier geometry used for collision and projected for rendering. */
  safetyBlocks: Array<{ x: number; y: number; width: number; color: string }>;
  ghostPaddles: number[];
  ghostPaddleWidths?: number[];
  ghostPaddleSpeeds?: number[];
  ghostPaddleActive?: boolean[];
  ghostPaddleUpgrades?: UpgradeId[][];
};

export function seededRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = nextRandomState(state);
    return randomValue(state);
  };
}

function nextRandomState(state: number) {
  return (state + 0x6d2b79f5) | 0;
}

function randomValue(state: number) {
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
}

function canonicalRandom(state: CanonicalState, stream: keyof CanonicalRngState) {
  const next = nextRandomState(state.rng[stream]);
  state.rng[stream] = next;
  return randomValue(next);
}

function emitCanonicalEvent(state: CanonicalState, event: GameEvent) {
  state.stepEvents.push({ ...event, tick: state.tick, sequence: state.eventSequence++ } as GameEvent);
}

function emitCanonicalVisual(state: CanonicalState, visual: CanonicalVisualEvent) {
  if (visual.kind === "impact") {
    emitCanonicalEvent(state, {
      type: "combat-impact",
      source: visual.skillId,
      x: visual.x,
      y: visual.y,
      radius: visual.radius,
      duration: visual.duration,
      variant: visual.variant,
      color: visual.color,
      text: visual.text,
    });
    return;
  }
  emitCanonicalEvent(state, {
    type: "skill-activated",
    skillId: visual.skillId,
    level: levelOf(state, visual.skillId),
    activation: visual.kind,
    x: visual.x,
    y: visual.y,
    radius: visual.radius,
    duration: visual.duration,
    variant: visual.variant,
    x2: visual.x2,
    y2: visual.y2,
    color: visual.color,
    text: visual.text,
  });
}

function canonicalBrickPresentationColor(state: CanonicalState, brick: CanonicalBrick) {
  if (brick.kind === "boss-core") return "#ff6b87";
  if (brick.kind === "boss-minion") return "#ff8a3d";
  if (brick.trait === "guard") return "#fff27a";
  if (brick.trait === "explosive") return "#ff8a3d";
  if (brick.trait === "indestructible") return "#aeb8ca";
  if (brick.trait === "healer") return "#72f1b8";
  if (brick.trait === "reflector") return "#65dcff";
  const column = Math.max(0, state.bricks.indexOf(brick)) % 12;
  return `hsl(${185 + state.wave * 9 + column * 2} 95% 68%)`;
}

function upgradeFromSkill(config: SkillConfig): Upgrade {
  const classTag = config.category.toUpperCase();
  return {
    id: config.id,
    name: config.name,
    category: config.category,
    mechanic: config.mechanic,
    tag: `${classTag} · ${SKILL_MECHANIC_LABELS[config.mechanic]}`,
    description: config.description,
    color: config.color,
  };
}

function availableSkillConfigs(state: CanonicalState) {
  return state.skills.filter((config) => {
    if (!config.enabled) return false;
    const maximum = config.evolution ? 4 : 3;
    return state.upgrades.filter((id) => id === config.id).length < maximum;
  });
}

function createCanonicalChoices(state: CanonicalState, excluded: UpgradeId[] = []): UpgradeChoice[] {
  const candidates = availableSkillConfigs(state).filter((config) => !excluded.includes(config.id));
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(canonicalRandom(state, "reward") * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target], candidates[index]];
  }
  return candidates.slice(0, 3).map((config) => ({ upgrade: upgradeFromSkill(config), ballCost: 0 }));
}

function createBossChoices(state: CanonicalState) {
  const candidates = [...new Set(state.upgrades)].filter((id) => state.skills.some((config) => config.id === id));
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(canonicalRandom(state, "reward") * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target], candidates[index]];
  }
  return candidates.slice(0, 3);
}

function outcomeFromState(state: CanonicalState): CanonicalOutcome {
  if (state.phase === "awaiting-start-skill") return { type: "start-skill", choices: state.pendingChoices, rerollsLeft: state.rerollsLeft };
  if (state.phase === "wave-cleared") return { type: "wave-clear", wave: state.clearedWave ?? state.wave, boss: state.clearedBoss };
  if (state.phase === "awaiting-wave-skill") return { type: "wave-skill", choices: state.pendingChoices, rerollsLeft: state.rerollsLeft };
  if (state.phase === "awaiting-boss-reward") return { type: "boss-reward", choices: state.pendingBossChoices };
  if (state.phase === "ready-for-next-wave") return { type: "ready-for-next-wave", wave: state.pendingWave ?? Math.min(state.targetWave, state.wave + 1) };
  if (state.phase === "complete") return { type: "complete" };
  if (state.phase === "game-over") return { type: "game-over", reason: state.gameOverReason ?? "core" };
  return { type: "running" };
}

function stepResult(state: CanonicalState): CanonicalStepResult {
  return { outcome: outcomeFromState(state), events: state.stepEvents.splice(0) };
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
function skillCooldownRemaining(state: CanonicalState, ball: CanonicalBall, id: UpgradeId) {
  return skill(state, id)?.applicationScope === "shared" ? state.sharedSkillCooldowns[id] ?? 0 : ball.cooldowns[id] ?? 0;
}
function setSkillCooldown(state: CanonicalState, ball: CanonicalBall, id: UpgradeId, cooldown: number) {
  if (skill(state, id)?.applicationScope === "shared") {
    state.sharedSkillCooldowns[id] = cooldown;
    for (const entry of state.balls) entry.cooldowns[id] = cooldown;
  } else {
    ball.cooldowns[id] = cooldown;
  }
}
function evolved(state: CanonicalState, id: UpgradeId) { return Boolean(skill(state, id)?.evolution) && pickCount(state, id) >= 4; }
function traitConfig(state: CanonicalState, id: UpgradeId, kind: SkillTrait) {
  return skill(state, id)?.traitConfigs?.find((entry) => entry.kind === kind);
}
function traitValue(state: CanonicalState, id: UpgradeId, kind: SkillTrait) {
  const level = levelOf(state, id);
  const config = skill(state, id);
  const trait = traitConfig(state, id, kind);
  if (!level || !config || !trait) return 0;
  const base = Number(trait.values[level - 1] ?? 0);
  const enhancement = Math.max(0, state.bossEnhancements[id] ?? 0);
  if (!enhancement) return base;
  const step = Math.max(config.direction === "down" ? 0.2 : 1, Math.abs(trait.values[2] - trait.values[1]));
  return config.direction === "down" ? Math.max(0.2, base - enhancement * step) : base + enhancement * step;
}
function traitDamagePacket(state: CanonicalState, id: UpgradeId, kind: SkillTrait): { amount: number; damageType: SkillDamageType } {
  const level = levelOf(state, id);
  const config = skill(state, id);
  const trait = traitConfig(state, id, kind);
  if (!level || !trait) return { amount: 0, damageType: trait?.damageType ?? "magic" };
  const primary = config?.traitConfigs?.[0]?.kind === kind;
  const damageType = primary ? config?.damageType ?? trait.damageType : trait.damageType;
  const values = primary ? (damageType === "magic" ? config?.magicDamage ?? config?.skillDamage : config?.skillDamage) ?? trait.damage : trait.damage;
  const base = Number(values[level - 1] ?? 0);
  const enhancement = Math.max(0, state.bossEnhancements[id] ?? 0);
  const step = Math.max(1, Math.abs(values[2] - values[1]));
  const stat = damageType === "physical" ? state.combatStats.physicalPower : state.combatStats.magicPower;
  return { amount: Math.max(0, (base + enhancement * step) * stat), damageType };
}
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
export function canonicalSkillMagicDamage(state: CanonicalState, id: UpgradeId) {
  const packet = canonicalSkillDamagePacket(state, id);
  return packet.damageType === "magic" ? packet.amount : 0;
}
export function canonicalSkillDamagePacket(state: CanonicalState, id: UpgradeId): { amount: number; damageType: SkillDamageType } {
  const level = levelOf(state, id);
  const config = skill(state, id);
  const damageType = config?.damageType ?? "magic";
  const values = damageType === "magic" ? (config?.magicDamage ?? config?.skillDamage) : config?.skillDamage;
  if (!level || !values) return { amount: 0, damageType };
  const base = Number(values[level - 1] ?? 0);
  const enhancement = Math.max(0, state.bossEnhancements[id] ?? 0);
  const step = Math.max(1, Math.abs(values[2] - values[1]));
  const stat = damageType === "physical" ? state.combatStats.physicalPower : state.combatStats.magicPower;
  return { amount: Math.max(0, (base + enhancement * step) * stat), damageType };
}
function refreshCanonicalCombatStats(state: CanonicalState) {
  state.combatStats.physicalPower = Math.max(1, 1 + skillValue(state, "common-damage"));
  const evolvedMagicBonus = evolved(state, "common-magic") ? 25 : 0;
  state.combatStats.magicPower = Math.max(1, 1 + (skillValue(state, "common-magic") + evolvedMagicBonus) / 100);
  for (const ball of state.balls) ball.attackPower = state.combatStats.physicalPower;
}
function lateWaveHpMultiplier(wave: number) { return wave >= 16 ? 2.5 : wave >= 11 ? 1.9 : wave >= 6 ? 1.45 : wave >= 4 ? 1.15 : 1; }

function traitFor(cell: string): CanonicalTrait {
  return cell === "g" ? "guard" : cell === "e" ? "explosive" : cell === "x" ? "indestructible" : cell === "c" ? "healer" : cell === "r" ? "reflector" : "standard";
}

function makeBrick(state: CanonicalState, x: number, y: number, w: number, h: number, hp: number, trait: CanonicalTrait, kind: CanonicalBrick["kind"], drop: CanonicalItemKind | null = null): CanonicalBrick {
  return { id: state.nextBrickId++, x, y, w, h, hp, maxHp: hp, alive: true, trait, guardReady: trait === "guard", healTimer: 3, healBlockTime: 0, burnTime: 0, burnTick: 0, burnDamage: 0, burnDamageType: "magic", burnSourceSkillId: null, poisonTime: 0, poisonTick: 0, traitLockTime: 0, frostVulnerability: 0, frostSourceSkillId: null, drop: trait === "indestructible" ? null : drop, kind };
}

function scheduledMultiball(wave: number) { return [2, 4, 6, 8, 11, 13, 16, 18].includes(wave); }

function buildWave(state: CanonicalState, wave: number) {
  const definition = waveDefinitionFrom(state.waves, wave);
  state.nextBrickId = 1;
  if (definition.boss) {
    const stage = definition.boss === "final" ? 4 : definition.boss === "late" ? 3 : definition.boss === "mid" ? 2 : 1;
    const hpMultiplier = [1, 0.85, 0.95, 1.05, 1.2][stage];
    const earlyBossHealthScale = stage <= 2 ? 0.4 : 1;
    const hp = Math.round((state.balance.bossBaseHp + stage * state.balance.bossHpPerStage * 0.55 + state.ghostPaddles.length * 10) * hpMultiplier * definition.hpMultiplier * 0.5 * earlyBossHealthScale);
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
  const dropCell = scheduledMultiball(wave) && dropCandidates.length ? dropCandidates[Math.floor(canonicalRandom(state, "world") * dropCandidates.length)] : null;
  state.bricks = occupied.map(({ cell, rowIndex, col }) => {
    const bonus = cell === "h" ? 1 + Math.floor((wave - 1) / 8) : cell === "c" ? 2 : 0;
    const hp = Math.ceil((baseHp + bonus) * lateWaveHpMultiplier(wave) * definition.hpMultiplier);
    const drop = dropCell?.rowIndex === rowIndex && dropCell.col === col ? "multiball" : canonicalRandom(state, "world") < 0.055 ? (["auto-barrier", "core-repair", "cooldown-reset"] as CanonicalItemKind[])[Math.floor(canonicalRandom(state, "world") * 3)] : null;
    return makeBrick(state, margin + col * (width + gap), BRICK_ROW_Y + rowIndex * BRICK_ROW_STEP, width, 24, hp, traitFor(cell), "normal", drop);
  });
}

function makeBall(state: CanonicalState, x = GAME_WIDTH / 2, temporary = false, recovering = false, temporaryTime = 0): CanonicalBall {
  const baseSpeed = Math.hypot(BASE_BALL_VX, BASE_BALL_VY);
  // Overdrive is run-global, just like the legacy row timer. New balls must
  // inherit speed earned in earlier waves instead of using wave-local time.
  const speed = baseSpeed * (recovering ? 1 : overdriveMultiplier(state.overdriveLevel));
  const aim = paddleAimDirection(x, PLAYER_PADDLE_Y, GAME_WIDTH / 2, GAME_HEIGHT / 3);
  return { x, y: PLAYER_PADDLE_Y - 11, vx: aim.horizontalRatio * speed, vy: aim.verticalRatio * speed, radius: 8 + skillValue(state, "common-ball-size"), temporary, temporaryTime, missileTime: 0, waveBonus: temporary, visualSkill: null, visualSkillTime: 0, cooldowns: {}, skillCharges: {}, attackPower: Math.max(1, state.combatStats.physicalPower), pierce: 0, maxPierce: 0, payload: null, payloadLevel: 0, payloads: {}, canTriggerSkills: !temporary, skillGeneration: 0, lastHitBrickId: null, gravityBaseSpeed: null, explosionBaseSpeed: null, explosionBoostRatio: 1, explosionBoostTime: 0, respawnRecoveryTime: recovering ? RESPAWN_SPEED_RECOVERY_SECONDS : 0, respawnRecoveryDuration: recovering ? RESPAWN_SPEED_RECOVERY_SECONDS : 0, respawnRecoveryBaseSpeed: recovering ? baseSpeed : 0 };
}

function scaleBallSpeed(ball: CanonicalBall, targetSpeed: number) {
  const currentSpeed = Math.max(1, Math.hypot(ball.vx, ball.vy));
  ball.vx *= targetSpeed / currentSpeed;
  ball.vy *= targetSpeed / currentSpeed;
}

function clearExplosionSpeedBoost(ball: CanonicalBall) {
  if (ball.explosionBaseSpeed === null || ball.explosionBoostRatio <= 1) {
    ball.explosionBaseSpeed = null;
    ball.explosionBoostRatio = 1;
    ball.explosionBoostTime = 0;
    return;
  }
  if (ball.gravityBaseSpeed !== null) {
    scaleBallSpeed(ball, Math.max(1, Math.hypot(ball.vx, ball.vy)) / ball.explosionBoostRatio);
    ball.gravityBaseSpeed = ball.explosionBaseSpeed;
  } else {
    scaleBallSpeed(ball, ball.explosionBaseSpeed);
  }
  ball.explosionBaseSpeed = null;
  ball.explosionBoostRatio = 1;
  ball.explosionBoostTime = 0;
}

function triggerExplosionSpeedBoost(ball: CanonicalBall) {
  const alreadyBoosted = ball.explosionBoostTime > 0 && ball.explosionBaseSpeed !== null;
  const baseSpeed = alreadyBoosted ? ball.explosionBaseSpeed! : ball.gravityBaseSpeed ?? Math.max(1, Math.hypot(ball.vx, ball.vy));
  const boostedSpeed = Math.max(baseSpeed * EXPLOSION_BOOST_MULTIPLIER, Math.min(470, baseSpeed + EXPLOSION_BOOST_MAX_BONUS));
  ball.explosionBaseSpeed = baseSpeed;
  ball.explosionBoostRatio = boostedSpeed / baseSpeed;
  ball.explosionBoostTime = EXPLOSION_BOOST_DURATION;
  if (ball.gravityBaseSpeed !== null) ball.gravityBaseSpeed = boostedSpeed;
  return boostedSpeed;
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

function spawnRapidArrow(state: CanonicalState, source: CanonicalBall, offset: number, lifetime: number) {
  const inheritsSkills = evolved(state, "archer-rapid");
  const generation = source.skillGeneration + 1;
  const arrow = makeBall(state, source.x + offset, true, false, lifetime);
  arrow.x = source.x + offset;
  arrow.y = source.y;
  arrow.vx = source.vx * (offset === 0 ? -0.88 : offset < 0 ? -0.82 : 0.82);
  arrow.vy = -Math.abs(source.vy);
  arrow.visualSkill = "archer-rapid";
  arrow.visualSkillTime = Math.min(0.5, lifetime);
  arrow.canTriggerSkills = inheritsSkills;
  arrow.skillGeneration = generation;
  arrow.attackPower = source.attackPower;
  if (inheritsSkills) {
    arrow.pierce = source.pierce;
    arrow.maxPierce = source.maxPierce;
    arrow.payload = source.payload;
    arrow.payloadLevel = source.payloadLevel;
    arrow.payloads = { ...source.payloads };
    arrow.skillCharges = { ...source.skillCharges };
    arrow.cooldowns = { ...source.cooldowns };
    for (const id of ["archer-rapid"] as UpgradeId[]) {
      const level = levelOf(state, id);
      const config = skill(state, id);
      if (!level || !config) continue;
      const cooldownReduction = Math.min(0.75, skillValue(state, "common-cooldown") / 100);
      arrow.cooldowns[id] = Math.max(0.2, Number(config.cooldown[level - 1] ?? 1) * (1 - cooldownReduction)) * (1 + generation * 0.5);
    }
  }
  state.balls.push(arrow);
  return arrow;
}

function resolveBrickDestruction(state: CanonicalState, brick: CanonicalBrick, applied: number, packet: DamagePacket) {
  const sourceBall = packet.sourceBall;
  brick.alive = false;
  state.bricksBroken++;
  state.combo++;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  const points = 100 + Math.round(applied * 12 + state.combo * 4 * (1 + skillValue(state, "common-combo") / 100));
  emitCanonicalEvent(state, {
    type: "brick-destroyed",
    brickIndex: brick.id,
    x: brick.x + brick.w / 2,
    y: brick.y + brick.h / 2,
    color: canonicalBrickPresentationColor(state, brick),
    combo: state.combo,
    points,
    source: packet.sourceSkillId,
    damageType: packet.damageType,
  });
  state.score += points;
  const drop = brick.drop ?? (canonicalRandom(state, "world") < skillValue(state, "common-luck") / 100 ? "multiball" : null);
  if (drop) {
    state.items.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, vy: 120, kind: drop, alive: true });
    emitCanonicalEvent(state, { type: "item-dropped", itemId: brick.id, kind: drop, x: brick.x + brick.w / 2, y: brick.y + brick.h / 2 });
    if (drop === "multiball" && evolved(state, "common-luck")) {
      const utilityKinds: CanonicalItemKind[] = ["auto-barrier", "core-repair", "cooldown-reset"];
      const bonusKind = utilityKinds[Math.floor(canonicalRandom(state, "world") * utilityKinds.length)];
      const bonusX = Math.max(16, Math.min(GAME_WIDTH - 16, brick.x + brick.w / 2 + (canonicalRandom(state, "world") < 0.5 ? -18 : 18)));
      state.items.push({ x: bonusX, y: brick.y + brick.h / 2, vy: 120, kind: bonusKind, alive: true });
      emitCanonicalEvent(state, { type: "item-dropped", itemId: -brick.id, kind: bonusKind, x: bonusX, y: brick.y + brick.h / 2 });
    }
  }
  if (brick.trait === "explosive") {
    const blastX = brick.x + brick.w / 2;
    const blastY = brick.y + brick.h / 2;
    emitCanonicalEvent(state, { type: "brick-exploded", brickIndex: brick.id, x: blastX, y: blastY, radius: EXPLOSION_RADIUS, color: "#ff8a3d" });
    for (const near of state.bricks) {
      if (!near.alive || near === brick || near.trait === "indestructible") continue;
      const distance = Math.hypot(near.x + near.w / 2 - blastX, near.y + near.h / 2 - blastY);
      if (distance < EXPLOSION_RADIUS) applyBrickDamage(state, near, { amount: 1, damageType: "physical", delivery: "environment", sourceBall, respectGuard: true });
    }
    if (sourceBall) {
      const dx = sourceBall.x - blastX;
      const dy = sourceBall.y - blastY;
      const length = Math.max(1, Math.hypot(dx, dy));
      const launchSpeed = triggerExplosionSpeedBoost(sourceBall);
      sourceBall.vx = dx / length * launchSpeed;
      sourceBall.vy = dy / length * launchSpeed;
    }
  }
  const blastLevel = Math.max(0, Number(sourceBall?.payloads.blast ?? 0));
  if (blastLevel > 0) {
    const blastX = brick.x + brick.w / 2;
    const blastY = brick.y + brick.h / 2;
    const range = 60 + blastLevel * 20;
    emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: blastX, y: blastY, radius: range, duration: 0.55, color: "#ff6b87" });
    for (const near of state.bricks) {
      if (!near.alive || near === brick || near.trait === "indestructible") continue;
      if (Math.hypot(near.x + near.w / 2 - blastX, near.y + near.h / 2 - blastY) <= range) {
        applyBrickDamage(state, near, { amount: blastLevel >= 3 ? 2 : 1, damageType: "physical", delivery: "environment", sourceBall, respectGuard: true });
      }
    }
  }
}

function breakBrickGuard(state: CanonicalState, brick: CanonicalBrick) {
  if (!brick.guardReady) return false;
  brick.guardReady = false;
  brick.trait = "standard";
  emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, radius: 42, duration: 0.45, color: "#fff27a", text: "GUARD BREAK" });
  return true;
}

/**
 * Combat coefficients may remain fractional, but every amount that crosses
 * the HP boundary is resolved to one positive integer exactly once.
 */
export function canonicalIntegerCombatAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.max(1, Math.round(amount));
}

function applyBrickDamage(state: CanonicalState, brick: CanonicalBrick, packet: DamagePacket): DamageReceipt {
  const requested = canonicalIntegerCombatAmount(packet.amount);
  if (!brick.alive || brick.trait === "indestructible") return { requested, applied: 0, guardBroken: false, killed: false };
  if (packet.respectGuard && breakBrickGuard(state, brick)) return { requested, applied: 0, guardBroken: true, killed: false };
  const applied = Math.min(brick.hp, requested);
  const wasAlive = brick.alive;
  if (applied > 0) {
    state.totalDamage += applied;
    if (packet.damageType === "physical") state.physicalDamage += applied;
    else state.magicDamage += applied;
    state.lastDamageElapsed = state.elapsed;
    emitCanonicalEvent(state, {
      type: "brick-damaged",
      brickIndex: brick.id,
      damage: applied,
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h / 2,
      color: canonicalBrickPresentationColor(state, brick),
      source: packet.sourceSkillId,
      damageType: packet.damageType,
      delivery: packet.delivery,
    });
    // Keep ordinary ball/brick impacts visible in canonical-only runs. The
    // legacy loop used to materialize these as spark/particle feedback; emit
    // the same declarative visual at the simulation boundary instead.
    emitCanonicalVisual(state, {
      kind: "impact",
      skillId: "original" as UpgradeId,
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h / 2,
      radius: 28,
      duration: 0.28,
    });
  }
  brick.hp -= applied;
  const killed = wasAlive && brick.hp <= 0;
  if (killed) resolveBrickDestruction(state, brick, applied, packet);
  if (packet.sourceSkillId && applied > 0) recordSkillContribution(state, packet.sourceSkillId, applied, killed ? 1 : 0);
  return { requested, applied, guardBroken: false, killed };
}

function recordSkillActivation(state: CanonicalState, id: UpgradeId) {
  const previous = state.skillMetrics[id] ?? { activations: 0, damage: 0, kills: 0 };
  state.skillMetrics[id] = { ...previous, activations: previous.activations + 1 };
}

function recordSkillContribution(state: CanonicalState, id: UpgradeId, damage: number, kills: number) {
  const previous = state.skillMetrics[id] ?? { activations: 0, damage: 0, kills: 0 };
  state.skillMetrics[id] = { activations: previous.activations, damage: previous.damage + damage, kills: previous.kills + kills };
}

function eligibleSkillTargets(targets: CanonicalBrick[]) {
  return targets.filter((target) => target.alive && target.trait !== "indestructible");
}

function applySkillDamage(state: CanonicalState, result: SkillResult, sourceBall: CanonicalBall, sourceSkillId: UpgradeId, targets: CanonicalBrick[]) {
  let damage = 0;
  if (result.damage) {
    for (const target of targets) {
      damage += applyBrickDamage(state, target, { amount: result.damage, damageType: result.damageType ?? "magic", delivery: "skill", sourceBall, sourceSkillId, respectGuard: true }).applied;
    }
  }
  return damage;
}

function applySkillStatuses(result: SkillResult, sourceSkillId: UpgradeId, targets: CanonicalBrick[]) {
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
      target.burnDamage = Math.max(target.burnDamage, result.burn.damage);
      target.burnDamageType = result.damageType ?? "magic";
      target.burnSourceSkillId = sourceSkillId;
    }
  }
}

function applySkillGlobalEffects(state: CanonicalState, result: SkillResult) {
  if (result.barrier) {
    const charges = Math.max(0, result.barrier.charges ?? 0);
    // Base Iron Wall only maintains one guard. Its evolution unlocks stacking,
    // capped at four guards for the current wave.
    state.barrierCharges = result.barrier.stackable
      ? Math.min(4, state.barrierCharges + charges)
      : Math.max(state.barrierCharges, Math.min(1, charges));
    state.barrierTime = 0;
  }
  if (result.summon) {
    for (let i = 0; i < result.summon.count; i++) state.balls.push(makeBall(state, state.paddleX, result.summon.temporary ?? true));
  }
}

function applySkillResult(state: CanonicalState, result: SkillResult, sourceBall: CanonicalBall, sourceSkillId: UpgradeId, targets: CanonicalBrick[]) {
  const eligibleTargets = eligibleSkillTargets(targets);
  const damage = applySkillDamage(state, result, sourceBall, sourceSkillId, eligibleTargets);
  applySkillStatuses(result, sourceSkillId, eligibleTargets);
  applySkillGlobalEffects(state, result);
  return damage;
}

function brickDistance(a: CanonicalBrick, b: CanonicalBrick) {
  return Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2));
}

function chainPriority(id: UpgradeId, brick: CanonicalBrick) {
  if (id !== "archer-ricochet") return 0;
  return brick.trait === "healer" ? 0 : brick.trait === "explosive" ? 1 : brick.guardReady ? 2 : brick.trait === "reflector" ? 3 : 4;
}

function applyChainedSkill(state: CanonicalState, ball: CanonicalBall, origin: CanonicalBrick, id: UpgradeId, initialCount: number, radius: number) {
  const evolvedChain = evolved(state, id);
  const allowRepeat = evolved(state, "common-chain");
  const queue: Array<{ source: CanonicalBrick; count: number }> = [{ source: origin, count: initialCount }];
  const seen = new Set<number>([origin.id]);
  let damage = 0;
  let kills = 0;
  let processed = 0;
  const packet = traitDamagePacket(state, id, "chain");
  const safetyLimit = Math.max(1, state.bricks.length * 2);
  while (queue.length && processed++ < safetyLimit) {
    const current = queue.shift()!;
    const targets = state.bricks
      .filter((target) => target.alive && target !== current.source && target.trait !== "indestructible" && (allowRepeat || !seen.has(target.id)))
      .filter((target) => brickDistance(target, current.source) <= radius)
      .sort((a, b) => chainPriority(id, a) - chainPriority(id, b) || brickDistance(a, current.source) - brickDistance(b, current.source))
      .slice(0, current.count);
    for (const target of targets) {
      seen.add(target.id);
      const wasAlive = target.alive;
      const dealt = applyBrickDamage(state, target, { amount: packet.amount, damageType: packet.damageType, delivery: "skill", sourceBall: ball, sourceSkillId: id, respectGuard: true });
      damage += dealt.applied;
      if (wasAlive && !target.alive) {
        kills++;
        if (evolvedChain) queue.push({ source: target, count: 1 });
      }
    }
    if (!evolvedChain) break;
  }
  return { damage, kills };
}

function applyShockwave(state: CanonicalState, ball: CanonicalBall, origin: CanonicalBrick, radius: number, packet: { amount: number; damageType: SkillDamageType }) {
  const chaining = evolved(state, "warrior-shockwave");
  const queue = [origin];
  const reacted = new Set<number>([origin.id]);
  let damage = 0;
  let kills = 0;
  while (queue.length) {
    const source = queue.shift()!;
    const targets = state.bricks.filter((target) => target.alive && target.trait !== "indestructible" && !reacted.has(target.id) && brickDistance(target, source) <= radius);
    for (const target of targets) {
      reacted.add(target.id);
      const wasAlive = target.alive;
      damage += applyBrickDamage(state, target, { amount: packet.amount, damageType: packet.damageType, delivery: "skill", sourceBall: ball, sourceSkillId: "warrior-shockwave", respectGuard: true }).applied;
      if (wasAlive && !target.alive) {
        kills++;
        if (chaining) queue.push(target);
      }
    }
    if (!chaining) break;
  }
  return { damage, kills };
}

type CollisionSkillTriggerContext = { repeatedTarget: boolean; originalTrait: CanonicalTrait; destroyed: boolean };

function customTriggerMatches(config: SkillConfig, context: CollisionSkillTriggerContext) {
  if (config.triggerType === "brick-break") return context.destroyed;
  if (config.triggerType === "repeat-hit") return context.repeatedTarget;
  if (config.triggerType === "special-brick-hit") return context.originalTrait !== "standard";
  return config.triggerType === "brick-hit";
}

function applyCustomCollisionSkill(state: CanonicalState, ball: CanonicalBall, hit: CanonicalBrick, config: SkillConfig, radius: number) {
  const nearby = state.bricks
    .filter((target) => target.alive && target.trait !== "indestructible" && target.id !== hit.id)
    .sort((a, b) => brickDistance(a, hit) - brickDistance(b, hit));
  const applyDamage = (target: CanonicalBrick, kind: SkillTrait) => {
    const packet = traitDamagePacket(state, config.id, kind);
    return applyBrickDamage(state, target, {
    amount: packet.amount,
    damageType: packet.damageType,
    delivery: "skill",
    sourceBall: ball,
    sourceSkillId: config.id,
    respectGuard: true,
  });
  };

  if (config.traits.includes("direct-damage") && hit.alive) applyDamage(hit, "direct-damage");
  if (config.traits.includes("smash") && hit.alive) applyDamage(hit, "smash");
  if (config.traits.includes("crush") && hit.alive && hit.trait !== "standard") applyDamage(hit, "crush");
  if (config.traits.includes("focus") && hit.alive) applyDamage(hit, "focus");
  if (config.traits.includes("weakpoint") && hit.alive) {
    const multiplier = Math.max(1, traitValue(state, config.id, "weakpoint"));
    const packet = traitDamagePacket(state, config.id, "weakpoint");
    const stat = packet.damageType === "physical" ? state.combatStats.physicalPower : state.combatStats.magicPower;
    applyBrickDamage(state, hit, { amount: Math.max(packet.amount, stat * (multiplier - 1)), damageType: packet.damageType, delivery: "skill", sourceBall: ball, sourceSkillId: config.id, respectGuard: true });
  }
  if (config.traits.includes("execute") && hit.alive && hit.kind !== "boss-core") {
    const threshold = Math.max(0, traitValue(state, config.id, "execute")) / 100;
    if (hit.hp / Math.max(1, hit.maxHp) <= threshold) applyBrickDamage(state, hit, { amount: hit.hp, damageType: traitConfig(state, config.id, "execute")?.damageType ?? "physical", delivery: "skill", sourceBall: ball, sourceSkillId: config.id, respectGuard: true });
  }
  if (config.traits.includes("mana-seal") && hit.alive) {
    hit.traitLockTime = Math.max(hit.traitLockTime, traitValue(state, config.id, "mana-seal"));
    applyDamage(hit, "mana-seal");
  }
  if (config.traits.includes("splash")) {
    const splashRadius = Math.max(0, traitValue(state, config.id, "splash") || radius);
    for (const target of nearby.filter((entry) => brickDistance(entry, hit) <= splashRadius)) applyDamage(target, "splash");
  }
  if (config.traits.includes("chain")) {
    const count = Math.max(1, Math.round(traitValue(state, config.id, "chain")));
    for (const target of nearby.slice(0, count)) applyDamage(target, "chain");
  }
  const statusTargets = [hit, ...nearby.filter((entry) => brickDistance(entry, hit) <= radius)].filter((target) => target.alive && target.trait !== "indestructible");
  if (config.traits.includes("burn")) {
    const packet = traitDamagePacket(state, config.id, "burn");
    for (const target of statusTargets) {
      target.burnTime = Math.max(target.burnTime, traitValue(state, config.id, "burn"));
      target.burnTick = Math.min(target.burnTick || 1, 1);
      target.burnDamage = Math.max(target.burnDamage, packet.amount);
      target.burnDamageType = packet.damageType;
      target.burnSourceSkillId = config.id;
    }
  }
  if (config.traits.includes("freeze")) {
    for (const target of statusTargets) target.traitLockTime = Math.max(target.traitLockTime, traitValue(state, config.id, "freeze"));
  }
  if (config.traits.includes("pierce")) {
    const count = Math.max(1, Math.round(traitValue(state, config.id, "pierce")));
    ball.maxPierce = Math.max(ball.maxPierce, count);
    ball.pierce = Math.max(ball.pierce, count);
  }
  if (config.traits.includes("rapid-fire")) spawnRapidArrow(state, ball, ball.vx >= 0 ? -14 : 14, Math.max(1, traitValue(state, config.id, "rapid-fire")));
  if (config.traits.includes("barrier")) state.barrierCharges = Math.min(4, state.barrierCharges + Math.max(1, Math.round(traitValue(state, config.id, "barrier"))));
  if (config.traits.includes("black-hole")) {
    const packet = traitDamagePacket(state, config.id, "black-hole");
    state.gravityWells.push({ x: hit.x + hit.w / 2, y: hit.y + hit.h / 2, radius: Math.max(70, traitValue(state, config.id, "black-hole")), life: 3, damagePerSecond: packet.amount, damageType: packet.damageType, damageTick: 1, sourceSkillId: config.id });
  }
}

function triggerCollisionSkills(state: CanonicalState, ball: CanonicalBall, hit: CanonicalBrick, triggerContext: CollisionSkillTriggerContext) {
  if (!ball.canTriggerSkills || hit.trait === "indestructible") return;
  const cooldownReduction = Math.min(0.75, skillValue(state, "common-cooldown") / 100);
  const rangeMultiplier = 1 + skillValue(state, "common-skill-range") / 100;
  for (const config of state.skills) {
    const level = levelOf(state, config.id);
    const deferredDirect = DIRECT_DAMAGE_SKILLS.has(config.id) && config.triggerType === "brick-break";
    if (!level || !config.enabled || config.category === "common" || (DIRECT_DAMAGE_SKILLS.has(config.id) && !deferredDirect)) continue;
    const custom = !config.builtIn || config.id.startsWith("custom-");
    if (!customTriggerMatches(config, triggerContext)) continue;
    if (config.id === "mage-mana-blast" && !(hit.guardReady || hit.trait === "healer" || hit.trait === "reflector")) continue;
    if (config.id === "archer-ricochet" && levelOf(state, "mage-lightning") > 0 && skillCooldownRemaining(state, ball, "mage-lightning") <= 0) continue;
    const remaining = skillCooldownRemaining(state, ball, config.id);
    if (remaining > 0) continue;
    // Iron Wall's displayed 6/5/4 second value is its activation interval.
    // Boss enhancement improves that interval instead of shortening a guard
    // lifetime (stored charges deliberately have no lifetime).
    const baseCooldown = config.id === "warrior-guard"
      ? skillValue(state, config.id)
      : Number(config.cooldown[level - 1] ?? 1);
    const evolvedCooldownMultiplier = evolved(state, "common-cooldown") ? 0.8 : 1;
    const cooldown = Math.max(0.2, baseCooldown * (1 - cooldownReduction) * evolvedCooldownMultiplier);
    setSkillCooldown(state, ball, config.id, cooldown);
    ball.visualSkill = config.id;
    ball.visualSkillTime = Math.max(ball.visualSkillTime, 0.42);
    let visualEmitted = false;
    let resultApplied = false;
    const result: SkillResult = {};
    const rangePadding = evolved(state, "common-skill-range") ? 32 : 0;
    const radius = (config.category === "warrior" ? 105 : config.category === "mage" ? 125 : 85) * rangeMultiplier + rangePadding;
    const targets = state.bricks.filter((brick) => brick.alive && brick.trait !== "indestructible").sort((a, b) => Math.hypot(a.x - hit.x, a.y - hit.y) - Math.hypot(b.x - hit.x, b.y - hit.y));
    const chainBonus = Math.floor(skillValue(state, "common-chain")) + (evolved(state, "common-chain") ? 1 : 0);
    const count = Math.max(1, 1 + chainBonus);
    if (custom || deferredDirect) {
      applyCustomCollisionSkill(state, ball, hit, config, radius);
      resultApplied = true;
    } else if (config.id === "mage-fireball" && (config.traits.includes("splash") || config.traits.includes("burn"))) {
      const duration = Math.max(0, traitValue(state, config.id, "burn"));
      const damagePacket = traitDamagePacket(state, config.id, "splash");
      result.damage = config.traits.includes("splash") ? damagePacket.amount : 0;
      result.damageType = damagePacket.damageType;
      result.disableHealing = config.traits.includes("burn") ? duration : 0;
      if (config.traits.includes("burn")) {
        const burnPacket = traitDamagePacket(state, config.id, "burn");
        result.burn = { duration, damage: burnPacket.amount * (evolved(state, config.id) ? 1.5 : 1) };
      }
      const fireballRadius = Math.max(20, traitValue(state, config.id, "splash")) * rangeMultiplier + rangePadding;
      const affected = targets.filter((target) => brickDistance(target, hit) <= fireballRadius);
      applySkillResult(state, result, ball, config.id, affected);
      resultApplied = true;
    } else if (config.id === "warrior-guard" && config.traits.includes("barrier")) {
      const stackable = evolved(state, config.id);
      result.barrier = { charges: Math.max(1, Math.round(traitValue(state, config.id, "barrier"))) * (stackable ? 2 : 1), stackable };
      applySkillResult(state, result, ball, config.id, []);
      resultApplied = true;
    } else if (config.id === "archer-rapid" && config.traits.includes("rapid-fire")) {
      const lifetime = Math.max(0.2, traitValue(state, config.id, "rapid-fire"));
      spawnRapidArrow(state, ball, ball.vx >= 0 ? -14 : 14, lifetime);
      if (evolved(state, config.id)) spawnRapidArrow(state, ball, ball.vx >= 0 ? 18 : -18, lifetime);
    } else if (config.id === "archer-pierce" && config.traits.includes("pierce")) {
      // A prepared ball receives the configured consecutive penetration count.
      const pierceCount = Math.max(1, Math.round(traitValue(state, config.id, "pierce")));
      ball.maxPierce = Math.max(ball.maxPierce, pierceCount);
      ball.pierce = Math.max(ball.pierce, pierceCount);
    } else if (config.id === "archer-ricochet" && config.traits.includes("chain")) {
      const ricochetCount = Math.max(1, Math.round(traitValue(state, config.id, "chain") + chainBonus));
      applyChainedSkill(state, ball, hit, config.id, ricochetCount, radius);
      resultApplied = true;
    } else if (config.id === "mage-lightning" && config.traits.includes("chain")) {
      const chainCount = Math.max(1, Math.round(traitValue(state, config.id, "chain") + chainBonus));
      applyChainedSkill(state, ball, hit, config.id, chainCount, radius);
    } else if (config.id === "mage-freeze" && config.traits.includes("freeze")) {
      // The mark is consumed by the next direct hit for bonus damage and
      // seals healer/reflector behavior for the configured duration.
      const frostDamage = Math.max(0, traitDamagePacket(state, config.id, "freeze").amount);
      const freezeDuration = Math.max(0, traitValue(state, config.id, "freeze"));
      result.control = { duration: freezeDuration, kind: "freeze" };
      hit.frostVulnerability = Math.max(hit.frostVulnerability, frostDamage);
      hit.frostSourceSkillId = config.id;
      hit.traitLockTime = Math.max(hit.traitLockTime, freezeDuration);
    } else if (config.id === "mage-mana-blast" && config.traits.includes("mana-seal")) {
      const duration = Math.max(0, traitValue(state, config.id, "mana-seal"));
      result.control = { duration, kind: "mana-seal" };
      const damagePacket = traitDamagePacket(state, config.id, "mana-seal");
      result.damage = damagePacket.amount;
      result.damageType = damagePacket.damageType;
      hit.traitLockTime = Math.max(hit.traitLockTime, duration);
      applySkillResult(state, result, ball, config.id, [hit]);
      resultApplied = true;
    } else if (config.id === "mage-black-hole" && config.traits.includes("black-hole")) {
      // Radius remains the control value; damage is snapshotted from the
      // run-wide magic stat so later stat changes do not rewrite active wells.
      const radius = Math.max(40, traitValue(state, config.id, "black-hole") * rangeMultiplier);
      const damagePacket = traitDamagePacket(state, config.id, "black-hole");
      const next = { x: Math.max(150, Math.min(GAME_WIDTH - 150, ball.x)), y: 145 + canonicalRandom(state, "world") * 80, radius, life: 4, damagePerSecond: damagePacket.amount * (evolved(state, config.id) ? 1.5 : 1), damageType: damagePacket.damageType, damageTick: 1, sourceSkillId: config.id };
      state.gravityWells.push(next);
      emitCanonicalVisual(state, { kind: "skill", skillId: config.id, x: next.x, y: next.y, radius: radius * 0.7, duration: 0.7, color: config.color });
      visualEmitted = true;
      resultApplied = true;
    } else if (config.id === "warrior-shockwave" && config.traits.includes("splash")) {
      const shockwaveRadius = Math.max(20, traitValue(state, config.id, "splash")) * rangeMultiplier + rangePadding;
      applyShockwave(state, ball, hit, shockwaveRadius, traitDamagePacket(state, config.id, "splash"));
    }
    // Keep all contract fields on a single post-processing path. Existing
    // specialized branches still mutate their richer state directly, while
    // generic and future runtimes can return effects without losing them.
    const effectTargets = targets.filter((target) => Math.hypot(target.x - hit.x, target.y - hit.y) <= radius).slice(0, count);
    if (!resultApplied) applySkillResult(state, result, ball, config.id, effectTargets);
    if (!visualEmitted) {
      const centerX = hit.x + hit.w / 2;
      const centerY = hit.y + hit.h / 2;
      const isArcher = config.category === "archer";
      const isMage = config.category === "mage";
      const visualRadius = config.id === "warrior-shockwave"
        ? radius
        : config.id === "mage-fireball"
          ? (60 + level * 20) * rangeMultiplier + rangePadding
          : config.id === "warrior-guard"
            ? 120
            : config.id === "archer-rapid"
              ? 58 + level * 6
              : config.id === "mage-freeze"
                ? Math.min(hit.w, hit.h) + 24
                : config.id === "mage-mana-blast"
                  ? 58
                  : isArcher
                    ? 58
                    : isMage
                      ? 64
                      : 66;
      const visualDuration = config.id === "warrior-shockwave"
        ? 0.62
        : config.id === "mage-fireball"
          ? 0.72
          : config.id === "warrior-guard"
            ? 0.75
            : config.id === "archer-rapid"
              ? 0.5
              : config.id === "mage-freeze"
                ? 0.5
                : config.id === "mage-mana-blast"
                  ? 0.48
                  : isArcher
                    ? 0.45
                    : isMage
                      ? 0.55
                      : 0.5;
      const visualX = config.id === "warrior-guard" ? GAME_WIDTH / 2 : centerX;
      const visualY = config.id === "warrior-guard" ? PLAYER_LINE_Y : centerY;
      emitCanonicalVisual(state, {
        kind: "skill",
        skillId: config.id,
        x: visualX,
        y: visualY,
        x2: config.id === "warrior-guard" ? GAME_WIDTH - 24 : isArcher ? centerX + ball.vx * 0.08 : visualX,
        y2: config.id === "warrior-guard" ? PLAYER_LINE_Y : isArcher ? centerY + ball.vy * 0.08 : visualY,
        radius: visualRadius,
        duration: visualDuration,
        color: config.color,
        text: config.name,
      });
    }
    recordSkillActivation(state, config.id);
  }
}

type DirectHitContext = {
  brick: CanonicalBrick;
  ball: CanonicalBall;
  originalTrait: CanonicalTrait;
  repeatedTarget: boolean;
  frostBonus: number;
  physicalDamage: number;
  skillDamagePackets: Array<{ id: UpgradeId; amount: number; damageType: SkillDamageType }>;
  guardWasReady: boolean;
  bypassGuard: boolean;
  poisonLevel: number;
  appliedDamage: number;
  passesThrough: boolean;
  skillActivations: Array<{ id: UpgradeId; level: number }>;
};

const DIRECT_DAMAGE_SKILLS = new Set<UpgradeId>([
  "warrior-smash", "warrior-execute", "warrior-crush", "archer-focus", "archer-weakpoint",
]);
const DIRECT_TRAIT_BY_SKILL: Partial<Record<UpgradeId, SkillTrait>> = {
  "warrior-smash": "smash",
  "warrior-execute": "execute",
  "warrior-crush": "crush",
  "archer-focus": "focus",
  "archer-weakpoint": "weakpoint",
};

function consumeDirectSkill(state: CanonicalState, ball: CanonicalBall, id: UpgradeId, context: DirectHitContext) {
  const config = skill(state, id);
  const level = levelOf(state, id);
  const requiredTrait = DIRECT_TRAIT_BY_SKILL[id];
  if (!config || !level || !config.enabled || !requiredTrait || !config.traits.includes(requiredTrait) || !customTriggerMatches(config, { repeatedTarget: context.repeatedTarget, originalTrait: context.originalTrait, destroyed: false }) || skillCooldownRemaining(state, ball, id) > 0) return null;
  const cooldownReduction = Math.min(0.75, skillValue(state, "common-cooldown") / 100);
  const evolvedCooldownMultiplier = evolved(state, "common-cooldown") ? 0.8 : 1;
  setSkillCooldown(state, ball, id, Math.max(0.2, Number(config.cooldown[level - 1] ?? 1) * (1 - cooldownReduction) * evolvedCooldownMultiplier));
  ball.visualSkill = id;
  ball.visualSkillTime = Math.max(ball.visualSkillTime, 0.42);
  return { config, level };
}

function applyDirectSkillModifiers(state: CanonicalState, context: DirectHitContext) {
  if (!context.ball.canTriggerSkills) {
    context.ball.lastHitBrickId = context.brick.id;
    return;
  }

  const originalTrait = context.brick.trait;
  const crush = consumeDirectSkill(state, context.ball, "warrior-crush", context);
  if (crush) {
    const packet = traitDamagePacket(state, crush.config.id, "crush");
    const bonus = originalTrait !== "standard" ? packet.amount : 0;
    context.bypassGuard = context.guardWasReady;
    if (bonus > 0) context.skillDamagePackets.push({ id: crush.config.id, amount: bonus, damageType: packet.damageType });
    context.skillActivations.push({ id: crush.config.id, level: crush.level });
  }

  if (!context.guardWasReady || context.bypassGuard) {
    const smash = consumeDirectSkill(state, context.ball, "warrior-smash", context);
    if (smash) {
      const packet = traitDamagePacket(state, smash.config.id, "smash");
      if (packet.amount > 0) context.skillDamagePackets.push({ id: smash.config.id, amount: packet.amount, damageType: packet.damageType });
      context.skillActivations.push({ id: smash.config.id, level: smash.level });
    }

    const focus = consumeDirectSkill(state, context.ball, "archer-focus", context);
    if (focus) {
      const evolutionMultiplier = evolved(state, focus.config.id) ? 1.5 : 1;
      const packet = traitDamagePacket(state, focus.config.id, "focus");
      const bonus = packet.amount * evolutionMultiplier;
      if (bonus > 0) context.skillDamagePackets.push({ id: focus.config.id, amount: bonus, damageType: packet.damageType });
      context.skillActivations.push({ id: focus.config.id, level: focus.level });
    }

    const weakpoint = consumeDirectSkill(state, context.ball, "archer-weakpoint", context);
    if (weakpoint) {
      const multiplier = evolved(state, weakpoint.config.id) ? Math.max(4, traitValue(state, weakpoint.config.id, "weakpoint")) : Math.max(1, traitValue(state, weakpoint.config.id, "weakpoint"));
      const before = context.physicalDamage + context.skillDamagePackets.reduce((sum, packet) => sum + packet.amount, 0);
      const bonus = before * (multiplier - 1);
      if (bonus > 0) context.skillDamagePackets.push({ id: weakpoint.config.id, amount: bonus, damageType: traitConfig(state, weakpoint.config.id, "weakpoint")?.damageType ?? weakpoint.config.damageType });
      context.skillActivations.push({ id: weakpoint.config.id, level: weakpoint.level });
    }

    const execute = consumeDirectSkill(state, context.ball, "warrior-execute", context);
    if (execute) {
      const threshold = (evolved(state, execute.config.id) ? Math.max(50, traitValue(state, execute.config.id, "execute")) : traitValue(state, execute.config.id, "execute")) / 100;
      const canExecute = context.brick.kind !== "boss-core" && context.brick.hp / Math.max(1, context.brick.maxHp) <= threshold;
      const before = context.physicalDamage + context.skillDamagePackets.reduce((sum, packet) => sum + packet.amount, 0);
      const bonus = canExecute ? Math.max(0, context.brick.hp - before) : 0;
      if (bonus > 0) context.skillDamagePackets.push({ id: execute.config.id, amount: bonus, damageType: traitConfig(state, execute.config.id, "execute")?.damageType ?? execute.config.damageType });
      context.skillActivations.push({ id: execute.config.id, level: execute.level });
    }
  }

  context.ball.lastHitBrickId = context.brick.id;
}

function prepareDirectHit(state: CanonicalState, ball: CanonicalBall, brick: CanonicalBrick): DirectHitContext {
  const frostBonus = Math.max(0, brick.frostVulnerability);
  const frostSourceSkillId = brick.frostSourceSkillId;
  const glassLevel = Math.max(0, Number(ball.payloads.glass ?? 0));
  const fracture = glassLevel > 0 ? Math.max(0, Math.ceil(brick.hp * Math.min(0.25, glassLevel * 0.05))) : 0;
  const corrosion = Math.max(0, skillValue(state, "corrosion"));
  brick.frostVulnerability = 0;
  brick.frostSourceSkillId = null;
  const pierceEvolutionDamage = evolved(state, "archer-pierce") && ball.maxPierce > 0 ? Math.max(0, ball.maxPierce - ball.pierce) : 0;
  const sealedEvolutionDamage = evolved(state, "mage-mana-blast") && brick.traitLockTime > 0 ? 1 : 0;
  const context: DirectHitContext = {
    brick,
    ball,
    originalTrait: brick.trait,
    repeatedTarget: ball.lastHitBrickId === brick.id,
    frostBonus,
    physicalDamage: Math.max(1, ball.attackPower + fracture + corrosion),
    skillDamagePackets: [
      ...(frostBonus > 0 ? [{ id: frostSourceSkillId ?? "mage-freeze" as UpgradeId, amount: frostBonus * state.combatStats.magicPower, damageType: "magic" as SkillDamageType }] : []),
      ...(pierceEvolutionDamage > 0 ? [{ id: "archer-pierce" as UpgradeId, amount: pierceEvolutionDamage * state.combatStats.magicPower, damageType: "magic" as SkillDamageType }] : []),
      ...(sealedEvolutionDamage > 0 ? [{ id: "mage-mana-blast" as UpgradeId, amount: sealedEvolutionDamage * state.combatStats.magicPower, damageType: "magic" as SkillDamageType }] : []),
    ],
    guardWasReady: brick.guardReady,
    bypassGuard: false,
    poisonLevel: Math.max(0, skillValue(state, "poison")),
    appliedDamage: 0,
    passesThrough: false,
    skillActivations: [],
  };
  applyDirectSkillModifiers(state, context);
  return context;
}

function applyDirectHitDamage(state: CanonicalState, context: DirectHitContext) {
  if (context.guardWasReady) {
    breakBrickGuard(state, context.brick);
    if (!context.bypassGuard) {
      if (evolved(state, "common-damage")) {
        context.appliedDamage = applyBrickDamage(state, context.brick, { amount: context.physicalDamage, damageType: "physical", delivery: "ball", sourceBall: context.ball }).applied;
      }
      return;
    }
  }
  if (context.poisonLevel > 0) {
    context.brick.poisonTime = Math.max(context.brick.poisonTime, 5);
    context.brick.poisonTick = Math.min(context.brick.poisonTick || 1, Math.max(0.25, context.poisonLevel));
  }
  context.appliedDamage = applyBrickDamage(state, context.brick, { amount: context.physicalDamage, damageType: "physical", delivery: "ball", sourceBall: context.ball }).applied;
  for (const packet of context.skillDamagePackets) {
    context.appliedDamage += applyBrickDamage(state, context.brick, { amount: packet.amount, damageType: packet.damageType, delivery: "skill", sourceBall: context.ball, sourceSkillId: packet.id }).applied;
  }
}

function emitDirectSkillActivations(state: CanonicalState, context: DirectHitContext) {
  for (const activation of context.skillActivations) {
    const config = skill(state, activation.id);
    if (!config) continue;
    emitCanonicalVisual(state, {
      kind: "skill",
      skillId: activation.id,
      x: context.brick.x + context.brick.w / 2,
      y: context.brick.y + context.brick.h / 2,
      radius: config.category === "warrior" ? 66 : 58,
      duration: 0.45,
      color: config.color,
      text: config.name,
    });
    recordSkillActivation(state, activation.id);
  }
}

function applyLinkedPayload(state: CanonicalState, context: DirectHitContext) {
  const linkLevel = Math.max(0, Number(context.ball.payloads.link ?? 0));
  if (linkLevel <= 0 || !context.brick.alive) return;
  const radius = 100 + (linkLevel - 1) * 30;
  const count = Math.max(1, Math.floor(skillValue(state, "link")));
  const linked = state.bricks
    .filter((target) => target.alive && target !== context.brick && target.kind !== "boss-core" && target.trait !== "indestructible")
    .map((target) => ({ target, distance: Math.hypot(target.x - context.brick.x, target.y - context.brick.y) }))
    .filter((entry) => entry.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
  for (const entry of linked) applyBrickDamage(state, entry.target, { amount: 1, damageType: "physical", delivery: "environment", sourceBall: context.ball, respectGuard: true });
}

function applyPostDirectHitEffects(state: CanonicalState, context: DirectHitContext) {
  emitDirectSkillActivations(state, context);
  const centerTargets = () => state.bricks.filter((target) => target.alive && target !== context.brick && target.trait !== "indestructible").sort((a, b) => brickDistance(a, context.brick) - brickDistance(b, context.brick));
  if (context.skillActivations.some((activation) => activation.id === "warrior-smash") && evolved(state, "warrior-smash") && skill(state, "warrior-smash")?.traits.includes("splash")) {
    const smashRadius = Math.max(20, traitValue(state, "warrior-smash", "splash")) * (1 + skillValue(state, "common-skill-range") / 100) + (evolved(state, "common-skill-range") ? 32 : 0);
    const packet = traitDamagePacket(state, "warrior-smash", "splash");
    for (const target of centerTargets().filter((entry) => brickDistance(entry, context.brick) <= smashRadius).slice(0, 2)) applyBrickDamage(state, target, { amount: packet.amount, damageType: packet.damageType, delivery: "skill", sourceBall: context.ball, sourceSkillId: "warrior-smash", respectGuard: true });
  }
  if (!context.brick.alive && context.originalTrait !== "standard" && context.skillActivations.some((activation) => activation.id === "warrior-crush") && evolved(state, "warrior-crush")) {
    const damageType = traitConfig(state, "warrior-crush", "crush")?.damageType ?? "magic";
    const amount = damageType === "physical" ? state.combatStats.physicalPower : state.combatStats.magicPower;
    for (const target of state.bricks.filter((entry) => entry.alive && entry.trait === context.originalTrait)) applyBrickDamage(state, target, { amount, damageType, delivery: "skill", sourceBall: context.ball, sourceSkillId: "warrior-crush", respectGuard: true });
  }
  if (context.frostBonus > 0 && evolved(state, "mage-freeze")) {
    for (const target of centerTargets().slice(0, 2)) target.frostVulnerability = Math.max(target.frostVulnerability, 1);
  }
  if (evolved(state, "common-ball-size")) {
    const impactRadius = Math.max(30, context.ball.radius * 4);
    for (const target of centerTargets().filter((entry) => brickDistance(entry, context.brick) <= impactRadius)) applyBrickDamage(state, target, { amount: 1, damageType: "physical", delivery: "environment", sourceBall: context.ball, respectGuard: true });
  }
  applyLinkedPayload(state, context);
  if (!context.guardWasReady || context.bypassGuard) triggerCollisionSkills(state, context.ball, context.brick, { repeatedTarget: context.repeatedTarget, originalTrait: context.originalTrait, destroyed: !context.brick.alive });
  context.passesThrough = context.ball.pierce > 0;
  if (context.passesThrough) context.ball.pierce--;
}

function resolveDestructibleDirectHit(state: CanonicalState, ball: CanonicalBall, brick: CanonicalBrick) {
  const context = prepareDirectHit(state, ball, brick);
  applyDirectHitDamage(state, context);
  applyPostDirectHitEffects(state, context);
  return context;
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
  emitCanonicalEvent(state, { type: "wave-cleared", wave: state.wave, boss: Boolean(definition.boss) });
  if (state.wave >= state.targetWave) {
    state.complete = true;
    state.phase = "complete";
    emitCanonicalEvent(state, { type: "run-completed", wave: state.wave });
    return;
  }
  if (state.interactive) {
    state.clearedWave = state.wave;
    state.clearedBoss = Boolean(definition.boss);
    state.pendingWave = state.wave + 1;
    state.phase = "wave-cleared";
    return;
  }
  prepareNextCanonicalWave(state);
}

function prepareNextCanonicalWave(state: CanonicalState) {
  const nextWave = state.pendingWave ?? state.wave + 1;
  state.wave = nextWave;
  state.waveElapsed = 0;
  state.rowTimer = 0;
  state.overdriveLevel = 0;
  state.paddleX = GAME_WIDTH / 2;
  state.lastMove = 0;
  state.moveBoostTime = 0;
  state.balls = [makeBall(state, state.paddleX)];
  state.items = [];
  state.gravityWells = [];
  state.sharedSkillCooldowns = {};
  state.itemBarrierTime = 0;
  state.barrierCharges = 0;
  state.barrierTime = 0;
  state.pendingWave = null;
  state.clearedWave = null;
  state.clearedBoss = false;
  buildWave(state, state.wave);
  if (evolved(state, "common-xp")) state.coreHp = Math.min(state.maxCoreHp, state.coreHp + 1);
}

export function createCanonicalState(options: { seed: number; targetWave?: number; balance?: BalanceConfig; skills?: SkillConfig[]; waves?: WaveDefinition[]; legacyEnchantments?: Partial<Record<LegacyUpgradeId, number>>; interactive?: boolean; startingSkills?: UpgradeId[] }): CanonicalState {
  const runConfig: CanonicalRunConfig = {
    balance: { ...DEFAULT_BALANCE_CONFIG, ...options.balance },
    skills: (options.skills?.length ? options.skills : DEFAULT_SKILLS).map((config) => ({ ...config, traits: [...config.traits], traitConfigs: (config.traitConfigs ?? []).map((trait) => ({ ...trait, values: [...trait.values] as [number, number, number], damage: [...trait.damage] as [number, number, number] })), levels: [...config.levels] as [number, number, number], skillDamage: [...config.skillDamage] as [number, number, number], magicDamage: config.magicDamage ? [...config.magicDamage] as [number, number, number] : null, cooldown: [...config.cooldown] as [number, number, number] })),
    waves: (options.waves?.length === WAVE_DEFINITIONS.length ? options.waves : WAVE_DEFINITIONS).map((wave) => ({ ...wave, pattern: [...wave.pattern] })),
    targetWave: options.targetWave ?? 20,
    startingSkills: [...(options.startingSkills ?? [])],
  };
  const interactive = options.interactive ?? false;
  const state: CanonicalState = {
    seed: options.seed, rng: { world: options.seed >>> 0 || 1, reward: (options.seed ^ 0x9e3779b9) >>> 0 || 1 }, runConfig, tick: 0, eventSequence: 0, phase: interactive ? "awaiting-start-skill" : "running", interactive, pendingChoices: [], pendingBossChoices: [], rerollsLeft: 1, pendingWave: null, clearedWave: null, clearedBoss: false, gameOverReason: null, stepEvents: [], balance: runConfig.balance, skills: runConfig.skills, waves: runConfig.waves, targetWave: runConfig.targetWave,
    wave: 1, waveElapsed: 0, elapsed: 0, rowTimer: 0, itemBarrierTime: 0, overdriveLevel: 0, paddleX: GAME_WIDTH / 2, paddleWidth: BASE_PADDLE_WIDTH, lastMove: 0, moveBoostTime: 0, balls: [], bricks: [], items: [], gravityWells: [], upgrades: [], bossEnhancements: {}, legacyEnchantments: { ...(options.legacyEnchantments ?? {}) }, echoSplitReflections: 0, safetyBlocks: [], ghostPaddles: [], skillHistory: [], skillMetrics: {}, sharedSkillCooldowns: {}, combatStats: { physicalPower: 1, magicPower: 1 }, waveMetrics: [], coreHp: 8, maxCoreHp: 8, score: 0, bricksBroken: 0, combo: 0, maxCombo: 0, ballLosses: 0, maxBalls: 1, totalDamage: 0, physicalDamage: 0, magicDamage: 0, lastDamageElapsed: 0, reflectorBlockedHits: 0, barrierTime: 0, barrierCharges: 0, bossAttackTimer: 0, bossPattern: 0, lastShotTimer: 0, nextBrickId: 1, complete: false, gameOver: false,
  };
  buildWave(state, 1);
  state.balls = [makeBall(state)];
  for (const id of runConfig.startingSkills) grantCanonicalSkill(state, id, "start");
  state.stepEvents.length = 0;
  if (interactive && runConfig.startingSkills.length === 0) state.pendingChoices = createCanonicalChoices(state);
  else if (runConfig.startingSkills.length > 0) state.phase = "running";
  return state;
}

export function grantCanonicalSkill(state: CanonicalState, skillId: UpgradeId, source: CanonicalSkillEvent["source"], ballCost: 0 | 1 | 2 = 0) {
  const config = skill(state, skillId);
  const maxPicks = config?.evolution ? 4 : 3;
  if (pickCount(state, skillId) >= maxPicks) return false;
  const previousValue = skillValue(state, skillId);
  state.upgrades.push(skillId);
  const nextLevel = levelOf(state, skillId);
  const nextValue = skillValue(state, skillId);
  state.skillHistory.push({ wave: state.wave, skillId, level: nextLevel, evolved: evolved(state, skillId), source, ballCost });
  emitCanonicalEvent(state, { type: "upgrade-chosen", skillId, level: nextLevel, source });
  if (skillId === "common-xp") {
    const gain = canonicalIntegerCombatAmount(nextValue - previousValue);
    state.maxCoreHp += gain;
    state.coreHp += gain;
  }
  if (skillId === "common-ball-size") {
    for (const ball of state.balls) ball.radius = 8 + nextValue;
  }
  if (skillId === "common-damage") {
    refreshCanonicalCombatStats(state);
  }
  if (skillId === "common-magic") refreshCanonicalCombatStats(state);
  state.paddleWidth = Math.min(280, BASE_PADDLE_WIDTH + skillValue(state, "common-wide"));
  return true;
}

export function grantCanonicalEnhancement(state: CanonicalState, skillId: UpgradeId) {
  if (!state.upgrades.includes(skillId)) return false;
  const previousValue = skillValue(state, skillId);
  state.bossEnhancements[skillId] = (state.bossEnhancements[skillId] ?? 0) + 1;
  const nextValue = skillValue(state, skillId);
  if (skillId === "common-xp") {
    const gain = canonicalIntegerCombatAmount(nextValue - previousValue);
    state.maxCoreHp += gain;
    state.coreHp += gain;
  }
  if (skillId === "common-wide") state.paddleWidth = Math.min(280, BASE_PADDLE_WIDTH + nextValue);
  if (skillId === "common-ball-size") {
    for (const ball of state.balls) ball.radius = 8 + nextValue;
  }
  if (skillId === "common-damage") {
    refreshCanonicalCombatStats(state);
  }
  if (skillId === "common-magic") refreshCanonicalCombatStats(state);
  state.skillHistory.push({ wave: state.wave, skillId, level: levelOf(state, skillId), source: "boss" });
  emitCanonicalEvent(state, { type: "upgrade-chosen", skillId, level: levelOf(state, skillId), source: "boss" });
  return true;
}

export function dispatchCanonicalCommand(state: CanonicalState, command: CanonicalCommand): CanonicalStepResult {
  state.stepEvents.length = 0;
  if (command.type === "choose-start-skill" && state.phase === "awaiting-start-skill") {
    const choice = state.pendingChoices.find((entry) => entry.upgrade.id === command.skillId && entry.ballCost === command.ballCost);
    if (choice && grantCanonicalSkill(state, choice.upgrade.id, "start", choice.ballCost)) {
      state.pendingChoices = [];
      state.phase = "running";
    }
  } else if (command.type === "choose-wave-skill" && state.phase === "awaiting-wave-skill") {
    const choice = state.pendingChoices.find((entry) => entry.upgrade.id === command.skillId && entry.ballCost === command.ballCost);
    if (choice && grantCanonicalSkill(state, choice.upgrade.id, "wave", choice.ballCost)) {
      state.pendingChoices = [];
      state.phase = "ready-for-next-wave";
    }
  } else if (command.type === "reroll-skills" && (state.phase === "awaiting-start-skill" || state.phase === "awaiting-wave-skill") && state.rerollsLeft > 0) {
    const excluded = state.pendingChoices.map((entry) => entry.upgrade.id);
    const next = createCanonicalChoices(state, excluded);
    state.pendingChoices = next.length >= 3 ? next : createCanonicalChoices(state);
    state.rerollsLeft -= 1;
  } else if (command.type === "skip-wave-skill" && state.phase === "awaiting-wave-skill") {
    state.pendingChoices = [];
    state.phase = "ready-for-next-wave";
  } else if (command.type === "acknowledge-wave-clear" && state.phase === "wave-cleared") {
    state.rerollsLeft = 1;
    if (state.clearedBoss) {
      state.pendingBossChoices = createBossChoices(state);
      state.phase = state.pendingBossChoices.length ? "awaiting-boss-reward" : "ready-for-next-wave";
    } else {
      state.pendingChoices = createCanonicalChoices(state);
      state.phase = state.pendingChoices.length ? "awaiting-wave-skill" : "ready-for-next-wave";
    }
  } else if (command.type === "choose-boss-reward" && state.phase === "awaiting-boss-reward") {
    if (state.pendingBossChoices.includes(command.skillId) && grantCanonicalEnhancement(state, command.skillId)) {
      state.pendingBossChoices = [];
      state.phase = "ready-for-next-wave";
    }
  } else if (command.type === "start-next-wave" && state.phase === "ready-for-next-wave") {
    prepareNextCanonicalWave(state);
    state.phase = "running";
  }
  return stepResult(state);
}

export function stepCanonicalEngine(state: CanonicalState, controls: CanonicalControls, dt = FIXED_STEP_SECONDS, options: CanonicalStepOptions = {}): CanonicalStepResult {
  state.stepEvents.length = 0;
  if (state.complete) { state.phase = "complete"; return stepResult(state); }
  if (state.gameOver) { state.phase = "game-over"; return stepResult(state); }
  if (state.phase !== "running") return stepResult(state);
  state.tick += 1;
  // Keep externally visible metrics safe even if a malformed optional skill
  // result/config reaches the simulation. A NaN score would poison HUD,
  // benchmark records, and subsequent comparisons.
  if (!Number.isFinite(state.score)) state.score = 0;
  const step = options.clampToFixedStep === false
    ? Math.max(0, Math.min(0.025, dt))
    : Math.max(0, Math.min(FIXED_STEP_SECONDS, dt));
  state.elapsed += step;
  state.waveElapsed += step;
  state.lastShotTimer = Math.max(0, state.lastShotTimer - step);
  state.rowTimer += step;
  const nextOverdriveLevel = overdriveLevelAt(state.rowTimer);
  if (nextOverdriveLevel > state.overdriveLevel) {
    const ratio = overdriveMultiplier(nextOverdriveLevel) / Math.max(1, overdriveMultiplier(state.overdriveLevel));
    // Respawn recovery normalizes speed below, so let its easing target the
    // new global multiplier instead of immediately overwriting this scale.
    for (const ball of state.balls) {
      if (ball.respawnRecoveryTime > 0) continue;
      ball.vx *= ratio;
      ball.vy *= ratio;
      if (ball.gravityBaseSpeed !== null) ball.gravityBaseSpeed *= ratio;
      if (ball.explosionBaseSpeed !== null) ball.explosionBaseSpeed *= ratio;
    }
    state.overdriveLevel = nextOverdriveLevel;
  }
  state.itemBarrierTime = Math.max(0, state.itemBarrierTime - step);
  state.barrierTime = Math.max(0, state.barrierTime - step);
  const moveMultiplier = 1 + skillValue(state, "common-move-speed") / 100;
  if (evolved(state, "common-move-speed") && controls.move !== 0 && state.lastMove !== 0 && controls.move !== state.lastMove) state.moveBoostTime = 0.35;
  state.moveBoostTime = Math.max(0, state.moveBoostTime - step);
  if (controls.move !== 0) state.lastMove = controls.move;
  const reversalBoost = state.moveBoostTime > 0 ? 1.4 : 1;
  const previousPaddleX = state.paddleX;
  state.paddleX = Math.max(state.paddleWidth / 2, Math.min(GAME_WIDTH - state.paddleWidth / 2, state.paddleX + controls.move * PADDLE_SPEED * moveMultiplier * reversalBoost * step));
  // Ghost paddles occupy independent horizontal zones and follow the lowest
  // descending ball, matching the legacy activeGhosts controller.
  const ghostCount = state.ghostPaddles.length;
  if (ghostCount > 0) {
    const tracked = [...state.balls].filter((ball) => ball.vy > 0).sort((a, b) => b.y - a.y)[0];
    for (let index = 0; index < ghostCount; index += 1) {
      if (state.ghostPaddleActive && state.ghostPaddleActive[index] === false) continue;
      const zoneWidth = GAME_WIDTH / ghostCount;
      const zoneStart = zoneWidth * index;
      const width = state.ghostPaddleWidths?.[index] ?? 92;
      const speed = state.ghostPaddleSpeeds?.[index] ?? Math.max(125, 210 - (state.wave - 1) * 6);
      const target = tracked?.x ?? zoneStart + zoneWidth / 2;
      const clamped = Math.max(zoneStart + width / 2, Math.min(zoneStart + zoneWidth - width / 2, target));
      state.ghostPaddles[index] += Math.max(-speed * step, Math.min(speed * step, clamped - state.ghostPaddles[index]));
    }
  }
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    brick.healBlockTime = Math.max(0, brick.healBlockTime - step);
    brick.traitLockTime = Math.max(0, brick.traitLockTime - step);
    // A freeze mark is a stored next-hit modifier. It is consumed only by
    // prepareDirectHit and never expires as wall-clock time advances.
    if (brick.trait === "healer" && brick.traitLockTime <= 0) {
      brick.healTimer -= step;
      if (brick.healTimer <= 0) {
        brick.healTimer += 3;
        const healerCenterX = brick.x + brick.w / 2;
        const healerCenterY = brick.y + brick.h / 2;
        let healed = false;
        for (const near of state.bricks) {
          const nearCenterX = near.x + near.w / 2;
          const nearCenterY = near.y + near.h / 2;
          if (near.alive && near !== brick && near.healBlockTime <= 0 && Math.hypot(nearCenterX - healerCenterX, nearCenterY - healerCenterY) < 135) {
            const previousHp = near.hp;
            near.hp = Math.min(near.maxHp, near.hp + 1);
            const restored = near.hp - previousHp;
            if (restored > 0) {
              healed = true;
              emitCanonicalEvent(state, { type: "brick-healed", brickIndex: near.id, amount: restored, hp: near.hp, maxHp: near.maxHp, x: nearCenterX, y: nearCenterY });
            }
          }
        }
        if (healed) emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: healerCenterX, y: healerCenterY, radius: 135, duration: 0.7, color: "#72f1b8", text: "HEAL PULSE +1" });
      }
    }
    if (brick.burnTime > 0) {
      brick.burnTime -= step;
      brick.burnTick -= step;
      if (brick.burnTick <= 0) {
        brick.burnTick += 1;
        applyBrickDamage(state, brick, { amount: Math.max(0, brick.burnDamage), damageType: brick.burnDamageType ?? "magic", delivery: "dot", sourceBall: state.balls[0], sourceSkillId: brick.burnSourceSkillId ?? undefined, respectGuard: true });
      }
    }
    if (brick.poisonTime > 0) {
      brick.poisonTime = Math.max(0, brick.poisonTime - step);
      brick.poisonTick -= step;
      if (brick.poisonTick <= 0) {
        brick.poisonTick += 1;
        applyBrickDamage(state, brick, { amount: Math.max(1, Math.round(skillValue(state, "poison"))), damageType: "magic", delivery: "dot", sourceBall: state.balls[0], sourceSkillId: "poison" as UpgradeId, respectGuard: true });
      }
    }
  }
  for (const well of state.gravityWells) {
    well.life -= step;
    well.damageTick -= step;
    if (well.damagePerSecond <= 0 || well.damageTick > 0) continue;
    well.damageTick += 1;
    for (const brick of state.bricks) {
      if (!brick.alive || brick.trait === "indestructible") continue;
      if (Math.hypot(brick.x + brick.w / 2 - well.x, brick.y + brick.h / 2 - well.y) <= well.radius) applyBrickDamage(state, brick, { amount: well.damagePerSecond, damageType: well.damageType ?? "magic", delivery: "dot", sourceBall: state.balls[0], sourceSkillId: well.sourceSkillId, respectGuard: true });
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
    const fullScreenMagnet = evolved(state, "common-magnet");
    if (magnetRange > 0 && (fullScreenMagnet || Math.hypot(item.x - state.paddleX, item.y - PLAYER_PADDLE_Y) <= magnetRange)) {
      const attraction = Math.min(1, step * (fullScreenMagnet ? 16 : 9));
      item.x += (state.paddleX - item.x) * attraction;
      if (fullScreenMagnet) item.y += (PLAYER_PADDLE_Y - item.y) * attraction * 0.35;
    }
    if (item.y >= PLAYER_PADDLE_Y - 8 && item.y <= PLAYER_PADDLE_Y + 22 && Math.abs(item.x - state.paddleX) <= state.paddleWidth / 2) {
      item.alive = false;
      emitCanonicalEvent(state, { type: "item-collected", kind: item.kind, x: item.x, y: item.y });
      if (item.kind === "multiball") {
        const multiball = makeBall(state, state.paddleX, true);
        multiball.canTriggerSkills = true;
        state.balls.push(multiball);
      }
      else if (item.kind === "auto-barrier") state.itemBarrierTime = 10;
      else if (item.kind === "core-repair") state.coreHp = Math.min(state.maxCoreHp, state.coreHp + 1);
      else {
        state.sharedSkillCooldowns = {};
        for (const ball of state.balls) ball.cooldowns = {};
      }
    } else if (item.y > GAME_HEIGHT + 20) item.alive = false;
  }
  state.items = state.items.filter((item) => item.alive);
  const lastShotLevel = Math.max(0, skillValue(state, "last-shot"));
  if (lastShotLevel > 0 && state.lastShotTimer <= 0) {
    const target = state.bricks.filter((brick) => brick.alive && brick.trait !== "indestructible")
      .sort((a, b) => b.y - a.y || Math.abs(a.x - state.paddleX) - Math.abs(b.x - state.paddleX))[0];
    if (target) {
      const source = state.balls[0];
      if (source) applyBrickDamage(state, target, { amount: 1, damageType: "physical", delivery: "environment", sourceBall: source, respectGuard: true });
      emitCanonicalVisual(state, { kind: "impact", skillId: "last-shot" as UpgradeId, x: target.x + target.w / 2, y: target.y + target.h / 2, radius: 48, duration: 0.35, color: "#ff6b87" });
    }
    state.lastShotTimer = Math.max(0.25, lastShotLevel);
  }
  const overdrive = overdriveMultiplier(state.overdriveLevel);
  let lostMainBall = false;
  let lostBallCount = 0;
  for (const rawId of Object.keys(state.sharedSkillCooldowns)) {
    const id = rawId as UpgradeId;
    const remaining = Math.max(0, (state.sharedSkillCooldowns[id] ?? 0) - step);
    state.sharedSkillCooldowns[id] = remaining;
    for (const ball of state.balls) ball.cooldowns[id] = remaining;
  }
  for (const ball of [...state.balls]) {
    ball.visualSkillTime = Math.max(0, ball.visualSkillTime - step);
    if (ball.visualSkillTime <= 0) ball.visualSkill = null;
    ball.missileTime = Math.max(0, ball.missileTime - step);
    if (ball.explosionBoostTime > 0) {
      ball.explosionBoostTime = Math.max(0, ball.explosionBoostTime - step);
      if (ball.explosionBoostTime <= 0) clearExplosionSpeedBoost(ball);
    }
    if (ball.missileTime > 0) {
      const target = state.bricks
        .filter((brick) => brick.alive && brick.trait !== "indestructible")
        .map((brick) => ({ brick, distance: Math.hypot(brick.x + brick.w / 2 - ball.x, brick.y + brick.h / 2 - ball.y) }))
        .sort((a, b) => a.distance - b.distance)[0]?.brick;
      if (target) {
        const speed = Math.max(380, Math.hypot(ball.vx, ball.vy));
        const currentAngle = Math.atan2(ball.vy, ball.vx);
        const targetAngle = Math.atan2(target.y + target.h / 2 - ball.y, target.x + target.w / 2 - ball.x);
        const delta = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
        const turn = Math.max(-5.4 * step, Math.min(5.4 * step, delta));
        ball.vx = Math.cos(currentAngle + turn) * speed;
        ball.vy = Math.sin(currentAngle + turn) * speed;
      }
    }
    if (ball.temporary && ball.temporaryTime > 0) {
      ball.temporaryTime = Math.max(0, ball.temporaryTime - step);
      if (ball.temporaryTime <= 0) { state.balls.splice(state.balls.indexOf(ball), 1); continue; }
    }
    for (const rawId of Object.keys(ball.cooldowns)) {
      const id = rawId as UpgradeId;
      if (skill(state, id)?.applicationScope !== "shared") ball.cooldowns[id] = Math.max(0, ball.cooldowns[id] - step);
    }
    if (ball.respawnRecoveryTime > 0) {
      ball.respawnRecoveryTime = Math.max(0, ball.respawnRecoveryTime - step);
      const progress = 1 - ball.respawnRecoveryTime / Math.max(0.001, ball.respawnRecoveryDuration);
      const easedProgress = progress * progress * (3 - progress * 2);
      const desiredSpeed = ball.respawnRecoveryBaseSpeed * (1 + (overdrive - 1) * easedProgress);
      const currentSpeed = Math.max(1, Math.hypot(ball.vx, ball.vy));
      ball.vx *= desiredSpeed / currentSpeed;
      ball.vy *= desiredSpeed / currentSpeed;
    }
    const well = ball.missileTime > 0 ? undefined : state.gravityWells.find((entry) => Math.hypot(entry.x - ball.x, entry.y - ball.y) < entry.radius);
    if (well) {
      const dx = well.x - ball.x;
      const dy = well.y - ball.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      ball.gravityBaseSpeed ??= Math.max(1, Math.hypot(ball.vx, ball.vy));
      const inwardX = dx / distance;
      const inwardY = dy / distance;
      let tangentX = -inwardY;
      let tangentY = inwardX;
      if (ball.vx * tangentX + ball.vy * tangentY < 0) { tangentX *= -1; tangentY *= -1; }
      const lifeRatio = Math.max(0, Math.min(1, well.life / 4));
      const convergence = 1 - lifeRatio;
      const orbitRadius = well.radius * (0.06 + 0.4 * lifeRatio);
      const correction = Math.max(-0.72, Math.min(0.72, (distance - orbitRadius) / Math.max(1, orbitRadius)));
      const tangentWeight = 1 - convergence * 0.82;
      const inwardWeight = 0.05 + convergence * 1.8;
      const targetX = tangentX * tangentWeight + inwardX * (correction + inwardWeight);
      const targetY = tangentY * tangentWeight + inwardY * (correction + inwardWeight);
      const length = Math.max(0.001, Math.hypot(targetX, targetY));
      const desiredVx = targetX / length * ball.gravityBaseSpeed;
      const desiredVy = targetY / length * ball.gravityBaseSpeed;
      const steering = Math.min(1, step * (4 + convergence * 8));
      ball.vx += (desiredVx - ball.vx) * steering;
      ball.vy += (desiredVy - ball.vy) * steering;
      const steeredSpeed = Math.max(1, Math.hypot(ball.vx, ball.vy));
      ball.vx *= ball.gravityBaseSpeed / steeredSpeed;
      ball.vy *= ball.gravityBaseSpeed / steeredSpeed;
    } else if (ball.gravityBaseSpeed !== null) {
      const affectedSpeed = Math.max(1, Math.hypot(ball.vx, ball.vy));
      ball.vx *= ball.gravityBaseSpeed / affectedSpeed;
      ball.vy *= ball.gravityBaseSpeed / affectedSpeed;
      ball.gravityBaseSpeed = null;
    }
    const previousBallX = ball.x;
    const previousBallY = ball.y;
    ball.x += ball.vx * step;
    ball.y += ball.vy * step;
    if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); normalizeBallAngle(ball); }
    if (ball.x + ball.radius > GAME_WIDTH) { ball.x = GAME_WIDTH - ball.radius; ball.vx = -Math.abs(ball.vx); normalizeBallAngle(ball); }
    if (ball.y - ball.radius < 0) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); normalizeBallAngle(ball); }
    if (ball.vy > 0) {
      const paddleContact = sweptPaddleContact(
        ball,
        previousBallX,
        previousBallY,
        { x: state.paddleX, previousX: previousPaddleX, y: PLAYER_PADDLE_Y, width: state.paddleWidth + (evolved(state, "common-wide") ? 40 : 0) },
        4,
        18,
        10,
      );
      if (!paddleContact) {
        // Continue into brick/loss processing below.
      } else {
      ball.x = paddleContact.contactX;
      ball.y = PLAYER_PADDLE_Y - ball.radius - 0.1;
      // Preserve legacy paddle-collision parity: a rebound keeps the incoming
      // ball speed (subject only to the same minimum), and player aim is
      // evaluated from the swept contact point rather than paddle center.
      const speed = Math.max(300, Math.hypot(ball.vx, ball.vy));
      const aim = paddleAimDirection(paddleContact.contactX, PLAYER_PADDLE_Y, controls.aimX, controls.aimY);
      ball.vx = aim.horizontalRatio * speed;
      ball.vy = aim.verticalRatio * speed;
      state.combo = evolved(state, "common-combo") ? Math.floor(state.combo / 2) : 0;
      emitCanonicalEvent(state, { type: "paddle-reflected", x: paddleContact.contactX, y: PLAYER_PADDLE_Y });
      const echoThreshold = canonicalEchoSplitThreshold(state);
      if (echoThreshold > 0 && ++state.echoSplitReflections >= echoThreshold) {
        state.echoSplitReflections = 0;
        state.balls.push(cloneEchoSplitBall(state, ball));
        emitCanonicalVisual(state, { kind: "skill", skillId: "echo-split" as UpgradeId, x: state.paddleX, y: PLAYER_PADDLE_Y, radius: 68, duration: 0.6, color: "#fff27a" });
      }
      }
    }
    if (ball.vy > 0 && state.ghostPaddles.length > 0) {
      for (let index = 0; index < state.ghostPaddles.length; index += 1) {
        if (state.ghostPaddleActive && state.ghostPaddleActive[index] === false) continue;
        const width = state.ghostPaddleWidths?.[index] ?? 92;
        const contact = sweptPaddleContact(ball, previousBallX, previousBallY, {
          x: state.ghostPaddles[index], previousX: state.ghostPaddles[index], y: GAME_HEIGHT - 42, width,
        }, 4, 18, 10);
        if (!contact) continue;
        const speed = Math.max(300, Math.hypot(ball.vx, ball.vy));
        const ratio = Math.max(-0.84, Math.min(0.84, contact.hitRatio * 0.74));
        ball.x = contact.contactX;
        ball.y = GAME_HEIGHT - 42 - ball.radius - 0.1;
        ball.vx = ratio * speed;
        ball.vy = -Math.sqrt(Math.max(1, speed * speed - ball.vx * ball.vx));
        normalizeBallAngle(ball);
        break;
      }
    }
    for (const brick of state.bricks) {
      if (!brick.alive) continue;
      const collision = circleRect(ball, brick);
      if (!collision) continue;
      const indestructible = brick.trait === "indestructible";
      if (indestructible) {
        emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, radius: 34, duration: 0.35, color: "#aeb8ca" });
      }
      const protectedUnderside = brick.trait === "reflector" && brick.traitLockTime <= 0 && collision.ny > 0 && ball.vy < 0;
      let passesThrough = false;
      const explosionBoostTimeBeforeHit = ball.explosionBoostTime;
      if (!indestructible && !protectedUnderside) {
        passesThrough = resolveDestructibleDirectHit(state, ball, brick).passesThrough;
      } else if (protectedUnderside) {
        state.reflectorBlockedHits++;
        emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: brick.x + brick.w / 2, y: brick.y + brick.h, radius: 48, duration: 0.4, color: "#65dcff" });
      }
      const explosionLaunched = ball.explosionBoostTime > explosionBoostTimeBeforeHit;
      if (explosionLaunched) {
        const speed = Math.max(1, Math.hypot(ball.vx, ball.vy));
        ball.x += ball.vx / speed * 1.5;
        ball.y += ball.vy / speed * 1.5;
      } else if (passesThrough) {
        if (collision.nx < 0) ball.x = brick.x + brick.w + ball.radius + 0.1;
        else if (collision.nx > 0) ball.x = brick.x - ball.radius - 0.1;
        else if (collision.ny < 0) ball.y = brick.y + brick.h + ball.radius + 0.1;
        else ball.y = brick.y - ball.radius - 0.1;
      } else {
        if (collision.nx) ball.vx = collision.nx * Math.abs(ball.vx); else ball.vy = collision.ny * Math.abs(ball.vy);
        ball.x += collision.nx * 1.5;
        ball.y += collision.ny * 1.5;
      }
      normalizeBallAngle(ball);
      break;
    }
    if (ball.y - ball.radius > GAME_HEIGHT) {
      if (state.itemBarrierTime > 0) {
        ball.y = GAME_HEIGHT - ball.radius;
        ball.vy = -Math.abs(ball.vy);
        emitCanonicalEvent(state, { type: "barrier-reflected", x: ball.x, y: GAME_HEIGHT - 18, chargesRemaining: -1 });
      }
      else if (!ball.temporary && !ball.waveBonus && state.barrierCharges > 0) {
        state.barrierCharges--;
        ball.y = GAME_HEIGHT - ball.radius;
        ball.vy = -Math.abs(ball.vy);
        emitCanonicalEvent(state, { type: "barrier-reflected", x: ball.x, y: GAME_HEIGHT - 18, chargesRemaining: state.barrierCharges });
      }
      else {
        state.balls.splice(state.balls.indexOf(ball), 1);
        lostBallCount++;
        if (!ball.temporary && !ball.waveBonus) lostMainBall = true;
        emitCanonicalEvent(state, { type: "ball-out", x: ball.x, y: GAME_HEIGHT - 8, remainingBalls: state.balls.length });
      }
    }
  }
  state.ballLosses += lostBallCount;
  if (lostMainBall) {
    state.coreHp--;
    emitCanonicalEvent(state, {
      type: "core-damaged",
      amount: 1,
      remaining: Math.max(0, state.coreHp),
      x: state.paddleX,
      y: PLAYER_PADDLE_Y + 36,
      speedPercent: Math.round(overdriveMultiplier(state.overdriveLevel) * 100),
    });
    if (state.coreHp <= 0) {
      state.gameOver = true;
      state.gameOverReason = "core";
      state.phase = "game-over";
      emitCanonicalEvent(state, { type: "game-over", reason: "core" });
    }
    else state.balls.push(makeBall(state, state.paddleX, false, true));
  }
  state.maxBalls = Math.max(state.maxBalls, state.balls.length);
  const currentWaveIsBoss = Boolean(waveDefinitionFrom(state.waves, state.wave).boss);
  const bossCoreDestroyed = currentWaveIsBoss && !state.bricks.some((brick) => brick.alive && brick.kind === "boss-core");
  const normalWaveCleared = !currentWaveIsBoss && !state.bricks.some((brick) => brick.alive && brick.trait !== "indestructible");
  if (bossCoreDestroyed || normalWaveCleared) completeWave(state);
  return stepResult(state);
}

export function canonicalSnapshot(state: CanonicalState) {
  return {
    tick: state.tick, phase: state.phase, rng: { ...state.rng }, wave: state.wave, pendingWave: state.pendingWave, elapsed: Number(state.elapsed.toFixed(6)), waveElapsed: Number(state.waveElapsed.toFixed(6)), rowTimer: Number(state.rowTimer.toFixed(6)), itemBarrierTime: Number(state.itemBarrierTime.toFixed(6)), paddleX: Number(state.paddleX.toFixed(4)), lastMove: state.lastMove, moveBoostTime: Number(state.moveBoostTime.toFixed(4)), coreHp: state.coreHp, score: Number.isFinite(state.score) ? state.score : 0, bricksBroken: state.bricksBroken,
    balls: state.balls.map((ball) => ({ x: Number(ball.x.toFixed(4)), y: Number(ball.y.toFixed(4)), vx: Number(ball.vx.toFixed(4)), vy: Number(ball.vy.toFixed(4)), attackPower: ball.attackPower, pierce: ball.pierce, maxPierce: ball.maxPierce, payload: ball.payload, payloadLevel: ball.payloadLevel, payloads: { ...ball.payloads }, skillCharges: { ...ball.skillCharges }, cooldowns: { ...ball.cooldowns }, lastHitBrickId: ball.lastHitBrickId, explosionBaseSpeed: ball.explosionBaseSpeed === null ? null : Number(ball.explosionBaseSpeed.toFixed(4)), explosionBoostRatio: Number(ball.explosionBoostRatio.toFixed(6)), explosionBoostTime: Number(ball.explosionBoostTime.toFixed(6)) })),
    bricks: state.bricks.filter((brick) => brick.alive).map((brick) => [brick.id, Number(brick.hp.toFixed(3)), brick.guardReady, Number(brick.traitLockTime.toFixed(3)), Number(brick.frostVulnerability.toFixed(3))]),
    upgrades: [...state.upgrades], skillHistory: state.skillHistory.map((event) => ({ ...event })), sharedSkillCooldowns: { ...state.sharedSkillCooldowns }, complete: state.complete, gameOver: state.gameOver, combatStats: { ...state.combatStats }, totalDamage: Number(state.totalDamage.toFixed(3)), physicalDamage: Number(state.physicalDamage.toFixed(3)), magicDamage: Number(state.magicDamage.toFixed(3)), lastDamageElapsed: Number(state.lastDamageElapsed.toFixed(3)), reflectorBlockedHits: state.reflectorBlockedHits, barrierTime: Number(state.barrierTime.toFixed(3)), barrierCharges: state.barrierCharges, echoSplitReflections: state.echoSplitReflections,
    safetyBlocks: state.safetyBlocks.map((block) => ({ ...block })), ghostPaddles: [...state.ghostPaddles],
  };
}

export function serializeCanonicalState(state: CanonicalState) {
  return JSON.stringify(state, (key, value) => key === "stepEvents" ? undefined : value);
}

export function restoreCanonicalState(serialized: string): CanonicalState {
  const parsed = JSON.parse(serialized) as Omit<CanonicalState, "stepEvents">;
  const state = { ...parsed, stepEvents: [] } as CanonicalState;
  state.sharedSkillCooldowns ??= {};
  state.runConfig.startingSkills ??= [];
  state.balance = state.runConfig.balance;
  state.skills = state.runConfig.skills;
  for (const config of state.skills) {
    const fallback = DEFAULT_SKILLS.find((entry) => entry.id === config.id);
    config.enabled ??= true;
    config.applicationScope ??= "per-ball";
    config.builtIn ??= !config.id.startsWith("custom-");
    config.triggerType ??= fallback?.triggerType ?? "brick-hit";
    config.traits ??= [...(fallback?.traits ?? ["direct-damage"])] as SkillConfig["traits"];
    config.damageType ??= "magic";
    config.skillDamage ??= [...(config.magicDamage ?? fallback?.skillDamage ?? [0, 0, 0])] as [number, number, number];
  }
  state.waves = state.runConfig.waves;
  state.targetWave = state.runConfig.targetWave;
  state.lastMove ??= 0;
  state.moveBoostTime ??= 0;
  state.combatStats ??= { physicalPower: 1, magicPower: 1 };
  refreshCanonicalCombatStats(state);
  state.totalDamage = Math.max(0, Math.round(Number(state.totalDamage) || 0));
  state.physicalDamage = Math.max(0, Math.round(Number(state.physicalDamage ?? state.totalDamage) || 0));
  state.magicDamage = Math.max(0, Math.round(Number(state.magicDamage) || 0));
  state.maxCoreHp = canonicalIntegerCombatAmount(state.maxCoreHp);
  state.coreHp = Math.min(state.maxCoreHp, Math.max(0, Math.round(Number(state.coreHp) || 0)));
  for (const ball of state.balls) {
    ball.explosionBaseSpeed ??= null;
    ball.explosionBoostRatio ??= 1;
    ball.explosionBoostTime ??= 0;
  }
  for (const brick of state.bricks) {
    brick.maxHp = canonicalIntegerCombatAmount(brick.maxHp);
    brick.hp = brick.alive ? Math.min(brick.maxHp, canonicalIntegerCombatAmount(brick.hp)) : 0;
    brick.burnDamage ??= brick.burnTime > 0 ? 1 : 0;
    brick.burnDamageType ??= "magic";
    brick.burnSourceSkillId ??= brick.burnTime > 0 ? "mage-fireball" : null;
    brick.frostSourceSkillId ??= brick.frostVulnerability > 0 ? "mage-freeze" : null;
  }
  for (const well of state.gravityWells) well.damageType ??= "magic";
  for (const metric of Object.values(state.skillMetrics)) {
    if (metric) metric.damage = Math.max(0, Math.round(Number(metric.damage) || 0));
  }
  for (const ball of state.balls) {
    ball.canTriggerSkills ??= !ball.temporary;
    ball.skillGeneration ??= 0;
    ball.lastHitBrickId ??= null;
    ball.gravityBaseSpeed ??= null;
  }
  return state;
}

/** Ball-only parity phase; deliberately excludes brick/paddle/game rules. */
export function advanceCanonicalBallsPure(state: CanonicalState, dt: number, width = GAME_WIDTH, top = 0) {
  const step = Math.max(0, Math.min(0.025, dt));
  for (const ball of state.balls) {
    ball.x += ball.vx * step;
    ball.y += ball.vy * step;
    if (ball.x - ball.radius < 0) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); normalizeBallAngle(ball); }
    if (ball.x + ball.radius > width) { ball.x = width - ball.radius; ball.vx = -Math.abs(ball.vx); normalizeBallAngle(ball); }
    if (ball.y - ball.radius < top) { ball.y = top + ball.radius; ball.vy = Math.abs(ball.vy); normalizeBallAngle(ball); }
  }
  return state;
}

/** Brick-only parity phase; excludes skill dispatch and wave progression. */
export function resolveCanonicalBrickCollisionsPure(state: CanonicalState, previous: Map<CanonicalBall, { x: number; y: number }>, onEvent?: (event: { type: "brick-hit" | "brick-destroyed"; brick: CanonicalBrick; damage: number }) => void) {
  for (const ball of state.balls) {
    const prior = previous.get(ball) ?? { x: ball.x, y: ball.y };
    for (const brick of state.bricks) {
      if (!brick.alive || brick.trait === "indestructible") continue;
      const collision = circleRectangleCollision(ball, brick, prior.x, prior.y);
      if (!collision) continue;
      const damage = canonicalIntegerCombatAmount(ball.attackPower);
      brick.hp -= damage;
      if (brick.hp <= 0) { brick.hp = 0; brick.alive = false; state.bricksBroken += 1; }
      onEvent?.({ type: brick.hp <= 0 ? "brick-destroyed" : "brick-hit", brick, damage });
      if (collision.normalX) ball.vx = collision.normalX * Math.abs(ball.vx); else ball.vy = collision.normalY * Math.abs(ball.vy);
      break;
    }
  }
  return state;
}

export function resolveCanonicalPaddleCollisionPure(state: CanonicalState, previous: Map<CanonicalBall, { x: number; y: number }>, controls: CanonicalControls, options: { paddleY?: number; slop?: number; sideDepth?: number; forgiveness?: number; width?: number } = {}) {
  const paddleY = options.paddleY ?? PLAYER_PADDLE_Y;
  const width = options.width ?? GAME_WIDTH;
  for (const ball of state.balls) {
    if (ball.vy <= 0) continue;
    const prior = previous.get(ball) ?? { x: ball.x, y: ball.y };
    const contact = sweptPaddleContact(ball, prior.x, prior.y, { x: state.paddleX, previousX: state.paddleX, y: paddleY, width: state.paddleWidth + (evolved(state, "common-wide") ? 40 : 0) }, options.slop ?? 4, options.sideDepth ?? 18, options.forgiveness ?? 10);
    if (!contact) continue;
    ball.x = contact.contactX; ball.y = paddleY - ball.radius - 0.1;
    const speed = Math.max(300, Math.hypot(ball.vx, ball.vy));
    const ratio = Math.max(-0.84, Math.min(0.84, (controls.aimX - contact.contactX) / Math.max(1, width / 2)));
    ball.vx = ratio * speed; ball.vy = -Math.sqrt(Math.max(1, speed * speed - ball.vx * ball.vx));
    normalizeBallAngle(ball);
    return { contactX: contact.contactX, hitRatio: contact.hitRatio };
  }
  return null;
}
