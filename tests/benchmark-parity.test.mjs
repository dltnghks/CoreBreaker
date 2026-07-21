import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const vite = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)), configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "silent" });
after(async () => { await vite.close(); });
const load = (id) => vite.environments.ssr.runner.import(id);
const engine = await load("/app/canonical-engine.ts");
const policy = await load("/app/bot-policy.ts");
const benchmark = await load("/app/benchmark-headless.ts");
const waves = await load("/app/wave-config.ts");

test("seeded gameplay stepping and benchmark stepping share canonical outcomes", () => {
  const left = engine.createCanonicalState({ seed: 90210, targetWave: 1 });
  const right = engine.createCanonicalState({ seed: 90210, targetWave: 1 });
  for (let step = 0; step < 1800; step++) {
    const controls = { move: step % 240 < 80 ? 1 : step % 240 < 160 ? -1 : 0, aimX: 420 + step % 90, aimY: 120 };
    engine.stepCanonicalEngine(left, controls, engine.FIXED_STEP_SECONDS);
    engine.stepCanonicalEngine(right, controls, engine.FIXED_STEP_SECONDS);
  }
  assert.deepEqual(engine.canonicalSnapshot(left), engine.canonicalSnapshot(right));
});

test("headless benchmark is deterministic for a seed and persists parity versions", () => {
  const request = { run: 1, seed: 77123, policy: "balanced", maxSimulatedSeconds: 20 };
  const first = benchmark.runHeadlessBenchmark(request);
  const second = benchmark.runHeadlessBenchmark(request);
  assert.deepEqual({ ...first, id: "", createdAt: 0 }, { ...second, id: "", createdAt: 0 });
  assert.equal(first.policyVersion, policy.POLICY_VERSION);
  assert.equal(first.engineVersion, engine.ENGINE_VERSION);
  assert.equal(first.engineParity, engine.ENGINE_PARITY);
});

test("small seeded pilot keeps canonical benchmark metadata and finite outcomes", () => {
  const results = [1201, 1202, 1203].map((seed, index) => benchmark.runHeadlessBenchmark({
    run: index + 1,
    seed,
    policy: "balanced",
    benchmarkConfig: { targetWave: 3 },
    maxSimulatedSeconds: 90,
  }));
  assert.equal(results.length, 3);
  for (const result of results) {
    assert.equal(result.policyVersion, policy.POLICY_VERSION);
    assert.equal(result.engineVersion, engine.ENGINE_VERSION);
    assert.equal(result.engineParity, engine.ENGINE_PARITY);
    assert.ok(Number.isFinite(result.elapsed));
    assert.ok(result.wave >= 1 && result.wave <= 3);
    assert.ok(result.coreHp >= 0);
  }
});

test("predictive policy completes or actively banks a reflector-only opening", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["....rrrr...."] };
  const state = engine.createCanonicalState({ seed: 551, targetWave: 1, waves: definitions });
  const bot = policy.createBotPolicyState(551);
  for (let step = 0; step < 120 * 45 && !state.complete && !state.gameOver; step++) {
    const controls = policy.decideBotControls({ elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: engine.PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items }, bot, engine.FIXED_STEP_SECONDS);
    engine.stepCanonicalEngine(state, controls, engine.FIXED_STEP_SECONDS);
  }
  assert.ok(state.complete || bot.bankPhase > 0, "reflector policy must clear or escape a protected-face stall");
});

test("bot policy exposes controls only and cannot mutate observed game state", () => {
  const state = engine.createCanonicalState({ seed: 44, targetWave: 1 });
  const before = engine.canonicalSnapshot(state);
  const controls = policy.decideBotControls({ elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: engine.PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items }, policy.createBotPolicyState(44), engine.FIXED_STEP_SECONDS);
  assert.deepEqual(engine.canonicalSnapshot(state), before);
  assert.deepEqual(Object.keys(controls).sort(), ["aimX", "aimY", "move"]);
});
