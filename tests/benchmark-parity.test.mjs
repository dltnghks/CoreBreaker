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
  assert.equal(first.seed, request.seed);
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

test("predictive policy avoids direct reflector aim and computes a side-wall bank shot", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["...xrrrrx..."] };
  const state = engine.createCanonicalState({ seed: 551, targetWave: 1, waves: definitions });
  const bot = policy.createBotPolicyState(551);
  const controls = policy.decideBotControls({ elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: engine.PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items }, bot, engine.FIXED_STEP_SECONDS);
  assert.match(bot.lastTargetKey, /:reflector:bank$/);
  assert.ok(controls.aimX === 0 || controls.aimX === engine.GAME_WIDTH);
  assert.ok(controls.aimY < engine.PLAYER_PADDLE_Y - 50);
});

test("reflector bank policy can damage a protected reflector layout", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["....rrrr...."] };
  const state = engine.createCanonicalState({ seed: 553, targetWave: 1, waves: definitions });
  const bot = policy.createBotPolicyState(553);
  const initialHp = state.bricks.reduce((sum, brick) => sum + brick.hp, 0);
  for (let step = 0; step < 120 * 45 && !state.complete && !state.gameOver; step++) {
    const controls = policy.decideBotControls({ elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: engine.PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items }, bot, engine.FIXED_STEP_SECONDS);
    engine.stepCanonicalEngine(state, controls, engine.FIXED_STEP_SECONDS);
  }
  const remainingHp = state.bricks.filter((brick) => brick.alive).reduce((sum, brick) => sum + brick.hp, 0);
  assert.ok(state.complete || remainingHp < initialHp, "bank aiming should reach a reflector side or upper face");
});

test("predictive policy never targets indestructible-only layouts", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["...xxxxxx..."] };
  const state = engine.createCanonicalState({ seed: 552, targetWave: 1, waves: definitions });
  const bot = policy.createBotPolicyState(552);
  const controls = policy.decideBotControls({ elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: engine.PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items }, bot, engine.FIXED_STEP_SECONDS);
  assert.equal(bot.lastTargetKey, "none");
  assert.equal(controls.aimX, engine.GAME_WIDTH / 2);
});

test("bot policy exposes controls only and cannot mutate observed game state", () => {
  const state = engine.createCanonicalState({ seed: 44, targetWave: 1 });
  const before = engine.canonicalSnapshot(state);
  const controls = policy.decideBotControls({ elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: engine.PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items }, policy.createBotPolicyState(44), engine.FIXED_STEP_SECONDS);
  assert.deepEqual(engine.canonicalSnapshot(state), before);
  assert.deepEqual(Object.keys(controls).sort(), ["aimX", "aimY", "move"]);
});

test("guard changes into a standard brick after one direct ball hit", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: [".....g......"] };
  const state = engine.createCanonicalState({ seed: 91, targetWave: 1, waves: definitions });
  const guard = state.bricks[0];
  const ball = state.balls[0];
  ball.x = guard.x + guard.w / 2;
  ball.y = guard.y + guard.h + ball.radius - 1;
  ball.vx = 0;
  ball.vy = -320;
  const hpBefore = guard.hp;
  engine.stepCanonicalEngine(state, { move: 0, aimX: engine.GAME_WIDTH / 2, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(guard.guardReady, false);
  assert.equal(guard.trait, "standard");
  assert.equal(guard.hp, hpBefore);
});

test("skill level stops at three and evolution is recorded on the fourth pick", () => {
  const state = engine.createCanonicalState({ seed: 92, targetWave: 1 });
  assert.equal(engine.grantCanonicalSkill(state, "mage-fireball", "start"), true);
  assert.equal(engine.grantCanonicalSkill(state, "mage-fireball", "wave"), true);
  assert.equal(engine.grantCanonicalSkill(state, "mage-fireball", "wave"), true);
  assert.equal(engine.grantCanonicalSkill(state, "mage-fireball", "wave"), true);
  assert.deepEqual(state.skillHistory.map((event) => [event.level, Boolean(event.evolved)]), [[1, false], [2, false], [3, false], [3, true]]);
  assert.equal(engine.grantCanonicalSkill(state, "mage-fireball", "wave"), false);
});

test("indestructible bricks never carry item drops", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["xxxxxxxxxxxx"] };
  const state = engine.createCanonicalState({ seed: 93, targetWave: 1, waves: definitions });
  assert.ok(state.bricks.length > 0);
  assert.ok(state.bricks.every((brick) => brick.trait === "indestructible" && brick.drop === null));
});

test("core-loss respawn starts at base speed and recovers over five seconds", () => {
  const state = engine.createCanonicalState({ seed: 94, targetWave: 1 });
  state.waveElapsed = 30;
  state.balls[0].y = engine.GAME_HEIGHT + state.balls[0].radius + 2;
  state.balls[0].vy = 320;
  engine.stepCanonicalEngine(state, { move: 0, aimX: engine.GAME_WIDTH / 2, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  const respawned = state.balls[0];
  assert.equal(state.coreHp, state.maxCoreHp - 1);
  assert.equal(respawned.respawnRecoveryDuration, engine.RESPAWN_SPEED_RECOVERY_SECONDS);
  assert.ok(respawned.respawnRecoveryTime > 4.9);
  assert.ok(Math.abs(Math.hypot(respawned.vx, respawned.vy) - Math.hypot(engine.BASE_BALL_VX, engine.BASE_BALL_VY)) < 0.01);
});
