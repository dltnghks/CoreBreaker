import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("game event contract is frame-buffered and drained FIFO", () => {
  const source = fs.readFileSync(new URL("../app/game-events.ts", import.meta.url), "utf8");
  assert.match(source, /export function emitGameEvent/);
  assert.match(source, /export function drainGameEvents/);
  assert.match(source, /buffer\.events\.splice\(0\)/);
});

test("page emits and consumes skill, brick, and item events at the UI boundary", () => {
  const source = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /type: "skill-activated"/);
  assert.match(source, /type: "brick-damaged"/);
  assert.match(source, /type: "item-dropped"/);
  assert.match(source, /event\.type === "skill-activated"/);
  assert.match(source, /event\.type === "brick-damaged"/);
  assert.match(source, /event\.type === "item-dropped"/);
});

test("canonical-only runtime decays transient camera feedback", () => {
  const source = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /game\.shakeTime = Math\.max\(0, \(game\.shakeTime \?\? 0\) - dt\)/);
  assert.match(source, /if \(game\.shakeTime <= 0\) game\.shakeStrength = 0/);
  assert.match(source, /game\.screenFlashTime = Math\.max\(0, \(game\.screenFlashTime \?\? 0\) - dt\)/);
});
