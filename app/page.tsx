"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameAudio } from "./game-audio";
import { DEFAULT_SKILLS, ENCHANT_MODE_LABELS, levelValue, NORMAL_SKILLS, normalizeSkillConfigs, SKILL_COLORS, SKILL_MECHANIC_LABELS, SKILL_STORAGE_KEY, skillConfigMap, ULTIMATE_SKILLS, type ClassSkillId, type SkillCategory, type SkillConfig, type SkillMechanic, type UpgradeId } from "./skill-config";
import { BALANCE_STORAGE_KEY, BOT_LIVE_STORAGE_KEY, BOT_RESULTS_STORAGE_KEY, DEFAULT_BALANCE_CONFIG, DEFAULT_SKILL_BENCH_CONFIG, DEFAULT_SKILL_BENCH_PROGRESS, normalizeBalanceConfig, normalizeSkillBenchConfig, normalizeSkillBenchProgress, SKILL_BENCH_PROGRESS_KEY, SKILL_BENCH_STORAGE_KEY, type BalanceConfig, type BotWaveSample, type SkillBenchConfig, type SkillBenchProgress } from "./balance-config";
import { BENCHMARK_STORAGE_KEY, DEFAULT_BENCHMARK_CONFIG, normalizeBenchmarkConfig, type BenchmarkConfig } from "./benchmark-config";
import { MAX_WAVE, waveDefinition } from "./wave-config";
import { PARALLEL_BENCHMARK_RULESET, type HeadlessBenchmarkRequest, type HeadlessBenchmarkResult } from "./benchmark-headless";
import { clearBenchmarkResults, getBenchmarkResults, putBenchmarkResults } from "./benchmark-result-store";

type PayloadId = "pierce" | "blast" | "glass" | "link";
type ItemKind = "multiball";
type BrickKind = "normal" | "boss-armor" | "boss-core" | "boss-minion";
type BrickTrait = "standard" | "guard" | "explosive" | "indestructible" | "healer" | "reflector";
type BossRewardId = ClassSkillId;
type BotPolicy = "balanced" | "survival" | "random";
type BotSpeed = 1 | 2 | 4 | 8;
type BenchmarkRunMode = "parallel" | "watch";
type BotMetrics = { maxBalls: number; ballLosses: number; missileActivations: number; safetySaves: number; gravityRescues: number };
type SkillBenchVariant = { batchId: string; environment: SkillBenchConfig["environment"]; skillId: UpgradeId | "original"; level: 0 | 1 | 2 | 3; skillValues: [number, number, number]; seed: number };
type SkillSelectionSource = "start" | "wave" | "boss";
type SkillSelectionEvent = { wave: number; skillId: UpgradeId; level: number; source: SkillSelectionSource };
type SkillRunMetric = { activations: number; damage: number; kills: number };
type BenchmarkRuleset = "live-v1" | "live-v2" | "watch-v1" | "parallel-v1" | typeof PARALLEL_BENCHMARK_RULESET;
type BotRunResult = BotMetrics & { id: string; run: number; policy: BotPolicy; speed: BotSpeed; elapsed: number; wave: number; score: number; bricks: number; maxCombo: number; coreHp: number; upgrades: UpgradeId[]; startingSkills: UpgradeId[]; skillHistory: SkillSelectionEvent[]; ultimates: UpgradeId[]; skillMetrics: Partial<Record<UpgradeId, SkillRunMetric>>; createdAt: number; balanceConfig: BalanceConfig; benchmarkConfig: BenchmarkConfig | null; benchmarkRuleset?: BenchmarkRuleset | null; waveSamples: BotWaveSample[]; evaluationComplete: boolean; skillBench: SkillBenchVariant | null };

type Upgrade = {
  id: UpgradeId;
  name: string;
  category: SkillCategory;
  mechanic: SkillMechanic;
  tag: string;
  description: string;
  color: string;
};

type UpgradeChoice = { upgrade: Upgrade; ballCost: 0 | 1 | 2 };

type GhostRecord = {
  id: string;
  name: string;
  score: number;
  bricks: number;
  maxCombo: number;
  upgrades: UpgradeId[];
  skillHistory: SkillSelectionEvent[];
  skillMetrics: Partial<Record<UpgradeId, SkillRunMetric>>;
  paddleTrack: number[];
  createdAt: number;
};

type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  owner: "player" | "ghost";
  ghostIndex?: number;
  pierce: number;
  maxPierce: number;
  blast: number;
  payload: PayloadId | null;
  payloadLevel: number;
  payloads: Partial<Record<PayloadId, number>>;
  attackPower: number;
  color: string;
  sourcePaddleId: string;
  missileTime: number;
  missileHitCooldown: number;
  gravityRescueCooldown: number;
  skillCharges: Partial<Record<ClassSkillId, number>>;
  visualSkill: ClassSkillId | null;
  temporaryTime: number;
  waveBonus: boolean;
};

type Brick = {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  hue: number;
  alive: boolean;
  drop: ItemKind | null;
  kind: BrickKind;
  trait: BrickTrait;
  guardReady: boolean;
  healTimer: number;
  poisonTime: number;
  poisonTick: number;
  poisonSourcePaddleId: string | null;
  burnTime: number;
  burnTick: number;
  burnLevel: number;
  burnSourcePaddleId: string | null;
  blastVulnerability: number;
  blastVulnerabilitySourcePaddleId: string | null;
  frostVulnerability: number;
  traitLockTime: number;
  lastHitPaddleId: string | null;
};

type DropItem = {
  id: number;
  x: number;
  y: number;
  vy: number;
  alive: boolean;
  kind: ItemKind;
};

type SafetyBlock = { ownerPaddleId: string; x: number; y: number; width: number; color: string };
type GravityWell = { ownerPaddleId: string; x: number; y: number; radius: number; life: number; maxLife: number; color: string };

type GameState = {
  balls: Ball[];
  bricks: Brick[];
  paddleX: number;
  paddleWidth: number;
  ghostPaddles: number[];
  elapsed: number;
  score: number;
  level: number;
  combo: number;
  maxCombo: number;
  comboTimer: number;
  bricksBroken: number;
  upgrades: UpgradeId[];
  paddleTrack: number[];
  particles: Particle[];
  flashes: Flash[];
  effects: GameEffect[];
  items: DropItem[];
  safetyBlocks: SafetyBlock[];
  gravityWells: GravityWell[];
  paddleBarriers: Record<string, number>;
  ultimateAuras: Partial<Record<ClassSkillId, boolean>>;
  paddleCounters: Record<string, PaddleCounter>;
  coreHp: number;
  maxCoreHp: number;
  bossActive: boolean;
  bossPending: boolean;
  bossStage: number;
  nextBossWave: number;
  bossTimeRemaining: number;
  bossSkillTimer: number;
  bossAttackPattern: number;
  bossMultiballsRemaining: number;
  bossRewards: BossRewardId[];
  autoGuard: boolean;
  rowTimer: number;
  rowInterval: number;
  overdriveLevel: number;
  shakeStrength: number;
  shakeTime: number;
  shakeDuration: number;
  screenFlashColor: string;
  screenFlashTime: number;
  screenFlashDuration: number;
  wave: number;
  failed: boolean;
  failureReason: "ball" | "core" | null;
  botMetrics: BotMetrics;
  botWaveSamples: BotWaveSample[];
  botSampleKey: string;
  waveResolution: WaveResolution | null;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Flash = { text: string; x: number; y: number; life: number; color: string };
type GameEffect = { kind: "ring" | "beam" | "blast" | "drop" | "spark" | "lightning" | "skill"; x: number; y: number; x2: number; y2: number; size: number; life: number; maxLife: number; color: string; variant: number; skillId: ClassSkillId | null };
type PaddleCounter = { reflections: number; barrierReflections: number; missileReflections: number; safetyTimer: number; gravityTimer: number; directKills: number; pierceKills: number; feverMilestone: number; lastShotTimer: number; combo: number; comboTimer: number; skillReflections: Partial<Record<ClassSkillId, number>>; chargePulse: number; chargeColor: string };
type WaveSettlement = { wave: number; waveName: string; cleared: boolean; wasBoss: boolean; survivors: number; coreDamage: number; blocked: number; coreHp: number; elapsed: number; finalWave: boolean };
type WaveResolution = { timer: number; maxTimer: number; cleared: boolean; wasBoss: boolean; survivors: number; coreDamage: number; blocked: number };

const W = 900;
const H = 600;
const BENCHMARK_RULESET: BenchmarkRuleset = PARALLEL_BENCHMARK_RULESET;
const PLAYER_LINE_Y = H - 84;
const PLAYER_PADDLE_Y = H - 70;
const GHOST_PADDLE_Y = H - 42;
const BRICK_ROW_Y = 74;
const BRICK_ROW_STEP = 34;
const STARTING_WAVE_ELAPSED = 0;
const MAX_GHOSTS = 10;
const MAX_ACTIVE_GHOSTS = 3;
const MAX_CORE_HP = 8;
const BOSS_INTERVAL = 10;
const NORMAL_STAGE_MULTIBALL_WAVES = [2, 4, 6, 8, 11, 13, 16, 18];
const BOSS_MULTIBALL_BUDGET = 2;
const BOT_EVALUATION_WAVE = MAX_WAVE;
const BASE_BALL_VX = 240;
const BASE_BALL_VY = 320;
const OVERDRIVE_THRESHOLDS = [30, 50, 70, 90] as const;
const OVERDRIVE_STEP = 0.05;
const MAX_OVERDRIVE_LEVEL = OVERDRIVE_THRESHOLDS.length;
const MIN_PADDLE_REBOUND_SPEED = 300;
const MAX_PADDLE_REBOUND_SPEED = 560;
const MAX_PADDLE_REBOUND_RATIO = 0.84;
const PADDLE_COLLISION_SLOP = 3;
const PADDLE_SIDE_FORGIVENESS = 14;
const PADDLE_SIDE_DEPTH = 18;
const PADDLE_ENGLISH_FACTOR = 0.32;
const RING_EXPLOSION_ASSET = "/assets/vfx/ring-explosion.png";
const RING_EXPLOSION_COLUMNS = 10;
const RING_EXPLOSION_FRAME_SIZE = 100;
const RING_EXPLOSION_FRAMES = 56;
const HIT_SPARK_ASSETS = ["/assets/vfx/hit-spark-a.png", "/assets/vfx/hit-spark-b.png"] as const;
const HIT_SPARK_FRAME_SIZE = 32;
const HIT_SPARK_FRAMES = 9;
const RADIAL_LIGHTNING_ASSET = "/assets/vfx/radial-lightning.png";
const RADIAL_LIGHTNING_COLUMNS = 4;
const RADIAL_LIGHTNING_FRAME_SIZE = 64;
const RADIAL_LIGHTNING_FRAMES = 8;
const MAGE_SPELL_ASSETS = ["/assets/vfx/mage-fireball.png", "/assets/vfx/mage-sparks.png"] as const;
const MAGE_SPELL_FRAME_SIZE = 16;
const MAGE_SPELL_FRAMES = 6;
const MAX_PADDLE_ENGLISH = 220;
const PLAYER_BALL_COLOR = "#fff27a";
const WAVE_MULTIBALL_COLOR = "#9aa3b2";
const BARRIER_COLOR = "#58a6ff";
let environmentRandom = () => Math.random();
let decisionRandom = () => Math.random();
let effectRandom = () => Math.random();

function overdriveLevelAt(seconds: number) {
  return OVERDRIVE_THRESHOLDS.filter((threshold) => seconds >= threshold).length;
}

function overdriveMultiplier(level: number) {
  return 1 + Math.max(0, Math.min(MAX_OVERDRIVE_LEVEL, level)) * OVERDRIVE_STEP;
}

function circleRectangleCollision(ball: Pick<Ball, "x" | "y" | "radius">, brick: Pick<Brick, "x" | "y" | "w" | "h">, previousX: number, previousY: number) {
  const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
  const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared > ball.radius * ball.radius) return null;
  if (distanceSquared > 0.0001) {
    const distance = Math.sqrt(distanceSquared);
    return { normalX: dx / distance, normalY: dy / distance, penetration: ball.radius - distance };
  }

  const exits = [
    { normalX: -1, normalY: 0, distance: Math.abs(previousX - (brick.x - ball.radius)) },
    { normalX: 1, normalY: 0, distance: Math.abs(previousX - (brick.x + brick.w + ball.radius)) },
    { normalX: 0, normalY: -1, distance: Math.abs(previousY - (brick.y - ball.radius)) },
    { normalX: 0, normalY: 1, distance: Math.abs(previousY - (brick.y + brick.h + ball.radius)) },
  ];
  const exit = exits.sort((a, b) => a.distance - b.distance)[0];
  const penetration = exit.normalX < 0 ? ball.x + ball.radius - brick.x
    : exit.normalX > 0 ? brick.x + brick.w - (ball.x - ball.radius)
    : exit.normalY < 0 ? ball.y + ball.radius - brick.y
    : brick.y + brick.h - (ball.y - ball.radius);
  return { normalX: exit.normalX, normalY: exit.normalY, penetration: Math.max(0, penetration) };
}

function separateAndReflectBall(ball: Ball, collision: { normalX: number; normalY: number; penetration: number }) {
  ball.x += collision.normalX * (collision.penetration + 0.1);
  ball.y += collision.normalY * (collision.penetration + 0.1);
  const approachSpeed = ball.vx * collision.normalX + ball.vy * collision.normalY;
  if (approachSpeed >= 0) return;
  ball.vx -= 2 * approachSpeed * collision.normalX;
  ball.vy -= 2 * approachSpeed * collision.normalY;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function configureRunRandom(seed?: number) {
  if (seed === undefined) {
    environmentRandom = () => Math.random();
    decisionRandom = () => Math.random();
    effectRandom = () => Math.random();
    return;
  }
  environmentRandom = seededRandom(seed);
  decisionRandom = seededRandom(seed ^ 0x9e3779b9);
  effectRandom = seededRandom(seed ^ 0x85ebca6b);
}
const GHOST_COLORS = ["#9b8cff", "#58d5ff", "#ff78b7"];
const PAYLOAD_COLORS: Record<PayloadId, string> = { pierce: "#9a8cff", blast: "#ff6b87", glass: "#60d7ff", link: "#72f1b8" };
const PAYLOAD_LABELS: Record<PayloadId, string> = { pierce: "PIERCE", blast: "BOMB", glass: "GLASS", link: "LINK" };
const PAYLOAD_IDS: PayloadId[] = ["pierce", "blast", "glass", "link"];
const COUNTED_SKILL_IDS: UpgradeId[] = DEFAULT_SKILLS.filter((entry) => entry.category !== "common").map((entry) => entry.id);
const SKILL_ICONS: Partial<Record<UpgradeId, string>> = {
  "warrior-smash": "⚒", "warrior-shockwave": "◉", "warrior-execute": "✦", "warrior-crush": "◆", "warrior-guard": "⬡", "warrior-earthquake": "▰", "warrior-berserker": "♨",
  "archer-rapid": "➶", "archer-pierce": "➵", "archer-ricochet": "⌁", "archer-focus": "◎", "archer-weakpoint": "⌾", "archer-arrow-rain": "⇊", "archer-infinite": "∞",
  "mage-fireball": "●", "mage-lightning": "ϟ", "mage-freeze": "❄", "mage-black-hole": "◌", "mage-mana-blast": "✧", "mage-elemental-storm": "✺", "mage-meteor": "☄",
  "common-magnet": "⌁", "common-luck": "✤", "common-wide": "↔", "common-xp": "◇", "common-combo": "∞",
  "common-ball-size": "●", "common-skill-range": "◎", "common-chain": "⌘", "common-damage": "▲",
};
const PADDLE_UPGRADES = new Set<UpgradeId>(DEFAULT_SKILLS.map((entry) => entry.id));
const ITEM_DATA: Record<ItemKind, { label: string; symbol: string; color: string }> = {
  multiball: { label: "MULTI BALL", symbol: "+", color: "#ffcf4a" },
};
const ITEM_KINDS = Object.keys(ITEM_DATA) as ItemKind[];
const BRICK_TRAIT_DATA: Record<Exclude<BrickTrait, "standard">, { label: string; glyph: string; color: string; description: string }> = {
  guard: { label: "가드", glyph: "방", color: "#fff27a", description: "첫 피격 1회 무시" },
  explosive: { label: "폭발", glyph: "폭", color: "#ff8a3d", description: "파괴 시 주변 피해 · 공 밀어냄" },
  indestructible: { label: "불괴", glyph: "불", color: "#aeb8ca", description: "파괴 불가" },
  healer: { label: "회복", glyph: "회", color: "#72f1b8", description: "3초마다 주변 체력 +1" },
  reflector: { label: "반사", glyph: "반", color: "#65dcff", description: "아래에서 오는 공 반사" },
};
const BRICK_TRAITS = Object.keys(BRICK_TRAIT_DATA) as Exclude<BrickTrait, "standard">[];

const CLASS_META: Record<SkillCategory, { tag: string; color: string }> = {
  warrior: { tag: "WARRIOR", color: "#ff6b57" },
  archer: { tag: "ARCHER", color: "#72f1b8" },
  mage: { tag: "MAGE", color: "#9a8cff" },
  common: { tag: "COMMON", color: "#9aa3b2" },
};

function createUpgradeCatalog(skills: SkillConfig[]): Upgrade[] {
  return skills.map((skill) => ({
    id: skill.id,
    name: skill.name,
    category: skill.category,
    mechanic: skill.mechanic,
    tag: `${CLASS_META[skill.category].tag} · ${SKILL_MECHANIC_LABELS[skill.mechanic]}${skill.ultimate ? " · ULTIMATE" : ""}`,
    description: skill.description,
    color: skill.color,
  }));
}

const SKILL_VALUE_PARTS = /([+-]?\d+(?:\.\d+)?(?:\/[+-]?\d+(?:\.\d+)?)*(?:~[+-]?\d+(?:\.\d+)?)?(?:%|px|초|개|배|DMG|HP|회|발)?)/g;
const SKILL_VALUE_EXACT = /^[+-]?\d+(?:\.\d+)?(?:\/[+-]?\d+(?:\.\d+)?)*(?:~[+-]?\d+(?:\.\d+)?)?(?:%|px|초|개|배|DMG|HP|회|발)?$/;

function SkillDescriptionText({ text }: { text: string }) {
  return <>{text.split(SKILL_VALUE_PARTS).filter(Boolean).map((part, index) => (
    <span key={`${part}-${index}`} className={SKILL_VALUE_EXACT.test(part) ? "skill-value-accent" : undefined}>{part}</span>
  ))}</>;
}

let activeSkillMap = skillConfigMap(DEFAULT_SKILLS);
const DEFAULT_UPGRADES = createUpgradeCatalog(NORMAL_SKILLS);
const DEFAULT_ULTIMATE_UPGRADES = createUpgradeCatalog(ULTIMATE_SKILLS);

function skillValue(id: UpgradeId, level: number) {
  const config = activeSkillMap[id];
  return level <= 0 || !config ? 0 : levelValue(level, config.levels);
}

function classSkillColor(id: ClassSkillId) {
  return activeSkillMap[id]?.color ?? SKILL_COLORS[id];
}

function setImpactFeedback(game: GameState, strength: number, color?: string, duration = 0.16, flashDuration = 0) {
  game.shakeStrength ??= 0;
  game.shakeTime ??= 0;
  game.shakeDuration ??= 0;
  game.screenFlashColor ??= "#ffffff";
  game.screenFlashTime ??= 0;
  game.screenFlashDuration ??= 0;
  if (strength >= game.shakeStrength || game.shakeTime <= 0) {
    game.shakeStrength = Math.min(14, strength);
    game.shakeTime = duration;
    game.shakeDuration = duration;
  }
  if (color && flashDuration > 0 && flashDuration >= game.screenFlashTime) {
    game.screenFlashColor = color;
    game.screenFlashTime = flashDuration;
    game.screenFlashDuration = flashDuration;
  }
}

function ghostPaddleY() {
  return GHOST_PADDLE_Y;
}

function ghostPaddleWidth(ghost: GhostRecord) {
  return Math.min(260, 92 + skillValue("wide", upgradeLevel(ghost.upgrades, "wide")));
}

function upgradeLevel(upgrades: UpgradeId[], id: UpgradeId) {
  if (!Array.isArray(upgrades)) return 0;
  return Math.min(4, upgrades.filter((upgrade) => upgrade === id).length);
}

function commonSkillRangeMultiplier(upgrades: UpgradeId[]) {
  return 1 + skillValue("common-skill-range", upgradeLevel(upgrades, "common-skill-range")) / 100;
}

function commonChainBonus(upgrades: UpgradeId[]) {
  return Math.max(0, Math.floor(skillValue("common-chain", upgradeLevel(upgrades, "common-chain"))));
}

function payloadEntries(upgrades: UpgradeId[]) {
  return PAYLOAD_IDS.map((id) => ({ id, level: upgradeLevel(upgrades, id) })).filter((entry) => entry.level > 0);
}

function ballBodyColor(ball: Pick<Ball, "waveBonus">) {
  return ball.waveBonus ? WAVE_MULTIBALL_COLOR : PLAYER_BALL_COLOR;
}

function syncBallPayloadDisplay(ball: Ball, upgrades: UpgradeId[] = []) {
  const active = PAYLOAD_IDS.filter((id) => (ball.payloads[id] ?? 0) > 0);
  if (active.length === 0) {
    ball.payload = null;
    ball.payloadLevel = 0;
  } else {
    const latest = active[active.length - 1];
    ball.payload = latest;
    ball.payloadLevel = ball.payloads[latest] ?? 0;
  }
  const corrosionPower = skillValue("corrosion", upgradeLevel(upgrades, "corrosion"));
  const commonDamage = skillValue("common-damage", upgradeLevel(upgrades, "common-damage"));
  const enchantPower = (ball.payloads.blast ?? 0) * 0.65 + (ball.payloads.link ?? 0) * 0.35 + (ball.payloads.glass ?? 0) * 0.25 + Math.min(1.5, ball.pierce * 0.2);
  const berserkerLevel = ball.skillCharges?.["warrior-berserker"] ?? 0;
  ball.attackPower = Math.max(1 + commonDamage + corrosionPower + enchantPower, berserkerLevel > 0 ? 4 + berserkerLevel + commonDamage : 1 + commonDamage);
  ball.color = ballBodyColor(ball);
}

function clearBallEnchantments(ball: Ball, upgrades: UpgradeId[] = []) {
  ball.pierce = 0;
  ball.maxPierce = 0;
  ball.blast = 0;
  ball.payload = null;
  ball.payloadLevel = 0;
  ball.payloads = {};
  ball.radius = 8 + skillValue("common-ball-size", upgradeLevel(upgrades, "common-ball-size"));
  ball.attackPower = 1 + skillValue("common-damage", upgradeLevel(upgrades, "common-damage"));
  ball.color = ballBodyColor(ball);
  ball.missileTime = 0;
  ball.missileHitCooldown = 0;
  ball.gravityRescueCooldown = 0;
  ball.skillCharges = {};
  ball.visualSkill = null;
}

function pickBrickDrop(): ItemKind | null {
  return null;
}

function hasScheduledMultiball(wave: number) {
  const waveInStage = ((wave - 1) % BOSS_INTERVAL) + 1;
  return NORMAL_STAGE_MULTIBALL_WAVES.includes(waveInStage);
}

function brickRuntimeState(trait: BrickTrait = "standard") {
  return { trait, guardReady: trait === "guard", healTimer: 3, poisonTime: 0, poisonTick: 0, poisonSourcePaddleId: null, burnTime: 0, burnTick: 0, burnLevel: 0, burnSourcePaddleId: null, blastVulnerability: 1, blastVulnerabilitySourcePaddleId: null, frostVulnerability: 0, traitLockTime: 0, lastHitPaddleId: null };
}

function lateWaveHpMultiplier(waveNumber: number) {
  return waveNumber >= 16 ? 1.5 : waveNumber >= 11 ? 1.25 : 1;
}

function isDamageableBrick(brick: Brick) {
  return brick.trait !== "indestructible";
}

function newPaddleCounter(): PaddleCounter {
  return { reflections: 0, barrierReflections: 0, missileReflections: 0, safetyTimer: 0, gravityTimer: 0, directKills: 0, pierceKills: 0, feverMilestone: 0, lastShotTimer: 0, combo: 0, comboTimer: 0, skillReflections: {}, chargePulse: 0, chargeColor: PLAYER_BALL_COLOR };
}

function makeBrickRow(row: number, wave = 1, ghostCount = 0, balance = DEFAULT_BALANCE_CONFIG): Brick[] {
  const bricks: Brick[] = [];
  const cols = 12;
  const brickCount = Math.min(9, 7 + Math.floor(environmentRandom() * 3));
  const activeColumns = new Set(Array.from({ length: cols }, (_, col) => col).sort(() => environmentRandom() - 0.5).slice(0, brickCount));
  const multiballColumn = hasScheduledMultiball(wave) ? [...activeColumns][Math.floor(environmentRandom() * activeColumns.size)] : -1;
  const gap = 7;
  const margin = 36;
  const width = (W - margin * 2 - gap * (cols - 1)) / cols;
  for (let col = 0; col < cols; col++) {
    if (!activeColumns.has(col)) continue;
    const hardBrickChance = Math.min(0.9, 0.16 + wave * balance.hardChanceGrowth + ghostCount * 0.06);
    const baseHp = 1 + Math.floor((wave - 1) / Math.max(1, Math.round(balance.baseHpWaveStep)));
    const hardHp = baseHp + 1 + Math.floor((wave - 1) / Math.max(1, Math.round(balance.hardHpWaveStep)));
    let maxHp = environmentRandom() < hardBrickChance ? hardHp : baseHp;
    const guardChance = Math.min(0.22, 0.05 + wave * balance.guardChanceGrowth);
    const trait: BrickTrait = environmentRandom() < guardChance ? "guard" : "standard";
    bricks.push({
      x: margin + col * (width + gap),
      y: BRICK_ROW_Y + row * BRICK_ROW_STEP,
      w: width,
      h: 24,
      hp: maxHp,
      maxHp,
      hue: 185 + wave * 9 + col * 2,
      alive: true,
      drop: col === multiballColumn ? "multiball" : pickBrickDrop(),
      kind: "normal",
      ...brickRuntimeState(trait),
    });
  }
  return bricks;
}

function makeWaveBricks(waveNumber: number, balance = DEFAULT_BALANCE_CONFIG): Brick[] {
  const definition = waveDefinition(waveNumber);
  if (definition.boss) return makeBossBricks(definition.boss === "final" ? 2 : 1, 0, balance);
  const cols = 12;
  const gap = 7;
  const margin = 36;
  const width = (W - margin * 2 - gap * (cols - 1)) / cols;
  const baseHp = 1 + Math.floor((waveNumber - 1) / Math.max(1, Math.round(balance.baseHpWaveStep)));
  const multiballCells = definition.pattern.flatMap((row, rowIndex) => [...row].map((cell, col) => ({ cell, rowIndex, col }))).filter(({ cell }) => cell !== ".");
  const multiballKey = hasScheduledMultiball(waveNumber) && multiballCells.length > 0
    ? multiballCells[Math.floor(environmentRandom() * multiballCells.length)]
    : null;
  return definition.pattern.flatMap((row, rowIndex) => [...row].flatMap((cell, col) => {
    if (cell === ".") return [];
    const trait: BrickTrait = cell === "g" ? "guard"
      : cell === "e" ? "explosive"
      : cell === "x" ? "indestructible"
      : cell === "c" ? "healer"
      : cell === "r" ? "reflector"
      : "standard";
    const hpBonus = cell === "h" ? 1 + Math.floor((waveNumber - 1) / 8) : cell === "c" ? 2 : 0;
    const maxHp = Math.ceil((baseHp + hpBonus) * lateWaveHpMultiplier(waveNumber));
    return [{
      x: margin + col * (width + gap), y: BRICK_ROW_Y + rowIndex * BRICK_ROW_STEP, w: width, h: 24,
      hp: maxHp, maxHp, hue: 178 + waveNumber * 9 + col * 2, alive: true, kind: "normal" as const,
      drop: multiballKey?.rowIndex === rowIndex && multiballKey.col === col ? "multiball" as const : pickBrickDrop(),
      ...brickRuntimeState(trait),
    }];
  }));
}

function makeBossBricks(stage: number, ghostCount: number, balance: BalanceConfig): Brick[] {
  const cols = 4;
  const rows = 3;
  const cellWidth = 104;
  const cellHeight = 34;
  const width = cols * cellWidth;
  const height = rows * cellHeight;
  const startX = (W - width) / 2;
  const startY = 94;
  const bossHpMultiplier = stage >= 2 ? 1.3 : 0.95;
  const coreHp = Math.round((balance.bossBaseHp + stage * balance.bossHpPerStage + ghostCount * 10) * bossHpMultiplier);
  return [{
    x: startX, y: startY, w: width, h: height,
    hp: coreHp, maxHp: coreHp,
    hue: 345, alive: true, kind: "boss-core",
    drop: "multiball",
    ...brickRuntimeState(),
  }];
}

type BossAttackPattern = { name: string; cells: Array<{ col: number; row: number; trait: BrickTrait }> };

const MID_BOSS_ATTACK_PATTERNS: BossAttackPattern[] = [
  { name: "SCATTER BOMB", cells: [
    { col: 1, row: 0, trait: "standard" }, { col: 4, row: 1, trait: "explosive" },
    { col: 7, row: 0, trait: "standard" }, { col: 10, row: 1, trait: "explosive" },
  ] },
  { name: "GUARD WINGS", cells: [
    { col: 2, row: 1, trait: "guard" }, { col: 3, row: 0, trait: "standard" },
    { col: 8, row: 0, trait: "standard" }, { col: 9, row: 1, trait: "guard" },
  ] },
  { name: "REFLECTOR GATE", cells: [
    { col: 0, row: 0, trait: "reflector" }, { col: 5, row: 1, trait: "guard" },
    { col: 6, row: 1, trait: "guard" }, { col: 11, row: 0, trait: "reflector" },
  ] },
];

const FINAL_BOSS_ATTACK_PATTERNS: BossAttackPattern[] = [
  { name: "REPAIR CROSS", cells: [
    { col: 3, row: 1, trait: "guard" }, { col: 5, row: 0, trait: "standard" },
    { col: 6, row: 1, trait: "healer" }, { col: 7, row: 0, trait: "standard" },
    { col: 9, row: 1, trait: "guard" },
  ] },
  { name: "BLAST MAZE", cells: [
    { col: 0, row: 1, trait: "reflector" }, { col: 2, row: 0, trait: "explosive" },
    { col: 5, row: 1, trait: "guard" }, { col: 8, row: 0, trait: "explosive" },
    { col: 11, row: 1, trait: "reflector" },
  ] },
];

function makeBossAttackBricks(stage: number, patternIndex: number, forcedMultiballs = 0) {
  const cols = 12;
  const gap = 7;
  const margin = 36;
  const width = (W - margin * 2 - gap * (cols - 1)) / cols;
  const patterns = stage >= 2 ? [...MID_BOSS_ATTACK_PATTERNS, ...FINAL_BOSS_ATTACK_PATTERNS] : MID_BOSS_ATTACK_PATTERNS;
  const pattern = patterns[patternIndex % patterns.length];
  const bricks = pattern.cells.map(({ col, row, trait }, index) => {
    const hp = 1 + Math.floor(stage / 2);
    return {
      x: margin + col * (width + gap), y: 214 + row * BRICK_ROW_STEP, w: width, h: 24,
      hp, maxHp: hp, hue: 28, alive: true, kind: "boss-minion" as const,
      drop: index < forcedMultiballs ? "multiball" as const : null,
      ...brickRuntimeState(trait),
    };
  });
  return { name: pattern.name, bricks };
}

function makeInitialBricks(ghostCount: number, balance: BalanceConfig): Brick[] {
  return makeWaveBricks(1, balance);
}

function makePlayerBall(upgrades: UpgradeId[], x = W / 2): Ball {
  const speed = 1 + upgrades.filter((u) => u === "speed").length * 0.12;
  const ball: Ball = { x, y: H - 72, vx: BASE_BALL_VX * speed, vy: -BASE_BALL_VY * speed, radius: 8 + skillValue("common-ball-size", upgradeLevel(upgrades, "common-ball-size")), owner: "player", pierce: 0, maxPierce: 0, blast: 0, payload: null, payloadLevel: 0, payloads: {}, attackPower: 1, color: PLAYER_BALL_COLOR, sourcePaddleId: "player", missileTime: 0, missileHitCooldown: 0, gravityRescueCooldown: 0, skillCharges: {}, visualSkill: null, temporaryTime: 0, waveBonus: false };
  syncBallPayloadDisplay(ball, upgrades);
  return ball;
}

function initialGame(activeGhosts: GhostRecord[], balance: BalanceConfig): GameState {
  const balls: Ball[] = [makePlayerBall([])];
  const rowInterval = 0;
  return {
    balls,
    bricks: makeInitialBricks(activeGhosts.length, balance),
    paddleX: W / 2,
    paddleWidth: 128,
    ghostPaddles: activeGhosts.map((_, index) => W * (index + 0.5) / activeGhosts.length),
    elapsed: 0,
    score: 0,
    level: 1,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    bricksBroken: 0,
    upgrades: [],
    skillHistory: [],
    skillMetrics: {},
    paddleTrack: [],
    particles: [],
    flashes: activeGhosts.length > 0 ? [{ text: `ECHO PRESSURE +${activeGhosts.length * 12}%`, x: W / 2, y: H / 2, life: 1.5, color: "#ff6b87" }] : [],
    effects: [],
    items: [],
    safetyBlocks: [],
    gravityWells: [],
    paddleBarriers: {},
    ultimateAuras: {},
    paddleCounters: Object.fromEntries(["player", ...activeGhosts.map((_, index) => `ghost-${index}`)].map((id) => [id, newPaddleCounter()])),
    coreHp: MAX_CORE_HP,
    maxCoreHp: MAX_CORE_HP,
    bossActive: false,
    bossPending: false,
    bossStage: 0,
    nextBossWave: BOSS_INTERVAL,
    bossTimeRemaining: 0,
    bossSkillTimer: 0,
    bossAttackPattern: 0,
    bossMultiballsRemaining: 0,
    bossRewards: [],
    autoGuard: false,
    rowTimer: rowInterval,
    rowInterval,
    overdriveLevel: 0,
    shakeStrength: 0,
    shakeTime: 0,
    shakeDuration: 0,
    screenFlashColor: "#ffffff",
    screenFlashTime: 0,
    screenFlashDuration: 0,
    wave: 1,
    failed: false,
    failureReason: null,
    botMetrics: { maxBalls: 1, ballLosses: 0, missileActivations: 0, safetySaves: 0, gravityRescues: 0 },
    botWaveSamples: [],
    botSampleKey: "",
    waveResolution: null,
  };
}

function formatScore(value: number) {
  return Math.floor(value).toLocaleString("ko-KR");
}

function hudFromGame(game: GameState) {
  return {
    score: game.score, time: game.elapsed, level: game.level,
    combo: game.combo, bricks: game.bricksBroken, balls: game.balls.filter((ball) => ball.owner === "player").length,
    wave: game.wave, nextRow: Math.max(0, game.rowTimer), coreHp: game.coreHp, maxCoreHp: game.maxCoreHp,
    overdriveLevel: game.overdriveLevel, overdriveMultiplier: overdriveMultiplier(game.overdriveLevel),
    bossActive: game.bossActive, bossPending: game.bossPending, nextBossWave: game.nextBossWave, bossTimeRemaining: Math.max(0, game.bossTimeRemaining),
    waveName: waveDefinition(game.wave).name, aliveBricks: game.bricks.filter((brick) => brick.alive).length,
  };
}

function recordBotWaveSample(game: GameState) {
  game.botWaveSamples ??= [];
  const key = `${game.wave}:${game.bossActive ? "boss" : game.bossPending ? "gate" : "normal"}`;
  const sample: BotWaveSample = {
    wave: game.wave,
    elapsed: game.elapsed,
    balls: game.balls.filter((ball) => ball.owner === "player").length,
    coreHp: game.coreHp,
    aliveBricks: game.bricks.filter((brick) => brick.alive).length,
    brickHp: game.bricks.reduce((sum, brick) => sum + (brick.alive ? Math.max(0, brick.hp) : 0), 0),
    score: Math.floor(game.score),
    bossActive: game.bossActive,
  };
  if (game.botSampleKey === key && game.botWaveSamples.length > 0) game.botWaveSamples[game.botWaveSamples.length - 1] = sample;
  else game.botWaveSamples.push(sample);
  game.botSampleKey = key;
}

function pickUpgradeChoices(existing: UpgradeId[], catalog: Upgrade[], ballEconomyUnlocked: boolean, excluded: UpgradeId[] = []) {
  const weighted = catalog
    .filter((upgrade) => !excluded.includes(upgrade.id))
    .filter((upgrade) => upgradeLevel(existing, upgrade.id) < 3)
    .sort(() => decisionRandom() - 0.5);
  if (weighted.length <= 3) return weighted;
  const newOnes = weighted.filter((u) => !existing.includes(u.id));
  const repeats = weighted.filter((u) => existing.includes(u.id));
  return [...newOnes.slice(0, 2), ...repeats, ...weighted].filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i).slice(0, 3);
}

function priceUpgradeChoices(upgrades: Upgrade[], ballEconomyUnlocked: boolean): UpgradeChoice[] {
  return upgrades.map((upgrade) => ({ upgrade, ballCost: 0 }));
}

function chooseBotUpgrade(choices: Upgrade[], existing: UpgradeId[], policy: BotPolicy) {
  if (policy === "random") return choices[Math.floor(decisionRandom() * choices.length)];
  const categoryWeight: Record<BotPolicy, Partial<Record<SkillCategory, number>>> = {
    balanced: { warrior: 3, archer: 3, mage: 3, common: 2.5 },
    survival: { warrior: 5, archer: 2, mage: 4, common: 3.5 },
    random: {},
  };
  return [...choices].sort((a, b) => {
    const score = (upgrade: Upgrade) => (categoryWeight[policy][upgrade.category] ?? 0) + (existing.includes(upgrade.id) ? 1.5 : 3) + decisionRandom();
    return score(b) - score(a);
  })[0];
}

export function GameRuntime({ benchmarkMode = false }: { benchmarkMode?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ringExplosionRef = useRef<HTMLImageElement | null>(null);
  const ringExplosionReadyRef = useRef(false);
  const hitSparkRefs = useRef<Array<HTMLImageElement | null>>([null, null]);
  const hitSparkReadyRef = useRef([false, false]);
  const radialLightningRef = useRef<HTMLImageElement | null>(null);
  const radialLightningReadyRef = useRef(false);
  const mageSpellRefs = useRef<Array<HTMLImageElement | null>>([null, null]);
  const mageSpellReadyRef = useRef([false, false]);
  const frameRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const gameRef = useRef<GameState | null>(null);
  const activeGhostsRef = useRef<GhostRecord[]>([]);
  const pointerXRef = useRef(W / 2);
  const runningRef = useRef(false);
  const levelUpRef = useRef(false);
  const upgradeCatalogRef = useRef<Upgrade[]>(DEFAULT_UPGRADES);
  const audioRef = useRef<GameAudio | null>(null);
  const botActiveRef = useRef(false);
  const benchmarkWatchRef = useRef(false);
  const botPolicyRef = useRef<BotPolicy>("balanced");
  const botSpeedRef = useRef<BotSpeed>(1);
  const botTargetRunsRef = useRef(5);
  const botCompletedRunsRef = useRef(0);
  const botResultsRef = useRef<BotRunResult[]>([]);
  const parallelWorkersRef = useRef<Worker[]>([]);
  const parallelSessionRef = useRef(0);
  const parallelPendingResultsRef = useRef<BotRunResult[]>([]);
  const parallelFlushRef = useRef<() => void>(() => {});
  const balanceConfigRef = useRef<BalanceConfig>(DEFAULT_BALANCE_CONFIG);
  const activeSkillConfigsRef = useRef<SkillConfig[]>(DEFAULT_SKILLS);
  const botLivePersistRef = useRef(0);
  const skillBenchConfigRef = useRef<SkillBenchConfig>(DEFAULT_SKILL_BENCH_CONFIG);
  const skillBenchProgressRef = useRef<SkillBenchProgress>(DEFAULT_SKILL_BENCH_PROGRESS);
  const botSkillBenchActiveRef = useRef(false);
  const botSkillBenchVariantRef = useRef<SkillBenchVariant | null>(null);
  const benchmarkConfigRef = useRef<BenchmarkConfig>(DEFAULT_BENCHMARK_CONFIG);

  const [ghosts, setGhosts] = useState<GhostRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"lobby" | "initialskills" | "playing" | "settlement" | "levelup" | "bossreward" | "result">("lobby");
  const [hud, setHud] = useState({ score: 0, time: 0, level: 1, combo: 0, bricks: 0, balls: 1, wave: 1, nextRow: STARTING_WAVE_ELAPSED, coreHp: MAX_CORE_HP, maxCoreHp: MAX_CORE_HP, overdriveLevel: 0, overdriveMultiplier: 1, bossActive: false, bossPending: false, nextBossWave: BOSS_INTERVAL, bossTimeRemaining: 0, waveName: waveDefinition(1).name, aliveBricks: 0 });
  const [choices, setChoices] = useState<UpgradeChoice[]>([]);
  const [initialSelectedIds, setInitialSelectedIds] = useState<UpgradeId[]>([]);
  const [settlement, setSettlement] = useState<WaveSettlement | null>(null);
  const [rerollsLeft, setRerollsLeft] = useState(1);
  const [result, setResult] = useState<GameState | null>(null);
  const [savedMessage, setSavedMessage] = useState("");
  const [upgradeCatalog, setUpgradeCatalog] = useState<Upgrade[]>(DEFAULT_UPGRADES);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [botPolicy, setBotPolicy] = useState<BotPolicy>("balanced");
  const [botSpeed, setBotSpeed] = useState<BotSpeed>(1);
  const [benchmarkRunMode, setBenchmarkRunMode] = useState<BenchmarkRunMode>("parallel");
  const [botTargetRuns, setBotTargetRuns] = useState(5);
  const [botRunning, setBotRunning] = useState(false);
  const [botCompletedRuns, setBotCompletedRuns] = useState(0);
  const [parallelWorkerCount, setParallelWorkerCount] = useState(0);
  const [botResults, setBotResults] = useState<BotRunResult[]>([]);
  const [skillBenchConfig, setSkillBenchConfig] = useState<SkillBenchConfig>(DEFAULT_SKILL_BENCH_CONFIG);
  const [skillBenchProgress, setSkillBenchProgress] = useState<SkillBenchProgress>(DEFAULT_SKILL_BENCH_PROGRESS);
  const [benchmarkConfig, setBenchmarkConfig] = useState<BenchmarkConfig>(DEFAULT_BENCHMARK_CONFIG);

  useEffect(() => () => {
    parallelFlushRef.current();
    parallelSessionRef.current += 1;
    parallelWorkersRef.current.forEach((worker) => worker.terminate());
    parallelWorkersRef.current = [];
  }, []);

  useEffect(() => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => { ringExplosionReadyRef.current = true; };
    image.onerror = () => { ringExplosionReadyRef.current = false; };
    image.src = RING_EXPLOSION_ASSET;
    ringExplosionRef.current = image;
    return () => {
      image.onload = null;
      image.onerror = null;
      ringExplosionRef.current = null;
      ringExplosionReadyRef.current = false;
    };
  }, []);

  useEffect(() => {
    const images = HIT_SPARK_ASSETS.map((src, index) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => { hitSparkReadyRef.current[index] = true; };
      image.onerror = () => { hitSparkReadyRef.current[index] = false; };
      image.src = src;
      return image;
    });
    hitSparkRefs.current = images;
    return () => {
      images.forEach((image) => { image.onload = null; image.onerror = null; });
      hitSparkRefs.current = [null, null];
      hitSparkReadyRef.current = [false, false];
    };
  }, []);

  useEffect(() => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => { radialLightningReadyRef.current = true; };
    image.onerror = () => { radialLightningReadyRef.current = false; };
    image.src = RADIAL_LIGHTNING_ASSET;
    radialLightningRef.current = image;
    return () => {
      image.onload = null;
      image.onerror = null;
      radialLightningRef.current = null;
      radialLightningReadyRef.current = false;
    };
  }, []);

  useEffect(() => {
    const images = MAGE_SPELL_ASSETS.map((src, index) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => { mageSpellReadyRef.current[index] = true; };
      image.onerror = () => { mageSpellReadyRef.current[index] = false; };
      image.src = src;
      return image;
    });
    mageSpellRefs.current = images;
    return () => {
      images.forEach((image) => { image.onload = null; image.onerror = null; });
      mageSpellRefs.current = [null, null];
      mageSpellReadyRef.current = [false, false];
    };
  }, []);

  useEffect(() => {
    const enabled = localStorage.getItem("echo-breaker-sound-v1") !== "off";
    const audio = new GameAudio();
    audio.setMuted(!enabled);
    audioRef.current = audio;
    setSoundEnabled(enabled);
    return () => audio.close();
  }, []);

  useEffect(() => {
    const loadBenchmark = (raw: string | null) => {
      const next = normalizeBenchmarkConfig(raw ? JSON.parse(raw) : DEFAULT_BENCHMARK_CONFIG);
      benchmarkConfigRef.current = next;
      setBenchmarkConfig(next);
      setBotTargetRuns(next.runs);
    };
    try { loadBenchmark(localStorage.getItem(BENCHMARK_STORAGE_KEY)); } catch { loadBenchmark(null); }
    const onStorage = (event: StorageEvent) => { if (event.key === BENCHMARK_STORAGE_KEY) loadBenchmark(event.newValue); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const loadProgress = (raw: string | null) => {
      try {
        const next = normalizeSkillBenchProgress(raw ? JSON.parse(raw) : DEFAULT_SKILL_BENCH_PROGRESS);
        skillBenchProgressRef.current = next;
        setSkillBenchProgress(next);
      } catch {
        skillBenchProgressRef.current = DEFAULT_SKILL_BENCH_PROGRESS;
        setSkillBenchProgress(DEFAULT_SKILL_BENCH_PROGRESS);
      }
    };
    loadProgress(localStorage.getItem(SKILL_BENCH_PROGRESS_KEY));
    const onStorage = (event: StorageEvent) => {
      if (event.key === SKILL_BENCH_PROGRESS_KEY) loadProgress(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const loadSkillBench = (raw: string | null) => {
      try {
        const next = normalizeSkillBenchConfig(raw ? JSON.parse(raw) : DEFAULT_SKILL_BENCH_CONFIG);
        skillBenchConfigRef.current = next;
        setSkillBenchConfig(next);
      } catch {
        skillBenchConfigRef.current = DEFAULT_SKILL_BENCH_CONFIG;
        setSkillBenchConfig(DEFAULT_SKILL_BENCH_CONFIG);
      }
    };
    loadSkillBench(localStorage.getItem(SKILL_BENCH_STORAGE_KEY));
    const onStorage = (event: StorageEvent) => {
      if (event.key === SKILL_BENCH_STORAGE_KEY) loadSkillBench(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const loadBalanceConfig = (raw: string | null) => {
      try {
        balanceConfigRef.current = normalizeBalanceConfig(raw ? JSON.parse(raw) : DEFAULT_BALANCE_CONFIG);
      } catch {
        balanceConfigRef.current = DEFAULT_BALANCE_CONFIG;
      }
    };
    loadBalanceConfig(localStorage.getItem(BALANCE_STORAGE_KEY));
    const onStorage = (event: StorageEvent) => {
      if (event.key === BALANCE_STORAGE_KEY) loadBalanceConfig(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const loadSkillConfig = (raw: string | null) => {
      try {
        const skills = normalizeSkillConfigs(raw ? JSON.parse(raw) : DEFAULT_SKILLS);
        activeSkillMap = skillConfigMap(skills);
        activeSkillConfigsRef.current = skills;
        const catalog = createUpgradeCatalog(skills.filter((entry) => !entry.ultimate));
        upgradeCatalogRef.current = catalog;
        setUpgradeCatalog(catalog);
      } catch {
        activeSkillMap = skillConfigMap(DEFAULT_SKILLS);
        activeSkillConfigsRef.current = DEFAULT_SKILLS;
        upgradeCatalogRef.current = DEFAULT_UPGRADES;
        setUpgradeCatalog(DEFAULT_UPGRADES);
      }
    };
    loadSkillConfig(localStorage.getItem(SKILL_STORAGE_KEY));
    const onStorage = (event: StorageEvent) => {
      if (event.key === SKILL_STORAGE_KEY) loadSkillConfig(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("echo-breaker-ghosts-v1");
      if (saved) setGhosts(JSON.parse(saved));
    } catch {
      setGhosts([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("echo-breaker-ghosts-v1", JSON.stringify(ghosts));
  }, [ghosts]);

  useEffect(() => {
    let cancelled = false;
    const normalizeResults = (saved: Partial<BotRunResult>[]) => saved.map((item) => ({
        ...item,
        balanceConfig: normalizeBalanceConfig(item.balanceConfig),
        benchmarkConfig: item.benchmarkConfig ? normalizeBenchmarkConfig(item.benchmarkConfig) : null,
        startingSkills: Array.isArray(item.startingSkills) ? item.startingSkills : [],
        skillHistory: Array.isArray(item.skillHistory) ? item.skillHistory : [],
        ultimates: Array.isArray(item.ultimates) ? item.ultimates : [],
        skillMetrics: item.skillMetrics && typeof item.skillMetrics === "object" ? item.skillMetrics : {},
        waveSamples: Array.isArray(item.waveSamples) ? item.waveSamples : [],
        evaluationComplete: item.evaluationComplete ?? Number(item.wave) >= BOT_EVALUATION_WAVE,
        skillBench: item.skillBench ?? null,
      } as BotRunResult));
    const loadResults = async () => {
      let localResults: BotRunResult[] = [];
      try {
        const saved = JSON.parse(localStorage.getItem(BOT_RESULTS_STORAGE_KEY) ?? "[]") as Partial<BotRunResult>[];
        localResults = Array.isArray(saved) ? normalizeResults(saved) : [];
      } catch {
        localResults = [];
      }
      const legacyParallel = localResults.filter((item) => item.benchmarkRuleset === BENCHMARK_RULESET);
      const localOnly = localResults.filter((item) => item.benchmarkRuleset !== BENCHMARK_RULESET);
      if (legacyParallel.length > 0) {
        try {
          await putBenchmarkResults(legacyParallel);
          if (localOnly.length > 0) localStorage.setItem(BOT_RESULTS_STORAGE_KEY, JSON.stringify(localOnly));
          else localStorage.removeItem(BOT_RESULTS_STORAGE_KEY);
        } catch (error) {
          console.error("[benchmark-store] migration failed", error);
        }
      }
      let indexedResults: BotRunResult[] = [];
      if (benchmarkMode) {
        try {
          indexedResults = normalizeResults(await getBenchmarkResults<BotRunResult>(BENCHMARK_RULESET));
        } catch (error) {
          console.error("[benchmark-store] load failed", error);
          indexedResults = legacyParallel;
        }
      }
      if (cancelled) return;
      const merged = [...localOnly, ...indexedResults].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
      botResultsRef.current = merged;
      setBotResults(merged);
    };
    void loadResults();
    return () => { cancelled = true; };
  }, [benchmarkMode]);

  const toggleGhost = (id: string) => {
    if (mode !== "lobby") return;
    setSelectedIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : current.length < MAX_ACTIVE_GHOSTS ? [...current, id] : current);
  };

  const applyUpgrade = useCallback((upgrade: Upgrade, ballCost: 0 | 1 | 2 = 0, resume = true, source: Exclude<SkillSelectionSource, "boss"> = "wave") => {
    const game = gameRef.current;
    if (!game) return;
    const playerBalls = game.balls.filter((ball) => ball.owner === "player");
    if (playerBalls.length - 1 < ballCost) return;
    if (ballCost > 0) {
      const sacrificeValue = (ball: Ball) => ball.attackPower + Object.keys(ball.payloads).length * 0.4 + ball.pierce * 0.15 + (ball.missileTime > 0 ? 2 : 0);
      const sacrificed = new Set([...playerBalls].sort((a, b) => sacrificeValue(a) - sacrificeValue(b)).slice(0, ballCost));
      sacrificed.forEach((ball) => {
        game.effects.push({ kind: "beam", x: ball.x, y: ball.y, x2: game.paddleX, y2: PLAYER_PADDLE_Y, size: 8, life: 0.65, maxLife: 0.65, color: upgrade.color });
        game.particles.push(...Array.from({ length: 8 }, () => ({ x: ball.x, y: ball.y, vx: (effectRandom() - 0.5) * 150, vy: (effectRandom() - 0.5) * 150, life: 0.55, color: upgrade.color })));
      });
      game.balls = game.balls.filter((ball) => !sacrificed.has(ball));
      game.flashes.push({ text: `BALL SACRIFICE -${ballCost}`, x: game.paddleX, y: PLAYER_PADDLE_Y - 38, life: 1.1, color: upgrade.color });
    }
    const previousLevel = upgradeLevel(game.upgrades, upgrade.id);
    game.upgrades.push(upgrade.id);
    const nextLevel = upgradeLevel(game.upgrades, upgrade.id);
    game.skillHistory.push({ wave: game.wave, skillId: upgrade.id, level: nextLevel, source });
    if (upgrade.id === "speed") {
      const previousBonus = 1 + skillValue("speed", previousLevel) / 100;
      const nextBonus = 1 + skillValue("speed", nextLevel) / 100;
      game.balls.filter((ball) => ball.owner === "player").forEach((ball) => { ball.vx *= nextBonus / previousBonus; ball.vy *= nextBonus / previousBonus; });
    }
    if (upgrade.id === "wide") game.paddleWidth = Math.min(260, game.paddleWidth + skillValue("wide", nextLevel) - skillValue("wide", previousLevel));
    if (upgrade.id === "common-xp") {
      const coreGain = skillValue("common-xp", nextLevel) - skillValue("common-xp", previousLevel);
      game.maxCoreHp += coreGain;
      game.coreHp += coreGain;
    }
    if (upgrade.id === "common-ball-size") {
      const radius = 8 + skillValue("common-ball-size", nextLevel);
      game.balls.filter((ball) => ball.owner === "player").forEach((ball) => { ball.radius = radius; });
    }
    if (upgrade.id === "common-damage") {
      game.balls.filter((ball) => ball.owner === "player").forEach((ball) => syncBallPayloadDisplay(ball, game.upgrades));
    }
    game.effects.push({ kind: "ring", x: W / 2, y: H / 2, x2: W / 2, y2: H / 2, size: 150, life: 0.8, maxLife: 0.8, color: upgrade.color });
    game.flashes.push({ text: upgrade.name, x: W / 2, y: H / 2, life: 1.2, color: upgrade.color });
    const evolution = activeSkillMap[upgrade.id]?.evolution;
    if (nextLevel === 3 && evolution) {
      game.flashes.push({ text: `LV3 EVOLUTION // ${upgrade.name}`, x: W / 2, y: H / 2 + 38, life: 1.8, color: upgrade.color });
      game.effects.push({ kind: "ring", x: W / 2, y: H / 2, x2: W / 2, y2: H / 2, size: 230, life: 1.1, maxLife: 1.1, color: upgrade.color, variant: 0, skillId: upgrade.id as ClassSkillId });
    }
    audioRef.current?.play("skill", nextLevel);
    setImpactFeedback(game, 4 + nextLevel * 0.5, upgrade.color, 0.2, 0.1);
    setHud(hudFromGame(game));
    if (resume) {
      levelUpRef.current = false;
      runningRef.current = true;
      setMode("playing");
      lastRef.current = performance.now();
    }
  }, []);

  const applyBossReward = useCallback((rewardId: BossRewardId) => {
    const game = gameRef.current;
    if (!game) return;
    game.bossRewards.push(rewardId);
    game.upgrades.push(rewardId);
    game.skillHistory.push({ wave: game.wave, skillId: rewardId, level: upgradeLevel(game.upgrades, rewardId), source: "boss" });
    const skill = activeSkillMap[rewardId] ?? ULTIMATE_SKILLS.find((item) => item.id === rewardId)!;
    const reward = {
      name: skill.name,
      color: skill.color,
    };
    game.flashes.push({ text: reward.name, x: W / 2, y: H / 2, life: 1.4, color: reward.color });
    game.effects.push({ kind: "ring", x: W / 2, y: H / 2, x2: W / 2, y2: H / 2, size: 210, life: 1, maxLife: 1, color: reward.color });
    game.flashes.push({ text: "ULTIMATE ACQUIRED", x: W / 2, y: H / 2 + 42, life: 1.8, color: reward.color });
    setImpactFeedback(game, 9, reward.color, 0.38, 0.2);
    audioRef.current?.play("ultimate", 1.6);
    runningRef.current = true;
    setMode("playing");
    lastRef.current = performance.now();
  }, []);

  const finishRun = useCallback(() => {
    runningRef.current = false;
    const game = gameRef.current;
    if (!game) return;
    audioRef.current?.play("game-over");
    if (botActiveRef.current) {
      recordBotWaveSample(game);
      const completed = botCompletedRunsRef.current + 1;
      const record: BotRunResult = {
        id: `bot-${Date.now()}-${completed}`,
        run: completed,
        policy: botPolicyRef.current,
        speed: botSpeedRef.current,
        elapsed: game.elapsed,
        wave: game.wave,
        score: Math.floor(game.score),
        bricks: game.bricksBroken,
        maxCombo: game.maxCombo,
        coreHp: game.coreHp,
        upgrades: [...game.upgrades],
        startingSkills: game.skillHistory.filter((event) => event.source === "start").map((event) => event.skillId),
        skillHistory: game.skillHistory.map((event) => ({ ...event })),
        ultimates: game.skillHistory.filter((event) => event.source === "boss").map((event) => event.skillId),
        skillMetrics: Object.fromEntries(Object.entries(game.skillMetrics).map(([id, metric]) => [id, { ...metric! }])),
        createdAt: Date.now(),
        balanceConfig: { ...balanceConfigRef.current },
        benchmarkConfig: benchmarkMode ? { ...benchmarkConfigRef.current } : null,
        benchmarkRuleset: benchmarkMode ? benchmarkWatchRef.current ? "watch-v1" : BENCHMARK_RULESET : null,
        waveSamples: botSkillBenchVariantRef.current ? [] : [...game.botWaveSamples],
        evaluationComplete: game.wave >= (benchmarkMode ? benchmarkConfigRef.current.targetWave : BOT_EVALUATION_WAVE) && game.coreHp > 0,
        skillBench: botSkillBenchVariantRef.current,
        ...game.botMetrics,
      };
      botCompletedRunsRef.current = completed;
      const nextResults = [...botResultsRef.current, record].slice(-1200);
      botResultsRef.current = nextResults;
      setBotCompletedRuns(completed);
      setBotResults(nextResults);
      localStorage.setItem(BOT_RESULTS_STORAGE_KEY, JSON.stringify(nextResults));
      localStorage.removeItem(BOT_LIVE_STORAGE_KEY);
      if (botSkillBenchActiveRef.current) {
        const bench = skillBenchConfigRef.current;
        const queue = bench.environment === "original" ? ["original"] : (bench.mode === "batch" ? bench.skillIds : [bench.skillId]).filter((id) => activeSkillMap[id as UpgradeId]);
        const variantsPerSkill = bench.environment === "original" ? 1 : 4;
        const totalRuns = queue.length * bench.runsPerVariant * variantsPerSkill;
        const nextIndex = Math.min(completed, Math.max(0, totalRuns - 1));
        const perSkillRuns = bench.runsPerVariant * variantsPerSkill;
        const nextSkill = queue[Math.floor(nextIndex / perSkillRuns)] ?? null;
        const nextLevel = nextSkill ? (bench.environment === "original" ? 0 : Math.floor((nextIndex % perSkillRuns) / bench.runsPerVariant)) as 0 | 1 | 2 | 3 : null;
        const nextProgress: SkillBenchProgress = {
          batchId: bench.batchId,
          status: completed >= totalRuns ? "complete" : "running",
          completedRuns: completed,
          totalRuns,
          currentSkillId: completed >= totalRuns ? null : nextSkill,
          currentLevel: completed >= totalRuns ? null : nextLevel,
          startedAt: skillBenchProgressRef.current.startedAt || Date.now(),
          updatedAt: Date.now(),
        };
        skillBenchProgressRef.current = nextProgress;
        setSkillBenchProgress(nextProgress);
        localStorage.setItem(SKILL_BENCH_PROGRESS_KEY, JSON.stringify(nextProgress));
      }
    }
    setResult({ ...game, balls: [...game.balls], upgrades: [...game.upgrades], paddleTrack: [...game.paddleTrack], effects: [...game.effects] });
    setMode("result");
  }, [benchmarkMode]);

  const levelUp = useCallback(() => {
    const game = gameRef.current;
    if (!game || levelUpRef.current) return;
    if (botSkillBenchActiveRef.current && skillBenchConfigRef.current.environment !== "ecosystem") return;
    const ballEconomyUnlocked = game.bossRewards.length > 0;
    const benchSkillId = botSkillBenchVariantRef.current?.skillId;
    const benchExcluded: UpgradeId[] = botSkillBenchActiveRef.current && benchSkillId && benchSkillId !== "original" ? [benchSkillId] : [];
    const upgrades = pickUpgradeChoices(game.upgrades, upgradeCatalogRef.current, ballEconomyUnlocked, benchExcluded);
    if (upgrades.length === 0) {
      game.score += 1000;
      game.flashes.push({ text: "MAX BUILD // +1,000", x: W / 2, y: H / 2, life: 1.2, color: "#fff27a" });
      return;
    }
    const nextChoices = priceUpgradeChoices(upgrades, ballEconomyUnlocked);
    if (botActiveRef.current) {
      const ballBudget = Math.max(0, game.balls.filter((ball) => ball.owner === "player").length - 1);
      const affordable = nextChoices.filter((choice) => choice.ballCost <= ballBudget);
      const selected = chooseBotUpgrade(affordable.map((choice) => choice.upgrade), game.upgrades, botPolicyRef.current);
      const selectedChoice = affordable.find((choice) => choice.upgrade.id === selected.id) ?? affordable[0];
      applyUpgrade(selectedChoice.upgrade, selectedChoice.ballCost);
      return;
    }
    levelUpRef.current = true;
    runningRef.current = false;
    audioRef.current?.play("level-up");
    setChoices(nextChoices);
    setRerollsLeft(1);
    setMode("levelup");
  }, [applyUpgrade, benchmarkMode]);

  const rerollUpgradeChoices = useCallback(() => {
    const game = gameRef.current;
    if (!game || rerollsLeft <= 0) return;
    const ballEconomyUnlocked = game.bossRewards.length > 0;
    const excluded = choices.map((choice) => choice.upgrade.id);
    let upgrades = pickUpgradeChoices(game.upgrades, upgradeCatalogRef.current, ballEconomyUnlocked, excluded);
    if (upgrades.length < 3) upgrades = pickUpgradeChoices(game.upgrades, upgradeCatalogRef.current, ballEconomyUnlocked);
    setChoices(priceUpgradeChoices(upgrades, ballEconomyUnlocked));
    setRerollsLeft((current) => Math.max(0, current - 1));
    audioRef.current?.play("item", 1.2);
  }, [choices, rerollsLeft]);

  const skipUpgradeChoice = useCallback(() => {
    levelUpRef.current = false;
    runningRef.current = true;
    setMode("playing");
    lastRef.current = performance.now();
  }, []);

  const selectInitialSkill = useCallback((upgrade: Upgrade) => {
    const game = gameRef.current;
    if (!game) return;
    applyUpgrade(upgrade, 0, false, "start");
    const selected = [...initialSelectedIds, upgrade.id];
    setInitialSelectedIds(selected);
    if (selected.length < 2) {
      const next = pickUpgradeChoices(game.upgrades, upgradeCatalogRef.current, false, selected);
      setChoices(priceUpgradeChoices(next, false));
      audioRef.current?.play("level-up", 1.15);
      return;
    }
    levelUpRef.current = false;
    runningRef.current = true;
    setMode("playing");
    lastRef.current = performance.now();
  }, [applyUpgrade, initialSelectedIds]);

  const claimWaveReward = useCallback(() => {
    if (!settlement) return;
    if (settlement.finalWave) {
      setSettlement(null);
      finishRun();
      return;
    }
    setSettlement(null);
    if (settlement.wasBoss && settlement.cleared) {
      setMode("bossreward");
      return;
    }
    levelUp();
  }, [finishRun, levelUp, settlement]);

  const updateGame = useCallback((dt: number) => {
    const game = gameRef.current;
    if (!game) return;
    game.paddleCounters ??= {};
    game.ultimateAuras ??= {};
    game.skillHistory ??= [];
    game.skillMetrics ??= {};
    game.effects ??= [];
    game.safetyBlocks ??= [];
    game.gravityWells ??= [];
    game.botMetrics ??= { maxBalls: 1, ballLosses: 0, missileActivations: 0, safetySaves: 0, gravityRescues: 0 };
    game.botWaveSamples ??= [];
    game.botSampleKey ??= "";
    game.waveResolution ??= null;
    game.bossTimeRemaining ??= 0;
    game.bossSkillTimer ??= 0;
    game.bossAttackPattern ??= 0;
    game.bossMultiballsRemaining ??= 0;
    game.bossPending ??= false;
    game.balls.forEach((ball) => { ball.sourcePaddleId ??= "player"; ball.attackPower ??= 1; ball.missileTime ??= 0; ball.missileHitCooldown ??= 0; ball.skillCharges ??= {}; ball.visualSkill ??= null; ball.temporaryTime ??= 0; ball.waveBonus ??= false; });
    game.shakeStrength ??= 0;
    game.shakeTime ??= 0;
    game.shakeDuration ??= 0;
    game.screenFlashColor ??= "#ffffff";
    game.screenFlashTime ??= 0;
    game.screenFlashDuration ??= 0;
    game.bricks.forEach((brick) => {
      brick.trait ??= "standard";
      brick.guardReady ??= brick.trait === "guard";
      brick.healTimer ??= 3;
      brick.poisonTime ??= 0;
      brick.poisonTick ??= 0;
      brick.poisonSourcePaddleId ??= null;
      brick.burnTime ??= 0;
      brick.burnTick ??= 0;
      brick.burnLevel ??= 0;
      brick.burnSourcePaddleId ??= null;
      brick.blastVulnerability ??= 1;
      brick.blastVulnerabilitySourcePaddleId ??= null;
      brick.frostVulnerability ??= 0;
      brick.traitLockTime ??= 0;
      brick.lastHitPaddleId ??= null;
      brick.traitLockTime = Math.max(0, brick.traitLockTime - dt);
    });
    game.elapsed += dt;
    game.rowTimer += dt;
    const nextOverdriveLevel = overdriveLevelAt(game.rowTimer);
    if (nextOverdriveLevel > game.overdriveLevel) {
      const speedRatio = overdriveMultiplier(nextOverdriveLevel) / overdriveMultiplier(game.overdriveLevel);
      game.balls.filter((ball) => ball.owner === "player").forEach((ball) => {
        ball.vx *= speedRatio;
        ball.vy *= speedRatio;
      });
      game.overdriveLevel = nextOverdriveLevel;
      const overdrivePercent = Math.round(overdriveMultiplier(nextOverdriveLevel) * 100);
      game.flashes.push({ text: `OVERDRIVE ${nextOverdriveLevel} // BALL SPEED ${overdrivePercent}%`, x: W / 2, y: H / 2, life: 1.2, color: "#ff9658" });
      game.effects.push({ kind: "ring", x: W / 2, y: H / 2, x2: W / 2, y2: H / 2, size: 150 + nextOverdriveLevel * 18, life: 0.7, maxLife: 0.7, color: "#ff9658", variant: 0, skillId: null });
      audioRef.current?.play("skill", 0.8 + nextOverdriveLevel * 0.18);
      setImpactFeedback(game, 2 + nextOverdriveLevel, "#ff9658", 0.16, 0.06);
    }
    if (game.bossActive) {
      game.bossSkillTimer -= dt;
      if (game.bossSkillTimer <= 0) {
        const forcedMultiballs = Math.min(BOSS_MULTIBALL_BUDGET, game.bossMultiballsRemaining);
        const attack = makeBossAttackBricks(game.bossStage, game.bossAttackPattern, forcedMultiballs);
        const reinforcements = attack.bricks.filter((candidate) => !game.bricks.some((brick) => brick.alive && brick.kind === "boss-minion" && Math.abs(brick.x - candidate.x) < 2 && Math.abs(brick.y - candidate.y) < 2));
        game.bricks.push(...reinforcements);
        game.bossAttackPattern++;
        game.bossMultiballsRemaining -= forcedMultiballs;
        game.bossSkillTimer = Math.max(2.6, balanceConfigRef.current.bossAttackInterval - game.bossStage * balanceConfigRef.current.bossAttackAcceleration);
        game.flashes.push({ text: `BOSS SKILL // ${attack.name}`, x: W / 2, y: 190, life: 1, color: "#ff9658" });
        game.effects.push({ kind: "ring", x: W / 2, y: 150, x2: W / 2, y2: 150, size: 180, life: 0.8, maxLife: 0.8, color: "#ff9658" });
      }
    }
    if (botActiveRef.current) {
      const falling = [...game.balls].filter((ball) => ball.owner === "player" && ball.vy > 0).sort((a, b) => b.y - a.y)[0];
      const usefulItem = [...game.items].filter((item) => item.alive).sort((a, b) => b.y - a.y)[0];
      if (falling) {
        const travelTime = Math.max(0, (PLAYER_PADDLE_Y - falling.y) / Math.max(1, falling.vy));
        let predictedX = falling.x + falling.vx * travelTime;
        while (predictedX < 0 || predictedX > W) predictedX = predictedX < 0 ? -predictedX : W * 2 - predictedX;
        const aimCandidates = game.bricks.filter((brick) => brick.alive && isDamageableBrick(brick)).sort((a, b) => b.y - a.y).slice(0, 6);
        const aimTarget = aimCandidates[Math.floor(game.elapsed / 2.5) % Math.max(1, aimCandidates.length)];
        const targetX = aimTarget ? aimTarget.x + aimTarget.w / 2 : W / 2;
        const targetBias = Math.max(-0.5, Math.min(0.5, (targetX - predictedX) / (W * 0.42)));
        const sweepBias = Math.sin(game.elapsed * 1.35 + falling.x * 0.018) * 0.42;
        let desiredHit = Math.max(-0.72, Math.min(0.72, targetBias + sweepBias));
        if (Math.abs(desiredHit) < 0.24) desiredHit = desiredHit < 0 ? -0.24 : 0.24;
        pointerXRef.current = Math.max(game.paddleWidth / 2, Math.min(W - game.paddleWidth / 2, predictedX - desiredHit * game.paddleWidth / 2));
      } else if (usefulItem) {
        pointerXRef.current = usefulItem.x;
      } else {
        pointerXRef.current = game.balls[0]?.x ?? W / 2;
      }
    }
    const previousPaddleX = game.paddleX;
    game.paddleX += (pointerXRef.current - game.paddleX) * Math.min(1, dt * 14);
    game.paddleX = Math.max(game.paddleWidth / 2, Math.min(W - game.paddleWidth / 2, game.paddleX));
    const playerPaddleVelocity = dt > 0 ? (game.paddleX - previousPaddleX) / dt : 0;

    const trackIndex = Math.floor(game.elapsed * 10);
    if (game.paddleTrack.length <= trackIndex) game.paddleTrack.push(game.paddleX / W);

    const trackedBall = [...game.balls]
      .filter((ball) => ball.owner === "player" && ball.vy > 0)
      .sort((a, b) => b.y - a.y)[0] ?? game.balls.find((ball) => ball.owner === "player");
    const dangerActive = game.bricks.some((brick) => brick.alive && brick.y + brick.h >= PLAYER_LINE_Y - BRICK_ROW_STEP * 2);
    const effectivePaddleWidth = (base: number, upgrades: UpgradeId[]) => {
      const level = upgradeLevel(upgrades, "emergency-wide");
      const commonWide = skillValue("common-wide", upgradeLevel(upgrades, "common-wide"));
      return Math.min(280, base + commonWide + (dangerActive ? skillValue("emergency-wide", level) : 0));
    };
    activeGhostsRef.current.forEach((ghost, index) => {
      const width = effectivePaddleWidth(ghostPaddleWidth(ghost), ghost.upgrades);
      const zoneWidth = W / activeGhostsRef.current.length;
      const zoneStart = zoneWidth * index;
      const zoneEnd = zoneStart + zoneWidth;
      const collectibleItem = [...game.items]
        .filter((item) => item.alive && item.x >= zoneStart && item.x <= zoneEnd)
        .sort((a, b) => b.y - a.y)[0];
      const rescueIsUrgent = !!trackedBall && trackedBall.y >= PLAYER_PADDLE_Y - 6;
      const targetX = rescueIsUrgent ? trackedBall.x : collectibleItem?.x ?? trackedBall?.x ?? (zoneStart + zoneEnd) / 2;
      const target = Math.max(zoneStart + width / 2, Math.min(zoneEnd - width / 2, targetX));
      const speed = Math.max(125, 210 + ghost.upgrades.filter((id) => id === "speed").length * 45 - (game.wave - 1) * 6);
      const delta = Math.max(-speed * dt, Math.min(speed * dt, target - game.ghostPaddles[index]));
      game.ghostPaddles[index] = Math.max(zoneStart + width / 2, Math.min(zoneEnd - width / 2, game.ghostPaddles[index] + delta));
    });

    game.comboTimer -= dt;
    if (game.comboTimer <= 0 && game.combo > 0) game.combo = 0;
    Object.values(game.paddleCounters).forEach((counter) => {
      counter.missileReflections ??= 0;
      counter.safetyTimer = Number.isFinite(counter.safetyTimer) ? counter.safetyTimer - dt : 0;
      counter.gravityTimer = Number.isFinite(counter.gravityTimer) ? counter.gravityTimer - dt : 0;
      counter.comboTimer -= dt;
      if (counter.comboTimer <= 0) { counter.combo = 0; counter.feverMilestone = 0; }
      counter.lastShotTimer -= dt;
    });
    game.particles.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; p.life -= dt; });
    game.particles = game.particles.filter((p) => p.life > 0);
    game.flashes.forEach((f) => { f.y -= 28 * dt; f.life -= dt; });
    game.flashes = game.flashes.filter((f) => f.life > 0);
    game.effects.forEach((effect) => { effect.life -= dt; });
    game.effects = game.effects.filter((effect) => effect.life > 0);
    game.shakeTime = Math.max(0, game.shakeTime - dt);
    if (game.shakeTime <= 0) game.shakeStrength = 0;
    game.screenFlashTime = Math.max(0, game.screenFlashTime - dt);
    game.gravityWells.forEach((well) => { well.life -= dt; });
    game.gravityWells = game.gravityWells.filter((well) => well.life > 0);
    Object.values(game.paddleCounters).forEach((counter) => { counter.chargePulse = Math.max(0, (counter.chargePulse ?? 0) - dt); });

    const paddleY = PLAYER_PADDLE_Y;
    const paddles = [
      { id: "player", x: game.paddleX, previousX: previousPaddleX, y: paddleY, width: effectivePaddleWidth(game.paddleWidth, game.upgrades), upgrades: game.upgrades, name: "PLAYER", velocity: playerPaddleVelocity },
      ...activeGhostsRef.current.map((ghost, index) => ({
        id: `ghost-${index}`, x: game.ghostPaddles[index], previousX: game.ghostPaddles[index], y: ghostPaddleY(), width: effectivePaddleWidth(ghostPaddleWidth(ghost), ghost.upgrades), upgrades: ghost.upgrades, name: ghost.name, velocity: 0,
      })),
    ];
    const paddleFor = (id: string) => paddles.find((paddle) => paddle.id === id) ?? paddles[0];
    const counterFor = (id: string) => {
      const counter = game.paddleCounters[id] ??= newPaddleCounter();
      counter.chargePulse ??= 0;
      counter.chargeColor ??= PLAYER_BALL_COLOR;
      return counter;
    };
    const emitEffect = (kind: GameEffect["kind"], x: number, y: number, color: string, size = 45, x2 = x, y2 = y, duration = 0.5, variant = 0, skillId: ClassSkillId | null = null) => {
      game.effects.push({ kind, x, y, x2, y2, size, life: duration, maxLife: duration, color, variant, skillId });
    };
    const emitSkillEffect = (skillId: ClassSkillId, x: number, y: number, size = 70, duration = 0.65, x2 = x, y2 = y) => {
      emitEffect("skill", x, y, classSkillColor(skillId), size, x2, y2, duration, 0, skillId);
    };
    const skillMetricFor = (skillId: UpgradeId) => game.skillMetrics[skillId] ??= { activations: 0, damage: 0, kills: 0 };
    const recordSkillImpact = (skillId: UpgradeId, damage = 0, killed = false) => {
      const metric = skillMetricFor(skillId);
      metric.damage += Math.max(0, damage);
      if (killed) metric.kills++;
    };
    const emitBurst = (x: number, y: number, color: string, count = 10, force = 220) => {
      for (let index = 0; index < count; index++) {
        const angle = effectRandom() * Math.PI * 2;
        const speed = force * (0.35 + effectRandom() * 0.65);
        game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.35 + effectRandom() * 0.4, color });
      }
    };
    const impactFeedback = (strength: number, color?: string, duration = 0.16, flashDuration = 0) => {
      setImpactFeedback(game, strength, color, duration, flashDuration);
    };
    paddles.forEach((paddle) => {
      const counter = counterFor(paddle.id);
      const safetyLevel = upgradeLevel(paddle.upgrades, "safety-block");
      if (safetyLevel > 0 && counter.safetyTimer <= 0) {
        counter.safetyTimer = skillValue("safety-block", safetyLevel);
        const existing = game.safetyBlocks.find((block) => block.ownerPaddleId === paddle.id);
        if (existing) {
          existing.x = paddle.x;
          existing.width = Math.min(150, paddle.width * 0.9);
        } else {
          game.safetyBlocks.push({ ownerPaddleId: paddle.id, x: paddle.x, y: H - 13, width: Math.min(150, paddle.width * 0.9), color: paddle.id === "player" ? "#55d6ff" : GHOST_COLORS[Number(paddle.id.split("-")[1]) % GHOST_COLORS.length] });
        }
        game.flashes.push({ text: `${paddle.name} // SAFETY BLOCK`, x: paddle.x, y: H - 35, life: 0.8, color: "#55d6ff" });
        emitEffect("ring", paddle.x, H - 13, "#55d6ff", 54, paddle.x, H - 13, 0.5);
      }
      const gravityLevel = upgradeLevel(paddle.upgrades, "gravity-well");
      if (gravityLevel > 0 && counter.gravityTimer <= 0) {
        counter.gravityTimer = skillValue("gravity-well", gravityLevel);
        const endangered = [...game.balls].filter((ball) => ball.owner === "player").sort((a, b) => b.y - a.y)[0];
        const wellX = Math.max(150, Math.min(W - 150, endangered?.x ?? paddle.x));
        const wellY = 155 + decisionRandom() * 75;
        game.gravityWells.push({ ownerPaddleId: paddle.id, x: wellX, y: wellY, radius: 185, life: 3.5, maxLife: 3.5, color: "#c18cff" });
        game.flashes.push({ text: `${paddle.name} // GRAVITY WELL`, x: wellX, y: wellY - 32, life: 0.9, color: "#c18cff" });
        emitEffect("ring", wellX, wellY, "#c18cff", 185, wellX, wellY, 0.8);
      }
    });
    const grantPaddlePayloads = (ball: Ball, upgrades: UpgradeId[]) => {
      const grantedPayloads = payloadEntries(upgrades);
      PAYLOAD_IDS.forEach((id) => { delete ball.payloads[id]; });
      ball.pierce = 0;
      ball.maxPierce = 0;
      grantedPayloads.forEach(({ id, level }) => {
        ball.payloads[id] = level;
        if (id === "pierce") {
          ball.pierce = Math.max(0, Math.floor(skillValue("pierce", level)));
          ball.maxPierce = ball.pierce;
        }
      });
      syncBallPayloadDisplay(ball, upgrades);
      return grantedPayloads;
    };
    const damageMultiplier = (brick: Brick) => brick.kind === "boss-core" && game.bricks.some((target) => target.alive && target.kind === "boss-armor") ? 0.3 : 1;
    const absorbGuardHit = (target: Brick) => {
      if (!target.guardReady || target.traitLockTime > 0) return false;
      target.guardReady = false;
      const centerX = target.x + target.w / 2;
      const centerY = target.y + target.h / 2;
      game.flashes.push({ text: "GUARD // HIT NULLIFIED", x: centerX, y: target.y - 7, life: 0.7, color: "#fff27a" });
      emitEffect("ring", centerX, centerY, "#fff27a", 42, centerX, centerY, 0.5);
      emitBurst(centerX, centerY, "#fff27a", 10, 170);
      audioRef.current?.play("barrier");
      return true;
    };
    const applyDebuffs = (target: Brick, sourcePaddle: (typeof paddles)[number]) => {
      const centerX = target.x + target.w / 2;
      const centerY = target.y + target.h / 2;
      const poisonLevel = upgradeLevel(sourcePaddle.upgrades, "poison");
      if (poisonLevel > 0) {
        const wasPoisoned = target.poisonTime > 0;
        target.poisonTime = 5;
        target.poisonTick = Math.min(target.poisonTick || Infinity, skillValue("poison", poisonLevel));
        target.poisonSourcePaddleId = sourcePaddle.id;
        if (!wasPoisoned) emitBurst(centerX, centerY, "#72f1b8", 8, 130);
      }
      const blastAmpLevel = upgradeLevel(sourcePaddle.upgrades, "blast-amp");
      const vulnerability = skillValue("blast-amp", blastAmpLevel);
      if (vulnerability > target.blastVulnerability) {
        target.blastVulnerability = vulnerability;
        target.blastVulnerabilitySourcePaddleId = sourcePaddle.id;
        emitEffect("ring", centerX, centerY, "#ff6b87", 34, centerX, centerY, 0.45);
      }
      if (upgradeLevel(sourcePaddle.upgrades, "corrosion") > 0) {
        const newlyCorroded = target.lastHitPaddleId !== sourcePaddle.id;
        target.lastHitPaddleId = sourcePaddle.id;
        if (newlyCorroded) emitEffect("ring", centerX, centerY, "#c18cff", 28, centerX, centerY, 0.38);
      }
    };

    const randomLinkTargets = (origin: Brick, linkLevel: number) => {
      const count = Math.max(1, Math.floor(skillValue("link", linkLevel)));
      const radius = 100 + (linkLevel - 1) * 30;
      return game.bricks
        .filter((target) => target.alive && isDamageableBrick(target) && target !== origin && target.kind !== "boss-core" && target.kind !== "boss-armor")
        .map((target) => {
          const distance = Math.hypot(target.x + target.w / 2 - (origin.x + origin.w / 2), target.y + target.h / 2 - (origin.y + origin.h / 2));
          return { target, distance, score: distance / (0.35 + decisionRandom() * 0.65) };
        })
        .filter(({ distance }) => distance <= radius)
        .sort((a, b) => a.score - b.score)
        .slice(0, count)
        .map(({ target }) => target);
    };

    function applyEnchantWaveHit(target: Brick, ball: Ball, sourcePaddle: (typeof paddles)[number]) {
      if (!target.alive || !isDamageableBrick(target)) return;
      if (absorbGuardHit(target)) return;
      const centerX = target.x + target.w / 2;
      const centerY = target.y + target.h / 2;
      const glassLevel = upgradeLevel(sourcePaddle.upgrades, "glass");
      const blastLevel = upgradeLevel(sourcePaddle.upgrades, "blast");
      const linkLevel = upgradeLevel(sourcePaddle.upgrades, "link");
      if (glassLevel > 0) {
        const fractureDamage = Math.max(1, Math.ceil(target.hp * skillValue("glass", glassLevel) / 100)) * damageMultiplier(target);
        target.hp -= fractureDamage;
        emitEffect("ring", centerX, centerY, "#60d7ff", 38 + glassLevel * 9, centerX, centerY, 0.45);
      }
      const corrosionLevel = upgradeLevel(sourcePaddle.upgrades, "corrosion");
      const corrosionDamage = corrosionLevel > 0 && target.lastHitPaddleId === sourcePaddle.id ? skillValue("corrosion", corrosionLevel) : 0;
      applyDebuffs(target, sourcePaddle);
      target.hp -= (1 + corrosionDamage) * damageMultiplier(target);
      if (linkLevel > 0) {
        randomLinkTargets(target, linkLevel).forEach((linked) => {
          if (absorbGuardHit(linked)) return;
          applyDebuffs(linked, sourcePaddle);
          linked.hp -= damageMultiplier(linked);
          emitEffect("beam", centerX, centerY, "#72f1b8", 5, linked.x + linked.w / 2, linked.y + linked.h / 2, 0.34);
          if (linked.hp <= 0) destroyBrick(linked, ball, false, 0);
        });
      }
      if (target.hp <= 0) destroyBrick(target, ball, blastLevel > 0, blastLevel, false, false);
    }

    const destroyBrick = (brick: Brick, ball: Ball, triggerBlast: boolean, blastPower = ball.blast, direct = false, piercingKill = false) => {
      if (!brick.alive || !isDamageableBrick(brick)) return;
      brick.alive = false;
      const sourcePaddle = paddleFor(ball.sourcePaddleId);
      const sourceCounter = counterFor(sourcePaddle.id);
      const chainLevel = upgradeLevel(sourcePaddle.upgrades, "chain");
      const commonCombo = skillValue("common-combo", upgradeLevel(sourcePaddle.upgrades, "common-combo"));
      const speedBonus = 1 + skillValue("speed", upgradeLevel(sourcePaddle.upgrades, "speed")) / 100;
      game.bricksBroken++;
      game.combo++;
      audioRef.current?.play("brick-break", game.combo);
      impactFeedback(Math.min(2.8, 1.1 + game.combo * 0.035), ball.color, 0.09);
      sourceCounter.combo++;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      game.comboTimer = 1.8 + chainLevel * 0.45 + commonCombo;
      sourceCounter.comboTimer = game.comboTimer;
      const multiplier = 1 + Math.min(4, game.combo * (0.05 + chainLevel * 0.015));
      const points = 100 * multiplier * (ball.owner === "ghost" ? 0.75 : 1) * speedBonus;
      game.score += points;
      game.flashes.push({ text: `+${Math.floor(points)}`, x: brick.x + brick.w / 2, y: brick.y, life: 0.55, color: ball.color });
      for (let p = 0; p < 7; p++) game.particles.push({ x: brick.x + brick.w / 2, y: brick.y + brick.h / 2, vx: (effectRandom() - 0.5) * 180, vy: (effectRandom() - 0.7) * 150, life: 0.45 + effectRandom() * 0.4, color: `hsl(${brick.hue} 95% 68%)` });
      let earnedDrop = brick.drop;
      const luckChance = skillValue("common-luck", upgradeLevel(sourcePaddle.upgrades, "common-luck")) / 100;
      if (!earnedDrop && luckChance > 0 && decisionRandom() < luckChance) earnedDrop = "multiball";
      const pressureChance = skillValue("pressure", upgradeLevel(sourcePaddle.upgrades, "pressure")) / 100;
      if (!earnedDrop && pressureChance > 0 && decisionRandom() < pressureChance) earnedDrop = "multiball";
      const dropX = brick.x + brick.w / 2;
      const dropY = brick.y + brick.h / 2;
      if (earnedDrop && game.items.length < 120) {
        game.items.push({ id: Date.now() + effectRandom(), x: dropX, y: dropY, vy: 105, alive: true, kind: earnedDrop });
      }

      const feverLevel = upgradeLevel(sourcePaddle.upgrades, "fever");
      if (feverLevel > 0) {
        const threshold = skillValue("fever", feverLevel);
        const milestone = Math.floor(sourceCounter.combo / threshold);
        if (milestone > sourceCounter.feverMilestone) {
          sourceCounter.feverMilestone = milestone;
          const granted = grantPaddlePayloads(ball, sourcePaddle.upgrades);
          game.flashes.push({ text: `${sourcePaddle.name} // FEVER ${granted.length ? "FULL CHARGE" : "READY"}`, x: sourcePaddle.x, y: sourcePaddle.y - 28, life: 1, color: "#ffcf4a" });
          emitEffect("ring", sourcePaddle.x, sourcePaddle.y, "#ffcf4a", 90, sourcePaddle.x, sourcePaddle.y, 0.75);
          emitBurst(sourcePaddle.x, sourcePaddle.y, "#ffcf4a", 18, 260);
        }
      }

      if (direct && (brick.kind === "normal" || brick.kind === "boss-minion")) {
        const horizontalLevel = upgradeLevel(sourcePaddle.upgrades, "horizontal-sweep");
        if (horizontalLevel > 0 && ++sourceCounter.directKills >= skillValue("horizontal-sweep", horizontalLevel)) {
          sourceCounter.directKills = 0;
          game.bricks.filter((target) => target.alive && (target.kind === "normal" || target.kind === "boss-minion") && Math.abs(target.y - brick.y) <= 2)
            .forEach((target) => applyEnchantWaveHit(target, ball, sourcePaddle));
          game.flashes.push({ text: `${sourcePaddle.name} // HORIZONTAL ENCHANT`, x: W / 2, y: brick.y, life: 1.1, color: "#58d5ff" });
          emitEffect("beam", 20, brick.y + brick.h / 2, "#58d5ff", 12, W - 20, brick.y + brick.h / 2, 0.65);
        }
        const verticalLevel = upgradeLevel(sourcePaddle.upgrades, "vertical-drill");
        if (verticalLevel > 0 && piercingKill && ++sourceCounter.pierceKills >= skillValue("vertical-drill", verticalLevel)) {
          sourceCounter.pierceKills = 0;
          const centerX = brick.x + brick.w / 2;
          game.bricks.filter((target) => target.alive && (target.kind === "normal" || target.kind === "boss-minion") && Math.abs(target.x + target.w / 2 - centerX) <= target.w * 0.55)
            .forEach((target) => applyEnchantWaveHit(target, ball, sourcePaddle));
          game.flashes.push({ text: `${sourcePaddle.name} // VERTICAL ENCHANT`, x: centerX, y: H / 2, life: 1.1, color: "#9a8cff" });
          emitEffect("beam", centerX, 50, "#9a8cff", 14, centerX, PLAYER_LINE_Y, 0.7);
        }
      }

      if (brick.trait === "explosive") {
        const blastX = brick.x + brick.w / 2;
        const blastY = brick.y + brick.h / 2;
        const range = 112;
        emitEffect("blast", blastX, blastY, "#ff8a3d", range, blastX, blastY, 0.72);
        emitBurst(blastX, blastY, "#ffb15c", 24, 360);
        audioRef.current?.play("explosion", 1.4);
        impactFeedback(7, "#ff8a3d", 0.3, 0.16);
        game.bricks.forEach((near) => {
          if (!near.alive || near === brick || !isDamageableBrick(near)) return;
          const dx = near.x + near.w / 2 - blastX;
          const dy = near.y + near.h / 2 - blastY;
          if (Math.hypot(dx, dy) >= range || absorbGuardHit(near)) return;
          near.hp -= 1;
          emitEffect("ring", near.x + near.w / 2, near.y + near.h / 2, "#ffb15c", 28, near.x + near.w / 2, near.y + near.h / 2, 0.34);
          if (near.hp <= 0) destroyBrick(near, ball, false, 0);
        });
        const pushX = ball.x - blastX;
        const pushY = ball.y - blastY;
        const pushLength = Math.max(1, Math.hypot(pushX, pushY));
        const launchSpeed = Math.max(470, Math.hypot(ball.vx, ball.vy) * 1.18);
        ball.vx = pushX / pushLength * launchSpeed;
        ball.vy = pushY / pushLength * launchSpeed;
        game.flashes.push({ text: "EXPLOSIVE // BALL LAUNCHED", x: blastX, y: blastY - 18, life: 0.9, color: "#ffb15c" });
      }

      if (!triggerBlast || blastPower <= 0) return;
      const range = skillValue("blast", blastPower) || 60 + blastPower * 20;
      const blastX = brick.x + brick.w / 2;
      const blastY = brick.y + brick.h / 2;
      emitEffect("blast", blastX, blastY, "#ff6b87", range, blastX, blastY, 0.65);
      emitBurst(blastX, blastY, "#ff6b87", 16 + blastPower * 4, 300);
      audioRef.current?.play("explosion", blastPower);
      impactFeedback(5 + blastPower * 0.9, "#ff6b87", 0.24, 0.12);
      game.bricks.forEach((near) => {
        if (!near.alive || !isDamageableBrick(near)) return;
        const dx = near.x + near.w / 2 - (brick.x + brick.w / 2);
        const dy = near.y + near.h / 2 - (brick.y + brick.h / 2);
        if (Math.hypot(dx, dy) >= range) return;
        if (absorbGuardHit(near)) return;
        applyDebuffs(near, sourcePaddle);
        const hpBefore = near.hp;
        near.hp -= (blastPower >= 3 ? 2 : 1) * near.blastVulnerability * damageMultiplier(near);
        emitEffect("ring", near.x + near.w / 2, near.y + near.h / 2, "#ff9658", 24, near.x + near.w / 2, near.y + near.h / 2, 0.3);
        if (near.hp <= 0) destroyBrick(near, ball, false, 0);
      });
    };

    const triggerImpactShockwave = (origin: Brick, ball: Ball, level: number) => {
      const sourcePaddle = paddleFor(ball.sourcePaddleId);
      const range = (60 + level * 20) * commonSkillRangeMultiplier(sourcePaddle.upgrades);
      const damage = level >= 3 ? 2 : 1;
      const waveQueue: Brick[] = [origin];
      const reacted = new Set<Brick>([origin]);
      let hitCount = 0;
      let waveCount = 0;
      while (waveQueue.length > 0) {
        const waveOrigin = waveQueue.shift()!;
        const centerX = waveOrigin.x + waveOrigin.w / 2;
        const centerY = waveOrigin.y + waveOrigin.h / 2;
        waveCount++;
        emitEffect("blast", centerX, centerY, classSkillColor("warrior-shockwave"), range, centerX, centerY, 0.58, 0, "warrior-shockwave");
        emitSkillEffect("warrior-shockwave", centerX, centerY, range, 0.62);
        emitBurst(centerX, centerY, classSkillColor("warrior-shockwave"), 12 + level * 4, 280);
        game.bricks.forEach((near) => {
          if (!near.alive || near === waveOrigin || reacted.has(near) || !isDamageableBrick(near)) return;
          const distance = Math.hypot(near.x + near.w / 2 - centerX, near.y + near.h / 2 - centerY);
          if (distance >= range || absorbGuardHit(near)) return;
          reacted.add(near);
          const hpBefore = near.hp;
          near.hp -= damage * damageMultiplier(near);
          const appliedDamage = Math.min(hpBefore, Math.max(0, hpBefore - near.hp));
          hitCount++;
          recordSkillImpact("warrior-shockwave", appliedDamage, near.hp <= 0);
          emitEffect("beam", centerX, centerY, classSkillColor("warrior-shockwave"), 5, near.x + near.w / 2, near.y + near.h / 2, 0.28, 0, "warrior-shockwave");
          emitEffect("ring", near.x + near.w / 2, near.y + near.h / 2, classSkillColor("warrior-shockwave"), 30, near.x + near.w / 2, near.y + near.h / 2, 0.3);
          game.flashes.push({ text: `충격 -${Math.max(1, Math.round(appliedDamage))}`, x: near.x + near.w / 2, y: near.y - 5, life: 0.55, color: "#fff3d6" });
          if (near.hp <= 0) {
            destroyBrick(near, ball, false, 0);
            if (level >= 3) waveQueue.push(near);
          }
        });
        if (level < 3) break;
      }
      audioRef.current?.play("explosion", 0.9 + level * 0.2 + Math.min(1, waveCount * 0.08));
      impactFeedback(4.5 + level + Math.min(4, waveCount * 0.3), classSkillColor("warrior-shockwave"), 0.2, 0.08);
      game.flashes.push({ text: `충격파 // ${hitCount} HIT · CHAIN ×${waveCount}`, x: origin.x + origin.w / 2, y: origin.y - 24, life: 1, color: classSkillColor("warrior-shockwave") });
    };

    const igniteFireballArea = (origin: Brick, sourcePaddleId: string, level: number) => {
      const centerX = origin.x + origin.w / 2;
      const centerY = origin.y + origin.h / 2;
      const sourcePaddle = paddleFor(sourcePaddleId);
      const range = (60 + level * 20) * commonSkillRangeMultiplier(sourcePaddle.upgrades);
      let ignited = 0;
      game.bricks.forEach((near) => {
        if (!near.alive || !isDamageableBrick(near)) return;
        const distance = Math.hypot(near.x + near.w / 2 - centerX, near.y + near.h / 2 - centerY);
        if (distance >= range) return;
        near.burnTime = Math.max(near.burnTime, 2 + level);
        near.burnTick = near.burnTick > 0 ? Math.min(near.burnTick, 0.75) : 0.75;
        near.burnLevel = Math.max(near.burnLevel, level);
        near.burnSourcePaddleId = sourcePaddleId;
        ignited++;
        emitEffect("beam", centerX, centerY, classSkillColor("mage-fireball"), 4, near.x + near.w / 2, near.y + near.h / 2, 0.42, 0, "mage-fireball");
        emitEffect("ring", near.x + near.w / 2, near.y + near.h / 2, classSkillColor("mage-fireball"), 28 + level * 4, near.x + near.w / 2, near.y + near.h / 2, 0.4, 0, "mage-fireball");
        game.flashes.push({ text: `점화 ${2 + level}초`, x: near.x + near.w / 2, y: near.y - 5, life: 0.65, color: "#ffd166" });
      });
      emitSkillEffect("mage-fireball", centerX, centerY, range, 0.72);
      emitBurst(centerX, centerY, classSkillColor("mage-fireball"), 14 + level * 4, 220);
      game.flashes.push({ text: `화염구 // ${ignited}개 점화`, x: centerX, y: centerY - 22, life: 0.9, color: classSkillColor("mage-fireball") });
      audioRef.current?.play("skill-impact", 1 + level * 0.2);
    };

    const strikeEvolutionPulse = (origin: Brick, ball: Ball, skillId: ClassSkillId, range: number, targetLimit: number, damage = 1) => {
      const centerX = origin.x + origin.w / 2;
      const centerY = origin.y + origin.h / 2;
      const effectiveRange = range * commonSkillRangeMultiplier(paddleFor(ball.sourcePaddleId).upgrades);
      const targets = game.bricks.filter((target) => target.alive && target !== origin && isDamageableBrick(target))
        .map((target) => ({ target, distance: Math.hypot(target.x + target.w / 2 - centerX, target.y + target.h / 2 - centerY) }))
        .filter((entry) => entry.distance < effectiveRange)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, targetLimit)
        .map((entry) => entry.target);
      targets.forEach((target) => {
        if (absorbGuardHit(target)) return;
        const hpBefore = target.hp;
        target.hp -= damage * damageMultiplier(target);
        recordSkillImpact(skillId, Math.min(hpBefore, Math.max(0, hpBefore - target.hp)), target.hp <= 0);
        emitEffect("beam", centerX, centerY, classSkillColor(skillId), 5, target.x + target.w / 2, target.y + target.h / 2, 0.32, 0, skillId);
        emitEffect("ring", target.x + target.w / 2, target.y + target.h / 2, classSkillColor(skillId), 28, target.x + target.w / 2, target.y + target.h / 2, 0.32, 0, skillId);
        if (target.hp <= 0) destroyBrick(target, ball, false, 0);
      });
      return targets.length;
    };

    const lostPlayerBalls = new Set<Ball>();

    game.bricks.forEach((brick) => {
      if (!brick.alive || !isDamageableBrick(brick) || brick.poisonTime <= 0 || !brick.poisonSourcePaddleId) return;
      brick.poisonTime -= dt;
      brick.poisonTick -= dt;
      if (brick.poisonTick > 0) return;
      const poisonPaddle = paddleFor(brick.poisonSourcePaddleId);
      const poisonLevel = upgradeLevel(poisonPaddle.upgrades, "poison");
      brick.poisonTick = skillValue("poison", poisonLevel);
      if (absorbGuardHit(brick)) return;
      brick.hp -= damageMultiplier(brick);
      const sourceBall = game.balls.find((ball) => ball.sourcePaddleId === poisonPaddle.id) ?? game.balls[0];
      if (brick.hp <= 0 && sourceBall) destroyBrick(brick, sourceBall, false, 0);
    });

    game.bricks.forEach((brick) => {
      if (!brick.alive || !isDamageableBrick(brick) || brick.burnTime <= 0 || !brick.burnSourcePaddleId) return;
      brick.burnTime -= dt;
      brick.burnTick -= dt;
      if (brick.burnTick > 0) return;
      brick.burnTick = 1;
      if (absorbGuardHit(brick)) return;
      const firePaddle = paddleFor(brick.burnSourcePaddleId);
      const hpBefore = brick.hp;
      brick.hp -= damageMultiplier(brick);
      recordSkillImpact("mage-fireball", Math.min(hpBefore, Math.max(0, hpBefore - brick.hp)), brick.hp <= 0);
      const centerX = brick.x + brick.w / 2;
      const centerY = brick.y + brick.h / 2;
      game.flashes.push({ text: "화상 -1", x: centerX, y: brick.y - 7, life: 0.6, color: classSkillColor("mage-fireball") });
      emitEffect("spark", centerX, centerY, classSkillColor("mage-fireball"), 36, centerX, centerY, 0.32, 0, "mage-fireball");
      const sourceBall = game.balls.find((ball) => ball.sourcePaddleId === firePaddle.id) ?? game.balls[0];
      if (brick.hp <= 0 && sourceBall) {
        if (upgradeLevel(firePaddle.upgrades, "mage-fireball") >= 3) igniteFireballArea(brick, firePaddle.id, 3);
        destroyBrick(brick, sourceBall, false, 0);
      }
    });

    game.bricks.forEach((healer) => {
      if (!healer.alive || healer.trait !== "healer" || healer.traitLockTime > 0) return;
      healer.healTimer -= dt;
      if (healer.healTimer > 0) return;
      healer.healTimer = 3;
      const centerX = healer.x + healer.w / 2;
      const centerY = healer.y + healer.h / 2;
      let healed = 0;
      game.bricks.forEach((target) => {
        if (!target.alive || !isDamageableBrick(target) || target.hp >= target.maxHp || target.frostVulnerability > 0 || target.burnTime > 0) return;
        const distance = Math.hypot(target.x + target.w / 2 - centerX, target.y + target.h / 2 - centerY);
        if (distance > 135) return;
        target.hp = Math.min(target.maxHp, target.hp + 1);
        healed++;
        emitEffect("beam", centerX, centerY, "#72f1b8", 4, target.x + target.w / 2, target.y + target.h / 2, 0.5);
        emitEffect("ring", target.x + target.w / 2, target.y + target.h / 2, "#72f1b8", 30, target.x + target.w / 2, target.y + target.h / 2, 0.55);
        game.flashes.push({ text: "+1", x: target.x + target.w / 2, y: target.y - 7, life: 0.9, color: "#72f1b8" });
      });
      if (healed > 0) {
        emitEffect("ring", centerX, centerY, "#72f1b8", 120, centerX, centerY, 0.65);
        game.flashes.push({ text: `HEAL PULSE // +1 ×${healed}`, x: centerX, y: healer.y - 10, life: 0.8, color: "#72f1b8" });
        audioRef.current?.play("skill-impact", 0.8);
      }
    });

    if (dangerActive) {
      paddles.forEach((paddle) => {
        const level = upgradeLevel(paddle.upgrades, "last-shot");
        const counter = counterFor(paddle.id);
        if (level <= 0 || counter.lastShotTimer > 0) return;
        const aliveBricks = game.bricks.filter((brick) => brick.alive && isDamageableBrick(brick));
        const lowestY = Math.max(...aliveBricks.map((brick) => brick.y), -Infinity);
        const target = aliveBricks.filter((brick) => brick.y === lowestY)
          .sort((a, b) => Math.abs(a.x + a.w / 2 - paddle.x) - Math.abs(b.x + b.w / 2 - paddle.x))[0];
        const sourceBall = game.balls.find((ball) => ball.sourcePaddleId === paddle.id) ?? game.balls[0];
          if (target && sourceBall) {
            if (absorbGuardHit(target)) {
              counter.lastShotTimer = skillValue("last-shot", level);
              return;
            }
            target.hp -= damageMultiplier(target);
            if (target.hp <= 0) destroyBrick(target, sourceBall, false, 0);
            game.flashes.push({ text: `${paddle.name} // LAST SHOT`, x: target.x + target.w / 2, y: target.y, life: 0.65, color: "#ff6b87" });
            emitEffect("beam", paddle.x, paddle.y, "#ff6b87", 8, target.x + target.w / 2, target.y + target.h / 2, 0.35);
          }
        counter.lastShotTimer = skillValue("last-shot", level);
      });
    }

    game.items.forEach((item) => {
      item.y += item.vy * dt;
      const magnetPaddle = paddles
        .map((paddle) => ({ paddle, range: Math.max(skillValue("magnet", upgradeLevel(paddle.upgrades, "magnet")), skillValue("common-magnet", upgradeLevel(paddle.upgrades, "common-magnet"))) }))
        .filter(({ paddle, range }) => range > 0 && item.y <= paddle.y + 12 && item.y >= paddle.y - range && Math.abs(item.x - paddle.x) <= paddle.width / 2 + range)
        .sort((a, b) => Math.abs(item.x - a.paddle.x) - Math.abs(item.x - b.paddle.x))[0];
      if (magnetPaddle) {
        item.x += (magnetPaddle.paddle.x - item.x) * Math.min(1, dt * 9);
        item.y += item.vy * dt * 0.7;
      }
      const catcher = paddles.find((paddle) => item.y >= paddle.y - 10 && item.y <= paddle.y + 16 && item.x >= paddle.x - paddle.width / 2 && item.x <= paddle.x + paddle.width / 2);
      if (catcher) {
        const playerBalls = game.balls.filter((ball) => ball.owner === "player");
        const source = playerBalls.find((ball) => ball.sourcePaddleId === catcher.id) ?? playerBalls[0];
        const itemData = ITEM_DATA[item.kind];
        emitEffect("ring", item.x, catcher.y, itemData.color, 42, item.x, catcher.y, 0.45);
        emitBurst(item.x, catcher.y, itemData.color, 10, 150);
        audioRef.current?.play("item", 1.4);
        if (source) {
          const overdrive = 1 + Math.min(0.18, catcher.upgrades.filter((id) => id === "speed").length * 0.06);
          const newBall: Ball = {
            ...source,
            x: item.x,
            y: catcher.y - source.radius - 2,
            vx: (source.vx === 0 ? 190 : -source.vx * 0.92) * overdrive,
            vy: -Math.min(440, Math.max(230, Math.abs(source.vy)) * overdrive),
            pierce: 0,
            maxPierce: 0,
            payload: null,
            payloadLevel: 0,
            payloads: {},
            color: WAVE_MULTIBALL_COLOR,
            sourcePaddleId: catcher.id,
            missileTime: 0,
            missileHitCooldown: 0,
            gravityRescueCooldown: 0,
            skillCharges: {},
            temporaryTime: 0,
            waveBonus: true,
          };
          const grantedPayloads = grantPaddlePayloads(newBall, catcher.upgrades);
          game.balls.push(newBall);
          emitEffect("ring", catcher.x, catcher.y, WAVE_MULTIBALL_COLOR, 58, catcher.x, catcher.y, 0.55);
          const doubleLevel = upgradeLevel(catcher.upgrades, "double-drop");
          const doubleChance = skillValue("double-drop", doubleLevel) / 100;
          if (doubleChance > 0 && decisionRandom() < doubleChance) {
            game.balls.push({ ...newBall, payloads: { ...newBall.payloads }, x: newBall.x + 12, vx: -newBall.vx });
            game.flashes.push({ text: `${catcher.name} // DOUBLE DROP`, x: item.x, y: catcher.y - 38, life: 0.9, color: "#fff27a" });
          }
          const catcherComboLevel = catcher.upgrades.filter((id) => id === "chain").length;
          if (catcherComboLevel > 0) game.comboTimer = Math.max(game.comboTimer, 1.8 + catcherComboLevel * 0.45);
          const payloadSummary = grantedPayloads.map(({ id, level }) => `${PAYLOAD_LABELS[id]}${level}`).join("+");
          game.flashes.push({ text: `${catcher.name} // MULTI BALL +1${payloadSummary ? ` // ${payloadSummary}` : ""}`, x: item.x, y: catcher.y - 24, life: 1, color: WAVE_MULTIBALL_COLOR });
        }
        item.alive = false;
      }
      if (item.y > H + 20) item.alive = false;
    });
    game.items = game.items.filter((item) => item.alive);

    for (const ball of game.balls) {
      ball.payloads ??= {};
      ball.payloadLevel ??= 0;
      if (ball.temporaryTime > 0) {
        ball.temporaryTime = Math.max(0, ball.temporaryTime - dt);
        if (ball.temporaryTime <= 0) {
          lostPlayerBalls.add(ball);
          emitEffect("ring", ball.x, ball.y, classSkillColor("archer-rapid"), 28, ball.x, ball.y, 0.25);
          continue;
        }
      }
      ball.missileHitCooldown = Math.max(0, (ball.missileHitCooldown ?? 0) - dt);
      ball.gravityRescueCooldown = Math.max(0, (ball.gravityRescueCooldown ?? 0) - dt);
      const previousMissileTime = ball.missileTime ?? 0;
      ball.missileTime = Math.max(0, previousMissileTime - dt);
      if (ball.missileTime <= 0 && previousMissileTime > 0) {
        ball.y = Math.min(ball.y, PLAYER_LINE_Y - 38);
        ball.vy = -Math.max(240, Math.abs(ball.vy));
        game.flashes.push({ text: "MISSILE END // RETURN", x: ball.x, y: ball.y - 18, life: 0.65, color: "#ff9658" });
      }
      if (ball.missileTime > 0) {
        const target = game.bricks
          .filter((brick) => brick.alive && isDamageableBrick(brick))
          .map((brick) => ({ brick, distance: Math.hypot(brick.x + brick.w / 2 - ball.x, brick.y + brick.h / 2 - ball.y) }))
          .sort((a, b) => a.distance - b.distance)[0]?.brick;
        if (target) {
          const speed = Math.max(380, Math.hypot(ball.vx, ball.vy));
          const currentAngle = Math.atan2(ball.vy, ball.vx);
          const targetAngle = Math.atan2(target.y + target.h / 2 - ball.y, target.x + target.w / 2 - ball.x);
          const angleDelta = Math.atan2(Math.sin(targetAngle - currentAngle), Math.cos(targetAngle - currentAngle));
          const turn = Math.max(-5.4 * dt, Math.min(5.4 * dt, angleDelta));
          ball.vx = Math.cos(currentAngle + turn) * speed;
          ball.vy = Math.sin(currentAngle + turn) * speed;
        }
      }
      game.gravityWells.forEach((well) => {
        if (ball.missileTime > 0) return;
        const dx = well.x - ball.x;
        const dy = well.y - ball.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        if (distance >= well.radius) return;
        const force = 1050 * (1 - distance / well.radius);
        ball.vx += dx / distance * force * dt;
        ball.vy += dy / distance * force * dt;
        if (distance < 34) {
          ball.y = Math.min(ball.y, well.y + 14);
          ball.vx += (ball.x < well.x ? -1 : 1) * 70;
          ball.vy = -Math.max(230, Math.abs(ball.vy));
          if (botActiveRef.current && ball.gravityRescueCooldown <= 0) {
            game.botMetrics.gravityRescues++;
            ball.gravityRescueCooldown = 1;
          }
        }
      });
      const previousBallX = ball.x;
      const previousBallY = ball.y;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - ball.radius) { ball.x = W - ball.radius; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < ball.radius) { ball.y = ball.radius; ball.vy = Math.abs(ball.vy); }

      if (ball.vy > 0) {
        for (const paddle of paddles) {
          const verticalTravel = ball.y - previousBallY;
          const rawContactTime = verticalTravel > 0 ? (paddle.y - ball.radius - previousBallY) / verticalTravel : -1;
          const crossedPaddleTop = rawContactTime >= 0 && rawContactTime <= 1;
          const alreadyTouchingTop = previousBallY <= paddle.y + PADDLE_COLLISION_SLOP
            && previousBallY + ball.radius >= paddle.y - PADDLE_COLLISION_SLOP
            && ball.y - ball.radius <= paddle.y + 12;
          const sweptLeft = Math.min(previousBallX, ball.x) - ball.radius;
          const sweptRight = Math.max(previousBallX, ball.x) + ball.radius;
          const sideDepthContact = previousBallY + ball.radius >= paddle.y - PADDLE_COLLISION_SLOP
            && ball.y - ball.radius <= paddle.y + PADDLE_SIDE_DEPTH
            && sweptRight >= Math.min(paddle.previousX, paddle.x) - paddle.width / 2 - PADDLE_SIDE_FORGIVENESS
            && sweptLeft <= Math.max(paddle.previousX, paddle.x) + paddle.width / 2 + PADDLE_SIDE_FORGIVENESS;
          if (!crossedPaddleTop && !alreadyTouchingTop && !sideDepthContact) continue;
          const contactTime = crossedPaddleTop ? Math.max(0, Math.min(1, rawContactTime)) : 1;
          const contactX = previousBallX + (ball.x - previousBallX) * contactTime;
          const paddleContactX = paddle.previousX + (paddle.x - paddle.previousX) * contactTime;
          if (contactX + ball.radius + PADDLE_SIDE_FORGIVENESS < paddleContactX - paddle.width / 2 || contactX - ball.radius - PADDLE_SIDE_FORGIVENESS > paddleContactX + paddle.width / 2) continue;
          const hit = Math.max(-1, Math.min(1, (contactX - paddleContactX) / (paddle.width / 2)));
          const paddleEnglish = Math.max(-MAX_PADDLE_ENGLISH, Math.min(MAX_PADDLE_ENGLISH, paddle.velocity * PADDLE_ENGLISH_FACTOR));
          const reboundSpeed = Math.max(MIN_PADDLE_REBOUND_SPEED, Math.min(MAX_PADDLE_REBOUND_SPEED, Math.hypot(ball.vx, ball.vy)));
          const horizontalRatio = Math.max(-MAX_PADDLE_REBOUND_RATIO, Math.min(MAX_PADDLE_REBOUND_RATIO, hit * 0.74 + paddleEnglish / reboundSpeed));
          ball.vx = horizontalRatio * reboundSpeed;
          ball.vy = -Math.sqrt(Math.max(1, reboundSpeed * reboundSpeed - ball.vx * ball.vx));
          ball.x = contactX;
          ball.y = paddle.y - ball.radius - 0.1;
          ball.sourcePaddleId = paddle.id;
          audioRef.current?.play("paddle", game.combo);
          const grantedPayloads = grantPaddlePayloads(ball, paddle.upgrades);
          emitBurst(ball.x, paddle.y, grantedPayloads.length > 1 ? "#ffffff" : grantedPayloads.length === 1 ? PAYLOAD_COLORS[grantedPayloads[0].id] : ball.color, 7, 135);
          if (grantedPayloads.length > 0) emitEffect("ring", ball.x, paddle.y, ball.color, 34, ball.x, paddle.y, 0.38);
          const paddleCounter = counterFor(paddle.id);
          paddleCounter.skillReflections ??= {};
          const triggerReflectionSkill = (id: ClassSkillId, onTrigger: (level: number) => void) => {
            if (ball.temporaryTime > 0) return;
            const level = upgradeLevel(paddle.upgrades, id);
            if (level <= 0) return;
            const next = (paddleCounter.skillReflections[id] ?? 0) + 1;
            const threshold = Math.max(1, Math.round(skillValue(id, level)));
            if (next < threshold) {
              paddleCounter.skillReflections[id] = next;
              return;
            }
            paddleCounter.skillReflections[id] = 0;
            onTrigger(level);
            skillMetricFor(id).activations++;
            const color = classSkillColor(id);
            const name = activeSkillMap[id]?.name ?? id;
            paddleCounter.chargePulse = 1.2;
            paddleCounter.chargeColor = color;
            emitEffect("ring", paddle.x, paddle.y, color, 58 + level * 8, paddle.x, paddle.y, 0.65);
            emitBurst(paddle.x, paddle.y, color, 14 + level * 3, 220);
            game.flashes.push({ text: `${paddle.name} // ${name}`, x: paddle.x, y: paddle.y - 42, life: 1, color });
            audioRef.current?.play("skill", 1 + level * 0.35);
            impactFeedback(2.4 + level * 0.7, color, 0.16, level >= 3 ? 0.08 : 0);
          };
          const chargeBall = (id: ClassSkillId, level: number, label: string, color: string) => {
            ball.skillCharges[id] = level;
            game.flashes.push({ text: `${paddle.name} // ${label}`, x: paddle.x, y: paddle.y - 32, life: 0.85, color });
            emitEffect("ring", ball.x, ball.y, color, 42 + level * 8, ball.x, ball.y, 0.5);
          };
          const spawnArrow = (offset: number, lifetime: number, skillId: ClassSkillId = "archer-rapid") => {
            game.balls.push({
              ...ball,
              payloads: { ...ball.payloads },
              skillCharges: {},
              visualSkill: skillId,
              x: ball.x + offset,
              vx: ball.vx * (offset < 0 ? -0.86 : 0.86),
              vy: -Math.abs(ball.vy),
              temporaryTime: lifetime,
              color: classSkillColor(skillId),
            });
          };
          const spawnInfiniteBonus = (sourceId: ClassSkillId) => {
            const infiniteLevel = upgradeLevel(paddle.upgrades, "archer-infinite");
            if (infiniteLevel <= 0) return;
            spawnArrow(ball.vx >= 0 ? -20 : 20, 4 + infiniteLevel, "archer-infinite");
            game.flashes.push({ text: `무한 탄창 // ${activeSkillMap[sourceId]?.name ?? sourceId} 복제`, x: paddle.x, y: paddle.y - 52, life: 0.8, color: classSkillColor("archer-infinite") });
          };
          const strikeTargets = (targets: Brick[], damage: number, color: string, label: string, skillId: ClassSkillId) => {
            targets.forEach((target) => {
              if (!target.alive || !isDamageableBrick(target) || absorbGuardHit(target)) return;
              const hpBefore = target.hp;
              target.hp -= damage * damageMultiplier(target);
              recordSkillImpact(skillId, Math.min(hpBefore, Math.max(0, hpBefore - target.hp)), target.hp <= 0);
              emitEffect("beam", ball.x, ball.y, color, 6, target.x + target.w / 2, target.y + target.h / 2, 0.35);
              if (target.hp <= 0) destroyBrick(target, ball, false, 0);
            });
            if (targets.length) game.flashes.push({ text: `${paddle.name} // ${label}`, x: ball.x, y: ball.y - 22, life: 0.9, color });
          };

          triggerReflectionSkill("warrior-smash", (level) => chargeBall("warrior-smash", level, "강타 준비", classSkillColor("warrior-smash")));
          triggerReflectionSkill("warrior-shockwave", (level) => chargeBall("warrior-shockwave", level, "충격파 준비", classSkillColor("warrior-shockwave")));
          triggerReflectionSkill("warrior-execute", (level) => chargeBall("warrior-execute", level, "처형 준비", classSkillColor("warrior-execute")));
          triggerReflectionSkill("warrior-crush", (level) => chargeBall("warrior-crush", level, "분쇄 준비", classSkillColor("warrior-crush")));
          triggerReflectionSkill("warrior-guard", (level) => {
            const barrierGain = level >= 3 ? 2 : 1;
            game.paddleBarriers[paddle.id] = Math.min(4, (game.paddleBarriers[paddle.id] ?? 0) + barrierGain);
            game.flashes.push({ text: `${paddle.name} // 철벽 +${barrierGain}${level >= 3 ? " · EVOLVED" : ""}`, x: paddle.x, y: PLAYER_LINE_Y - 24, life: 1, color: classSkillColor("warrior-guard") });
            emitEffect("beam", 20, PLAYER_LINE_Y, classSkillColor("warrior-guard"), 10, W - 20, PLAYER_LINE_Y, 0.65);
            emitSkillEffect("warrior-guard", W / 2, PLAYER_LINE_Y, 120, 0.9, W - 24, PLAYER_LINE_Y);
          });
          triggerReflectionSkill("warrior-earthquake", (level) => {
            strikeTargets(game.bricks.filter((target) => target.alive && target.kind !== "boss-core"), 1, classSkillColor("warrior-earthquake"), "대지 분쇄", "warrior-earthquake");
            game.ultimateAuras["warrior-earthquake"] = true;
            emitEffect("beam", 10, H / 2, classSkillColor("warrior-earthquake"), 18 + level * 3, W - 10, H / 2, 0.8);
            emitSkillEffect("warrior-earthquake", 20, H / 2, W - 40, 0.9, W - 20, H / 2);
            game.flashes.push({ text: "대지 분쇄 // WAVE AURA ACTIVE", x: W / 2, y: H / 2 + 38, life: 1.3, color: classSkillColor("warrior-earthquake") });
          });
          triggerReflectionSkill("warrior-berserker", (level) => {
            ball.attackPower = Math.max(ball.attackPower, 4 + level);
            ball.skillCharges["warrior-berserker"] = level;
            const currentSpeed = Math.max(1, Math.hypot(ball.vx, ball.vy));
            const berserkerSpeed = Math.min(MAX_PADDLE_REBOUND_SPEED, Math.hypot(BASE_BALL_VX, BASE_BALL_VY) * overdriveMultiplier(game.overdriveLevel) * 1.25);
            if (currentSpeed < berserkerSpeed) {
              ball.vx *= berserkerSpeed / currentSpeed;
              ball.vy *= berserkerSpeed / currentSpeed;
            }
            emitSkillEffect("warrior-berserker", ball.x, ball.y, 78 + level * 8, 0.95);
            game.flashes.push({ text: `${paddle.name} // 광전사`, x: paddle.x, y: paddle.y - 32, life: 1, color: "#ff4f78" });
          });

          triggerReflectionSkill("archer-rapid", (level) => {
            spawnArrow(ball.vx >= 0 ? -12 : 12, 4 + level * 0.75);
            if (level >= 3) spawnArrow(ball.vx >= 0 ? 16 : -16, 4 + level * 0.75);
            spawnInfiniteBonus("archer-rapid");
            emitSkillEffect("archer-rapid", ball.x, ball.y, 58 + level * 6, 0.55, ball.x + ball.vx * 0.12, ball.y + ball.vy * 0.12);
            game.flashes.push({ text: `${paddle.name} // 연사 +${level >= 3 ? 2 : 1}`, x: paddle.x, y: paddle.y - 32, life: 0.9, color: "#72f1b8" });
          });
          triggerReflectionSkill("archer-pierce", (level) => {
            ball.pierce = level + 1;
            ball.maxPierce = ball.pierce;
            chargeBall("archer-pierce", level, "관통 화살", classSkillColor("archer-pierce"));
            spawnInfiniteBonus("archer-pierce");
          });
          triggerReflectionSkill("archer-ricochet", (level) => { chargeBall("archer-ricochet", level, "도탄 화살", classSkillColor("archer-ricochet")); spawnInfiniteBonus("archer-ricochet"); });
          triggerReflectionSkill("archer-focus", (level) => { chargeBall("archer-focus", level, "집중 사격", classSkillColor("archer-focus")); spawnInfiniteBonus("archer-focus"); });
          triggerReflectionSkill("archer-weakpoint", (level) => { chargeBall("archer-weakpoint", level, "약점 사격", classSkillColor("archer-weakpoint")); spawnInfiniteBonus("archer-weakpoint"); });
          triggerReflectionSkill("archer-arrow-rain", (level) => {
            const pierceBuild = upgradeLevel(paddle.upgrades, "archer-pierce");
            const ricochetBuild = upgradeLevel(paddle.upgrades, "archer-ricochet");
            const weakpointBuild = upgradeLevel(paddle.upgrades, "archer-weakpoint");
            const targetCount = 8 + level * 4 + pierceBuild * 2 + ricochetBuild * 2;
            const arrowDamage = weakpointBuild >= 3 ? 2 : 1;
            const targetPriority = (target: Brick) => ricochetBuild > 0 && target.trait !== "standard" ? 0 : 1;
            const targets = game.bricks.filter((target) => target.alive && target.kind !== "boss-core" && isDamageableBrick(target))
              .sort((a, b) => targetPriority(a) - targetPriority(b) || decisionRandom() - 0.5)
              .slice(0, targetCount);
            emitSkillEffect("archer-arrow-rain", W / 2, BRICK_ROW_Y, W - 80, 0.9, W / 2, PLAYER_LINE_Y);
            strikeTargets(targets, arrowDamage, classSkillColor("archer-arrow-rain"), `화살비 ${targetCount}발 · DMG ${arrowDamage}`, "archer-arrow-rain");
          });
          triggerReflectionSkill("archer-infinite", (level) => {
            spawnArrow(-18, 5 + level, "archer-infinite");
            spawnArrow(0, 5 + level, "archer-infinite");
            spawnArrow(18, 5 + level, "archer-infinite");
            emitSkillEffect("archer-infinite", paddle.x, paddle.y - 24, 88 + level * 8, 0.85);
            game.flashes.push({ text: `${paddle.name} // 무한 탄창 +3`, x: paddle.x, y: paddle.y - 32, life: 1, color: "#72f1b8" });
          });

          triggerReflectionSkill("mage-fireball", (level) => chargeBall("mage-fireball", level, "화염구", classSkillColor("mage-fireball")));
          triggerReflectionSkill("mage-lightning", (level) => chargeBall("mage-lightning", level, "연쇄 번개", classSkillColor("mage-lightning")));
          triggerReflectionSkill("mage-freeze", (level) => {
            const frozenTargets = game.bricks.filter((target) => target.alive && isDamageableBrick(target))
              .sort((a, b) => b.hp - a.hp)
              .slice(0, 2 + level);
            frozenTargets.forEach((target) => {
              target.frostVulnerability = Math.max(target.frostVulnerability, level);
              if (target.trait === "healer" || target.trait === "reflector") {
                target.traitLockTime = Math.max(target.traitLockTime, 2 + level);
              }
              const targetX = target.x + target.w / 2;
              const targetY = target.y + target.h / 2;
              emitEffect("beam", ball.x, ball.y, classSkillColor("mage-freeze"), 5, targetX, targetY, 0.45);
              emitEffect("ring", targetX, targetY, classSkillColor("mage-freeze"), 34, targetX, targetY, 0.55);
              emitSkillEffect("mage-freeze", targetX, targetY, Math.min(target.w, target.h) + 24, 0.6);
            });
            game.flashes.push({ text: `${paddle.name} // 빙결 표식 ×${frozenTargets.length}`, x: W / 2, y: BRICK_ROW_Y - 18, life: 1, color: "#65dcff" });
          });
          triggerReflectionSkill("mage-black-hole", (level) => {
            const wellX = Math.max(150, Math.min(W - 150, ball.x));
            const wellY = 145 + decisionRandom() * 80;
            const wellLife = level >= 3 ? 6 : 3.5;
            const wellRadius = (level >= 3 ? 220 : 155 + level * 15) * commonSkillRangeMultiplier(paddle.upgrades);
            game.gravityWells.push({ ownerPaddleId: paddle.id, x: wellX, y: wellY, radius: wellRadius, life: wellLife, maxLife: wellLife, color: classSkillColor("mage-black-hole") });
            emitSkillEffect("mage-black-hole", wellX, wellY, 120 + level * 12, 1.05);
            game.flashes.push({ text: `${paddle.name} // 블랙홀`, x: wellX, y: wellY - 28, life: 1, color: "#9a8cff" });
          });
          triggerReflectionSkill("mage-mana-blast", (level) => {
            const targets = game.bricks
              .filter((target) => target.alive && (target.trait === "guard" || target.trait === "healer" || target.trait === "reflector"))
              .sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y))
              .slice(0, 1 + level);
            const lockDuration = 2 + level * 2;
            targets.forEach((target) => {
              target.traitLockTime = Math.max(target.traitLockTime, lockDuration);
              const targetX = target.x + target.w / 2;
              const targetY = target.y + target.h / 2;
              emitEffect("beam", ball.x, ball.y, classSkillColor("mage-mana-blast"), 7, targetX, targetY, 0.55);
              emitEffect("ring", targetX, targetY, classSkillColor("mage-mana-blast"), 42, targetX, targetY, 0.65);
            });
            emitSkillEffect("mage-mana-blast", ball.x, ball.y, 86 + level * 9, 0.75);
            game.flashes.push({ text: `${paddle.name} // 마력 봉인 ${lockDuration}s ×${targets.length}`, x: ball.x, y: ball.y - 22, life: 1, color: classSkillColor("mage-mana-blast") });
          });
          triggerReflectionSkill("mage-elemental-storm", (level) => {
            ball.skillCharges["mage-fireball"] = level;
            ball.skillCharges["mage-lightning"] = level;
            const stormTargets = game.bricks.filter((target) => target.alive && isDamageableBrick(target))
              .sort((a, b) => b.hp - a.hp)
              .slice(0, 4 + level);
            stormTargets.forEach((target) => {
              target.frostVulnerability = Math.max(target.frostVulnerability, Math.max(1, level));
              target.traitLockTime = Math.max(target.traitLockTime, 4 + level);
            });
            game.flashes.push({ text: `${paddle.name} // 원소 폭풍`, x: W / 2, y: H / 2, life: 1.2, color: "#c18cff" });
            emitEffect("ring", W / 2, H / 2, classSkillColor("mage-elemental-storm"), 210, W / 2, H / 2, 0.9);
            emitSkillEffect("mage-elemental-storm", W / 2, H / 2, 190 + level * 12, 1.15);
          });
          triggerReflectionSkill("mage-meteor", (level) => {
            const afflictedCount = game.bricks.filter((entry) => entry.alive && (entry.burnTime > 0 || entry.frostVulnerability > 0 || entry.traitLockTime > 0)).length;
            const meteorCount = 1 + Math.floor(afflictedCount / 4);
            const targets = game.bricks.filter((entry) => entry.alive && isDamageableBrick(entry)).sort((a, b) => b.hp - a.hp).slice(0, meteorCount);
            targets.forEach((target, index) => {
              const hpBefore = target.hp;
              target.hp -= (8 + level * 4) * damageMultiplier(target);
              recordSkillImpact("mage-meteor", Math.min(hpBefore, Math.max(0, hpBefore - target.hp)), target.hp <= 0);
              emitSkillEffect("mage-meteor", target.x + target.w / 2, BRICK_ROW_Y - 35 - index * 8, 120 + level * 15, 0.95, target.x + target.w / 2, target.y + target.h / 2);
              emitEffect("blast", target.x + target.w / 2, target.y + target.h / 2, classSkillColor("mage-meteor"), 110 + level * 15, target.x + target.w / 2, target.y + target.h / 2, 0.85);
              emitBurst(target.x + target.w / 2, target.y + target.h / 2, classSkillColor("mage-meteor"), 28, 360);
              if (target.hp <= 0) destroyBrick(target, ball, false, 0);
            });
            audioRef.current?.play("ultimate", 1 + level * 0.25);
            impactFeedback(10 + level, classSkillColor("mage-meteor"), 0.42, 0.2);
            game.flashes.push({ text: `${paddle.name} // 메테오 ×${targets.length} · -${8 + level * 4}`, x: W / 2, y: BRICK_ROW_Y - 18, life: 1.1, color: "#ff9658" });
          });
          const missileLevel = upgradeLevel(paddle.upgrades, "missile-mode");
          if (missileLevel > 0 && ++paddleCounter.missileReflections >= 12) {
            paddleCounter.missileReflections = 0;
            ball.missileTime = skillValue("missile-mode", missileLevel);
            ball.missileHitCooldown = 0;
            const missileSpeed = Math.max(380, Math.hypot(ball.vx, ball.vy));
            const directionLength = Math.max(1, Math.hypot(ball.vx, ball.vy));
            ball.vx = ball.vx / directionLength * missileSpeed;
            ball.vy = ball.vy / directionLength * missileSpeed;
            if (botActiveRef.current) game.botMetrics.missileActivations++;
            game.flashes.push({ text: `${paddle.name} // MISSILE ${ball.missileTime.toFixed(1)}s`, x: paddle.x, y: paddle.y - 34, life: 1, color: "#ff9658" });
            emitEffect("beam", paddle.x, paddle.y, "#ff9658", 9, ball.x, ball.y, 0.45);
            emitBurst(ball.x, ball.y, "#ff9658", 14, 230);
          }
          const returnLevel = upgradeLevel(paddle.upgrades, "chain");
          if (returnLevel > 0) {
            const recovered = skillValue("chain", returnLevel);
            game.comboTimer = Math.max(game.comboTimer, recovered);
            paddleCounter.comboTimer = Math.max(paddleCounter.comboTimer, recovered);
          }
          const splitLevel = upgradeLevel(paddle.upgrades, "echo-split");
          if (splitLevel > 0 && ++paddleCounter.reflections >= skillValue("echo-split", splitLevel)) {
            paddleCounter.reflections = 0;
            game.balls.push({ ...ball, payloads: { ...ball.payloads }, x: ball.x + (ball.vx >= 0 ? -12 : 12), vx: -ball.vx * 0.92 });
            game.flashes.push({ text: `${paddle.name} // ECHO SPLIT +1`, x: paddle.x, y: paddle.y - 30, life: 0.9, color: "#fff27a" });
            emitEffect("ring", paddle.x, paddle.y, "#fff27a", 68, paddle.x, paddle.y, 0.6);
            emitBurst(paddle.x, paddle.y, "#fff27a", 14, 220);
          }
          const barrierLevel = upgradeLevel(paddle.upgrades, "barrier-skill");
          if (barrierLevel > 0 && ++paddleCounter.barrierReflections >= skillValue("barrier-skill", barrierLevel)) {
            paddleCounter.barrierReflections = 0;
            game.paddleBarriers[paddle.id] = Math.max(1, game.paddleBarriers[paddle.id] ?? 0);
            game.flashes.push({ text: `${paddle.name} // BARRIER READY`, x: paddle.x, y: paddle.y - 30, life: 0.9, color: BARRIER_COLOR });
            emitEffect("ring", paddle.x, paddle.y, BARRIER_COLOR, paddle.width * 0.7, paddle.x, paddle.y, 0.75);
          }
          if (grantedPayloads.length > 0) {
            const summary = grantedPayloads.map(({ id, level }) => `${PAYLOAD_LABELS[id]}${level}`).join("+");
            game.flashes.push({ text: `${paddle.name} // ${summary}`, x: paddle.x, y: paddle.y - 18, life: 0.8, color: grantedPayloads.length > 1 ? "#ffffff" : PAYLOAD_COLORS[grantedPayloads[0].id] });
          }
          break;
        }
      }

      if (ball.vy > 0) {
        const safetyBlock = game.safetyBlocks.find((block) => ball.y + ball.radius >= block.y && ball.y - ball.radius <= block.y + 8 && ball.x >= block.x - block.width / 2 && ball.x <= block.x + block.width / 2);
        if (safetyBlock) {
          const owner = paddleFor(safetyBlock.ownerPaddleId);
          ball.y = safetyBlock.y - ball.radius;
          ball.vy = -Math.max(250, Math.abs(ball.vy));
          ball.sourcePaddleId = owner.id;
          grantPaddlePayloads(ball, owner.upgrades);
          game.safetyBlocks = game.safetyBlocks.filter((block) => block !== safetyBlock);
          if (botActiveRef.current) game.botMetrics.safetySaves++;
          game.flashes.push({ text: `${owner.name} // AUTO REFLECT`, x: safetyBlock.x, y: safetyBlock.y - 18, life: 0.8, color: safetyBlock.color });
          emitEffect("ring", safetyBlock.x, safetyBlock.y, safetyBlock.color, safetyBlock.width * 0.65, safetyBlock.x, safetyBlock.y, 0.55);
          emitBurst(ball.x, safetyBlock.y, safetyBlock.color, 12, 190);
        }
      }

      if (ball.y - ball.radius > H) {
        if (ball.missileTime > 0) {
          ball.y = H - 45;
          ball.vy = -Math.max(260, Math.abs(ball.vy));
          continue;
        }
        lostPlayerBalls.add(ball);
        continue;
      }

      if (ball.missileHitCooldown > 0) continue;

      for (const brick of game.bricks) {
        if (!brick.alive) continue;
        const collision = circleRectangleCollision(ball, brick, previousBallX, previousBallY);
        if (!collision) continue;

        if (brick.trait === "reflector" && brick.traitLockTime <= 0 && ball.vy < 0 && collision.normalY > 0) {
          ball.y = brick.y + brick.h + ball.radius;
          ball.vy = Math.abs(ball.vy);
          emitEffect("ring", ball.x, brick.y + brick.h, "#65dcff", 46, ball.x, brick.y + brick.h, 0.42);
          emitBurst(ball.x, brick.y + brick.h, "#65dcff", 9, 180);
          game.flashes.push({ text: "REFLECT // UNDERSIDE", x: brick.x + brick.w / 2, y: brick.y + brick.h + 18, life: 0.65, color: "#65dcff" });
          audioRef.current?.play("barrier", 1.15);
          break;
        }
        if (brick.trait === "indestructible") {
          separateAndReflectBall(ball, collision);
          emitEffect("ring", ball.x, ball.y, "#8d96a8", 34, ball.x, ball.y, 0.3);
          audioRef.current?.play("brick-hit", 0.7);
          break;
        }

        const glassLevel = ball.payloads.glass ?? 0;
        const blastLevel = ball.payloads.blast ?? 0;
        const linkLevel = ball.payloads.link ?? 0;
        const sourcePaddle = paddleFor(ball.sourcePaddleId);
        const piercingHit = ball.pierce > 0 || ball.missileTime > 0;
        const crushLevel = ball.skillCharges["warrior-crush"] ?? 0;
        if (crushLevel > 0 && brick.guardReady) {
          brick.guardReady = false;
          game.flashes.push({ text: "분쇄 // GUARD BREAK", x: brick.x + brick.w / 2, y: brick.y - 8, life: 0.8, color: "#ffcf4a" });
          emitBurst(brick.x + brick.w / 2, brick.y + brick.h / 2, "#ffcf4a", 12, 220);
        }
        const guardAbsorbed = crushLevel <= 0 && absorbGuardHit(brick);
        if (!guardAbsorbed && glassLevel > 0) {
          const fractureRate = skillValue("glass", glassLevel) / 100;
          const fractureBaseDamage = Math.max(1, Math.ceil(brick.hp * fractureRate));
          const fractureDamage = Math.min(brick.kind === "boss-core" || brick.kind === "boss-armor" ? 20 : Infinity, fractureBaseDamage) * damageMultiplier(brick);
          brick.hp -= fractureDamage;
          if (brick.kind === "normal" || brick.kind === "boss-minion") brick.hue = 195;
          game.flashes.push({ text: `FRACTURE -${Math.max(1, Math.ceil(fractureDamage))}`, x: brick.x + brick.w / 2, y: brick.y - 7, life: 0.7, color: "#60d7ff" });
          emitEffect("ring", brick.x + brick.w / 2, brick.y + brick.h / 2, "#60d7ff", 38 + glassLevel * 9, brick.x + brick.w / 2, brick.y + brick.h / 2, 0.45);
          emitBurst(brick.x + brick.w / 2, brick.y + brick.h / 2, "#60d7ff", 9 + glassLevel * 2, 210);
        }
        const corrosionLevel = upgradeLevel(sourcePaddle.upgrades, "corrosion");
        const corrosionDamage = !guardAbsorbed && corrosionLevel > 0 && brick.lastHitPaddleId === sourcePaddle.id ? skillValue("corrosion", corrosionLevel) : 0;
        const smashLevel = ball.skillCharges["warrior-smash"] ?? 0;
        const executeLevel = ball.skillCharges["warrior-execute"] ?? 0;
        const focusLevel = ball.skillCharges["archer-focus"] ?? 0;
        const weakpointLevel = ball.skillCharges["archer-weakpoint"] ?? 0;
        const repeatedTarget = brick.lastHitPaddleId === sourcePaddle.id;
        const frostDamage = brick.frostVulnerability;
        const hpBeforeDirect = brick.hp;
        const directSkillContributors = (["warrior-execute", "archer-weakpoint", "warrior-smash", "warrior-crush", "archer-focus"] as ClassSkillId[]).filter((id) => (ball.skillCharges[id] ?? 0) > 0);
        const baselineDirectDamage = (Math.max(1, ball.attackPower) + corrosionDamage) * damageMultiplier(brick);
        const pierceEvolutionDamage = ball.skillCharges["archer-pierce"] === 3 ? Math.max(0, ball.maxPierce - ball.pierce) : 0;
        const sealedEvolutionDamage = brick.traitLockTime > 0 && upgradeLevel(sourcePaddle.upgrades, "mage-mana-blast") >= 3 ? 1 : 0;
        let directDamage = Math.max(1, ball.attackPower) + corrosionDamage + smashLevel + frostDamage + pierceEvolutionDamage + sealedEvolutionDamage;
        if (crushLevel > 0 && brick.trait !== "standard" && brick.trait !== "guard") directDamage += crushLevel + 1;
        if (focusLevel > 0 && repeatedTarget) directDamage += (focusLevel + 1) * (focusLevel >= 3 ? 1.5 : 1);
        if (weakpointLevel > 0) directDamage *= weakpointLevel >= 3 ? 4 : 3;
        const executeThreshold = executeLevel >= 3 ? 0.4 : 0.25;
        if (executeLevel > 0 && brick.kind !== "boss-core" && brick.hp / Math.max(1, brick.maxHp) <= executeThreshold) directDamage = brick.hp;
        if (!guardAbsorbed) applyDebuffs(brick, sourcePaddle);
        if (!guardAbsorbed) {
          brick.hp -= directDamage * damageMultiplier(brick);
          brick.lastHitPaddleId = sourcePaddle.id;
          const actualDirectDamage = Math.min(hpBeforeDirect, Math.max(0, hpBeforeDirect - brick.hp));
          if (frostDamage > 0) {
            recordSkillImpact("mage-freeze", Math.min(actualDirectDamage, frostDamage * damageMultiplier(brick)), brick.hp <= 0);
            brick.frostVulnerability = 0;
            game.flashes.push({ text: `빙결 파쇄 // +${frostDamage}`, x: brick.x + brick.w / 2, y: brick.y - 8, life: 0.8, color: classSkillColor("mage-freeze") });
            emitSkillEffect("mage-freeze", brick.x + brick.w / 2, brick.y + brick.h / 2, 48 + frostDamage * 8, 0.5);
            if (upgradeLevel(sourcePaddle.upgrades, "mage-freeze") >= 3) {
              game.bricks.filter((target) => target.alive && target !== brick && isDamageableBrick(target))
                .sort((a, b) => Math.hypot(a.x - brick.x, a.y - brick.y) - Math.hypot(b.x - brick.x, b.y - brick.y))
                .slice(0, 2)
                .forEach((target) => {
                  target.frostVulnerability = Math.max(target.frostVulnerability, 1);
                  emitEffect("beam", brick.x + brick.w / 2, brick.y + brick.h / 2, classSkillColor("mage-freeze"), 5, target.x + target.w / 2, target.y + target.h / 2, 0.4, 0, "mage-freeze");
                });
            }
          }
          const attributedDamage = Math.max(0, actualDirectDamage - baselineDirectDamage);
          if (directSkillContributors.length > 0) {
            const damageShare = attributedDamage / directSkillContributors.length;
            directSkillContributors.forEach((id, index) => recordSkillImpact(id, damageShare, brick.hp <= 0 && index === 0));
          }
        }
        emitEffect(
          "spark",
          ball.x,
          ball.y,
          guardAbsorbed ? "#ffcf4a" : `hsl(${brick.hue} 95% 72%)`,
          guardAbsorbed ? 52 : 44,
          ball.x,
          ball.y,
          guardAbsorbed ? 0.18 : 0.24,
          guardAbsorbed ? 1 : 0,
        );
        if (brick.hp > 0) audioRef.current?.play("brick-hit", directDamage);
        if (corrosionDamage > 0) emitEffect("ring", brick.x + brick.w / 2, brick.y + brick.h / 2, "#c18cff", 28 + corrosionDamage * 5, brick.x + brick.w / 2, brick.y + brick.h / 2, 0.32);
        if (!guardAbsorbed && smashLevel >= 3) strikeEvolutionPulse(brick, ball, "warrior-smash", 115, 2);
        if (!guardAbsorbed && game.ultimateAuras["warrior-earthquake"]) strikeEvolutionPulse(brick, ball, "warrior-earthquake", 78, game.bricks.length);
        if (!guardAbsorbed && (ball.skillCharges["warrior-berserker"] ?? 0) > 0) {
          const berserkerTargets = Math.max(1, Math.floor(ball.attackPower / 2));
          strikeEvolutionPulse(brick, ball, "warrior-berserker", 75 + ball.attackPower * 6, berserkerTargets);
        }
        if (!guardAbsorbed && crushLevel >= 3 && brick.hp <= 0 && brick.trait !== "standard" && brick.trait !== "indestructible") {
          game.bricks.filter((target) => target.alive && target !== brick && target.trait === brick.trait && isDamageableBrick(target)).forEach((target) => {
            if (absorbGuardHit(target)) return;
            const hpBefore = target.hp;
            target.hp -= damageMultiplier(target);
            recordSkillImpact("warrior-crush", Math.min(hpBefore, Math.max(0, hpBefore - target.hp)), target.hp <= 0);
            emitEffect("beam", brick.x + brick.w / 2, brick.y + brick.h / 2, classSkillColor("warrior-crush"), 6, target.x + target.w / 2, target.y + target.h / 2, 0.38, 0, "warrior-crush");
            if (target.hp <= 0) destroyBrick(target, ball, false, 0);
          });
          game.flashes.push({ text: `분쇄 진화 // ${BRICK_TRAIT_DATA[brick.trait as Exclude<BrickTrait, "standard">]?.label ?? brick.trait} 공명`, x: brick.x + brick.w / 2, y: brick.y - 20, life: 0.9, color: classSkillColor("warrior-crush") });
        }
        if (ball.missileTime > 0) {
          ball.missileHitCooldown = 0.09;
        } else if (ball.pierce > 0) {
          ball.pierce--;
          if (ball.pierce <= 0) delete ball.skillCharges["archer-pierce"];
          if (Math.abs(ball.vx) > Math.abs(ball.vy)) ball.x = ball.vx > 0 ? brick.x + brick.w + ball.radius + 0.1 : brick.x - ball.radius - 0.1;
          else ball.y = ball.vy > 0 ? brick.y + brick.h + ball.radius + 0.1 : brick.y - ball.radius - 0.1;
        } else {
          separateAndReflectBall(ball, collision);
        }
        if (!guardAbsorbed && linkLevel > 0) {
          randomLinkTargets(brick, linkLevel).forEach((linked) => {
            if (absorbGuardHit(linked)) return;
            applyDebuffs(linked, sourcePaddle);
            linked.hp -= damageMultiplier(linked);
            emitEffect("beam", brick.x + brick.w / 2, brick.y + brick.h / 2, "#72f1b8", 5, linked.x + linked.w / 2, linked.y + linked.h / 2, 0.34);
            if (linked.hp <= 0) destroyBrick(linked, ball, false, 0);
          });
        }
        const ricochetLevel = ball.skillCharges["archer-ricochet"] ?? 0;
        const lightningLevel = ball.skillCharges["mage-lightning"] ?? 0;
        const classChainBase = Math.max(ricochetLevel, lightningLevel + (lightningLevel > 0 ? 1 : 0));
        const classChainCount = classChainBase > 0 ? classChainBase + commonChainBonus(sourcePaddle.upgrades) : 0;
        if (!guardAbsorbed && classChainCount > 0) {
          const color = lightningLevel > 0 ? "#9a8cff" : "#72f1b8";
          const chainSkillId: ClassSkillId = lightningLevel > 0 ? "mage-lightning" : "archer-ricochet";
          const evolvedChain = Math.max(ricochetLevel, lightningLevel) >= 3;
          const ricochetPriority = (target: Brick) => target.trait === "healer" ? 0 : target.trait === "explosive" ? 1 : target.trait === "guard" ? 2 : target.trait === "reflector" ? 3 : 4;
          const chainQueue: Array<{ source: Brick; count: number }> = [{ source: brick, count: classChainCount }];
          const chained = new Set<Brick>([brick]);
          let chainedHits = 0;
          while (chainQueue.length > 0) {
            const { source, count } = chainQueue.shift()!;
            const nextTargets = game.bricks.filter((target) => target.alive && isDamageableBrick(target) && !chained.has(target))
              .sort((a, b) => {
                if (ricochetLevel > 0 && lightningLevel <= 0) {
                  const priorityDifference = ricochetPriority(a) - ricochetPriority(b);
                  if (priorityDifference !== 0) return priorityDifference;
                }
                return Math.hypot(a.x - source.x, a.y - source.y) - Math.hypot(b.x - source.x, b.y - source.y);
              })
              .slice(0, count);
            nextTargets.forEach((target) => {
              chained.add(target);
              if (absorbGuardHit(target)) return;
              const hpBefore = target.hp;
              target.hp -= damageMultiplier(target);
              chainedHits++;
              recordSkillImpact(chainSkillId, Math.min(hpBefore, Math.max(0, hpBefore - target.hp)), target.hp <= 0);
              emitEffect("beam", source.x + source.w / 2, source.y + source.h / 2, color, 6, target.x + target.w / 2, target.y + target.h / 2, 0.4, 0, chainSkillId);
              if (target.hp <= 0) {
                destroyBrick(target, ball, false, 0);
                if (evolvedChain) chainQueue.push({ source: target, count: 1 });
              }
            });
            if (!evolvedChain) break;
          }
          if (evolvedChain && chainedHits > classChainCount) game.flashes.push({ text: `${activeSkillMap[chainSkillId]?.name} 진화 // CHAIN ×${chainedHits}`, x: brick.x + brick.w / 2, y: brick.y - 22, life: 1, color });
        }
        const shockwaveLevel = ball.skillCharges["warrior-shockwave"] ?? 0;
        const fireballLevel = ball.skillCharges["mage-fireball"] ?? 0;
        if (shockwaveLevel > 0) triggerImpactShockwave(brick, ball, shockwaveLevel);
        if (fireballLevel > 0) igniteFireballArea(brick, sourcePaddle.id, fireballLevel);
        if (brick.hp <= 0) destroyBrick(brick, ball, blastLevel > 0, blastLevel || ball.blast, true, piercingHit);
        const consumedClassSkills = (["warrior-smash", "warrior-shockwave", "warrior-execute", "warrior-crush", "archer-ricochet", "archer-focus", "archer-weakpoint", "mage-fireball", "mage-lightning"] as ClassSkillId[]).filter((id) => (ball.skillCharges[id] ?? 0) > 0);
        consumedClassSkills.forEach((id, index) => {
          if (id === "warrior-shockwave" || id === "mage-fireball") return;
          const color = classSkillColor(id);
          const impactX = brick.x + brick.w / 2;
          const impactY = brick.y + brick.h / 2;
          const blastLike = id === "warrior-shockwave";
          const lightningImpact = id === "warrior-smash" || id === "warrior-execute" || id === "warrior-crush" || id === "archer-weakpoint";
          emitEffect(lightningImpact ? "lightning" : blastLike ? "blast" : "ring", impactX, impactY, color, lightningImpact ? 74 + index * 8 : 34 + index * 9, impactX, impactY, lightningImpact ? 0.34 : 0.48, id === "archer-weakpoint" ? 1 : 0);
          if (id.startsWith("warrior-")) emitSkillEffect(id, impactX, impactY, 66 + index * 10, 0.5);
          if (id.startsWith("archer-")) emitSkillEffect(id, impactX, impactY, 58 + index * 8, 0.45, impactX + ball.vx * 0.08, impactY + ball.vy * 0.08);
          if (id.startsWith("mage-")) emitSkillEffect(id, impactX, impactY, 64 + index * 9, 0.55);
          emitBurst(impactX, impactY, color, blastLike ? 14 : 8, blastLike ? 250 : 170);
          impactFeedback(blastLike ? 5.5 : 3.2, color, blastLike ? 0.22 : 0.13, blastLike ? 0.1 : 0);
          audioRef.current?.play(id === "warrior-execute" || id === "archer-weakpoint" ? "critical" : blastLike ? "explosion" : "skill-impact", 1 + index * 0.15);
        });
        consumedClassSkills.forEach((id) => { delete ball.skillCharges[id]; });
        delete ball.payloads.glass;
        if (ball.pierce <= 0) delete ball.payloads.pierce;
        syncBallPayloadDisplay(ball, sourcePaddle.upgrades);
        break;
      }
    }

    if (lostPlayerBalls.size > 0) {
      if (botActiveRef.current) game.botMetrics.ballLosses += lostPlayerBalls.size;
      const lostBaseBall = [...lostPlayerBalls].some((ball) => ball.owner === "player" && ball.temporaryTime <= 0 && !ball.waveBonus);
      game.balls = game.balls.filter((ball) => !lostPlayerBalls.has(ball));
      if (lostBaseBall && !game.balls.some((ball) => ball.owner === "player" && ball.temporaryTime <= 0 && !ball.waveBonus)) {
        game.combo = 0;
        game.comboTimer = 0;
        Object.values(game.paddleCounters).forEach((counter) => {
          counter.combo = 0;
          counter.comboTimer = 0;
        });
        game.coreHp = Math.max(0, game.coreHp - 1);
        audioRef.current?.play("core-damage");
        impactFeedback(8, "#ff6b87", 0.32, 0.18);
        if (game.coreHp <= 0) {
          game.failed = true;
          game.failureReason = "core";
          game.flashes.push({ text: "ALL BALLS LOST // CORE DESTROYED", x: W / 2, y: H - 105, life: 1.4, color: "#ff6b87" });
          setHud(hudFromGame(game));
          finishRun();
          return;
        }
        const respawnBall = makePlayerBall(game.upgrades, game.paddleX);
        const respawnOverdrive = overdriveMultiplier(game.overdriveLevel);
        respawnBall.vx *= respawnOverdrive;
        respawnBall.vy *= respawnOverdrive;
        game.balls.push(respawnBall);
        game.flashes.push({ text: "BALL LOST // CORE -1 // RESPAWN", x: W / 2, y: H - 105, life: 1.4, color: "#ffcf4a" });
        emitEffect("ring", game.paddleX, PLAYER_PADDLE_Y, "#ffcf4a", 90, game.paddleX, PLAYER_PADDLE_Y, 0.8);
        emitBurst(game.paddleX, PLAYER_PADDLE_Y, "#ffcf4a", 18, 230);
      }
    }

    const resetBallsForWave = () => {
      game.balls = [makePlayerBall(game.upgrades, game.paddleX)];
      const ballCount = game.balls.length;
      const paddleWidth = effectivePaddleWidth(game.paddleWidth, game.upgrades);
      const spread = Math.min(paddleWidth * 0.78, Math.max(0, (ballCount - 1) * 12));
      game.balls.forEach((ball, index) => {
        clearBallEnchantments(ball, game.upgrades);
        const position = ballCount <= 1 ? 0.5 : index / (ballCount - 1);
        const launch = (position - 0.5) * 1.1;
        const speed = Math.max(300, Math.hypot(ball.vx, ball.vy));
        ball.x = game.paddleX - spread / 2 + spread * position;
        ball.y = PLAYER_PADDLE_Y - ball.radius - 3;
        ball.vx = launch * speed;
        ball.vy = -Math.sqrt(Math.max(1, speed * speed - ball.vx * ball.vx));
      });
    };
    const clearWaveScopedSkillState = () => {
      game.balls.forEach((ball) => clearBallEnchantments(ball, game.upgrades));
      Object.keys(game.paddleCounters).forEach((id) => { game.paddleCounters[id] = newPaddleCounter(); });
      game.paddleCounters.player ??= newPaddleCounter();
    };

    const startWave = (waveNumber: number) => {
      const definition = waveDefinition(waveNumber);
      const bossEnabled = true;
      game.wave = waveNumber;
      game.level = waveNumber;
      game.bossActive = definition.boss !== null && bossEnabled;
      game.bossPending = false;
      game.bossStage = definition.boss === "final" ? 2 : definition.boss === "mid" ? 1 : game.bossStage;
      game.nextBossWave = waveNumber < 10 ? 10 : 20;
      game.bricks = definition.boss && !bossEnabled
        ? makeBrickRow(0, waveNumber, 0, balanceConfigRef.current)
        : makeWaveBricks(waveNumber, balanceConfigRef.current);
      game.items = [];
      game.safetyBlocks = [];
      game.gravityWells = [];
      game.ultimateAuras = {};
      game.rowInterval = 0;
      game.rowTimer = 0;
      game.overdriveLevel = 0;
      game.bossTimeRemaining = 0;
      game.bossSkillTimer = game.bossActive ? 5 : 0;
      game.bossAttackPattern = 0;
      game.bossMultiballsRemaining = game.bossActive ? BOSS_MULTIBALL_BUDGET : 0;
      game.waveResolution = null;
      clearWaveScopedSkillState();
      resetBallsForWave();
      if (game.autoGuard) game.paddleBarriers.player = Math.max(1, game.paddleBarriers.player ?? 0);
      game.flashes.push({ text: `WAVE ${waveNumber} // ${definition.name}`, x: W / 2, y: H / 2, life: 1.8, color: game.bossActive ? "#ff6b87" : "#ffcf4a" });
      if (game.bossActive) {
        audioRef.current?.play("boss", game.bossStage);
        impactFeedback(9, "#ff6b87", 0.42, 0.22);
      }
    };

    const completeWave = (cleared: boolean, coreDamage = 0, blocked = 0, survivors = 0, wasBossOverride?: boolean) => {
      const completedWave = game.wave;
      const wasBoss = wasBossOverride ?? game.bossActive;
      const completedWaveName = waveDefinition(completedWave).name;
      const completedWaveElapsed = game.rowTimer;
      const bonus = cleared ? 1200 + completedWave * 180 : 0;
      game.score += bonus;
      game.bossActive = false;
      clearWaveScopedSkillState();
      if (cleared) {
        game.flashes.push({ text: `WAVE ${completedWave} CLEAR // +${bonus.toLocaleString()}`, x: W / 2, y: H / 2, life: 1.5, color: "#ffcf4a" });
      }
      if (completedWave >= MAX_WAVE) {
        game.flashes.push({ text: cleared ? "FINAL CORE DESTROYED" : "FINAL WAVE SURVIVED", x: W / 2, y: H / 2 + 38, life: 2, color: "#72f1b8" });
        if (botActiveRef.current) {
          finishRun();
          return;
        }
        runningRef.current = false;
        setSettlement({ wave: completedWave, waveName: completedWaveName, cleared, wasBoss, survivors, coreDamage, blocked, coreHp: game.coreHp, elapsed: completedWaveElapsed, finalWave: true });
        setHud(hudFromGame(game));
        setMode("settlement");
        return;
      }
      startWave(completedWave + 1);
      if (wasBoss && cleared) {
        audioRef.current?.play("boss-clear", game.bossStage);
        impactFeedback(11, "#ffcf4a", 0.48, 0.24);
        if (botActiveRef.current) {
          if (!botSkillBenchActiveRef.current || skillBenchConfigRef.current.environment === "ecosystem") applyBossReward(botPolicyRef.current === "survival" ? "mage-elemental-storm" : "archer-arrow-rain");
          setHud(hudFromGame(game));
          return;
        }
      }
      if (botActiveRef.current) {
        levelUp();
        return;
      }
      runningRef.current = false;
      levelUpRef.current = false;
      setSettlement({ wave: completedWave, waveName: completedWaveName, cleared, wasBoss, survivors, coreDamage, blocked, coreHp: game.coreHp, elapsed: completedWaveElapsed, finalWave: false });
      setHud(hudFromGame(game));
      setMode("settlement");
    };

    if (game.waveResolution) {
      game.waveResolution.timer -= dt;
      if (game.waveResolution.timer > 0) return;
      const resolution = game.waveResolution;
      game.waveResolution = null;
      const barrier = game.paddleBarriers.player ?? 0;
      game.paddleBarriers.player = Math.max(0, barrier - resolution.blocked);
      if (resolution.coreDamage > 0) {
        game.coreHp = Math.max(0, game.coreHp - resolution.coreDamage);
        audioRef.current?.play("core-damage", resolution.coreDamage);
        impactFeedback(11 + resolution.coreDamage, "#ff3f6c", 0.5, 0.28);
        game.flashes.push({ text: `CORE DAMAGE // -${resolution.coreDamage}`, x: W / 2, y: PLAYER_LINE_Y - 42, life: 1.2, color: "#ff3f6c" });
      } else {
        game.flashes.push({ text: "CORE SAFE // DAMAGE 0", x: W / 2, y: PLAYER_LINE_Y - 42, life: 1.1, color: "#72f1b8" });
      }
      setHud(hudFromGame(game));
      if (game.coreHp <= 0) {
        game.failed = true;
        game.failureReason = "core";
        finishRun();
        return;
      }
      completeWave(resolution.cleared, resolution.coreDamage, resolution.blocked, resolution.survivors, resolution.wasBoss);
      return;
    }

    const waveCleared = game.bossActive
      ? !game.bricks.some((brick) => brick.alive && (brick.kind === "boss-core" || brick.kind === "boss-armor"))
      : game.bricks.every((brick) => !brick.alive || brick.trait === "indestructible");
    if (waveCleared) {
      const wasBoss = game.bossActive;
      game.bossActive = false;
      game.items = [];
      game.waveResolution = { timer: 0.9, maxTimer: 0.9, cleared: true, wasBoss, survivors: 0, coreDamage: 0, blocked: 0 };
      emitEffect("ring", W / 2, PLAYER_LINE_Y, "#72f1b8", 220, W / 2, PLAYER_LINE_Y, 0.85);
      game.flashes.push({ text: "BLOCK SETTLEMENT // THREAT 0", x: W / 2, y: H / 2, life: 1.1, color: "#72f1b8" });
      return;
    }

    game.botMetrics.maxBalls = Math.max(game.botMetrics.maxBalls, game.balls.filter((ball) => ball.owner === "player").length);
    if (botActiveRef.current) {
      recordBotWaveSample(game);
      const now = performance.now();
      if (now - botLivePersistRef.current >= 500) {
        botLivePersistRef.current = now;
        localStorage.setItem(BOT_LIVE_STORAGE_KEY, JSON.stringify({ id: "live", wave: game.wave, balanceConfig: balanceConfigRef.current, benchmarkConfig: benchmarkMode ? benchmarkConfigRef.current : null, waveSamples: game.botWaveSamples }));
      }
    }

    setHud(hudFromGame(game));
  }, [applyBossReward, benchmarkMode, finishRun, levelUp]);

  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas || !game) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const shakeRatio = game.shakeDuration > 0 ? Math.min(1, game.shakeTime / game.shakeDuration) : 0;
    const shakeAmplitude = game.shakeStrength * shakeRatio * shakeRatio;
    const shakeX = Math.sin(game.elapsed * 97) * shakeAmplitude;
    const shakeY = Math.cos(game.elapsed * 131) * shakeAmplitude * 0.72;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#10162f");
    bg.addColorStop(0.65, "#080d1e");
    bg.addColorStop(1, "#050812");
    ctx.fillStyle = bg;
    ctx.fillRect(-18, -18, W + 36, H + 36);

    ctx.strokeStyle = "rgba(92, 214, 255, .07)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 45) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 45) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    game.bricks.forEach((brick) => {
      if (!brick.alive) return;
      const alpha = 0.42 + (brick.hp / brick.maxHp) * 0.5;
      ctx.shadowBlur = 12;
      const brickColor = brick.kind === "boss-core" ? "#ff4f78"
        : brick.kind === "boss-armor" ? "#587cff"
        : brick.kind === "boss-minion" ? "#ff9658"
        : brick.trait === "guard" ? "#fff27a"
        : brick.trait === "explosive" ? "#ff8a3d"
        : brick.trait === "indestructible" ? "#8d96a8"
        : brick.trait === "healer" ? "#72f1b8"
        : brick.trait === "reflector" ? "#65dcff"
        : `hsl(${brick.hue} 95% 65%)`;
      ctx.shadowColor = brickColor;
      ctx.fillStyle = brick.kind === "normal"
        ? brick.trait === "guard" ? `rgba(135,115,25,${alpha})`
        : brick.trait === "explosive" ? `rgba(174,61,20,${alpha})`
        : brick.trait === "indestructible" ? "rgba(55,62,76,.98)"
        : brick.trait === "healer" ? `rgba(30,122,91,${alpha})`
        : brick.trait === "reflector" ? `rgba(22,102,145,${alpha})`
        : `hsla(${brick.hue}, 90%, ${brick.maxHp === 3 ? 64 : 58}%, ${alpha})`
        : brickColor;
      ctx.globalAlpha = brick.kind === "normal" ? 1 : alpha;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,.28)";
      ctx.fillRect(brick.x + 3, brick.y + 3, brick.w - 6, 2);
      if (brick.kind === "normal" && brick.trait !== "standard") {
        const traitData = BRICK_TRAIT_DATA[brick.trait];
        const traitPulse = 0.72 + Math.sin(game.elapsed * 6 + brick.x * 0.04) * 0.18;
        ctx.save();
        ctx.strokeStyle = brick.trait === "guard" && !brick.guardReady ? "rgba(255,242,122,.32)" : traitData.color;
        ctx.lineWidth = brick.trait === "indestructible" ? 3 : brick.trait === "guard" && brick.guardReady ? 3 : 2;
        if (brick.trait === "explosive") ctx.setLineDash([5, 3]);
        ctx.strokeRect(brick.x + 1.5, brick.y + 1.5, brick.w - 3, brick.h - 3);
        ctx.setLineDash([]);
        if (brick.trait === "indestructible") {
          ctx.strokeStyle = "rgba(190,199,216,.42)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(brick.x + 8, brick.y + brick.h - 4);
          ctx.lineTo(brick.x + brick.w - 8, brick.y + 4);
          ctx.moveTo(brick.x + 20, brick.y + brick.h - 4);
          ctx.lineTo(brick.x + brick.w - 2, brick.y + 3);
          ctx.stroke();
        }
        if (brick.trait === "healer") {
          ctx.globalAlpha = traitPulse;
          ctx.shadowColor = traitData.color;
          ctx.shadowBlur = 12;
          ctx.strokeStyle = traitData.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(brick.x + brick.w / 2, brick.y + brick.h / 2, 8 + traitPulse * 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        }
        if (brick.trait === "reflector" && brick.traitLockTime <= 0) {
          const reflectorShieldPulse = 0.55 + (Math.sin(game.elapsed * 7 + brick.x * 0.03) + 1) * 0.2;
          const reflectorThreatened = game.balls.some((ball) => ball.vy < 0 && ball.y > brick.y + brick.h && ball.y < brick.y + brick.h + 75 && ball.x > brick.x - 8 && ball.x < brick.x + brick.w + 8);
          const reflectorLineY = brick.y + brick.h + 4;
          const reflectorScan = (game.elapsed * 0.85 + brick.x / W) % 1;
          const reflectorAlpha = Math.min(1, reflectorShieldPulse + (reflectorThreatened ? 0.28 : 0));
          ctx.save();
          ctx.shadowColor = "#65dcff";
          ctx.shadowBlur = 10 + reflectorAlpha * 12;
          ctx.strokeStyle = `rgba(101,220,255,${0.2 + reflectorAlpha * 0.28})`;
          ctx.lineWidth = 8;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(brick.x + 2, brick.y + brick.h - 1);
          ctx.quadraticCurveTo(brick.x + 4, reflectorLineY, brick.x + 9, reflectorLineY);
          ctx.lineTo(brick.x + brick.w - 9, reflectorLineY);
          ctx.quadraticCurveTo(brick.x + brick.w - 4, reflectorLineY, brick.x + brick.w - 2, brick.y + brick.h - 1);
          ctx.stroke();
          const reflectorShieldGradient = ctx.createLinearGradient(brick.x, reflectorLineY, brick.x + brick.w, reflectorLineY);
          reflectorShieldGradient.addColorStop(0, "#1a8fb3");
          reflectorShieldGradient.addColorStop(0.35, "#65dcff");
          reflectorShieldGradient.addColorStop(0.5, "#e8fcff");
          reflectorShieldGradient.addColorStop(0.65, "#65dcff");
          reflectorShieldGradient.addColorStop(1, "#1a8fb3");
          ctx.strokeStyle = reflectorShieldGradient;
          ctx.lineWidth = reflectorThreatened ? 4 : 3;
          ctx.shadowBlur = reflectorThreatened ? 24 : 13;
          ctx.beginPath();
          ctx.moveTo(brick.x + 2, brick.y + brick.h - 1);
          ctx.quadraticCurveTo(brick.x + 4, reflectorLineY, brick.x + 9, reflectorLineY);
          ctx.lineTo(brick.x + brick.w - 9, reflectorLineY);
          ctx.quadraticCurveTo(brick.x + brick.w - 4, reflectorLineY, brick.x + brick.w - 2, brick.y + brick.h - 1);
          ctx.stroke();
          const glintX = brick.x + 9 + (brick.w - 18) * reflectorScan;
          ctx.strokeStyle = "rgba(255,255,255,.95)";
          ctx.lineWidth = reflectorThreatened ? 6 : 4;
          ctx.beginPath();
          ctx.moveTo(glintX - 4, reflectorLineY);
          ctx.lineTo(glintX + 4, reflectorLineY);
          ctx.stroke();
          ctx.restore();
        }
        const badgeWidth = 18;
        ctx.globalAlpha = brick.trait === "guard" && !brick.guardReady ? 0.5 : 1;
        ctx.shadowColor = traitData.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = "rgba(5,8,18,.96)";
        ctx.fillRect(brick.x + 3, brick.y - 6, badgeWidth, 13);
        ctx.strokeStyle = traitData.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(brick.x + 3, brick.y - 6, badgeWidth, 13);
        ctx.shadowBlur = 0;
        ctx.fillStyle = traitData.color;
        ctx.font = "900 10px 'Noto Sans KR', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(brick.trait === "guard" && !brick.guardReady ? "소" : traitData.glyph, brick.x + 3 + badgeWidth / 2, brick.y + 4);
        ctx.restore();
      }
      if (brick.drop) {
        const dropData = ITEM_DATA[brick.drop];
        ctx.shadowBlur = brick.drop === "multiball" ? 16 : 8;
        ctx.shadowColor = dropData.color;
        ctx.strokeStyle = dropData.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(brick.x + 1, brick.y + 1, brick.w - 2, brick.h - 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = dropData.color;
        ctx.font = "900 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(dropData.symbol, brick.x + 11, brick.y + 17);
      }
      if (brick.poisonTime > 0) {
        ctx.fillStyle = "rgba(114,241,184,.16)";
        ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4);
        ctx.strokeStyle = "#72f1b8";
        ctx.lineWidth = 2;
        ctx.strokeRect(brick.x + 3, brick.y + 3, brick.w - 6, brick.h - 6);
        ctx.fillStyle = "#72f1b8";
        for (let dot = 0; dot < 3; dot++) {
          ctx.beginPath();
          ctx.arc(brick.x + brick.w - 7 - dot * 6, brick.y + 7 + Math.sin(game.elapsed * 5 + dot) * 2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (brick.burnTime > 0) {
        ctx.save();
        const pulse = 0.65 + Math.sin(game.elapsed * 11 + brick.x * 0.03) * 0.2;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "rgba(255,112,67,.2)";
        ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4);
        ctx.strokeStyle = "#ff8a3d";
        ctx.shadowColor = "#ff5a36";
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2;
        ctx.strokeRect(brick.x - 1, brick.y - 1, brick.w + 2, brick.h + 2);
        ctx.fillStyle = "#ffd166";
        for (let flame = 0; flame < Math.min(4, 1 + brick.burnLevel); flame++) {
          const flameX = brick.x + brick.w - 8 - flame * 8;
          const flameY = brick.y + 8 + Math.sin(game.elapsed * 9 + flame) * 2;
          ctx.beginPath();
          ctx.moveTo(flameX, flameY - 6);
          ctx.lineTo(flameX - 3, flameY + 3);
          ctx.lineTo(flameX + 3, flameY + 3);
          ctx.closePath();
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff3d6";
        ctx.font = "900 8px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`BURN ${Math.max(0, Math.ceil(brick.burnTime))}s`, brick.x + 5, brick.y + brick.h - 5);
        ctx.restore();
      }
      if (brick.blastVulnerability > 1) {
        ctx.save();
        ctx.globalAlpha = 0.7 + Math.sin(game.elapsed * 8) * 0.2;
        ctx.strokeStyle = "#ff6b87";
        ctx.shadowColor = "#ff6b87";
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(brick.x - 2, brick.y - 2, brick.w + 4, brick.h + 4);
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(4,8,20,.86)";
        ctx.fillRect(brick.x + brick.w / 2 - 24, brick.y - 9, 48, 10);
        ctx.fillStyle = "#ff8ca3";
        ctx.font = "900 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`EXP ×${brick.blastVulnerability}`, brick.x + brick.w / 2, brick.y - 1);
        ctx.restore();
      }
      if (brick.frostVulnerability > 0) {
        ctx.save();
        ctx.globalAlpha = 0.72 + Math.sin(game.elapsed * 7 + brick.x * 0.02) * 0.18;
        ctx.fillStyle = "rgba(101,220,255,.18)";
        ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4);
        ctx.strokeStyle = "#b9f4ff";
        ctx.shadowColor = "#65dcff";
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.strokeRect(brick.x - 2, brick.y - 2, brick.w + 4, brick.h + 4);
        ctx.fillStyle = "#e8fcff";
        ctx.font = "900 10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`❄+${brick.frostVulnerability}`, brick.x + 5, brick.y + 12);
        ctx.restore();
      }
      if (brick.traitLockTime > 0) {
        ctx.save();
        const lockPulse = 0.72 + Math.sin(game.elapsed * 9 + brick.x * 0.025) * 0.18;
        ctx.globalAlpha = lockPulse;
        ctx.strokeStyle = classSkillColor("mage-mana-blast");
        ctx.shadowColor = classSkillColor("mage-mana-blast");
        ctx.shadowBlur = 14;
        ctx.lineWidth = 3;
        ctx.setLineDash([7, 4]);
        ctx.strokeRect(brick.x - 4, brick.y - 4, brick.w + 8, brick.h + 8);
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(7,4,18,.9)";
        ctx.fillRect(brick.x + brick.w / 2 - 26, brick.y + brick.h - 12, 52, 12);
        ctx.fillStyle = "#e4b7ff";
        ctx.font = "900 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`LOCK ${Math.ceil(brick.traitLockTime)}s`, brick.x + brick.w / 2, brick.y + brick.h - 3);
        ctx.restore();
      }
      if (brick.lastHitPaddleId) {
        ctx.strokeStyle = "#c18cff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(brick.x + 5, brick.y + brick.h - 4);
        ctx.lineTo(brick.x + brick.w * 0.35, brick.y + 5);
        ctx.moveTo(brick.x + brick.w * 0.55, brick.y + brick.h - 4);
        ctx.lineTo(brick.x + brick.w - 5, brick.y + 5);
        ctx.stroke();
      }
      if (brick.kind === "boss-core") {
        ctx.textAlign = "center";
        ctx.strokeStyle = "rgba(4,8,20,.95)";
        ctx.lineWidth = 5;
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 18px monospace";
        ctx.strokeText("BOSS CORE", brick.x + brick.w / 2, brick.y + brick.h / 2 - 13);
        ctx.fillText("BOSS CORE", brick.x + brick.w / 2, brick.y + brick.h / 2 - 13);
        ctx.font = "900 44px monospace";
        const bossHpText = String(Math.max(0, Math.ceil(brick.hp)));
        ctx.strokeText(bossHpText, brick.x + brick.w / 2, brick.y + brick.h / 2 + 30);
        ctx.fillText(bossHpText, brick.x + brick.w / 2, brick.y + brick.h / 2 + 30);
      } else if (brick.trait !== "indestructible") {
        const hpText = String(Math.max(0, Math.ceil(brick.hp)));
        ctx.strokeStyle = "rgba(4,8,20,.95)";
        ctx.lineWidth = 4;
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 18px monospace";
        ctx.textAlign = "center";
        const hpBaselineY = brick.y + brick.h / 2 + 6;
        ctx.strokeText(hpText, brick.x + brick.w / 2, hpBaselineY);
        ctx.fillText(hpText, brick.x + brick.w / 2, hpBaselineY);
      }
    });

    const barrierEntries = [
      { label: "P", count: game.paddleBarriers.player ?? 0 },
      ...activeGhostsRef.current.map((_, index) => ({ label: `G${index + 1}`, count: game.paddleBarriers[`ghost-${index}`] ?? 0 })),
    ].filter((entry) => entry.count > 0);
    const barrierSummary = barrierEntries.map((entry) => `${entry.label}×${entry.count}`).join(" ");
    const lineColor = barrierEntries.length > 0 ? BARRIER_COLOR : game.coreHp <= 3 ? "#ff6b87" : "rgba(255,107,135,.62)";
    ctx.strokeStyle = lineColor;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = barrierEntries.length > 0 ? 20 : 0;
    ctx.lineWidth = barrierEntries.length > 0 ? 5 : 1;
    ctx.setLineDash(barrierEntries.length > 0 ? [] : [7, 8]);
    ctx.beginPath();
    ctx.moveTo(22, PLAYER_LINE_Y);
    ctx.lineTo(W - 22, PLAYER_LINE_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.fillStyle = lineColor;
    ctx.font = "900 11px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`CORE LINE // HP ${game.coreHp}/${game.maxCoreHp}${barrierSummary ? ` // BARRIER ${barrierSummary}` : ""} // W${game.wave}`, 24, PLAYER_LINE_Y - 8);

    game.gravityWells.forEach((well) => {
      const pulse = 0.78 + Math.sin(game.elapsed * 8) * 0.12;
      ctx.save();
      ctx.globalAlpha = Math.min(1, well.life / 0.45);
      ctx.translate(well.x, well.y);
      ctx.rotate(game.elapsed * 1.6);
      const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, well.radius);
      gradient.addColorStop(0, "rgba(5,7,18,.98)");
      gradient.addColorStop(0.2, "rgba(193,140,255,.42)");
      gradient.addColorStop(1, "rgba(193,140,255,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, well.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = well.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 14]);
      ctx.beginPath();
      ctx.arc(0, 0, well.radius * 0.58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ecf2ff";
      ctx.font = "900 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`GRAVITY ${well.life.toFixed(1)}s`, 0, -well.radius * 0.62);
      ctx.restore();
    });

    game.safetyBlocks.forEach((block) => {
      ctx.save();
      ctx.shadowColor = block.color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = block.color;
      ctx.fillRect(block.x - block.width / 2, block.y, block.width, 7);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#07101b";
      ctx.font = "900 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("AUTO REFLECT", block.x, block.y + 6);
      ctx.restore();
    });

    if (game.bossActive) {
      const bossCore = game.bricks.find((brick) => brick.alive && brick.kind === "boss-core");
      ctx.fillStyle = "#ff6b87";
      ctx.font = "900 18px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`CORE FORTRESS ${game.bossStage} // HP ${Math.max(0, Math.ceil(bossCore?.hp ?? 0))}`, W / 2, 58);
    }

    const emergencyDanger = game.bricks.some((brick) => brick.alive && brick.y + brick.h >= PLAYER_LINE_Y - BRICK_ROW_STEP * 2);
    const drawMagnetLinks = (x: number, y: number, width: number, upgrades: UpgradeId[]) => {
      const rangeBonus = Math.max(skillValue("magnet", upgradeLevel(upgrades, "magnet")), skillValue("common-magnet", upgradeLevel(upgrades, "common-magnet")));
      if (rangeBonus <= 0) return;
      const range = width / 2 + rangeBonus;
      ctx.save();
      ctx.strokeStyle = classSkillColor("common-magnet");
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      game.items.forEach((item) => {
        if (item.y > y + 12 || item.y < y - range || Math.abs(item.x - x) > range) return;
        ctx.globalAlpha = 0.18 + 0.28 * (1 - Math.min(1, Math.abs(item.y - y) / range));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo((x + item.x) / 2, item.y + 24, item.x, item.y);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();
    };
    drawMagnetLinks(game.paddleX, PLAYER_PADDLE_Y, game.paddleWidth, game.upgrades);
    activeGhostsRef.current.forEach((ghost, index) => drawMagnetLinks(game.ghostPaddles[index], ghostPaddleY(), ghostPaddleWidth(ghost), ghost.upgrades));
    const countedProgress = (id: UpgradeId, level: number, counter: PaddleCounter) => {
      const goal = Math.max(1, Math.round(skillValue(id, level)));
      const rawCurrent = counter.skillReflections?.[id as ClassSkillId] ?? 0;
      return { current: Math.max(0, Math.min(goal, Math.floor(rawCurrent))), goal };
    };
    const countedEntriesFor = (ownerId: string, upgrades: UpgradeId[]) => {
      const counter = game.paddleCounters[ownerId] ?? newPaddleCounter();
      return COUNTED_SKILL_IDS
        .map((id) => ({ id, level: upgradeLevel(upgrades, id) }))
        .filter(({ level }) => level > 0)
        .map(({ id, level }) => ({ id, ...countedProgress(id, level, counter) }));
    };
    const drawCounterRail = (x: number, y: number, ownerId: string, upgrades: UpgradeId[], alpha = 1) => {
      const entries = countedEntriesFor(ownerId, upgrades);
      if (entries.length === 0) return;
      const cellWidth = 48;
      const cellHeight = 24;
      const perRow = Math.min(10, entries.length);
      const rows = Math.ceil(entries.length / perRow);
      const railWidth = perRow * cellWidth + 8;
      const railHeight = rows * cellHeight + 6;
      const railY = y - railHeight;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "rgba(4,8,20,.9)";
      ctx.fillRect(x - railWidth / 2, railY, railWidth, railHeight);
      ctx.strokeStyle = "rgba(185,205,235,.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - railWidth / 2, railY, railWidth, railHeight);
      entries.forEach((entry, index) => {
        const row = Math.floor(index / perRow);
        const col = index % perRow;
        const rowCount = Math.min(perRow, entries.length - row * perRow);
        const rowWidth = rowCount * cellWidth;
        const left = x - rowWidth / 2 + col * cellWidth;
        const top = railY + 3 + row * cellHeight;
        const ratio = entry.current / entry.goal;
        const config = activeSkillMap[entry.id];
        const color = config?.color ?? "#ffffff";
        if (ratio >= 0.8) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 14 + Math.sin(game.elapsed * 9) * 4;
        }
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha * 0.16;
        ctx.fillRect(left + 2, top, cellWidth - 4, cellHeight - 4);
        ctx.globalAlpha = alpha;
        ctx.fillRect(left + 2, top + cellHeight - 7, (cellWidth - 4) * ratio, 4);
        ctx.shadowBlur = 0;
        ctx.fillStyle = color;
        ctx.font = "900 13px \"Arial Unicode MS\",sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(SKILL_ICONS[entry.id] ?? "•", left + 6, top + 9);
        ctx.fillStyle = ratio >= 0.8 ? "#ffffff" : "#d4deed";
        ctx.font = "900 11px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${entry.current}/${entry.goal}`, left + cellWidth - 5, top + 9);
      });
      ctx.restore();
    };
    const paddleChargeVisual = (ownerId: string, upgrades: UpgradeId[]) => {
      const counter = game.paddleCounters[ownerId] ?? newPaddleCounter();
      if ((counter.chargePulse ?? 0) > 0) return { color: counter.chargeColor ?? PLAYER_BALL_COLOR, intensity: 1, pulse: counter.chargePulse / 1.2 };
      const nearest = countedEntriesFor(ownerId, upgrades)
        .map((entry) => ({ ...entry, ratio: entry.current / entry.goal }))
        .sort((a, b) => b.ratio - a.ratio)[0];
      if (!nearest || nearest.ratio < 0.75) return null;
      return { color: activeSkillMap[nearest.id]?.color ?? PLAYER_BALL_COLOR, intensity: nearest.ratio, pulse: 0 };
    };
    const drawPaddleChargeAura = (x: number, y: number, width: number, visual: ReturnType<typeof paddleChargeVisual>, alpha = 1) => {
      if (!visual) return;
      const beat = 0.65 + Math.sin(game.elapsed * (visual.pulse > 0 ? 15 : 8)) * 0.25;
      ctx.save();
      ctx.globalAlpha = alpha * (0.45 + visual.intensity * 0.45) * beat;
      ctx.strokeStyle = visual.color;
      ctx.shadowColor = visual.color;
      ctx.shadowBlur = 18 + visual.intensity * 18;
      ctx.lineWidth = visual.pulse > 0 ? 5 : 3;
      ctx.strokeRect(x - width / 2 - 6, y - 6, width + 12, 28);
      ctx.fillStyle = visual.color;
      ctx.fillRect(x - width / 2, y, width * Math.max(0.2, visual.intensity), 4);
      ctx.restore();
    };
    const drawSkillPanel = (x: number, y: number, width: number, upgrades: UpgradeId[], ownerColor: string, alpha = 1) => {
      const owned = [...upgradeCatalogRef.current, ...DEFAULT_ULTIMATE_UPGRADES]
        .map((upgrade) => ({ ...upgrade, level: upgradeLevel(upgrades, upgrade.id) }))
        .filter((upgrade) => upgrade.level > 0);
      const rows = owned.length > 10 ? 2 : 1;
      const perRow = Math.max(1, Math.ceil(owned.length / rows));
      const rowHeight = 11;
      const panelHeight = rows * rowHeight + 4;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = ownerColor;
      ctx.shadowBlur = 14;
      ctx.fillStyle = "rgba(4,8,20,.92)";
      ctx.fillRect(x - width / 2, y, width, panelHeight);
      ctx.strokeStyle = ownerColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - width / 2, y, width, panelHeight);
      ctx.shadowBlur = 0;
      if (owned.length === 0) {
        ctx.fillStyle = ownerColor;
        ctx.fillRect(x - width / 2 + 5, y + 4, width - 10, 3);
      } else {
        const slot = Math.min(20, (width - 8) / perRow);
        owned.forEach((upgrade, index) => {
          const row = Math.floor(index / perRow);
          const col = index % perRow;
          const rowCount = Math.min(perRow, owned.length - row * perRow);
          const rowWidth = rowCount * slot;
          const iconX = x - rowWidth / 2 + col * slot;
          const iconY = y + 2 + row * rowHeight;
          const iconSize = Math.max(7, Math.min(10, slot - 2));
          const centerX = iconX + slot / 2;
          const centerY = iconY + iconSize / 2;
          ctx.globalAlpha = alpha * 0.9;
          ctx.fillStyle = upgrade.color;
          ctx.beginPath();
          ctx.roundRect(centerX - iconSize / 2, iconY, iconSize, iconSize, 2);
          ctx.fill();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = "#07101b";
          ctx.font = `900 ${iconSize < 9 ? 6 : 7}px "Arial Unicode MS",sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(SKILL_ICONS[upgrade.id] ?? "•", centerX, centerY + 0.5);
          if (upgrade.level > 1 && slot >= 12) {
            ctx.fillStyle = "#ecf2ff";
            ctx.font = "900 5px monospace";
            ctx.textAlign = "right";
            ctx.fillText(String(upgrade.level), centerX + iconSize / 2 + 2, centerY + 3);
          }
        });
      }
      ctx.restore();
    };
    activeGhostsRef.current.forEach((ghost, index) => {
      const x = game.ghostPaddles[index];
      const y = ghostPaddleY();
      const width = Math.min(280, ghostPaddleWidth(ghost) + (emergencyDanger ? skillValue("emergency-wide", upgradeLevel(ghost.upgrades, "emergency-wide")) : 0));
      const color = GHOST_COLORS[index % GHOST_COLORS.length];
      drawCounterRail(x, y, `ghost-${index}`, ghost.upgrades, 0.74);
      const chargeVisual = paddleChargeVisual(`ghost-${index}`, ghost.upgrades);
      drawSkillPanel(x, y, width, ghost.upgrades, chargeVisual?.color ?? color, 0.74);
      drawPaddleChargeAura(x, y, width, chargeVisual, 0.74);
      ctx.fillStyle = color;
      ctx.font = "800 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(ghost.name, x, y + 24);
    });

    const playerDrawWidth = Math.min(280, game.paddleWidth + skillValue("common-wide", upgradeLevel(game.upgrades, "common-wide")) + (emergencyDanger ? skillValue("emergency-wide", upgradeLevel(game.upgrades, "emergency-wide")) : 0));
    const playerChargeVisual = paddleChargeVisual("player", game.upgrades);
    drawCounterRail(W / 2, H - 6, "player", game.upgrades);
    drawSkillPanel(game.paddleX, PLAYER_PADDLE_Y, playerDrawWidth, game.upgrades, playerChargeVisual?.color ?? PLAYER_BALL_COLOR);
    drawPaddleChargeAura(game.paddleX, PLAYER_PADDLE_Y, playerDrawWidth, playerChargeVisual);
    game.balls.filter((ball) => ball.owner === "player").forEach((ball) => {
      const drawColor = ballBodyColor(ball);
      const speed = Math.max(1, Math.hypot(ball.vx, ball.vy));
      const powerBoost = Math.max(0, ball.attackPower - 1);
      const visualRadius = ball.radius + Math.min(3.5, powerBoost * 0.7);
      const trailSteps = 4 + Math.min(5, Math.floor(powerBoost));
      for (let trail = trailSteps; trail >= 1; trail--) {
        ctx.globalAlpha = 0.035 + ((trailSteps + 1 - trail) / trailSteps) * 0.15;
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.arc(ball.x - (ball.vx / speed) * trail * (7 + powerBoost), ball.y - (ball.vy / speed) * trail * (7 + powerBoost), Math.max(2, visualRadius - trail * 1.05), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 24;
      ctx.shadowColor = drawColor;
      ctx.fillStyle = drawColor;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, visualRadius, 0, Math.PI * 2);
      ctx.fill();
      const powerRingCount = Math.min(3, Math.floor(powerBoost / 1.25));
      for (let ring = 0; ring < powerRingCount; ring++) {
        ctx.globalAlpha = 0.48 - ring * 0.1;
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = 1.5 + powerBoost * 0.25;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, visualRadius + 3 + ring * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      const activeClassCharges = Object.entries(ball.skillCharges).filter(([, level]) => (level ?? 0) > 0) as Array<[ClassSkillId, number]>;
      if (ball.visualSkill && !activeClassCharges.some(([id]) => id === ball.visualSkill)) activeClassCharges.push([ball.visualSkill, 1]);
      activeClassCharges.slice(0, 4).forEach(([id, level], index) => {
        const mageSpellVariant = id === "mage-fireball" ? 0 : id === "mage-lightning" ? 1 : -1;
        const mageSpellImage = mageSpellVariant >= 0 ? mageSpellRefs.current[mageSpellVariant] : null;
        if (mageSpellVariant >= 0 && mageSpellReadyRef.current[mageSpellVariant] && mageSpellImage) {
          const frame = Math.floor(game.elapsed * 14 + index) % MAGE_SPELL_FRAMES;
          const spriteSize = (id === "mage-fireball" ? 42 : 36) + (level ?? 1) * 3;
          ctx.save();
          ctx.translate(ball.x, ball.y);
          if (id === "mage-fireball") ctx.rotate(Math.atan2(ball.vy, ball.vx));
          ctx.globalAlpha = 0.92;
          ctx.imageSmoothingEnabled = false;
          ctx.shadowBlur = 16;
          ctx.shadowColor = classSkillColor(id);
          ctx.drawImage(
            mageSpellImage,
            frame * MAGE_SPELL_FRAME_SIZE,
            0,
            MAGE_SPELL_FRAME_SIZE,
            MAGE_SPELL_FRAME_SIZE,
            -spriteSize / 2,
            -spriteSize / 2,
            spriteSize,
            spriteSize,
          );
          ctx.restore();
          return;
        }
        const effectColor = classSkillColor(id);
        const classCategory = activeSkillMap[id]?.category;
        ctx.save();
        ctx.globalAlpha = 0.78;
        ctx.shadowBlur = 12;
        ctx.shadowColor = effectColor;
        ctx.strokeStyle = effectColor;
        ctx.fillStyle = effectColor;
        if (classCategory === "warrior") {
          ctx.translate(ball.x, ball.y);
          ctx.lineWidth = 2.5 + (level ?? 1) * 0.5;
          if (id === "warrior-smash") {
            ctx.rotate(-0.4);
            ctx.beginPath();
            ctx.moveTo(-visualRadius - 7, -visualRadius - 4);
            ctx.lineTo(visualRadius + 7, visualRadius + 4);
            ctx.stroke();
          } else if (id === "warrior-shockwave") {
            for (let wave = 0; wave < 2; wave++) {
              const pulse = (game.elapsed * 2.8 + wave * 0.5) % 1;
              ctx.globalAlpha = 0.8 * (1 - pulse);
              ctx.beginPath();
              ctx.arc(0, 0, visualRadius + 3 + pulse * (10 + wave * 4), 0, Math.PI * 2);
              ctx.stroke();
            }
          } else if (id === "warrior-execute") {
            const pulse = 1 + Math.sin(game.elapsed * 9) * 0.18;
            ctx.scale(pulse, pulse);
            ctx.beginPath();
            ctx.moveTo(0, -visualRadius - 11);
            ctx.lineTo(0, visualRadius + 8);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-5, visualRadius + 3);
            ctx.lineTo(0, visualRadius + 9);
            ctx.lineTo(5, visualRadius + 3);
            ctx.stroke();
          } else if (id === "warrior-crush") {
            ctx.rotate(game.elapsed * 2.8);
            for (let shard = 0; shard < 4; shard++) {
              ctx.rotate(Math.PI / 2);
              ctx.save();
              ctx.translate(visualRadius + 7, 0);
              ctx.rotate(Math.PI / 4);
              ctx.fillRect(-3.5, -3.5, 7, 7);
              ctx.restore();
            }
          }
        } else if (classCategory === "archer") {
          ctx.translate(ball.x, ball.y);
          ctx.rotate(Math.atan2(ball.vy, ball.vx));
          ctx.lineWidth = 2.5;
          if (id === "archer-pierce") {
            ctx.beginPath();
            ctx.moveTo(-visualRadius - 10, 0);
            ctx.lineTo(visualRadius + 13, 0);
            ctx.lineTo(visualRadius + 5, -6);
            ctx.moveTo(visualRadius + 13, 0);
            ctx.lineTo(visualRadius + 5, 6);
            ctx.stroke();
          } else if (id === "archer-ricochet") {
            ctx.beginPath();
            ctx.moveTo(-visualRadius - 13, 7);
            ctx.lineTo(-visualRadius - 5, -6);
            ctx.lineTo(visualRadius + 4, 5);
            ctx.lineTo(visualRadius + 12, -5);
            ctx.stroke();
          } else if (id === "archer-focus") {
            ctx.rotate(-Math.atan2(ball.vy, ball.vx));
            const reticle = visualRadius + 7 + Math.sin(game.elapsed * 6) * 2;
            ctx.beginPath();
            ctx.arc(0, 0, reticle, 0.2, Math.PI / 2 - 0.2);
            ctx.arc(0, 0, reticle, Math.PI / 2 + 0.2, Math.PI - 0.2);
            ctx.arc(0, 0, reticle, Math.PI + 0.2, Math.PI * 1.5 - 0.2);
            ctx.arc(0, 0, reticle, Math.PI * 1.5 + 0.2, Math.PI * 2 - 0.2);
            ctx.stroke();
          } else if (id === "archer-weakpoint") {
            ctx.rotate(-Math.atan2(ball.vy, ball.vx) + game.elapsed * 1.8);
            const mark = visualRadius + 7;
            ctx.beginPath();
            ctx.arc(0, 0, mark, 0, Math.PI * 2);
            ctx.moveTo(-mark - 5, 0);
            ctx.lineTo(mark + 5, 0);
            ctx.moveTo(0, -mark - 5);
            ctx.lineTo(0, mark + 5);
            ctx.stroke();
          } else {
            for (let chevron = 0; chevron < 2; chevron++) {
              const rear = -visualRadius - 5 - chevron * 7 - index * 2;
              ctx.beginPath();
              ctx.moveTo(rear - 5, -5);
              ctx.lineTo(rear, 0);
              ctx.lineTo(rear - 5, 5);
              ctx.stroke();
            }
          }
        } else {
          const orbitRadius = visualRadius + 6 + index * 3;
          for (let mote = 0; mote < 3; mote++) {
            const angle = game.elapsed * (2.2 + index * 0.25) + mote * Math.PI * 2 / 3;
            ctx.beginPath();
            ctx.arc(ball.x + Math.cos(angle) * orbitRadius, ball.y + Math.sin(angle) * orbitRadius, 2.2 + (level ?? 1) * 0.25, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      });
      if (ball.temporaryTime > 0) {
        const lifeRatio = Math.min(1, ball.temporaryTime / 7);
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = ball.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lifeRatio);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (ball.missileTime > 0) {
        const angle = Math.atan2(ball.vy, ball.vx);
        ctx.save();
        ctx.translate(ball.x, ball.y);
        ctx.rotate(angle);
        ctx.shadowColor = "#ff9658";
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#ff9658";
        ctx.beginPath();
        ctx.moveTo(ball.radius + 9, 0);
        ctx.lineTo(-ball.radius - 4, -ball.radius * 0.75);
        ctx.lineTo(-ball.radius - 1, 0);
        ctx.lineTo(-ball.radius - 4, ball.radius * 0.75);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      if (ball.pierce > 0) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = PAYLOAD_COLORS.pierce;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      const activePayloads = PAYLOAD_IDS.filter((id) => (ball.payloads[id] ?? 0) > 0);
      if (activePayloads.length > 0 || ball.attackPower > 1.05) {
        ctx.shadowBlur = 0;
        ctx.font = "900 9px monospace";
        ctx.textAlign = "center";
        const payloadLabel = activePayloads.map((id) => id === "pierce" ? `P×${ball.pierce}` : `${PAYLOAD_LABELS[id]}${ball.payloads[id]}`).join("+");
        const label = `${ball.attackPower.toFixed(1)} ATK${ball.missileTime > 0 ? ` // MISSILE ${ball.missileTime.toFixed(1)}s` : ""}${payloadLabel ? ` // ${payloadLabel}` : ""}`;
        ctx.fillText(label, ball.x, ball.y - 13);
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    });

    game.items.forEach((item) => {
      const data = ITEM_DATA[item.kind];
      const size = item.kind === "multiball" ? 10 : 9;
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(Math.PI / 4);
      ctx.shadowBlur = item.kind === "multiball" ? 22 : 14;
      ctx.shadowColor = data.color;
      ctx.fillStyle = data.color;
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.rotate(-Math.PI / 4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#07101b";
      ctx.font = "900 11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(data.symbol, 0, 1);
      ctx.restore();
    });

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    game.effects.forEach((effect) => {
      const remaining = Math.max(0, effect.life / effect.maxLife);
      const progress = 1 - remaining;
      ctx.globalAlpha = remaining * 0.9;
      ctx.strokeStyle = effect.color;
      ctx.shadowColor = effect.color;
      ctx.shadowBlur = 18;
      if (effect.kind === "beam") {
        const dx = effect.x2 - effect.x;
        const dy = effect.y2 - effect.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const unitX = dx / distance;
        const unitY = dy / distance;
        const beamGradient = ctx.createLinearGradient(effect.x, effect.y, effect.x2, effect.y2);
        beamGradient.addColorStop(0, "rgba(255,255,255,.9)");
        beamGradient.addColorStop(0.2, effect.color);
        beamGradient.addColorStop(0.8, effect.color);
        beamGradient.addColorStop(1, "rgba(255,255,255,.9)");
        ctx.strokeStyle = beamGradient;
        ctx.lineCap = "round";
        ctx.globalAlpha = Math.min(1, remaining * 1.8);
        ctx.lineWidth = Math.max(2, effect.size * (0.42 + remaining * 0.2));
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        ctx.lineTo(effect.x2, effect.y2);
        ctx.stroke();
        const tracer = Math.min(distance, distance * progress);
        ctx.strokeStyle = "rgba(255,255,255,.96)";
        ctx.lineWidth = Math.max(2, effect.size * 0.32);
        ctx.beginPath();
        ctx.moveTo(effect.x + unitX * Math.max(0, tracer - 22), effect.y + unitY * Math.max(0, tracer - 22));
        ctx.lineTo(effect.x + unitX * tracer, effect.y + unitY * tracer);
        ctx.stroke();
      } else if (effect.kind === "ring") {
        ctx.lineWidth = 2 + remaining * 4;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size * (0.25 + progress * 0.75), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = remaining * 0.38;
        ctx.lineWidth = 1 + remaining * 2;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size * (0.1 + progress * 0.52), 0, Math.PI * 2);
        ctx.stroke();
      } else if (effect.kind === "blast") {
        const radius = effect.size * (0.3 + progress * 0.7);
        const glow = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, radius);
        glow.addColorStop(0, effect.color);
        glow.addColorStop(0.35, effect.color);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = remaining * 0.42;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = remaining;
        ctx.lineWidth = 4 + remaining * 6;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        const explosionImage = ringExplosionRef.current;
        if (ringExplosionReadyRef.current && explosionImage) {
          const frame = Math.min(RING_EXPLOSION_FRAMES - 1, Math.floor(progress * RING_EXPLOSION_FRAMES));
          const sourceX = (frame % RING_EXPLOSION_COLUMNS) * RING_EXPLOSION_FRAME_SIZE;
          const sourceY = Math.floor(frame / RING_EXPLOSION_COLUMNS) * RING_EXPLOSION_FRAME_SIZE;
          const spriteSize = effect.size * 2.35;
          ctx.save();
          ctx.globalAlpha = Math.min(1, 0.55 + remaining * 0.6);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            explosionImage,
            sourceX,
            sourceY,
            RING_EXPLOSION_FRAME_SIZE,
            RING_EXPLOSION_FRAME_SIZE,
            effect.x - spriteSize / 2,
            effect.y - spriteSize / 2,
            spriteSize,
            spriteSize,
          );
          ctx.restore();
        }
      } else if (effect.kind === "spark") {
        const variant = Math.max(0, Math.min(HIT_SPARK_ASSETS.length - 1, effect.variant));
        const sparkImage = hitSparkRefs.current[variant];
        if (hitSparkReadyRef.current[variant] && sparkImage) {
          const frame = Math.min(HIT_SPARK_FRAMES - 1, Math.floor(progress * HIT_SPARK_FRAMES));
          const spriteSize = effect.size * (0.86 + progress * 0.2);
          ctx.save();
          ctx.globalAlpha = Math.min(1, remaining * 1.8);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            sparkImage,
            frame * HIT_SPARK_FRAME_SIZE,
            0,
            HIT_SPARK_FRAME_SIZE,
            HIT_SPARK_FRAME_SIZE,
            effect.x - spriteSize / 2,
            effect.y - spriteSize / 2,
            spriteSize,
            spriteSize,
          );
          ctx.restore();
        } else {
          ctx.globalAlpha = remaining;
          ctx.lineWidth = 2 + remaining * 2;
          for (let ray = 0; ray < 6; ray++) {
            const angle = (Math.PI * 2 * ray) / 6;
            ctx.beginPath();
            ctx.moveTo(effect.x + Math.cos(angle) * 5, effect.y + Math.sin(angle) * 5);
            ctx.lineTo(effect.x + Math.cos(angle) * effect.size * progress, effect.y + Math.sin(angle) * effect.size * progress);
            ctx.stroke();
          }
        }
      } else if (effect.kind === "lightning") {
        const lightningImage = radialLightningRef.current;
        if (radialLightningReadyRef.current && lightningImage) {
          const frame = Math.min(RADIAL_LIGHTNING_FRAMES - 1, Math.floor(progress * RADIAL_LIGHTNING_FRAMES));
          const sourceX = (frame % RADIAL_LIGHTNING_COLUMNS) * RADIAL_LIGHTNING_FRAME_SIZE;
          const sourceY = Math.floor(frame / RADIAL_LIGHTNING_COLUMNS) * RADIAL_LIGHTNING_FRAME_SIZE;
          const spriteSize = effect.size * (0.8 + Math.sin(progress * Math.PI) * 0.35);
          ctx.save();
          ctx.globalAlpha = Math.min(1, remaining * 2.2);
          ctx.imageSmoothingEnabled = false;
          ctx.filter = effect.variant === 1
            ? "hue-rotate(145deg) saturate(1.9) brightness(1.35)"
            : "hue-rotate(180deg) saturate(1.65) brightness(1.2)";
          ctx.drawImage(
            lightningImage,
            sourceX,
            sourceY,
            RADIAL_LIGHTNING_FRAME_SIZE,
            RADIAL_LIGHTNING_FRAME_SIZE,
            effect.x - spriteSize / 2,
            effect.y - spriteSize / 2,
            spriteSize,
            spriteSize,
          );
          ctx.restore();
        } else {
          ctx.globalAlpha = remaining;
          ctx.lineWidth = 3 + remaining * 3;
          ctx.beginPath();
          for (let bolt = 0; bolt < 9; bolt++) {
            const angle = (Math.PI * 2 * bolt) / 9 + progress * 0.6;
            const inner = effect.size * 0.12;
            const outer = effect.size * (0.25 + progress * 0.35);
            ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
            ctx.lineTo(effect.x + Math.cos(angle + 0.12) * outer, effect.y + Math.sin(angle + 0.12) * outer);
          }
          ctx.stroke();
        }
      } else if (effect.kind === "skill") {
        ctx.save();
        ctx.translate(effect.x, effect.y);
        ctx.globalAlpha = Math.min(1, remaining * 1.8);
        ctx.strokeStyle = effect.color;
        ctx.fillStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 16;
        ctx.lineCap = "round";
        if (effect.skillId === "warrior-smash") {
          const reach = effect.size * (0.35 + progress * 0.45);
          ctx.lineWidth = 8 * remaining + 2;
          ctx.rotate(-0.35);
          ctx.beginPath();
          ctx.moveTo(-reach, -reach * 0.5);
          ctx.lineTo(reach, reach * 0.5);
          ctx.stroke();
          ctx.rotate(0.7);
          ctx.beginPath();
          ctx.moveTo(-reach * 0.7, reach * 0.45);
          ctx.lineTo(reach * 0.7, -reach * 0.45);
          ctx.stroke();
        } else if (effect.skillId === "warrior-shockwave") {
          for (let wave = 0; wave < 3; wave++) {
            const radius = effect.size * Math.max(0.08, progress - wave * 0.12);
            ctx.globalAlpha = Math.max(0, remaining - wave * 0.16);
            ctx.lineWidth = 7 - wave * 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (effect.skillId === "warrior-execute") {
          const blade = effect.size * (0.35 + progress * 0.65);
          ctx.lineWidth = 5 + remaining * 5;
          ctx.beginPath();
          ctx.moveTo(0, -blade);
          ctx.lineTo(0, blade * 0.7);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-12, blade * 0.38);
          ctx.lineTo(0, blade * 0.7);
          ctx.lineTo(12, blade * 0.38);
          ctx.stroke();
        } else if (effect.skillId === "warrior-crush") {
          ctx.rotate(progress * 1.6);
          for (let shard = 0; shard < 6; shard++) {
            const angle = shard * Math.PI / 3;
            const distance = effect.size * (0.12 + progress * 0.5);
            ctx.save();
            ctx.rotate(angle);
            ctx.translate(distance, 0);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-5, -5, 10, 10);
            ctx.restore();
          }
        } else if (effect.skillId === "warrior-guard") {
          const span = Math.min(W - 80, effect.size * 5.4);
          ctx.lineWidth = 4 + remaining * 3;
          for (let shield = -2; shield <= 2; shield++) {
            const centerX = shield * span / 5;
            const radius = 18 + progress * 8;
            ctx.beginPath();
            for (let side = 0; side <= 6; side++) {
              const angle = -Math.PI / 2 + side * Math.PI / 3;
              const x = centerX + Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius * 0.7;
              if (side === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        } else if (effect.skillId === "warrior-earthquake") {
          const width = Math.min(W - 40, effect.size);
          ctx.lineWidth = 5 + remaining * 5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          for (let crack = 1; crack <= 14; crack++) {
            const x = width * crack / 14;
            const y = (crack % 2 === 0 ? -1 : 1) * (7 + (crack % 3) * 5) * Math.sin(progress * Math.PI);
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else if (effect.skillId === "warrior-berserker") {
          ctx.rotate(-progress * 1.8);
          for (let flame = 0; flame < 10; flame++) {
            const angle = flame * Math.PI / 5;
            const inner = effect.size * 0.18;
            const outer = effect.size * (0.34 + 0.16 * Math.sin(progress * Math.PI + flame));
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle - 0.13) * inner, Math.sin(angle - 0.13) * inner);
            ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
            ctx.lineTo(Math.cos(angle + 0.13) * inner, Math.sin(angle + 0.13) * inner);
            ctx.closePath();
            ctx.fill();
          }
        } else if (effect.skillId === "archer-rapid") {
          ctx.rotate(Math.atan2(effect.y2 - effect.y, effect.x2 - effect.x));
          ctx.lineWidth = 2.5;
          for (let arrow = -1; arrow <= 1; arrow++) {
            const offset = arrow * 9;
            const travel = effect.size * (0.15 + progress * 0.55);
            ctx.beginPath();
            ctx.moveTo(-travel, offset);
            ctx.lineTo(travel, offset);
            ctx.lineTo(travel - 9, offset - 5);
            ctx.moveTo(travel, offset);
            ctx.lineTo(travel - 9, offset + 5);
            ctx.stroke();
          }
        } else if (effect.skillId === "archer-pierce") {
          ctx.rotate(Math.atan2(effect.y2 - effect.y, effect.x2 - effect.x));
          const length = effect.size * (0.3 + progress * 0.65);
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(-length, 0);
          ctx.lineTo(length, 0);
          ctx.lineTo(length - 14, -9);
          ctx.moveTo(length, 0);
          ctx.lineTo(length - 14, 9);
          ctx.stroke();
        } else if (effect.skillId === "archer-ricochet") {
          const length = effect.size * (0.5 + progress * 0.45);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-length, length * 0.35);
          ctx.lineTo(-length * 0.25, -length * 0.2);
          ctx.lineTo(length * 0.25, length * 0.16);
          ctx.lineTo(length, -length * 0.4);
          ctx.stroke();
        } else if (effect.skillId === "archer-focus") {
          const radius = effect.size * (0.7 - progress * 0.42);
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.stroke();
          for (let tick = 0; tick < 4; tick++) {
            const angle = tick * Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * (radius + 10), Math.sin(angle) * (radius + 10));
            ctx.lineTo(Math.cos(angle) * (radius - 7), Math.sin(angle) * (radius - 7));
            ctx.stroke();
          }
        } else if (effect.skillId === "archer-weakpoint") {
          ctx.rotate(progress * Math.PI * 0.75);
          const radius = effect.size * (0.24 + progress * 0.18);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-radius - 14, 0);
          ctx.lineTo(radius + 14, 0);
          ctx.moveTo(0, -radius - 14);
          ctx.lineTo(0, radius + 14);
          ctx.stroke();
        } else if (effect.skillId === "archer-arrow-rain") {
          const width = Math.min(W - 80, effect.size);
          const fall = (PLAYER_LINE_Y - BRICK_ROW_Y) * progress;
          ctx.lineWidth = 2.5;
          for (let arrow = 0; arrow < 13; arrow++) {
            const x = -width / 2 + width * arrow / 12;
            const y = fall + (arrow % 3) * 18;
            ctx.beginPath();
            ctx.moveTo(x, y - 24);
            ctx.lineTo(x, y + 12);
            ctx.lineTo(x - 5, y + 4);
            ctx.moveTo(x, y + 12);
            ctx.lineTo(x + 5, y + 4);
            ctx.stroke();
          }
        } else if (effect.skillId === "archer-infinite") {
          const radius = effect.size * (0.25 + progress * 0.16);
          ctx.lineWidth = 4 + remaining * 2;
          ctx.beginPath();
          for (let step = 0; step <= 48; step++) {
            const t = step / 48 * Math.PI * 2;
            const denominator = 1 + Math.sin(t) ** 2;
            const x = radius * Math.cos(t) / denominator;
            const y = radius * Math.sin(t) * Math.cos(t) / denominator;
            if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else if (effect.skillId === "mage-fireball") {
          ctx.rotate(progress * 2.4);
          for (let flame = 0; flame < 8; flame++) {
            const angle = flame * Math.PI / 4;
            const inner = effect.size * 0.12;
            const outer = effect.size * (0.3 + progress * 0.28);
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle - 0.15) * inner, Math.sin(angle - 0.15) * inner);
            ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
            ctx.lineTo(Math.cos(angle + 0.15) * inner, Math.sin(angle + 0.15) * inner);
            ctx.closePath();
            ctx.fill();
          }
        } else if (effect.skillId === "mage-lightning") {
          ctx.lineWidth = 3.5;
          for (let bolt = 0; bolt < 5; bolt++) {
            const angle = bolt * Math.PI * 2 / 5 + progress;
            const reach = effect.size * (0.25 + progress * 0.38);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle - 0.16) * reach * 0.45, Math.sin(angle - 0.16) * reach * 0.45);
            ctx.lineTo(Math.cos(angle + 0.12) * reach * 0.72, Math.sin(angle + 0.12) * reach * 0.72);
            ctx.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
            ctx.stroke();
          }
        } else if (effect.skillId === "mage-freeze") {
          const span = Math.min(W - 100, effect.size);
          ctx.lineWidth = 2.5;
          for (let crystal = 0; crystal < 9; crystal++) {
            const centerX = -span / 2 + span * crystal / 8;
            const radius = 8 + progress * 18;
            for (let arm = 0; arm < 6; arm++) {
              const angle = arm * Math.PI / 3;
              ctx.beginPath();
              ctx.moveTo(centerX, 0);
              ctx.lineTo(centerX + Math.cos(angle) * radius, Math.sin(angle) * radius);
              ctx.stroke();
            }
          }
        } else if (effect.skillId === "mage-black-hole") {
          ctx.lineWidth = 3 + remaining * 2;
          ctx.rotate(progress * 3.5);
          ctx.beginPath();
          for (let step = 0; step <= 60; step++) {
            const t = step / 60 * Math.PI * 4;
            const radius = effect.size * 0.035 * t * (1 - progress * 0.35);
            const x = Math.cos(t) * radius;
            const y = Math.sin(t) * radius * 0.55;
            if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        } else if (effect.skillId === "mage-mana-blast") {
          ctx.rotate(-progress * 1.4);
          for (let rune = 0; rune < 6; rune++) {
            const angle = rune * Math.PI / 3;
            const distance = effect.size * (0.18 + progress * 0.34);
            ctx.save();
            ctx.rotate(angle);
            ctx.translate(distance, 0);
            ctx.rotate(Math.PI / 4);
            ctx.strokeRect(-7, -7, 14, 14);
            ctx.restore();
          }
        } else if (effect.skillId === "mage-elemental-storm") {
          const stormColors = ["#ff7043", "#a78bfa", "#65dcff"];
          stormColors.forEach((color, ring) => {
            ctx.strokeStyle = color;
            ctx.globalAlpha = remaining * (0.95 - ring * 0.16);
            ctx.lineWidth = 4 - ring * 0.6;
            ctx.beginPath();
            ctx.arc(0, 0, effect.size * (0.2 + progress * (0.38 + ring * 0.13)), ring * 0.8 + progress * 2, Math.PI * 1.35 + ring * 0.8 + progress * 2);
            ctx.stroke();
          });
        } else if (effect.skillId === "mage-meteor") {
          const destinationY = effect.y2 - effect.y;
          const fallY = destinationY * Math.min(1, progress * 1.35);
          ctx.lineWidth = 12 * remaining + 3;
          ctx.beginPath();
          ctx.moveTo(-18, fallY - effect.size * 0.9);
          ctx.lineTo(0, fallY);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, fallY, 9 + progress * 13, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, effect.size * progress, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else if (effect.kind === "drop") {
        const fallY = effect.y + (effect.y2 - effect.y) * progress * progress;
        const driftX = effect.x + (effect.x2 - effect.x) * progress * 0.18;
        ctx.globalAlpha = Math.max(0.18, remaining);
        ctx.fillStyle = effect.color;
        ctx.fillRect(driftX - effect.size / 2, fallY - 8, effect.size, 16);
        ctx.globalAlpha = remaining * 0.45;
        ctx.fillRect(driftX - effect.size * 0.36, effect.y, effect.size * 0.72, Math.max(2, fallY - effect.y));
      } else {
        ctx.lineWidth = Math.max(2, effect.size * remaining);
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        ctx.lineTo(effect.x2, effect.y2);
        ctx.stroke();
        ctx.globalAlpha = remaining * 0.35;
        ctx.lineWidth = Math.max(5, effect.size * remaining * 2.2);
        ctx.stroke();
      }
    });
    ctx.restore();

    game.particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 1.5);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1;

    game.flashes.forEach((f) => {
      ctx.globalAlpha = Math.min(1, f.life * 1.5);
      ctx.fillStyle = f.color;
      ctx.font = `900 ${f.text.includes("BOARD") ? 28 : 15}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
    });
    ctx.globalAlpha = 1;

    if (game.waveResolution) {
      const resolutionProgress = 1 - Math.max(0, game.waveResolution.timer / game.waveResolution.maxTimer);
      ctx.save();
      ctx.fillStyle = "rgba(3,6,14,.58)";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = game.waveResolution.cleared ? "#72f1b8" : "#ff6b87";
      ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - 220, H / 2 - 68, 440, 136);
      ctx.fillStyle = "rgba(6,11,24,.94)";
      ctx.fillRect(W / 2 - 218, H / 2 - 66, 436, 132);
      ctx.fillStyle = game.waveResolution.cleared ? "#72f1b8" : "#ff8da1";
      ctx.font = "900 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("BLOCK SETTLEMENT", W / 2, H / 2 - 34);
      ctx.fillStyle = "#ecf2ff";
      ctx.font = "900 26px monospace";
      ctx.fillText(game.waveResolution.cleared ? "CORE DAMAGE 0" : `${game.waveResolution.survivors} BRICKS → CORE -${game.waveResolution.coreDamage}`, W / 2, H / 2 + 4);
      ctx.fillStyle = "rgba(157,180,225,.18)";
      ctx.fillRect(W / 2 - 160, H / 2 + 30, 320, 7);
      ctx.fillStyle = game.waveResolution.cleared ? "#72f1b8" : "#ff6b87";
      ctx.fillRect(W / 2 - 160, H / 2 + 30, 320 * resolutionProgress, 7);
      ctx.restore();
    }

    if (game.combo >= 3) {
      ctx.textAlign = "right";
      ctx.font = "900 28px monospace";
      ctx.fillStyle = game.combo >= 15 ? "#ffcf4a" : "#72f1b8";
      ctx.fillText(`${game.combo} COMBO`, W - 28, 44);
    }
    ctx.restore();
    if (game.screenFlashTime > 0 && game.screenFlashDuration > 0) {
      const flashRatio = game.screenFlashTime / game.screenFlashDuration;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = Math.min(0.24, flashRatio * 0.24);
      ctx.fillStyle = game.screenFlashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }, []);

  const loop = useCallback((time: number) => {
    const dt = Math.min(0.025, (time - lastRef.current) / 1000 || 0);
    lastRef.current = time;
    if (runningRef.current) {
      const steps = botActiveRef.current ? botSpeedRef.current : 1;
      for (let step = 0; step < steps && runningRef.current; step++) updateGame(dt);
    }
    drawGame();
    frameRef.current = requestAnimationFrame(loop);
  }, [drawGame, updateGame]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(loop);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [loop]);

  const startRun = (asBot = false) => {
    const audio = audioRef.current ?? new GameAudio();
    audioRef.current = audio;
    audio.setMuted(!soundEnabled);
    void audio.unlock().then(() => audio.play("start"));
    const activeGhosts: GhostRecord[] = [];
    activeGhostsRef.current = activeGhosts;
    const bench = skillBenchConfigRef.current;
    const benchQueue = bench.environment === "original" ? ["original"] : (bench.mode === "batch" ? bench.skillIds : [bench.skillId]).filter((id) => activeSkillMap[id as UpgradeId]);
    const variantsPerSkill = bench.environment === "original" ? 1 : 4;
    const perSkillRuns = bench.runsPerVariant * variantsPerSkill;
    const withinSkillRun = perSkillRuns > 0 ? botCompletedRunsRef.current % perSkillRuns : 0;
    const benchSeed = asBot && botSkillBenchActiveRef.current ? 73001 + (withinSkillRun % bench.runsPerVariant) : undefined;
    configureRunRandom(benchSeed);
    const game = initialGame(activeGhosts, balanceConfigRef.current);
    if (asBot && botSkillBenchActiveRef.current) {
      const skillIndex = Math.floor(botCompletedRunsRef.current / perSkillRuns);
      const level = (bench.environment === "original" ? 0 : Math.min(3, Math.floor(withinSkillRun / bench.runsPerVariant))) as 0 | 1 | 2 | 3;
      const skillId = benchQueue[skillIndex] as UpgradeId | "original";
      botSkillBenchVariantRef.current = { batchId: bench.batchId, environment: bench.environment, skillId, level, skillValues: skillId === "original" ? [0, 0, 0] : [...activeSkillMap[skillId]!.levels], seed: benchSeed! };
      game.upgrades = skillId === "original" ? [] : Array.from({ length: level }, () => skillId);
      game.balls.forEach((ball) => syncBallPayloadDisplay(ball, game.upgrades));
      const benchSkill = skillId === "original" ? undefined : activeSkillMap[skillId];
      game.flashes.push({ text: skillId === "original" ? "ORIGINAL // NO SKILLS" : `SKILL BENCH // ${level === 0 ? "BASELINE" : `${benchSkill?.name ?? skillId} LV${level}`}`, x: W / 2, y: H / 2, life: 1.8, color: level === 0 || !benchSkill ? "#8492a9" : benchSkill.color });
    } else {
      botSkillBenchVariantRef.current = null;
      if (asBot) {
        const grantBotStartingSkill = (id: UpgradeId) => {
          const previousLevel = upgradeLevel(game.upgrades, id);
          game.upgrades.push(id);
          const nextLevel = upgradeLevel(game.upgrades, id);
          if (id === "common-xp") {
            const coreGain = skillValue("common-xp", nextLevel) - skillValue("common-xp", previousLevel);
            game.maxCoreHp += coreGain;
            game.coreHp += coreGain;
          }
          game.skillHistory.push({ wave: 1, skillId: id, level: nextLevel, source: "start" });
        };
        const first = chooseBotUpgrade(pickUpgradeChoices(game.upgrades, upgradeCatalogRef.current, false), game.upgrades, botPolicyRef.current);
        grantBotStartingSkill(first.id);
        const secondPool = pickUpgradeChoices(game.upgrades, upgradeCatalogRef.current, false, [first.id]);
        if (secondPool.length > 0) {
          const second = chooseBotUpgrade(secondPool, game.upgrades, botPolicyRef.current);
          grantBotStartingSkill(second.id);
        }
        game.balls.forEach((ball) => syncBallPayloadDisplay(ball, game.upgrades));
      }
    }
    gameRef.current = game;
    pointerXRef.current = W / 2;
    lastRef.current = performance.now();
    setSettlement(null);
    setInitialSelectedIds([]);
    setSavedMessage("");
    setHud(hudFromGame(game));
    if (!asBot) {
      const openingChoices = pickUpgradeChoices([], upgradeCatalogRef.current, false);
      setChoices(priceUpgradeChoices(openingChoices, false));
      runningRef.current = false;
      levelUpRef.current = true;
      setMode("initialskills");
    } else {
      runningRef.current = true;
      levelUpRef.current = false;
      setMode("playing");
    }
  };

  const startParallelBenchmarkSession = () => {
    const targetRuns = benchmarkConfigRef.current.runs;
    const workerCount = Math.max(1, Math.min(8, targetRuns, (navigator.hardwareConcurrency || 4) - 1));
    const session = parallelSessionRef.current + 1;
    const sessionId = `${Date.now().toString(36)}-${session}`;
    parallelSessionRef.current = session;
    parallelWorkersRef.current.forEach((worker) => worker.terminate());
    parallelWorkersRef.current = [];
    benchmarkWatchRef.current = false;
    botActiveRef.current = true;
    botPolicyRef.current = botPolicy;
    botTargetRunsRef.current = targetRuns;
    botCompletedRunsRef.current = 0;
    setBotTargetRuns(targetRuns);
    setBotCompletedRuns(0);
    setParallelWorkerCount(workerCount);
    setBotRunning(true);
    localStorage.removeItem(BOT_LIVE_STORAGE_KEY);
    parallelPendingResultsRef.current = [];

    let nextRun = 1;
    let completed = 0;
    const flushPending = () => {
      const batch = parallelPendingResultsRef.current.splice(0);
      if (!batch.length) return;
      const nextResults = [...botResultsRef.current, ...batch].slice(-5000);
      botResultsRef.current = nextResults;
      setBotResults(nextResults);
      void putBenchmarkResults(batch).catch((error) => console.error("[benchmark-store] write failed", error));
    };
    parallelFlushRef.current = flushPending;
    const stopPool = () => {
      parallelWorkersRef.current.forEach((worker) => worker.terminate());
      parallelWorkersRef.current = [];
      setParallelWorkerCount(0);
    };
    const failPool = (message: string) => {
      if (parallelSessionRef.current !== session) return;
      console.error(`[benchmark-worker] ${message}`);
      flushPending();
      stopPool();
      botActiveRef.current = false;
      setBotRunning(false);
    };
    const dispatch = (worker: Worker) => {
      if (parallelSessionRef.current !== session || nextRun > targetRuns) return;
      const run = nextRun++;
      const request: HeadlessBenchmarkRequest = {
        run,
        seed: 91001 + run * 7919,
        sessionId,
        policy: botPolicy,
        balanceConfig: { ...balanceConfigRef.current },
        benchmarkConfig: { ...benchmarkConfigRef.current },
        skills: activeSkillConfigsRef.current.map((skill) => ({ ...skill, levels: [...skill.levels] as [number, number, number] })),
      };
      worker.postMessage(request);
    };

    const workers = Array.from({ length: workerCount }, () => {
      const worker = new Worker(new URL("./benchmark-worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<{ type: "result"; result: HeadlessBenchmarkResult } | { type: "error"; message: string }>) => {
        if (parallelSessionRef.current !== session) return;
        if (event.data.type === "error") {
          failPool(event.data.message);
          return;
        }
        const record = event.data.result as BotRunResult;
        completed += 1;
        botCompletedRunsRef.current = completed;
        parallelPendingResultsRef.current.push(record);
        if (completed % 25 === 0 || completed >= targetRuns) {
          setBotCompletedRuns(completed);
          flushPending();
        }
        if (completed >= targetRuns) {
          stopPool();
          botActiveRef.current = false;
          setBotRunning(false);
          return;
        }
        dispatch(worker);
      };
      worker.onerror = (event) => failPool(event.message || "Worker execution failed");
      return worker;
    });
    parallelWorkersRef.current = workers;
    workers.forEach(dispatch);
  };

  const startBotSession = () => {
    if (benchmarkMode && benchmarkRunMode === "parallel") {
      startParallelBenchmarkSession();
      return;
    }
    const bench = skillBenchConfigRef.current;
    const queue = bench.environment === "original" ? ["original"] : (bench.mode === "batch" ? bench.skillIds : [bench.skillId]).filter((id) => upgradeCatalogRef.current.some((upgrade) => upgrade.id === id));
    botSkillBenchActiveRef.current = !benchmarkMode && bench.enabled && queue.length > 0;
    const variantsPerSkill = bench.environment === "original" ? 1 : 4;
    const targetRuns = botSkillBenchActiveRef.current ? queue.length * bench.runsPerVariant * variantsPerSkill : benchmarkMode ? 1 : botTargetRuns;
    const savedProgress = skillBenchProgressRef.current;
    const resumeAt = botSkillBenchActiveRef.current
      && savedProgress.batchId === bench.batchId
      && savedProgress.status === "paused"
      && savedProgress.totalRuns === targetRuns
      && savedProgress.completedRuns < targetRuns
      ? savedProgress.completedRuns
      : 0;
    botActiveRef.current = true;
    benchmarkWatchRef.current = benchmarkMode;
    botPolicyRef.current = botPolicy;
    botSpeedRef.current = botSpeed;
    botTargetRunsRef.current = targetRuns;
    botCompletedRunsRef.current = resumeAt;
    setBotCompletedRuns(resumeAt);
    setBotTargetRuns(targetRuns);
    setParallelWorkerCount(0);
    setBotRunning(true);
    botLivePersistRef.current = 0;
    localStorage.removeItem(BOT_LIVE_STORAGE_KEY);
    if (botSkillBenchActiveRef.current) {
      const perSkillRuns = bench.runsPerVariant * variantsPerSkill;
      const currentSkillId = queue[Math.floor(resumeAt / perSkillRuns)] ?? queue[0];
      const currentLevel = (bench.environment === "original" ? 0 : Math.floor((resumeAt % perSkillRuns) / bench.runsPerVariant)) as 0 | 1 | 2 | 3;
      const nextProgress: SkillBenchProgress = {
        batchId: bench.batchId,
        status: "running",
        completedRuns: resumeAt,
        totalRuns: targetRuns,
        currentSkillId,
        currentLevel,
        startedAt: resumeAt > 0 ? savedProgress.startedAt : Date.now(),
        updatedAt: Date.now(),
      };
      skillBenchProgressRef.current = nextProgress;
      setSkillBenchProgress(nextProgress);
      localStorage.setItem(SKILL_BENCH_PROGRESS_KEY, JSON.stringify(nextProgress));
    }
    setSelectedIds([]);
    startRun(true);
  };

  useEffect(() => {
    if (mode !== "result" || !result || !botActiveRef.current) return;
    if (botCompletedRunsRef.current >= botTargetRunsRef.current) {
      botActiveRef.current = false;
      setBotRunning(false);
      return;
    }
    const timer = window.setTimeout(() => {
      if (botActiveRef.current) startRun(true);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [mode, result, botCompletedRuns]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("echo-breaker-sound-v1", next ? "on" : "off");
    const audio = audioRef.current ?? new GameAudio();
    audioRef.current = audio;
    audio.setMuted(!next);
    if (next) void audio.unlock().then(() => audio.play("item"));
  };

  const saveGhost = () => {
    if (!result) return;
    const record: GhostRecord = {
      id: `ghost-${Date.now()}`,
      name: `ECHO ${String(ghosts.length + 1).padStart(2, "0")}`,
      score: Math.floor(result.score),
      bricks: result.bricksBroken,
      maxCombo: result.maxCombo,
      upgrades: result.upgrades.filter((upgrade) => PADDLE_UPGRADES.has(upgrade)),
      paddleTrack: result.paddleTrack,
      createdAt: Date.now(),
    };
    setGhosts((current) => {
      if (current.length < MAX_GHOSTS) return [...current, record];
      const lowest = [...current].sort((a, b) => a.score - b.score)[0];
      return current.map((g) => g.id === lowest.id ? record : g);
    });
    setSavedMessage(ghosts.length < MAX_GHOSTS ? "새 고스트를 보관했습니다." : "최저 점수 고스트를 교체했습니다.");
  };

  const backToLobby = () => {
    runningRef.current = false;
    gameRef.current = null;
    setResult(null);
    setMode("lobby");
    activeGhostsRef.current = [];
  };

  const stopBotSession = () => {
    if (parallelWorkersRef.current.length > 0) {
      parallelFlushRef.current();
      parallelSessionRef.current += 1;
      parallelWorkersRef.current.forEach((worker) => worker.terminate());
      parallelWorkersRef.current = [];
      setParallelWorkerCount(0);
    }
    if (botSkillBenchActiveRef.current) {
      const paused = { ...skillBenchProgressRef.current, status: "paused" as const, completedRuns: botCompletedRunsRef.current, updatedAt: Date.now() };
      skillBenchProgressRef.current = paused;
      setSkillBenchProgress(paused);
      localStorage.setItem(SKILL_BENCH_PROGRESS_KEY, JSON.stringify(paused));
    }
    botActiveRef.current = false;
    setBotRunning(false);
    localStorage.removeItem(BOT_LIVE_STORAGE_KEY);
    backToLobby();
  };

  const exportBotResults = () => {
    const exportResults = benchmarkMode ? botResultsRef.current.filter((item) => item.benchmarkRuleset === BENCHMARK_RULESET) : botResultsRef.current;
    const blob = new Blob([JSON.stringify(exportResults, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `core-breaker-bot-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const clearBotResults = () => {
    const nextResults = benchmarkMode ? botResultsRef.current.filter((item) => item.benchmarkRuleset !== BENCHMARK_RULESET) : [];
    botResultsRef.current = nextResults;
    setBotResults(nextResults);
    if (nextResults.length > 0) localStorage.setItem(BOT_RESULTS_STORAGE_KEY, JSON.stringify(nextResults));
    else localStorage.removeItem(BOT_RESULTS_STORAGE_KEY);
    if (benchmarkMode) void clearBenchmarkResults(BENCHMARK_RULESET).catch((error) => console.error("[benchmark-store] clear failed", error));
  };

  const onPointerMove = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointerXRef.current = Math.max(0, Math.min(W, ((clientX - rect.left) / rect.width) * W));
  };

  const ultimateCatalog = ULTIMATE_SKILLS.map((fallback) => {
    const skill = activeSkillMap[fallback.id] ?? fallback;
    return {
      id: skill.id,
      name: skill.name,
      category: skill.category,
      tag: `${CLASS_META[skill.category].tag} · ULTIMATE`,
      description: skill.description,
      color: skill.color,
    } satisfies Upgrade;
  });
  const upgradeCounts = (ids: UpgradeId[]) => [...upgradeCatalog, ...ultimateCatalog].map((u) => ({ ...u, count: ids.filter((id) => id === u.id).length })).filter((u) => u.count > 0);
  const visibleBotResults = benchmarkMode ? botResults.filter((item) => item.benchmarkRuleset === BENCHMARK_RULESET) : botResults;
  const botAverageSurvival = visibleBotResults.length ? visibleBotResults.reduce((sum, item) => sum + item.elapsed, 0) / visibleBotResults.length : 0;
  const botAverageWave = visibleBotResults.length ? visibleBotResults.reduce((sum, item) => sum + item.wave, 0) / visibleBotResults.length : 0;
  const botAverageBalls = visibleBotResults.length ? visibleBotResults.reduce((sum, item) => sum + item.maxBalls, 0) / visibleBotResults.length : 0;
  const recentBotResults = [...visibleBotResults].slice(-5).reverse();
  const benchmarkCompletionRate = visibleBotResults.length ? visibleBotResults.filter((item) => item.evaluationComplete).length / visibleBotResults.length * 100 : 0;
  const benchmarkAverageScore = visibleBotResults.length ? visibleBotResults.reduce((sum, item) => sum + item.score, 0) / visibleBotResults.length : 0;
  const benchmarkAverageBricks = visibleBotResults.length ? visibleBotResults.reduce((sum, item) => sum + item.bricks, 0) / visibleBotResults.length : 0;
  const benchmarkAverageCombo = visibleBotResults.length ? visibleBotResults.reduce((sum, item) => sum + item.maxCombo, 0) / visibleBotResults.length : 0;
  const benchmarkAverageCore = visibleBotResults.length ? visibleBotResults.reduce((sum, item) => sum + item.coreHp, 0) / visibleBotResults.length : 0;
  const benchmarkWaveStats = Array.from({ length: MAX_WAVE }, (_, index) => {
    const wave = index + 1;
    const samples = visibleBotResults.flatMap((item) => item.waveSamples.filter((sample) => sample.wave === wave));
    return {
      wave,
      reachRate: visibleBotResults.length ? visibleBotResults.filter((item) => item.wave >= wave).length / visibleBotResults.length * 100 : 0,
      averageCore: samples.length ? samples.reduce((sum, sample) => sum + sample.coreHp, 0) / samples.length : 0,
    };
  });
  const chartX = (index: number) => 34 + index / (MAX_WAVE - 1) * 542;
  const reachPoints = benchmarkWaveStats.map((item, index) => `${chartX(index)},${18 + (100 - item.reachRate) / 100 * 126}`).join(" ");
  const corePoints = benchmarkWaveStats.map((item, index) => `${chartX(index)},${18 + (1 - Math.min(1, item.averageCore / MAX_CORE_HP)) * 126}`).join(" ");
  const benchmarkTableResults = [...visibleBotResults].reverse().slice(0, 20);
  const benchmarkSkillStats = [...upgradeCatalog, ...ultimateCatalog].map((skill) => {
    const pickedRuns = visibleBotResults.filter((item) => item.upgrades.includes(skill.id));
    const metric = pickedRuns.reduce<SkillRunMetric>((total, item) => {
      const value = item.skillMetrics?.[skill.id];
      return {
        activations: total.activations + (value?.activations ?? 0),
        damage: total.damage + (value?.damage ?? 0),
        kills: total.kills + (value?.kills ?? 0),
      };
    }, { activations: 0, damage: 0, kills: 0 });
    const levels = pickedRuns.reduce((sum, item) => sum + item.upgrades.filter((id) => id === skill.id).length, 0);
    return {
      ...skill,
      picks: pickedRuns.length,
      averageLevel: pickedRuns.length ? levels / pickedRuns.length : 0,
      clearRate: pickedRuns.length ? pickedRuns.filter((item) => item.evaluationComplete).length / pickedRuns.length * 100 : 0,
      averageWave: pickedRuns.length ? pickedRuns.reduce((sum, item) => sum + item.wave, 0) / pickedRuns.length : 0,
      ...metric,
    };
  }).filter((skill) => skill.picks > 0).sort((a, b) => b.picks - a.picks || b.clearRate - a.clearRate);
  const showSkillBenchmark = !benchmarkMode && skillBenchConfig.enabled;
  const updateBenchmarkRuns = (runs: BenchmarkConfig["runs"]) => {
    const next = { ...benchmarkConfigRef.current, runs };
    benchmarkConfigRef.current = next;
    setBenchmarkConfig(next);
    setBotTargetRuns(runs);
    localStorage.setItem(BENCHMARK_STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">CB</span>
          <div><p className="eyebrow">{benchmarkMode ? `LIVE GAME RULES // TARGET W${benchmarkConfig.targetWave}` : "PLAYTEST BUILD 0.3 // LIVE GAMEPLAY"}</p><h1>{benchmarkMode ? "CORE BREAKER BENCH" : "CORE BREAKER"}</h1></div>
        </div>
        <div className="header-rule" />
        <a className="lab-link" href={benchmarkMode ? "/" : "/benchmark"}>{benchmarkMode ? "GAMEPLAY" : "BENCHMARK"}</a>
        <a className="lab-link" href="/skill-lab">SKILL LAB</a>
        <button className="sound-toggle" type="button" aria-pressed={!soundEnabled} onClick={toggleSound}>{soundEnabled ? "SOUND ON" : "SOUND OFF"}</button>
        <div className="session-status"><span className={mode === "playing" ? "live-dot active" : "live-dot"} />{mode === "playing" ? "SESSION LIVE" : "SYSTEM READY"}</div>
      </header>

      <section className={benchmarkMode ? "workspace" : "workspace solo-workspace"}>
        <div className="game-column">
          <div className="hud-strip">
            <div><span>SURVIVAL</span><strong>{hud.time.toFixed(1)}</strong></div>
            <div><span>SCORE</span><strong>{formatScore(hud.score)}</strong></div>
            <div><span>COMBO</span><strong>{hud.combo}</strong></div>
            <div><span>BALLS</span><strong>{hud.balls}</strong></div>
            <div className={hud.coreHp <= 3 ? "core-cell core-critical" : "core-cell"}><span>CORE</span><strong>{hud.coreHp}/{hud.maxCoreHp}</strong></div>
            <div className="xp-cell"><span>WAVE PATTERN</span><strong>{hud.waveName}</strong><small>{hud.aliveBricks} BRICKS LEFT</small></div>
            <div className={hud.overdriveLevel > 0 ? "overdrive-cell active" : "overdrive-cell"}>
              <span>WAVE {hud.wave}/{MAX_WAVE} · {hud.nextRow.toFixed(1)}s</span>
              <strong>BALL {Math.round(hud.overdriveMultiplier * 100)}%</strong>
              <small>{hud.overdriveLevel < MAX_OVERDRIVE_LEVEL ? `NEXT +5% IN ${Math.max(0, OVERDRIVE_THRESHOLDS[hud.overdriveLevel] - hud.nextRow).toFixed(0)}s` : "MAX OVERDRIVE"}</small>
            </div>
          </div>
          <div className="brick-key-strip" aria-label="특수 블록 기능 안내">
            <strong>BLOCK KEY</strong>
            {BRICK_TRAITS.map((trait) => {
              const data = BRICK_TRAIT_DATA[trait];
              return <span key={trait} style={{ "--trait-color": data.color } as React.CSSProperties} title={`${data.label}: ${data.description}`}><b>{data.glyph}</b><em>{data.label}</em><small>{data.description}</small></span>;
            })}
          </div>

          <div className="game-frame">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              aria-label="Core Breaker 게임 화면"
              onPointerMove={(e) => onPointerMove(e.clientX)}
              onPointerDown={(e) => onPointerMove(e.clientX)}
            />
            <div className="drop-legend" aria-label="아이템 블록 표시 안내">
              {ITEM_KINDS.map((kind) => <span key={kind} style={{ "--drop-color": ITEM_DATA[kind].color } as React.CSSProperties}><b>{ITEM_DATA[kind].symbol}</b>{ITEM_DATA[kind].label}</span>)}
            </div>
            {benchmarkMode && benchmarkRunMode === "watch" && botRunning && mode === "playing" && (
              <div className="watch-run-badge" aria-label="실시간 봇 관찰 상태"><i />LIVE BOT · {botSpeed}× · W{hud.wave}</div>
            )}

            {mode === "lobby" && (
              <div className="overlay lobby-overlay">
                <p className="overlay-kicker">{benchmarkMode ? benchmarkRunMode === "watch" ? `WATCH RUN · REAL PHYSICS · ${botSpeed}×` : `HEADLESS · W1–W20 · ${benchmarkConfig.runs} RUNS` : "20 WAVES. ONE BALL. BREAK THROUGH."}</p>
                <h2>{benchmarkMode ? benchmarkRunMode === "watch" ? <>실제 플레이를<br />관찰합니다.</> : <>실제 게임 규칙을<br />병렬 테스트합니다.</> : <>패턴을 돌파하고<br />코어를 지키세요.</>}</h2>
                <p>{benchmarkMode ? benchmarkRunMode === "watch" ? "봇이 실제 캔버스에서 패들을 조작합니다. 블록 충돌, 스킬 충전과 발동, 공 손실을 화면으로 확인하세요." : "웨이브 패턴, 블록 체력, 보스와 Skill LAB 수치를 헤드리스 Worker가 동시에 시뮬레이션합니다." : "웨이브마다 공 1개로 고정 패턴을 모두 파괴하세요. 공을 놓치면 CORE 1을 잃고 새 공으로 즉시 이어집니다."}</p>
                {!benchmarkMode && <button className="primary-button" onClick={() => startRun(false)}>20 웨이브 시작 <span>→</span></button>}
                <small>{benchmarkMode ? benchmarkRunMode === "watch" ? "오른쪽에서 관찰 배속과 봇 정책을 선택하세요." : "오른쪽에서 반복 횟수와 봇 정책을 선택하세요." : "마우스 또는 터치로 패들을 움직이세요."}</small>
              </div>
            )}

            {mode === "initialskills" && (
              <div className="overlay level-overlay initial-skill-overlay">
                <p className="overlay-kicker">LOADOUT SETUP // {initialSelectedIds.length}/2 SELECTED</p>
                <h2>시작 스킬 2개를 선택하세요</h2>
                <div className="upgrade-grid">
                  {choices.map(({ upgrade }, index) => {
                    const config = activeSkillMap[upgrade.id]!;
                    return (
                      <button key={upgrade.id} className="upgrade-card" onClick={() => selectInitialSkill(upgrade)} style={{ "--accent": upgrade.color } as React.CSSProperties}>
                        <span className="upgrade-index">0{index + 1}</span>
                        <span className="upgrade-tag">STARTING SKILL · {upgrade.tag}</span>
                        <span className="upgrade-icon" aria-hidden="true">{SKILL_ICONS[upgrade.id]}</span>
                        <strong>{upgrade.name}</strong>
                        <div className="upgrade-level-values"><span className="next"><small>START</small><b>{config.levels[0]}{config.unit}</b></span></div>
                        <em>{initialSelectedIds.length === 0 ? "FIRST PICK" : "SECOND PICK"}</em>
                        <div className="upgrade-tooltip" role="tooltip"><span>발동 조건</span><b>{config.trigger}</b><p><SkillDescriptionText text={config.description} /></p></div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === "settlement" && settlement && (
              <div className="overlay level-overlay settlement-overlay">
                <p className="overlay-kicker">WAVE {settlement.wave} SETTLEMENT // {settlement.waveName}</p>
                <h2>웨이브 클리어</h2>
                <div className="result-stats settlement-stats">
                  <div><span>CLEAR TIME</span><strong>{settlement.elapsed.toFixed(1)}s</strong></div>
                  <div><span>BALLS NEXT WAVE</span><strong>1</strong></div>
                  <div><span>CORE</span><strong>{settlement.coreHp}/{gameRef.current?.maxCoreHp ?? MAX_CORE_HP}</strong></div>
                </div>
                <p className="settlement-copy">모든 파괴 가능 블록을 제거했습니다. 다음 웨이브도 기본 공 1개로 시작합니다.</p>
                <button className="primary-button" onClick={claimWaveReward}>{settlement.finalWave ? "결과 확인" : settlement.wasBoss && settlement.cleared ? "궁극기 보상 받기" : "스킬 보상 받기"} <span>→</span></button>
              </div>
            )}

            {mode === "levelup" && (
              <div className="overlay level-overlay">
                <p className="overlay-kicker">WAVE REWARD // SIGNAL UPGRADE</p>
                <h2>조합을 선택하세요</h2>
                <div className="upgrade-grid">
                  <p className="upgrade-ball-summary">직업 스킬은 패들 반사로 충전 · 공용 스킬은 획득 즉시 상시 적용 · 궁극기는 보스 보상 전용</p>
                  {choices.map(({ upgrade, ballCost }, index) => {
                    const currentLevel = gameRef.current?.upgrades.filter((id) => id === upgrade.id).length ?? 0;
                    const config = activeSkillMap[upgrade.id];
                    return (
                      <button key={upgrade.id} className="upgrade-card" onClick={() => applyUpgrade(upgrade, 0)} aria-label={`${upgrade.name}, ${config?.category === "common" ? "상시 적용 공용 스킬" : "반사 횟수 충전 스킬"}`} style={{ "--accent": upgrade.color } as React.CSSProperties}>
                        <span className="upgrade-index">0{index + 1}</span>
                        <span className="upgrade-tag">{upgrade.tag}</span>
                        <span className="upgrade-icon" aria-hidden="true">{SKILL_ICONS[upgrade.id]}</span>
                        <strong>{upgrade.name}</strong>
                        <div className="upgrade-level-values" aria-label={`${upgrade.name} 레벨별 수치`}>
                          {config!.levels.map((value, levelIndex) => (
                            <span key={levelIndex} className={`${currentLevel === levelIndex ? "next" : currentLevel > levelIndex ? "owned" : ""} ${currentLevel === 2 && levelIndex === 2 && config!.evolution ? "evolution" : ""}`}>
                              <small>LV{levelIndex + 1}</small><b>{value}{config!.unit}</b>
                            </span>
                          ))}
                        </div>
                        <em>{currentLevel === 2 && config?.evolution ? "LV3 EVOLUTION" : currentLevel > 0 ? `LV ${currentLevel + 1} 획득` : "NEW SKILL"}</em>
                        <div className="upgrade-tooltip" role="tooltip">
                          <span>발동 조건</span><b>{config!.trigger}</b>
                          <p><SkillDescriptionText text={config!.description} /></p>
                          {currentLevel === 2 && config!.evolution && <p className="upgrade-evolution"><b>LV3 진화</b><SkillDescriptionText text={config!.evolution} /></p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="upgrade-choice-actions">
                  <button type="button" onClick={rerollUpgradeChoices} disabled={rerollsLeft <= 0}>리롤 {rerollsLeft}/1</button>
                  <button type="button" onClick={skipUpgradeChoice}>선택 건너뛰기</button>
                </div>
              </div>
            )}

            {mode === "bossreward" && (
              <div className="overlay level-overlay boss-reward-overlay">
                <p className="overlay-kicker">CORE FORTRESS DESTROYED // BOSS CORE</p>
                <h2>궁극기를 선택하세요</h2>
                <div className="upgrade-grid">
                  {ultimateCatalog.map((reward, index) => (
                    <button key={reward.id} className="upgrade-card" onClick={() => applyBossReward(reward.id)} style={{ "--accent": reward.color } as React.CSSProperties}>
                      <span className="upgrade-index">0{index + 1}</span>
                      <span className="upgrade-tag">{reward.tag}</span>
                      <strong>{reward.name}</strong>
                      <p><SkillDescriptionText text={reward.description} /></p>
                      <em>LEGENDARY</em>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "result" && result && (
              <div className="overlay result-overlay">
                <p className="overlay-kicker">{result.failureReason === "ball" ? "ALL BALLS LOST // GAME OVER" : result.failureReason === "core" ? "CORE DESTROYED // GAME OVER" : "SESSION COMPLETE"}</p>
                <h2>{formatScore(result.score)}</h2>
                <p className="score-label">FINAL SCORE</p>
                <div className="result-stats">
                  <div><span>WAVE</span><strong>{result.wave}/{MAX_WAVE}</strong></div>
                  <div><span>SURVIVAL</span><strong>{result.elapsed.toFixed(1)}s</strong></div>
                  <div><span>BRICKS</span><strong>{result.bricksBroken}</strong></div>
                  <div><span>MAX COMBO</span><strong>{result.maxCombo}</strong></div>
                </div>
                <div className="result-actions">
                  <button className="primary-button" onClick={backToLobby}>다시 시작</button>
                </div>
              </div>
            )}
          </div>

          <div className="build-tray">
            <span className="tray-title">CURRENT BUILD</span>
            <div className="build-items">
              {(gameRef.current ? upgradeCounts(gameRef.current.upgrades) : []).map((u) => <span key={u.id} style={{ borderColor: u.color, color: u.color }}>{u.tag} <b>×{u.count}</b></span>)}
              {(!gameRef.current || gameRef.current.upgrades.length === 0) && <em>웨이브 보상을 선택하면 조합이 여기에 기록됩니다.</em>}
            </div>
            <div className="controls">MOVE / POINTER · TOUCH</div>
          </div>
        </div>

        {benchmarkMode && <aside className="ghost-panel">
          <section className="bot-panel" aria-label="플레이테스트 봇 설정 및 결과">
            <div className="panel-heading">
                  <div><p className="eyebrow">{benchmarkRunMode === "watch" ? `VISIBLE PHYSICS · ${botSpeed}× · TARGET W${benchmarkConfig.targetWave}` : `PARALLEL HEADLESS · ${parallelWorkerCount || "AUTO"} WORKERS · TARGET W${benchmarkConfig.targetWave}`}</p><h2>벤치마크 러너</h2></div>
              <span>{botRunning ? `${botCompletedRuns}/${botTargetRuns}` : `${visibleBotResults.length} DATA`}</span>
            </div>
            <div className="benchmark-mode-switch" role="group" aria-label="벤치마크 실행 방식">
              <button type="button" className={benchmarkRunMode === "parallel" ? "active" : ""} onClick={() => setBenchmarkRunMode("parallel")} disabled={botRunning || mode !== "lobby"}><b>HEADLESS</b><small>고속 병렬 통계</small></button>
              <button type="button" className={benchmarkRunMode === "watch" ? "active" : ""} onClick={() => setBenchmarkRunMode("watch")} disabled={botRunning || mode !== "lobby"}><b>WATCH RUN</b><small>실제 화면 관찰</small></button>
            </div>
            <p className="panel-copy">{showSkillBenchmark
              ? skillBenchConfig.environment === "original"
                ? `ORIGINAL · 스킬 획득 없음 · ${skillBenchConfig.runsPerVariant}회 기준 측정${skillBenchProgress.status === "paused" ? ` · ${skillBenchProgress.completedRuns}회부터 재개` : ""}`
                : skillBenchConfig.mode === "batch"
                ? `배치 스킬 벤치 · ${skillBenchConfig.skillIds.length}개 스킬 · 총 ${skillBenchConfig.skillIds.length * skillBenchConfig.runsPerVariant * 4}회${skillBenchProgress.status === "paused" ? ` · ${skillBenchProgress.completedRuns}회부터 재개` : ""}`
                : `${skillBenchConfig.environment.toUpperCase()} · ${activeSkillMap[skillBenchConfig.skillId as UpgradeId]?.name ?? skillBenchConfig.skillId} · 기준/LV1/LV2/LV3 각 ${skillBenchConfig.runsPerVariant}회`
                  : benchmarkRunMode === "watch"
                    ? `실제 충돌 물리와 이펙트를 사용하는 화면 관찰용 봇 · 1회 실행 · ${botSpeed}×`
                    : `실제 스테이지 데이터와 Skill LAB 수치를 사용하는 결정론적 헤드리스 시뮬레이션 · ${benchmarkConfig.runs}회 병렬 실행`}</p>
            <div className="bot-controls">
              <label>반복 횟수
                {benchmarkRunMode === "watch"
                  ? <select value="watch" disabled><option value="watch">1회 · 화면 관찰</option></select>
                  : <select value={benchmarkConfig.runs} onChange={(event) => updateBenchmarkRuns(Number(event.target.value) as BenchmarkConfig["runs"])} disabled={botRunning || mode !== "lobby"}>
                    {[3, 5, 10, 20, 100, 500, 1000].map((runs) => <option key={runs} value={runs}>{runs.toLocaleString("ko-KR")}회</option>)}
                  </select>}
              </label>
              <label>선택 정책
                <select value={botPolicy} onChange={(event) => setBotPolicy(event.target.value as BotPolicy)} disabled={botRunning || mode !== "lobby"}>
                  <option value="balanced">균형형</option>
                  <option value="survival">생존 우선</option>
                  <option value="random">무작위</option>
                </select>
              </label>
              <label>{benchmarkRunMode === "watch" ? "관찰 배속" : "병렬 처리"}
                {benchmarkRunMode === "watch"
                  ? <select value={botSpeed} onChange={(event) => {
                    const speed = Number(event.target.value) as BotSpeed;
                    botSpeedRef.current = speed;
                    setBotSpeed(speed);
                  }} disabled={!botRunning && mode !== "lobby"}>
                    {[1, 2, 4, 8].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
                  </select>
                  : <select value="auto" disabled><option value="auto">CPU 자동 · 최대 8</option></select>}
              </label>
            </div>
            {botRunning
              ? <button className="bot-stop" type="button" onClick={stopBotSession}>{benchmarkRunMode === "watch" ? `WATCH STOP · ${botSpeed}× · W${hud.wave}` : `BOT STOP · ${botCompletedRuns}/${botTargetRuns} · ${parallelWorkerCount} WORKERS`}</button>
              : <button className="bot-start" type="button" onClick={startBotSession} disabled={mode !== "lobby"}>{showSkillBenchmark ? skillBenchProgress.status === "paused" ? "SKILL BENCH RESUME" : "SKILL BENCH START" : benchmarkRunMode === "watch" ? "WATCH RUN START" : "BENCHMARK START"}</button>}
            <div className="bot-summary">
              <div><span>AVG TIME</span><strong>{botAverageSurvival.toFixed(1)}s</strong></div>
              <div><span>AVG WAVE</span><strong>{botAverageWave.toFixed(1)}</strong></div>
              <div><span>AVG MAX BALLS</span><strong>{botAverageBalls.toFixed(1)}</strong></div>
            </div>
            {recentBotResults.length > 0 && (
              <div className="bot-results">
                <div className="bot-result-head"><span>RUN</span><span>WAVE</span><span>TIME</span><span>MAX BALL</span><span>SAVES</span></div>
                {recentBotResults.map((item) => <div key={item.id}><span>#{item.run}</span><span>{item.wave}</span><span>{item.elapsed.toFixed(0)}s</span><span>{item.maxBalls}</span><span>{item.safetySaves + item.gravityRescues}</span></div>)}
              </div>
            )}
            <div className="bot-data-actions">
              <button type="button" onClick={exportBotResults} disabled={visibleBotResults.length === 0}>EXPORT JSON</button>
              <button type="button" onClick={clearBotResults} disabled={botRunning || visibleBotResults.length === 0}>CLEAR DATA</button>
            </div>
          </section>
              <div className="panel-note">
                <span>CURRENT TEST SCOPE</span>
                <p>
                  {benchmarkRunMode === "watch"
                    ? "실제 게임과 동일한 캔버스·충돌 물리·웨이브를 봇이 플레이합니다. 화면을 보며 배속을 실시간으로 바꿀 수 있습니다."
                    : "동일한 20개 웨이브 데이터로 시작 스킬 2개, 웨이브 보상과 보스 궁극기를 선택합니다. 충돌 물리는 빠른 통계 모델로 계산됩니다."}
                </p>
              </div>
        </aside>}
      </section>
      {benchmarkMode && <section className="benchmark-dashboard" aria-label="벤치마크 결과 분석">
        <div className="benchmark-dashboard-heading">
          <div><p className="eyebrow">{BENCHMARK_RULESET.toUpperCase()} RESULT ANALYSIS</p><h2>벤치마크 결과</h2></div>
          <span>{visibleBotResults.length} RUNS · W1–W{benchmarkConfig.targetWave}</span>
        </div>
        {visibleBotResults.length === 0 ? <div className="benchmark-empty">
          <strong>아직 분석할 실행 결과가 없습니다.</strong>
          <p>벤치마크 러너를 실행하면 웨이브 도달률, 코어 체력 추이와 회차별 데이터가 이곳에 누적됩니다.</p>
        </div> : <>
          <div className="benchmark-kpis">
            <div><span>W20 완료율</span><strong>{benchmarkCompletionRate.toFixed(0)}%</strong></div>
            <div><span>평균 도달</span><strong>W{botAverageWave.toFixed(1)}</strong></div>
            <div><span>평균 점수</span><strong>{Math.round(benchmarkAverageScore).toLocaleString("ko-KR")}</strong></div>
            <div><span>평균 파괴</span><strong>{benchmarkAverageBricks.toFixed(1)}</strong></div>
            <div><span>평균 콤보</span><strong>{benchmarkAverageCombo.toFixed(1)}</strong></div>
            <div><span>평균 잔여 코어</span><strong>{benchmarkAverageCore.toFixed(1)}</strong></div>
          </div>
          <div className="benchmark-charts">
            <article className="benchmark-chart-card">
              <header><div><span>WAVE REACH RATE</span><strong>웨이브 도달률</strong></div><b>{benchmarkCompletionRate.toFixed(0)}% COMPLETE</b></header>
              <svg viewBox="0 0 600 174" role="img" aria-label="웨이브별 도달률 그래프">
                {[0, 50, 100].map((value) => <g key={value}><line x1="34" x2="576" y1={144 - value / 100 * 126} y2={144 - value / 100 * 126} /><text x="5" y={148 - value / 100 * 126}>{value}%</text></g>)}
                {[1, 5, 10, 15, 20].map((wave) => <text key={wave} x={chartX(wave - 1)} y="166" textAnchor="middle">W{wave}</text>)}
                <polyline className="reach-line" points={reachPoints} />
                {benchmarkWaveStats.map((item, index) => <circle key={item.wave} className="reach-dot" cx={chartX(index)} cy={18 + (100 - item.reachRate) / 100 * 126}><title>W{item.wave} · {item.reachRate.toFixed(0)}%</title></circle>)}
              </svg>
            </article>
            <article className="benchmark-chart-card core-chart">
              <header><div><span>CORE HP BY WAVE</span><strong>도달 시 평균 코어 체력</strong></div><b>{benchmarkAverageCore.toFixed(1)} FINAL</b></header>
              <svg viewBox="0 0 600 174" role="img" aria-label="웨이브별 평균 코어 체력 그래프">
                {[0, 4, 8].map((value) => <g key={value}><line x1="34" x2="576" y1={144 - value / MAX_CORE_HP * 126} y2={144 - value / MAX_CORE_HP * 126} /><text x="15" y={148 - value / MAX_CORE_HP * 126}>{value}</text></g>)}
                {[1, 5, 10, 15, 20].map((wave) => <text key={wave} x={chartX(wave - 1)} y="166" textAnchor="middle">W{wave}</text>)}
                <polyline className="core-line" points={corePoints} />
                {benchmarkWaveStats.map((item, index) => <circle key={item.wave} className="core-dot" cx={chartX(index)} cy={18 + (1 - Math.min(1, item.averageCore / MAX_CORE_HP)) * 126}><title>W{item.wave} · CORE {item.averageCore.toFixed(1)}</title></circle>)}
              </svg>
            </article>
          </div>
          <div className="benchmark-skill-section">
            <div className="benchmark-skill-heading"><div><span>SKILL IMPACT</span><strong>선택 스킬별 성과</strong></div><small>발동·피해·처치는 새 측정 결과부터 집계됩니다.</small></div>
            <div className="benchmark-skill-table" role="table" aria-label="스킬별 벤치마크 성과">
              <div className="benchmark-skill-head" role="row"><span>SKILL</span><span>PICKS</span><span>AVG LV</span><span>W20 CLEAR</span><span>AVG WAVE</span><span>ACT</span><span>DAMAGE</span><span>KILLS</span></div>
              {benchmarkSkillStats.map((skill) => <div key={skill.id} role="row"><strong style={{ color: skill.color }}>{skill.name}</strong><span>{skill.picks}</span><span>{skill.averageLevel.toFixed(1)}</span><span>{skill.clearRate.toFixed(0)}%</span><span>W{skill.averageWave.toFixed(1)}</span><span>{skill.activations}</span><span>{Math.round(skill.damage)}</span><span>{skill.kills}</span></div>)}
            </div>
          </div>
          <div className="benchmark-data-table" role="table" aria-label="벤치마크 회차별 결과">
            <div className="benchmark-data-head" role="row"><span>RUN</span><span>RESULT</span><span>TIME</span><span>SCORE</span><span>BRICKS</span><span>COMBO</span><span>MAX BALLS</span><span>CORE</span><span>START</span><span>BUILD</span></div>
            {benchmarkTableResults.map((item) => <div key={item.id} role="row"><strong>#{item.run}</strong><span>{item.evaluationComplete ? "W20 CLEAR" : `W${item.wave} STOP`}</span><span>{item.elapsed.toFixed(1)}s</span><span>{Math.round(item.score).toLocaleString("ko-KR")}</span><span>{item.bricks}</span><span>{item.maxCombo}</span><span>{item.maxBalls}</span><span>{item.coreHp}/{MAX_CORE_HP}</span><span>{item.startingSkills.map((id) => activeSkillMap[id]?.name ?? id).join(" + ") || "-"}</span><span>{item.upgrades.length}</span></div>)}
          </div>
        </>}
      </section>}
    </main>
  );
}

export default function Home() {
  return <GameRuntime />;
}
