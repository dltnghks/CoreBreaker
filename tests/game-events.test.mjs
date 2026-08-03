import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("game event contract is frame-buffered and drained FIFO", () => {
  const source = fs.readFileSync(new URL("../app/game-events.ts", import.meta.url), "utf8");
  assert.match(source, /export function emitGameEvent/);
  assert.match(source, /export function drainGameEvents/);
  assert.match(source, /buffer\.events\.splice\(0\)/);
});

test("canonical hit and skill effects use explicit ordered stages", () => {
  const source = fs.readFileSync(new URL("../app/canonical-engine.ts", import.meta.url), "utf8");
  [
    "prepareDirectHit",
    "applyDirectHitDamage",
    "applyPostDirectHitEffects",
    "resolveBrickDestruction",
    "eligibleSkillTargets",
    "applySkillDamage",
    "applySkillStatuses",
    "applySkillGlobalEffects",
  ].forEach((stage) => assert.match(source, new RegExp(`function ${stage}`)));

  const directPipeline = source.slice(source.indexOf("function resolveDestructibleDirectHit"), source.indexOf("function circleRect"));
  assert.ok(directPipeline.indexOf("prepareDirectHit") < directPipeline.indexOf("applyDirectHitDamage"));
  assert.ok(directPipeline.indexOf("applyDirectHitDamage") < directPipeline.indexOf("applyPostDirectHitEffects"));

  const skillPipeline = source.slice(source.indexOf("function applySkillResult"), source.indexOf("function triggerCollisionSkills"));
  assert.ok(skillPipeline.indexOf("eligibleSkillTargets") < skillPipeline.indexOf("applySkillDamage"));
  assert.ok(skillPipeline.indexOf("applySkillDamage") < skillPipeline.indexOf("applySkillStatuses"));
  assert.ok(skillPipeline.indexOf("applySkillStatuses") < skillPipeline.indexOf("applySkillGlobalEffects"));
});

test("page emits and consumes skill, brick, and item events at the UI boundary", () => {
  const source = fs.readFileSync(new URL("../app/canonical-engine.ts", import.meta.url), "utf8")
    + fs.readFileSync(new URL("../app/useGamePresentation.ts", import.meta.url), "utf8");
  assert.match(source, /type: "skill-activated"/);
  assert.match(source, /type: "brick-damaged"/);
  assert.match(source, /type: "item-dropped"/);
  assert.match(source, /event\.type === "skill-activated"/);
  assert.match(source, /event\.type === "brick-damaged"/);
  assert.match(source, /event\.type === "item-dropped"/);
});

test("canonical-only runtime decays transient camera feedback", () => {
  const source = fs.readFileSync(new URL("../app/useGamePresentation.ts", import.meta.url), "utf8");
  const loop = fs.readFileSync(new URL("../app/useGameLoop.ts", import.meta.url), "utf8");
  const runtime = fs.readFileSync(new URL("../app/GameRuntime.tsx", import.meta.url), "utf8");
  assert.match(source, /game\.shakeTime = Math\.max\(0, \(game\.shakeTime \?\? 0\) - dt\)/);
  assert.match(source, /if \(game\.shakeTime <= 0\) game\.shakeStrength = 0/);
  assert.match(source, /game\.screenFlashTime = Math\.max\(0, \(game\.screenFlashTime \?\? 0\) - dt\)/);
  assert.match(source, /game\.coreBreakTime = Math\.max\(0, \(game\.coreBreakTime \?\? 0\) - dt\)/);
  assert.match(loop, /drawRef\.current\(dt\)/);
  assert.match(runtime, /const drawGame = useCallback\(\(dt: number\)/);
  assert.match(runtime, /advancePresentation\(dt\);\s*consumePresentationEvents\(\)/);
});

test("canonical presentation preserves legacy destruction, ball-out, core, and skill feedback", () => {
  const events = fs.readFileSync(new URL("../app/game-events.ts", import.meta.url), "utf8");
  const engine = fs.readFileSync(new URL("../app/canonical-engine.ts", import.meta.url), "utf8");
  const presentation = fs.readFileSync(new URL("../app/useGamePresentation.ts", import.meta.url), "utf8");

  for (const eventType of ["brick-destroyed", "ball-out", "core-damaged", "item-collected"]) {
    assert.match(events, new RegExp(`type: "${eventType}"`));
    assert.match(engine, new RegExp(`type: "${eventType}"`));
    assert.match(presentation, new RegExp(`event\\.type === "${eventType}"`));
  }
  assert.match(presentation, /kind: "skill"/);
  assert.match(presentation, /life: event\.duration/);
  assert.match(presentation, /playAudio\("brick-break", event\.combo\)/);
  assert.match(presentation, /playAudio\("core-damage"\)/);
  assert.match(presentation, /CORE BREAK \/\/ RESPAWN SPEED 100%/);
  assert.match(presentation, /text: isMagic \? `✦-\$\{roundedDamage\}` : `-\$\{roundedDamage\}`/);
  assert.match(presentation, /const damageSlots = new Map/);
  assert.match(presentation, /x: event\.x \+ \(isMagic \? 22 : -18\)/);
  assert.match(presentation, /isMagic \? -10 - slot \* 20 : 12 \+ slot \* 20/);
  assert.match(presentation, /emphasis: "damage"/);
  assert.doesNotMatch(presentation, /event\.text \?\? "충격"/);
  assert.match(presentation, /if \(event\.text\) game\.flashes\.push/);
});

test("every run resets the canonical terminal latch before game-over handling", () => {
  const runtime = fs.readFileSync(new URL("../app/GameRuntime.tsx", import.meta.url), "utf8");
  const start = runtime.indexOf("const startRun =");
  const end = runtime.indexOf("startRunRef.current = startRun", start);
  const body = runtime.slice(start, end);
  assert.match(body, /canonicalTerminalRef\.current = null/);
  assert.match(runtime, /handleCanonicalOutcome/);
  assert.match(runtime, /finishRun\(\)/);
});

test("normal runs use a fresh seed while benchmark runs retain their explicit seed", () => {
  const runtime = fs.readFileSync(new URL("../app/GameRuntime.tsx", import.meta.url), "utf8");
  assert.match(runtime, /function createRunSeed\(\)/);
  assert.match(runtime, /crypto\.getRandomValues\(values\)/);
  assert.match(runtime, /const runSeed = benchSeed \?\? createRunSeed\(\)/);
  assert.match(runtime, /seed: runSeed/);
  assert.match(runtime, /createReplayRecorder\("canonical", runSeed\)/);
  assert.doesNotMatch(runtime, /seed: benchSeed \?\? 1/);
});

test("explosive brick events materialize the legacy blast presentation", () => {
  const events = fs.readFileSync(new URL("../app/game-events.ts", import.meta.url), "utf8");
  const presentation = fs.readFileSync(new URL("../app/useGamePresentation.ts", import.meta.url), "utf8");
  assert.match(events, /type: "brick-exploded"/);
  assert.match(presentation, /event\.type === "brick-exploded"/);
  assert.match(presentation, /kind: "blast"/);
  assert.match(presentation, /playAudio\("explosion", 1\.4\)/);
  assert.match(presentation, /setImpact\(game, 7, event\.color, 0\.3, 0\.16\)/);
});

test("debug replay recorder is wired to the canonical simulation", () => {
  const source = fs.readFileSync(new URL("../app/GameRuntime.tsx", import.meta.url), "utf8");
  assert.match(source, /createReplayRecorder\("canonical"/);
  assert.match(source, /replayRecorderRef\.current\?\.record/);
  assert.match(source, /__echoReplay/);
  const replaySource = fs.readFileSync(new URL("../app/debug-replay.ts", import.meta.url), "utf8");
  assert.match(replaySource, /compareReplayLogs/);
  assert.match(replaySource, /differences\.push/);
});
