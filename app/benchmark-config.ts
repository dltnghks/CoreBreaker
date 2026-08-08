import { DEFAULT_SKILLS, type UpgradeId } from "./skill-config";

export type BenchmarkStage = 5;
export type BenchmarkStartWave = 1 | 5 | 10 | 15 | 20;

export type BenchmarkConfig = {
  stage: BenchmarkStage;
  runs: 3 | 5 | 10 | 20 | 100 | 500 | 1000;
  targetWave: BenchmarkStartWave;
  startWave: BenchmarkStartWave;
  startingSkills: UpgradeId[];
};

export type BenchmarkFeatures = {
  pressure: boolean;
  items: boolean;
  brickTypes: boolean;
  skills: boolean;
  bosses: boolean;
};

export const BENCHMARK_STORAGE_KEY = "echo-breaker-benchmark-v1";

export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  stage: 5,
  runs: 5,
  targetWave: 20,
  startWave: 1,
  startingSkills: [],
};

export const BENCHMARK_STAGES = [
  { stage: 5, name: "FULL SYSTEM", description: "전체 게임 시스템" },
] as const;

export function benchmarkFeatures(_stage: BenchmarkStage): BenchmarkFeatures {
  return {
    pressure: true,
    items: true,
    brickTypes: true,
    skills: true,
    bosses: true,
  };
}

export function normalizeBenchmarkConfig(saved: unknown): BenchmarkConfig {
  const source = saved && typeof saved === "object" ? saved as Partial<BenchmarkConfig> : {};
  const runs = Number(source.runs);
  const hasStartWave = source.startWave !== undefined;
  const startWave = Number(source.startWave);
  const normalizedStartWave = startWave === 5 || startWave === 10 || startWave === 15 || startWave === 20 ? startWave : 1;
  const skillCounts = new Map<UpgradeId, number>();
  for (const rawId of Array.isArray(source.startingSkills) ? source.startingSkills : []) {
    if (!DEFAULT_SKILLS.some((skill) => skill.id === rawId)) continue;
    const id = rawId as UpgradeId;
    const config = DEFAULT_SKILLS.find((skill) => skill.id === id)!;
    const maximum = config.evolutionEnabled ? 4 : 3;
    const count = skillCounts.get(id) ?? 0;
    if (count < maximum) skillCounts.set(id, count + 1);
  }
  return {
    stage: 5,
    runs: runs === 3 || runs === 10 || runs === 20 || runs === 100 || runs === 500 || runs === 1000 ? runs : 5,
    targetWave: hasStartWave ? normalizedStartWave : 20,
    startWave: normalizedStartWave,
    startingSkills: Array.from(skillCounts.entries()).flatMap(([id, count]) => Array.from({ length: count }, () => id)),
  };
}
