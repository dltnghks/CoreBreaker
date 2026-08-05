import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const vite = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)), configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "silent" });
after(async () => { await vite.close(); });
const experiment = await vite.environments.ssr.runner.import("/app/balance-experiment.ts");
const epoch = await vite.environments.ssr.runner.import("/app/balance-epoch.ts");
const skills = await vite.environments.ssr.runner.import("/app/skill-config.ts");

const candidate = {
  id: "candidate-a",
  experimentId: "experiment-a",
  epoch: 1,
  label: "A",
  parentCandidateId: null,
  configHash: "hash",
  config: { skills: [], balance: {}, benchmark: {}, waves: [] },
  score: null,
  status: "complete",
  createdAt: 1,
  updatedAt: 1,
};

function run(seed, values) {
  return {
    experimentRunId: `candidate-a:${seed}`,
    experimentId: "experiment-a",
    candidateId: "candidate-a",
    epoch: 1,
    seedGroup: "train",
    seed,
    createdAt: seed,
    result: {
      run: seed,
      seed,
      evaluationComplete: values.complete,
      elapsed: values.elapsed,
      wave: values.wave,
      coreHp: values.core,
      score: values.score,
      physicalDamage: values.physical,
      magicDamage: values.magic,
      ballLosses: values.losses,
      terminationReason: values.timeout ? "timeout" : "complete",
      engineVersion: "engine",
      benchmarkRuleset: "ruleset",
    },
  };
}

test("balance configuration fingerprints are stable across object key order", () => {
  const a = { skills: [{ id: "skill", levels: [1, 2, 3] }], balance: { a: 1, b: 2 }, benchmark: { runs: 5 }, waves: [{ wave: 1, pattern: ["nn"] }] };
  const b = { waves: [{ pattern: ["nn"], wave: 1 }], benchmark: { runs: 5 }, balance: { b: 2, a: 1 }, skills: [{ levels: [1, 2, 3], id: "skill" }] };
  assert.equal(experiment.fingerprintBalanceConfig(a), experiment.fingerprintBalanceConfig(b));
});

test("candidate summaries retain completion, median, damage, loss, and timeout metrics", () => {
  const runs = [
    run(1, { complete: true, elapsed: 100, wave: 20, core: 4, score: 1000, physical: 80, magic: 20, losses: 2, timeout: false }),
    run(2, { complete: false, elapsed: 300, wave: 12, core: 0, score: 500, physical: 60, magic: 40, losses: 8, timeout: true }),
  ];
  const summary = experiment.summarizeBalanceCandidate(candidate, runs);
  assert.equal(summary.runCount, 2);
  assert.equal(summary.completionRate, 50);
  assert.equal(summary.averageElapsed, 200);
  assert.equal(summary.medianElapsed, 200);
  assert.equal(summary.averagePhysicalDamage, 70);
  assert.equal(summary.averageMagicDamage, 30);
  assert.equal(summary.averageBallLosses, 5);
  assert.equal(summary.timeoutRate, 50);
});

test("candidate comparison and CSV export preserve reproducible experiment keys", () => {
  const baseline = experiment.summarizeBalanceCandidate(candidate, [run(7, { complete: false, elapsed: 200, wave: 10, core: 0, score: 100, physical: 10, magic: 5, losses: 8, timeout: true })]);
  const improved = { ...baseline, candidateId: "candidate-b", completionRate: 100, averageElapsed: 150 };
  const comparison = experiment.compareBalanceCandidates(baseline, improved);
  assert.equal(comparison.find((row) => row.metric === "completionRate").delta, 100);
  assert.equal(comparison.find((row) => row.metric === "averageElapsed").delta, -50);
  const csv = experiment.experimentRunsToCsv([run(7, { complete: false, elapsed: 200, wave: 10, core: 0, score: 100, physical: 10, magic: 5, losses: 8, timeout: true })], { parameter: "magicDamage", level: 1, referenceValue: 2, candidateValue: 3, configHash: "abc123", score: 12.5 });
  assert.match(csv, /experimentId,epoch,candidateId,seedGroup,seed/);
  assert.match(csv, /experiment-a,1,candidate-a,train,7/);
  assert.match(csv, /tuningParameter,tuningLevel,referenceValue,candidateValue,configHash,candidateScore/);
  assert.match(csv, /magicDamage,1,2,3,abc123,12.5/);
});

test("paired comparison only compares identical seeds", () => {
  const baseline = [
    run(11, { complete: false, elapsed: 200, wave: 10, core: 0, score: 100, physical: 10, magic: 5, losses: 8, timeout: false }),
    run(12, { complete: true, elapsed: 180, wave: 20, core: 2, score: 200, physical: 20, magic: 10, losses: 3, timeout: false }),
  ];
  const candidateRuns = [
    { ...run(11, { complete: true, elapsed: 150, wave: 20, core: 3, score: 300, physical: 30, magic: 20, losses: 2, timeout: false }), candidateId: "candidate-b" },
    { ...run(99, { complete: true, elapsed: 100, wave: 20, core: 8, score: 999, physical: 99, magic: 99, losses: 0, timeout: false }), candidateId: "candidate-b" },
  ];
  const paired = experiment.comparePairedBalanceRuns(baseline, candidateRuns);
  assert.equal(paired.pairCount, 1);
  assert.equal(paired.improvedSeeds, 1);
  assert.equal(paired.completionRateDelta, 100);
  assert.equal(paired.averageElapsedDelta, -50);
});

test("epoch candidates change one selected level axis and keep a paired seed queue", () => {
  const baseConfig = { skills: skills.DEFAULT_SKILLS, balance: {}, benchmark: { targetWave: 20, runs: 3, stage: 5 }, waves: [{ wave: 1, name: "TEST", boss: null, pattern: ["nn"], hpMultiplier: 1 }] };
  const tuning = { skillId: "mage-fireball", level: 2, parameter: "magicDamage", epochs: 3, candidatesPerEpoch: 5, runsPerCandidate: 3, targetCompletionRate: 55, targetCoreHp: 3, trainSeeds: [101, 102, 103] };
  const candidates = epoch.createEpochCandidates({ experimentId: "auto-test", epoch: 1, baseConfig, tuning, createdAt: 1 });
  assert.equal(candidates.length, 5);
  const values = candidates.map((entry) => entry.config.skills.find((skill) => skill.id === "mage-fireball").magicDamage[1]);
  assert.ok(values[0] < values[2] && values[2] < values[4]);
  assert.ok(values.every(Number.isInteger), "magic damage candidates must use integer steps");
  assert.equal(new Set(values).size, values.length);
  const unaffected = candidates.map((entry) => entry.config.skills.find((skill) => skill.id === "mage-fireball").magicDamage[0]);
  assert.deepEqual(unaffected, [1, 1, 1, 1, 1]);
  const tasks = epoch.pendingCandidateSeeds(candidates, tuning.trainSeeds, []);
  assert.equal(tasks.length, 15);
  assert.deepEqual(tasks.slice(0, 3).map((task) => task.seed), tuning.trainSeeds);
  const remaining = epoch.pendingCandidateSeeds(candidates, tuning.trainSeeds, [{ candidateId: candidates[0].id, seed: 101 }]);
  assert.equal(remaining.length, 14);

  const nextEpoch = epoch.createEpochCandidates({ experimentId: "auto-test", epoch: 2, baseConfig: candidates[2].config, tuning, excludedValues: values, createdAt: 2 });
  const nextValues = nextEpoch.map((entry) => entry.config.skills.find((skill) => skill.id === "mage-fireball").magicDamage[1]);
  assert.equal(new Set(nextValues).size, nextValues.length);
  assert.ok(nextValues.every((value) => Number.isInteger(value) && !values.includes(value)), "later epochs must backfill unseen integer values");
});

test("candidate steps follow the tuned value unit instead of one shared decimal precision", () => {
  const byId = new Map(skills.DEFAULT_SKILLS.map((skill) => [skill.id, skill]));
  assert.equal(epoch.tuningParameterStep(byId.get("warrior-smash"), "magicDamage"), 1);
  assert.equal(epoch.tuningParameterStep(byId.get("warrior-smash"), "levelValue"), 1);
  assert.equal(epoch.tuningParameterStep(byId.get("archer-rapid"), "levelValue"), 0.25);
  assert.equal(epoch.tuningParameterStep(byId.get("archer-weakpoint"), "levelValue"), 0.25);
  assert.equal(epoch.tuningParameterStep(byId.get("mage-black-hole"), "levelValue"), 5);
  assert.equal(epoch.tuningParameterStep(byId.get("warrior-smash"), "cooldown"), 0.1);
});
