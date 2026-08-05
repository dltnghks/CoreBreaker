import { DEFAULT_BALANCE_CONFIG, type BalanceConfig } from "./balance-config";
import { DEFAULT_BENCHMARK_CONFIG, type BenchmarkConfig } from "./benchmark-config";
import { createBotPolicyState, decideBotControls, POLICY_VERSION, type BotObservation } from "./bot-policy";
import { ENGINE_PARITY, ENGINE_VERSION, FIXED_STEP_SECONDS, PADDLE_SPEED, canonicalSnapshot, createCanonicalState, dispatchCanonicalCommand, seededRandom, stepCanonicalEngine, type CanonicalOutcome, type CanonicalState } from "./canonical-engine";
import { DEFAULT_SKILLS, type SkillCategory, type SkillConfig, type UpgradeId } from "./skill-config";
import { WAVE_DEFINITIONS, type WaveDefinition } from "./wave-config";

export type HeadlessBotPolicy = "balanced" | "survival" | "random";
export const PARALLEL_BENCHMARK_RULESET = "canonical-command-v20-skill-composer" as const;
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


export type HeadlessBenchmarkRequest = { run: number; seed: number; sessionId?: string; policy: HeadlessBotPolicy; balanceConfig?: BalanceConfig; benchmarkConfig?: BenchmarkConfig; skills?: SkillConfig[]; waveDefinitions?: WaveDefinition[]; maxSimulatedSeconds?: number; startingSkills?: UpgradeId[] };
export type HeadlessBenchmarkResult = {
  id: string; run: number; seed: number; policy: HeadlessBotPolicy; policyVersion: typeof POLICY_VERSION; engineVersion: typeof ENGINE_VERSION; engineParity: typeof ENGINE_PARITY; speed: 8; elapsed: number; wave: number; score: number; bricks: number; maxCombo: number; coreHp: number; upgrades: UpgradeId[]; startingSkills: UpgradeId[];
  skillHistory: CanonicalState["skillHistory"]; bossEnhancements: CanonicalState["bossEnhancements"]; skillMetrics: CanonicalState["skillMetrics"]; physicalPower: number; magicPower: number; physicalDamage: number; magicDamage: number; createdAt: number; balanceConfig: BalanceConfig; benchmarkConfig: BenchmarkConfig; benchmarkRuleset: typeof PARALLEL_BENCHMARK_RULESET; waveSamples: CanonicalState["waveMetrics"]; evaluationComplete: boolean; terminationReason: HeadlessTerminationReason; timeoutDiagnostic: HeadlessTimeoutDiagnostic | null; skillBench: null; maxBalls: number; ballLosses: number; missileActivations: number; safetySaves: number; gravityRescues: number; finalSnapshot: ReturnType<typeof canonicalSnapshot>;
};

function pickCount(upgrades: UpgradeId[], id: UpgradeId) { return upgrades.filter((entry) => entry === id).length; }
const POLICY_CATEGORY_WEIGHTS: Record<Exclude<HeadlessBotPolicy, "random">, Record<SkillCategory, number>> = {
  balanced: { warrior: 3, archer: 3, mage: 3, common: 2.5 },
  survival: { warrior: 5, archer: 2, mage: 4, common: 3.5 },
};

function progressionBonus(state: CanonicalState, skillId: UpgradeId) {
  const picks = pickCount(state.upgrades, skillId);
  if (picks <= 0) return 0.45;
  if (picks === 1) return 1.8;
  if (picks === 2) return 2.5;
  return 3.2;
}

function benchmarkSkillScore(state: CanonicalState, skill: { id: UpgradeId; category: SkillCategory }, policy: Exclude<HeadlessBotPolicy, "random">, random: () => number) {
  return POLICY_CATEGORY_WEIGHTS[policy][skill.category] + progressionBonus(state, skill.id) + random() * 0.9;
}

export function chooseBenchmarkSkill(state: CanonicalState, policy: HeadlessBotPolicy) {
  const random = seededRandom(state.seed ^ 0x51ed270b ^ state.upgrades.length);
  const available = state.skills.filter((skill) => pickCount(state.upgrades, skill.id) < (skill.evolutionEnabled ? 4 : 3));
  if (!available.length) return null;
  const offered = available
    .map((skill) => ({ skill, offerRoll: random() }))
    .sort((a, b) => a.offerRoll - b.offerRoll || a.skill.id.localeCompare(b.skill.id))
    .slice(0, 3)
    .map(({ skill }) => skill);
  if (policy === "random") return offered[Math.floor(random() * offered.length)];
  return offered
    .map((skill) => ({
      skill,
      score: benchmarkSkillScore(state, skill, policy, random),
    }))
    .sort((a, b) => b.score - a.score || a.skill.id.localeCompare(b.skill.id))[0].skill;
}

export function chooseBenchmarkEnhancement(state: CanonicalState, policy: HeadlessBotPolicy) {
  const random = seededRandom(state.seed ^ 0x7f4a7c15 ^ state.skillHistory.length);
  const owned = state.skills.filter((skill) => state.upgrades.includes(skill.id));
  if (!owned.length) return null;
  return owned.slice().sort((a, b) => (policy === "random" ? random() - 0.5 : (state.bossEnhancements[a.id] ?? 0) - (state.bossEnhancements[b.id] ?? 0)) || a.id.localeCompare(b.id))[0];
}

function chooseOfferedSkill(state: CanonicalState, outcome: Extract<CanonicalOutcome, { type: "start-skill" | "wave-skill" }>, policy: HeadlessBotPolicy, random: () => number) {
  if (!outcome.choices.length) return null;
  if (policy === "random") return outcome.choices[Math.floor(random() * outcome.choices.length)];
  return outcome.choices
    .map((choice) => ({ choice, score: benchmarkSkillScore(state, choice.upgrade, policy, random) }))
    .sort((a, b) => b.score - a.score || a.choice.upgrade.id.localeCompare(b.choice.upgrade.id))[0].choice;
}

function resolveCanonicalDecision(state: CanonicalState, outcome: CanonicalOutcome, policy: HeadlessBotPolicy, random: () => number) {
  if (outcome.type === "start-skill" || outcome.type === "wave-skill") {
    const hasOwnedChoice = outcome.choices.some((choice) => state.upgrades.includes(choice.upgrade.id));
    if (outcome.type === "wave-skill" && policy !== "random" && outcome.rerollsLeft > 0 && state.upgrades.length > 0 && !hasOwnedChoice) {
      dispatchCanonicalCommand(state, { type: "reroll-skills" });
      return;
    }
    const choice = chooseOfferedSkill(state, outcome, policy, random);
    if (!choice) return;
    dispatchCanonicalCommand(state, {
      type: outcome.type === "start-skill" ? "choose-start-skill" : "choose-wave-skill",
      skillId: choice.upgrade.id,
      ballCost: choice.ballCost,
    });
  } else if (outcome.type === "wave-clear") {
    dispatchCanonicalCommand(state, { type: "acknowledge-wave-clear" });
  } else if (outcome.type === "boss-reward") {
    const choice = outcome.choices.slice().sort((a, b) => {
      if (policy === "random") return random() - 0.5;
      return (state.bossEnhancements[a] ?? 0) - (state.bossEnhancements[b] ?? 0) || a.localeCompare(b);
    })[0];
    if (choice) dispatchCanonicalCommand(state, { type: "choose-boss-reward", skillId: choice });
  } else if (outcome.type === "ready-for-next-wave") {
    dispatchCanonicalCommand(state, { type: "start-next-wave" });
  }
}

function observation(state: CanonicalState): BotObservation {
  return { elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items };
}

export function runCanonicalControlledSimulation(request: HeadlessBenchmarkRequest, controlProvider: (state: CanonicalState, step: number) => ReturnType<typeof decideBotControls>) {
  const benchmark = { ...DEFAULT_BENCHMARK_CONFIG, ...request.benchmarkConfig } as BenchmarkConfig;
  const state = createCanonicalState({ seed: request.seed, targetWave: benchmark.targetWave, balance: { ...DEFAULT_BALANCE_CONFIG, ...request.balanceConfig }, skills: request.skills?.length ? request.skills : DEFAULT_SKILLS, waves: request.waveDefinitions?.length === WAVE_DEFINITIONS.length ? request.waveDefinitions : WAVE_DEFINITIONS, interactive: true, startingSkills: request.startingSkills });
  const decisionRandom = seededRandom(request.seed ^ 0x9e3779b9);
  const maxSteps = Math.ceil((request.maxSimulatedSeconds ?? 1800) / FIXED_STEP_SECONDS);
  for (let step = 0; step < maxSteps && !state.complete && !state.gameOver; step++) {
    let result = stepCanonicalEngine(state, controlProvider(state, step), FIXED_STEP_SECONDS);
    while (result.outcome.type !== "running" && result.outcome.type !== "complete" && result.outcome.type !== "game-over") {
      resolveCanonicalDecision(state, result.outcome, request.policy, decisionRandom);
      result = stepCanonicalEngine(state, controlProvider(state, step), 0);
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
      : damageLast30Seconds <= 0 && (remainingTraits.reflector ?? 0) > 0 && waveReflectorBlockedHits > 0 ? "reflector-lock"
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
    id: `canonical-${request.sessionId ?? "local"}-${request.seed}-${request.run}`, run: request.run, seed: request.seed, policy: request.policy, policyVersion: POLICY_VERSION, engineVersion: ENGINE_VERSION, engineParity: ENGINE_PARITY, speed: 8, elapsed: state.elapsed, wave: state.wave, score: state.score, bricks: state.bricksBroken, maxCombo: state.maxCombo, coreHp: state.coreHp, upgrades: [...state.upgrades], startingSkills: state.skillHistory.filter((event) => event.source === "start").map((event) => event.skillId), skillHistory: state.skillHistory, bossEnhancements: { ...state.bossEnhancements }, skillMetrics: state.skillMetrics, physicalPower: state.combatStats.physicalPower, magicPower: state.combatStats.magicPower, physicalDamage: state.physicalDamage, magicDamage: state.magicDamage, createdAt: Date.now(), balanceConfig: state.balance, benchmarkConfig: benchmark, benchmarkRuleset: PARALLEL_BENCHMARK_RULESET, waveSamples: state.waveMetrics, evaluationComplete: state.complete && state.coreHp > 0, terminationReason, timeoutDiagnostic, skillBench: null, maxBalls: state.maxBalls, ballLosses: state.ballLosses, missileActivations: state.skillMetrics["archer-rapid"]?.activations ?? 0, safetySaves: state.skillMetrics["warrior-guard"]?.activations ?? 0, gravityRescues: state.skillMetrics["mage-black-hole"]?.activations ?? 0, finalSnapshot: canonicalSnapshot(state),
  };
}
