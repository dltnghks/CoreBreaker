import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const vite = await createServer({
  root: fileURLToPath(new URL("..", import.meta.url)),
  configFile: false,
  appType: "custom",
  server: { middlewareMode: true },
  logLevel: "silent",
});
const load = (path) => vite.environments.ssr.runner.import(path);
const engine = await load("/app/canonical-engine.ts");
const skills = await load("/app/skill-config.ts");
const waves = await load("/app/wave-config.ts");
after(async () => { await vite.close(); });

test("skill config matches the finalized plan values and removed skills stay out of the catalog", () => {
  const byId = Object.fromEntries(skills.DEFAULT_SKILLS.map((skill) => [skill.id, skill]));
  assert.deepEqual(byId["warrior-smash"].levels, [1, 3, 5]);
  assert.deepEqual(byId["warrior-shockwave"].levels, [1, 2, 3]);
  assert.equal(byId["warrior-shockwave"].mechanic, "impact");
  const shockwaveSplash = byId["warrior-shockwave"].traitConfigs.find((trait) => trait.kind === "splash");
  assert.deepEqual(shockwaveSplash.values, [105, 115, 125]);
  assert.deepEqual(shockwaveSplash.damage, [1, 2, 3]);
  assert.deepEqual(byId["warrior-guard"].cooldown, [15, 12, 8]);
  assert.deepEqual(byId["warrior-crush"].cooldown, [2, 1, 0.5]);
  assert.deepEqual(byId["warrior-execute"].skillDamage, [0, 0, 0]);
  const executeTrait = byId["warrior-execute"].traitConfigs.find((trait) => trait.kind === "execute");
  assert.deepEqual(executeTrait.values, [1.5, 2, 3]);
  assert.deepEqual(executeTrait.damage, [0, 0, 0]);
  assert.deepEqual(byId["archer-ricochet"].skillDamage, [0, 0, 0]);
  assert.deepEqual(byId["archer-focus"].skillDamage, [0, 0, 0]);
  assert.deepEqual(byId["archer-weakpoint"].skillDamage, [0, 0, 0]);
  const lightningDescription = skills.resolveSkillDescription(byId["mage-lightning"]);
  assert.equal(lightningDescription.includes("{levels}"), false);
  assert.equal(lightningDescription.includes("2/4/6"), true);
  assert.equal(lightningDescription.includes("공통 마법 강화"), true);
  assert.equal(byId["archer-pierce"].damageType, "physical");
  assert.deepEqual(byId["mage-lightning"].levels, [2, 4, 6]);
  assert.deepEqual(skills.SKILL_MAGIC_DAMAGE["mage-lightning"], [2, 4, 6]);
  assert.equal(skills.SKILL_EVOLUTIONS["warrior-smash"].includes("0.4초"), true);
  assert.equal(skills.SKILL_EVOLUTIONS["warrior-shockwave"].includes("50px"), true);
  assert.equal(skills.SKILL_EVOLUTIONS["mage-lightning"].includes("3개"), true);
  assert.equal(skills.SKILL_EVOLUTIONS["archer-focus"].includes("웨이브 종료"), true);
  assert.equal(skills.DEFAULT_SKILLS.some((skill) => ["common-combo", "common-ball-size", "common-skill-damage"].includes(skill.id)), false);
});

test("shockwave damages the collided block and every block inside its radius", () => {
  const definitions = waves.WAVE_DEFINITIONS.map((wave) => ({ ...wave, pattern: [...wave.pattern] }));
  definitions[0] = { ...definitions[0], pattern: [".....sss....."] };
  const state = engine.createCanonicalState({ seed: 20260807, targetWave: 1, waves: definitions, startingSkills: ["warrior-shockwave"] });
  const [origin, near, far] = state.bricks;
  origin.x = 300; origin.y = 160;
  near.x = 300; near.y = 220;
  far.x = 360; far.y = 220;
  for (const brick of state.bricks) {
    brick.hp = 20;
    brick.maxHp = 20;
  }
  const ball = state.balls[0];
  ball.x = origin.x + origin.w / 2;
  ball.y = origin.y + origin.h + ball.radius - 1;
  ball.vx = 0;
  ball.vy = -320;
  engine.stepCanonicalEngine(state, { move: 0, aimX: 450, aimY: 80 }, engine.FIXED_STEP_SECONDS);
  assert.equal(origin.hp, 18, "the origin receives the ball hit and shockwave hit");
  assert.equal(near.hp, 19, "the near block receives shockwave damage");
  assert.equal(far.hp, 19, "the far block inside the 105px radius receives shockwave damage");
});
