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

test("brick health changes use distinct compact damage and recovery feedback", () => {
  const events = fs.readFileSync(new URL("../app/game-events.ts", import.meta.url), "utf8");
  const presentation = fs.readFileSync(new URL("../app/useGamePresentation.ts", import.meta.url), "utf8");
  const renderer = fs.readFileSync(new URL("../app/game-renderer.ts", import.meta.url), "utf8");
  const healPulseBranch = presentation.match(/event\.type === "brick-heal-pulse"\) \{([\s\S]*?)\} else if \(event\.type === "brick-healed"/);
  const healBranch = presentation.match(/event\.type === "brick-healed"\) \{([\s\S]*?)\} else if \(event\.type === "brick-destroyed"/);
  assert.match(events, /type: "brick-heal-pulse"/);
  assert.match(events, /type: "brick-healed"/);
  assert.match(presentation, /healthFlashKind = "damage"/);
  assert.match(presentation, /healthFlashKind = "heal"/);
  assert.ok(healPulseBranch);
  assert.match(healPulseBranch[1], /kind: "ring"/);
  assert.match(healPulseBranch[1], /index < 4/);
  assert.match(healPulseBranch[1], /emphasis: "heal"/);
  assert.ok(healBranch);
  assert.match(healBranch[1], /healthFlashDuration = 0\.28/);
  assert.doesNotMatch(healBranch[1], /pushEffect|pushParticle|game\.flashes\.push/);
  assert.match(renderer, /const healthFlashRatio =/);
  assert.match(renderer, /const damageRatio =/);
  assert.match(renderer, /const crackCount =/);
  assert.match(renderer, /brick\.healthFlashKind === "heal"/);
  assert.match(renderer, /if \(brick\.healthFlashKind === "damage"\)/);
});

test("area damage keeps target information while consolidating repeated decoration", () => {
  const events = fs.readFileSync(new URL("../app/game-events.ts", import.meta.url), "utf8");
  const engine = fs.readFileSync(new URL("../app/canonical-engine.ts", import.meta.url), "utf8");
  const presentation = fs.readFileSync(new URL("../app/useGamePresentation.ts", import.meta.url), "utf8");
  const canvas = fs.readFileSync(new URL("../app/game-runtime-canvas.ts", import.meta.url), "utf8");

  assert.match(events, /type: "skill-chain"/);
  assert.match(events, /delivery\?: "ball" \| "skill" \| "dot" \| "skill-projectile" \| "environment"/);
  assert.match(engine, /function emitSkillChainPath/);
  assert.match(engine, /packet\.delivery === "ball" \|\| packet\.delivery === "environment"/);
  assert.match(presentation, /event\.type === "skill-chain"/);
  assert.match(presentation, /if \(!secondaryDamage\) playAudio\("brick-hit", event\.damage\)/);
  assert.match(presentation, /brick\.healthFlashKind = "area-damage"/);
  assert.match(presentation, /text: isMagic \? `✦-\$\{roundedDamage\}` : `-\$\{roundedDamage\}`/);
  assert.match(canvas, /effect\.points && effect\.points\.length > 1/);
  assert.match(canvas, /for \(let pointIndex = 1; pointIndex < beamPoints\.length; pointIndex \+= 1\)/);
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
