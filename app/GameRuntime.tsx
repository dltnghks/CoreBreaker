"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameAudio } from "./game-audio";
import { DEFAULT_SKILLS, levelValue, NORMAL_SKILLS, normalizeSkillConfigs, SKILL_COLORS, SKILL_MECHANIC_LABELS, SKILL_STORAGE_KEY, skillConfigMap, type ClassSkillId, type SkillCategory, type SkillConfig, type UpgradeId } from "./skill-config";
import { BALANCE_STORAGE_KEY, BOT_LIVE_STORAGE_KEY, BOT_RESULTS_STORAGE_KEY, DEFAULT_BALANCE_CONFIG, DEFAULT_SKILL_BENCH_CONFIG, DEFAULT_SKILL_BENCH_PROGRESS, normalizeBalanceConfig, normalizeSkillBenchConfig, normalizeSkillBenchProgress, SKILL_BENCH_PROGRESS_KEY, SKILL_BENCH_STORAGE_KEY, type BalanceConfig, type BotWaveSample, type SkillBenchConfig, type SkillBenchProgress } from "./balance-config";
import { BENCHMARK_STORAGE_KEY, DEFAULT_BENCHMARK_CONFIG, normalizeBenchmarkConfig, type BenchmarkConfig } from "./benchmark-config";
import { getActiveWaveDefinitions, MAX_WAVE, waveDefinition } from "./wave-config";
import { PARALLEL_BENCHMARK_RULESET, type HeadlessBenchmarkRequest, type HeadlessTimeoutDiagnostic } from "./benchmark-headless";
import { clearBenchmarkResults, getBenchmarkResults, putBenchmarkResults } from "./benchmark-result-store";
import { createBotPolicyState, decideBotControls, POLICY_VERSION, reflectorBankAim, type BotPolicyState } from "./bot-policy";
import { appHref } from "./site-path";
import { SkillSelectionModal } from "./_components/modals/SkillSelectionModal";
import { SkillIconArt } from "./_components/SkillIconArt";
import { BenchmarkDashboard } from "./_components/benchmark/BenchmarkDashboard";
import { useGameLoop } from "./useGameLoop";
import { useGameInput } from "./useGameInput";
import { useGamePresentation } from "./useGamePresentation";
import { useRuntimeSettings } from "./useRuntimeSettings";
import { useBenchmarkSession } from "./useBenchmarkSession";
import { useGameRuntimeController } from "./useGameRuntimeController";
import { hudSnapshotFromGame, hudSnapshotsEqual, type HudSnapshot } from "./hud-snapshot";
import { createCanonicalState, dispatchCanonicalCommand, ENGINE_PARITY, ENGINE_VERSION, stepCanonicalEngine, type CanonicalState, type CanonicalStepResult } from "./canonical-engine";
import { projectCanonicalStateIntoGameView } from "./game-runtime-projection";
import { emitGameEvent, type GameEventBuffer } from "./game-events";
import { renderGameRuntimeCanvas } from "./game-runtime-canvas";
import { createReplayRecorder, type ReplayLog } from "./debug-replay";

import type {
  Ball,
  BenchmarkRunMode,
  BenchmarkRuleset,
  BossRewardId,
  BotPolicy,
  BotRunResult,
  BotSpeed,
  Brick,
  BrickTrait,
  GameState,
  GhostRecord,
  ItemKind,
  PaddleCounter,
  PayloadId,
  SkillBenchVariant,
  SkillRunMetric,
  SkillSelectionSource,
  Upgrade,
  UpgradeChoice,
} from "./_types/game";
const W = 900;
const H = 600;
const BENCHMARK_RULESET: BenchmarkRuleset = PARALLEL_BENCHMARK_RULESET;
const PLAYER_PADDLE_Y = H - 70;
const GHOST_PADDLE_Y = H - 42;
const BRICK_ROW_Y = 74;
const BRICK_ROW_STEP = 34;
const STARTING_WAVE_ELAPSED = 0;
const MAX_CORE_HP = 8;
const BOSS_INTERVAL = 10;
const NORMAL_STAGE_MULTIBALL_WAVES = [2, 4, 6, 8, 11, 13, 16, 18];
const BOT_EVALUATION_WAVE = MAX_WAVE;
const BASE_BALL_VX = 240;
const BASE_BALL_VY = 320;
const OVERDRIVE_RATE_PER_SECOND = 0.01;
const MAX_OVERDRIVE_LEVEL = 50;
const MAX_PADDLE_REBOUND_RATIO = 0.84;
const PADDLE_KEYBOARD_SPEED = 460;
const KEYBOARD_AIM_RATIO_SPEED = 1.2;
const MIN_AIM_VERTICAL_DISTANCE = 52;
const AIM_LINE_LENGTH = 170;
const KEYBOARD_AIM_TARGET_DISTANCE = AIM_LINE_LENGTH;

function paddleAimDirection(fromX: number, fromY: number, targetX: number, targetY: number) {
  const deltaX = targetX - fromX;
  const deltaY = Math.min(-MIN_AIM_VERTICAL_DISTANCE, targetY - fromY);
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const rawHorizontalRatio = deltaX / distance;
  const horizontalRatio = Math.max(-MAX_PADDLE_REBOUND_RATIO, Math.min(MAX_PADDLE_REBOUND_RATIO, rawHorizontalRatio));
  return {
    horizontalRatio,
    verticalRatio: -Math.sqrt(Math.max(0, 1 - horizontalRatio * horizontalRatio)),
    limited: Math.abs(rawHorizontalRatio) > MAX_PADDLE_REBOUND_RATIO,
  };
}
const RING_EXPLOSION_ASSET = "/assets/vfx/ring-explosion.png";
const HIT_SPARK_ASSETS = ["/assets/vfx/hit-spark-a.png", "/assets/vfx/hit-spark-b.png"] as const;
const RADIAL_LIGHTNING_ASSET = "/assets/vfx/radial-lightning.png";
const MAGE_SPELL_ASSETS = ["/assets/vfx/mage-fireball.png", "/assets/vfx/mage-sparks.png"] as const;
const MAX_ACTIVE_FLASHES = 120;
const PLAYER_BALL_COLOR = "#fff27a";
const WAVE_MULTIBALL_COLOR = "#9aa3b2";
let environmentRandom = () => Math.random();
let decisionRandom = () => Math.random();

function overdriveMultiplier(level: number) {
  return 1 + Math.max(0, Math.min(MAX_OVERDRIVE_LEVEL, level)) * OVERDRIVE_RATE_PER_SECOND;
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
    return;
  }
  environmentRandom = seededRandom(seed);
  decisionRandom = seededRandom(seed ^ 0x9e3779b9);
}
const PAYLOAD_IDS: PayloadId[] = ["pierce", "blast", "glass", "link"];
const ITEM_DATA: Record<ItemKind, { label: string; symbol: string; color: string }> = {
  multiball: { label: "MULTI BALL", symbol: "+", color: "#ffcf4a" },
  "auto-barrier": { label: "AUTO BARRIER", symbol: "B", color: "#65dcff" },
  "core-repair": { label: "CORE REPAIR", symbol: "C", color: "#72f1b8" },
  "cooldown-reset": { label: "COOLDOWN RESET", symbol: "R", color: "#c18cff" },
};
const ITEM_KINDS = Object.keys(ITEM_DATA) as ItemKind[];
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
    tag: `${CLASS_META[skill.category].tag} 쨌 ${SKILL_MECHANIC_LABELS[skill.mechanic]}`,
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

function skillValue(id: UpgradeId, level: number) {
  const config = activeSkillMap[id];
  return level <= 0 || !config ? 0 : levelValue(level, config.levels);
}

function activePresentationSkill(id: string) {
  return activeSkillMap[id as UpgradeId];
}

function enhancedSkillValue(id: UpgradeId, level: number, enhancement = 0) {
  const base = skillValue(id, level);
  if (!base || enhancement <= 0) return base;
  const config = activeSkillMap[id];
  if (!config) return base;
  const step = Math.max(config.direction === "down" ? 0.2 : 1, Math.abs(config.levels[2] - config.levels[1]));
  return config.direction === "down" ? Math.max(0.2, base - enhancement * step) : base + enhancement * step;
}

function formatSkillNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatSkillDelta(value: number, unit: string) {
  return `${value >= 0 ? "+" : ""}${formatSkillNumber(value)}${unit}`;
}

function classSkillColor(id: ClassSkillId) {
  return activeSkillMap[id]?.color ?? SKILL_COLORS[id];
}

function ghostPaddleY() {
  return GHOST_PADDLE_Y;
}

function ghostPaddleWidth(ghost: GhostRecord) {
  return Math.min(260, 92 + skillValue("wide", upgradeLevel(ghost.upgrades, "wide")));
}

function upgradeLevel(upgrades: UpgradeId[], id: UpgradeId) {
  if (!Array.isArray(upgrades)) return 0;
  return Math.min(3, upgrades.filter((upgrade) => upgrade === id).length);
}

function skillPickCount(upgrades: UpgradeId[], id: UpgradeId) {
  if (!Array.isArray(upgrades)) return 0;
  return upgrades.filter((upgrade) => upgrade === id).length;
}

function isSkillEvolved(upgrades: UpgradeId[], id: UpgradeId) {
  return Boolean(activeSkillMap[id]?.evolution) && skillPickCount(upgrades, id) >= 4;
}

function ballBodyColor(ball: Pick<Ball, "waveBonus" | "temporaryTime" | "visualSkill">) {
  return ball.waveBonus || ball.temporaryTime > 0 || ball.visualSkill !== null ? WAVE_MULTIBALL_COLOR : PLAYER_BALL_COLOR;
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
  ball.attackPower = Math.max(1, 1 + commonDamage + corrosionPower + enchantPower);
  ball.color = ballBodyColor(ball);
}

function pickBrickDrop(): ItemKind | null {
  if (environmentRandom() >= 0.055) return null;
  const utilityDrops: ItemKind[] = ["auto-barrier", "core-repair", "cooldown-reset"];
  return utilityDrops[Math.floor(environmentRandom() * utilityDrops.length)];
}

function hasScheduledMultiball(wave: number) {
  const waveInStage = ((wave - 1) % BOSS_INTERVAL) + 1;
  return NORMAL_STAGE_MULTIBALL_WAVES.includes(waveInStage);
}

function brickRuntimeState(trait: BrickTrait = "standard") {
  return { trait, guardReady: trait === "guard", healTimer: 3, poisonTime: 0, poisonTick: 0, poisonSourcePaddleId: null, burnTime: 0, burnTick: 0, burnLevel: 0, burnSourcePaddleId: null, healBlockTime: 0, blastVulnerability: 1, blastVulnerabilitySourcePaddleId: null, frostVulnerability: 0, traitLockTime: 0, lastHitPaddleId: null };
}

function lateWaveHpMultiplier(waveNumber: number) {
  return waveNumber >= 16 ? 2.5 : waveNumber >= 11 ? 1.9 : waveNumber >= 6 ? 1.45 : waveNumber >= 4 ? 1.15 : 1;
}

function isDamageableBrick(brick: Brick) {
  return brick.trait !== "indestructible";
}

function isBotAimableBrick(brick: Brick, originY: number) {
  if (!brick.alive || !isDamageableBrick(brick)) return false;
  const protectedReflectorFace = brick.trait === "reflector"
    && brick.traitLockTime <= 0
    && originY > brick.y + brick.h;
  return !protectedReflectorFace;
}

function chooseBotAimTarget(bricks: Brick[], originX: number, originY: number) {
  const traitPriority: Record<Exclude<BrickTrait, "indestructible">, number> = {
    healer: 0,
    explosive: 1,
    guard: 2,
    standard: 3,
    reflector: 4,
  };
  return bricks
    .filter((brick) => isBotAimableBrick(brick, originY))
    .sort((a, b) => {
      const bossDifference = Number(b.kind === "boss-core") - Number(a.kind === "boss-core");
      if (bossDifference !== 0) return bossDifference;
      const traitDifference = traitPriority[a.trait as Exclude<BrickTrait, "indestructible">]
        - traitPriority[b.trait as Exclude<BrickTrait, "indestructible">];
      if (traitDifference !== 0) return traitDifference;
      if (a.y !== b.y) return b.y - a.y;
      const aCenter = a.x + a.w / 2;
      const bCenter = b.x + b.w / 2;
      const distanceDifference = Math.abs(aCenter - originX) - Math.abs(bCenter - originX);
      return distanceDifference !== 0 ? distanceDifference : aCenter - bCenter;
    })[0] ?? null;
}

function protectedReflectorBlockingAim(bricks: Brick[], originX: number, originY: number, targetX: number, targetY: number) {
  const verticalTravel = targetY - originY;
  if (verticalTravel >= 0) return null;
  return bricks
    .filter((brick) => brick.alive && brick.trait === "reflector" && brick.traitLockTime <= 0)
    .filter((brick) => {
      const protectedFaceY = brick.y + brick.h;
      if (protectedFaceY >= originY || protectedFaceY <= targetY) return false;
      const contactTime = (protectedFaceY - originY) / verticalTravel;
      const contactX = originX + (targetX - originX) * contactTime;
      return contactX >= brick.x - 8 && contactX <= brick.x + brick.w + 8;
    })
    .sort((a, b) => b.y + b.h - (a.y + a.h))[0] ?? null;
}

function reflectorWeakSideBankAim(reflector: Brick, originX: number, phase: number, reflectors: Brick[]) {
  return reflectorBankAim(reflector, originX, phase, reflectors);
}

function botAimPoint(bricks: Brick[], originX: number, originY: number, phase = 0) {
  const target = chooseBotAimTarget(bricks, originX, originY);
  if (target) {
    const targetX = target.x + target.w / 2;
    const targetY = target.y + target.h / 2;
    const blockingReflector = protectedReflectorBlockingAim(bricks, originX, originY, targetX, targetY);
    if (!blockingReflector) return { x: targetX, y: targetY, target };
    const bank = reflectorWeakSideBankAim(target, originX, phase, bricks.filter((brick) => brick.alive && brick.trait === "reflector"));
    return { x: bank.x, y: bank.y, target: blockingReflector };
  }

  // Rotate through remaining reflectors and their weak sides so a constrained bank
  // shot cannot settle into one protected-underside loop forever.
  const reflectors = bricks
    .filter((brick) => brick.alive && brick.trait === "reflector")
    .sort((a, b) => b.y - a.y || a.x - b.x);
  if (reflectors.length > 0) {
    const reflector = reflectors[Math.floor(phase / 2) % reflectors.length];
    const bank = reflectorWeakSideBankAim(reflector, originX, phase, reflectors);
    return { x: bank.x, y: bank.y, target: reflector };
  }
  return { x: W / 2, y: BRICK_ROW_Y, target: null };
}

function newPaddleCounter(): PaddleCounter {
  return { reflections: 0, barrierReflections: 0, missileReflections: 0, safetyTimer: 0, gravityTimer: 0, directKills: 0, pierceKills: 0, feverMilestone: 0, lastShotTimer: 0, combo: 0, comboTimer: 0, skillCooldowns: {} };
}

function makeWaveBricks(waveNumber: number, balance = DEFAULT_BALANCE_CONFIG): Brick[] {
  const definition = waveDefinition(waveNumber);
  if (definition.boss) return makeBossBricks(definition.boss === "final" ? 4 : definition.boss === "late" ? 3 : definition.boss === "mid" ? 2 : 1, 0, balance, definition.hpMultiplier);
  const cols = 12;
  const gap = 7;
  const margin = 36;
  const width = (W - margin * 2 - gap * (cols - 1)) / cols;
  const baseHp = 1 + Math.floor((waveNumber - 1) / Math.max(1, Math.round(balance.baseHpWaveStep)));
  const multiballCells = definition.pattern.flatMap((row, rowIndex) => [...row].map((cell, col) => ({ cell, rowIndex, col }))).filter(({ cell }) => cell !== "." && cell !== "x");
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
    const maxHp = Math.ceil((baseHp + hpBonus) * lateWaveHpMultiplier(waveNumber) * definition.hpMultiplier);
    return [{
      x: margin + col * (width + gap), y: BRICK_ROW_Y + rowIndex * BRICK_ROW_STEP, w: width, h: 24,
      hp: maxHp, maxHp, hue: 178 + waveNumber * 9 + col * 2, alive: true, kind: "normal" as const,
      drop: trait === "indestructible" ? null : multiballKey?.rowIndex === rowIndex && multiballKey.col === col ? "multiball" as const : pickBrickDrop(),
      ...brickRuntimeState(trait),
    }];
  }));
}

function makeBossBricks(stage: number, ghostCount: number, balance: BalanceConfig, waveHpMultiplier = 1): Brick[] {
  const cols = 4;
  const rows = 3;
  const cellWidth = 104;
  const cellHeight = 34;
  const width = cols * cellWidth;
  const height = rows * cellHeight;
  const startX = (W - width) / 2;
  const startY = 94;
  const bossHpMultiplier = [1, 0.85, 0.95, 1.05, 1.2][Math.min(4, stage)] ?? 0.85;
  const earlyBossHealthScale = stage <= 2 ? 0.4 : 1;
  const coreHp = Math.round((balance.bossBaseHp + stage * balance.bossHpPerStage * 0.55 + ghostCount * 10) * bossHpMultiplier * waveHpMultiplier * 0.5 * earlyBossHealthScale);
  return [{
    x: startX, y: startY, w: width, h: height,
    hp: coreHp, maxHp: coreHp,
    hue: 345, alive: true, kind: "boss-core",
    drop: "multiball",
    ...brickRuntimeState(),
  }];
}

function makeInitialBricks(ghostCount: number, balance: BalanceConfig): Brick[] {
  return makeWaveBricks(1, balance);
}

function makePlayerBall(upgrades: UpgradeId[], x = W / 2): Ball {
  const speed = 1 + upgrades.filter((u) => u === "speed").length * 0.12;
  const ball: Ball = { x, y: H - 72, vx: BASE_BALL_VX * speed, vy: -BASE_BALL_VY * speed, radius: 8 + skillValue("common-ball-size", upgradeLevel(upgrades, "common-ball-size")), owner: "player", pierce: 0, maxPierce: 0, blast: 0, payload: null, payloadLevel: 0, payloads: {}, attackPower: 1, color: PLAYER_BALL_COLOR, sourcePaddleId: "player", missileTime: 0, missileHitCooldown: 0, gravityRescueCooldown: 0, gravityBaseSpeed: null, explosionBaseSpeed: null, explosionBoostRatio: 1, explosionBoostTime: 0, canTriggerSkills: true, skillGeneration: 0, skillCharges: {}, skillCooldowns: {}, visualSkill: null, temporaryTime: 0, waveBonus: false, respawnRecoveryTime: 0, respawnRecoveryDuration: 0, respawnRecoveryBaseSpeed: 0 };
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
    particlePool: [],
    particlePoolCursor: 0,
    flashes: activeGhosts.length > 0 ? [{ text: `ECHO PRESSURE +${activeGhosts.length * 12}%`, x: W / 2, y: H / 2, life: 1.5, color: "#ff6b87" }] : [],
    effects: [],
    effectPool: [],
    effectPoolCursor: 0,
    items: [],
    safetyBlocks: [],
    gravityWells: [],
    paddleBarriers: {},
    itemBarrierTime: 0,
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
    bossEnhancements: {},
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
    coreBreakTime: 0,
    coreBreakDuration: 0,
    coreBreakX: W / 2,
    coreBreakY: PLAYER_PADDLE_Y + 35,
    wave: 1,
    pendingWave: null,
    failed: false,
    failureReason: null,
    botMetrics: { maxBalls: 1, ballLosses: 0, missileActivations: 0, safetySaves: 0, gravityRescues: 0 },
    botWaveSamples: [],
    botSampleKey: "",
  };
}

function formatScore(value: number) {
  return Math.floor(value).toLocaleString("ko-KR");
}

function hudFromGame(game: GameState) {
  return hudSnapshotFromGame(game, {
    waveName: waveDefinition(game.wave).name,
    overdriveMultiplier: overdriveMultiplier(game.overdriveLevel),
    upgradeLevel,
  });
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

function pickUpgradeChoices(existing: UpgradeId[], catalog: Upgrade[], excluded: UpgradeId[] = []) {
  const weighted = catalog
    .filter((upgrade) => !excluded.includes(upgrade.id))
    .filter((upgrade) => skillPickCount(existing, upgrade.id) < (activeSkillMap[upgrade.id]?.evolution ? 4 : 3))
    .map((upgrade) => ({ upgrade, offerRoll: decisionRandom() }))
    .sort((a, b) => a.offerRoll - b.offerRoll || a.upgrade.id.localeCompare(b.upgrade.id))
    .map(({ upgrade }) => upgrade);
  if (weighted.length <= 3) return weighted;
  const newOnes = weighted.filter((u) => !existing.includes(u.id));
  const repeats = weighted.filter((u) => existing.includes(u.id));
  return [...newOnes.slice(0, 2), ...repeats, ...weighted].filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i).slice(0, 3);
}

function priceUpgradeChoices(upgrades: Upgrade[]): UpgradeChoice[] {
  return upgrades.map((upgrade) => ({ upgrade, ballCost: 0 }));
}

function chooseBotUpgrade(choices: Upgrade[], existing: UpgradeId[], policy: BotPolicy) {
  if (policy === "random") return choices[Math.floor(decisionRandom() * choices.length)];
  const categoryWeight: Record<BotPolicy, Partial<Record<SkillCategory, number>>> = {
    balanced: { warrior: 3, archer: 3, mage: 3, common: 2.5 },
    survival: { warrior: 5, archer: 2, mage: 4, common: 3.5 },
    random: {},
  };
  return choices
    .map((upgrade) => ({
      upgrade,
      score: (categoryWeight[policy][upgrade.category] ?? 0) + (existing.includes(upgrade.id) ? 0.35 : 1.2) + decisionRandom() * 1.75,
    }))
    .sort((a, b) => b.score - a.score || a.upgrade.id.localeCompare(b.upgrade.id))[0].upgrade;
}

export type GameRuntimeProps = { benchmarkMode?: boolean };

export function GameRuntime({ benchmarkMode = false }: GameRuntimeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ringExplosionRef = useRef<HTMLImageElement | null>(null);
  const ringExplosionReadyRef = useRef(false);
  const hitSparkRefs = useRef<Array<HTMLImageElement | null>>([null, null]);
  const hitSparkReadyRef = useRef([false, false]);
  const radialLightningRef = useRef<HTMLImageElement | null>(null);
  const radialLightningReadyRef = useRef(false);
  const mageSpellRefs = useRef<Array<HTMLImageElement | null>>([null, null]);
  const mageSpellReadyRef = useRef([false, false]);
  const gameRef = useRef<GameState | null>(null);
  // Frame-scoped side effects are emitted by update code and consumed by the
  // canvas/audio boundary immediately before rendering the next frame.
  const gameEventsRef = useRef<GameEventBuffer>({ events: [] });
  const replayRecorderRef = useRef<ReturnType<typeof createReplayRecorder> | null>(null);
  const replayFrameRef = useRef(0);
  const [replayJson, setReplayJson] = useState("");
  const replayPublishAtRef = useRef(0);
  const publishReplay = useCallback(() => {
    if (typeof window === "undefined" || !replayRecorderRef.current) return;
    const now = performance.now();
    if (now - replayPublishAtRef.current < 250) return;
    replayPublishAtRef.current = now;
    setReplayJson(replayRecorderRef.current.exportJson());
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const debugWindow = window as Window & { __echoReplay?: { export: () => ReplayLog | null } };
    debugWindow.__echoReplay = { export: () => replayRecorderRef.current?.log ?? null };
    return () => { delete debugWindow.__echoReplay; delete (debugWindow as Window & { __echoReplayJson?: string }).__echoReplayJson; };
  }, []);
  // Populated when the caller explicitly opts into canonical simulation.
  const canonicalStateRef = useRef<CanonicalState | null>(null);
  const activeGhostsRef = useRef<GhostRecord[]>([]);
  const { pointerXRef, pointerYRef, aimInputModeRef, keyboardAimRef, keyboardRef, onPointerMove } = useGameInput({
    canvasRef,
    gameRef,
    width: W,
    height: H,
    paddleY: PLAYER_PADDLE_Y,
    aimDirection: paddleAimDirection,
  });
  const botPaddleTargetXRef = useRef(W / 2);
  const botMoveRef = useRef<-1 | 0 | 1>(0);
  const botPolicyStateRef = useRef<BotPolicyState>(createBotPolicyState(1));
  const runningRef = useRef(false);
  const loopEnabledRef = useRef(false);
  const levelUpRef = useRef(false);
  const resetLoopClockRef = useRef<() => void>(() => undefined);
  const startRunRef = useRef<(asBot?: boolean) => void>(() => undefined);
  const upgradeCatalogRef = useRef<Upgrade[]>(DEFAULT_UPGRADES);
  const audioRef = useRef<GameAudio | null>(null);
  const botActiveRef = useRef(false);
  const benchmarkWatchRef = useRef(false);
  // Terminal canonical states can be observed for more than one frame while
  // the canvas is still being rendered. Keep the React lifecycle transition
  // idempotent across those frames (and across the legacy/dual-run paths).
  const canonicalTerminalRef = useRef<"complete" | "game-over" | null>(null);
  const botPolicyRef = useRef<BotPolicy>("balanced");
  const botSpeedRef = useRef<BotSpeed>(1);
  const botTargetRunsRef = useRef(5);
  const botCompletedRunsRef = useRef(0);
  const botResultsRef = useRef<BotRunResult[]>([]);
  const parallelWorkersRef = useRef<Worker[]>([]);
  const parallelSessionRef = useRef(0);
  const parallelPendingResultsRef = useRef<BotRunResult[]>([]);
  const parallelFlushRef = useRef<() => void>(() => { });
  const balanceConfigRef = useRef<BalanceConfig>(DEFAULT_BALANCE_CONFIG);
  const activeSkillConfigsRef = useRef<SkillConfig[]>(DEFAULT_SKILLS);
  const botLivePersistRef = useRef(0);
  const skillBenchConfigRef = useRef<SkillBenchConfig>(DEFAULT_SKILL_BENCH_CONFIG);
  const skillBenchProgressRef = useRef<SkillBenchProgress>(DEFAULT_SKILL_BENCH_PROGRESS);
  const botSkillBenchActiveRef = useRef(false);
  const botSkillBenchVariantRef = useRef<SkillBenchVariant | null>(null);
  const benchmarkConfigRef = useRef<BenchmarkConfig>(DEFAULT_BENCHMARK_CONFIG);
  const {
    mode,
    setMode,
    transitionWave,
    setTransitionWave,
    clearedWave,
    setClearedWave,
    transitionTimersRef,
    rewardOpeningRef,
  } = useGameRuntimeController();

  const [ghosts, setGhosts] = useState<GhostRecord[]>([]);
  const [, setSelectedIds] = useState<string[]>([]);
  const [hud, setHudState] = useState<HudSnapshot>({ score: 0, time: 0, level: 1, combo: 0, bricks: 0, balls: 1, wave: 1, nextRow: STARTING_WAVE_ELAPSED, coreHp: MAX_CORE_HP, maxCoreHp: MAX_CORE_HP, barriers: 0, overdriveLevel: 0, overdriveMultiplier: 1, bossActive: false, bossPending: false, nextBossWave: BOSS_INTERVAL, bossTimeRemaining: 0, waveName: waveDefinition(1).name, aliveBricks: 0, skillLevels: [] });
  const lastHudSnapshotRef = useRef<HudSnapshot | null>(null);
  const setHud = useCallback((next: HudSnapshot) => {
    if (hudSnapshotsEqual(lastHudSnapshotRef.current, next)) return;
    lastHudSnapshotRef.current = next;
    setHudState(next);
  }, []);
  const { advancePresentation, consumePresentationEvents } = useGamePresentation({
    gameRef,
    audioRef,
    eventsRef: gameEventsRef,
    getSkill: activePresentationSkill,
    width: W,
    height: H,
    maxFlashes: MAX_ACTIVE_FLASHES,
  });
  const [choices, setChoices] = useState<UpgradeChoice[]>([]);
  const [bossRewardChoices, setBossRewardChoices] = useState<UpgradeId[]>([]);
  const [rerollsLeft, setRerollsLeft] = useState(1);
  const [result, setResult] = useState<GameState | null>(null);
  const [, setSavedMessage] = useState("");
  const [upgradeCatalog, setUpgradeCatalog] = useState<Upgrade[]>(DEFAULT_UPGRADES);
  const { soundEnabled, isFullscreen, toggleSound, toggleFullscreen } = useRuntimeSettings(audioRef);
  const { createWorkers, stopWorkers } = useBenchmarkSession();

  const [botPolicy, setBotPolicy] = useState<BotPolicy>("balanced");
  const [botSpeed, setBotSpeed] = useState<BotSpeed>(1);
  const [benchmarkRunMode, setBenchmarkRunMode] = useState<BenchmarkRunMode>("watch");
  const [botTargetRuns, setBotTargetRuns] = useState(5);
  const [botRunning, setBotRunning] = useState(false);
  const [botCompletedRuns, setBotCompletedRuns] = useState(0);
  const [parallelWorkerCount, setParallelWorkerCount] = useState(0);
  const [botResults, setBotResults] = useState<BotRunResult[]>([]);
  const [skillBenchConfig, setSkillBenchConfig] = useState<SkillBenchConfig>(DEFAULT_SKILL_BENCH_CONFIG);
  const [skillBenchProgress, setSkillBenchProgress] = useState<SkillBenchProgress>(DEFAULT_SKILL_BENCH_PROGRESS);
  const [benchmarkConfig, setBenchmarkConfig] = useState<BenchmarkConfig>(DEFAULT_BENCHMARK_CONFIG);

  useEffect(() => () => {
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    transitionTimersRef.current = [];
    rewardOpeningRef.current = false;
    parallelFlushRef.current();
    parallelSessionRef.current += 1;
    stopWorkers(parallelWorkersRef.current);
    parallelWorkersRef.current = [];
  }, [rewardOpeningRef, stopWorkers, transitionTimersRef]);

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
        const catalog = createUpgradeCatalog(skills);
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
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem("echo-breaker-ghosts-v1");
        if (saved) setGhosts(JSON.parse(saved));
      } catch {
        setGhosts([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
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

  const startCanonicalNextWave = useCallback(() => {
    const state = canonicalStateRef.current;
    const game = gameRef.current;
    if (!state || !game) return false;
    const ready = dispatchCanonicalCommand(state, { type: "start-next-wave" });
    if (ready.outcome.type !== "running") return false;
    ready.events.forEach((event) => emitGameEvent(gameEventsRef.current, event));
    gameRef.current = projectCanonicalStateIntoGameView(game, state);
    levelUpRef.current = false;
    rewardOpeningRef.current = false;
    setClearedWave(null);
    setTransitionWave(state.wave);
    setMode("transition");
    runningRef.current = false;
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    transitionTimersRef.current = [window.setTimeout(() => {
      setTransitionWave(null);
      setMode("playing");
      runningRef.current = true;
      resetLoopClockRef.current();
      transitionTimersRef.current = [];
    }, botActiveRef.current ? 0 : 700)];
    return true;
  }, [rewardOpeningRef, setClearedWave, setMode, setTransitionWave, transitionTimersRef]);

  const applyUpgrade = useCallback((upgrade: Upgrade, ballCost: 0 | 1 | 2 = 0, source: Exclude<SkillSelectionSource, "boss"> = "wave") => {
    const game = gameRef.current;
    const canonical = canonicalStateRef.current;
    if (!game || !canonical) return;
    const result = dispatchCanonicalCommand(canonical, source === "start"
      ? { type: "choose-start-skill", skillId: upgrade.id, ballCost }
      : { type: "choose-wave-skill", skillId: upgrade.id, ballCost });
    result.events.forEach((event) => emitGameEvent(gameEventsRef.current, event));
    const projected = projectCanonicalStateIntoGameView(game, canonical);
    gameRef.current = projected;
    setHud(hudFromGame(projected));
    if (source === "start" && result.outcome.type === "running") {
      levelUpRef.current = false;
      runningRef.current = true;
      setMode("playing");
      resetLoopClockRef.current();
      return;
    }
    if (result.outcome.type === "ready-for-next-wave") startCanonicalNextWave();
  }, [setHud, setMode, startCanonicalNextWave]);

  const applyBossReward = useCallback((rewardId: BossRewardId) => {
    const game = gameRef.current;
    const canonical = canonicalStateRef.current;
    if (!game || !canonical) return;
    const result = dispatchCanonicalCommand(canonical, { type: "choose-boss-reward", skillId: rewardId });
    result.events.forEach((event) => emitGameEvent(gameEventsRef.current, event));
    const projected = projectCanonicalStateIntoGameView(game, canonical);
    gameRef.current = projected;
    setHud(hudFromGame(projected));
    if (result.outcome.type === "ready-for-next-wave") startCanonicalNextWave();
  }, [setHud, startCanonicalNextWave]);

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
        policyVersion: POLICY_VERSION,
        engineVersion: benchmarkWatchRef.current ? ENGINE_VERSION : undefined,
        engineParity: benchmarkWatchRef.current ? ENGINE_PARITY : undefined,
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
  }, [benchmarkMode, setMode]);

  const handleCanonicalOutcome = useCallback((outcome: "complete" | "game-over") => {
    if (canonicalTerminalRef.current !== null) return;
    canonicalTerminalRef.current = outcome;
    // `finishRun` is the single UI terminal path: it records bot results,
    // snapshots the projected final state, stops simulation, and switches
    // to the result screen.
    finishRun();
  }, [finishRun]);

  const rerollUpgradeChoices = useCallback(() => {
    if (rerollsLeft <= 0) return;
    const canonical = canonicalStateRef.current;
    if (canonical?.phase === "awaiting-start-skill" || canonical?.phase === "awaiting-wave-skill") {
      const result = dispatchCanonicalCommand(canonical, { type: "reroll-skills" });
      if (result.outcome.type === "start-skill" || result.outcome.type === "wave-skill") {
        setChoices(result.outcome.choices);
        setRerollsLeft(result.outcome.rerollsLeft);
        audioRef.current?.play("item", 1.2);
        return;
      }
    }
  }, [rerollsLeft]);

  const skipUpgradeChoice = useCallback(() => {
    const canonical = canonicalStateRef.current;
    if (canonical?.phase === "awaiting-wave-skill") {
      const result = dispatchCanonicalCommand(canonical, { type: "skip-wave-skill" });
      if (result.outcome.type === "ready-for-next-wave" && startCanonicalNextWave()) return;
    }
  }, [startCanonicalNextWave]);

  const selectInitialSkill = useCallback((upgrade: Upgrade) => {
    applyUpgrade(upgrade, 0, "start");
  }, [applyUpgrade]);

  const handleCanonicalPhase = useCallback((result: CanonicalStepResult) => {
    const state = canonicalStateRef.current;
    if (!state || result.outcome.type !== "wave-clear" || rewardOpeningRef.current) return;
    rewardOpeningRef.current = true;
    runningRef.current = false;
    setClearedWave({ wave: result.outcome.wave, boss: result.outcome.boss });
    setMode("waveclear");
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    transitionTimersRef.current = [window.setTimeout(() => {
      setClearedWave(null);
      let next = dispatchCanonicalCommand(state, { type: "acknowledge-wave-clear" });
      if (botActiveRef.current) {
        if (next.outcome.type === "wave-skill" || next.outcome.type === "start-skill") {
          const offered = next.outcome.choices;
          if (offered.length) {
            const selected = chooseBotUpgrade(offered.map((choice) => choice.upgrade), state.upgrades, botPolicyRef.current);
            const choice = offered.find((entry) => entry.upgrade.id === selected.id) ?? offered[0];
            next = dispatchCanonicalCommand(state, { type: "choose-wave-skill", skillId: choice.upgrade.id, ballCost: choice.ballCost });
          }
        } else if (next.outcome.type === "boss-reward") {
          const rewardId = next.outcome.choices.slice().sort((a, b) => (state.bossEnhancements[a] ?? 0) - (state.bossEnhancements[b] ?? 0))[0];
          if (rewardId) next = dispatchCanonicalCommand(state, { type: "choose-boss-reward", skillId: rewardId });
        }
        if (next.outcome.type === "ready-for-next-wave") startCanonicalNextWave();
        return;
      }
      rewardOpeningRef.current = false;
      if (next.outcome.type === "wave-skill") {
        levelUpRef.current = true;
        setChoices(next.outcome.choices);
        setRerollsLeft(next.outcome.rerollsLeft);
        setMode("levelup");
      } else if (next.outcome.type === "boss-reward") {
        setBossRewardChoices(next.outcome.choices);
        setMode("bossreward");
      } else if (next.outcome.type === "ready-for-next-wave") {
        startCanonicalNextWave();
      }
    }, botActiveRef.current ? 0 : 760)];
  }, [rewardOpeningRef, setClearedWave, setMode, startCanonicalNextWave, transitionTimersRef]);

  // Canonical-only mode intentionally bypasses the legacy updateGame pipeline.
  // The canonical state is the sole simulation owner; the legacy GameState is
  // only a render/HUD compatibility projection at this boundary.
  const canonicalStep = useCallback((dt: number): "complete" | "game-over" | "paused" | null => {
    const game = gameRef.current;
    const state = canonicalStateRef.current;
    if (!game || !state) throw new Error("canonical-only run started without canonical state");
    if (state.complete) return "complete";
    if (state.gameOver) return "game-over";
    let move = (Number(keyboardRef.current.right) - Number(keyboardRef.current.left)) as -1 | 0 | 1;
    let aimX = pointerXRef.current;
    let aimY = pointerYRef.current;
    if (botActiveRef.current) {
      const controls = decideBotControls({
        elapsed: state.elapsed,
        paddleX: state.paddleX,
        paddleWidth: state.paddleWidth,
        paddleSpeed: PADDLE_KEYBOARD_SPEED,
        balls: state.balls,
        bricks: state.bricks,
        items: state.items,
      }, botPolicyStateRef.current, dt);
      move = controls.move;
      aimX = controls.aimX;
      aimY = controls.aimY;
      botMoveRef.current = controls.move;
      pointerXRef.current = aimX;
      pointerYRef.current = aimY;
    } else if (aimInputModeRef.current === "keyboard") {
      const aimMovement = Number(keyboardAimRef.current.right) - Number(keyboardAimRef.current.left);
      keyboardAimRef.current.horizontalRatio = Math.max(-MAX_PADDLE_REBOUND_RATIO, Math.min(MAX_PADDLE_REBOUND_RATIO, keyboardAimRef.current.horizontalRatio + aimMovement * KEYBOARD_AIM_RATIO_SPEED * dt));
      const horizontalRatio = keyboardAimRef.current.horizontalRatio;
      const verticalRatio = -Math.sqrt(Math.max(0, 1 - horizontalRatio * horizontalRatio));
      aimX = state.paddleX + horizontalRatio * KEYBOARD_AIM_TARGET_DISTANCE;
      aimY = PLAYER_PADDLE_Y + verticalRatio * KEYBOARD_AIM_TARGET_DISTANCE;
    }
    const stepResult = stepCanonicalEngine(state, {
      move,
      aimX,
      aimY,
    }, dt);
    stepResult.events.forEach((event) => emitGameEvent(gameEventsRef.current, event));
    const view = projectCanonicalStateIntoGameView(game, state);
    gameRef.current = view;
    replayRecorderRef.current?.record(replayFrameRef.current++, dt, { move, aimX, aimY }, view);
    publishReplay();
    setHud(hudFromGame(view));
    if (state.complete || state.gameOver) {
      runningRef.current = false;
      return state.complete ? "complete" : "game-over";
    }
    if (stepResult.outcome.type !== "running") {
      handleCanonicalPhase(stepResult);
      return "paused";
    }
    return null;
  }, [aimInputModeRef, handleCanonicalPhase, keyboardAimRef, keyboardRef, pointerXRef, pointerYRef, publishReplay, setHud]);

  const drawGame = useCallback((dt: number) => {
    const game = gameRef.current;
    const canvas = canvasRef.current;
    if (!game || !canvas) return;
    advancePresentation(dt);
    consumePresentationEvents();
    renderGameRuntimeCanvas({
      canvas,
      game,
      activeGhosts: activeGhostsRef.current,
      botActive: botActiveRef.current,
      pointerX: pointerXRef.current,
      pointerY: pointerYRef.current,
      ringExplosion: ringExplosionRef.current,
      ringExplosionReady: ringExplosionReadyRef.current,
      hitSparks: hitSparkRefs.current,
      hitSparkReady: hitSparkReadyRef.current,
      radialLightning: radialLightningRef.current,
      radialLightningReady: radialLightningReadyRef.current,
      mageSpells: mageSpellRefs.current,
      mageSpellReady: mageSpellReadyRef.current,
      skillValue,
      upgradeLevel,
      classSkillColor,
      getSkill: activePresentationSkill,
      ghostPaddleY,
      ghostPaddleWidth,
    });
  }, [advancePresentation, consumePresentationEvents, pointerXRef, pointerYRef]);

  const { resetClock: resetLoopClock, start: startLoop, stop: stopLoop } = useGameLoop({
    enabledRef: loopEnabledRef,
    runningRef,
    drawGame,
    canonicalStep,
    simulationRateRef: botSpeedRef,
    onCanonicalOutcome: handleCanonicalOutcome,
  });
  resetLoopClockRef.current = resetLoopClock;

  const startRun = (asBot = false) => {
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    transitionTimersRef.current = [];
    rewardOpeningRef.current = false;
    setTransitionWave(null);
    setClearedWave(null);
    canonicalTerminalRef.current = null;
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
    const benchSeed = asBot ? botSkillBenchActiveRef.current ? 73001 + (withinSkillRun % bench.runsPerVariant) : 104729 + botCompletedRunsRef.current : undefined;
    configureRunRandom(benchSeed);
    if (asBot) botPolicyStateRef.current = createBotPolicyState((benchSeed ?? 1) ^ 0x9e3779b9);
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
        const first = chooseBotUpgrade(pickUpgradeChoices(game.upgrades, upgradeCatalogRef.current), game.upgrades, botPolicyRef.current);
        grantBotStartingSkill(first.id);
        game.balls.forEach((ball) => syncBallPayloadDisplay(ball, game.upgrades));
      }
    }
    gameRef.current = game;
    canonicalStateRef.current = createCanonicalState({
        seed: benchSeed ?? 1,
        balance: balanceConfigRef.current,
        skills: activeSkillConfigsRef.current,
        waves: getActiveWaveDefinitions(),
        targetWave: benchmarkMode ? benchmarkConfigRef.current.targetWave : MAX_WAVE,
        interactive: true,
        startingSkills: [...game.upgrades],
      });
    const projectedGame = projectCanonicalStateIntoGameView(game, canonicalStateRef.current);
    gameRef.current = projectedGame;
    replayRecorderRef.current = createReplayRecorder("canonical", benchSeed ?? 1);
    replayFrameRef.current = 0;
    const openingAim = asBot ? botAimPoint(projectedGame.bricks, projectedGame.paddleX, PLAYER_PADDLE_Y) : { x: W / 2, y: H / 3 };
    pointerXRef.current = openingAim.x;
    pointerYRef.current = openingAim.y;
    aimInputModeRef.current = "mouse";
    keyboardAimRef.current.left = false;
    keyboardAimRef.current.right = false;
    keyboardAimRef.current.horizontalRatio = 0;
    botPaddleTargetXRef.current = projectedGame.paddleX;
    keyboardRef.current.left = false;
    keyboardRef.current.right = false;
    resetLoopClockRef.current();
    setSavedMessage("");
    setHud(hudFromGame(projectedGame));
    if (!asBot) {
      const openingOutcome = canonicalStateRef.current
        ? stepCanonicalEngine(canonicalStateRef.current, { move: 0, aimX: pointerXRef.current, aimY: pointerYRef.current }, 0).outcome
        : null;
      const openingChoices = openingOutcome?.type === "start-skill"
        ? openingOutcome.choices
        : priceUpgradeChoices(pickUpgradeChoices([], upgradeCatalogRef.current));
      setChoices(openingChoices);
      runningRef.current = false;
      startLoop();
      levelUpRef.current = true;
      setMode("initialskills");
    } else {
      runningRef.current = true;
      startLoop();
      levelUpRef.current = false;
      setMode("playing");
    }
  };
  startRunRef.current = startRun;

  const startParallelBenchmarkSession = () => {
    const targetRuns = benchmarkConfigRef.current.runs;
    const workerCount = Math.max(1, Math.min(8, targetRuns, (navigator.hardwareConcurrency || 4) - 1));
    const session = parallelSessionRef.current + 1;
    const sessionId = `${Date.now().toString(36)}-${session}`;
    const seedBuffer = new Uint32Array(1);
    crypto.getRandomValues(seedBuffer);
    const sessionSeed = seedBuffer[0] || (Date.now() >>> 0);
    parallelSessionRef.current = session;
    stopWorkers(parallelWorkersRef.current);
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
      stopWorkers(parallelWorkersRef.current);
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
        seed: (sessionSeed + Math.imul(run, 7919)) >>> 0,
        sessionId,
        policy: botPolicy,
        balanceConfig: { ...balanceConfigRef.current },
        benchmarkConfig: { ...benchmarkConfigRef.current },
        skills: activeSkillConfigsRef.current.map((skill) => ({ ...skill, levels: [...skill.levels] as [number, number, number] })),
        waveDefinitions: getActiveWaveDefinitions(),
      };
      worker.postMessage(request);
    };

    const workers = createWorkers(workerCount, (worker, message) => {
        if (parallelSessionRef.current !== session) return;
        if (message.type === "error") {
          failPool(message.message);
          return;
        }
        const record = message.result as BotRunResult;
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
      }, failPool);
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
    // Canonical simulation is an explicit runtime capability, independent of
    // benchmark/watch mode. This keeps normal runs legacy-compatible by
    // default while allowing controlled canonical playtest runs.
    canonicalTerminalRef.current = null;
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
      if (botActiveRef.current) startRunRef.current(true);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [mode, result, botCompletedRuns]);

  const backToLobby = () => {
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    transitionTimersRef.current = [];
    rewardOpeningRef.current = false;
    setTransitionWave(null);
    setClearedWave(null);
    runningRef.current = false;
    stopLoop();
    gameRef.current = null;
    canonicalStateRef.current = null;
    setResult(null);
    setMode("lobby");
    activeGhostsRef.current = [];
  };

  const stopBotSession = () => {
    if (parallelWorkersRef.current.length > 0) {
      parallelFlushRef.current();
      parallelSessionRef.current += 1;
      stopWorkers(parallelWorkersRef.current);
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

  const upgradeCounts = (ids: UpgradeId[]) => upgradeCatalog.map((u) => ({ ...u, count: ids.filter((id) => id === u.id).length })).filter((u) => u.count > 0);
  const bossEnhancementCatalog = bossRewardChoices.map((id) => {
    const skill = activeSkillMap[id];
    if (!skill) return null;
    const game = gameRef.current;
    const currentEnhancement = game?.bossEnhancements?.[id] ?? 0;
    const currentLevel = upgradeLevel(game?.upgrades ?? [], id);
    const currentValue = enhancedSkillValue(id, currentLevel, currentEnhancement);
    const nextValue = enhancedSkillValue(id, currentLevel, currentEnhancement + 1);
    return {
      id,
      name: skill.name,
      category: skill.category,
      mechanic: skill.mechanic,
      tag: `${CLASS_META[skill.category].tag} 쨌 SKILL BOOST`,
      description: skill.description,
      color: skill.color,
      enhancement: currentEnhancement + 1,
      currentLevel,
      currentValue,
      delta: nextValue - currentValue,
      unit: skill.unit,
    };
  }).filter((entry): entry is Upgrade & { enhancement: number; currentLevel: number; currentValue: number; delta: number; unit: string } => entry !== null);
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
  const timeoutResults = visibleBotResults.filter((item) => item.terminationReason === "timeout"
    || (!item.terminationReason && !item.evaluationComplete && item.coreHp > 0 && item.elapsed >= 1799));
  const diagnosedTimeoutResults = timeoutResults.filter((item): item is BotRunResult & { timeoutDiagnostic: HeadlessTimeoutDiagnostic } => Boolean(item.timeoutDiagnostic));
  const timeoutCauseLabels: Record<HeadlessTimeoutDiagnostic["classification"], string> = {
    "reflector-lock": "반사면 고착",
    "trajectory-loop": "반복 궤도",
    "healer-stalemate": "회복 교착",
    "reinforcement-overrun": "증원 누적",
    "completion-rule": "완료 판정",
    "no-damage": "피해 중단",
    "insufficient-throughput": "화력 부족",
  };
  const timeoutCauseCounts = Object.entries(diagnosedTimeoutResults.reduce<Record<string, number>>((counts, item) => {
    const cause = item.timeoutDiagnostic.classification;
    counts[cause] = (counts[cause] ?? 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]);
  const timeoutWaveCounts = Object.entries(diagnosedTimeoutResults.reduce<Record<string, number>>((counts, item) => {
    const wave = String(item.timeoutDiagnostic.stuckWave);
    counts[wave] = (counts[wave] ?? 0) + 1;
    return counts;
  }, {})).map(([wave, count]) => [Number(wave), count] as [number, number]).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const benchmarkSkillStats = upgradeCatalog.map((skill) => {
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
    <main data-replay-mode={replayRecorderRef.current?.log.mode ?? "idle"} data-replay-json={replayJson} className={`app-shell mode-${mode} ${benchmarkMode ? "benchmark-shell" : "gameplay-shell"}`}>
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">CB</span>
          <div><p className="eyebrow">{benchmarkMode ? `LIVE GAME RULES // TARGET W${benchmarkConfig.targetWave}` : "PLAYTEST BUILD 0.3 // LIVE GAMEPLAY"}</p><h1>{benchmarkMode ? "CORE BREAKER BENCH" : "CORE BREAKER"}</h1></div>
        </div>
        <div className="header-rule" />
        <a className="lab-link" href={benchmarkMode ? appHref("/") : appHref("/benchmark")}>{benchmarkMode ? "GAMEPLAY" : "BENCHMARK"}</a>
        <a className="lab-link" href={appHref("/skill-lab")}>SKILL LAB</a>
        <a className="lab-link" href={appHref("/stage-lab")}>STAGE LAB</a>
        <button className="sound-toggle" type="button" aria-pressed={!soundEnabled} onClick={toggleSound}>{soundEnabled ? "SOUND ON" : "SOUND OFF"}</button>
        <div className="session-status"><span className={mode === "playing" ? "live-dot active" : "live-dot"} />{mode === "playing" ? "SESSION LIVE" : "SYSTEM READY"}</div>
      </header>

      <section className={benchmarkMode ? "workspace" : "workspace solo-workspace"}>
        <div className="game-column">
          <div className="game-frame">
            <button className="fullscreen-toggle" type="button" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? "전체화면 종료" : "전체화면으로 보기"} title={isFullscreen ? "전체화면 종료" : "전체화면"}>{isFullscreen ? "×" : "⛶"}</button>
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              aria-label="Core Breaker 게임 화면"
              onPointerMove={(e) => onPointerMove(e.clientX, e.clientY)}
              onPointerDown={(e) => onPointerMove(e.clientX, e.clientY)}
            />
            <output className="sr-only" aria-live="polite" aria-atomic="true">코어 체력 {hud.coreHp}/{hud.maxCoreHp}{hud.barriers > 0 ? `, 보호막 ${hud.barriers}개` : ""}</output>
            <div className="hud-badge hud-score" aria-label={`점수 ${formatScore(hud.score)}`}><i aria-hidden="true">✦</i><span><small>SCORE</small><strong>{formatScore(hud.score)}</strong></span></div>
            <div className="skill-loadout-hud" aria-label="보유 스킬" style={{ pointerEvents: "auto" }}>
              {hud.skillLevels.map(({ id, level, enhancement = 0 }) => {
                const skill = upgradeCatalog.find((entry) => entry.id === id);
                const evolved = isSkillEvolved(gameRef.current?.upgrades ?? [], id);
                const category = skill?.category ?? "common";
                const levelState = evolved ? "진화" : level >= 3 ? "최대 강화" : level === 2 ? "강화" : "습득";
                return <div key={id} className={`skill-loadout-entry class-${category} level-${Math.min(3, level)}${evolved ? " evolved" : ""}`} style={{ "--skill-color": category === "common" ? "#8f98a7" : skill?.color ?? "#8f98a7" } as React.CSSProperties} aria-label={`${skill?.name ?? id}, ${levelState}`} title={`${skill?.name ?? id} · LEVEL ${level}${enhancement > 0 ? ` · +${enhancement}` : ""}`}><i aria-hidden="true"><SkillIconArt id={id} /></i>{evolved && <b aria-hidden="true">✦</b>}{enhancement > 0 && <strong className="skill-enhancement-badge">+{enhancement}</strong>}{mode !== "playing" && <div className="skill-loadout-tooltip" role="tooltip"><b>{skill?.name ?? id}</b><span>LEVEL {level}{enhancement > 0 ? ` · +${enhancement}` : ""}</span><p><SkillDescriptionText text={skill?.description ?? ""} /></p></div>}</div>;
              })}
            </div>
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
                <p>{benchmarkMode ? benchmarkRunMode === "watch" ? "봇이 실제 캔버스에서 패들을 조작합니다. 블록 타격마다 적용되는 스킬 효과와 공 손실을 화면으로 확인하세요." : "웨이브 패턴, 블록 체력, 보스와 Skill LAB 수치를 헤드리스 Worker가 동시에 시뮬레이션합니다." : "웨이브마다 공 1개로 고정 패턴을 모두 파괴하세요. 공을 놓치면 CORE 1을 잃고, 새 공은 100% 속도에서 5초 동안 현재 속도로 복귀합니다."}</p>
                {!benchmarkMode && <button className="primary-button" onClick={() => startRun(false)}>20 웨이브 시작 <span>→</span></button>}
                <small>{benchmarkMode ? benchmarkRunMode === "watch" ? "오른쪽에서 관찰 배속과 봇 정책을 선택하세요." : "오른쪽에서 반복 횟수와 봇 정책을 선택하세요." : "A/D로 이동하고 마우스 또는 좌우 방향키로 반사 방향을 조준하세요."}</small>
              </div>
            )}

            {(mode === "initialskills" || mode === "levelup") && (
              <SkillSelectionModal
                mode={mode}
                choices={choices}
                activeSkillMap={activeSkillMap}
                userUpgrades={gameRef.current?.upgrades ?? []}
                rerollsLeft={rerollsLeft}
                onSelectInitialSkill={(upgrade) => selectInitialSkill(upgrade)}
                onApplyUpgrade={(upgrade, ballCost) => applyUpgrade(upgrade, Math.min(2, Math.max(0, ballCost)) as 0 | 1 | 2)}
                onReroll={rerollUpgradeChoices}
                onSkip={skipUpgradeChoice}
              />
            )}

            {mode === "bossreward" && (
              <div className="overlay level-overlay boss-reward-overlay">
                <p className="overlay-kicker">CORE FORTRESS DESTROYED // BOSS CORE</p>
                <h2>보유 스킬을 강화하세요</h2>
                <div className="upgrade-grid">
                  {bossEnhancementCatalog.map((reward, index) => (
                    <button key={reward.id} className={`upgrade-card class-${reward.category} boss-enhancement-card`} onClick={() => applyBossReward(reward.id)} style={{ "--accent": reward.color } as React.CSSProperties}>
                      <span className="upgrade-index">0{index + 1}</span>
                      <span className="upgrade-tag">{reward.tag}</span>
                      <span className="upgrade-icon" aria-hidden="true"><SkillIconArt id={reward.id} /></span>
                      <strong>{reward.name}</strong>
                      <div className="upgrade-level-values">
                        <span className="owned"><small>현재 LV{reward.currentLevel}</small><b>{formatSkillNumber(reward.currentValue)}{reward.unit}</b></span>
                        <span className="next"><small>보스 강화</small><b>{formatSkillDelta(reward.delta, reward.unit)}</b></span>
                      </div>
                      <p><SkillDescriptionText text={reward.description} /> <strong className="skill-value-accent">({formatSkillDelta(reward.delta, reward.unit)})</strong></p>
                      <em>SKILL BOOST +{reward.enhancement}</em>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === "waveclear" && clearedWave !== null && (
              <div className={`wave-clear-overlay${clearedWave.boss ? " boss" : ""}`} aria-live="polite" aria-label={`웨이브 ${clearedWave.wave} 클리어`}>
                <div className="wave-clear-copy">
                  <span>{clearedWave.boss ? "FORTRESS SHATTERED" : "SECTOR SECURED"}</span>
                  <strong>WAVE {clearedWave.wave} CLEAR</strong>
                  <i aria-hidden="true" />
                </div>
              </div>
            )}

            {mode === "transition" && transitionWave !== null && (
              <div className="wave-transition-overlay" aria-live="polite" aria-label={`웨이브 ${transitionWave} 전환 중`}>
                <div className="wave-transition-copy">
                  <span>NEXT SECTOR</span>
                  <strong>WAVE {transitionWave}</strong>
                  <i aria-hidden="true" />
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
            <div className="controls">MOVE <kbd>A</kbd><kbd>D</kbd> · AIM / MOUSE OR <kbd>←</kbd><kbd>→</kbd></div>
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
      {benchmarkMode && (
        <BenchmarkDashboard
          visibleBotResults={visibleBotResults}
          benchmarkConfig={benchmarkConfig}
          benchmarkCompletionRate={benchmarkCompletionRate}
          botAverageWave={botAverageWave}
          benchmarkAverageScore={benchmarkAverageScore}
          benchmarkAverageBricks={benchmarkAverageBricks}
          benchmarkAverageCombo={benchmarkAverageCombo}
          benchmarkAverageCore={benchmarkAverageCore}
          chartX={chartX}
          reachPoints={reachPoints}
          corePoints={corePoints}
          benchmarkWaveStats={benchmarkWaveStats}
          timeoutResults={timeoutResults}
          timeoutCauseCounts={timeoutCauseCounts}
          timeoutCauseLabels={timeoutCauseLabels}
          timeoutWaveCounts={timeoutWaveCounts}
          diagnosedTimeoutResults={diagnosedTimeoutResults}
          benchmarkSkillStats={benchmarkSkillStats}
          benchmarkTableResults={benchmarkTableResults}
          activeSkillMap={activeSkillMap}
          maxCoreHp={MAX_CORE_HP}
          benchmarkRuleset={BENCHMARK_RULESET}
        />
      )}
    </main>
  );
}
