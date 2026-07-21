import { DEFAULT_BALANCE_CONFIG, type BalanceConfig } from "./balance-config";
import { DEFAULT_BENCHMARK_CONFIG, type BenchmarkConfig } from "./benchmark-config";
import { createBotPolicyState, decideBotControls, POLICY_VERSION, type BotObservation } from "./bot-policy";
import { ENGINE_PARITY, ENGINE_VERSION, FIXED_STEP_SECONDS, PADDLE_SPEED, canonicalSnapshot, createCanonicalState, grantCanonicalSkill, stepCanonicalEngine, type CanonicalState } from "./canonical-engine";
import { DEFAULT_SKILLS, type SkillCategory, type SkillConfig, type UpgradeId } from "./skill-config";
import { WAVE_DEFINITIONS, type WaveDefinition } from "./wave-config";

export type HeadlessBotPolicy = "balanced" | "survival" | "random";
export const PARALLEL_BENCHMARK_RULESET = "canonical-parity-v1" as const;

export type HeadlessBenchmarkRequest = { run: number; seed: number; sessionId?: string; policy: HeadlessBotPolicy; balanceConfig?: BalanceConfig; benchmarkConfig?: BenchmarkConfig; skills?: SkillConfig[]; waveDefinitions?: WaveDefinition[]; maxSimulatedSeconds?: number };
export type HeadlessBenchmarkResult = {
  id: string; run: number; policy: HeadlessBotPolicy; policyVersion: typeof POLICY_VERSION; engineVersion: typeof ENGINE_VERSION; engineParity: typeof ENGINE_PARITY; speed: 8; elapsed: number; wave: number; score: number; bricks: number; maxCombo: number; coreHp: number; upgrades: UpgradeId[]; startingSkills: UpgradeId[];
  skillHistory: CanonicalState["skillHistory"]; ultimates: UpgradeId[]; skillMetrics: CanonicalState["skillMetrics"]; createdAt: number; balanceConfig: BalanceConfig; benchmarkConfig: BenchmarkConfig; benchmarkRuleset: typeof PARALLEL_BENCHMARK_RULESET; waveSamples: CanonicalState["waveMetrics"]; evaluationComplete: boolean; skillBench: null; maxBalls: number; ballLosses: number; missileActivations: number; safetySaves: number; gravityRescues: number; finalSnapshot: ReturnType<typeof canonicalSnapshot>;
};

function levelOf(upgrades: UpgradeId[], id: UpgradeId) { return upgrades.filter((entry) => entry === id).length; }
function chooseSkill(state: CanonicalState, policy: HeadlessBotPolicy, ultimate: boolean) {
  const available = state.skills.filter((skill) => Boolean(skill.ultimate) === ultimate && levelOf(state.upgrades, skill.id) < 3);
  if (!available.length) return null;
  const offered = [...available].sort((a, b) => ((a.id.charCodeAt(0) * 31 + state.seed + state.wave) % 97) - ((b.id.charCodeAt(0) * 31 + state.seed + state.wave) % 97)).slice(0, 3);
  if (policy === "random") return offered[Math.floor(state.random() * offered.length)];
  const weights: Record<Exclude<HeadlessBotPolicy, "random">, Record<SkillCategory, number>> = { balanced: { warrior: 3, archer: 3, mage: 3, common: 2.5 }, survival: { warrior: 5, archer: 2, mage: 4, common: 3.5 } };
  return offered.sort((a, b) => (weights[policy][b.category] + (state.upgrades.includes(b.id) ? 2 : 3)) - (weights[policy][a.category] + (state.upgrades.includes(a.id) ? 2 : 3)) || a.id.localeCompare(b.id))[0];
}

function observation(state: CanonicalState): BotObservation {
  return { elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items };
}

export function runCanonicalControlledSimulation(request: HeadlessBenchmarkRequest, controlProvider: (state: CanonicalState, step: number) => ReturnType<typeof decideBotControls>) {
  const benchmark = { ...DEFAULT_BENCHMARK_CONFIG, ...request.benchmarkConfig } as BenchmarkConfig;
  const state = createCanonicalState({ seed: request.seed, targetWave: benchmark.targetWave, balance: { ...DEFAULT_BALANCE_CONFIG, ...request.balanceConfig }, skills: request.skills?.length ? request.skills : DEFAULT_SKILLS, waves: request.waveDefinitions?.length === WAVE_DEFINITIONS.length ? request.waveDefinitions : WAVE_DEFINITIONS });
  const start = chooseSkill(state, request.policy, false);
  if (start) grantCanonicalSkill(state, start.id, "start");
  let previousWave = state.wave;
  const maxSteps = Math.ceil((request.maxSimulatedSeconds ?? 1800) / FIXED_STEP_SECONDS);
  for (let step = 0; step < maxSteps && !state.complete && !state.gameOver; step++) {
    stepCanonicalEngine(state, controlProvider(state, step), FIXED_STEP_SECONDS);
    if (state.wave !== previousWave) {
      const completedDefinition = state.waves[previousWave - 1];
      const reward = chooseSkill(state, request.policy, Boolean(completedDefinition?.boss));
      if (reward) grantCanonicalSkill(state, reward.id, completedDefinition?.boss ? "boss" : "wave");
      previousWave = state.wave;
    }
  }
  return state;
}

export function runHeadlessBenchmark(request: HeadlessBenchmarkRequest): HeadlessBenchmarkResult {
  const policyState = createBotPolicyState(request.seed ^ 0x9e3779b9);
  const state = runCanonicalControlledSimulation(request, (current) => decideBotControls(observation(current), policyState, FIXED_STEP_SECONDS));
  const benchmark = { ...DEFAULT_BENCHMARK_CONFIG, ...request.benchmarkConfig } as BenchmarkConfig;
  return {
    id: `canonical-${request.sessionId ?? "local"}-${request.seed}-${request.run}`, run: request.run, policy: request.policy, policyVersion: POLICY_VERSION, engineVersion: ENGINE_VERSION, engineParity: ENGINE_PARITY, speed: 8, elapsed: state.elapsed, wave: state.wave, score: state.score, bricks: state.bricksBroken, maxCombo: state.maxCombo, coreHp: state.coreHp, upgrades: [...state.upgrades], startingSkills: state.skillHistory.filter((event) => event.source === "start").map((event) => event.skillId), skillHistory: state.skillHistory, ultimates: state.skillHistory.filter((event) => event.source === "boss").map((event) => event.skillId), skillMetrics: state.skillMetrics, createdAt: Date.now(), balanceConfig: state.balance, benchmarkConfig: benchmark, benchmarkRuleset: PARALLEL_BENCHMARK_RULESET, waveSamples: state.waveMetrics, evaluationComplete: state.complete && state.coreHp > 0, skillBench: null, maxBalls: state.maxBalls, ballLosses: state.ballLosses, missileActivations: state.skillMetrics["archer-rapid"]?.activations ?? 0, safetySaves: state.skillMetrics["warrior-guard"]?.activations ?? 0, gravityRescues: state.skillMetrics["mage-black-hole"]?.activations ?? 0, finalSnapshot: canonicalSnapshot(state),
  };
}
