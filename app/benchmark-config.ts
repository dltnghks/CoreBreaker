export type BenchmarkStage = 5;

export type BenchmarkConfig = {
  stage: BenchmarkStage;
  runs: 3 | 5 | 10 | 20 | 100;
  targetWave: 20;
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
};

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
  return {
    stage: 5,
    runs: runs === 3 || runs === 10 || runs === 20 || runs === 100 ? runs : 5,
    targetWave: 20,
  };
}
