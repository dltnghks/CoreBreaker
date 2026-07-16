export type BalanceConfig = {
  rowStartInterval: number;
  rowMinInterval: number;
  rowAcceleration: number;
  baseHpWaveStep: number;
  hardHpWaveStep: number;
  hardChanceGrowth: number;
  guardChanceGrowth: number;
  bossBaseHp: number;
  bossHpPerStage: number;
  bossTimeLimit: number;
  bossAttackInterval: number;
  bossAttackAcceleration: number;
};

export type BotWaveSample = {
  wave: number;
  elapsed: number;
  balls: number;
  coreHp: number;
  aliveBricks: number;
  brickHp: number;
  score: number;
  bossActive: boolean;
};

export type SkillBenchConfig = {
  enabled: boolean;
  environment: "original" | "isolated" | "ecosystem";
  mode: "single" | "batch";
  scope: "all" | "category" | "custom";
  skillId: string;
  skillIds: string[];
  category: string;
  runsPerVariant: 3 | 5 | 10;
  batchId: string;
};

export type SkillBenchProgress = {
  batchId: string;
  status: "idle" | "running" | "paused" | "complete";
  completedRuns: number;
  totalRuns: number;
  currentSkillId: string | null;
  currentLevel: 0 | 1 | 2 | 3 | null;
  startedAt: number;
  updatedAt: number;
};

export const BALANCE_STORAGE_KEY = "echo-breaker-balance-v2";
export const BOT_RESULTS_STORAGE_KEY = "echo-breaker-bot-results-v1";
export const BOT_LIVE_STORAGE_KEY = "echo-breaker-bot-live-v1";
export const SKILL_BENCH_STORAGE_KEY = "echo-breaker-skill-bench-v1";
export const SKILL_BENCH_PROGRESS_KEY = "echo-breaker-skill-bench-progress-v1";

export const DEFAULT_SKILL_BENCH_CONFIG: SkillBenchConfig = {
  enabled: false,
  environment: "original",
  mode: "single",
  scope: "all",
  skillId: "wide",
  skillIds: ["wide"],
  category: "frame",
  runsPerVariant: 5,
  batchId: "",
};

export const DEFAULT_SKILL_BENCH_PROGRESS: SkillBenchProgress = {
  batchId: "",
  status: "idle",
  completedRuns: 0,
  totalRuns: 0,
  currentSkillId: null,
  currentLevel: null,
  startedAt: 0,
  updatedAt: 0,
};

export const DEFAULT_BALANCE_CONFIG: BalanceConfig = {
  rowStartInterval: 8,
  rowMinInterval: 4.5,
  rowAcceleration: 0.12,
  baseHpWaveStep: 3,
  hardHpWaveStep: 4,
  hardChanceGrowth: 0.055,
  guardChanceGrowth: 0.004,
  bossBaseHp: 220,
  bossHpPerStage: 120,
  bossTimeLimit: 45,
  bossAttackInterval: 4.2,
  bossAttackAcceleration: 0.4,
};

const LIMITS: Record<keyof BalanceConfig, [number, number]> = {
  rowStartInterval: [5, 16],
  rowMinInterval: [2.5, 10],
  rowAcceleration: [0, 0.3],
  baseHpWaveStep: [2, 12],
  hardHpWaveStep: [2, 12],
  hardChanceGrowth: [0, 0.08],
  guardChanceGrowth: [0, 0.012],
  bossBaseHp: [40, 500],
  bossHpPerStage: [0, 240],
  bossTimeLimit: [20, 90],
  bossAttackInterval: [2.5, 10],
  bossAttackAcceleration: [0, 0.8],
};

export function normalizeBalanceConfig(saved: unknown): BalanceConfig {
  const source = saved && typeof saved === "object" ? saved as Partial<Record<keyof BalanceConfig, unknown>> : {};
  return Object.fromEntries(Object.entries(DEFAULT_BALANCE_CONFIG).map(([key, fallback]) => {
    const balanceKey = key as keyof BalanceConfig;
    const numeric = Number(source[balanceKey]);
    const [minimum, maximum] = LIMITS[balanceKey];
    return [balanceKey, Number.isFinite(numeric) ? Math.max(minimum, Math.min(maximum, numeric)) : fallback];
  })) as BalanceConfig;
}

export function normalizeSkillBenchConfig(saved: unknown): SkillBenchConfig {
  const source = saved && typeof saved === "object" ? saved as Partial<SkillBenchConfig> : {};
  const runs = Number(source.runsPerVariant);
  const skillId = typeof source.skillId === "string" && source.skillId ? source.skillId : DEFAULT_SKILL_BENCH_CONFIG.skillId;
  const skillIds = Array.isArray(source.skillIds) ? [...new Set(source.skillIds.filter((id): id is string => typeof id === "string" && id.length > 0))] : [skillId];
  return {
    enabled: source.enabled === true,
    environment: source.environment === "isolated" || source.environment === "ecosystem" ? source.environment : "original",
    mode: source.mode === "batch" ? "batch" : "single",
    scope: source.scope === "category" || source.scope === "custom" ? source.scope : "all",
    skillId,
    skillIds: skillIds.length ? skillIds : [skillId],
    category: typeof source.category === "string" && source.category ? source.category : DEFAULT_SKILL_BENCH_CONFIG.category,
    runsPerVariant: runs === 3 || runs === 10 ? runs : 5,
    batchId: typeof source.batchId === "string" ? source.batchId : "",
  };
}

export function normalizeSkillBenchProgress(saved: unknown): SkillBenchProgress {
  const source = saved && typeof saved === "object" ? saved as Partial<SkillBenchProgress> : {};
  const status = source.status === "running" || source.status === "paused" || source.status === "complete" ? source.status : "idle";
  const completedRuns = Math.max(0, Math.floor(Number(source.completedRuns) || 0));
  const totalRuns = Math.max(0, Math.floor(Number(source.totalRuns) || 0));
  const level = Number(source.currentLevel);
  return {
    batchId: typeof source.batchId === "string" ? source.batchId : "",
    status,
    completedRuns: Math.min(completedRuns, totalRuns || completedRuns),
    totalRuns,
    currentSkillId: typeof source.currentSkillId === "string" ? source.currentSkillId : null,
    currentLevel: level === 0 || level === 1 || level === 2 || level === 3 ? level : null,
    startedAt: Math.max(0, Number(source.startedAt) || 0),
    updatedAt: Math.max(0, Number(source.updatedAt) || 0),
  };
}
