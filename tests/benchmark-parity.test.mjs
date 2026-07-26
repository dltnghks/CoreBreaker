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
const bridge = await load("/app/canonical-bridge.ts");

test("legacy Home runs and canonical benchmark runs use explicit simulation gates", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const bridge = await readFile(new URL("../app/canonical-bridge.ts", import.meta.url), "utf8");
  assert.match(source, /canonicalEngineEnabledRef\.current\s*=\s*canonicalEngineEnabledForRun/);
  assert.match(source, /canonicalBridgeRef\.current = canonicalEngineEnabledRef\.current\s*\?/);
  assert.match(source, /simulationMode: canonicalEngineEnabled \|\| benchmarkMode \? "canonical" : "legacy"/);
  assert.match(source, /canonicalBridgeRef\.current = null/);
  const bridgeModule = await load("/app/canonical-bridge.ts");
  assert.equal(bridgeModule.canonicalEngineEnabledForRun({ explicit: false, benchmarkMode: false }), false);
  assert.equal(bridgeModule.canonicalEngineEnabledForRun({ explicit: true, benchmarkMode: false }), true);
  assert.equal(bridgeModule.canonicalEngineEnabledForRun({ explicit: false, benchmarkMode: true }), true);
  assert.match(bridge, /syncCanonicalBallsIntoGame\(game, state\)/);
});

test("the game loop selects legacy or canonical simulation explicitly", async () => {
  const loop = await readFile(new URL("../app/useGameLoop.ts", import.meta.url), "utf8");
  assert.match(loop, /canonicalStepRef\.current\(fixedDt\)/);
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(loop, /legacyStepRef\.current\?\.\(dt\)/);
  assert.match(page, /canonicalEngineEnabled\s*=\s*false/);
  assert.match(page, /return <GameRuntime \/>/);
  assert.match(page, /legacyStep: updateGame/);
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
  });
});

test("canonical bridge preserves the visible initial brick layout and launch state", () => {
  const source = engine.createCanonicalState({ seed: 9001, targetWave: 1 });
  const visibleGame = {
    paddleX: 417,
    paddleWidth: 132,
    coreHp: 7,
    maxCoreHp: 9,
    bricks: [
      { ...source.bricks[0], id: undefined, x: 13.25, y: 211, w: 61, h: 24, hp: 3, maxHp: 3, trait: "guard", guardReady: true, drop: "core-repair", kind: "normal" },
      { ...source.bricks[1], id: undefined, x: 271.5, y: 245, w: 61, h: 24, hp: 1, maxHp: 1, trait: "reflector", guardReady: false, drop: null, kind: "normal" },
    ],
    balls: [{ ...source.balls[0], x: 417, y: 528, vx: 240, vy: -320 }],
    upgrades: [],
  };
  const canonical = bridge.createCanonicalBridge({ seed: 9001, balance: source.balance, skills: source.skills, waves: source.waves, game: visibleGame });
  assert.deepEqual(canonical.bricks.map(({ id, x, y, w, h, hp, trait, drop }) => ({ id, x, y, w, h, hp, trait, drop })), [
    { id: 1, x: 13.25, y: 211, w: 61, h: 24, hp: 3, trait: "guard", drop: "core-repair" },
    { id: 2, x: 271.5, y: 245, w: 61, h: 24, hp: 1, trait: "reflector", drop: null },
  ]);
  assert.equal(canonical.paddleX, 417);
  assert.equal(canonical.paddleWidth, 132);
  assert.equal(canonical.balls[0].y, 528);
  assert.equal(canonical.balls[0].vy, -320);
});

test("canonical bridge preserves active ghost paddle layout", () => {
  const source = engine.createCanonicalState({ seed: 42 });
  const game = {
    ...source,
    ghostPaddles: [225, 675],
    balls: source.balls.map((ball) => ({ ...ball, owner: "player", color: "#fff", sourcePaddleId: "player" })),
  };
  const canonical = bridge.createCanonicalBridge({ seed: 42, balance: source.balance, skills: source.skills, waves: source.waves, game, ghostRecords: [{ upgrades: ["common-wide", "common-move-speed"] }, { upgrades: [] }] });
  assert.deepEqual(canonical.ghostPaddles, [225, 675]);
  assert.deepEqual(canonical.ghostPaddleActive, [true, true]);
  assert.ok(canonical.ghostPaddleWidths[0] > 92);
  assert.equal(canonical.ghostPaddleUpgrades[0].length, 2);
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
  engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(state.balls.length, 2);
  const split = state.balls[1];
  assert.equal(split.attackPower, source.attackPower);
  assert.equal(split.pierce, source.pierce);
  assert.equal(split.maxPierce, source.maxPierce);
  assert.equal(split.payload, source.payload);
  assert.equal(split.payloadLevel, source.payloadLevel);
  assert.deepEqual(split.payloads, source.payloads);
  assert.ok(state.visualEvents.some((event) => event.skillId === "echo-split"));
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

test("every configured ultimate is dispatched by the canonical collision path", () => {
  const ultimateIds = skills.ULTIMATE_SKILLS.map((entry) => entry.id);
  assert.equal(ultimateIds.length, 6, "the contract currently defines six ultimate skills");
  for (const skillId of ultimateIds) {
    const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
    definitions[0] = { ...definitions[0], pattern: ["............"] };
    // A one-brick arena makes the collision deterministic while retaining the
    // production skill table and canonical collision/dispatch path.
    definitions[0] = { ...definitions[0], pattern: [".....s......"] };
    const state = engine.createCanonicalState({ seed: 1000, targetWave: 1, waves: definitions });
    assert.equal(engine.grantCanonicalSkill(state, skillId, "start"), true, `${skillId} should be grantable`);
    const brick = state.bricks.find((entry) => entry.alive);
    const ball = state.balls[0];
    ball.x = brick.x + brick.w / 2;
    ball.y = brick.y + brick.h + ball.radius - 1;
    ball.vx = 0;
    ball.vy = -320;
    engine.stepCanonicalEngine(state, { move: 0, aimX: engine.GAME_WIDTH / 2, aimY: 80 }, engine.FIXED_STEP_SECONDS);
    assert.ok(state.skillMetrics[skillId]?.activations > 0, `${skillId} was granted but never dispatched on collision`);
  }
});

test("canonical ultimate dispatch produces damage or a concrete effect event", () => {
  for (const skillId of skills.ULTIMATE_SKILLS.map((entry) => entry.id)) {
    const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
    definitions[0] = { ...definitions[0], pattern: [".....s......"] };
    const state = engine.createCanonicalState({ seed: 12000, targetWave: 1, waves: definitions });
    assert.equal(engine.grantCanonicalSkill(state, skillId, "start"), true);
    const brick = state.bricks.find((entry) => entry.alive);
    const ball = state.balls[0];
    ball.x = brick.x + brick.w / 2;
    ball.y = brick.y + brick.h + ball.radius - 1;
    ball.vx = 0;
    ball.vy = -320;
    const before = state.totalDamage;
    engine.stepCanonicalEngine(state, { move: 0, aimX: engine.GAME_WIDTH / 2, aimY: 80 }, engine.FIXED_STEP_SECONDS);
    assert.ok(state.visualEvents.some((event) => event.skillId === skillId), `${skillId} must emit a visual event`);
    assert.ok(state.totalDamage > before || state.balls.length > 1 || state.barrierCharges > 0 || state.gravityWells.length > 0, `${skillId} must apply a gameplay effect`);
  }
});

test("black-hole radius and evolved damage honor skill level, passive, and boss enhancement", () => {
  const base = engine.createCanonicalState({ seed: 12001, targetWave: 1, waves: waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [".....s......"] })) });
  const boosted = engine.createCanonicalState({ seed: 12001, targetWave: 1, waves: waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [".....s......"] })) });
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
  assert.ok(enhanced.radius > normal.radius, "boss enhancement must increase black-hole range");
  assert.ok(enhanced.damagePerSecond >= normal.damagePerSecond, "passive/enhancement must not reduce black-hole damage");
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
