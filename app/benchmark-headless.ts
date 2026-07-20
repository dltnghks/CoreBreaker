import { DEFAULT_SKILLS, type SkillConfig, type SkillCategory, type UpgradeId } from "./skill-config";
import { DEFAULT_BALANCE_CONFIG, type BalanceConfig, type BotWaveSample } from "./balance-config";
import { DEFAULT_BENCHMARK_CONFIG, type BenchmarkConfig } from "./benchmark-config";
import { waveDefinition } from "./wave-config";

export type HeadlessBotPolicy = "balanced" | "survival" | "random";
export const PARALLEL_BENCHMARK_RULESET = "parallel-v7" as const;
const OVERDRIVE_THRESHOLDS = [30, 50, 70, 90] as const;
const OVERDRIVE_STEP = 0.05;

export type HeadlessBenchmarkRequest = {
  run: number;
  seed: number;
  sessionId?: string;
  policy: HeadlessBotPolicy;
  balanceConfig?: BalanceConfig;
  benchmarkConfig?: BenchmarkConfig;
  skills?: SkillConfig[];
};

export type HeadlessBenchmarkResult = {
  id: string;
  run: number;
  policy: HeadlessBotPolicy;
  speed: 8;
  elapsed: number;
  wave: number;
  score: number;
  bricks: number;
  maxCombo: number;
  coreHp: number;
  upgrades: UpgradeId[];
  startingSkills: UpgradeId[];
  skillHistory: Array<{ wave: number; skillId: UpgradeId; level: number; source: "start" | "wave" | "boss" }>;
  ultimates: UpgradeId[];
  skillMetrics: Partial<Record<UpgradeId, { activations: number; damage: number; kills: number }>>;
  createdAt: number;
  balanceConfig: BalanceConfig;
  benchmarkConfig: BenchmarkConfig;
  benchmarkRuleset: typeof PARALLEL_BENCHMARK_RULESET;
  waveSamples: BotWaveSample[];
  evaluationComplete: boolean;
  skillBench: null;
  maxBalls: number;
  ballLosses: number;
  missileActivations: number;
  safetySaves: number;
  gravityRescues: number;
};

function seededRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function lateWaveHpMultiplier(wave: number) {
  return wave >= 16 ? 2.5 : wave >= 11 ? 1.9 : wave >= 6 ? 1.45 : wave >= 4 ? 1.15 : 1;
}

function levelOf(upgrades: UpgradeId[], id: UpgradeId) {
  return upgrades.filter((entry) => entry === id).length;
}

function chooseSkill(pool: SkillConfig[], upgrades: UpgradeId[], policy: HeadlessBotPolicy, random: () => number) {
  const available = pool.filter((skill) => levelOf(upgrades, skill.id) < 3);
  if (!available.length) return null;
  const choices = [...available].sort(() => random() - 0.5).slice(0, Math.min(3, available.length));
  if (policy === "random") return choices[Math.floor(random() * choices.length)];
  const categoryWeight: Record<Exclude<HeadlessBotPolicy, "random">, Record<SkillCategory, number>> = {
    balanced: { warrior: 3, archer: 3, mage: 3, common: 2.5 },
    survival: { warrior: 5, archer: 2, mage: 4, common: 3.5 },
  };
  return choices.sort((a, b) => {
    const score = (skill: SkillConfig) => categoryWeight[policy][skill.category] + (upgrades.includes(skill.id) ? 1.5 : 3) + random();
    return score(b) - score(a);
  })[0];
}

function skillPower(skill: SkillConfig, level: number, upgrades: UpgradeId[] = []) {
  const categoryPower: Record<SkillCategory, number> = { warrior: 1.08, archer: 1.12, mage: 1.14, common: 0.55 };
  const value = Math.max(0, Number(skill.levels[Math.min(2, Math.max(0, level - 1))]) || 0);
  const valueScale = skill.unit === "DMG" ? value * 0.22
    : skill.unit === "배" ? Math.max(0, value - 1) * 0.55
    : skill.unit === "%" ? value * 0.015
    : skill.unit === "px" ? value * 0.003
    : skill.unit === "개" || skill.unit === "발" ? value * 0.08
    : value * 0.05;
  const cooldownLevel = levelOf(upgrades, "common-cooldown");
  const cooldownConfig = DEFAULT_SKILLS.find((entry) => entry.id === "common-cooldown");
  const cooldownReduction = cooldownLevel > 0 ? Number(cooldownConfig?.levels[Math.min(2, cooldownLevel - 1)] ?? 0) / 100 : 0;
  const baseCooldown = Number(skill.cooldown[Math.min(2, Math.max(0, level - 1))] ?? 0);
  const effectiveCooldown = baseCooldown > 0 ? Math.max(0.2, baseCooldown * (1 - cooldownReduction)) : 0;
  const cadence = skill.category === "common" ? 0.35 : effectiveCooldown > 0 ? Math.min(1.25, 2.5 / effectiveCooldown) : skill.ultimate ? 0.72 : 1;
  const impactModel = skill.id === "warrior-shockwave" ? 1.1 : skill.id === "mage-fireball" ? 1.25 : 1;
  const evolutionMultiplier = level >= 3 && skill.evolution ? 1.55 : 1;
  const sameClassBuild = upgrades.filter((id) => DEFAULT_SKILLS.some((entry) => entry.id === id && !entry.ultimate && entry.category === skill.category)).length;
  const ultimateBuildMultiplier = skill.ultimate ? 1 + Math.min(0.75, sameClassBuild * 0.08) : 1;
  return categoryPower[skill.category] * (level * 0.55 + valueScale) * cadence * impactModel * evolutionMultiplier * ultimateBuildMultiplier;
}

function normalWaveStats(wave: number, balance: BalanceConfig) {
  const definition = waveDefinition(wave);
  const baseHp = 1 + Math.floor((wave - 1) / Math.max(1, Math.round(balance.baseHpWaveStep)));
  let count = 0;
  let damageable = 0;
  let hp = 0;
  for (const row of definition.pattern) for (const cell of row) {
    if (cell === ".") continue;
    count += 1;
    if (cell === "x") continue;
    damageable += 1;
    const bonus = cell === "h" ? 1 + Math.floor((wave - 1) / 8) : cell === "c" ? 2 : 0;
    hp += Math.ceil((baseHp + bonus) * lateWaveHpMultiplier(wave));
    if (cell === "g") hp += 1;
  }
  return { count, damageable, hp };
}

function bossWaveStats(wave: number, balance: BalanceConfig) {
  const stage = wave >= 20 ? 2 : 1;
  const multiplier = stage >= 2 ? 1.8 : 1.25;
  const hp = Math.round((balance.bossBaseHp + stage * balance.bossHpPerStage) * multiplier);
  return { count: 1, damageable: 1, hp };
}

function overdriveAdjustedDuration(baseDuration: number) {
  let remainingWork = Math.max(0, baseDuration);
  let elapsed = 0;
  let previousThreshold = 0;
  for (let level = 0; level < OVERDRIVE_THRESHOLDS.length; level++) {
    const threshold = OVERDRIVE_THRESHOLDS[level];
    const segmentDuration = threshold - previousThreshold;
    const multiplier = 1 + level * OVERDRIVE_STEP;
    const segmentWork = segmentDuration * multiplier;
    if (remainingWork <= segmentWork) return elapsed + remainingWork / multiplier;
    remainingWork -= segmentWork;
    elapsed += segmentDuration;
    previousThreshold = threshold;
  }
  return elapsed + remainingWork / (1 + OVERDRIVE_THRESHOLDS.length * OVERDRIVE_STEP);
}

function overdriveLevelAt(seconds: number) {
  return OVERDRIVE_THRESHOLDS.filter((threshold) => seconds >= threshold).length;
}

export function runHeadlessBenchmark(request: HeadlessBenchmarkRequest): HeadlessBenchmarkResult {
  const random = seededRandom(request.seed);
  const balance = { ...DEFAULT_BALANCE_CONFIG, ...request.balanceConfig };
  const benchmark = { ...DEFAULT_BENCHMARK_CONFIG, ...request.benchmarkConfig } as BenchmarkConfig;
  const skills = request.skills?.length ? request.skills : DEFAULT_SKILLS;
  const normalSkills = skills.filter((skill) => !skill.ultimate);
  const ultimateSkills = skills.filter((skill) => skill.ultimate);
  const upgrades: UpgradeId[] = [];
  const history: HeadlessBenchmarkResult["skillHistory"] = [];
  const metrics: HeadlessBenchmarkResult["skillMetrics"] = {};
  const samples: BotWaveSample[] = [];
  let coreHp = 8;
  let elapsed = 0;
  let score = 0;
  let bricks = 0;
  let maxCombo = 0;
  let reachedWave = 1;
  let maxBalls = 1;
  let ballLosses = 0;

  const grant = (skill: SkillConfig | null, wave: number, source: "start" | "wave" | "boss") => {
    if (!skill) return;
    const previousLevel = levelOf(upgrades, skill.id);
    upgrades.push(skill.id);
    const nextLevel = levelOf(upgrades, skill.id);
    if (skill.id === "common-xp") coreHp += Number(skill.levels[nextLevel - 1] ?? 0) - Number(skill.levels[previousLevel - 1] ?? 0);
    history.push({ wave, skillId: skill.id, level: nextLevel, source });
  };
  grant(chooseSkill(normalSkills, upgrades, request.policy, random), 1, "start");
  grant(chooseSkill(normalSkills, upgrades, request.policy, random), 1, "start");

  for (let wave = 1; wave <= benchmark.targetWave && coreHp > 0; wave += 1) {
    reachedWave = wave;
    const definition = waveDefinition(wave);
    const stage = definition.boss ? bossWaveStats(wave, balance) : normalWaveStats(wave, balance);
    const baseBalls = 1;
    const temporaryBalls = !definition.boss && [3, 6, 9].includes(((wave - 1) % 10) + 1) ? 1 : 0;
    const balls = baseBalls + temporaryBalls;
    maxBalls = Math.max(maxBalls, balls);
    const skillBonus = skills.reduce((sum, skill) => sum + skillPower(skill, levelOf(upgrades, skill.id), upgrades), 0);
    const accuracy = 0.7 + random() * 0.25;
    const bossPressure = definition.boss ? 0.76 : 1;
    const damagePerSecond = Math.max(0.4, (2.05 * Math.sqrt(balls) + skillBonus) * accuracy * bossPressure);
    const waveElapsed = overdriveAdjustedDuration(stage.hp / damagePerSecond);
    const damageDone = stage.hp;
    const destroyed = stage.damageable;
    const survivors = 0;
    elapsed += waveElapsed;
    bricks += destroyed;
    maxCombo = Math.max(maxCombo, Math.round((6 + balls * 1.8 + skillBonus * 2) * (0.75 + random() * 0.5)));
    score += Math.round(damageDone * 12 + destroyed * 100 + maxCombo * 4);

    for (const skill of skills) {
      const level = levelOf(upgrades, skill.id);
      if (!level) continue;
      const share = skillPower(skill, level, upgrades) / Math.max(1, 2.05 * Math.sqrt(balls) + skillBonus);
      const damage = Math.round(damageDone * share);
      const cooldownLevel = levelOf(upgrades, "common-cooldown");
      const cooldownReduction = cooldownLevel > 0 ? Number(skills.find((entry) => entry.id === "common-cooldown")?.levels[Math.min(2, cooldownLevel - 1)] ?? 0) / 100 : 0;
      const baseCooldown = Number(skill.cooldown[Math.min(2, level - 1)] ?? 0);
      const activationInterval = baseCooldown > 0 ? Math.max(0.2, baseCooldown * (1 - cooldownReduction)) : 1.2;
      const activations = skill.category === "common" ? 0 : Math.max(1, Math.round(waveElapsed / activationInterval));
      const previous = metrics[skill.id] ?? { activations: 0, damage: 0, kills: 0 };
      metrics[skill.id] = { activations: previous.activations + activations, damage: previous.damage + damage, kills: previous.kills + Math.round(destroyed * share) };
    }

    const survivalPower = levelOf(upgrades, "warrior-guard") * 0.018 + levelOf(upgrades, "mage-black-hole") * 0.012 + levelOf(upgrades, "common-wide") * 0.01;
    const overdriveRisk = overdriveLevelAt(waveElapsed) * 0.012;
    const lossChance = Math.max(0.02, Math.min(0.38, 0.045 + wave * 0.004 + (definition.boss ? 0.035 : 0) + overdriveRisk - survivalPower));
    const lossChecks = Math.max(1, Math.ceil(waveElapsed / 24));
    let waveBallLosses = 0;
    for (let check = 0; check < lossChecks; check++) if (random() < lossChance) waveBallLosses++;
    ballLosses += waveBallLosses;
    coreHp = Math.max(0, coreHp - waveBallLosses);
    samples.push({ wave, elapsed, balls, coreHp, aliveBricks: survivors, brickHp: Math.max(0, stage.hp - damageDone), score, bossActive: Boolean(definition.boss) });
    if (coreHp <= 0) break;
    if (definition.boss && wave < benchmark.targetWave) grant(chooseSkill(ultimateSkills, upgrades, request.policy, random), wave, "boss");
    else if (wave < benchmark.targetWave) grant(chooseSkill(normalSkills, upgrades, request.policy, random), wave, "wave");
  }

  return {
    id: `parallel-${request.sessionId ?? "legacy"}-${request.seed}-${request.run}`,
    run: request.run,
    policy: request.policy,
    speed: 8,
    elapsed,
    wave: reachedWave,
    score,
    bricks,
    maxCombo,
    coreHp,
    upgrades,
    startingSkills: history.filter((event) => event.source === "start").map((event) => event.skillId),
    skillHistory: history,
    ultimates: history.filter((event) => event.source === "boss").map((event) => event.skillId),
    skillMetrics: metrics,
    createdAt: Date.now(),
    balanceConfig: balance,
    benchmarkConfig: benchmark,
    benchmarkRuleset: PARALLEL_BENCHMARK_RULESET,
    waveSamples: samples,
    evaluationComplete: reachedWave >= benchmark.targetWave && coreHp > 0,
    skillBench: null,
    maxBalls,
    ballLosses,
    missileActivations: metrics["archer-rapid"]?.activations ?? 0,
    safetySaves: metrics["warrior-guard"]?.activations ?? 0,
    gravityRescues: metrics["mage-black-hole"]?.activations ?? 0,
  };
}
