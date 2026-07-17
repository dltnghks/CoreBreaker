import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Core Breaker playtest", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Core Breaker - Playtest<\/title>/i);
  assert.match(html, /CORE BREAKER/);
  assert.match(html, /LIVE GAMEPLAY/);
  assert.doesNotMatch(html, /고스트 보관함/);
  assert.match(html, /20 웨이브 시작/);
  assert.match(html, /20 WAVES\. 60 SECONDS\. BREAK OR DEFEND\./);
  assert.match(html, /MULTI BALL/);
  assert.match(html, /CORE/);
  assert.match(html, /시간이 끝나면 남은 모든 블록이 코어를 공격/);
  assert.doesNotMatch(html, /플레이테스트 봇/);
  assert.match(html, /href="\/benchmark"/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("steers paddle rebounds with pointer movement and removes keyboard controls", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const playerPaddleVelocity = dt > 0 \? \(game\.paddleX - previousPaddleX\) \/ dt : 0/);
  assert.match(source, /paddle\.velocity \* PADDLE_ENGLISH_FACTOR/);
  assert.match(source, /hit \* 330 \+ paddleEnglish/);
  assert.match(source, /MOVE \/ POINTER · TOUCH/);
  assert.doesNotMatch(source, /ArrowLeft|ArrowRight|addEventListener\("keydown"/);
});

test.skip("server-renders the legacy Skill Lab", async () => {
  const response = await render("/skill-lab");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /SKILL LAB/);
  assert.match(html, /반사 횟수로 공 복제/);
  assert.match(html, /해당 패들이 공을 반사할 때/);
  assert.match(html, /스킬 보유 패들/);
  assert.match(html, /가로 인챈트 파동/);
  assert.match(html, /코어 방어막 충전/);
  assert.match(html, /5초 지속 독 피해/);
  assert.match(html, /발동 조건/);
  assert.match(html, /PADDLE BUILD/);
  assert.match(html, /UNLIMITED/);
  assert.match(html, /BALANCE CHECK/);
  assert.match(html, /게임 내 상세 설명/);
  assert.match(html, /--category-color:#a78bfa/);
  assert.match(html, /브릭을 통과할 때마다 1회가 소비/);
  assert.match(html, /지속형/);
  assert.match(html, /충전형/);
  assert.match(html, /단발형/);
  assert.match(html, /첫 보스 이후 볼 소모 비용/);
});

test.skip("wires every legacy Skill Lab skill into the playable upgrade pool", async () => {
  const source = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const gameSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const labSource = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  const skillNames = [
    "패들 폭 증가", "공 속도 증가", "아이템 자석", "충전형: 관통 횟수", "지속형: 파괴 시 범위 폭발", "단발형: 균열", "지속형: 랜덤 전도",
    "콤보 시간 회복", "전체 인챈트 충전", "반사 횟수로 공 복제", "멀티볼 추가 생성", "유도 관통 미사일", "세이프티 블록", "상단 중력장 생성", "가로 인챈트 파동", "세로 인챈트 관통",
    "위기 시 패들 확장", "코어 방어막 충전", "위기 시 자동 사격", "5초 지속 독 피해", "폭발 피해 증폭", "재타격 추가 피해", "아이템 드롭 증가",
  ];
  skillNames.forEach((name) => assert.match(source, new RegExp(`"${name}"`)));
  assert.match(gameSource, /localStorage\.getItem\(SKILL_STORAGE_KEY\)/);
  assert.match(gameSource, /skillValue\("blast", blastPower\)/);
  assert.match(gameSource, /createUpgradeCatalog\(skills\)/);
  assert.match(labSource, /localStorage\.setItem\(SKILL_STORAGE_KEY, JSON\.stringify\(skills\)\)/);
  assert.match(labSource, /SAVE & APPLY/);
});

test.skip("separates legacy enchantments into persistent, charge, and single-use modes", async () => {
  const configSource = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const gameSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const labSource = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  assert.match(configSource, /id: "blast"[^\n]+enchantMode: "persistent"/);
  assert.match(configSource, /id: "link"[^\n]+enchantMode: "persistent"/);
  assert.match(configSource, /id: "pierce"[^\n]+enchantMode: "charge"/);
  assert.match(configSource, /id: "glass"[^\n]+enchantMode: "single"/);
  assert.doesNotMatch(gameSource, /delete ball\.payloads\.blast/);
  assert.doesNotMatch(gameSource, /delete ball\.payloads\.link/);
  assert.match(gameSource, /delete ball\.payloads\.glass/);
  assert.match(labSource, /ENCHANT_MODE_LABELS/);
  assert.match(labSource, /styles\.enchantBadge/);
});

test.skip("replaces legacy ball enchantments with the latest paddle loadout", async () => {
  const gameSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const configSource = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  assert.match(gameSource, /PAYLOAD_IDS\.forEach\(\(id\) => \{ delete ball\.payloads\[id\]; \}\)/);
  assert.match(gameSource, /ball\.pierce = 0;/);
  assert.match(gameSource, /ball\.payloads\[id\] = level;/);
  assert.match(configSource, /폭발 스킬이 없는 다른 패들에 닿으면 폭발 효과가 사라집니다/);
});

test("disables ghost deployment while preserving the playtest bot", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const activeGhosts: GhostRecord\[\] = \[\]/);
  assert.doesNotMatch(source, /<h2>고스트 보관함<\/h2>/);
  assert.doesNotMatch(source, /고스트로 저장/);
  assert.match(source, /BENCHMARK START/);
});

test("shows level values in separate colors and renders skill icons", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /className="upgrade-level-values"/);
  assert.match(source, /SKILL_ICONS\[upgrade\.id\]/);
  assert.match(source, /ctx\.roundRect\(/);
  assert.match(css, /\.upgrade-level-values span:nth-child\(1\)\{color:#65dcff\}/);
  assert.match(css, /\.upgrade-level-values span:nth-child\(2\)\{color:#a78bfa\}/);
  assert.match(css, /\.upgrade-level-values span:nth-child\(3\)\{color:#ffcf4a\}/);
  assert.match(source, /className="upgrade-tooltip" role="tooltip"/);
  assert.match(css, /\.upgrade-card:hover \.upgrade-tooltip/);
});

test("adds synthesized game audio and a persistent mute control", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const audio = await readFile(new URL("../app/game-audio.ts", import.meta.url), "utf8");
  assert.match(source, /echo-breaker-sound-v1/);
  assert.match(source, /className="sound-toggle"/);
  ["paddle", "brick-hit", "brick-break", "explosion", "item", "level-up", "boss", "core-damage", "game-over"].forEach((sound) => {
    assert.match(source, new RegExp(`play\\(\"${sound}\"`));
  });
  assert.match(audio, /new AudioContext\(\)/);
  assert.match(audio, /createOscillator\(\)/);
  assert.match(audio, /createBufferSource\(\)/);
});

test("uses stationary 4x3 time-attack bosses with reinforcement bricks", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const cols = 4;/);
  assert.match(source, /const rows = 3;/);
  assert.match(source, /const width = cols \* cellWidth;/);
  assert.match(source, /return \[\{/);
  assert.match(source, /bossTimeRemaining/);
  assert.match(source, /brick\.kind === "boss-minion"/);
  assert.match(source, /BOSS SKILL \/\/ REINFORCEMENTS/);
});

test("defines 20 fixed brick patterns with bosses at waves 10 and 20", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const waves = await readFile(new URL("../app/wave-config.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ MAX_WAVE, waveDefinition \}/);
  assert.match(source, /makeWaveBricks\(waveNumber/);
  assert.match(waves, /export const WAVE_TIME_LIMIT = 60/);
  assert.match(waves, /wave\(10, "MID BOSS/);
  assert.match(waves, /wave\(20, "FINAL BOSS/);
  const patternRows = [...waves.matchAll(/"([.nhgexcr]+)"/g)].map((match) => match[1]);
  assert.ok(patternRows.length > 40);
  patternRows.forEach((row) => assert.equal(row.length, 12));
});

test("disperses explosive bricks so they cannot clear a wave as one chain", async () => {
  const waves = await readFile(new URL("../app/wave-config.ts", import.meta.url), "utf8");
  const normalWaveLines = waves.split("\n").filter((line) => /^\s*wave\(\d+/.test(line) && !line.includes("[],"));
  normalWaveLines.forEach((line) => {
    const rows = [...line.matchAll(/"([.nhgexcr]{12})"/g)].map((match) => match[1]);
    const explosiveRows = rows.filter((row) => row.includes("e"));
    assert.ok(explosiveRows.length <= 1, `explosives must occupy one row: ${line.trim()}`);
    explosiveRows.forEach((row) => assert.doesNotMatch(row, /e.?e/, `explosives are too close: ${row}`));
  });
});

test("ends a wave on clear or drops every surviving brick at time up", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const waveCleared = game\.bossActive/);
  assert.match(source, /game\.waveResolution = \{ timer: 0\.9, maxTimer: 0\.9, cleared: true/);
  assert.match(source, /const allSurvivors = game\.bricks\.filter\(\(brick\) => brick\.alive\)/);
  assert.match(source, /const survivors = allSurvivors;/);
  assert.match(source, /let coreDamage = survivors\.length;/);
  assert.doesNotMatch(source, /Math\.ceil\(threat \/ 8\)/);
  assert.match(source, /BLOCK SETTLEMENT \/\/ \$\{survivors\.length\} THREATS/);
  assert.match(source, /emitEffect\("drop"/);
  assert.ok(source.indexOf('effect.kind === "drop"') > source.indexOf("game.effects.forEach((effect)"));
  assert.match(source, /game\.coreHp = Math\.max\(0, game\.coreHp - resolution\.coreDamage\)/);
  assert.match(source, /completeWave\(resolution\.cleared, resolution\.coreDamage/);
  assert.ok(source.indexOf("game.coreHp = Math.max(0, game.coreHp - resolution.coreDamage)") > source.indexOf("if (game.waveResolution)"));
});

test("raises post-wave-5 density, brick health, and boss health", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const waves = await readFile(new URL("../app/wave-config.ts", import.meta.url), "utf8");
  const balance = await readFile(new URL("../app/balance-config.ts", import.meta.url), "utf8");
  assert.match(waves, /wave\(6,[^\n]+\["....cccc....", "..hhhhhhhh..", "nnnnnnnnnnnn"/);
  assert.match(waves, /wave\(11,[^\n]+"..xx....xx.."\]\)/);
  assert.match(waves, /wave\(19,[^\n]+"xxnnnnnnnnxx"\]\)/);
  assert.match(source, /Math\.round\(balance\.baseHpWaveStep\)/);
  assert.match(balance, /baseHpWaveStep: 2/);
  assert.match(balance, /hardHpWaveStep: 3/);
  assert.match(balance, /bossBaseHp: 280/);
  assert.match(balance, /bossHpPerStage: 160/);
  assert.match(balance, /echo-breaker-balance-v3/);
});

test("renders every destructible brick health as large outlined white text", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /else if \(brick\.trait !== "indestructible"\)/);
  assert.match(source, /ctx\.fillStyle = "#ffffff"/);
  assert.match(source, /ctx\.font = "900 18px monospace"/);
  assert.match(source, /ctx\.strokeText\(hpText/);
  assert.match(source, /ctx\.font = "900 44px monospace"/);
});

test("adds six stage brick traits with distinct combat rules", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /type BrickTrait = "standard" \| "guard" \| "explosive" \| "indestructible" \| "healer" \| "reflector"/);
  assert.match(source, /const absorbGuardHit =/);
  assert.match(source, /GUARD \/\/ HIT NULLIFIED/);
  assert.match(source, /brick\.trait === "explosive"/);
  assert.match(source, /EXPLOSIVE \/\/ BALL LAUNCHED/);
  assert.match(source, /brick\.trait === "indestructible"/);
  assert.match(source, /healer\.healTimer = 3/);
  assert.match(source, /HEAL PULSE \/\/ \+1/);
  assert.match(source, /brick\.trait === "reflector" && ball\.vy < 0/);
  assert.match(source, /fillText\(brick\.guardReady \? "G1" : "G0"/);
  assert.doesNotMatch(source, /"shield"/);
});

test("selects two starting skills and settles core damage before wave rewards", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /"initialskills"/);
  assert.match(source, /STARTING SKILL/);
  assert.match(source, /selected\.length < 2/);
  assert.match(source, /"settlement"/);
  assert.match(source, /WAVE \{settlement\.wave\} SETTLEMENT/);
  assert.match(source, /setMode\("settlement"\)/);
  assert.match(source, /스킬 보상 받기/);
});

test("respawns a ball at the cost of one core health", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /game\.coreHp = Math\.max\(0, game\.coreHp - 1\);/);
  assert.match(source, /game\.balls\.push\(makePlayerBall\(game\.upgrades, game\.paddleX\)\);/);
  assert.match(source, /BALL LOST \/\/ CORE -1 \/\/ RESPAWN/);
});

test("uses fixed 60 second wave pacing and skill-specific combat effects", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const STARTING_ROW_INTERVAL = 60;/);
  assert.match(source, /game\.rowInterval = definition\.timeLimit \+ timeBonus/);
  assert.match(source, /type GameEffect =/);
  assert.match(source, /HORIZONTAL ENCHANT/);
  assert.match(source, /emitEffect\("beam"/);
  assert.match(source, /drawMagnetLinks/);
});

test("propagates paddle debuffs through enchantment damage and renders line barriers", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /blastVulnerability/);
  assert.match(source, /applyDebuffs\(near, sourcePaddle\)/);
  assert.match(source, /applyDebuffs\(linked, sourcePaddle\)/);
  assert.match(source, /applyDebuffs\(brick, sourcePaddle\)/);
  assert.match(source, /emitEffect\("blast"/);
  assert.match(source, /barrierSummary/);
  assert.match(source, /CORE LINE/);
  assert.match(source, /EXP ×/);
});

test.skip("converts legacy line clears into enchant waves and randomizes nearby link targets", async () => {
  const configSource = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const gameSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(configSource, /id: "link"[^\n]+levels: \[1, 2, 3\]/);
  assert.match(gameSource, /const randomLinkTargets =/);
  assert.match(gameSource, /const radius = 100 \+ \(linkLevel - 1\) \* 30/);
  assert.match(gameSource, /function applyEnchantWaveHit/);
  assert.match(gameSource, /HORIZONTAL ENCHANT/);
  assert.match(gameSource, /VERTICAL ENCHANT/);
  assert.match(gameSource, /forEach\(\(target\) => applyEnchantWaveHit\(target, ball, sourcePaddle\)\)/);
  assert.doesNotMatch(gameSource, /forEach\(\(target\) => destroyBrick\(target, ball, false, 0\)\)/);
});

test("removes experience progression and rewards skills after waves", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /game\.xp \+=/);
  assert.doesNotMatch(source, /"xp-core"/);
  assert.match(source, /if \(earnedDrop && game\.items\.length < 120\)/);
  assert.match(source, /levelUp\(\);/);
});

test("keeps ball bodies unified and distinguishes power and skills with effects", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /attackPower: number/);
  assert.match(source, /function ballBodyColor/);
  assert.doesNotMatch(source, /function attackColor/);
  assert.match(source, /const visualRadius =/);
  assert.match(source, /const powerRingCount =/);
  assert.match(source, /classCategory === "warrior"/);
  assert.match(source, /classCategory === "archer"/);
  assert.match(source, /const orbitRadius =/);
  assert.match(source, /visualSkill: ClassSkillId \| null/);
  assert.match(source, /visualSkill: skillId/);
  assert.match(source, /activeClassCharges\.push\(\[ball\.visualSkill, 1\]\)/);
  assert.match(source, /const SKILL_ICONS/);
  assert.match(source, /const drawSkillPanel/);
  assert.match(source, /ATK/);
  assert.match(source, /BARRIER \$\{barrierSummary\}/);
});

test.skip("adds legacy paddle-owned multiball survival skills", async () => {
  const configSource = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const gameSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const labSource = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  assert.match(configSource, /id: "missile-mode"[^\n]+category: "survival"/);
  assert.match(configSource, /id: "safety-block"[^\n]+category: "survival"/);
  assert.match(configSource, /id: "gravity-well"[^\n]+category: "survival"/);
  assert.match(gameSource, /ball\.missileTime = skillValue\("missile-mode", missileLevel\)/);
  assert.match(gameSource, /game\.safetyBlocks\.push/);
  assert.match(gameSource, /game\.gravityWells\.push/);
  assert.match(gameSource, /AUTO REFLECT/);
  assert.match(gameSource, /GRAVITY WELL/);
  assert.match(labSource, /survival: "BALL SURVIVAL"/);
});

test.skip("uses legacy percentage fracture, upper gravity wells, and homing piercing missiles", async () => {
  const configSource = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const gameSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(configSource, /id: "glass"[^\n]+levels: \[35, 50, 65\]/);
  assert.match(gameSource, /const fractureRate = skillValue\("glass", glassLevel\) \/ 100/);
  assert.match(gameSource, /Math\.min\(brick\.kind === "boss-core" \|\| brick\.kind === "boss-armor" \? 20 : Infinity/);
  assert.doesNotMatch(gameSource, /brick\.hp = 1/);
  assert.match(gameSource, /const wellY = 155 \+ decisionRandom\(\) \* 75/);
  assert.match(gameSource, /const missileSpeed = Math\.max\(380/);
  assert.match(gameSource, /const target = game\.bricks/);
  assert.match(gameSource, /const targetAngle = Math\.atan2/);
  assert.match(gameSource, /const turn = Math\.max\(-5\.4 \* dt/);
});

test("resets wave balls above the paddle and adds one base ball per wave", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const ballCount = game\.balls\.length/);
  assert.match(source, /game\.balls\.forEach\(\(ball, index\) =>/);
  assert.match(source, /ball\.y = PLAYER_PADDLE_Y - ball\.radius - 3/);
  assert.match(source, /ball\.vy = -Math\.sqrt/);
  assert.match(source, /const resetBallsForWave =/);
  assert.match(source, /ball\.temporaryTime <= 0 && !ball\.waveBonus/);
  assert.match(source, /while \(game\.balls\.length < game\.wave\) game\.balls\.push\(makePlayerBall/);
});

test("renders item multiballs gray and removes them after the wave", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const WAVE_MULTIBALL_COLOR = "#9aa3b2"/);
  assert.match(source, /waveBonus: boolean/);
  assert.match(source, /waveBonus: true/);
  assert.match(source, /const drawColor = ballBodyColor\(ball\)/);
  assert.match(source, /!ball\.waveBonus/);
});

test("runs a no-ghost playtest bot and persists balance metrics", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const balanceConfig = await readFile(new URL("../app/balance-config.ts", import.meta.url), "utf8");
  assert.match(source, /const activeGhosts: GhostRecord\[\] = \[\]/);
  assert.match(source, /function chooseBotUpgrade/);
  assert.match(source, /let desiredHit = Math\.max\(-0\.72/);
  assert.match(source, /predictedX - desiredHit \* game\.paddleWidth \/ 2/);
  assert.match(source, /botActiveRef\.current/);
  assert.match(source, /game\.botMetrics\.maxBalls/);
  assert.match(source, /game\.botMetrics\.ballLosses/);
  assert.match(source, /game\.botMetrics\.missileActivations/);
  assert.match(source, /game\.botMetrics\.safetySaves/);
  assert.match(source, /game\.botMetrics\.gravityRescues/);
  assert.match(balanceConfig, /echo-breaker-bot-results-v1/);
  assert.match(source, /recordBotWaveSample/);
  assert.match(source, /waveSamples: botSkillBenchVariantRef\.current \? \[\] : \[\.\.\.game\.botWaveSamples\]/);
  assert.match(source, /EXPORT JSON/);
});

test("connects the benchmark wave simulator to live bot telemetry", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const simulator = await readFile(new URL("../app/skill-lab/balance-simulator.tsx", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/benchmark/page.tsx", import.meta.url), "utf8");
  assert.match(source, /balanceConfigRef\.current/);
  assert.match(source, /BALANCE_STORAGE_KEY/);
  assert.match(lab, /<BalanceSimulator \/>/);
  assert.match(simulator, /WAVE BALANCE SIMULATOR/);
  assert.match(simulator, /BOT DATA AUTO FIT/);
  assert.match(simulator, /window\.setInterval\(loadRuns, 1000\)/);
  assert.match(simulator, /completedRuns\.length < 3/);
  assert.match(simulator, /BOT_LIVE_STORAGE_KEY/);
});

test("finishes bot evaluations at the wave 20 final boss", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const BOT_EVALUATION_WAVE = MAX_WAVE/);
  assert.match(source, /completedWave >= MAX_WAVE/);
  assert.match(source, /evaluationComplete: game\.wave >= \(benchmarkMode \? benchmarkConfigRef\.current\.targetWave : BOT_EVALUATION_WAVE\)/);
  assert.match(source, /TARGET W\{benchmarkConfig\.targetWave\}/);
  assert.match(source, /BENCHMARK START/);
});

test("separates gameplay from a cumulative feature benchmark", async () => {
  const response = await render("/benchmark");
  assert.equal(response.status, 200);
  const html = await response.text();
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/benchmark-config.ts", import.meta.url), "utf8");
  assert.match(html, /BENCHMARK LAB/);
  assert.match(html, /ORIGINAL/);
  assert.match(html, /\+ PRESSURE/);
  assert.match(html, /\+ ITEMS/);
  assert.match(html, /\+ BRICK TYPES/);
  assert.match(html, /\+ SKILLS/);
  assert.match(html, /\+ BOSSES/);
  assert.match(config, /pressure: stage >= 1/);
  assert.match(config, /items: stage >= 2/);
  assert.match(config, /brickTypes: stage >= 3/);
  assert.match(config, /skills: stage >= 4/);
  assert.match(config, /bosses: stage >= 5/);
  assert.match(source, /benchmarkMode && <aside className="ghost-panel">/);
  assert.match(source, /if \(!activeBenchmark\.items\)/);
  assert.match(source, /if \(!activeBenchmark\.brickTypes\)/);
  assert.match(source, /if \(!activeBenchmark\.skills\)/);
  assert.match(source, /if \(!activeBenchmark\.bosses\)/);
  assert.match(source, /if \(!activeBenchmark\.pressure\)/);
});

test.skip("runs legacy controlled baseline and level 1-3 skill bench groups", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const bench = await readFile(new URL("../app/skill-lab/skill-bench.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/balance-config.ts", import.meta.url), "utf8");
  assert.match(config, /SKILL_BENCH_STORAGE_KEY/);
  assert.match(source, /const variantsPerSkill = bench\.environment === "original" \? 1 : 4/);
  assert.match(source, /Math\.floor\(withinSkillRun \/ bench\.runsPerVariant\)/);
  assert.match(source, /game\.upgrades = skillId === "original" \? \[\] : Array\.from\(\{ length: level \}, \(\) => skillId\)/);
  assert.match(source, /benchExcluded/);
  assert.match(source, /skillValues: skillId === "original" \? \[0, 0, 0\] : \[\.\.\.activeSkillMap\[skillId\]\.levels\]/);
  assert.match(source, /configureRunRandom\(benchSeed\)/);
  assert.match(source, /withinSkillRun % bench\.runsPerVariant/);
  assert.match(source, /environmentRandom = seededRandom\(seed\)/);
  assert.match(bench, /기준군/);
  assert.match(bench, /기준군\/LV1\/LV2\/LV3/);
  assert.match(bench, /과성능 후보/);
  assert.match(bench, /기준군도 W100을 대부분 통과/);
});

test("queues every selected skill and resumes batch skill benches", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const bench = await readFile(new URL("../app/skill-lab/skill-bench.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/balance-config.ts", import.meta.url), "utf8");
  assert.match(config, /SKILL_BENCH_PROGRESS_KEY/);
  assert.match(config, /mode: "single" \| "batch"/);
  assert.match(source, /queue\.length \* bench\.runsPerVariant \* variantsPerSkill/);
  assert.match(source, /savedProgress\.status === "paused"/);
  assert.match(source, /skillIndex = Math\.floor\(botCompletedRunsRef\.current \/ perSkillRuns\)/);
  assert.match(source, /slice\(-1200\)/);
  assert.match(bench, /BATCH SKILL BENCH/);
  assert.match(bench, /ALL SKILLS/);
  assert.match(bench, /직접 선택/);
  assert.match(bench, /progress\.completedRuns\}\/{progress\.totalRuns/);
});

test("separates original, isolated, and ecosystem experiment roles", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const bench = await readFile(new URL("../app/skill-lab/skill-bench.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/balance-config.ts", import.meta.url), "utf8");
  assert.match(config, /environment: "original" \| "isolated" \| "ecosystem"/);
  assert.match(source, /bench\.environment === "original" \? \["original"\]/);
  assert.match(source, /skillBenchConfigRef\.current\.environment !== "ecosystem"/);
  assert.match(source, /ORIGINAL \/\/ NO SKILLS/);
  assert.match(source, /!botSkillBenchActiveRef\.current \|\| skillBenchConfigRef\.current\.environment === "ecosystem"/);
  assert.match(bench, />ORIGINAL</);
  assert.match(bench, />ISOLATED</);
  assert.match(bench, />ECOSYSTEM</);
  assert.match(bench, /스킬 없는 오리지널 기준군/);
});

test("runs the playtest bot at selectable fixed-step speeds", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /type BotSpeed = 1 \| 2 \| 4 \| 8/);
  assert.match(source, /const steps = botActiveRef\.current \? botSpeedRef\.current : 1/);
  assert.match(source, /for \(let step = 0; step < steps && runningRef\.current; step\+\+\) updateGame\(dt\)/);
  assert.match(source, /<label>배속/);
  assert.match(source, /speed: botSpeedRef\.current/);
  assert.match(source, /botSpeedRef\.current = speed/);
  assert.match(source, /disabled=\{!botRunning && mode !== "lobby"\}/);
});

test("keeps safety blocks until they reflect a ball", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /block\.life -= dt/);
  assert.doesNotMatch(source, /block\.life > 0 && ball\.y/);
  assert.match(source, /game\.safetyBlocks = game\.safetyBlocks\.filter\(\(block\) => block !== safetyBlock\)/);
});

test("uses a permanent neutral floor that purges ball effects before reflecting", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const BALL_FLOOR_Y = H - 4/);
  assert.match(source, /ball\.vy > 0 && ball\.y \+ ball\.radius >= BALL_FLOOR_Y/);
  assert.match(source, /ball\.vx = \(ball\.vx < 0 \? -1 : 1\) \* BASE_BALL_VX/);
  assert.match(source, /ball\.vy = -BASE_BALL_VY/);
  assert.match(source, /ball\.payloads = \{\}/);
  assert.match(source, /ball\.attackPower = 1/);
  assert.match(source, /ball\.sourcePaddleId = neutralFloor\.id/);
  assert.match(source, /ball\.missileTime = 0/);
  assert.match(source, /NEUTRAL FLOOR \/\/ RESET ALL BALL EFFECTS/);
  const floorLogic = source.slice(source.indexOf("if (ball.vy > 0 && ball.y + ball.radius >= BALL_FLOOR_Y)"), source.indexOf("if (ball.y > H + 30)"));
  assert.doesNotMatch(floorLogic, /grantPaddlePayloads/);
});

test("uses a faster base ball speed for the neutral-floor ruleset", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const BASE_BALL_VX = 240/);
  assert.match(source, /const BASE_BALL_VY = 320/);
  assert.match(source, /vx: BASE_BALL_VX \* speed, vy: -BASE_BALL_VY \* speed/);
});

test.skip("renders legacy paddle-owned progress counters for count-triggered skills", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const COUNTED_SKILL_IDS: UpgradeId\[\]/);
  assert.match(source, /const countedProgress =/);
  assert.match(source, /counter\.missileReflections/);
  assert.match(source, /counter\.barrierReflections/);
  assert.match(source, /counter\.directKills/);
  assert.match(source, /counter\.pierceKills/);
  assert.match(source, /const drawCounterRail =/);
  assert.match(source, /`\$\{entry\.current\}\/\$\{entry\.goal\}`/);
  assert.match(source, /ratio >= 0\.8/);
  assert.match(source, /drawCounterRail\(game\.paddleX, PLAYER_PADDLE_Y, "player"/);
  assert.match(source, /drawCounterRail\(x, y, `ghost-\$\{index\}`/);
});

test.skip("spends weaker surplus balls when choosing priced upgrades", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /type UpgradeChoice = \{ upgrade: Upgrade; ballCost: 0 \| 1 \| 2 \}/);
  assert.match(source, /function priceUpgradeChoices/);
  assert.match(source, /playerBalls\.length - 1 < ballCost/);
  assert.match(source, /sort\(\(a, b\) => sacrificeValue\(a\) - sacrificeValue\(b\)\)/);
  assert.match(source, /BALL SACRIFICE -\$\{ballCost\}/);
  assert.match(source, /마지막 공 보호/);
  assert.match(source, /disabled=\{!affordable\}/);
  assert.match(css, /\.upgrade-ball-cost/);
  assert.match(css, /\.upgrade-card:disabled/);
});

test.skip("unlocks legacy fixed-cost skills after the first boss and offers one reroll", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const PRE_BOSS_SKILL_IDS = new Set<UpgradeId>/);
  assert.match(source, /bench\.environment === "original"/);
  assert.match(source, /skillBenchConfigRef\.current\.environment !== "ecosystem"/);
  assert.match(source, /const \[rerollsLeft, setRerollsLeft\] = useState\(1\)/);
  assert.match(source, /const rerollUpgradeChoices = useCallback/);
  assert.match(source, /리롤 \{rerollsLeft\}\/1/);
  assert.match(source, /선택 건너뛰기/);
  assert.match(config, /environment: SkillBenchEnvironment/);
  assert.match(lab, /ORIGINAL/);
});

test("uses a fixed multiball item budget for every boss stage", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const NORMAL_STAGE_MULTIBALL_WAVES = \[2, 4, 6, 8, 11, 13, 16, 18\]/);
  assert.match(source, /const BOSS_MULTIBALL_BUDGET = 2/);
  assert.match(source, /function hasScheduledMultiball/);
  assert.match(source, /col === multiballColumn \? "multiball" : pickBrickDrop\(\)/);
  assert.match(source, /index < forcedMultiballs \? "multiball"/);
  assert.match(source, /game\.bossMultiballsRemaining = game\.bossActive \? BOSS_MULTIBALL_BUDGET : 0/);
  const randomDrop = source.slice(source.indexOf("function pickBrickDrop"), source.indexOf("function hasScheduledMultiball"));
  assert.match(randomDrop, /return null/);
  assert.match(source, /type ItemKind = "multiball"/);
  assert.doesNotMatch(source.slice(source.indexOf("const ITEM_DATA"), source.indexOf("const ITEM_KINDS")), /COMBO|BARRIER|REPAIR|STRIKE/);
});

test("renders the warrior archer mage Skill Lab", async () => {
  const response = await render("/skill-lab");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /SKILL LAB/);
  ["전사", "궁수", "법사", "일반 스킬", "보스 궁극기"].forEach((label) => {
    assert.match(html, new RegExp(label));
  });
});

test("defines all class skills as reflection-driven skills without ball costs", async () => {
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const names = ["강타", "충격파", "처형", "분쇄", "철벽", "대지 분쇄", "광전사", "연사", "관통 화살", "도탄 화살", "집중 사격", "약점 사격", "화살비", "무한 탄창", "화염구", "연쇄 번개", "빙결", "블랙홀", "마력 폭발", "원소 폭풍", "메테오"];
  names.forEach((name) => assert.match(config, new RegExp(`"${name}"`)));
  assert.match(config, /export const NORMAL_SKILLS/);
  assert.match(config, /export const ULTIMATE_SKILLS/);
  assert.match(config, /direction: "down"/);
  assert.match(config, /ballCost: 0/);
  assert.doesNotMatch(config, /ballCost: [12]/);
});

test("charges class skills from paddle reflections and grants ultimates after bosses", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /skillReflections: Partial<Record<ClassSkillId, number>>/);
  assert.match(source, /const triggerReflectionSkill =/);
  assert.match(source, /paddleCounter\.skillReflections\[id\]/);
  assert.match(source, /triggerReflectionSkill\("warrior-smash"/);
  assert.match(source, /triggerReflectionSkill\("archer-rapid"/);
  assert.match(source, /triggerReflectionSkill\("mage-fireball"/);
  assert.match(source, /game\.upgrades\.push\(rewardId\)/);
  assert.match(source, /ULTIMATE ACQUIRED/);
  assert.match(source, /ultimateCatalog\.map/);
  assert.doesNotMatch(source, /activeSkillMap\[upgrade\.id\]\.ballCost/);
});

test("enlarges skill counters and pulses the paddle when a skill charges", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const cellWidth = 48/);
  assert.match(source, /const cellHeight = 24/);
  assert.match(source, /const perRow = Math\.min\(10, entries\.length\)/);
  assert.match(source, /ctx\.font = "900 13px/);
  assert.match(source, /ctx\.font = "900 11px monospace"/);
  assert.match(source, /paddleCounter\.chargePulse = 1\.2/);
  assert.match(source, /nearest\.ratio < 0\.75/);
  assert.match(source, /const drawPaddleChargeAura =/);
  assert.match(source, /playerChargeVisual\?\.color \?\? PLAYER_BALL_COLOR/);
});

test("expires temporary arrows by time and renders per-skill visual feedback away from the paddle", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  assert.match(source, /temporaryTime: number/);
  assert.match(source, /ball\.temporaryTime = Math\.max\(0, ball\.temporaryTime - dt\)/);
  assert.doesNotMatch(source, /temporaryHits/);
  assert.match(source, /drawCounterRail\(W \/ 2, H - 6, "player"/);
  assert.match(source, /const consumedClassSkills =/);
  assert.match(source, /classSkillColor\(id\)/);
  assert.match(config, /export const SKILL_COLORS/);
  assert.match(lab, /const skillStyle =/);
});

test("adds common utility skills to gameplay, Skill Lab, and skill benchmarks", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  const bench = await readFile(new URL("../app/skill-lab/skill-bench.tsx", import.meta.url), "utf8");
  ["common-magnet", "common-luck", "common-wide", "common-xp", "common-combo"].forEach((id) => assert.match(config, new RegExp(`"${id}"`)));
  assert.match(source, /skillValue\("common-magnet"/);
  assert.match(source, /skillValue\("common-luck"/);
  assert.match(source, /skillValue\("common-wide"/);
  assert.match(source, /skillValue\("common-combo"/);
  assert.match(lab, /common: "공용"/);
  assert.match(bench, /common: "공용"/);
});

test("layers screen shake, flashes, impact visuals, and stronger synthesized sound", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const audio = await readFile(new URL("../app/game-audio.ts", import.meta.url), "utf8");
  assert.match(source, /function setImpactFeedback/);
  assert.match(source, /const shakeAmplitude =/);
  assert.match(source, /ctx\.translate\(shakeX, shakeY\)/);
  assert.match(source, /globalCompositeOperation = "screen"/);
  assert.match(source, /impactFeedback\(11, "#ffcf4a"/);
  assert.match(audio, /createDynamicsCompressor/);
  assert.match(audio, /case "skill-impact"/);
  assert.match(audio, /case "critical"/);
  assert.match(audio, /case "ultimate"/);
});

test("renders CC0 ring explosion sprites with a procedural fallback", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const license = await readFile(new URL("../docs/THIRD_PARTY_ASSETS.md", import.meta.url), "utf8");
  assert.match(source, /RING_EXPLOSION_ASSET = "\/assets\/vfx\/ring-explosion\.png"/);
  assert.match(source, /RING_EXPLOSION_FRAMES = 56/);
  assert.match(source, /ringExplosionReadyRef\.current && explosionImage/);
  assert.match(source, /ctx\.drawImage\(/);
  assert.match(source, /const glow = ctx\.createRadialGradient/);
  assert.match(license, /Ring Explosion/);
  assert.match(license, /BenHickling/);
  assert.match(license, /CC0 1\.0 Universal/);
});

test("renders separate CC0 spark strips for normal and guarded brick hits", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const license = await readFile(new URL("../docs/THIRD_PARTY_ASSETS.md", import.meta.url), "utf8");
  assert.match(source, /HIT_SPARK_ASSETS = \["\/assets\/vfx\/hit-spark-a\.png", "\/assets\/vfx\/hit-spark-b\.png"\]/);
  assert.match(source, /HIT_SPARK_FRAMES = 9/);
  assert.match(source, /guardAbsorbed \? 1 : 0/);
  assert.match(source, /effect\.kind === "spark"/);
  assert.match(source, /hitSparkReadyRef\.current\[variant\] && sparkImage/);
  assert.match(license, /Spark Effect/);
  assert.match(license, /kurohina/);
});

test("renders tinted CC0 radial lightning for warrior and critical impacts", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const license = await readFile(new URL("../docs/THIRD_PARTY_ASSETS.md", import.meta.url), "utf8");
  assert.match(source, /RADIAL_LIGHTNING_ASSET = "\/assets\/vfx\/radial-lightning\.png"/);
  assert.match(source, /RADIAL_LIGHTNING_FRAMES = 8/);
  assert.match(source, /lightningImpact \? "lightning"/);
  assert.match(source, /id === "archer-weakpoint" \? 1 : 0/);
  assert.match(source, /hue-rotate\(180deg\)/);
  assert.match(source, /effect\.kind === "lightning"/);
  assert.match(license, /Radial Lightning Effect/);
  assert.match(license, /13rice/);
});
