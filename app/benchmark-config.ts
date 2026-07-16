export type BenchmarkStage = 0 | 1 | 2 | 3 | 4 | 5;

export type BenchmarkConfig = {
  stage: BenchmarkStage;
  runs: 3 | 5 | 10 | 20;
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
  stage: 0,
  runs: 5,
  targetWave: 20,
};

export const BENCHMARK_STAGES: Array<{ stage: BenchmarkStage; name: string; description: string }> = [
  { stage: 0, name: "ORIGINAL", description: "공·패들·일반 브릭만 사용" },
  { stage: 1, name: "+ PRESSURE", description: "60초 제한시간과 CORE 낙하 피해 추가" },
  { stage: 2, name: "+ ITEMS", description: "전투 드롭 아이템 추가" },
  { stage: 3, name: "+ BRICK TYPES", description: "가드·실드 브릭 추가" },
  { stage: 4, name: "+ SKILLS", description: "웨이브 보상과 패들 스킬 추가" },
  { stage: 5, name: "+ BOSSES", description: "W10·W20 보스와 궁극기 보상 추가" },
];

export function benchmarkFeatures(stage: BenchmarkStage): BenchmarkFeatures {
  return {
    pressure: stage >= 1,
    items: stage >= 2,
    brickTypes: stage >= 3,
    skills: stage >= 4,
    bosses: stage >= 5,
  };
}

export function normalizeBenchmarkConfig(saved: unknown): BenchmarkConfig {
  const source = saved && typeof saved === "object" ? saved as Partial<BenchmarkConfig> : {};
  const stage = Number(source.stage);
  const runs = Number(source.runs);
  return {
    stage: stage >= 0 && stage <= 5 ? Math.floor(stage) as BenchmarkStage : DEFAULT_BENCHMARK_CONFIG.stage,
    runs: runs === 3 || runs === 10 || runs === 20 ? runs : 5,
    targetWave: 20,
  };
}
