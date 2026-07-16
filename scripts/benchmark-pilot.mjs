const BALANCE = {
  rowStartInterval: 8,
  rowMinInterval: 4.5,
  rowAcceleration: 0.12,
  baseHpWaveStep: 5,
  hardHpWaveStep: 6,
  hardChanceGrowth: 0.045,
  guardChanceGrowth: 0.004,
  shieldChanceGrowth: 0.0035,
  bossBaseHp: 48,
  bossHpPerStage: 12,
  bossTimeLimit: 45,
};

const STAGES = [
  "ORIGINAL",
  "+ PRESSURE",
  "+ ITEMS",
  "+ BRICK TYPES",
  "+ SKILLS",
  "+ BOSSES",
];

const MULTIBALL_WAVES = new Set([2, 4, 6, 8, 11, 13, 16, 18]);
const requestedWave = Number(process.argv[2]);
const requestedRuns = Number(process.argv[3]);
const TARGET_WAVE = [20, 40, 60, 100].includes(requestedWave) ? requestedWave : 20;
const RUNS = [3, 5, 10, 20].includes(requestedRuns) ? requestedRuns : 3;

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

function percentile(values, ratio = 0.5) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))] ?? 0;
}

function fieldHp(wave, withTraits) {
  if (!withTraits) return 8;
  const baseHp = 1 + Math.floor((wave - 1) / Math.round(BALANCE.baseHpWaveStep));
  const hardHp = baseHp + 1 + Math.floor((wave - 1) / Math.round(BALANCE.hardHpWaveStep));
  const hardChance = Math.min(0.9, 0.16 + wave * BALANCE.hardChanceGrowth);
  let hp = 8 * (baseHp * (1 - hardChance) + hardHp * hardChance);
  if (withTraits) {
    const guardChance = Math.min(0.22, 0.05 + wave * BALANCE.guardChanceGrowth);
    const shieldChance = Math.min(0.2, 0.04 + wave * BALANCE.shieldChanceGrowth);
    hp += 8 * guardChance + hp * shieldChance * 0.22;
  }
  return hp;
}

function runStage(stage, runIndex) {
  const rng = random(20260715 + stage * 100 + runIndex);
  const pressure = stage >= 1;
  const items = stage >= 2;
  const brickTypes = stage >= 3;
  const skills = stage >= 4;
  const bosses = stage >= 5;
  let wave = 1;
  let coreHp = 8;
  let balls = 1;
  let backlog = 0;
  let peakBacklog = 0;
  let elapsed = 0;
  let score = 0;
  let skillLevels = 0;
  let bossCleared = !bosses;

  for (; wave <= TARGET_WAVE && coreHp > 0; wave += 1) {
    const demand = fieldHp(wave, brickTypes) * (0.93 + rng() * 0.14);
    const effectiveBalls = 1 + Math.max(0, balls - 1) * 0.7;
    if (skills) skillLevels = Math.min(10, Math.floor((wave - 1) / 2));
    const skillMultiplier = skills ? 1 + skillLevels * 0.115 : 1;
    const hitRate = 1.24 * effectiveBalls * skillMultiplier * (0.9 + rng() * 0.2);
    const clearTime = demand / hitRate;
    elapsed += clearTime;
    score += Math.round(demand * 110 * (1 + skillLevels * 0.04));

    if (pressure) {
      const interval = Math.max(BALANCE.rowMinInterval, BALANCE.rowStartInterval - (wave - 1) * BALANCE.rowAcceleration);
      backlog = Math.max(0, backlog + clearTime / interval - 1);
      if (clearTime < interval * 0.72) backlog = Math.max(0, backlog - 0.35);
      peakBacklog = Math.max(peakBacklog, backlog);
      while (backlog >= 4.5 && coreHp > 0) {
        coreHp -= 1;
        backlog -= 2.25;
      }
    }

    const waveInStage = ((wave - 1) % 20) + 1;
    if (items && MULTIBALL_WAVES.has(waveInStage)) balls += 1;

    if (bosses && wave % 20 === 0 && coreHp > 0) {
      const bossStage = wave / 20;
      const bossHp = BALANCE.bossBaseHp + BALANCE.bossHpPerStage * bossStage;
      const bossBalls = 1 + Math.max(0, balls - 1) * 0.7;
      const bossSkillMultiplier = 1 + skillLevels * 0.115;
      const bossDps = 1.24 * bossBalls * bossSkillMultiplier * (0.9 + rng() * 0.2);
      const bossTime = bossHp / bossDps;
      elapsed += Math.min(BALANCE.bossTimeLimit, bossTime);
      bossCleared = bossTime <= BALANCE.bossTimeLimit;
      if (!bossCleared) coreHp = 0;
      if (bossCleared) {
        balls += 2;
        score += bossHp * 250;
      }
    }
  }

  return {
    stage,
    run: runIndex + 1,
    reachedWave: Math.min(TARGET_WAVE, wave - 1),
    completed: coreHp > 0 && wave > TARGET_WAVE && bossCleared,
    elapsed: Number(elapsed.toFixed(1)),
    coreHp,
    balls,
    peakBacklog: Number(peakBacklog.toFixed(2)),
    score,
  };
}

const runs = STAGES.flatMap((_, stage) => Array.from({ length: RUNS }, (_, index) => runStage(stage, index)));
const summary = STAGES.map((name, stage) => {
  const samples = runs.filter((run) => run.stage === stage);
  return {
    stage,
    name,
    completed: `${samples.filter((run) => run.completed).length}/${RUNS}`,
    medianWave: percentile(samples.map((run) => run.reachedWave)),
    medianElapsed: percentile(samples.map((run) => run.elapsed)),
    medianCoreHp: percentile(samples.map((run) => run.coreHp)),
    medianBalls: percentile(samples.map((run) => run.balls)),
    medianPeakBacklog: percentile(samples.map((run) => run.peakBacklog)),
    medianScore: percentile(samples.map((run) => run.score)),
  };
});

console.log(JSON.stringify({ model: "benchmark-pipeline-pilot-v1", targetWave: TARGET_WAVE, runsPerStage: RUNS, summary, runs }, null, 2));
