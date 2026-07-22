import { DEFAULT_BALANCE_CONFIG, type BalanceConfig } from "./balance-config";
import { DEFAULT_BENCHMARK_CONFIG, type BenchmarkConfig } from "./benchmark-config";
import { createBotPolicyState, decideBotControls, POLICY_VERSION, type BotObservation } from "./bot-policy";
import { ENGINE_PARITY, ENGINE_VERSION, FIXED_STEP_SECONDS, PADDLE_SPEED, canonicalSnapshot, createCanonicalState, grantCanonicalSkill, stepCanonicalEngine, type CanonicalState } from "./canonical-engine";
import { DEFAULT_SKILLS, type SkillCategory, type SkillConfig, type UpgradeId } from "./skill-config";
import { WAVE_DEFINITIONS, type WaveDefinition } from "./wave-config";

export type HeadlessBotPolicy = "balanced" | "survival" | "random";
export const PARALLEL_BENCHMARK_RULESET = "canonical-parity-v1" as const;
export type HeadlessTerminationReason = "complete" | "core-dead" | "timeout";
export type HeadlessTimeoutDiagnostic = {
  classification: "reflector-lock" | "trajectory-loop" | "healer-stalemate" | "reinforcement-overrun" | "completion-rule" | "no-damage" | "insufficient-throughput";
  stuckWave: number;
  waveElapsed: number;
  remainingBrickCount: number;
  remainingHp: number;
  remainingTraits: Record<string, number>;
  remainingBricks: Array<{ id: number; trait: string; kind: string; hp: number; maxHp: number; x: number; y: number }>;
  secondsSinceLastDamage: number;
  damageLast30Seconds: number;
  lastTargetKey: string;
  bankPhase: number;
  targetChanges: number;
  reflectorBlockedHits: number;
  maxTrajectoryRepeats: number;
};


export type HeadlessBenchmarkRequest = { run: number; seed: number; sessionId?: string; policy: HeadlessBotPolicy; balanceConfig?: BalanceConfig; benchmarkConfig?: BenchmarkConfig; skills?: SkillConfig[]; waveDefinitions?: WaveDefinition[]; maxSimulatedSeconds?: number };
export type HeadlessBenchmarkResult = {
  id: string; run: number; seed: number; policy: HeadlessBotPolicy; policyVersion: typeof POLICY_VERSION; engineVersion: typeof ENGINE_VERSION; engineParity: typeof ENGINE_PARITY; speed: 8; elapsed: number; wave: number; score: number; bricks: number; maxCombo: number; coreHp: number; upgrades: UpgradeId[]; startingSkills: UpgradeId[];
  skillHistory: CanonicalState["skillHistory"]; ultimates: UpgradeId[]; skillMetrics: CanonicalState["skillMetrics"]; createdAt: number; balanceConfig: BalanceConfig; benchmarkConfig: BenchmarkConfig; benchmarkRuleset: typeof PARALLEL_BENCHMARK_RULESET; waveSamples: CanonicalState["waveMetrics"]; evaluationComplete: boolean; terminationReason: HeadlessTerminationReason; timeoutDiagnostic: HeadlessTimeoutDiagnostic | null; skillBench: null; maxBalls: number; ballLosses: number; missileActivations: number; safetySaves: number; gravityRescues: number; finalSnapshot: ReturnType<typeof canonicalSnapshot>;
};

function pickCount(upgrades: UpgradeId[], id: UpgradeId) { return upgrades.filter((entry) => entry === id).length; }
export function chooseBenchmarkSkill(state: CanonicalState, policy: HeadlessBotPolicy, ultimate: boolean) {
  const available = state.skills.filter((skill) => Boolean(skill.ultimate) === ultimate
    && pickCount(state.upgrades, skill.id) < (skill.evolution ? 4 : 3)
    && (!ultimate || !state.upgrades.includes(skill.id)));
  if (!available.length) return null;
  const offered = available
    .map((skill) => ({ skill, offerRoll: state.random() }))
    .sort((a, b) => a.offerRoll - b.offerRoll || a.skill.id.localeCompare(b.skill.id))
    .slice(0, 3)
    .map(({ skill }) => skill);
  if (policy === "random") return offered[Math.floor(state.random() * offered.length)];
  const weights: Record<Exclude<HeadlessBotPolicy, "random">, Record<SkillCategory, number>> = { balanced: { warrior: 3, archer: 3, mage: 3, common: 2.5 }, survival: { warrior: 5, archer: 2, mage: 4, common: 3.5 } };
  return offered
    .map((skill) => ({
      skill,
      score: weights[policy][skill.category] + (state.upgrades.includes(skill.id) ? 0.35 : 1.2) + state.random() * 1.75,
    }))
    .sort((a, b) => b.score - a.score || a.skill.id.localeCompare(b.skill.id))[0].skill;
}

function observation(state: CanonicalState): BotObservation {
  return { elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items };
}

export function runCanonicalControlledSimulation(request: HeadlessBenchmarkRequest, controlProvider: (state: CanonicalState, step: number) => ReturnType<typeof decideBotControls>) {
  const benchmark = { ...DEFAULT_BENCHMARK_CONFIG, ...request.benchmarkConfig } as BenchmarkConfig;
  const state = createCanonicalState({ seed: request.seed, targetWave: benchmark.targetWave, balance: { ...DEFAULT_BALANCE_CONFIG, ...request.balanceConfig }, skills: request.skills?.length ? request.skills : DEFAULT_SKILLS, waves: request.waveDefinitions?.length === WAVE_DEFINITIONS.length ? request.waveDefinitions : WAVE_DEFINITIONS });
  const start = chooseBenchmarkSkill(state, request.policy, false);
  if (start) grantCanonicalSkill(state, start.id, "start");
  let previousWave = state.wave;
  const maxSteps = Math.ceil((request.maxSimulatedSeconds ?? 1800) / FIXED_STEP_SECONDS);
  for (let step = 0; step < maxSteps && !state.complete && !state.gameOver; step++) {
    stepCanonicalEngine(state, controlProvider(state, step), FIXED_STEP_SECONDS);
    if (state.wave !== previousWave) {
      const completedDefinition = state.waves[previousWave - 1];
      const reward = chooseBenchmarkSkill(state, request.policy, Boolean(completedDefinition?.boss));
      if (reward) grantCanonicalSkill(state, reward.id, completedDefinition?.boss ? "boss" : "wave");
      previousWave = state.wave;
    }
  }
  return state;
}

export function runHeadlessBenchmark(request: HeadlessBenchmarkRequest): HeadlessBenchmarkResult {
  const policyState = createBotPolicyState(request.seed ^ 0x9e3779b9);
  let trackedWave = 1;
  let targetChanges = 0;
  let previousTargetKey = "";
  let reflectorBlockedStart = 0;
  let maxTrajectoryRepeats = 0;
  let nextTrajectorySample = 0;
  const trajectoryVisits = new Map<string, number>();
  const damageHistory: Array<{ elapsed: number; damage: number }> = [{ elapsed: 0, damage: 0 }];
  const state = runCanonicalControlledSimulation(request, (current, step) => {
    if (current.wave !== trackedWave) {
      trackedWave = current.wave;
      targetChanges = 0;
      previousTargetKey = "";
      reflectorBlockedStart = current.reflectorBlockedHits;
      maxTrajectoryRepeats = 0;
      trajectoryVisits.clear();
    }
    const controls = decideBotControls(observation(current), policyState, FIXED_STEP_SECONDS);
    if (policyState.lastTargetKey !== previousTargetKey) {
      if (previousTargetKey) targetChanges++;
      previousTargetKey = policyState.lastTargetKey;
    }
    if (step >= nextTrajectorySample) {
      nextTrajectorySample = step + Math.round(1 / FIXED_STEP_SECONDS);
      damageHistory.push({ elapsed: current.elapsed, damage: current.totalDamage });
      const trajectoryKey = current.balls.map((ball) => `${Math.round(ball.x / 18)}:${Math.round(ball.y / 18)}:${Math.sign(ball.vx)}:${Math.sign(ball.vy)}`).sort().join("|");
      const visits = (trajectoryVisits.get(trajectoryKey) ?? 0) + 1;
      trajectoryVisits.set(trajectoryKey, visits);
      maxTrajectoryRepeats = Math.max(maxTrajectoryRepeats, visits);
    }
    return controls;
  });
  const benchmark = { ...DEFAULT_BENCHMARK_CONFIG, ...request.benchmarkConfig } as BenchmarkConfig;
  const terminationReason: HeadlessTerminationReason = state.complete ? "complete" : state.gameOver ? "core-dead" : "timeout";
  const remainingBricks = state.bricks.filter((brick) => brick.alive);
  const remainingTraits = remainingBricks.reduce<Record<string, number>>((counts, brick) => {
    counts[brick.trait] = (counts[brick.trait] ?? 0) + 1;
    return counts;
  }, {});
  const damageWindowStart = Math.max(0, state.elapsed - 30);
  let damageAtWindowStart = 0;
  for (const sample of damageHistory) {
    if (sample.elapsed > damageWindowStart) break;
    damageAtWindowStart = sample.damage;
  }
  const damageLast30Seconds = Math.max(0, state.totalDamage - damageAtWindowStart);
  const waveReflectorBlockedHits = Math.max(0, state.reflectorBlockedHits - reflectorBlockedStart);
  const damageableRemaining = remainingBricks.filter((brick) => brick.trait !== "indestructible");
  const hasHealer = remainingBricks.some((brick) => brick.trait === "healer");
  const bossMinions = remainingBricks.filter((brick) => brick.kind === "boss-minion").length;
  const classification: HeadlessTimeoutDiagnostic["classification"] =
    damageableRemaining.length === 0 && remainingBricks.length > 0 ? "completion-rule"
      : damageLast30Seconds <= 0 && waveReflectorBlockedHits > 0 ? "reflector-lock"
      : damageLast30Seconds <= 0 && maxTrajectoryRepeats >= 3 ? "trajectory-loop"
      : hasHealer && damageLast30Seconds <= Math.max(2, remainingTraits.healer ?? 0) ? "healer-stalemate"
      : bossMinions >= 4 && damageLast30Seconds < bossMinions ? "reinforcement-overrun"
      : damageLast30Seconds <= 0 ? "no-damage"
      : "insufficient-throughput";
  const timeoutDiagnostic: HeadlessTimeoutDiagnostic | null = terminationReason === "timeout" ? {
    classification,
    stuckWave: state.wave,
    waveElapsed: Number(state.waveElapsed.toFixed(3)),
    remainingBrickCount: remainingBricks.length,
    remainingHp: Number(remainingBricks.reduce((sum, brick) => sum + Math.max(0, brick.hp), 0).toFixed(3)),
    remainingTraits,
    remainingBricks: remainingBricks.map((brick) => ({ id: brick.id, trait: brick.trait, kind: brick.kind, hp: Number(brick.hp.toFixed(3)), maxHp: Number(brick.maxHp.toFixed(3)), x: Number(brick.x.toFixed(1)), y: Number(brick.y.toFixed(1)) })),
    secondsSinceLastDamage: Number(Math.max(0, state.elapsed - state.lastDamageElapsed).toFixed(3)),
    damageLast30Seconds: Number(damageLast30Seconds.toFixed(3)),
    lastTargetKey: policyState.lastTargetKey,
    bankPhase: policyState.bankPhase,
    targetChanges,
    reflectorBlockedHits: waveReflectorBlockedHits,
    maxTrajectoryRepeats,
  } : null;
  return {
    id: `canonical-${request.sessionId ?? "local"}-${request.seed}-${request.run}`, run: request.run, seed: request.seed, policy: request.policy, policyVersion: POLICY_VERSION, engineVersion: ENGINE_VERSION, engineParity: ENGINE_PARITY, speed: 8, elapsed: state.elapsed, wave: state.wave, score: state.score, bricks: state.bricksBroken, maxCombo: state.maxCombo, coreHp: state.coreHp, upgrades: [...state.upgrades], startingSkills: state.skillHistory.filter((event) => event.source === "start").map((event) => event.skillId), skillHistory: state.skillHistory, ultimates: state.skillHistory.filter((event) => event.source === "boss").map((event) => event.skillId), skillMetrics: state.skillMetrics, createdAt: Date.now(), balanceConfig: state.balance, benchmarkConfig: benchmark, benchmarkRuleset: PARALLEL_BENCHMARK_RULESET, waveSamples: state.waveMetrics, evaluationComplete: state.complete && state.coreHp > 0, terminationReason, timeoutDiagnostic, skillBench: null, maxBalls: state.maxBalls, ballLosses: state.ballLosses, missileActivations: state.skillMetrics["archer-rapid"]?.activations ?? 0, safetySaves: state.skillMetrics["warrior-guard"]?.activations ?? 0, gravityRescues: state.skillMetrics["mage-black-hole"]?.activations ?? 0, finalSnapshot: canonicalSnapshot(state),
  };
}
