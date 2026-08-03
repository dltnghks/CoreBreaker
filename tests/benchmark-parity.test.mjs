import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const vite = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)), configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "silent" });
after(async () => { await vite.close(); });
const load = (id) => vite.environments.ssr.runner.import(id);
const engine = await load("/app/canonical-engine.ts");
const policy = await load("/app/bot-policy.ts");
const benchmark = await load("/app/benchmark-headless.ts");
const waves = await load("/app/wave-config.ts");
const skills = await load("/app/skill-config.ts");

test("canonical interactive runs own skill, wave, reward, and resume phases", () => {
  const state = engine.createCanonicalState({ seed: 20260730, targetWave: 2, interactive: true });
  let result = engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 120 }, engine.FIXED_STEP_SECONDS);
  assert.equal(result.outcome.type, "start-skill");
  assert.equal(state.elapsed, 0, "paused phases must not advance simulation time");

  const opening = result.outcome.choices[0];
  result = engine.dispatchCanonicalCommand(state, { type: "choose-start-skill", skillId: opening.upgrade.id, ballCost: opening.ballCost });
  assert.equal(result.outcome.type, "running");

  state.bricks.forEach((brick) => { if (brick.trait !== "indestructible") brick.alive = false; });
  result = engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 120 }, engine.FIXED_STEP_SECONDS);
  assert.deepEqual(result.outcome, { type: "wave-clear", wave: 1, boss: false });
  assert.ok(result.events.some((event) => event.type === "wave-cleared"));
  assert.ok(result.events.every((event) => Number.isInteger(event.tick) && Number.isInteger(event.sequence)));

  result = engine.dispatchCanonicalCommand(state, { type: "acknowledge-wave-clear" });
  assert.equal(result.outcome.type, "wave-skill");
  result = engine.dispatchCanonicalCommand(state, { type: "skip-wave-skill" });
  assert.deepEqual(result.outcome, { type: "ready-for-next-wave", wave: 2 });
  result = engine.dispatchCanonicalCommand(state, { type: "start-next-wave" });
  assert.equal(result.outcome.type, "running");
  assert.equal(state.wave, 2);
});

test("canonical state serialization restores RNG and command state exactly", () => {
  const state = engine.createCanonicalState({ seed: 8080, interactive: true });
  const restored = engine.restoreCanonicalState(engine.serializeCanonicalState(state));
  assert.deepEqual(engine.canonicalSnapshot(restored), engine.canonicalSnapshot(state));
  const left = engine.dispatchCanonicalCommand(state, { type: "reroll-skills" });
  const right = engine.dispatchCanonicalCommand(restored, { type: "reroll-skills" });
  assert.deepEqual(left.outcome, right.outcome);
  assert.deepEqual(engine.canonicalSnapshot(restored), engine.canonicalSnapshot(state));
});

test("a boss wave ends when the boss core is destroyed even if reinforcements survive", () => {
  const bossWaves = waves.WAVE_DEFINITIONS.map((definition, index) => index === 0
    ? { ...definition, name: "BOSS CONTRACT", boss: "early", pattern: [] }
    : { ...definition, pattern: [...definition.pattern] });
  const state = engine.createCanonicalState({ seed: 20260802, targetWave: 2, waves: bossWaves, interactive: true, startingSkills: ["common-damage"] });
  assert.equal(state.waves[0].boss, "early");
  const core = state.bricks.find((brick) => brick.kind === "boss-core");
  assert.ok(core);
  state.bricks.push({ ...core, id: state.nextBrickId++, kind: "boss-minion", trait: "guard", guardReady: true, alive: true, hp: 2, maxHp: 2, y: 230, h: 24 });
  core.alive = false;
  state.bossAttackTimer = 999;

  const result = engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 120 }, engine.FIXED_STEP_SECONDS);
  assert.deepEqual(result.outcome, { type: "wave-clear", wave: 1, boss: true });
  assert.ok(state.bricks.some((brick) => brick.alive && brick.kind === "boss-minion"), "reinforcements are not part of the boss-clear gate");
});

test("canonical overdrive accelerates balls and resets for every wave", () => {
  const state = engine.createCanonicalState({ seed: 20260731, targetWave: 2 });
  const initialSpeed = Math.hypot(state.balls[0].vx, state.balls[0].vy);

  // Isolate the temporal rule from wall, paddle, and brick reflections.
  state.balls[0].x = 450;
  state.balls[0].y = 500;
  state.balls[0].vx = 0;
  state.balls[0].vy = -initialSpeed;
  for (let i = 0; i < 121; i += 1) {
    engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 120 }, engine.FIXED_STEP_SECONDS);
  }

  assert.equal(state.overdriveLevel, 1);
  assert.ok(Math.abs(Math.hypot(state.balls[0].vx, state.balls[0].vy) - initialSpeed * 1.01) < 1e-6);

  state.phase = "ready-for-next-wave";
  state.pendingWave = 2;
  engine.dispatchCanonicalCommand(state, { type: "start-next-wave" });
  assert.equal(state.waveElapsed, 0);
  assert.equal(state.rowTimer, 0);
  assert.equal(state.overdriveLevel, 0);
  assert.ok(Math.abs(Math.hypot(state.balls[0].vx, state.balls[0].vy) - initialSpeed) < 1e-6);
});

test("explosive bricks preserve legacy blast damage, launch boost, and restoration", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["e..........."] };
  const state = engine.createCanonicalState({ seed: 20260804, targetWave: 2, waves: definitions });
  const explosive = state.bricks[0];
  const nearby = { ...explosive, id: state.nextBrickId++, trait: "standard", x: explosive.x + 80, hp: 3, maxHp: 3, alive: true };
  state.bricks.push(nearby);
  const ball = state.balls[0];
  const baseSpeed = Math.hypot(ball.vx, ball.vy);
  ball.x = explosive.x + explosive.w / 2;
  ball.y = explosive.y + explosive.h + ball.radius - 0.5;
  ball.vx = 0;
  ball.vy = -baseSpeed;
  state.paddleX = ball.x;

  const result = engine.stepCanonicalEngine(state, { move: 0, aimX: ball.x, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  const boostedSpeed = Math.hypot(ball.vx, ball.vy);
  assert.ok(result.events.some((event) => event.type === "brick-exploded" && event.radius === 112));
  assert.equal(nearby.hp, 2, "legacy explosion deals exactly one physical damage inside radius 112");
  assert.ok(boostedSpeed > baseSpeed, "explosion must launch rather than slow the source ball");
  assert.ok(ball.vy > 0, "a ball below the block must launch away from the explosion");
  assert.equal(ball.explosionBoostTime, 1.25);

  for (let tick = 0; tick < 151; tick += 1) {
    engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  }
  assert.equal(ball.explosionBoostTime, 0);
  assert.equal(ball.explosionBaseSpeed, null);
  assert.equal(ball.explosionBoostRatio, 1);
  assert.ok(Math.hypot(ball.vx, ball.vy) < boostedSpeed, "temporary explosion boost must restore the earned base speed");
});

test("only losing the main ball damages core while temporary balls remain disposable", () => {
  const state = engine.createCanonicalState({ seed: 20260732, targetWave: 1 });
  const main = state.balls[0];
  main.x = 450; main.y = 500; main.vx = 0; main.vy = -320;
  const temporary = { ...main, payloads: {}, cooldowns: {}, skillCharges: {}, temporary: true, waveBonus: true, temporaryTime: 4, canTriggerSkills: false };
  temporary.y = engine.GAME_HEIGHT + temporary.radius + 1;
  temporary.vy = 320;
  state.balls.push(temporary);

  const before = state.coreHp;
  let result = engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 120 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.coreHp, before, "temporary ball loss must not damage core");
  assert.ok(!result.events.some((event) => event.type === "core-damaged"));

  const survivingTemporary = { ...temporary, y: 420, vy: -320, temporaryTime: 4 };
  state.balls.push(survivingTemporary);
  main.y = engine.GAME_HEIGHT + main.radius + 1;
  main.vy = 320;
  result = engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 120 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.coreHp, before - 1, "main ball loss must damage core even while a temporary ball survives");
  assert.ok(result.events.some((event) => event.type === "core-damaged"));
  assert.equal(state.balls.filter((ball) => !ball.temporary && !ball.waveBonus).length, 1, "the main ball must respawn immediately");
  assert.ok(state.balls.includes(survivingTemporary), "surviving temporary balls must not be discarded by main-ball respawn");
});

test("last-ball loss emits core damage and reaches the game-over outcome", () => {
  const state = engine.createCanonicalState({ seed: 20260801, targetWave: 1 });
  state.coreHp = 1;
  state.balls[0].y = engine.GAME_HEIGHT + state.balls[0].radius + 1;
  state.balls[0].vy = 320;
  const result = engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 120 }, engine.FIXED_STEP_SECONDS);
  assert.deepEqual(result.outcome, { type: "game-over", reason: "core" });
  assert.equal(state.phase, "game-over");
  assert.equal(state.coreHp, 0);
  assert.ok(result.events.some((event) => event.type === "core-damaged" && event.remaining === 0));
  assert.ok(result.events.some((event) => event.type === "game-over" && event.reason === "core"));
});

test("the timed auto barrier reflects every ball without consuming charges", () => {
  const state = engine.createCanonicalState({ seed: 20260803, targetWave: 1 });
  const main = state.balls[0];
  main.x = 300; main.y = engine.GAME_HEIGHT + main.radius + 1; main.vx = 0; main.vy = 320;
  const bonus = { ...main, x: 600, payloads: {}, cooldowns: {}, skillCharges: {}, temporary: true, waveBonus: true, canTriggerSkills: true };
  state.balls.push(bonus);
  state.itemBarrierTime = 10;
  const coreBefore = state.coreHp;

  const result = engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 120 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.coreHp, coreBefore);
  assert.equal(state.balls.length, 2);
  assert.ok(state.balls.every((ball) => ball.vy < 0));
  assert.equal(result.events.filter((event) => event.type === "barrier-reflected").length, 2);
  assert.equal(state.barrierCharges, 0);
  assert.ok(state.itemBarrierTime > 9.9);
});

test("a multiball item creates a skill-owning bonus ball", () => {
  const state = engine.createCanonicalState({ seed: 20260804, targetWave: 1 });
  engine.grantCanonicalSkill(state, "mage-fireball", "start");
  state.items.push({ x: state.paddleX, y: engine.PLAYER_PADDLE_Y, vy: 0, kind: "multiball", alive: true });

  engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 120 }, engine.FIXED_STEP_SECONDS);
  const multiball = state.balls.find((ball) => ball.waveBonus);
  assert.ok(multiball);
  assert.equal(multiball.canTriggerSkills, true);
  assert.equal(multiball.temporaryTime, 0);
});

test("normal play and benchmark routes use the canonical simulation path", async () => {
  const source = await readFile(new URL("../app/GameRuntime.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /canonicalStep,/);
  assert.doesNotMatch(source, /simulationMode|legacyStep/);
  assert.match(source, /interactive: true/);
  assert.match(source, /export type GameRuntimeProps = \{ benchmarkMode\?: boolean \}/);
  assert.doesNotMatch(source, /canonicalEngineEnabled/);
  assert.match(page, /return <GameRuntime \/>/);
  assert.match(source, /canonicalStateRef\.current = null/);
  assert.match(source, /projectCanonicalStateIntoGameView\(game, state\)/);
});

test("Home is a route-only wrapper around GameRuntime", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /return <GameRuntime \/>/);
  assert.doesNotMatch(page, /useGameLoop|updateGame|new Worker|canvas/);
});

test("canonical semantic events materialize only in the presentation adapter", async () => {
  const engineSource = await readFile(new URL("../app/canonical-engine.ts", import.meta.url), "utf8");
  const presentationSource = await readFile(new URL("../app/useGamePresentation.ts", import.meta.url), "utf8");
  assert.doesNotMatch(engineSource, /state\.(effects|flashes|particles)/);
  assert.match(engineSource, /type: "combat-impact"/);
  assert.match(engineSource, /type: "skill-activated"/);
  assert.match(presentationSource, /event\.type === "combat-impact"/);
  assert.match(presentationSource, /pushParticle/);
});

test("the game loop runs the canonical path for the visible runtime", async () => {
  const loop = await readFile(new URL("../app/useGameLoop.ts", import.meta.url), "utf8");
  assert.match(loop, /canonicalStepRef\.current\(fixedDt\)/);
  const page = await readFile(new URL("../app/GameRuntime.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(loop, /legacyStep|simulationMode/);
  assert.doesNotMatch(page, /canonicalEngineEnabled/);
  assert.doesNotMatch(page, /legacyStep:|const updateGame/);
  assert.doesNotMatch(page, /canonicalOnlyRef/);
});

test("canonical snapshots retain combat and payload fields at the bridge boundary", () => {
  const state = engine.createCanonicalState({ seed: 712, targetWave: 1 });
  const ball = state.balls[0];
  ball.attackPower = 7;
  ball.pierce = 3;
  ball.maxPierce = 4;
  ball.payload = "blast";
  ball.payloadLevel = 2;
  ball.payloads = { blast: 2, glass: 1 };
  ball.skillCharges = { "warrior-guard": 2 };
  ball.cooldowns = { "warrior-guard": 1.25 };
  const snapshot = engine.canonicalSnapshot(state);
  assert.deepEqual(snapshot.balls[0], {
    x: snapshot.balls[0].x,
    y: snapshot.balls[0].y,
    vx: snapshot.balls[0].vx,
    vy: snapshot.balls[0].vy,
    attackPower: 7,
    pierce: 3,
    maxPierce: 4,
    payload: "blast",
    payloadLevel: 2,
    payloads: { blast: 2, glass: 1 },
    skillCharges: { "warrior-guard": 2 },
    cooldowns: { "warrior-guard": 1.25 },
    lastHitBrickId: null,
    explosionBaseSpeed: null,
    explosionBoostRatio: 1,
    explosionBoostTime: 0,
  });
});

test("legacy echo-split enchantment summons a payload-preserving canonical ball", () => {
  const state = engine.createCanonicalState({ seed: 713, targetWave: 1, legacyEnchantments: { "echo-split": 1 } });
  assert.equal(engine.grantCanonicalSkill(state, "echo-split", "start"), true);
  const source = state.balls[0];
  source.x = state.paddleX;
  source.y = engine.PLAYER_PADDLE_Y - source.radius - 1;
  source.vx = 120;
  source.vy = 320;
  source.attackPower = 6;
  source.pierce = 2;
  source.maxPierce = 3;
  source.payload = "blast";
  source.payloadLevel = 2;
  source.payloads = { blast: 2, glass: 1 };
  const splitResult = engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.balls.length, 2);
  const split = state.balls[1];
  assert.equal(split.attackPower, source.attackPower);
  assert.equal(split.pierce, source.pierce);
  assert.equal(split.maxPierce, source.maxPierce);
  assert.equal(split.payload, source.payload);
  assert.equal(split.payloadLevel, source.payloadLevel);
  assert.deepEqual(split.payloads, source.payloads);
  assert.ok(splitResult.events.some((event) => event.type === "skill-activated" && event.skillId === "echo-split"));
});

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

test("headless timeouts preserve a replayable forensic snapshot", () => {
  const result = benchmark.runHeadlessBenchmark({
    run: 7,
    seed: 88007,
    policy: "balanced",
    benchmarkConfig: { targetWave: 20 },
    maxSimulatedSeconds: 0.1,
  });
  assert.equal(result.terminationReason, "timeout");
  assert.equal(result.evaluationComplete, false);
  assert.ok(result.timeoutDiagnostic);
  assert.equal(result.timeoutDiagnostic.stuckWave, result.wave);
  assert.ok(result.timeoutDiagnostic.remainingBrickCount > 0);
  assert.ok(result.timeoutDiagnostic.remainingBricks.length > 0);
  assert.ok(Number.isFinite(result.timeoutDiagnostic.secondsSinceLastDamage));
  assert.ok(Number.isFinite(result.timeoutDiagnostic.damageLast30Seconds));
  assert.equal(typeof result.timeoutDiagnostic.lastTargetKey, "string");
  assert.ok(result.finalSnapshot.reflectorBlockedHits >= 0);
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

test("predictive policy avoids reflector undersides with a top-bank trajectory", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["...xrrrrx..."] };
  const state = engine.createCanonicalState({ seed: 551, targetWave: 1, waves: definitions });
  const bot = policy.createBotPolicyState(551);
  const controls = policy.decideBotControls({ elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: engine.PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items }, bot, engine.FIXED_STEP_SECONDS);
  assert.match(bot.lastTargetKey, /:reflector:bank$/);
  assert.equal(controls.aimY, 80);
  assert.notEqual(controls.aimX, state.bricks[0].x + state.bricks[0].w / 2);
});

test("reflector top-bank policy clears a protected reflector layout", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["....rrrr...."] };
  const state = engine.createCanonicalState({ seed: 553, targetWave: 1, waves: definitions });
  const bot = policy.createBotPolicyState(553);
  const initialHp = state.bricks.reduce((sum, brick) => sum + brick.hp, 0);
  for (let step = 0; step < 120 * 90 && !state.complete && !state.gameOver; step++) {
    const controls = policy.decideBotControls({ elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: engine.PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items }, bot, engine.FIXED_STEP_SECONDS);
    engine.stepCanonicalEngine(state, controls, engine.FIXED_STEP_SECONDS);
  }
  const remainingHp = state.bricks.filter((brick) => brick.alive).reduce((sum, brick) => sum + brick.hp, 0);
  assert.equal(state.complete, true, `top-bank aiming should clear reflectors; ${remainingHp}/${initialHp} HP remains`);
});

test("seeded benchmark skill choices remain reproducible but vary across runs", () => {
  const starts = Array.from({ length: 16 }, (_, index) => benchmark.runHeadlessBenchmark({
    run: index + 1,
    seed: 4100 + index,
    policy: "balanced",
    benchmarkConfig: { targetWave: 1 },
    maxSimulatedSeconds: 0.1,
  }).startingSkills[0]);
  assert.ok(new Set(starts).size >= 5, `expected varied starting builds, received ${new Set(starts).size}`);
  const repeated = benchmark.runHeadlessBenchmark({ run: 1, seed: 4100, policy: "balanced", benchmarkConfig: { targetWave: 1 }, maxSimulatedSeconds: 0.1 });
  assert.equal(repeated.startingSkills[0], starts[0]);
});

test("focused benchmark policy levels an owned skill through evolution before widening the build", () => {
  const focusedSkills = ["warrior-smash", "archer-pierce", "mage-fireball"].map((id) => skills.DEFAULT_SKILLS.find((skill) => skill.id === id));
  assert.ok(focusedSkills.every(Boolean));
  const state = engine.createCanonicalState({ seed: 4101, targetWave: 1, skills: focusedSkills, startingSkills: ["warrior-smash"] });
  for (let pick = 0; pick < 3; pick += 1) {
    const choice = benchmark.chooseBenchmarkSkill(state, "balanced");
    assert.equal(choice.id, "warrior-smash");
    assert.equal(engine.grantCanonicalSkill(state, choice.id, "wave"), true);
  }
  assert.equal(state.upgrades.filter((id) => id === "warrior-smash").length, 4);
  assert.equal(benchmark.chooseBenchmarkSkill(state, "balanced").id === "warrior-smash", false, "a completed evolution must leave the offer pool");
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

test("predictive policy prefers an exposed brick over a higher-priority brick hidden by indestructible cover", () => {
  const bot = policy.createBotPolicyState(554);
  const controls = policy.decideBotControls({
    elapsed: 0,
    paddleX: 450,
    paddleWidth: 128,
    paddleSpeed: engine.PADDLE_SPEED,
    balls: [],
    items: [],
    bricks: [
      { id: 1, x: 420, y: 200, w: 60, h: 24, hp: 3, alive: true, trait: "healer" },
      { id: 2, x: 420, y: 350, w: 60, h: 24, hp: 1, alive: true, trait: "indestructible" },
      { id: 3, x: 100, y: 100, w: 60, h: 24, hp: 1, alive: true, trait: "standard" },
    ],
  }, bot, engine.FIXED_STEP_SECONDS);
  assert.match(bot.lastTargetKey, /^3:standard$/);
  assert.equal(controls.aimX, 130);
});

test("predictive bank aim routes around indestructible cover when every target is protected", () => {
  const bot = policy.createBotPolicyState(555);
  const blocker = { id: 2, x: 420, y: 350, w: 60, h: 24, hp: 1, alive: true, trait: "indestructible" };
  const controls = policy.decideBotControls({
    elapsed: 0,
    paddleX: 450,
    paddleWidth: 128,
    paddleSpeed: engine.PADDLE_SPEED,
    balls: [],
    items: [],
    bricks: [
      { id: 1, x: 420, y: 200, w: 60, h: 24, hp: 3, alive: true, trait: "healer" },
      blocker,
    ],
  }, bot, engine.FIXED_STEP_SECONDS);
  const obstacleCrossingY = blocker.y + blocker.h + 8;
  const travelRatio = (engine.PLAYER_PADDLE_Y - obstacleCrossingY) / (engine.PLAYER_PADDLE_Y - controls.aimY);
  const crossingX = engine.reflectWallX(450 + (controls.aimX - 450) * travelRatio, 8);
  assert.match(bot.lastTargetKey, /^1:healer:bank$/);
  assert.equal(controls.aimY, 80);
  assert.ok(crossingX < blocker.x - 12 || crossingX > blocker.x + blocker.w + 12, `bank path crosses indestructible cover at x=${crossingX}`);
});

test("predictive policy clears a brick directly above indestructible cover without a trajectory loop", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: [".....n......", ".....x......"] };
  const state = engine.createCanonicalState({ seed: 556, targetWave: 1, waves: definitions });
  const bot = policy.createBotPolicyState(556);
  for (let step = 0; step < 120 * 90 && !state.complete && !state.gameOver; step++) {
    const controls = policy.decideBotControls({ elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: engine.PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items }, bot, engine.FIXED_STEP_SECONDS);
    engine.stepCanonicalEngine(state, controls, engine.FIXED_STEP_SECONDS);
  }
  assert.equal(state.complete, true, `protected target should clear; last target=${bot.lastTargetKey}, bank phase=${bot.bankPhase}`);
});

test("predictive policy prefers an exposed brick over a higher-priority brick hidden by a reflector underside", () => {
  const bot = policy.createBotPolicyState(557);
  const controls = policy.decideBotControls({
    elapsed: 0,
    paddleX: 450,
    paddleWidth: 128,
    paddleSpeed: engine.PADDLE_SPEED,
    balls: [],
    items: [],
    bricks: [
      { id: 1, x: 420, y: 200, w: 60, h: 24, hp: 3, alive: true, trait: "healer" },
      { id: 2, x: 420, y: 350, w: 60, h: 24, hp: 1, alive: true, trait: "reflector" },
      { id: 3, x: 100, y: 100, w: 60, h: 24, hp: 1, alive: true, trait: "standard" },
    ],
  }, bot, engine.FIXED_STEP_SECONDS);
  assert.match(bot.lastTargetKey, /^3:standard$/);
  assert.equal(controls.aimX, 130);
});

test("predictive policy clears a brick directly above reflector cover without a trajectory loop", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: [".....n......", ".....r......"] };
  const state = engine.createCanonicalState({ seed: 558, targetWave: 1, waves: definitions });
  const bot = policy.createBotPolicyState(558);
  for (let step = 0; step < 120 * 90 && !state.complete && !state.gameOver; step++) {
    const controls = policy.decideBotControls({ elapsed: state.elapsed, paddleX: state.paddleX, paddleWidth: state.paddleWidth, paddleSpeed: engine.PADDLE_SPEED, balls: state.balls, bricks: state.bricks, items: state.items }, bot, engine.FIXED_STEP_SECONDS);
    engine.stepCanonicalEngine(state, controls, engine.FIXED_STEP_SECONDS);
  }
  assert.equal(state.complete, true, `reflector-protected target should clear; last target=${bot.lastTargetKey}, bank phase=${bot.bankPhase}`);
});

test("HEADLESS clears targets protected by indestructible and reflector cover", () => {
  for (const [name, cover, seed] of [["indestructible", "x", 560], ["reflector", "r", 561]]) {
    const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
    definitions[0] = { ...definitions[0], pattern: [".....n......", `.....${cover}......`] };
    const result = benchmark.runHeadlessBenchmark({
      run: 1,
      seed,
      policy: "balanced",
      benchmarkConfig: { targetWave: 1 },
      waveDefinitions: definitions,
      maxSimulatedSeconds: 90,
    });
    assert.equal(result.evaluationComplete, true, `${name} cover must not trap HEADLESS; ${result.timeoutDiagnostic?.lastTargetKey ?? result.terminationReason}`);
    assert.equal(result.terminationReason, "complete");
    assert.equal(result.policyVersion, policy.POLICY_VERSION);
  }
});

test("predictive policy attacks a reflector from the side when indestructible cover seals its top", () => {
  const bot = policy.createBotPolicyState(562);
  const controls = policy.decideBotControls({
    elapsed: 0,
    paddleX: 450,
    paddleWidth: 128,
    paddleSpeed: engine.PADDLE_SPEED,
    balls: [],
    items: [],
    bricks: [
      { id: 1, x: 801.4, y: 142, w: 62.6, h: 24, hp: 6, alive: true, trait: "indestructible" },
      { id: 2, x: 801.4, y: 176, w: 62.6, h: 24, hp: 4, alive: true, trait: "reflector" },
    ],
  }, bot, engine.FIXED_STEP_SECONDS);
  assert.equal(bot.lastTargetKey, "2:reflector:side");
  assert.ok(controls.aimX < 801.4, "the accessible left face should be targeted");
  assert.equal(controls.aimY, 80, "the side entry should be reached after a ceiling bank");
});

test("HEADLESS clears reflectors sealed beneath indestructible side columns", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["x..........x", "x..........x", "x..........x", "r..........r"] };
  const result = benchmark.runHeadlessBenchmark({
    run: 1,
    seed: 563,
    policy: "balanced",
    benchmarkConfig: { targetWave: 1 },
    waveDefinitions: definitions,
    maxSimulatedSeconds: 90,
  });
  assert.equal(result.evaluationComplete, true, `sealed reflectors must clear through side entry; ${result.timeoutDiagnostic?.lastTargetKey ?? result.terminationReason}`);
  assert.equal(result.terminationReason, "complete");
});

test("predictive policy enters deterministic angle sweep only after sustained zero HP progress", () => {
  const bot = policy.createBotPolicyState(564);
  const observation = {
    elapsed: 0,
    paddleX: 450,
    paddleWidth: 128,
    paddleSpeed: engine.PADDLE_SPEED,
    balls: [],
    items: [],
    bricks: [{ id: 1, x: 420, y: 200, w: 60, h: 24, hp: 10, alive: true, trait: "standard" }],
  };
  policy.decideBotControls(observation, bot, 3.6);
  policy.decideBotControls(observation, bot, 3.6);
  let controls = policy.decideBotControls(observation, bot, 3.6);
  assert.equal(bot.bankPhase, 2);
  assert.equal(bot.lastTargetKey, "1:standard:sweep");
  assert.equal(controls.aimY, 80);
  observation.bricks[0].hp = 9;
  controls = policy.decideBotControls(observation, bot, engine.FIXED_STEP_SECONDS);
  assert.equal(bot.bankPhase, 0, "real HP damage must leave exploration mode immediately");
  assert.equal(bot.lastTargetKey, "1:standard");
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
  const result = engine.stepCanonicalEngine(state, { move: 0, aimX: engine.GAME_WIDTH / 2, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(guard.guardReady, false);
  assert.equal(guard.trait, "standard");
  assert.equal(guard.hp, hpBefore);
  assert.ok(result.events.some((event) => event.type === "combat-impact" && event.text === "GUARD BREAK"));
});

test("base iron wall maintains one wave-scoped CORE guard and boss rewards shorten its interval", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: [".....s......"] };
  const state = engine.createCanonicalState({ seed: 9201, targetWave: 2, waves: definitions, startingSkills: ["warrior-guard"] });
  const brick = state.bricks[0];
  brick.hp = 20;
  brick.maxHp = 20;
  const collide = () => {
    const ball = state.balls[0];
    ball.x = brick.x + brick.w / 2;
    ball.y = brick.y + brick.h + ball.radius - 1;
    ball.vx = 0;
    ball.vy = -320;
    return engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  };

  for (let activation = 0; activation < 5; activation += 1) {
    state.balls[0].cooldowns["warrior-guard"] = 0;
    collide();
  }
  assert.equal(state.barrierCharges, 1, "non-evolved activations must maintain one guard without stacking");
  assert.equal(state.barrierTime, 0, "stored CORE guards must not use a lifetime");

  assert.equal(engine.grantCanonicalEnhancement(state, "warrior-guard"), true);
  state.balls[0].cooldowns["warrior-guard"] = 0;
  collide();
  assert.equal(state.balls[0].cooldowns["warrior-guard"], 5, "the first boss reward must improve level-one interval from six to five seconds");

  state.bricks.forEach((entry) => { if (entry.trait !== "indestructible") entry.alive = false; });
  engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.wave, 2);
  assert.equal(state.barrierCharges, 0, "iron wall guards must reset when the next wave begins");
});

test("evolved iron wall stacks up to four guards while only a main-ball loss consumes one", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: [".....s......"] };
  const state = engine.createCanonicalState({ seed: 9202, targetWave: 1, waves: definitions, startingSkills: ["warrior-guard", "warrior-guard", "warrior-guard", "warrior-guard"] });
  const brick = state.bricks[0];
  brick.hp = 20;
  brick.maxHp = 20;
  const main = state.balls[0];
  main.x = brick.x + brick.w / 2;
  main.y = brick.y + brick.h + main.radius - 1;
  main.vx = 0;
  main.vy = -320;
  engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.barrierCharges, 2);

  main.cooldowns["warrior-guard"] = 0;
  main.x = brick.x + brick.w / 2;
  main.y = brick.y + brick.h + main.radius - 1;
  main.vx = 0;
  main.vy = -320;
  engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.barrierCharges, 4, "evolution must unlock accumulation up to four guards");

  const bonus = { ...main, x: 650, y: engine.GAME_HEIGHT + main.radius + 1, vx: 0, vy: 320, temporary: true, waveBonus: true, cooldowns: {}, skillCharges: {}, payloads: {} };
  state.balls.push(bonus);
  const coreBefore = state.coreHp;
  let result = engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.barrierCharges, 4, "a disposable bonus ball must not consume CORE protection");
  assert.equal(state.coreHp, coreBefore);
  assert.ok(result.events.some((event) => event.type === "ball-out"));

  main.y = engine.GAME_HEIGHT + main.radius + 1;
  main.vy = 320;
  result = engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.barrierCharges, 3);
  assert.equal(state.coreHp, coreBefore);
  assert.ok(result.events.some((event) => event.type === "barrier-reflected" && event.chargesRemaining === 3));
});

test("direct-damage skills modify one direct hit and honor boss enhancement values", () => {
  const createHitState = (skillId, trait = "s") => {
    const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
    definitions[0] = { ...definitions[0], pattern: [`.....${trait}......`] };
    const state = engine.createCanonicalState({ seed: 9100, targetWave: 1, waves: definitions, startingSkills: [skillId] });
    const brick = state.bricks[0];
    brick.hp = 20;
    brick.maxHp = 20;
    return state;
  };
  const collide = (state) => {
    const brick = state.bricks[0];
    const ball = state.balls[0];
    ball.x = brick.x + brick.w / 2;
    ball.y = brick.y + brick.h + ball.radius - 1;
    ball.vx = 0;
    ball.vy = -320;
    return engine.stepCanonicalEngine(state, { move: 0, aimX: engine.GAME_WIDTH / 2, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  };

  const smash = createHitState("warrior-smash");
  assert.equal(engine.grantCanonicalEnhancement(smash, "warrior-smash"), true);
  const smashResult = collide(smash);
  assert.equal(smash.bricks[0].hp, 17, "boss-enhanced smash must add 2 to the base direct damage");
  assert.deepEqual(smashResult.events.filter((event) => event.type === "brick-damaged").map((event) => [event.damageType, event.damage, event.source ?? null]), [
    ["physical", 1, null],
    ["magic", 2, "warrior-smash"],
  ]);
  assert.equal(smash.physicalDamage, 1);
  assert.equal(smash.magicDamage, 2);
  assert.equal(smash.skillMetrics["warrior-smash"].damage, 2);

  const weakpoint = createHitState("archer-weakpoint");
  collide(weakpoint);
  assert.equal(weakpoint.bricks[0].hp, 18, "weakpoint must multiply the direct hit instead of adding a second hit");

  const execute = createHitState("warrior-execute");
  execute.bricks[0].hp = 2;
  execute.bricks[0].maxHp = 10;
  collide(execute);
  assert.equal(execute.bricks[0].alive, false, "execute must finish a normal brick below its HP threshold");

  const focus = createHitState("archer-focus");
  collide(focus);
  focus.balls[0].cooldowns["archer-focus"] = 0;
  collide(focus);
  assert.equal(focus.bricks[0].hp, 16, "focus must add damage only when the same ball repeats the target");

  const crush = createHitState("warrior-crush", "g");
  collide(crush);
  assert.equal(crush.bricks[0].guardReady, false);
  assert.equal(crush.bricks[0].hp, 17, "crush must break guard and apply its special-brick bonus in the same hit");
});

test("run combat stats separate physical ball damage from skill magic scaling", () => {
  const state = engine.createCanonicalState({ seed: 91001, targetWave: 1, startingSkills: ["mage-lightning", "common-damage"] });
  assert.equal(state.combatStats.physicalPower, 2);
  assert.equal(state.balls[0].attackPower, 2);
  assert.equal(engine.canonicalSkillMagicDamage(state, "mage-lightning"), 1);

  for (let pick = 0; pick < 4; pick++) assert.equal(engine.grantCanonicalSkill(state, "common-magic", "wave"), true);
  assert.equal(state.combatStats.magicPower, 2);
  assert.equal(engine.canonicalSkillMagicDamage(state, "mage-lightning"), 2);
  assert.equal(engine.grantCanonicalEnhancement(state, "mage-lightning"), true);
  assert.equal(engine.canonicalSkillMagicDamage(state, "mage-lightning"), 4);
});

test("indirect skill damage breaks a guard before damaging its HP", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: [".....sg....."] };
  const state = engine.createCanonicalState({ seed: 9401, targetWave: 1, waves: definitions, startingSkills: ["warrior-shockwave"] });
  const [origin, guard] = state.bricks;
  origin.hp = origin.maxHp = 20;
  guard.hp = guard.maxHp = 5;
  const ball = state.balls[0];
  ball.x = origin.x + origin.w / 2; ball.y = origin.y + origin.h + ball.radius - 1; ball.vx = 0; ball.vy = -320;
  engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(guard.guardReady, false);
  assert.equal(guard.trait, "standard");
  assert.equal(guard.hp, 5, "the first indirect hit must be absorbed by guard");
});

test("evolved warrior skills apply smash splash, shockwave chaining, and crush trait damage", () => {
  const collide = (state, brick) => {
    const ball = state.balls[0];
    ball.x = brick.x + brick.w / 2; ball.y = brick.y + brick.h + ball.radius - 1; ball.vx = 0; ball.vy = -320;
    return engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  };

  const smashWaves = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  smashWaves[0] = { ...smashWaves[0], pattern: ["....sss....."] };
  const smash = engine.createCanonicalState({ seed: 9402, targetWave: 1, waves: smashWaves, startingSkills: Array(4).fill("warrior-smash") });
  smash.bricks.forEach((brick) => { brick.hp = brick.maxHp = 10; });
  collide(smash, smash.bricks[1]);
  assert.deepEqual(smash.bricks.map((brick) => brick.hp), [9, 6, 9]);

  const shockWaves = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  shockWaves[0] = { ...shockWaves[0], pattern: ["sss........."] };
  const shock = engine.createCanonicalState({ seed: 9403, targetWave: 1, waves: shockWaves, startingSkills: Array(4).fill("warrior-shockwave") });
  shock.bricks.forEach((brick) => { brick.hp = brick.maxHp = 1; });
  collide(shock, shock.bricks[0]);
  assert.ok(shock.bricks.every((brick) => !brick.alive), "a destruction must relay shockwave damage to the third brick");

  const crushWaves = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  crushWaves[0] = { ...crushWaves[0], pattern: ["e....e......"] };
  const crush = engine.createCanonicalState({ seed: 9404, targetWave: 1, waves: crushWaves, startingSkills: Array(4).fill("warrior-crush") });
  crush.bricks[0].hp = crush.bricks[0].maxHp = 5;
  crush.bricks[1].hp = crush.bricks[1].maxHp = 5;
  collide(crush, crush.bricks[0]);
  assert.equal(crush.bricks[0].alive, false);
  assert.equal(crush.bricks[1].hp, 4);
});

test("evolved pierce, freeze, and mana seal modify subsequent direct hits", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["sss.c......."] };
  const state = engine.createCanonicalState({
    seed: 9405, targetWave: 1, waves: definitions,
    startingSkills: [...Array(4).fill("archer-pierce"), ...Array(4).fill("mage-freeze"), ...Array(4).fill("mage-mana-blast")],
  });
  state.bricks.forEach((brick) => { brick.hp = brick.maxHp = 30; });
  const collide = (brick) => {
    const ball = state.balls[0];
    ball.x = brick.x + brick.w / 2; ball.y = brick.y + brick.h + ball.radius - 1; ball.vx = 0; ball.vy = -320;
    return engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  };

  collide(state.bricks[0]);
  const marked = state.bricks[0].frostVulnerability;
  state.balls[0].vx = 0; state.balls[0].vy = 0; state.balls[0].x = 450; state.balls[0].y = 400;
  for (let tick = 0; tick < 240; tick += 1) engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.bricks[0].frostVulnerability, marked, "freeze marks must persist until a direct hit consumes them");
  const beforeSecond = state.bricks[0].hp;
  collide(state.bricks[0]);
  assert.ok(beforeSecond - state.bricks[0].hp >= 5, "the second hit must include freeze and accumulated pierce damage");
  assert.equal(state.bricks[1].frostVulnerability, 1, "evolved freeze must transfer a mark");

  const healer = state.bricks[3];
  collide(healer);
  assert.ok(healer.traitLockTime > 7.9);
  state.balls[0].cooldowns["mage-freeze"] = 999;
  const beforeSealed = healer.hp;
  collide(healer);
  assert.ok(beforeSealed - healer.hp >= 2, "an evolved mana seal must add one to the next direct hit");
});

test("ricochet and lightning share one chain path while evolved chains continue after kills", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["sss........."] };
  const state = engine.createCanonicalState({ seed: 9406, targetWave: 1, waves: definitions, startingSkills: [...Array(4).fill("archer-ricochet"), ...Array(4).fill("mage-lightning")] });
  state.bricks.forEach((brick) => { brick.hp = brick.maxHp = 1; });
  const ball = state.balls[0]; const origin = state.bricks[0];
  ball.x = origin.x + origin.w / 2; ball.y = origin.y + origin.h + ball.radius - 1; ball.vx = 0; ball.vy = -320;
  engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.skillMetrics["archer-ricochet"], undefined, "lightning must own the shared chain when both skills are ready");
  assert.equal(state.skillMetrics["mage-lightning"]?.activations, 1);
  assert.ok(state.bricks.every((brick) => !brick.alive));
});

test("black-hole activations create independent seeded wells", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: [".....s......"] };
  const state = engine.createCanonicalState({ seed: 9407, targetWave: 1, waves: definitions, startingSkills: ["mage-black-hole"] });
  const brick = state.bricks[0]; brick.hp = brick.maxHp = 20;
  const collide = () => {
    const ball = state.balls[0]; ball.x = brick.x + brick.w / 2; ball.y = brick.y + brick.h + ball.radius - 1; ball.vx = 0; ball.vy = -320;
    engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  };
  collide();
  state.balls[0].cooldowns["mage-black-hole"] = 0;
  collide();
  assert.equal(state.gravityWells.length, 2);
  assert.notEqual(state.gravityWells[0].y, state.gravityWells[1].y);
});

test("boss rewards immediately update stateful common passives", () => {
  const state = engine.createCanonicalState({ seed: 9101, targetWave: 1, startingSkills: ["common-wide", "common-ball-size", "common-damage", "common-xp"] });
  const before = { width: state.paddleWidth, radius: state.balls[0].radius, attack: state.balls[0].attackPower, core: state.maxCoreHp };
  for (const id of ["common-wide", "common-ball-size", "common-damage", "common-xp"]) {
    assert.equal(engine.grantCanonicalEnhancement(state, id), true);
  }
  assert.ok(state.paddleWidth > before.width);
  assert.ok(state.balls[0].radius > before.radius);
  assert.ok(state.balls[0].attackPower > before.attack);
  assert.ok(state.maxCoreHp > before.core);
  assert.equal(state.coreHp, state.maxCoreHp);
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

test("canonical parity mode accepts the legacy variable frame delta", () => {
  const state = engine.createCanonicalState({ seed: 17 });
  const before = state.elapsed;
  engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 200 }, 0.02, { clampToFixedStep: false });
  assert.equal(Number((state.elapsed - before).toFixed(6)), 0.02);
  const fixed = engine.createCanonicalState({ seed: 17 });
  engine.stepCanonicalEngine(fixed, { move: 0, aimX: 450, aimY: 200 }, 0.02);
  assert.equal(Number(fixed.elapsed.toFixed(6)), Number((1 / 120).toFixed(6)));
});

test("canonical paddle collision uses swept contact and legacy rebound semantics", () => {
  const state = engine.createCanonicalState({ seed: 19 });
  state.bricks = [];
  const ball = state.balls[0];
  state.paddleX = 450;
  ball.x = 450;
  ball.y = 515;
  ball.vx = 40;
  ball.vy = 320;
  engine.stepCanonicalEngine(state, { move: 0, aimX: 470, aimY: 300 }, 0.02, { clampToFixedStep: false });
  assert.ok(state.balls[0].vy < 0, "swept paddle contact must rebound upward");
  assert.ok(state.balls[0].y <= 600 - 70 - state.balls[0].radius, "ball must be separated above paddle");
});

test("the canonical skill catalog contains only normal and common skills", () => {
  assert.equal(skills.DEFAULT_SKILLS.length, 27);
  assert.ok(skills.DEFAULT_SKILLS.every((entry) => entry.mechanic !== "ultimate"));
  assert.equal("ULTIMATE_SKILLS" in skills, false);
});

test("rapid fire matches legacy arrow count, direction, lifetime, and evolution inheritance", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [".....s......"] }));
  const collide = (state) => {
    const brick = state.bricks[0]; const source = state.balls[0];
    source.x = brick.x + brick.w / 2; source.y = brick.y + brick.h + source.radius - 1; source.vx = 120; source.vy = -320;
    engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  };

  const normal = engine.createCanonicalState({ seed: 13001, targetWave: 1, waves: definitions });
  engine.grantCanonicalSkill(normal, "archer-rapid", "start");
  collide(normal);
  assert.equal(normal.balls.length, 2, "normal rapid fire must create one temporary arrow");
  assert.equal(normal.balls[1].canTriggerSkills, false);
  assert.equal(normal.balls[1].skillGeneration, 1);
  assert.ok(normal.balls[1].vx < 0, "the first arrow must split to the opposite side");
  assert.ok(normal.balls[1].temporaryTime > 4.7);

  const evolved = engine.createCanonicalState({ seed: 13002, targetWave: 1, waves: definitions });
  for (let pick = 0; pick < 4; pick += 1) engine.grantCanonicalSkill(evolved, "archer-rapid", pick ? "wave" : "start");
  collide(evolved);
  assert.equal(evolved.balls.length, 3, "evolved rapid fire must create the second split arrow");
  assert.ok(evolved.balls.slice(1).every((ball) => ball.canTriggerSkills && ball.skillGeneration === 1));
  assert.ok(evolved.balls[1].vx < 0 && evolved.balls[2].vx > 0);
  assert.ok(evolved.balls.slice(1).every((ball) => ball.cooldowns["archer-rapid"] > 0));
});

test("black-hole radius and evolved damage honor skill level, passive, and boss enhancement", () => {
  const blackHoleWaves = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: ["s..........s"] }));
  const base = engine.createCanonicalState({ seed: 12001, targetWave: 1, waves: blackHoleWaves });
  const boosted = engine.createCanonicalState({ seed: 12001, targetWave: 1, waves: blackHoleWaves });
  for (const target of [base, boosted]) {
    engine.grantCanonicalSkill(target, "mage-black-hole", "start");
    engine.grantCanonicalSkill(target, "mage-black-hole", "wave");
    engine.grantCanonicalSkill(target, "mage-black-hole", "wave");
    engine.grantCanonicalSkill(target, "common-damage", "start");
  }
  boosted.bossEnhancements["mage-black-hole"] = 1;
  const hit = (state) => {
    const brick = state.bricks[0]; const ball = state.balls[0];
    ball.x = brick.x + brick.w / 2; ball.y = brick.y + brick.h + ball.radius - 1; ball.vx = 0; ball.vy = -320;
    engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
    return state.gravityWells[0];
  };
  const normal = hit(base); const enhanced = hit(boosted);
  assert.ok(normal.x >= 150 && normal.x <= engine.GAME_WIDTH - 150);
  assert.ok(normal.y >= 120 && normal.y <= 240);
  assert.ok(enhanced.radius > normal.radius, "boss enhancement must increase black-hole range");
  assert.ok(enhanced.damagePerSecond >= normal.damagePerSecond, "passive/enhancement must not reduce black-hole damage");

  const ball = base.balls[0];
  ball.x = normal.x + normal.radius * 0.7; ball.y = normal.y; ball.vx = 0; ball.vy = 400;
  engine.stepCanonicalEngine(base, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(ball.gravityBaseSpeed, 400, "black-hole entry must retain the original speed");
  assert.ok(Math.abs(Math.hypot(ball.vx, ball.vy) - 400) < 1e-6, "orbit steering must preserve speed");
  assert.ok(ball.vx < 0, "the well must steer the ball inward instead of snapping to a fixed circle");
});

test("canonical skill results expose the complete effect contract", async () => {
  // This is a contract guard for the migration boundary. A runtime result must
  // be able to carry every effect produced by the legacy page loop; omitting
  // one silently drops behavior during canonical synchronization.
  const requiredFields = ["damage", "control", "barrier", "pierce", "burn", "disableHealing", "summon"];
  const source = await readFile(new URL("../app/canonical-engine.ts", import.meta.url), "utf8");
  const contract = source.match(/(?:type|interface)\s+SkillResult\s*=?[\s\S]*?(?=\n(?:export\s+)?(?:type|interface|function|const)\s|$)/)?.[0] ?? "";
  for (const field of requiredFields) {
    assert.match(contract, new RegExp(`\\b${field}\\b`), `SkillResult is missing required field: ${field}`);
  }
});

test("common passive modifiers are resolved by canonical dispatch", () => {
  const base = engine.createCanonicalState({ seed: 301, targetWave: 1 });
  const boosted = engine.createCanonicalState({ seed: 301, targetWave: 1 });
  for (const id of ["common-move-speed", "common-combo", "common-magnet", "common-luck", "common-wide"]) {
    assert.equal(engine.grantCanonicalSkill(boosted, id, "start"), true, `${id} should be grantable`);
  }
  const modifiers = engine.canonicalCommonPassiveValues(boosted);
  assert.ok(modifiers.moveSpeedMultiplier > 1);
  assert.ok(modifiers.comboScoreBonus > 0);
  assert.ok(modifiers.magnetRange > 0);
  assert.ok(modifiers.luckChance > 0);
  assert.ok(modifiers.paddleWidth > base.paddleWidth);

  const startX = base.paddleX;
  engine.stepCanonicalEngine(base, { move: 1, aimX: 420, aimY: 120 }, engine.FIXED_STEP_SECONDS);
  engine.stepCanonicalEngine(boosted, { move: 1, aimX: 420, aimY: 120 }, engine.FIXED_STEP_SECONDS);
  assert.ok(boosted.paddleX - startX > base.paddleX - startX, "move-speed must affect canonical paddle dispatch");

  boosted.items.push({ x: boosted.paddleX + 10, y: 500, vy: 0, kind: "core-repair", alive: true });
  const before = boosted.items[0].x;
  engine.stepCanonicalEngine(boosted, { move: 0, aimX: 420, aimY: 120 }, engine.FIXED_STEP_SECONDS);
  assert.ok(boosted.items[0].x < before, "magnet must pull nearby canonical items toward the paddle");
});

test("evolved common movement, magnet, wide, and combo effects alter the canonical runtime", () => {
  const startingSkills = ["common-magnet", "common-move-speed", "common-wide", "common-combo"].flatMap((id) => Array(4).fill(id));
  const state = engine.createCanonicalState({ seed: 9501, targetWave: 1, startingSkills });
  state.items.push({ x: 40, y: 120, vy: 0, kind: "core-repair", alive: true });
  const initialItem = { x: state.items[0].x, y: state.items[0].y };
  engine.stepCanonicalEngine(state, { move: 1, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  const beforeReverse = state.paddleX;
  engine.stepCanonicalEngine(state, { move: -1, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.ok(state.moveBoostTime > 0);
  assert.ok(beforeReverse - state.paddleX > engine.PADDLE_SPEED * 1.4 * engine.FIXED_STEP_SECONDS, "reversal boost must exceed unmodified paddle speed");
  assert.ok(state.items[0].x > initialItem.x && state.items[0].y > initialItem.y, "evolved magnet must pull a full-screen item on both axes");

  state.combo = 10;
  const ball = state.balls[0];
  ball.x = state.paddleX + state.paddleWidth / 2 + 22;
  ball.y = 525;
  ball.vx = 0;
  ball.vy = 320;
  const tipContact = engine.resolveCanonicalPaddleCollisionPure(state, new Map([[ball, { x: ball.x, y: 500 }]]), { move: 0, aimX: 450, aimY: 200 });
  assert.ok(tipContact, "evolved wide paddle tips must provide an extra reflection margin");
  ball.x = state.paddleX;
  ball.y = 520;
  ball.vy = 320;
  engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 200 }, 0.02, { clampToFixedStep: false });
  assert.ok(ball.vy < 0);
  assert.equal(state.combo, 5, "evolved combo must retain half on paddle reflection");
});

test("evolved common luck, ball size, damage, cooldown, and range have concrete effects", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["sss........."] };
  const startingSkills = ["common-luck", "common-ball-size", "common-damage", "common-cooldown", "common-skill-range"].flatMap((id) => Array(4).fill(id));
  startingSkills.push("warrior-smash", "mage-fireball");
  const state = engine.createCanonicalState({ seed: 9502, targetWave: 1, waves: definitions, startingSkills });
  const [origin, near, ranged] = state.bricks;
  origin.hp = origin.maxHp = 4;
  origin.drop = "multiball";
  near.hp = near.maxHp = 10;
  near.x = origin.x + 28;
  ranged.hp = ranged.maxHp = 10;
  ranged.x = origin.x + 120;
  const ball = state.balls[0];
  ball.x = origin.x + origin.w / 2; ball.y = origin.y + origin.h + ball.radius - 1; ball.vx = 0; ball.vy = -320;
  engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.items.length, 2, "evolved luck must add a utility drop beside multiball");
  assert.equal(near.hp, 8, "nearby brick must receive both the evolved physical impact and fireball magic damage");
  assert.ok(ranged.healBlockTime > 0, "evolved range must include a brick beyond the ordinary level-one fireball radius");
  assert.ok(Math.abs(ball.cooldowns["warrior-smash"] - 0.672) < 1e-6, "evolved cooldown must apply an additional reduction");

  const guardWaves = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  guardWaves[0] = { ...guardWaves[0], pattern: [".....g......"] };
  const guarded = engine.createCanonicalState({ seed: 9503, targetWave: 1, waves: guardWaves, startingSkills: Array(4).fill("common-damage") });
  guarded.bricks[0].hp = guarded.bricks[0].maxHp = 10;
  const guardBall = guarded.balls[0]; const guard = guarded.bricks[0];
  guardBall.x = guard.x + guard.w / 2; guardBall.y = guard.y + guard.h + guardBall.radius - 1; guardBall.vx = 0; guardBall.vy = -320;
  engine.stepCanonicalEngine(guarded, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(guard.guardReady, false);
  assert.equal(guard.hp, 6, "evolved base damage must remain after protection is removed");
});

test("evolved core enhancement heals once when the next wave starts", () => {
  const state = engine.createCanonicalState({ seed: 9504, targetWave: 2, startingSkills: Array(4).fill("common-xp") });
  state.coreHp = 5;
  state.bricks.forEach((brick) => { if (brick.trait !== "indestructible") brick.alive = false; });
  engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.wave, 2);
  assert.equal(state.coreHp, 6);
});

test("indestructible bricks never carry item drops", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: ["xxxxxxxxxxxx"] };
  const state = engine.createCanonicalState({ seed: 93, targetWave: 1, waves: definitions });
  assert.ok(state.bricks.length > 0);
  assert.ok(state.bricks.every((brick) => brick.trait === "indestructible" && brick.drop === null));
});

test("indestructible collisions do not activate skills or consume skill state", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: [".....x......"] };
  const state = engine.createCanonicalState({
    seed: 9301,
    targetWave: 1,
    waves: definitions,
    startingSkills: ["archer-rapid", "mage-fireball", "warrior-guard"],
  });
  const brick = state.bricks[0];
  const ball = state.balls[0];
  ball.x = brick.x + brick.w / 2;
  ball.y = brick.y + brick.h + ball.radius - 1;
  ball.vx = 0;
  ball.vy = -320;
  ball.pierce = 2;

  const result = engine.stepCanonicalEngine(state, { move: 0, aimX: engine.GAME_WIDTH / 2, aimY: 80 }, engine.FIXED_STEP_SECONDS);

  assert.equal(state.balls.length, 1, "rapid fire must not summon an arrow");
  assert.equal(state.barrierCharges, 0, "guard must not create a barrier");
  assert.equal(ball.pierce, 2, "an indestructible reflection must not consume pierce");
  assert.deepEqual(ball.cooldowns, {}, "skill cooldowns must remain untouched");
  assert.deepEqual(state.skillMetrics, {}, "skill activation metrics must remain untouched");
  assert.equal(result.events.some((event) => event.type === "skill-activated"), false);
  assert.equal(brick.hp, brick.maxHp);
  assert.equal(brick.healBlockTime, 0);
  assert.equal(brick.traitLockTime, 0);
  assert.equal(brick.burnTime, 0);
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
