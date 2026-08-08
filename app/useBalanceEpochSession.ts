"use client";

import { useCallback, useRef, useState } from "react";
import type { BalanceConfig } from "./balance-config";
import type { BenchmarkConfig } from "./benchmark-config";
import type { BenchmarkWorkerMessage } from "./useBenchmarkSession";
import type { BotPolicy, BotRunResult } from "./_types/game";
import type { SkillConfig } from "./skill-config";
import type { WaveDefinition } from "./wave-config";
import type { HeadlessBenchmarkRequest } from "./benchmark-headless";
import { ENGINE_VERSION } from "./canonical-engine";
import { POLICY_VERSION } from "./bot-policy";
import { PARALLEL_BENCHMARK_RULESET } from "./benchmark-headless";
import { createEpochCandidates, normalizeTuningParameterValue, pendingCandidateSeeds, scoreBalanceCandidate, tuningParameterValue } from "./balance-epoch";
import { fingerprintBalanceConfig, summarizeBalanceCandidate, type BalanceCandidate, type BalanceCandidateConfig, type BalanceExperiment, type BalanceExperimentRun, type BalanceTuningConfig } from "./balance-experiment";
import { getBalanceExperiment, getBalanceExperimentBundle, putBalanceCandidate, putBalanceCandidateSummary, putBalanceExperiment, putBalanceExperimentRuns } from "./balance-experiment-store";

type CreateWorkers = (count: number, onMessage: (worker: Worker, message: BenchmarkWorkerMessage) => void, onError: (message: string) => void) => Worker[];

export type BalanceEpochContext = { skills: SkillConfig[]; balance: BalanceConfig; benchmark: BenchmarkConfig; waves: WaveDefinition[]; policy: BotPolicy };
export type BalanceEpochProgress = { experimentId: string | null; running: boolean; status: BalanceExperiment["status"] | "idle"; epoch: number; totalEpochs: number; completedRuns: number; totalRuns: number; message: string };

const IDLE_PROGRESS: BalanceEpochProgress = { experimentId: null, running: false, status: "idle", epoch: 0, totalEpochs: 0, completedRuns: 0, totalRuns: 0, message: "" };

function cloneSkills(skills: SkillConfig[]) {
  return skills.map((skill) => ({ ...skill, traits: [...skill.traits], traitConfigs: skill.traitConfigs.map((trait) => ({ ...trait, values: [...trait.values] as [number, number, number], damage: [...trait.damage] as [number, number, number] })), levels: [...skill.levels] as [number, number, number], skillDamage: [...skill.skillDamage] as [number, number, number], magicDamage: skill.magicDamage ? [...skill.magicDamage] as [number, number, number] : null, cooldown: [...skill.cooldown] as [number, number, number] }));
}

function cloneWaves(waves: WaveDefinition[]) {
  return waves.map((wave) => ({ ...wave, pattern: [...wave.pattern], blocks: wave.blocks?.map((block) => ({ ...block })) }));
}

function bestCandidate(candidates: BalanceCandidate[]) {
  return candidates.filter((candidate) => candidate.score !== null).sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity))[0] ?? null;
}

export function useBalanceEpochSession(options: { createWorkers: CreateWorkers; stopWorkers: (workers: Worker[]) => void; onRefresh: () => void }) {
  const { createWorkers, stopWorkers, onRefresh } = options;
  const workersRef = useRef<Worker[]>([]);
  const sessionRef = useRef(0);
  const experimentRef = useRef<BalanceExperiment | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);
  const persistenceRef = useRef<Promise<unknown>>(Promise.resolve());
  const [progress, setProgress] = useState<BalanceEpochProgress>(IDLE_PROGRESS);

  const enqueuePersistence = useCallback(<T,>(operation: () => Promise<T>) => {
    const queued = persistenceRef.current.then(operation);
    persistenceRef.current = queued.catch((error) => console.error("[balance-epoch] persistence failed", error));
    return queued;
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    stopWorkers(workersRef.current);
    workersRef.current = [];
    const experiment = experimentRef.current;
    if (experiment?.status !== "running") return;
    const paused = { ...experiment, status: "paused" as const, updatedAt: Date.now() };
    experimentRef.current = paused;
    void flushRef.current().then(() => enqueuePersistence(() => putBalanceExperiment(paused))).then(onRefresh);
    setProgress((current) => ({ ...current, running: false, status: "paused", message: "저장 완료 · 같은 실험에서 재개할 수 있습니다." }));
  }, [enqueuePersistence, onRefresh, stopWorkers]);

  const execute = useCallback(async (initialExperiment: BalanceExperiment, context: BalanceEpochContext, storedCandidates: BalanceCandidate[], storedRuns: BalanceExperimentRun[]) => {
    const tuning = initialExperiment.tuning;
    if (!tuning) throw new Error("Experiment does not contain an auto-tune configuration");
    stopWorkers(workersRef.current);
    workersRef.current = [];
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    let experiment = { ...initialExperiment, status: "running" as const, updatedAt: Date.now() };
    let candidates = [...storedCandidates];
    const allRuns = [...storedRuns];
    experimentRef.current = experiment;
    await putBalanceExperiment(experiment);
    setProgress({ experimentId: experiment.id, running: true, status: "running", epoch: experiment.currentEpoch, totalEpochs: tuning.epochs, completedRuns: allRuns.length, totalRuns: experiment.targetRuns, message: storedRuns.length ? "저장된 결과 다음부터 재개" : "후보 생성" });
    onRefresh();

    const runEpoch = async (epoch: number): Promise<void> => {
      if (sessionRef.current !== session) return;
      let epochCandidates = candidates.filter((candidate) => candidate.epoch === epoch);
      if (!epochCandidates.length) {
        const parent = epoch > 1 ? bestCandidate(candidates) : null;
        const baseConfig: BalanceCandidateConfig = parent?.config ?? {
          skills: cloneSkills(context.skills),
          balance: { ...context.balance },
          benchmark: { ...context.benchmark },
          waves: cloneWaves(context.waves),
        };
        const excludedValues = candidates.flatMap((candidate) => {
          const configured = candidate.config.skills.find((skill) => skill.id === tuning.skillId);
          return configured ? [tuningParameterValue(configured, tuning.parameter, tuning.level)] : [];
        });
        epochCandidates = createEpochCandidates({ experimentId: experiment.id, epoch, baseConfig, tuning, parentCandidateId: parent?.id ?? null, excludedValues }).map((candidate) => ({ ...candidate, status: "running" as const }));
        candidates.push(...epochCandidates);
        await Promise.all(epochCandidates.map(putBalanceCandidate));
      } else {
        epochCandidates = epochCandidates.map((candidate) => ({ ...candidate, status: "running" as const, updatedAt: Date.now() }));
        const byId = new Map(epochCandidates.map((candidate) => [candidate.id, candidate]));
        candidates = candidates.map((candidate) => byId.get(candidate.id) ?? candidate);
        await Promise.all(epochCandidates.map(putBalanceCandidate));
      }

      const tasks = pendingCandidateSeeds(epochCandidates, tuning.trainSeeds, allRuns);
      const completedBeforeResume = epochCandidates.length * tuning.trainSeeds.length - tasks.length;
      let nextTask = 0;
      let epochCompleted = completedBeforeResume;
      let pendingWrites: BalanceExperimentRun[] = [];

      const flush = async () => {
        const batch = pendingWrites;
        pendingWrites = [];
        if (!batch.length) return;
        await enqueuePersistence(async () => { await putBalanceExperimentRuns(batch); await putBalanceExperiment(experiment); });
        onRefresh();
      };
      flushRef.current = flush;
      const fail = (message: string) => {
        if (sessionRef.current !== session) return;
        stopWorkers(workersRef.current);
        workersRef.current = [];
        experiment = { ...experiment, status: "failed", updatedAt: Date.now() };
        experimentRef.current = experiment;
        void flush().then(() => enqueuePersistence(() => putBalanceExperiment(experiment))).then(onRefresh);
        setProgress((current) => ({ ...current, running: false, status: "failed", message }));
      };
      const dispatch = (worker: Worker) => {
        const task = tasks[nextTask++];
        if (!task || sessionRef.current !== session) return;
        const request: HeadlessBenchmarkRequest = {
          run: epoch * 100_000 + nextTask,
          seed: task.seed,
          sessionId: experiment.id,
          policy: experiment.policy,
          balanceConfig: { ...task.candidate.config.balance },
          benchmarkConfig: { ...task.candidate.config.benchmark },
          skills: cloneSkills(task.candidate.config.skills),
          waveDefinitions: cloneWaves(task.candidate.config.waves ?? context.waves),
          startingSkills: Array.from({ length: tuning.level }, () => tuning.skillId),
        };
        (worker as Worker & { __balanceCandidateId?: string }).__balanceCandidateId = task.candidate.id;
        worker.postMessage(request);
      };
      const finishEpoch = async () => {
        stopWorkers(workersRef.current);
        workersRef.current = [];
        await flush();
        await persistenceRef.current;
        const scored = epochCandidates.map((candidate) => {
          const summary = summarizeBalanceCandidate(candidate, allRuns);
          return { candidate: { ...candidate, score: scoreBalanceCandidate(summary, tuning), status: "complete" as const, updatedAt: Date.now() }, summary };
        }).sort((a, b) => (a.candidate.score ?? Infinity) - (b.candidate.score ?? Infinity));
        const scoreMap = new Map(scored.map((entry) => [entry.candidate.id, entry.candidate]));
        candidates = candidates.map((candidate) => scoreMap.get(candidate.id) ?? candidate);
        await Promise.all(scored.flatMap(({ candidate, summary }) => [putBalanceCandidate(candidate), putBalanceCandidateSummary(summary)]));
        const best = bestCandidate(candidates) ?? scored[0].candidate;
        if (epoch < tuning.epochs && sessionRef.current === session) {
          experiment = { ...experiment, currentEpoch: epoch + 1, completedRuns: allRuns.length, updatedAt: Date.now() };
          experimentRef.current = experiment;
          await putBalanceExperiment(experiment);
          onRefresh();
          setProgress((current) => ({ ...current, epoch: epoch + 1, completedRuns: allRuns.length, message: `Epoch ${epoch} 완료 · 최고 점수 ${best.score?.toFixed(2)}` }));
          await runEpoch(epoch + 1);
          return;
        }
        experiment = { ...experiment, status: "complete", completedRuns: allRuns.length, updatedAt: Date.now() };
        experimentRef.current = experiment;
        await putBalanceExperiment(experiment);
        onRefresh();
        setProgress((current) => ({ ...current, running: false, status: "complete", completedRuns: allRuns.length, message: `완료 · 최고 점수 ${best.score?.toFixed(2)}` }));
      };

      if (!tasks.length) { await finishEpoch(); return; }
      const workerCount = Math.max(1, Math.min(8, tasks.length, (navigator.hardwareConcurrency || 4) - 1));
      const workers = createWorkers(workerCount, (worker, message) => {
        if (sessionRef.current !== session) return;
        if (message.type === "error") { fail(message.message); return; }
        const candidateId = (worker as Worker & { __balanceCandidateId?: string }).__balanceCandidateId;
        const candidate = epochCandidates.find((entry) => entry.id === candidateId);
        if (!candidate) { fail("Worker candidate mapping was lost"); return; }
        const result = message.result as BotRunResult;
        const record: BalanceExperimentRun = { experimentRunId: `${candidate.id}:${result.seed ?? result.run}`, experimentId: experiment.id, candidateId: candidate.id, epoch, seedGroup: "train", seed: result.seed ?? result.run, createdAt: result.createdAt, result };
        allRuns.push(record);
        pendingWrites.push(record);
        epochCompleted += 1;
        experiment = { ...experiment, completedRuns: allRuns.length, updatedAt: Date.now() };
        experimentRef.current = experiment;
        setProgress((current) => ({ ...current, completedRuns: allRuns.length, message: `Epoch ${epoch} · ${epochCompleted}/${epochCandidates.length * tuning.trainSeeds.length}` }));
        if (pendingWrites.length >= 10) void flush();
        if (epochCompleted >= epochCandidates.length * tuning.trainSeeds.length) { void finishEpoch(); return; }
        dispatch(worker);
      }, fail);
      workersRef.current = workers;
      workers.forEach(dispatch);
    };

    await runEpoch(experiment.currentEpoch);
  }, [createWorkers, enqueuePersistence, onRefresh, stopWorkers]);

  const start = useCallback(async (input: Omit<BalanceTuningConfig, "trainSeeds">, context: BalanceEpochContext) => {
    const seedBuffer = new Uint32Array(1);
    crypto.getRandomValues(seedBuffer);
    const seedBase = seedBuffer[0] || (Date.now() >>> 0);
    const createdAt = Date.now();
    const experimentId = `auto-${createdAt.toString(36)}-${sessionRef.current + 1}`;
    const baseConfig: BalanceCandidateConfig = {
      skills: cloneSkills(context.skills),
      balance: { ...context.balance },
      benchmark: { ...context.benchmark },
      waves: cloneWaves(context.waves),
    };
    const sourceSkill = baseConfig.skills.find((skill) => skill.id === input.skillId);
    if (!sourceSkill) throw new Error(`Unknown tuning skill: ${input.skillId}`);
    const referenceValue = normalizeTuningParameterValue(sourceSkill, input.parameter, tuningParameterValue(sourceSkill, input.parameter, input.level));
    const tuning: BalanceTuningConfig = { ...input, referenceValue, trainSeeds: Array.from({ length: input.runsPerCandidate }, (_, index) => (seedBase + Math.imul(index + 1, 7919)) >>> 0) };
    const experiment: BalanceExperiment = { id: experimentId, name: `${context.skills.find((skill) => skill.id === tuning.skillId)?.name ?? tuning.skillId} LV${tuning.level} AUTO`, mode: "auto-tune", status: "running", targetSkillId: tuning.skillId, targetLevel: tuning.level, engineVersion: ENGINE_VERSION, rulesetVersion: PARALLEL_BENCHMARK_RULESET, policyVersion: POLICY_VERSION, policy: context.policy, baseConfigHash: fingerprintBalanceConfig(baseConfig), targetRuns: tuning.epochs * tuning.candidatesPerEpoch * tuning.runsPerCandidate, completedRuns: 0, currentEpoch: 1, tuning, createdAt, updatedAt: createdAt };
    await execute(experiment, context, [], []);
  }, [execute]);

  const resume = useCallback(async (experimentId: string, context: BalanceEpochContext) => {
    const experiment = await getBalanceExperiment(experimentId);
    if (!experiment || experiment.mode !== "auto-tune" || !experiment.tuning) throw new Error("저장된 자동 튜닝 실험을 찾을 수 없습니다.");
    const bundle = await getBalanceExperimentBundle(experimentId);
    await execute(experiment, context, bundle.candidates, bundle.runs);
  }, [execute]);

  return { progress, start, resume, stop };
}
