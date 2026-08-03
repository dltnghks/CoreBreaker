import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/useGameLoop.ts", import.meta.url), "utf8");

test("canonical loop uses the canonical 120Hz fixed step and bounded catch-up", () => {
  assert.match(source, /CANONICAL_FIXED_STEP_SECONDS = 1 \/ 120/);
  assert.match(source, /CANONICAL_MAX_SUBSTEPS = 8/);
  assert.match(source, /while \(remaining \+ Number\.EPSILON >= safeStep && steps < maxSubsteps\)/);
  assert.match(source, /remaining: number;|accumulator: number/);
});

test("fixed-step accumulator preserves residual time and resets on pause/stop", () => {
  assert.match(source, /return \{ accumulator: Math\.max\(0, remaining\), steps, outcome \}/);
  assert.match(source, /canonicalAccumulatorRef\.current = 0;/);
  assert.match(source, /if \(runningRef\.current\) \{[\s\S]*canonicalAccumulatorRef\.current = 0;/);
});

test("canonical path clamps frame deltas before fixed-step advancement", () => {
  assert.match(source, /const dt = Math\.max\(0, Math\.min\(0\.025/);
  assert.match(source, /const simulationDelta = dt \* Math\.max\(1, simulationRateRef\?\.current \?\? 1\)/);
  assert.match(source, /advanceCanonicalAccumulator\(canonicalAccumulatorRef\.current, simulationDelta/);
});
