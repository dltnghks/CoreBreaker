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
  assert.match(source, /else if \(canonicalOnlyRef\?\.current\) \{[\s\S]*canonicalAccumulatorRef\.current = 0;/);
});

test("legacy path retains frame dt and bot multi-step behavior", () => {
  assert.match(source, /const dt = Math\.max\(0, Math\.min\(0\.025/);
  assert.match(source, /for \(let step = 0; step < steps && runningRef\.current; step \+= 1\) updateRef\.current\(dt\)/);
});
