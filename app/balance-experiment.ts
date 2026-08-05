import type { BalanceConfig } from "./balance-config";
import type { BenchmarkConfig } from "./benchmark-config";
import type { BotRunResult, BotPolicy } from "./_types/game";
import type { ClassSkillId, SkillConfig, UpgradeId } from "./skill-config";
import type { WaveDefinition } from "./wave-config";

export type BalanceExperimentStatus = "running" | "paused" | "complete" | "failed";
export type BalanceSeedGroup = "train" | "validation" | "test";
export type BalanceTuningParameter = "levelValue" | "magicDamage" | "cooldown";

export type BalanceTuningConfig = {
  skillId: ClassSkillId;
  level: 1 | 2 | 3;
  parameter: BalanceTuningParameter;
  epochs: number;
  candidatesPerEpoch: number;
  runsPerCandidate: number;
  targetCompletionRate: number;
  targetCoreHp: number;
  trainSeeds: number[];
  referenceValue?: number;
};

export type BalanceExperiment = {
  id: string;
  name: string;
  mode: "benchmark-session" | "auto-tune";
  status: BalanceExperimentStatus;
  targetSkillId: UpgradeId | null;
  targetLevel: 1 | 2 | 3 | "evolution" | null;
  engineVersion: string;
  rulesetVersion: string;
  policyVersion: string;
  policy: BotPolicy;
  baseConfigHash: string;
  targetRuns: number;
  completedRuns: number;
  currentEpoch: number;
  tuning: BalanceTuningConfig | null;
  createdAt: number;
  updatedAt: number;
};

export type BalanceCandidateConfig = {
  skills: SkillConfig[];
  balance: BalanceConfig;
  benchmark: BenchmarkConfig;
  waves: WaveDefinition[];
};

export type BalanceCandidate = {
  id: string;
  experimentId: string;
  epoch: number;
  label: string;
  parentCandidateId: string | null;
  configHash: string;
  config: BalanceCandidateConfig;
  score: number | null;
  status: "queued" | "running" | "complete" | "rejected";
  createdAt: number;
  updatedAt: number;
};

export type BalanceExperimentRun = {
  experimentRunId: string;
  experimentId: string;
  candidateId: string;
  epoch: number;
  seedGroup: BalanceSeedGroup;
  seed: number;
  createdAt: number;
  result: BotRunResult;
};

export type BalanceCandidateSummary = {
  candidateId: string;
  experimentId: string;
  epoch: number;
  runCount: number;
  completionRate: number;
  averageElapsed: number;
  medianElapsed: number;
  averageWave: number;
  averageCoreHp: number;
  averageScore: number;
  averagePhysicalDamage: number;
  averageMagicDamage: number;
  averageBallLosses: number;
  timeoutRate: number;
  updatedAt: number;
};

export type BalanceCandidateComparison = {
  metric: keyof Pick<BalanceCandidateSummary,
    "completionRate" | "averageElapsed" | "medianElapsed" | "averageWave" | "averageCoreHp" |
    "averageScore" | "averagePhysicalDamage" | "averageMagicDamage" | "averageBallLosses" | "timeoutRate">;
  baseline: number;
  candidate: number;
  delta: number;
};

export type BalancePairedComparison = {
  pairCount: number;
  improvedSeeds: number;
  regressedSeeds: number;
  tiedSeeds: number;
  completionRateDelta: number;
  averageElapsedDelta: number;
  averageWaveDelta: number;
  averageCoreHpDelta: number;
  averagePhysicalDamageDelta: number;
  averageMagicDamageDelta: number;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = stableValue((value as Record<string, unknown>)[key]);
    return result;
  }, {});
}

export function fingerprintBalanceConfig(config: BalanceCandidateConfig) {
  const input = JSON.stringify(stableValue(config));
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarizeBalanceCandidate(candidate: BalanceCandidate, runs: BalanceExperimentRun[]): BalanceCandidateSummary {
  const candidateRuns = runs.filter((run) => run.candidateId === candidate.id).map((run) => run.result);
  return {
    candidateId: candidate.id,
    experimentId: candidate.experimentId,
    epoch: candidate.epoch,
    runCount: candidateRuns.length,
    completionRate: average(candidateRuns.map((run) => run.evaluationComplete ? 100 : 0)),
    averageElapsed: average(candidateRuns.map((run) => run.elapsed)),
    medianElapsed: median(candidateRuns.map((run) => run.elapsed)),
    averageWave: average(candidateRuns.map((run) => run.wave)),
    averageCoreHp: average(candidateRuns.map((run) => run.coreHp)),
    averageScore: average(candidateRuns.map((run) => run.score)),
    averagePhysicalDamage: average(candidateRuns.map((run) => run.physicalDamage ?? 0)),
    averageMagicDamage: average(candidateRuns.map((run) => run.magicDamage ?? 0)),
    averageBallLosses: average(candidateRuns.map((run) => run.ballLosses)),
    timeoutRate: average(candidateRuns.map((run) => run.terminationReason === "timeout" ? 100 : 0)),
    updatedAt: Date.now(),
  };
}

const COMPARISON_METRICS: BalanceCandidateComparison["metric"][] = [
  "completionRate", "averageElapsed", "medianElapsed", "averageWave", "averageCoreHp",
  "averageScore", "averagePhysicalDamage", "averageMagicDamage", "averageBallLosses", "timeoutRate",
];

export function compareBalanceCandidates(baseline: BalanceCandidateSummary, candidate: BalanceCandidateSummary) {
  return COMPARISON_METRICS.map((metric): BalanceCandidateComparison => ({
    metric,
    baseline: baseline[metric],
    candidate: candidate[metric],
    delta: candidate[metric] - baseline[metric],
  }));
}

function runOutcomeValue(run: BotRunResult) {
  return (run.evaluationComplete ? 1_000_000 : 0) + run.wave * 10_000 + run.coreHp * 100 - run.elapsed;
}

export function comparePairedBalanceRuns(baselineRuns: BalanceExperimentRun[], candidateRuns: BalanceExperimentRun[]): BalancePairedComparison {
  const baselineBySeed = new Map(baselineRuns.map((run) => [run.seed, run.result]));
  const pairs = candidateRuns.flatMap((run) => {
    const baseline = baselineBySeed.get(run.seed);
    return baseline ? [{ baseline, candidate: run.result }] : [];
  });
  const deltas = <T,>(select: (run: BotRunResult) => T, difference: (candidate: T, baseline: T) => number) => average(pairs.map((pair) => difference(select(pair.candidate), select(pair.baseline))));
  const outcomes = pairs.map((pair) => Math.sign(runOutcomeValue(pair.candidate) - runOutcomeValue(pair.baseline)));
  return {
    pairCount: pairs.length,
    improvedSeeds: outcomes.filter((value) => value > 0).length,
    regressedSeeds: outcomes.filter((value) => value < 0).length,
    tiedSeeds: outcomes.filter((value) => value === 0).length,
    completionRateDelta: deltas((run) => run.evaluationComplete, (candidate, baseline) => (Number(candidate) - Number(baseline)) * 100),
    averageElapsedDelta: deltas((run) => run.elapsed, (candidate, baseline) => candidate - baseline),
    averageWaveDelta: deltas((run) => run.wave, (candidate, baseline) => candidate - baseline),
    averageCoreHpDelta: deltas((run) => run.coreHp, (candidate, baseline) => candidate - baseline),
    averagePhysicalDamageDelta: deltas((run) => run.physicalDamage ?? 0, (candidate, baseline) => candidate - baseline),
    averageMagicDamageDelta: deltas((run) => run.magicDamage ?? 0, (candidate, baseline) => candidate - baseline),
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function experimentRunsToCsv(runs: BalanceExperimentRun[], tuning?: {
  parameter: BalanceTuningParameter;
  level: number;
  referenceValue: number | null;
  candidateValue: number;
  configHash: string;
  score: number | null;
}) {
  const headings = [
    "experimentId", "epoch", "candidateId", "seedGroup", "seed", "run", "complete", "termination",
    "elapsed", "wave", "coreHp", "score", "physicalDamage", "magicDamage", "ballLosses", "engineVersion", "ruleset",
    "tuningParameter", "tuningLevel", "referenceValue", "candidateValue", "configHash", "candidateScore",
  ];
  const rows = runs.map(({ experimentId, epoch, candidateId, seedGroup, seed, result }) => [
    experimentId, epoch, candidateId, seedGroup, seed, result.run, result.evaluationComplete,
    result.terminationReason ?? "", result.elapsed, result.wave, result.coreHp, result.score,
    result.physicalDamage ?? 0, result.magicDamage ?? 0, result.ballLosses,
    result.engineVersion ?? "", result.benchmarkRuleset ?? "",
    tuning?.parameter ?? "", tuning?.level ?? "", tuning?.referenceValue ?? "", tuning?.candidateValue ?? "", tuning?.configHash ?? "", tuning?.score ?? "",
  ]);
  return [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
