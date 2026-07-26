import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const vite = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)), configFile: false, appType: "custom", server: { middlewareMode: true }, logLevel: "silent" });
const load = (path) => vite.environments.ssr.runner.import(path);
const mapping = await load("/app/canonical-state-mapping.ts");
const engine = await load("/app/canonical-engine.ts");
const waves = await load("/app/wave-config.ts");
const hud = await load("/app/hud-snapshot.ts");
const snapshot = await load("/app/legacy-state-snapshot.ts");
const legacyPure = await load("/app/legacy-pure-step.ts");
after(async () => { await vite.close(); });

function legacyState() {
  return {
    balls: [], bricks: [{ x: 72, y: 74, w: 60, h: 24, hp: 9, maxHp: 9, hue: 180, alive: true, drop: null, kind: "normal", trait: "standard", guardReady: false, healTimer: 3, poisonTime: 0, poisonTick: 0, poisonSourcePaddleId: null, burnTime: 0, burnTick: 0, burnLevel: 0, burnSourcePaddleId: null, healBlockTime: 0, blastVulnerability: 0, blastVulnerabilitySourcePaddleId: null, frostVulnerability: 0, traitLockTime: 0, lastHitPaddleId: null }],
    paddleX: 450, paddleWidth: 128, ghostPaddles: [], elapsed: 0, score: 0, level: 1, combo: 0, maxCombo: 0, comboTimer: 0, bricksBroken: 0, upgrades: [], skillHistory: [], skillMetrics: {}, paddleTrack: [], particles: [], particlePool: [], particlePoolCursor: 0, flashes: [], effects: [], effectPool: [], effectPoolCursor: 0, items: [], safetyBlocks: [], gravityWells: [], paddleBarriers: {}, itemBarrierTime: 0, ultimateAuras: {}, paddleCounters: {}, coreHp: 8, maxCoreHp: 8, bossActive: false, bossPending: false, bossStage: 0, nextBossWave: 5, bossTimeRemaining: 0, bossSkillTimer: 0, bossAttackPattern: 0, bossMultiballsRemaining: 0, bossRewards: [], bossEnhancements: {}, autoGuard: false, rowTimer: 0, rowInterval: 1, overdriveLevel: 0, shakeStrength: 0, shakeTime: 0, shakeDuration: 0, screenFlashColor: "", screenFlashTime: 0, screenFlashDuration: 0, coreBreakTime: 0, coreBreakDuration: 0, coreBreakX: 0, coreBreakY: 0, wave: 1, pendingWave: null, failed: false, failureReason: null, botMetrics: { maxBalls: 1, ballLosses: 0, missileActivations: 0, safetySaves: 0, gravityRescues: 0 }, botWaveSamples: [], botSampleKey: "",
  };
}

test("canonical world sync copies bricks, items, metrics, and completion state", () => {
  const state = engine.createCanonicalState({ seed: 77, targetWave: 1, waves: waves.WAVE_DEFINITIONS });
  const game = legacyState();
  const brick = state.bricks[0];
  brick.hp = 2; brick.alive = false; brick.trait = "guard"; brick.guardReady = true;
  state.items = [{ x: 321, y: 200, vy: 48, kind: "core-repair", alive: true }];
  state.skillMetrics["warrior-guard"] = { activations: 3, damage: 12, kills: 1 };
  state.bricksBroken = 8; state.score = 900; state.combo = 4; state.barrierCharges = 2; state.barrierTime = 6; state.coreHp = 0; state.gameOver = true; state.complete = true;
  mapping.syncCanonicalWorldIntoGame(game, state);
  assert.equal(game.bricks[0].hp, 2);
  assert.equal(game.bricks[0].alive, false);
  assert.equal(game.bricks[0].trait, "guard");
  assert.deepEqual(game.items[0], { id: 1, x: 321, y: 200, vy: 48, alive: true, kind: "core-repair" });
  assert.deepEqual(game.skillMetrics["warrior-guard"], { activations: 3, damage: 12, kills: 1 });
  assert.equal(game.bricksBroken, 8);
  assert.equal(game.score, 900);
  assert.equal(game.paddleBarriers.canonical, 2);
  assert.equal(game.itemBarrierTime, 6);
  assert.equal(game.failed, true);
  assert.equal(game.failureReason, "core");
  assert.equal(game.canonicalComplete, true);
});

test("canonical score crossing the HUD boundary is always finite", () => {
  const state = engine.createCanonicalState({ seed: 78, targetWave: 1, waves: waves.WAVE_DEFINITIONS });
  const game = legacyState();
  state.score = Number.NaN;
  mapping.syncCanonicalWorldIntoGame(game, state);
  assert.equal(game.score, 0);
  const snapshot = hud.hudSnapshotFromGame(game, { waveName: "TEST", overdriveMultiplier: 1, upgradeLevel: () => 0 });
  assert.equal(snapshot.score, 0);
  assert.ok(Number.isFinite(snapshot.score));
});

test("canonical baseline snapshot is deterministic for a repeated seed and input sequence", () => {
  const make = () => engine.createCanonicalState({ seed: 2026, targetWave: 1, waves: waves.WAVE_DEFINITIONS });
  const a = make(); const b = make();
  for (let i = 0; i < 120; i += 1) {
    engine.stepCanonicalEngine(a, { move: i % 20 < 10 ? 1 : -1, aimX: 450, aimY: 250 }, 1 / 120);
    engine.stepCanonicalEngine(b, { move: i % 20 < 10 ? 1 : -1, aimX: 450, aimY: 250 }, 1 / 120);
  }
  assert.deepEqual(snapshot.legacyStateSnapshot(a), snapshot.legacyStateSnapshot(b));
});

test("legacy pure temporal+paddle phase is deterministic over 120 frames", () => {
  const a = legacyState(); const b = legacyState();
  for (let i = 0; i < 120; i += 1) {
    const input = { move: i % 20 < 10 ? 1 : -1, aimX: 450, aimY: 250 };
    legacyPure.stepLegacyPure(a, input, 1 / 120);
    legacyPure.stepLegacyPure(b, input, 1 / 120);
  }
  assert.deepEqual(snapshot.legacyStateSnapshot(a), snapshot.legacyStateSnapshot(b));
});

test("legacy pure ball movement is deterministic over 120 frames", () => {
  const a = legacyState(); const b = legacyState();
  a.balls = [{ x: 450, y: 300, vx: 240, vy: -320, radius: 8, owner: "player", payloads: {}, payload: null, payloadLevel: 0, pierce: 0, maxPierce: 0, attackPower: 1 }];
  b.balls = JSON.parse(JSON.stringify(a.balls));
  for (let i = 0; i < 120; i += 1) { legacyPure.advanceLegacyBallsPure(a, 1 / 120); legacyPure.advanceLegacyBallsPure(b, 1 / 120); }
  assert.deepEqual(a.balls.map((ball) => [ball.x, ball.y, ball.vx, ball.vy]), b.balls.map((ball) => [ball.x, ball.y, ball.vx, ball.vy]));
});

test("canonical and extracted legacy temporal+paddle phases match exactly", () => {
  const canonical = engine.createCanonicalState({ seed: 99, targetWave: 1, waves: waves.WAVE_DEFINITIONS });
  const legacy = legacyState();
  for (let i = 0; i < 120; i += 1) {
    const input = { move: i % 20 < 10 ? 1 : -1, aimX: 450, aimY: 250 };
    legacyPure.stepLegacyPure(legacy, input, 1 / 120, { paddleSpeed: 460, width: 900 });
    engine.stepCanonicalEngine(canonical, { move: input.move, aimX: input.aimX, aimY: input.aimY }, 1 / 120);
  }
  assert.equal(Number(canonical.elapsed.toFixed(6)), Number(legacy.elapsed.toFixed(6)));
  assert.equal(Number(canonical.rowTimer.toFixed(6)), Number(legacy.rowTimer.toFixed(6)));
  assert.equal(Number(canonical.paddleX.toFixed(6)), Number(legacy.paddleX.toFixed(6)));
});

test("canonical and legacy ball wall phases match exactly for 120 frames", () => {
  const canonical = engine.createCanonicalState({ seed: 101, targetWave: 1, waves: waves.WAVE_DEFINITIONS });
  const legacy = legacyState();
  const source = canonical.balls[0];
  source.x = 450; source.y = 300; source.vx = 271; source.vy = -333;
  legacy.balls = [{ x: source.x, y: source.y, vx: source.vx, vy: source.vy, radius: source.radius, owner: "player", color: "#fff", sourcePaddleId: "player", pierce: 0, maxPierce: 0, blast: 0, payload: null, payloadLevel: 0, payloads: {}, attackPower: 1, missileTime: 0, missileHitCooldown: 0, gravityRescueCooldown: 0, gravityBaseSpeed: null, explosionBaseSpeed: null, explosionBoostRatio: 1, explosionBoostTime: 0, canTriggerSkills: true, skillGeneration: 0, skillCharges: {}, skillCooldowns: {}, visualSkill: null, temporaryTime: 0, waveBonus: false, respawnRecoveryTime: 0, respawnRecoveryDuration: 0, respawnRecoveryBaseSpeed: 0 }];
  for (let i = 0; i < 120; i += 1) {
    legacyPure.advanceLegacyBallsPure(legacy, 1 / 120);
    engine.advanceCanonicalBallsPure(canonical, 1 / 120);
  }
  const actual = canonical.balls[0]; const expected = legacy.balls[0];
  for (const key of ["x", "y", "vx", "vy"]) assert.equal(Number(actual[key].toFixed(6)), Number(expected[key].toFixed(6)), key);
});
