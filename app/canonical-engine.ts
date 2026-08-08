import { DEFAULT_BALANCE_CONFIG, type BalanceConfig, type BotWaveSample } from "./balance-config";
import { DEFAULT_SKILLS, normalizeSkillConfigs, resolveSkillDescription, SKILL_MECHANIC_LABELS, SKILL_TRAIT_PRIORITY, SKILL_VFX_CONFIG, type LegacyUpgradeId, type SkillConfig, type SkillDamageType, type SkillEffectConfig, type SkillTrait, type UpgradeId } from "./skill-config";
import { WAVE_CELL_SIZE, WAVE_COLUMNS, WAVE_DEFINITIONS, blocksFromPattern, waveDefinitionFrom, type WaveDefinition } from "./wave-config";
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
  | { type: "launch-ball"; aimX: number; aimY: number }
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
export type CanonicalCombatStats = {
  physicalPower: number;
  magicPower: number;
  skillDamageMultiplier: number;
  skillRangeMultiplier: number;
  skillDurationMultiplier: number;
  skillCooldownMultiplier: number;
  chainBonus: number;
};
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
export type CanonicalBall = { x: number; y: number; vx: number; vy: number; radius: number; temporary: boolean; temporaryTime: number; missileTime: number; waveBonus: boolean; awaitingLaunch: boolean; launchWaitTime: number; visualSkill: UpgradeId | null; visualSkillTime: number; cooldowns: Record<string, number>; skillCharges: Partial<Record<UpgradeId, number>>; attackPower: number; pierce: number; maxPierce: number; payload: CanonicalPayloadId | null; payloadLevel: number; payloads: Partial<Record<CanonicalPayloadId, number>>; canTriggerSkills: boolean; skillGeneration: number; lastHitBrickId: number | null; gravityBaseSpeed: number | null; explosionBaseSpeed: number | null; explosionBoostRatio: number; explosionBoostTime: number; respawnRecoveryTime: number; respawnRecoveryDuration: number; respawnRecoveryBaseSpeed: number };
export type CanonicalBrick = { id: number; x: number; y: number; w: number; h: number; hp: number; maxHp: number; alive: boolean; trait: CanonicalTrait; guardReady: boolean; healTimer: number; healBlockTime: number; burnTime: number; burnTick: number; burnDamage: number; burnDamageType: SkillDamageType; burnSourceSkillId: UpgradeId | null; poisonTime: number; poisonTick: number; traitLockTime: number; frostVulnerability: number; frostSourceSkillId: UpgradeId | null; focusStacks: number; focusTimer: number; drop: CanonicalItemKind | null; kind: "normal" | "boss-core" | "boss-minion"; bossRow?: number; bossCol?: number };
export type CanonicalItem = { x: number; y: number; vy: number; kind: CanonicalItemKind; alive: boolean };
export type CanonicalActiveEffect = { id: string; kind: SkillEffectConfig["kind"]; target: SkillEffectConfig["target"]; scopeId?: string; order: number; radius: number; interval: number; timer: number; damage: number; damageType: SkillDamageType };
export type CanonicalGravityWell = { x: number; y: number; radius: number; life: number; damagePerSecond: number; damageType: SkillDamageType; damageTick: number; sourceSkillId: UpgradeId; activeEffects: CanonicalActiveEffect[] };
export type CanonicalBossBarrier = { x: number; y: number; w: number; h: number; life: number; maxLife: number; telegraph: number; hitCount: number; maxHits: number };
export type CanonicalBossWall = { id: number; x: number; y: number; w: number; h: number; baseX: number; baseY: number; life: number; maxLife: number; telegraph: number; hp: number; maxHp: number };
export type CanonicalBossShield = { active: boolean; life: number; maxLife: number; runeIds: number[] };
export type CanonicalBossArmorCell = { row: number; col: number };
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
  collisionGrid: Map<string, CanonicalBrick[]>;
  items: CanonicalItem[];
  gravityWells: CanonicalGravityWell[];
  bossBarriers: CanonicalBossBarrier[];
  bossWalls: CanonicalBossWall[];
  bossShield: CanonicalBossShield;
  bossArmorHp: number;
  bossArmorReformThresholds: boolean[];
  bossArmorReformTimer: number;
  bossArmorReformCells: CanonicalBossArmorCell[];
  bossIntroTimer: number;
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
  bossReinforcementIds: number[];
  bossReinforcementTimer: number;
  bossReinforcementTelegraph: number;
  lastShotTimer: number;
  nextBrickId: number;
  complete: boolean;
  gameOver: boolean;
  /** Legacy enchantment counters retained during the incremental migration. */
  legacyEnchantments: Partial<Record<LegacyUpgradeId, number>>;
  echoSplitReflections: number;
  /** Gameplay barrier geometry used for collision and projected for rendering. */
  safetyBlocks: Array<{ x: number; y: number; width: number; color: string }>;
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
    description: resolveSkillDescription(config),
    color: config.color,
  };
}

function availableSkillConfigs(state: CanonicalState) {
  return state.skills.filter((config) => {
    if (!config.enabled) return false;
    const maximum = config.evolutionEnabled ? 4 : 3;
    return state.upgrades.filter((id) => id === config.id).length < maximum;
  });
}

function createCanonicalChoices(state: CanonicalState, excluded: UpgradeId[] = []): UpgradeChoice[] {
  const startSkillOnly = state.phase === "awaiting-start-skill";
  const candidates = availableSkillConfigs(state).filter((config) => !excluded.includes(config.id) && (!startSkillOnly || config.category !== "common"));
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(canonicalRandom(state, "reward") * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target], candidates[index]];
  }
  return candidates.slice(0, 3).map((config) => ({ upgrade: upgradeFromSkill(config), ballCost: 0 }));
}

function createBossChoices(state: CanonicalState) {
  // Boss rewards are evolution opportunities, not another uncapped source of
  // per-skill numeric enhancement. Any owned skill with an evolution can
  // jump straight to its level-three evolved state.
  const candidates = [...new Set(state.upgrades)].filter((id) => {
    const config = state.skills.find((entry) => entry.id === id);
    return Boolean(config?.evolutionEnabled) && pickCount(state, id) < 4;
  });
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(canonicalRandom(state, "reward") * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target], candidates[index]];
  }
  if (candidates.length >= 3) return candidates.slice(0, 3);
  const fallback = state.skills
    .filter((config) => config.enabled && config.evolutionEnabled && !candidates.includes(config.id))
    .map((config) => config.id);
  for (let index = fallback.length - 1; index > 0; index -= 1) {
    const target = Math.floor(canonicalRandom(state, "reward") * (index + 1));
    [fallback[index], fallback[target]] = [fallback[target], fallback[index]];
  }
  return [...candidates, ...fallback].slice(0, 3);
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
function evolved(state: CanonicalState, id: UpgradeId) { return Boolean(skill(state, id)?.evolutionEnabled) && pickCount(state, id) >= 4; }
function pierceEvolutionActive(state: CanonicalState) {
  // The evolution changes the collision rule itself. It must be checked before
  // the hit is resolved, when a guard/reflector would otherwise block the
  // regular on-hit activation that prepares the pierce charges.
  return evolved(state, "archer-pierce") && Boolean(skill(state, "archer-pierce"));
}
function commonDamageBonus(state: CanonicalState, type: SkillDamageType) {
  const id = type === "physical" ? "common-damage" : "common-magic";
  return skillValue(state, id) + (evolved(state, id) ? 3 : 0);
}
type SkillEffectTriggerFilter = SkillEffectConfig["trigger"] | SkillEffectConfig["trigger"][];
function effectMatchesTrigger(effect: SkillEffectConfig, trigger?: SkillEffectTriggerFilter) {
  if (!trigger) return true;
  const triggers = Array.isArray(trigger) ? trigger : [trigger];
  return triggers.includes(effect.trigger) || (triggers.includes("on-hit") && effect.trigger === "on-direct-hit");
}
function activeTraitConfigs(state: CanonicalState, config: SkillConfig, trigger?: SkillEffectTriggerFilter) {
  const configuredEvolutionTraits = (config.evolutionEffects ?? []).filter((effect) => SKILL_TRAIT_PRIORITY[effect.kind as SkillTrait] !== undefined);
  const evolutionEffectTraits = configuredEvolutionTraits.filter((effect) => effect.enabled && effectMatchesTrigger(effect, trigger)).map((effect) => ({
    kind: effect.kind as SkillTrait, values: effect.values, unit: effect.unit, damageType: effect.damageType, damage: effect.damage, order: effect.order,
  }));
  const additions = evolved(state, config.id) ? evolutionEffectTraits : [];
  const configuredTraits = (config.effects ?? []).filter((effect) => SKILL_TRAIT_PRIORITY[effect.kind as SkillTrait] !== undefined);
  const effectTraits = configuredTraits.filter((effect) => effect.enabled && effectMatchesTrigger(effect, trigger)).map((effect) => ({
    kind: effect.kind as SkillTrait, values: effect.values, unit: effect.unit, damageType: effect.damageType, damage: effect.damage, order: effect.order,
  }));
  return [...effectTraits, ...additions].sort((a, b) => (a.order ?? SKILL_TRAIT_PRIORITY[a.kind] ?? 30) - (b.order ?? SKILL_TRAIT_PRIORITY[b.kind] ?? 30));
}
function activeTraits(state: CanonicalState, config: SkillConfig, trigger?: SkillEffectTriggerFilter) {
  return activeTraitConfigs(state, config, trigger).map((entry) => entry.kind);
}
function hasTrait(state: CanonicalState, config: SkillConfig, trait: SkillTrait, trigger?: SkillEffectTriggerFilter) {
  return activeTraits(state, config, trigger).includes(trait);
}
function activeEffectConfigs(state: CanonicalState, config: SkillConfig) {
  const additions = evolved(state, config.id) ? config.evolutionEffects ?? [] : [];
  return [...(config.effects ?? []), ...additions].filter((effect) => effect.enabled).sort((a, b) => a.order - b.order);
}
function createActiveEffects(state: CanonicalState, config: SkillConfig, fallbackDamage: number, scopeId?: string) {
  const level = levelOf(state, config.id) ?? 1;
  return activeEffectConfigs(state, config)
    .filter((effect) => (effect.trigger === "while-active" || effect.trigger === "on-tick") && (!scopeId || !effect.scopeId || effect.scopeId === scopeId))
    .map((effect) => ({
      id: effect.id,
      kind: effect.kind,
      target: effect.target,
      scopeId: effect.scopeId,
      order: effect.order,
      radius: Math.max(0, Number(effect.radius[level - 1] ?? 0)) * state.combatStats.skillRangeMultiplier,
      interval: Math.max(0.05, Number(effect.interval[level - 1] ?? 1)),
      timer: Math.max(0.05, Number(effect.interval[level - 1] ?? 1)),
      damage: effect.damageSource === "skill"
        ? fallbackDamage
        : Number(effect.damage[level - 1] ?? 0) > 0
          ? Math.max(0, Number(effect.damage[level - 1] ?? 0)) + commonDamageBonus(state, effect.damageType)
          : 0,
      damageType: effect.damageType,
    }));
}
function traitConfig(state: CanonicalState, id: UpgradeId, kind: SkillTrait) {
  const config = skill(state, id);
  return config ? activeTraitConfigs(state, config).find((entry) => entry.kind === kind) : undefined;
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
  const trait = traitConfig(state, id, kind);
  if (!level || !trait) return { amount: 0, damageType: trait?.damageType ?? "magic" };
  const damageType = trait.damageType;
  const values = ["direct-damage", "smash", "crush", "focus"].includes(kind)
    ? trait.values
    : trait.damage;
  const base = Number(values[level - 1] ?? 0);
  const enhancement = Math.max(0, state.bossEnhancements[id] ?? 0);
  const step = Math.max(1, Math.abs(values[2] - values[1]));
  const commonBonus = commonDamageBonus(state, damageType);
  return { amount: Math.max(0, base + enhancement * step + commonBonus), damageType };
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
  const commonBonus = commonDamageBonus(state, damageType);
  return { amount: Math.max(0, base + enhancement * step + commonBonus), damageType };
}
function refreshCanonicalCombatStats(state: CanonicalState) {
  // Damage is additive: skill base + the matching common damage bonus.
  // These legacy multiplier fields remain for compatibility with old callers.
  state.combatStats.physicalPower = 1;
  state.combatStats.magicPower = 1;
  state.combatStats.skillDamageMultiplier = 1;
  state.combatStats.skillRangeMultiplier = Math.max(1, 1 + skillValue(state, "common-skill-range") / 100);
  state.combatStats.skillDurationMultiplier = Math.max(1, 1 + (skillValue(state, "common-skill-duration") + (evolved(state, "common-skill-duration") ? 30 : 0)) / 100);
  state.combatStats.skillCooldownMultiplier = Math.max(0.25, 1 - Math.min(75, skillValue(state, "common-cooldown")) / 100);
  state.combatStats.chainBonus = Math.max(0, Math.floor(skillValue(state, "common-chain")) + (evolved(state, "common-chain") ? 3 : 0));
  for (const ball of state.balls) ball.attackPower = 1 + commonDamageBonus(state, "physical");
}

function skillDuration(state: CanonicalState, base: number) {
  return Math.max(0, base * state.combatStats.skillDurationMultiplier);
}
function lateWaveHpMultiplier(wave: number) { return wave >= 16 ? 2.5 : wave >= 11 ? 1.9 : wave >= 6 ? 1.45 : wave >= 4 ? 1.15 : 1; }

function traitFor(cell: string): CanonicalTrait {
  return cell === "g" ? "guard" : cell === "e" ? "explosive" : cell === "x" ? "indestructible" : cell === "c" ? "healer" : cell === "r" ? "reflector" : "standard";
}

function makeBrick(state: CanonicalState, x: number, y: number, w: number, h: number, hp: number, trait: CanonicalTrait, kind: CanonicalBrick["kind"], drop: CanonicalItemKind | null = null): CanonicalBrick {
  return { id: state.nextBrickId++, x, y, w, h, hp, maxHp: hp, alive: true, trait, guardReady: trait === "guard", healTimer: 3, healBlockTime: 0, burnTime: 0, burnTick: 0, burnDamage: 0, burnDamageType: "magic", burnSourceSkillId: null, poisonTime: 0, poisonTick: 0, traitLockTime: 0, frostVulnerability: 0, frostSourceSkillId: null, focusStacks: 0, focusTimer: 0, drop: trait === "indestructible" ? null : drop, kind };
}

function rebuildCollisionGrid(state: CanonicalState) {
  const grid = new Map<string, CanonicalBrick[]>();
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    const startCol = Math.floor(brick.x / WAVE_CELL_SIZE);
    const endCol = Math.floor((brick.x + brick.w - 0.001) / WAVE_CELL_SIZE);
    const startRow = Math.floor(brick.y / WAVE_CELL_SIZE);
    const endRow = Math.floor((brick.y + brick.h - 0.001) / WAVE_CELL_SIZE);
    for (let row = startRow; row <= endRow; row += 1) {
      for (let col = startCol; col <= endCol; col += 1) {
        const key = `${col}:${row}`;
        const entries = grid.get(key) ?? [];
        entries.push(brick);
        grid.set(key, entries);
      }
    }
  }
  state.collisionGrid = grid;
}

function collisionCandidates(state: CanonicalState, ball: CanonicalBall, previousX: number, previousY: number) {
  const minX = Math.min(previousX, ball.x) - ball.radius;
  const maxX = Math.max(previousX, ball.x) + ball.radius;
  const minY = Math.min(previousY, ball.y) - ball.radius;
  const maxY = Math.max(previousY, ball.y) + ball.radius;
  const candidateSet = new Set<CanonicalBrick>();
  const startCol = Math.floor(minX / WAVE_CELL_SIZE);
  const endCol = Math.floor(maxX / WAVE_CELL_SIZE);
  const startRow = Math.floor(minY / WAVE_CELL_SIZE);
  const endRow = Math.floor(maxY / WAVE_CELL_SIZE);
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      for (const brick of state.collisionGrid.get(`${col}:${row}`) ?? []) candidateSet.add(brick);
    }
  }
  return [...candidateSet].sort((a, b) => a.id - b.id);
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
    const bossBlockWidth = 98;
    const bossBlockHeight = 28;
    const bossColumnGap = 7;
    const bossRowGap = 5;
    const bossWidth = bossBlockWidth * 4 + bossColumnGap * 3;
    const bossX = (GAME_WIDTH - bossWidth) / 2;
    const bossY = 58;
    const coreHp = Math.max(1, hp);
    const armorHp = Math.max(1, Math.ceil(hp / 8));
    state.bricks = [];
    const core = makeBrick(
      state,
      bossX + bossBlockWidth + bossColumnGap,
      bossY,
      bossBlockWidth * 2 + bossColumnGap,
      bossBlockHeight * 2 + bossRowGap,
      coreHp,
      "standard",
      "boss-core",
      null,
    );
    // Use the central boss art while the hitbox itself occupies the upper
    // middle 2×2 area of the 4×3 fortress.
    core.bossRow = 1;
    core.bossCol = 1;
    state.bricks.push(core);
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const insideCore = row < 2 && col >= 1 && col <= 2;
        if (insideCore) continue;
        const armor = makeBrick(
          state,
          bossX + col * (bossBlockWidth + bossColumnGap),
          bossY + row * (bossBlockHeight + bossRowGap),
          bossBlockWidth,
          bossBlockHeight,
          armorHp,
          "standard",
          "boss-minion",
          null,
        );
        armor.bossRow = row;
        armor.bossCol = col;
        state.bricks.push(armor);
      }
    }
    state.bossAttackTimer = Math.max(4.4, 6 - stage * 0.3);
    state.bossPattern = 0;
    state.bossArmorHp = armorHp;
    state.bossArmorReformThresholds = [false, false, false];
    state.bossArmorReformTimer = 0;
    state.bossArmorReformCells = [];
    rebuildCollisionGrid(state);
    state.bossIntroTimer = 3;
    emitCanonicalEvent(state, { type: "audio", cue: "boss", volume: 1.25 });
    state.bossReinforcementIds = [];
    state.bossReinforcementTimer = 0;
    state.bossReinforcementTelegraph = 1.2;
    state.bossBarriers = [];
    state.bossWalls = [];
    state.bossShield = { active: false, life: 0, maxLife: 0, runeIds: [] };
    return;
  }
  const gridWidth = WAVE_COLUMNS * WAVE_CELL_SIZE;
  const gridX = (GAME_WIDTH - gridWidth) / 2;
  const gridY = BRICK_ROW_Y;
  const baseHp = 1 + Math.floor((wave - 1) / Math.max(1, Math.round(state.balance.baseHpWaveStep)));
  const blocks = definition.blocks ?? blocksFromPattern(definition.pattern);
  const dropCandidates = blocks.filter((block) => block.type !== "x");
  const dropCell = scheduledMultiball(wave) && dropCandidates.length ? dropCandidates[Math.floor(canonicalRandom(state, "world") * dropCandidates.length)] : null;
  state.bricks = blocks.map((block) => {
    const cell = block.type;
    const bonus = cell === "h" ? 1 + Math.floor((wave - 1) / 8) : cell === "c" ? 2 : 0;
    const hp = Math.ceil((baseHp + bonus) * lateWaveHpMultiplier(wave) * definition.hpMultiplier);
    const drop = dropCell === block ? "multiball" : canonicalRandom(state, "world") < 0.055 ? (["auto-barrier", "core-repair", "cooldown-reset"] as CanonicalItemKind[])[Math.floor(canonicalRandom(state, "world") * 3)] : null;
    // Keep the collision footprint aligned with the visible sprite while
    // leaving a 2px gap between adjacent 2x1 blocks.
    const inset = 1;
    return makeBrick(state, gridX + block.x * WAVE_CELL_SIZE + inset, gridY + block.y * WAVE_CELL_SIZE + inset, block.width * WAVE_CELL_SIZE - inset * 2, block.height * WAVE_CELL_SIZE - inset * 2, hp, traitFor(cell), "normal", drop);
  });
  rebuildCollisionGrid(state);
}

function makeBall(state: CanonicalState, x = GAME_WIDTH / 2, temporary = false, recovering = false, temporaryTime = 0, aimX = GAME_WIDTH / 2, aimY = GAME_HEIGHT / 3): CanonicalBall {
  const baseSpeed = Math.hypot(BASE_BALL_VX, BASE_BALL_VY);
  // Overdrive is run-global, just like the legacy row timer. New balls must
  // inherit speed earned in earlier waves instead of using wave-local time.
  const speed = baseSpeed * (recovering ? 1 : overdriveMultiplier(state.overdriveLevel));
  const aim = paddleAimDirection(x, PLAYER_PADDLE_Y, aimX, aimY);
  const awaitingLaunch = state.interactive && !temporary;
  return { x, y: PLAYER_PADDLE_Y - 11, vx: aim.horizontalRatio * speed, vy: aim.verticalRatio * speed, radius: 8, temporary, temporaryTime, missileTime: 0, waveBonus: temporary, awaitingLaunch, launchWaitTime: awaitingLaunch ? 3 : 0, visualSkill: null, visualSkillTime: 0, cooldowns: {}, skillCharges: {}, attackPower: 1 + commonDamageBonus(state, "physical"), pierce: 0, maxPierce: 0, payload: null, payloadLevel: 0, payloads: {}, canTriggerSkills: !temporary, skillGeneration: 0, lastHitBrickId: null, gravityBaseSpeed: null, explosionBaseSpeed: null, explosionBoostRatio: 1, explosionBoostTime: 0, respawnRecoveryTime: recovering && !awaitingLaunch ? RESPAWN_SPEED_RECOVERY_SECONDS : 0, respawnRecoveryDuration: recovering ? RESPAWN_SPEED_RECOVERY_SECONDS : 0, respawnRecoveryBaseSpeed: recovering ? baseSpeed : 0 };
}

function aimHeldBall(state: CanonicalState, ball: CanonicalBall, aimX: number, aimY: number) {
  const speed = Math.max(1, Math.hypot(ball.vx, ball.vy));
  const aim = paddleAimDirection(state.paddleX, PLAYER_PADDLE_Y, aimX, aimY);
  ball.x = state.paddleX;
  ball.y = PLAYER_PADDLE_Y - ball.radius - 3;
  ball.vx = aim.horizontalRatio * speed;
  ball.vy = aim.verticalRatio * speed;
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
    moveSpeedMultiplier: 1 + (skillValue(state, "common-move-speed") + (evolved(state, "common-move-speed") ? 20 : 0)) / 100,
    comboScoreBonus: 0,
    luckChance: skillValue(state, "common-luck") / 100,
    magnetRange: skillValue(state, "common-magnet"),
    paddleWidth: Math.min(330, BASE_PADDLE_WIDTH + skillValue(state, "common-wide") + (evolved(state, "common-wide") ? 50 : 0)),
    skillDamageMultiplier: state.combatStats.skillDamageMultiplier,
    skillRangeMultiplier: state.combatStats.skillRangeMultiplier,
    skillDurationMultiplier: state.combatStats.skillDurationMultiplier,
    skillCooldownMultiplier: state.combatStats.skillCooldownMultiplier,
    chainBonus: state.combatStats.chainBonus,
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
  const generation = source.skillGeneration + 1;
  const arrow = makeBall(state, source.x + offset, true, false, lifetime);
  arrow.x = source.x + offset;
  arrow.y = source.y;
  arrow.vx = source.vx * (offset === 0 ? -0.88 : offset < 0 ? -0.82 : 0.82);
  arrow.vy = -Math.abs(source.vy);
  arrow.visualSkill = "archer-rapid";
  arrow.visualSkillTime = Math.min(0.5, lifetime);
  arrow.canTriggerSkills = false;
  arrow.skillGeneration = generation;
  arrow.attackPower = source.attackPower;
  arrow.pierce = source.pierce;
  arrow.maxPierce = source.maxPierce;
  arrow.payload = source.payload;
  arrow.payloadLevel = source.payloadLevel;
  arrow.payloads = { ...source.payloads };
  arrow.skillCharges = { ...source.skillCharges };
  arrow.cooldowns = { ...source.cooldowns };
  state.balls.push(arrow);
  return arrow;
}

function resolveBrickDestruction(state: CanonicalState, brick: CanonicalBrick, applied: number, packet: DamagePacket) {
  const sourceBall = packet.sourceBall;
  brick.alive = false;
  state.bricksBroken++;
  state.combo++;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  const points = 100 + Math.round(applied * 12 + state.combo * 4);
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
  if (brick.kind === "boss-minion" && brick.bossRow !== undefined && brick.bossCol !== undefined) {
    emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, radius: 58, duration: 0.6, color: "#c5a766", text: "ARMOR BREAK" });
    emitCanonicalEvent(state, { type: "audio", cue: "brick-break", volume: 1.35 });
  }
  if (brick.kind === "boss-core") {
    emitCanonicalEvent(state, { type: "effect", kind: "blast", x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, x2: brick.x + brick.w / 2, y2: brick.y + brick.h / 2, color: "#ff6b87" });
    emitCanonicalEvent(state, { type: "shake", strength: 18, duration: 0.55 });
  }
  state.score += points;
  const drop = brick.drop ?? (canonicalRandom(state, "world") < skillValue(state, "common-luck") / 100 ? "multiball" : null);
  if (drop) {
    state.items.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, vy: 120, kind: drop, alive: true });
    emitCanonicalEvent(state, { type: "item-dropped", itemId: brick.id, kind: drop, x: brick.x + brick.w / 2, y: brick.y + brick.h / 2 });
    if (evolved(state, "common-luck") && canonicalRandom(state, "world") < 0.5) {
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

/** Damage remains fractional all the way through the HP boundary. */
export function canonicalDamageAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return amount;
}

/** Kept for health/core compatibility and older callers. */
export function canonicalIntegerCombatAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.max(1, Math.round(amount));
}

function applyBrickDamage(state: CanonicalState, brick: CanonicalBrick, packet: DamagePacket): DamageReceipt {
  const requested = canonicalDamageAmount(packet.amount);
  if (!brick.alive || brick.trait === "indestructible") return { requested, applied: 0, guardBroken: false, killed: false };
  if (brick.kind !== "normal" && state.bossIntroTimer > 0) {
    emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, radius: 40, duration: 0.22, color: "#ffd166", text: "BOSS INCOMING" });
    return { requested, applied: 0, guardBroken: false, killed: false };
  }
  if (brick.kind === "boss-core" && (state.bossShield.active || bossArmorIsAlive(state) || state.bossArmorReformTimer > 0)) {
    const text = state.bossShield.active ? "SHIELD ACTIVE" : state.bossArmorReformTimer > 0 ? "ARMOR REFORMING" : "ARMOR ACTIVE";
    emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, radius: 54, duration: 0.32, color: state.bossShield.active ? "#ffd166" : "#aeb8ca", text });
    return { requested, applied: 0, guardBroken: false, killed: false };
  }
  if (packet.respectGuard && breakBrickGuard(state, brick)) return { requested, applied: 0, guardBroken: true, killed: false };
  const runeBonus = state.bossShield.runeIds.includes(brick.id) && (packet.sourceSkillId === "warrior-crush" || packet.sourceSkillId === "mage-mana-blast") ? 1.75 : 1;
  const applied = Math.min(brick.hp, requested * runeBonus);
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
  if (brick.kind === "boss-core" && applied > 0) maybeStartBossArmorReform(state);
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

function applySkillStatuses(state: CanonicalState, result: SkillResult, sourceSkillId: UpgradeId, targets: CanonicalBrick[]) {
  if (result.disableHealing) {
    for (const target of targets) target.healBlockTime = Math.max(target.healBlockTime, skillDuration(state, result.disableHealing));
  }
  if (result.control) {
    for (const target of targets) target.traitLockTime = Math.max(target.traitLockTime, skillDuration(state, result.control.duration));
  }
  if (result.burn) {
    for (const target of targets) {
      target.burnTime = Math.max(target.burnTime, skillDuration(state, result.burn.duration));
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
  applySkillStatuses(state, result, sourceSkillId, eligibleTargets);
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

function applyShockwave(state: CanonicalState, ball: CanonicalBall, origin: CanonicalBrick, radius: number, packet: { amount: number; damageType: SkillDamageType }) {
  const targets = state.bricks.filter((target) => target.alive && target.trait !== "indestructible" && brickDistance(target, origin) <= radius);
  let damage = 0;
  let kills = 0;
  for (const target of targets) {
    const wasAlive = target.alive;
    damage += applyBrickDamage(state, target, { amount: packet.amount, damageType: packet.damageType, delivery: "skill", sourceBall: ball, sourceSkillId: "warrior-shockwave", respectGuard: true }).applied;
    if (wasAlive && !target.alive) {
      kills++;
    }
  }
  return { damage, kills };
}

function applyRicochetSkill(state: CanonicalState, ball: CanonicalBall, origin: CanonicalBrick, count: number, radius: number) {
  const targets = state.bricks
    .filter((target) => target.alive && target !== origin && target.trait !== "indestructible" && brickDistance(target, origin) <= radius)
    .sort((a, b) => chainPriority("archer-ricochet", a) - chainPriority("archer-ricochet", b) || brickDistance(a, origin) - brickDistance(b, origin))
    .slice(0, count);
  let damage = 0;
  let kills = 0;
  for (const [index, target] of targets.entries()) {
    const wasAlive = target.alive;
    const multiplier = 1 + index * 0.5;
    damage += applyBrickDamage(state, target, {
      amount: ball.attackPower * multiplier,
      damageType: "physical",
      delivery: "skill",
      sourceBall: ball,
      sourceSkillId: "archer-ricochet",
      respectGuard: true,
    }).applied;
    if (wasAlive && !target.alive) kills++;
  }
  return { damage, kills };
}

function applyLightningSkill(state: CanonicalState, ball: CanonicalBall, origin: CanonicalBrick, count: number, radius: number) {
  const targets = state.bricks
    .filter((target) => target.alive && target.trait !== "indestructible" && target !== origin && brickDistance(target, origin) <= radius)
    .sort((a, b) => brickDistance(a, origin) - brickDistance(b, origin))
    .slice(0, count);
  const evolvedLightning = evolved(state, "mage-lightning");
  const perTarget = (evolvedLightning ? count * 0.5 : count) + commonDamageBonus(state, "magic");
  let damage = 0;
  let kills = 0;
  for (const target of targets) {
    const wasAlive = target.alive;
    damage += applyBrickDamage(state, target, {
      amount: perTarget,
      damageType: "magic",
      delivery: "skill",
      sourceBall: ball,
      sourceSkillId: "mage-lightning",
      respectGuard: true,
    }).applied;
    if (wasAlive && !target.alive) kills++;
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

function applyCustomCollisionSkill(state: CanonicalState, ball: CanonicalBall, hit: CanonicalBrick, config: SkillConfig, radius: number, trigger: SkillEffectTriggerFilter) {
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

  const statusTargets = [hit, ...nearby.filter((entry) => brickDistance(entry, hit) <= radius)].filter((target) => target.alive && target.trait !== "indestructible");
  for (const entry of activeTraitConfigs(state, config, trigger)) {
    const kind = entry.kind;
    if (["direct-damage", "smash", "crush", "focus"].includes(kind) && hit.alive && (kind !== "crush" || hit.trait !== "standard")) applyDamage(hit, kind);
    if (kind === "weakpoint" && hit.alive) {
      const multiplier = Math.max(1, traitValue(state, config.id, "weakpoint"));
      const packet = traitDamagePacket(state, config.id, "weakpoint");
      applyBrickDamage(state, hit, { amount: Math.max(packet.amount, multiplier - 1), damageType: packet.damageType, delivery: "skill", sourceBall: ball, sourceSkillId: config.id, respectGuard: true });
    }
    if (kind === "execute" && hit.alive && hit.kind !== "boss-core") {
      const threshold = Math.max(0, traitValue(state, config.id, "execute")) / 100;
      if (hit.hp / Math.max(1, hit.maxHp) <= threshold) applyBrickDamage(state, hit, { amount: hit.hp, damageType: entry.damageType, delivery: "skill", sourceBall: ball, sourceSkillId: config.id, respectGuard: true });
    }
    if (kind === "mana-seal" && hit.alive) {
      hit.traitLockTime = Math.max(hit.traitLockTime, skillDuration(state, traitValue(state, config.id, "mana-seal")));
      applyDamage(hit, "mana-seal");
    }
    if (kind === "splash") {
      const splashRadius = Math.max(0, traitValue(state, config.id, "splash") || radius);
      for (const target of nearby.filter((entry) => brickDistance(entry, hit) <= splashRadius)) applyDamage(target, "splash");
    }
    if (kind === "chain") {
      const count = Math.max(1, Math.round(traitValue(state, config.id, "chain") + state.combatStats.chainBonus));
      for (const target of nearby.slice(0, count)) applyDamage(target, "chain");
    }
    if (kind === "burn") {
      const packet = traitDamagePacket(state, config.id, "burn");
      for (const target of statusTargets) {
        target.burnTime = Math.max(target.burnTime, skillDuration(state, traitValue(state, config.id, "burn")));
        target.burnTick = Math.min(target.burnTick || 1, 1);
        target.burnDamage = Math.max(target.burnDamage, packet.amount);
        target.burnDamageType = packet.damageType;
        target.burnSourceSkillId = config.id;
      }
    }
    if (kind === "freeze") for (const target of statusTargets) target.traitLockTime = Math.max(target.traitLockTime, skillDuration(state, traitValue(state, config.id, "freeze")));
    if (kind === "pierce") {
      const count = Math.max(1, Math.round(traitValue(state, config.id, "pierce")));
      ball.maxPierce = Math.max(ball.maxPierce, count);
      ball.pierce = Math.max(ball.pierce, count);
    }
    if (kind === "rapid-fire") spawnRapidArrow(state, ball, ball.vx >= 0 ? -14 : 14, Math.max(1, skillDuration(state, traitValue(state, config.id, "rapid-fire"))));
    if (kind === "barrier") state.barrierCharges = Math.min(4, state.barrierCharges + Math.max(1, Math.round(traitValue(state, config.id, "barrier"))));
    if (kind === "black-hole") {
      const packet = traitDamagePacket(state, config.id, "black-hole");
      state.gravityWells.push({ x: hit.x + hit.w / 2, y: hit.y + hit.h / 2, radius: Math.max(70, traitValue(state, config.id, "black-hole")), life: skillDuration(state, 4), damagePerSecond: 0, damageType: packet.damageType, damageTick: 1, sourceSkillId: config.id, activeEffects: createActiveEffects(state, config, packet.amount) });
    }
  }
}

const MAX_EFFECT_CHAIN_DEPTH = 8;
const MAX_EFFECT_EVENTS = 256;
type SkillEffectEvent = {
  effect: SkillEffectConfig;
  trigger: SkillEffectConfig["trigger"];
  sourceBall: CanonicalBall;
  origin: CanonicalBrick;
  depth: number;
  sourceEffectId: string;
};

function effectValue(state: CanonicalState, config: SkillConfig, effect: SkillEffectConfig) {
  const level = levelOf(state, config.id) ?? 1;
  return Number(effect.values[level - 1] ?? 0);
}

function effectDamage(state: CanonicalState, config: SkillConfig, effect: SkillEffectConfig, fallbackDamage: number) {
  const level = levelOf(state, config.id) ?? 1;
  if (effect.damageSource === "skill") return fallbackDamage;
  const base = Number(effect.damage[level - 1] ?? 0);
  const commonBonus = commonDamageBonus(state, effect.damageType);
  return Math.max(0, base + commonBonus);
}

function resolveEffectBricks(state: CanonicalState, origin: CanonicalBrick, effect: SkillEffectConfig, radius: number) {
  if (effect.target === "self" || effect.target === "paddle" || effect.target === "core") return [];
  const candidates = state.bricks.filter((brick) => brick.alive && brick.trait !== "indestructible");
  const distance = (brick: CanonicalBrick) => brickDistance(brick, origin);
  if (effect.target === "hit") return origin.alive ? [origin] : [];
  if (effect.target === "nearest") return candidates.sort((a, b) => distance(a) - distance(b)).slice(0, 1);
  if (effect.target === "same-trait") return candidates.filter((brick) => brick.trait === origin.trait);
  if (effect.target === "all-enemies") return candidates;
  return candidates.filter((brick) => distance(brick) <= Math.max(0, radius));
}

function applyGenericEffect(state: CanonicalState, event: SkillEffectEvent, config: SkillConfig, radius: number, fallbackDamage: number, queue: SkillEffectEvent[], scheduled: Set<string>) {
  const { effect, sourceBall, origin } = event;
  const targets = resolveEffectBricks(state, origin, effect, effect.radius[(levelOf(state, config.id) ?? 1) - 1] || radius);
  const amount = effectDamage(state, config, effect, fallbackDamage);
  if (["damage", "modify-damage", "periodic-damage"].includes(effect.kind) && amount > 0) {
    for (const target of targets) applyBrickDamage(state, target, { amount, damageType: effect.damageType, delivery: "skill", sourceBall, sourceSkillId: config.id, respectGuard: true });
  }
  if (effect.kind === "apply-status") {
    const duration = skillDuration(state, effectValue(state, config, effect));
    const status = effect.status;
    for (const target of targets) {
      if (status === "burn") {
        target.burnTime = Math.max(target.burnTime, duration);
        target.burnTick = Math.min(target.burnTick || 1, 1);
        target.burnDamage = Math.max(target.burnDamage, amount);
        target.burnDamageType = effect.damageType;
        target.burnSourceSkillId = config.id;
      } else if (status === "freeze" || status === "mana-seal") target.traitLockTime = Math.max(target.traitLockTime, duration);
      else if (status === "disable-healing") target.healBlockTime = Math.max(target.healBlockTime, duration);
    }
  }
  if (effect.kind === "spawn") {
    const count = Math.max(1, Math.round(effectValue(state, config, effect)));
    const lifetime = Math.max(0.2, skillDuration(state, effect.duration[(levelOf(state, config.id) ?? 1) - 1] ?? effectValue(state, config, effect)));
    if (effect.spawnKind === "rapid-arrow") {
      for (let index = 0; index < count; index++) spawnRapidArrow(state, sourceBall, sourceBall.vx >= 0 ? -14 : 14, lifetime);
    } else if (effect.spawnKind === "ball") {
      for (let index = 0; index < count; index++) {
        const spawned = makeBall(state, sourceBall.x + (index - (count - 1) / 2) * 12, true, false, lifetime);
        spawned.vx = sourceBall.vx + (index - (count - 1) / 2) * 18;
        spawned.vy = sourceBall.vy;
        spawned.attackPower = sourceBall.attackPower;
        spawned.skillGeneration = sourceBall.skillGeneration + 1;
        state.balls.push(spawned);
      }
    }
  }
  if (effect.kind === "create-field") {
    const level = levelOf(state, config.id) ?? 1;
    const fieldRadius = Math.max(20, Number(effect.radius[level - 1] ?? radius)) * state.combatStats.skillRangeMultiplier;
    const fieldDuration = Math.max(0.1, Number(effect.duration[level - 1] ?? 3)) * state.combatStats.skillDurationMultiplier;
    state.gravityWells.push({ x: origin.x + origin.w / 2, y: origin.y + origin.h / 2, radius: fieldRadius, life: fieldDuration, damagePerSecond: 0, damageType: effect.damageType, damageTick: 1, sourceSkillId: config.id, activeEffects: createActiveEffects(state, config, fallbackDamage, effect.id) });
  }
  if (event.depth < MAX_EFFECT_CHAIN_DEPTH) {
    const nextTrigger = effect.trigger === "on-break" ? "on-break" : "on-hit";
    for (const next of activeEffectConfigs(state, config).filter((entry) => entry.id !== effect.id && entry.trigger === nextTrigger && entry.order >= effect.order)) {
      if (scheduled.has(next.id)) continue;
      scheduled.add(next.id);
      queue.push({ effect: next, trigger: next.trigger, sourceBall, origin, depth: event.depth + 1, sourceEffectId: effect.id });
    }
  }
}

function runConfiguredEffectEvents(state: CanonicalState, sourceBall: CanonicalBall, origin: CanonicalBrick, config: SkillConfig, trigger: SkillEffectConfig["trigger"], radius: number, fallbackDamage: number) {
  const queue: SkillEffectEvent[] = activeEffectConfigs(state, config)
    .filter((effect) => !SKILL_TRAIT_PRIORITY[effect.kind as SkillTrait] && effect.trigger === trigger)
    .map((effect) => ({ effect, trigger, sourceBall, origin, depth: 0, sourceEffectId: effect.id }));
  const scheduled = new Set(queue.map((event) => event.effect.id));
  let processed = 0;
  while (queue.length && processed++ < MAX_EFFECT_EVENTS) {
    const event = queue.shift()!;
    applyGenericEffect(state, event, config, radius, fallbackDamage, queue, scheduled);
  }
}

function activeEffectTargets(state: CanonicalState, well: CanonicalGravityWell, effect: CanonicalActiveEffect) {
  const candidates = state.bricks.filter((brick) => brick.alive && brick.trait !== "indestructible");
  const distance = (brick: CanonicalBrick) => Math.hypot(brick.x + brick.w / 2 - well.x, brick.y + brick.h / 2 - well.y);
  if (effect.target === "all-enemies") return candidates;
  if (effect.target === "nearest" || effect.target === "hit") return candidates.sort((a, b) => distance(a) - distance(b)).slice(0, 1);
  const radius = effect.radius > 0 ? Math.min(well.radius, effect.radius) : well.radius;
  return candidates.filter((brick) => distance(brick) <= radius);
}

function triggerCollisionSkills(state: CanonicalState, ball: CanonicalBall, hit: CanonicalBrick, triggerContext: CollisionSkillTriggerContext, guardBlocked = false) {
  if (!ball.canTriggerSkills || hit.trait === "indestructible") return;
  const rangeMultiplier = state.combatStats.skillRangeMultiplier;
  for (const config of state.skills) {
    const level = levelOf(state, config.id);
    const deferredDirect = DIRECT_DAMAGE_SKILLS.has(config.id) && config.triggerType === "brick-break";
    if (!level || !config.enabled || config.category === "common" || (DIRECT_DAMAGE_SKILLS.has(config.id) && !deferredDirect)) continue;
    if (guardBlocked && config.id !== "mage-mana-blast") continue;
    const custom = !config.builtIn || config.id.startsWith("custom-");
    if (!customTriggerMatches(config, triggerContext)) continue;
    if (config.id === "mage-mana-blast" && !(triggerContext.originalTrait === "guard" || hit.guardReady || hit.trait === "healer" || hit.trait === "reflector")) continue;
    const remaining = skillCooldownRemaining(state, ball, config.id);
    if (remaining > 0) continue;
    // Iron Wall's displayed 15/12/8 second value is its activation interval.
    // Boss enhancement improves that interval instead of shortening a guard
    // lifetime (stored charges deliberately have no lifetime).
    const baseCooldown = config.id === "warrior-guard"
      ? skillValue(state, config.id)
      : Number(config.cooldown[level - 1] ?? 1);
    const cooldown = Math.max(0.2, baseCooldown * state.combatStats.skillCooldownMultiplier);
    setSkillCooldown(state, ball, config.id, cooldown);
    if (evolved(state, "common-cooldown") && canonicalRandom(state, "world") < 0.2) setSkillCooldown(state, ball, config.id, 0);
    ball.visualSkill = config.id;
    ball.visualSkillTime = Math.max(ball.visualSkillTime, 0.42);
    let visualEmitted = false;
    let resultApplied = false;
    const result: SkillResult = {};
    const rangePadding = (evolved(state, "common-skill-range") ? 50 : 0)
      + (config.id === "warrior-shockwave" && evolved(state, config.id) ? 50 : 0)
      + (config.id === "archer-ricochet" && evolved(state, config.id) ? 50 : 0);
    const radius = (config.category === "warrior" ? 105 : config.category === "mage" ? 125 : 85) * rangeMultiplier + rangePadding;
    runConfiguredEffectEvents(state, ball, hit, config, "on-cast", radius, canonicalSkillDamagePacket(state, config.id).amount);
    const targets = state.bricks.filter((brick) => brick.alive && brick.trait !== "indestructible").sort((a, b) => Math.hypot(a.x - hit.x, a.y - hit.y) - Math.hypot(b.x - hit.x, b.y - hit.y));
    const chainBonus = state.combatStats.chainBonus;
    const count = Math.max(1, 1 + chainBonus);
    const effectTrigger: SkillEffectTriggerFilter = triggerContext.destroyed ? ["on-hit", "on-direct-hit", "on-break"] : ["on-hit", "on-direct-hit"];
    if (custom || deferredDirect) {
      applyCustomCollisionSkill(state, ball, hit, config, radius, effectTrigger);
      resultApplied = true;
    } else if (config.id === "mage-fireball" && (hasTrait(state, config, "splash", effectTrigger) || hasTrait(state, config, "burn", effectTrigger))) {
      const duration = Math.max(0, traitValue(state, config.id, "burn"));
      result.disableHealing = duration;
      if (evolved(state, config.id)) result.burn = { duration, damage: 1 + commonDamageBonus(state, "magic") };
      const fireballRadius = Math.max(20, traitValue(state, config.id, "splash")) * rangeMultiplier + rangePadding;
      const affected = targets.filter((target) => brickDistance(target, hit) <= fireballRadius);
      applySkillResult(state, result, ball, config.id, affected);
      resultApplied = true;
    } else if (config.id === "warrior-guard" && hasTrait(state, config, "barrier", effectTrigger)) {
      const stackable = evolved(state, config.id);
      result.barrier = { charges: 1, stackable };
      applySkillResult(state, result, ball, config.id, []);
      resultApplied = true;
    } else if (config.id === "archer-rapid" && hasTrait(state, config, "rapid-fire", effectTrigger)) {
      const lifetime = evolved(state, config.id) ? 0 : Math.max(0.2, skillDuration(state, traitValue(state, config.id, "rapid-fire")));
      spawnRapidArrow(state, ball, ball.vx >= 0 ? -14 : 14, lifetime);
      spawnRapidArrow(state, ball, ball.vx >= 0 ? 18 : -18, lifetime);
    } else if (config.id === "archer-pierce" && hasTrait(state, config, "pierce", effectTrigger)) {
      // A prepared ball receives the configured consecutive penetration count.
      const pierceCount = Math.max(1, Math.round(traitValue(state, config.id, "pierce")));
      ball.maxPierce = Math.max(ball.maxPierce, pierceCount);
      ball.pierce = Math.max(ball.pierce, pierceCount);
    } else if (config.id === "archer-ricochet" && hasTrait(state, config, "chain", effectTrigger)) {
      const ricochetCount = Math.max(1, Math.round(traitValue(state, config.id, "chain") + chainBonus + (evolved(state, config.id) ? 2 : 0)));
      applyRicochetSkill(state, ball, hit, ricochetCount, radius);
      resultApplied = true;
    } else if (config.id === "mage-lightning" && hasTrait(state, config, "chain", effectTrigger)) {
      const chainCount = Math.max(1, Math.round(traitValue(state, config.id, "chain") + chainBonus + (evolved(state, config.id) ? 3 : 0)));
      applyLightningSkill(state, ball, hit, chainCount, radius);
    } else if (config.id === "mage-freeze" && hasTrait(state, config, "freeze", effectTrigger)) {
      // The mark is consumed by the next direct hit for bonus damage and
      // seals healer/reflector behavior for the configured duration.
      const frostDamage = Math.max(0, traitDamagePacket(state, config.id, "freeze").amount);
      const freezeDuration = Math.max(0, skillDuration(state, traitValue(state, config.id, "freeze")));
      result.control = { duration: freezeDuration, kind: "freeze" };
      hit.frostVulnerability = Math.max(hit.frostVulnerability, frostDamage);
      hit.frostSourceSkillId = config.id;
      hit.traitLockTime = Math.max(hit.traitLockTime, freezeDuration);
      resultApplied = true;
    } else if (config.id === "mage-mana-blast" && hasTrait(state, config, "mana-seal", effectTrigger)) {
      const duration = Math.max(0, skillDuration(state, traitValue(state, config.id, "mana-seal")));
      hit.traitLockTime = Math.max(hit.traitLockTime, evolved(state, config.id) ? 1_000_000 : duration);
      applySkillResult(state, result, ball, config.id, [hit]);
      resultApplied = true;
    } else if (config.id === "mage-black-hole" && hasTrait(state, config, "black-hole", effectTrigger)) {
      // Radius remains the control value; damage is snapshotted from the
      // run-wide magic stat so later stat changes do not rewrite active wells.
      const radius = Math.max(40, traitValue(state, config.id, "black-hole") * rangeMultiplier + (evolved(state, "common-skill-range") ? 50 : 0));
      const next = { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2, radius, life: skillDuration(state, 4), damagePerSecond: 0, damageType: "magic" as SkillDamageType, damageTick: 1, sourceSkillId: config.id, activeEffects: evolved(state, config.id) ? createActiveEffects(state, config, 1 + commonDamageBonus(state, "magic")) : [] };

      state.gravityWells.push(next);
      // The persistent gravity-well renderer owns the black-hole sprite for
      // the full field lifetime. Do not also emit a transient skill sprite,
      // otherwise the same effect is drawn twice at the same location.
      visualEmitted = true;
      resultApplied = true;
    } else if (config.id === "warrior-shockwave" && hasTrait(state, config, "splash", effectTrigger)) {
      const shockwaveRadius = Math.max(20, traitValue(state, config.id, "splash")) * rangeMultiplier + rangePadding;
      applyShockwave(state, ball, hit, shockwaveRadius, traitDamagePacket(state, config.id, "splash"));
      resultApplied = true;
    }
    // Keep all contract fields on a single post-processing path. Existing
    // specialized branches still mutate their richer state directly, while
    // generic and future runtimes can return effects without losing them.
    const effectTargets = targets.filter((target) => Math.hypot(target.x - hit.x, target.y - hit.y) <= radius).slice(0, count);
    if (!resultApplied) applySkillResult(state, result, ball, config.id, effectTargets);
    const fallbackDamage = canonicalSkillDamagePacket(state, config.id).amount;
    runConfiguredEffectEvents(state, ball, hit, config, "on-hit", radius, fallbackDamage);
    runConfiguredEffectEvents(state, ball, hit, config, "on-direct-hit", radius, fallbackDamage);
    if (triggerContext.destroyed) runConfiguredEffectEvents(state, ball, hit, config, "on-break", radius, fallbackDamage);
    if (!visualEmitted) {
      const centerX = hit.x + hit.w / 2;
      const centerY = hit.y + hit.h / 2;
      const vfx = SKILL_VFX_CONFIG[config.id];
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
      const visualDuration = vfx?.duration ?? (config.id === "warrior-shockwave"
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
                      : 0.5);
      const visualX = vfx?.anchor === "paddle" ? GAME_WIDTH / 2 : centerX;
      const visualY = vfx?.anchor === "paddle" ? PLAYER_LINE_Y : centerY;
      const isDirectional = vfx?.anchor === "trajectory";
      const isPaddle = vfx?.anchor === "paddle";
      emitCanonicalVisual(state, {
        kind: "skill",
        skillId: config.id,
        x: visualX,
        y: visualY,
        x2: isPaddle ? GAME_WIDTH - 24 : isDirectional ? centerX + ball.vx * 0.08 : visualX,
        y2: isPaddle ? PLAYER_LINE_Y : isDirectional ? centerY + ball.vy * 0.08 : visualY,
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
  directDamageMultiplier: number;
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
  if (!config || !level || !config.enabled || !requiredTrait || !hasTrait(state, config, requiredTrait) || !customTriggerMatches(config, { repeatedTarget: context.repeatedTarget, originalTrait: context.originalTrait, destroyed: false }) || skillCooldownRemaining(state, ball, id) > 0) return null;
  const configuredCooldown = id === "warrior-smash" && evolved(state, id)
    ? 0.4
    : Number(config.cooldown[level - 1] ?? 1) * state.combatStats.skillCooldownMultiplier;
  setSkillCooldown(state, ball, id, Math.max(0.2, configuredCooldown));
  if (evolved(state, "common-cooldown") && canonicalRandom(state, "world") < 0.2) setSkillCooldown(state, ball, id, 0);
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
  const crush = originalTrait !== "standard"
    ? consumeDirectSkill(state, context.ball, "warrior-crush", context)
    : null;
  if (crush) {
    const packet = traitDamagePacket(state, crush.config.id, "crush");
    const bonus = originalTrait !== "standard" ? packet.amount : 0;
    context.bypassGuard = context.guardWasReady && evolved(state, crush.config.id);
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
      const percent = traitValue(state, focus.config.id, "focus");
      context.brick.focusStacks = Math.min(3, context.brick.focusStacks + 1);
      context.brick.focusTimer = evolved(state, focus.config.id) ? Number.POSITIVE_INFINITY : 3;
      context.directDamageMultiplier *= 1 + (percent * context.brick.focusStacks) / 100;
      context.skillActivations.push({ id: focus.config.id, level: focus.level });
    }

    const weakpoint = consumeDirectSkill(state, context.ball, "archer-weakpoint", context);
    if (weakpoint) {
      const multiplier = evolved(state, weakpoint.config.id) ? 4 : Math.max(1, traitValue(state, weakpoint.config.id, "weakpoint"));
      context.directDamageMultiplier *= multiplier;
      context.skillActivations.push({ id: weakpoint.config.id, level: weakpoint.level });
    }

    const execute = consumeDirectSkill(state, context.ball, "warrior-execute", context);
    if (execute) {
      const threshold = (evolved(state, execute.config.id) ? 0.4 : 0.25);
      const ratio = Math.max(0, Math.min(1, context.brick.hp / Math.max(1, context.brick.maxHp)));
      const progress = Math.max(0, Math.min(1, (1 - ratio) / (1 - threshold)));
      const maxMultiplier = Math.max(1, traitValue(state, execute.config.id, "execute"));
      const executeMultiplier = 1 + (maxMultiplier - 1) * progress;
      context.directDamageMultiplier *= context.brick.kind === "boss-core"
        ? 1 + (executeMultiplier - 1) * 0.5
        : executeMultiplier;
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
  const pierceBypassesDefense = pierceEvolutionActive(state);
  const context: DirectHitContext = {
    brick,
    ball,
    originalTrait: brick.trait,
    repeatedTarget: ball.lastHitBrickId === brick.id,
    frostBonus,
    physicalDamage: Math.max(1, ball.attackPower + fracture + corrosion),
    skillDamagePackets: [
      ...(frostBonus > 0 ? [{ id: frostSourceSkillId ?? "mage-freeze" as UpgradeId, amount: frostBonus, damageType: "magic" as SkillDamageType }] : []),
    ],
    guardWasReady: brick.guardReady,
    bypassGuard: pierceBypassesDefense,
    poisonLevel: Math.max(0, skillValue(state, "poison")),
    directDamageMultiplier: 1,
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
      return;
    }
  }
  if (context.poisonLevel > 0) {
    context.brick.poisonTime = Math.max(context.brick.poisonTime, 5);
    context.brick.poisonTick = Math.min(context.brick.poisonTick || 1, Math.max(0.25, context.poisonLevel));
  }
  context.appliedDamage = applyBrickDamage(state, context.brick, { amount: context.physicalDamage * context.directDamageMultiplier, damageType: "physical", delivery: "ball", sourceBall: context.ball }).applied;
  for (const packet of context.skillDamagePackets) {
    context.appliedDamage += applyBrickDamage(state, context.brick, { amount: packet.amount * context.directDamageMultiplier, damageType: packet.damageType, delivery: "skill", sourceBall: context.ball, sourceSkillId: packet.id }).applied;
  }
}

function emitDirectSkillActivations(state: CanonicalState, context: DirectHitContext) {
  for (const activation of context.skillActivations) {
    const config = skill(state, activation.id);
    if (!config) continue;
    const vfx = SKILL_VFX_CONFIG[activation.id as keyof typeof SKILL_VFX_CONFIG];
    emitCanonicalVisual(state, {
      kind: "skill",
      skillId: activation.id,
      x: context.brick.x + context.brick.w / 2,
      y: context.brick.y + context.brick.h / 2,
      radius: config.category === "warrior" ? 66 : 58,
      duration: vfx?.duration ?? 0.45,
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
  if (!context.brick.alive && context.originalTrait !== "standard" && context.skillActivations.some((activation) => activation.id === "warrior-crush") && evolved(state, "warrior-crush")) {
    const damageType = traitConfig(state, "warrior-crush", "crush")?.damageType ?? "magic";
    const amount = 1 + commonDamageBonus(state, damageType);
    for (const target of state.bricks.filter((entry) => entry.alive && entry.trait === context.originalTrait)) applyBrickDamage(state, target, { amount, damageType, delivery: "skill", sourceBall: context.ball, sourceSkillId: "warrior-crush", respectGuard: true });
  }
  applyLinkedPayload(state, context);
  triggerCollisionSkills(
    state,
    context.ball,
    context.brick,
    { repeatedTarget: context.repeatedTarget, originalTrait: context.originalTrait, destroyed: !context.brick.alive },
    context.guardWasReady && !context.bypassGuard,
  );
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

type BossPatternId = 1 | 2 | 3 | 4;

function bossStage(state: CanonicalState) {
  const definition = waveDefinitionFrom(state.waves, state.wave);
  return definition.boss === "final" ? 4 : definition.boss === "late" ? 3 : definition.boss === "mid" ? 2 : 1;
}

function bossPatternSet(stage: number): BossPatternId[] {
  return stage >= 4 ? [1, 2, 3, 4] : stage === 3 ? [1, 2, 3] : stage === 2 ? [1, 2] : [1];
}

function bossArmorIsAlive(state: CanonicalState) {
  return state.bricks.some((brick) => brick.kind === "boss-minion" && brick.bossRow !== undefined && brick.bossCol !== undefined && brick.alive);
}

function bossArmorCellPosition(cell: CanonicalBossArmorCell) {
  const bossBlockWidth = 98;
  const bossBlockHeight = 28;
  const bossColumnGap = 7;
  const bossRowGap = 5;
  const bossWidth = bossBlockWidth * 4 + bossColumnGap * 3;
  const bossX = (GAME_WIDTH - bossWidth) / 2;
  const bossY = 58;
  return { x: bossX + cell.col * (bossBlockWidth + bossColumnGap), y: bossY + cell.row * (bossBlockHeight + bossRowGap), w: bossBlockWidth, h: bossBlockHeight };
}

function maybeStartBossArmorReform(state: CanonicalState) {
  if (!waveDefinitionFrom(state.waves, state.wave).boss || state.bossArmorReformTimer > 0 || bossArmorIsAlive(state)) return;
  const core = state.bricks.find((brick) => brick.kind === "boss-core");
  if (!core || !core.alive) return;
  const ratio = core.hp / Math.max(1, core.maxHp);
  const thresholds = bossStage(state) <= 2 ? [0.5] : [0.75, 0.5, 0.25];
  const thresholdIndex = thresholds.findIndex((threshold, index) => ratio <= threshold && !state.bossArmorReformThresholds[index]);
  if (thresholdIndex < 0) return;
  state.bossArmorReformThresholds[thresholdIndex] = true;
  const cells: CanonicalBossArmorCell[] = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      if (row < 2 && col >= 1 && col <= 2) continue;
      cells.push({ row, col });
    }
  }
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const target = Math.floor(canonicalRandom(state, "world") * (index + 1));
    [cells[index], cells[target]] = [cells[target], cells[index]];
  }
  state.bossArmorReformCells = cells.slice(0, Math.min(4, 8));
  state.bossArmorReformTimer = 1.2;
  emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: GAME_WIDTH / 2, y: 94, radius: 190, duration: 1.2, color: "#aeb8ca", text: "ARMOR REFORMING" });
}

function finishBossArmorReform(state: CanonicalState) {
  for (const cell of state.bossArmorReformCells) {
    const position = bossArmorCellPosition(cell);
    const armor = makeBrick(state, position.x, position.y, position.w, position.h, state.bossArmorHp, "standard", "boss-minion", null);
    armor.bossRow = cell.row;
    armor.bossCol = cell.col;
    state.bricks.push(armor);
  }
  rebuildCollisionGrid(state);
  state.bossArmorReformCells = [];
  emitCanonicalVisual(state, { kind: "skill", skillId: "original" as UpgradeId, x: GAME_WIDTH / 2, y: 94, radius: 210, duration: 0.7, color: "#c5a766", text: "ARMOR ONLINE" });
}

const BOSS_REINFORCEMENT_TRAITS: CanonicalTrait[] = ["standard", "guard", "explosive", "healer", "reflector"];

function spawnBossReinforcements(state: CanonicalState) {
  const count = Math.max(1, state.wave);
  const columns = Math.floor(WAVE_COLUMNS / 2);
  const rows = 6;
  const gridWidth = columns * WAVE_CELL_SIZE * 2;
  const gridX = (GAME_WIDTH - gridWidth) / 2;
  const gridY = 220;
  const inset = 1;
  const width = WAVE_CELL_SIZE * 2 - inset * 2;
  const height = WAVE_CELL_SIZE - inset * 2;
  const cells = Array.from({ length: columns * rows }, (_, index) => index);
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const target = Math.floor(canonicalRandom(state, "world") * (index + 1));
    [cells[index], cells[target]] = [cells[target], cells[index]];
  }
  const positions = cells.slice(0, Math.min(count, cells.length)).map((cell) => ({
    x: gridX + (cell % columns) * WAVE_CELL_SIZE * 2 + inset,
    y: gridY + Math.floor(cell / columns) * WAVE_CELL_SIZE + inset,
  }));
  const ids: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const trait = BOSS_REINFORCEMENT_TRAITS[index % BOSS_REINFORCEMENT_TRAITS.length];
    const traitHpBonus = trait === "healer" || trait === "reflector" ? 1 : trait === "guard" ? 2 : 0;
    const position = positions[index];
    const brick = makeBrick(state, position.x, position.y, width, height, Math.max(1, 1 + Math.floor((state.wave - 1) / 2) + traitHpBonus), trait, "normal", null);
    ids.push(brick.id);
    state.bricks.push(brick);
  }
  rebuildCollisionGrid(state);
  state.bossReinforcementIds = ids;
  state.bossReinforcementTimer = 0;
  state.bossReinforcementTelegraph = 0;
  emitCanonicalVisual(state, { kind: "skill", skillId: "original" as UpgradeId, x: GAME_WIDTH / 2, y: gridY + (WAVE_CELL_SIZE * rows) / 2, radius: 250, duration: 0.7, color: "#ffcf4a" });
}

function updateBossReinforcements(state: CanonicalState, step: number) {
  if (state.bossReinforcementTelegraph > 0) {
    state.bossReinforcementTelegraph = Math.max(0, state.bossReinforcementTelegraph - step);
    if (state.bossReinforcementTelegraph <= 0) spawnBossReinforcements(state);
    return;
  }
  const reinforcementsRemain = state.bossReinforcementIds.some((id) => state.bricks.some((brick) => brick.id === id && brick.alive));
  if (reinforcementsRemain) return;
  if (state.bossReinforcementIds.length > 0) {
    state.bossReinforcementIds = [];
    state.bossReinforcementTimer = 10;
  }
  state.bossReinforcementTimer = Math.max(0, state.bossReinforcementTimer - step);
  if (state.bossReinforcementTimer <= 0) state.bossReinforcementTelegraph = 1.2;
}

function activateBossPattern(state: CanonicalState) {
  const stage = bossStage(state);
  const pattern = bossPatternSet(stage)[state.bossPattern++ % bossPatternSet(stage).length];
  if (pattern === 1) {
    const count = stage >= 3 ? 2 : 1;
    const positions = count === 1 ? [GAME_WIDTH / 2] : [GAME_WIDTH * 0.28, GAME_WIDTH * 0.72];
    state.bossBarriers.push(...positions.map((x) => ({ x, y: 118, w: 12, h: 250, life: 5.2 + stage * 0.25, maxLife: 5.2 + stage * 0.25, telegraph: 0.72, hitCount: 0, maxHits: 2 + stage })));
    return;
  }
  if (pattern === 2) {
    const count = stage >= 3 ? 3 : 2;
    const positions = count === 2 ? [GAME_WIDTH * 0.38, GAME_WIDTH * 0.62] : [GAME_WIDTH * 0.28, GAME_WIDTH / 2, GAME_WIDTH * 0.72];
    state.bossWalls.push(...positions.map((x, index) => ({ id: -100000 - state.bossPattern * 10 - index, x, y: 238, w: 78, h: 20, baseX: x, baseY: 238, life: 4.6 + stage * 0.35, maxLife: 4.6 + stage * 0.35, telegraph: 0.55, hp: 1 + Math.floor(stage / 2), maxHp: 1 + Math.floor(stage / 2) })));
    return;
  }
  if (pattern === 3) {
    const radius = 96 + stage * 12;
    state.gravityWells.push({ x: GAME_WIDTH * (stage % 2 ? 0.36 : 0.64), y: 245, radius, life: 4.2 + stage * 0.35, damagePerSecond: 0, damageType: "magic", damageTick: 1, sourceSkillId: "gravity-well" as UpgradeId, activeEffects: [] });
    return;
  }
  if (state.bossShield.active) return;
  const runeIds: number[] = [];
  for (const x of [270, 390, 510, 630]) {
    const rune = makeBrick(state, x - 24, 212, 48, 18, 2 + stage, "guard", "boss-minion");
    runeIds.push(rune.id);
    state.bricks.push(rune);
  }
  rebuildCollisionGrid(state);
  state.bossShield = { active: true, life: 5.8 + stage * 0.35, maxLife: 5.8 + stage * 0.35, runeIds };
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
  state.bossBarriers = [];
  state.bossWalls = [];
  state.bossShield = { active: false, life: 0, maxLife: 0, runeIds: [] };
  state.bossReinforcementIds = [];
  state.bossReinforcementTimer = 0;
  state.bossReinforcementTelegraph = 0;
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

function cloneSkillConfigForState(config: SkillConfig): SkillConfig {
  return {
    ...config,
    traits: [...config.traits],
    traitConfigs: (config.traitConfigs ?? []).map((trait) => ({ ...trait, values: [...trait.values] as [number, number, number], damage: [...trait.damage] as [number, number, number] })),
    evolutionTraits: (config.evolutionTraits ?? []).map((trait) => ({ ...trait, values: [...trait.values] as [number, number, number], damage: [...trait.damage] as [number, number, number] })),
    effects: (config.effects ?? []).map((effect) => ({ ...effect, values: [...effect.values] as [number, number, number], damage: [...effect.damage] as [number, number, number], interval: [...effect.interval] as [number, number, number], duration: [...effect.duration] as [number, number, number], radius: [...effect.radius] as [number, number, number] })),
    evolutionEffects: (config.evolutionEffects ?? []).map((effect) => ({ ...effect, values: [...effect.values] as [number, number, number], damage: [...effect.damage] as [number, number, number], interval: [...effect.interval] as [number, number, number], duration: [...effect.duration] as [number, number, number], radius: [...effect.radius] as [number, number, number] })),
    levels: [...config.levels] as [number, number, number],
    skillDamage: [...config.skillDamage] as [number, number, number],
    magicDamage: config.magicDamage ? [...config.magicDamage] as [number, number, number] : null,
    cooldown: [...config.cooldown] as [number, number, number],
  };
}

export function createCanonicalState(options: { seed: number; targetWave?: number; startWave?: number; balance?: BalanceConfig; skills?: SkillConfig[]; waves?: WaveDefinition[]; legacyEnchantments?: Partial<Record<LegacyUpgradeId, number>>; interactive?: boolean; startingSkills?: UpgradeId[] }): CanonicalState {
  const runConfig: CanonicalRunConfig = {
    balance: { ...DEFAULT_BALANCE_CONFIG, ...options.balance },
    skills: (options.skills?.length ? options.skills.map((config) => normalizeSkillConfigs([config]).find((entry) => entry.id === config.id) ?? config) : DEFAULT_SKILLS).map(cloneSkillConfigForState),
    waves: (options.waves?.length === WAVE_DEFINITIONS.length ? options.waves : WAVE_DEFINITIONS).map((wave) => ({ ...wave, pattern: [...wave.pattern], blocks: (wave.blocks ?? blocksFromPattern(wave.pattern)).map((block) => ({ ...block })) })),
    targetWave: options.targetWave ?? 20,
    startingSkills: [...(options.startingSkills ?? [])],
  };
  const interactive = options.interactive ?? false;
  const initialWave = Math.max(1, Math.min(runConfig.waves.length, Math.floor(options.startWave ?? 1)));
  const state: CanonicalState = {
    bossIntroTimer: 0,
    collisionGrid: new Map(),
    seed: options.seed, rng: { world: options.seed >>> 0 || 1, reward: (options.seed ^ 0x9e3779b9) >>> 0 || 1 }, runConfig, tick: 0, eventSequence: 0, phase: interactive ? "awaiting-start-skill" : "running", interactive, pendingChoices: [], pendingBossChoices: [], rerollsLeft: 1, pendingWave: null, clearedWave: null, clearedBoss: false, gameOverReason: null, stepEvents: [], balance: runConfig.balance, skills: runConfig.skills, waves: runConfig.waves, targetWave: runConfig.targetWave,
    wave: 1, waveElapsed: 0, elapsed: 0, rowTimer: 0, itemBarrierTime: 0, overdriveLevel: 0, paddleX: GAME_WIDTH / 2, paddleWidth: BASE_PADDLE_WIDTH, lastMove: 0, moveBoostTime: 0, balls: [], bricks: [], items: [], gravityWells: [], bossBarriers: [], bossWalls: [], bossShield: { active: false, life: 0, maxLife: 0, runeIds: [] }, bossArmorHp: 0, bossArmorReformThresholds: [false, false, false], bossArmorReformTimer: 0, bossArmorReformCells: [], bossReinforcementIds: [], bossReinforcementTimer: 0, bossReinforcementTelegraph: 0, upgrades: [], bossEnhancements: {}, legacyEnchantments: { ...(options.legacyEnchantments ?? {}) }, echoSplitReflections: 0, safetyBlocks: [], skillHistory: [], skillMetrics: {}, sharedSkillCooldowns: {}, combatStats: { physicalPower: 1, magicPower: 1, skillDamageMultiplier: 1, skillRangeMultiplier: 1, skillDurationMultiplier: 1, skillCooldownMultiplier: 1, chainBonus: 0 }, waveMetrics: [], coreHp: 8, maxCoreHp: 8, score: 0, bricksBroken: 0, combo: 0, maxCombo: 0, maxBalls: 1, ballLosses: 0, totalDamage: 0, physicalDamage: 0, magicDamage: 0, lastDamageElapsed: 0, reflectorBlockedHits: 0, barrierTime: 0, barrierCharges: 0, bossAttackTimer: 0, bossPattern: 0, lastShotTimer: 0, nextBrickId: 1, complete: false, gameOver: false,
  };
  state.wave = initialWave;
  buildWave(state, initialWave);
  state.balls = [makeBall(state)];
  for (const id of runConfig.startingSkills) grantCanonicalSkill(state, id, "start");
  state.stepEvents.length = 0;
  if (interactive && runConfig.startingSkills.length === 0) state.pendingChoices = createCanonicalChoices(state);
  else if (runConfig.startingSkills.length > 0) state.phase = "running";
  return state;
}

export function grantCanonicalSkill(state: CanonicalState, skillId: UpgradeId, source: CanonicalSkillEvent["source"], ballCost: 0 | 1 | 2 = 0) {
  const config = skill(state, skillId);
  const maxPicks = config?.evolutionEnabled ? 4 : 3;
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
  if (skillId === "common-damage" || skillId === "common-magic" || skillId === "common-skill-range" || skillId === "common-chain" || skillId === "common-cooldown" || skillId === "common-skill-duration") {
    refreshCanonicalCombatStats(state);
  }
  state.paddleWidth = Math.min(330, BASE_PADDLE_WIDTH + skillValue(state, "common-wide") + (evolved(state, "common-wide") ? 50 : 0));
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
  if (skillId === "common-wide") state.paddleWidth = Math.min(330, BASE_PADDLE_WIDTH + nextValue + (evolved(state, "common-wide") ? 50 : 0));
  if (skillId === "common-damage") {
    refreshCanonicalCombatStats(state);
  }
  if (skillId === "common-magic") refreshCanonicalCombatStats(state);
  state.skillHistory.push({ wave: state.wave, skillId, level: levelOf(state, skillId), source: "boss" });
  emitCanonicalEvent(state, { type: "upgrade-chosen", skillId, level: levelOf(state, skillId), source: "boss" });
  return true;
}

export function grantCanonicalEvolution(state: CanonicalState, skillId: UpgradeId) {
  const config = skill(state, skillId);
  if (!config?.evolution || pickCount(state, skillId) >= 4) return false;
  while (pickCount(state, skillId) < 4) {
    if (!grantCanonicalSkill(state, skillId, "boss")) return false;
  }
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
    if (state.pendingBossChoices.includes(command.skillId) && grantCanonicalEvolution(state, command.skillId)) {
      state.pendingBossChoices = [];
      state.phase = "ready-for-next-wave";
    }
  } else if (command.type === "launch-ball" && state.phase === "running" && state.bossIntroTimer <= 0) {
    const ball = state.balls.find((candidate) => candidate.awaitingLaunch && !candidate.temporary && !candidate.waveBonus);
    if (ball) {
      aimHeldBall(state, ball, command.aimX, command.aimY);
      ball.awaitingLaunch = false;
      ball.launchWaitTime = 0;
      if (ball.respawnRecoveryDuration > 0) ball.respawnRecoveryTime = ball.respawnRecoveryDuration;
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
  const bossIntroActive = Boolean(waveDefinitionFrom(state.waves, state.wave).boss && state.bossIntroTimer > 0);
  if (bossIntroActive) {
    // The boss entrance is a gameplay pause: keep the visual clock moving,
    // but do not let the player's launch countdown, paddle, attacks, skills,
    // or boss patterns advance until the intro has finished.
    state.bossIntroTimer = Math.max(0, state.bossIntroTimer - step);
    const bossCore = state.bricks.find((brick) => brick.kind === "boss-core");
    if (bossCore && (!bossCore.alive || bossCore.hp <= 0)) {
      completeWave(state);
      return stepResult(state);
    }
    for (const ball of state.balls) {
      if (ball.awaitingLaunch) aimHeldBall(state, ball, controls.aimX, controls.aimY);
    }
    return stepResult(state);
  }
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
  const moveMultiplier = 1 + (skillValue(state, "common-move-speed") + (evolved(state, "common-move-speed") ? 20 : 0)) / 100;
  if (evolved(state, "common-move-speed") && controls.move !== 0 && state.lastMove !== 0 && controls.move !== state.lastMove) state.moveBoostTime = 0.35;
  state.moveBoostTime = Math.max(0, state.moveBoostTime - step);
  if (controls.move !== 0) state.lastMove = controls.move;
  const reversalBoost = state.moveBoostTime > 0 ? 1.4 : 1;
  const previousPaddleX = state.paddleX;
  state.paddleX = Math.max(state.paddleWidth / 2, Math.min(GAME_WIDTH - state.paddleWidth / 2, state.paddleX + controls.move * PADDLE_SPEED * moveMultiplier * reversalBoost * step));
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    brick.healBlockTime = Math.max(0, brick.healBlockTime - step);
    const wasFrozen = brick.traitLockTime > 0 && brick.frostSourceSkillId === "mage-freeze";
    brick.traitLockTime = Math.max(0, brick.traitLockTime - step);
    if (!evolved(state, "archer-focus") && brick.focusTimer > 0) {
      brick.focusTimer = Math.max(0, brick.focusTimer - step);
      if (brick.focusTimer <= 0) brick.focusStacks = 0;
    }
    if (wasFrozen && brick.traitLockTime <= 0 && evolved(state, "mage-freeze")) {
      const spreadDamage = traitDamagePacket(state, "mage-freeze", "freeze").amount;
      const spreadDuration = skillDuration(state, traitValue(state, "mage-freeze", "freeze"));
      const spreadRadius = 125 * state.combatStats.skillRangeMultiplier + (evolved(state, "common-skill-range") ? 50 : 0);
      for (const target of state.bricks) {
        if (!target.alive || target === brick || target.trait === "indestructible" || brickDistance(target, brick) > spreadRadius) continue;
        target.traitLockTime = Math.max(target.traitLockTime, spreadDuration);
        target.frostVulnerability = Math.max(target.frostVulnerability, spreadDamage);
        target.frostSourceSkillId = "mage-freeze";
      }
      brick.frostSourceSkillId = null;
    }
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
        applyBrickDamage(state, brick, { amount: Math.max(0, skillValue(state, "poison")), damageType: "magic", delivery: "dot", sourceBall: state.balls[0], sourceSkillId: "poison" as UpgradeId, respectGuard: true });
      }
    }
  }
  for (const barrier of state.bossBarriers) {
    barrier.life -= step;
    barrier.telegraph = Math.max(0, barrier.telegraph - step);
  }
  state.bossBarriers = state.bossBarriers.filter((barrier) => barrier.life > 0 && barrier.hitCount < barrier.maxHits);
  for (const wall of state.bossWalls) {
    wall.life -= step;
    wall.telegraph = Math.max(0, wall.telegraph - step);
    const active = wall.maxLife - wall.life;
    const protrusion = wall.telegraph > 0 ? 0 : Math.min(30, active * 28);
    wall.y = wall.baseY - protrusion;
  }
  state.bossWalls = state.bossWalls.filter((wall) => wall.life > 0 && wall.hp > 0);
  if (state.bossShield.active) {
    state.bossShield.life -= step;
    const runesRemain = state.bossShield.runeIds.some((id) => state.bricks.some((brick) => brick.id === id && brick.alive));
    if (!runesRemain || state.bossShield.life <= 0) {
      if (state.bossShield.life <= 0) {
        const expiredRuneIds = new Set(state.bossShield.runeIds);
        state.bricks = state.bricks.filter((brick) => !expiredRuneIds.has(brick.id));
        rebuildCollisionGrid(state);
      }
      state.bossShield = { active: false, life: 0, maxLife: state.bossShield.maxLife, runeIds: [] };
    }
  }
  for (const well of state.gravityWells) {
    well.life -= step;
    well.damageTick -= step;
    if (well.life <= 0) {
      const origin = state.bricks.slice().sort((a, b) => Math.hypot(a.x + a.w / 2 - well.x, a.y + a.h / 2 - well.y) - Math.hypot(b.x + b.w / 2 - well.x, b.y + b.h / 2 - well.y))[0];
      const config = skill(state, well.sourceSkillId);
      if (origin && config) runConfiguredEffectEvents(state, state.balls[0], origin, config, "on-expire", well.radius, canonicalSkillDamagePacket(state, well.sourceSkillId).amount);
    }
    if (well.damagePerSecond > 0 && well.damageTick <= 0) {
      well.damageTick += 1;
      for (const brick of state.bricks) {
        if (!brick.alive || brick.trait === "indestructible") continue;
        if (Math.hypot(brick.x + brick.w / 2 - well.x, brick.y + brick.h / 2 - well.y) <= well.radius) applyBrickDamage(state, brick, { amount: well.damagePerSecond, damageType: well.damageType ?? "magic", delivery: "dot", sourceBall: state.balls[0], sourceSkillId: well.sourceSkillId, respectGuard: true });
      }
    }
    for (const effect of [...(well.activeEffects ?? [])].sort((a, b) => a.order - b.order)) {
      effect.timer -= step;
      if (effect.damage <= 0 || effect.timer > 0) continue;
      effect.timer += effect.interval;
      for (const brick of activeEffectTargets(state, well, effect)) applyBrickDamage(state, brick, { amount: effect.damage, damageType: effect.damageType, delivery: "dot", sourceBall: state.balls[0], sourceSkillId: well.sourceSkillId, respectGuard: true });
    }
  }
  state.gravityWells = state.gravityWells.filter((well) => well.life > 0);
  if (waveDefinitionFrom(state.waves, state.wave).boss) {
    if (state.bossArmorReformTimer > 0) {
      state.bossArmorReformTimer = Math.max(0, state.bossArmorReformTimer - step);
      if (state.bossArmorReformTimer <= 0) finishBossArmorReform(state);
    }
    state.bossIntroTimer = Math.max(0, state.bossIntroTimer - step);
    state.bossAttackTimer -= step;
    if (state.bossAttackTimer <= 0) { activateBossPattern(state); state.bossAttackTimer = Math.max(2.6, state.balance.bossAttackInterval - (state.wave >= 20 ? 2 : 1) * state.balance.bossAttackAcceleration); }
    updateBossReinforcements(state, step);
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
        const multiball = makeBall(state, state.paddleX, true, false, 0, controls.aimX, controls.aimY);
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
    if (ball.awaitingLaunch) {
      aimHeldBall(state, ball, controls.aimX, controls.aimY);
      ball.launchWaitTime = Math.max(0, ball.launchWaitTime - step);
      if (ball.launchWaitTime > 0) continue;
      ball.awaitingLaunch = false;
      if (ball.respawnRecoveryDuration > 0) ball.respawnRecoveryTime = ball.respawnRecoveryDuration;
    }
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
    if (well && well.sourceSkillId === ("gravity-well" as UpgradeId) && Math.hypot(well.x - ball.x, well.y - ball.y) < 18) {
      well.life = 0;
      emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: well.x, y: well.y, radius: 44, duration: 0.35, color: "#c18cff", text: "RUNE BREAK" });
    } else if (well) {
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
        { x: state.paddleX, previousX: previousPaddleX, y: PLAYER_PADDLE_Y, width: state.paddleWidth },
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
        state.combo = 0;
        emitCanonicalEvent(state, { type: "paddle-reflected", x: paddleContact.contactX, y: PLAYER_PADDLE_Y });
        const echoThreshold = canonicalEchoSplitThreshold(state);
        if (echoThreshold > 0 && ++state.echoSplitReflections >= echoThreshold) {
          state.echoSplitReflections = 0;
          state.balls.push(cloneEchoSplitBall(state, ball));
          emitCanonicalVisual(state, { kind: "skill", skillId: "echo-split" as UpgradeId, x: state.paddleX, y: PLAYER_PADDLE_Y, radius: 68, duration: 0.6, color: "#fff27a" });
        }
      }
    }
    for (const brick of collisionCandidates(state, ball, previousBallX, previousBallY)) {
      if (!brick.alive) continue;
      const collision = circleRect(ball, brick);
      if (!collision) continue;
      const indestructible = brick.trait === "indestructible";
      if (indestructible) {
        emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, radius: 34, duration: 0.35, color: "#aeb8ca" });
      }
      const crushBypassesReflector = evolved(state, "warrior-crush") && ball.canTriggerSkills && brick.trait === "reflector"
        && skillCooldownRemaining(state, ball, "warrior-crush") <= 0
        && Boolean(skill(state, "warrior-crush"))
        && hasTrait(state, skill(state, "warrior-crush")!, "crush");
      const protectedUnderside = brick.trait === "reflector"
        && !pierceEvolutionActive(state)
        && !crushBypassesReflector
        && brick.traitLockTime <= 0 && collision.ny > 0 && ball.vy < 0;
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
    const bossBarrier = state.bossBarriers.find((barrier) => barrier.telegraph <= 0 && circleRect(ball, barrier as unknown as CanonicalBrick));
    if (bossBarrier) {
      const collision = circleRect(ball, bossBarrier as unknown as CanonicalBrick);
      if (collision) {
        if (collision.nx) ball.vx = collision.nx * Math.abs(ball.vx); else ball.vy = collision.ny * Math.abs(ball.vy);
        ball.x += collision.nx * 2;
        ball.y += collision.ny * 2;
        bossBarrier.hitCount++;
        emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: bossBarrier.x, y: bossBarrier.y + bossBarrier.h / 2, radius: 38, duration: 0.3, color: "#e7c56f" });
        normalizeBallAngle(ball);
      }
    } else {
      const bossWall = state.bossWalls.find((wall) => wall.telegraph <= 0 && circleRect(ball, wall as unknown as CanonicalBrick));
      if (bossWall) {
        const collision = circleRect(ball, bossWall as unknown as CanonicalBrick);
        if (collision) {
          if (collision.nx) ball.vx = collision.nx * Math.abs(ball.vx); else ball.vy = collision.ny * Math.abs(ball.vy);
          ball.x += collision.nx * 2;
          ball.y += collision.ny * 2;
          bossWall.hp--;
          emitCanonicalVisual(state, { kind: "impact", skillId: "original" as UpgradeId, x: bossWall.x + bossWall.w / 2, y: bossWall.y + bossWall.h / 2, radius: 34, duration: 0.28, color: "#b5d8ff" });
          normalizeBallAngle(ball);
        }
      }
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
  const bossCore = state.bricks.find((brick) => brick.kind === "boss-core");
  const bossCoreDestroyed = currentWaveIsBoss && (!bossCore || bossCore.hp <= 0);
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
    safetyBlocks: state.safetyBlocks.map((block) => ({ ...block })),
  };
}

export function serializeCanonicalState(state: CanonicalState) {
  return JSON.stringify(state, (key, value) => key === "stepEvents" ? undefined : value);
}

export function restoreCanonicalState(serialized: string): CanonicalState {
  const parsed = JSON.parse(serialized) as Omit<CanonicalState, "stepEvents">;
  const state = { ...parsed, stepEvents: [] } as CanonicalState;
  state.collisionGrid = new Map();
  state.sharedSkillCooldowns ??= {};
  state.bossBarriers ??= [];
  state.bossWalls ??= [];
  state.bossShield ??= { active: false, life: 0, maxLife: 0, runeIds: [] };
  state.bossReinforcementIds ??= [];
  state.bossReinforcementTimer ??= 0;
  state.bossReinforcementTelegraph ??= 0;
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
    config.effects ??= fallback?.effects ? fallback.effects.map((effect) => ({ ...effect })) : [];
    config.evolutionEffects ??= fallback?.evolutionEffects ? fallback.evolutionEffects.map((effect) => ({ ...effect })) : [];
    config.damageType ??= "magic";
    config.skillDamage ??= [...(config.magicDamage ?? fallback?.skillDamage ?? [0, 0, 0])] as [number, number, number];
  }
  state.waves = state.runConfig.waves;
  state.targetWave = state.runConfig.targetWave;
  state.lastMove ??= 0;
  state.moveBoostTime ??= 0;
  state.combatStats ??= { physicalPower: 1, magicPower: 1, skillDamageMultiplier: 1, skillRangeMultiplier: 1, skillDurationMultiplier: 1, skillCooldownMultiplier: 1, chainBonus: 0 };
  state.combatStats.skillDamageMultiplier ??= 1;
  state.combatStats.skillRangeMultiplier ??= 1;
  state.combatStats.skillDurationMultiplier ??= 1;
  state.combatStats.skillCooldownMultiplier ??= 1;
  state.combatStats.chainBonus ??= 0;
  refreshCanonicalCombatStats(state);
  state.totalDamage = Math.max(0, Number(state.totalDamage) || 0);
  state.physicalDamage = Math.max(0, Number(state.physicalDamage ?? state.totalDamage) || 0);
  state.magicDamage = Math.max(0, Number(state.magicDamage) || 0);
  state.maxCoreHp = canonicalIntegerCombatAmount(state.maxCoreHp);
  state.coreHp = Math.min(state.maxCoreHp, Math.max(0, Math.round(Number(state.coreHp) || 0)));
  for (const ball of state.balls) {
    ball.explosionBaseSpeed ??= null;
    ball.explosionBoostRatio ??= 1;
    ball.explosionBoostTime ??= 0;
  }
  for (const well of state.gravityWells) {
    for (const effect of well.activeEffects ?? []) {
      effect.order ??= 0;
      effect.radius ??= 0;
    }
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
    if (metric) metric.damage = Math.max(0, Number(metric.damage) || 0);
  }
  for (const ball of state.balls) {
    ball.canTriggerSkills ??= !ball.temporary;
    ball.skillGeneration ??= 0;
    ball.lastHitBrickId ??= null;
    ball.gravityBaseSpeed ??= null;
    ball.awaitingLaunch ??= false;
    ball.launchWaitTime ??= ball.awaitingLaunch ? 3 : 0;
  }
  rebuildCollisionGrid(state);
  return state;
}

/** Ball-only parity phase; deliberately excludes brick/paddle/game rules. */
export function advanceCanonicalBallsPure(state: CanonicalState, dt: number, width = GAME_WIDTH, top = 0) {
  const step = Math.max(0, Math.min(0.025, dt));
  for (const ball of state.balls) {
    if (ball.awaitingLaunch) continue;
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
      const damage = canonicalDamageAmount(ball.attackPower);
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
    const contact = sweptPaddleContact(ball, prior.x, prior.y, { x: state.paddleX, previousX: state.paddleX, y: paddleY, width: state.paddleWidth }, options.slop ?? 4, options.sideDepth ?? 18, options.forgiveness ?? 10);
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
