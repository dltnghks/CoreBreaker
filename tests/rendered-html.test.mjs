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
  assert.match(html, /20 WAVES\. ONE BALL\. BREAK THROUGH\./);
  assert.match(html, /MULTI BALL/);
  assert.match(html, /CORE/);
  assert.match(html, /공을 놓치면 CORE 1을 잃고 새 공으로 즉시 이어집니다/);
  assert.doesNotMatch(html, /플레이테스트 봇/);
  assert.match(html, /href="\/benchmark"/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("uses a restrained techno-fantasy UI palette and layered panels", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const labStyles = await readFile(new URL("../app/skill-lab/skill-lab.module.css", import.meta.url), "utf8");
  assert.match(styles, /--panel-raised:#171b28/);
  assert.match(styles, /--line-strong:rgba\(216,196,151,\.32\)/);
  assert.match(styles, /Polished techno-fantasy shell/);
  assert.match(styles, /\.hud-badge\{[\s\S]*clip-path:polygon/);
  assert.match(styles, /\.primary-button\{[\s\S]*linear-gradient\(145deg,#f0d58c,#bd984b\)/);
  assert.match(labStyles, /linear-gradient\(180deg,#080a12,#05060d 72%\)/);
});

test("moves the paddle with A and D while the pointer aims rebounds", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /PADDLE_KEYBOARD_SPEED = 460/);
  assert.match(source, /window\.addEventListener\("keydown", onKeyDown\)/);
  assert.match(source, /key !== "a" && key !== "d"/);
  assert.match(source, /Number\(keyboardRef\.current\.right\) - Number\(keyboardRef\.current\.left\)/);
  assert.match(source, /pointerYRef/);
  assert.match(source, /function paddleAimDirection/);
  assert.match(source, /horizontalRatio = Math\.max\(-MAX_PADDLE_REBOUND_RATIO/);
  assert.match(source, /verticalRatio: -Math\.sqrt/);
  assert.match(source, /const AIM_LIMIT_GUIDE_LENGTH = 100/);
  assert.match(source, /const AIM_LINE_LENGTH = 170/);
  assert.match(source, /const aimEnd = rayEnd\(aim\.horizontalRatio, aim\.verticalRatio, AIM_LINE_LENGTH\)/);
  assert.match(source, /const leftLimit = rayEnd\(-MAX_PADDLE_REBOUND_RATIO, edgeVerticalRatio, AIM_LIMIT_GUIDE_LENGTH/);
  assert.match(source, /const rightLimit = rayEnd\(MAX_PADDLE_REBOUND_RATIO, edgeVerticalRatio, AIM_LIMIT_GUIDE_LENGTH/);
  assert.match(source, /paddle\.id === "player"/);
  assert.match(source, /const rawContactTime = verticalTravel > 0/);
  assert.match(source, /const alreadyTouchingTop = previousBallY <= paddle\.y \+ PADDLE_COLLISION_SLOP/);
  assert.match(source, /const sideDepthContact =/);
  assert.match(source, /PADDLE_SIDE_FORGIVENESS/);
  assert.match(source, /const paddleContactX = paddle\.previousX \+ \(paddle\.x - paddle\.previousX\) \* contactTime/);
  assert.match(source, /const reboundSpeed = .*Math\.hypot\(ball\.vx, ball\.vy\)/);
  assert.match(source, /parkBallsAbovePaddle\(game, targetX, targetY\)/);
  assert.match(source, /prepareWave\(game, nextWave, balanceConfigRef\.current, pointerXRef\.current, pointerYRef\.current\)/);
  assert.match(source, /MOVE <kbd>A<\/kbd><kbd>D<\/kbd> · AIM \/ MOUSE/);
  assert.doesNotMatch(source, /PADDLE_ENGLISH_FACTOR|paddle\.velocity/);
});

test("ramps ball speed by wave elapsed time and resolves circular brick collisions", async () => {
  const response = await render();
  const html = await response.text();
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const benchmark = await readFile(new URL("../app/benchmark-headless.ts", import.meta.url), "utf8");
  assert.match(html, /SPEED[\s\S]*100[\s\S]*%/);
  assert.match(source, /OVERDRIVE_RATE_PER_SECOND = 0\.01/);
  assert.match(source, /MAX_OVERDRIVE_LEVEL = 50/);
  assert.match(source, /const dt = Math\.max\(0, Math\.min\(0\.025/);
  assert.match(source, /MAX_PADDLE_REBOUND_SPEED = Math\.hypot\(BASE_BALL_VX, BASE_BALL_VY\) \* 2/);
  assert.match(source, /\+1%\/s/);
  assert.match(source, /hud\.overdriveLevel < MAX_OVERDRIVE_LEVEL \? "\+1%\/s" : "MAX"/);
  assert.match(source, /OVERDRIVE .* BALL SPEED/);
  assert.match(source, /function circleRectangleCollision/);
  assert.match(source, /function separateAndReflectBall/);
  assert.match(source, /collision\.penetration \+ 0\.1/);
  assert.match(benchmark, /function overdriveAdjustedDuration/);
  assert.match(benchmark, /const overdriveRisk = Math\.floor\(overdriveLevelAt\(waveElapsed\) \/ 10\) \* 0\.012/);
});

test("guarantees a minimum vertical angle after every reflection", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const MIN_VERTICAL_SPEED_RATIO = 0\.32/);
  assert.match(source, /function ensureMinimumVerticalAngle/);
  assert.match(source, /const minimumVerticalSpeed = speed \* MIN_VERTICAL_SPEED_RATIO/);
  assert.match(source, /Math\.sqrt\(Math\.max\(0, speed \* speed - minimumVerticalSpeed \* minimumVerticalSpeed\)\)/);
  assert.match(source, /ensureMinimumVerticalAngle\(ball, collision\.normalY\)/);
  assert.match(source, /ball\.vx = Math\.abs\(ball\.vx\); ensureMinimumVerticalAngle\(ball\)/);
  assert.match(source, /ball\.vy = -Math\.sqrt[\s\S]{0,180}ensureMinimumVerticalAngle\(ball, -1\)/);
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
  assert.match(source, /class-\$\{upgrade\.category\}/);
  assert.match(css, /\.upgrade-card\.class-warrior/);
  assert.match(css, /\.class-archer \.upgrade-icon/);
  assert.match(css, /\.class-mage \.upgrade-icon/);
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

test("uses stationary 4x3 bosses with reinforcement bricks", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const cols = 4;/);
  assert.match(source, /const rows = 3;/);
  assert.match(source, /const width = cols \* cellWidth;/);
  assert.match(source, /return \[\{/);
  assert.match(source, /CORE FORTRESS.*HP/);
  assert.match(source, /const fortressGlow = ctx\.createRadialGradient/);
  assert.match(source, /brick\.kind === "boss-core"/);
  assert.match(source, /FORTRESS ATTACK CHARGING/);
  assert.match(source, /brick\.kind === "boss-minion"/);
  assert.match(source, /BOSS SKILL \/\/ \$\{attack\.name\}/);
  ["SCATTER BOMB", "GUARD WINGS", "REFLECTOR GATE", "REPAIR CROSS", "BLAST MAZE"].forEach((name) => assert.match(source, new RegExp(name)));
  assert.match(source, /game\.bossAttackPattern\+\+/);
});

test("defines 20 fixed brick patterns with bosses at waves 10 and 20", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const waves = await readFile(new URL("../app/wave-config.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ MAX_WAVE, waveDefinition \}/);
  assert.match(source, /makeWaveBricks\(waveNumber/);
  assert.doesNotMatch(waves, /timeLimit|WAVE_TIME_LIMIT/);
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

test("opens side gaps in the wave 7 reflector wall", async () => {
  const waves = await readFile(new URL("../app/wave-config.ts", import.meta.url), "utf8");
  assert.match(waves, /wave\(7, "TWIN GATES"[^\n]+"rr\.\.nnnn\.\.rr"/);
  assert.doesNotMatch(waves, /"rrrrnnnnrrrr"/);
});

test("ends a wave only after every damageable brick is cleared", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const waveCleared = game\.bossActive/);
  assert.match(source, /completeWave\(wasBoss\)/);
  assert.match(source, /setMode\("bossreward"\)/);
  assert.match(source, /levelUp\(\);/);
  assert.doesNotMatch(source, /waveResolution|BLOCK SETTLEMENT/);
  assert.doesNotMatch(source, /const allSurvivors = game\.bricks\.filter/);
  assert.doesNotMatch(source, /BLOCK SETTLEMENT \/\/ \$\{survivors\.length\} THREATS/);
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
  assert.match(source, /function lateWaveHpMultiplier/);
  assert.match(source, /waveNumber >= 16 \? 2\.5 : waveNumber >= 11 \? 1\.9 : waveNumber >= 6 \? 1\.45/);
  assert.match(source, /const bossHpMultiplier = stage >= 2 \? 1\.8 : 1\.25/);
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

test("adds six stage brick traits with distinct combat rules and readable visual keys", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /type BrickTrait = "standard" \| "guard" \| "explosive" \| "indestructible" \| "healer" \| "reflector"/);
  assert.match(source, /const absorbGuardHit =/);
  assert.match(source, /GUARD \/\/ HIT NULLIFIED/);
  assert.match(source, /brick\.trait === "explosive"/);
  assert.match(source, /EXPLOSIVE \/\/ BALL LAUNCHED/);
  assert.match(source, /brick\.trait === "indestructible"/);
  assert.match(source, /healer\.healTimer = 3/);
  assert.match(source, /HEAL PULSE \/\/ \+1/);
  assert.match(source, /text: "\+1"/);
  assert.match(source, /emitEffect\("ring", target\.x \+ target\.w \/ 2, target\.y \+ target\.h \/ 2, "#72f1b8"/);
  assert.match(source, /brick\.trait === "reflector" && brick\.traitLockTime <= 0 && ball\.vy < 0/);
  assert.match(source, /const reflectorShieldPulse/);
  assert.match(source, /const reflectorThreatened = game\.balls\.some/);
  assert.match(source, /const reflectorScan/);
  assert.match(source, /const reflectorShieldGradient/);
  assert.match(source, /const traceBrickBody = \(brick: Brick/);
  assert.match(source, /ctx\.roundRect\(x, y, w, h/);
  assert.match(source, /if \(brick\.trait === "guard"\)/);
  assert.match(source, /if \(brick\.trait === "explosive"\)/);
  assert.match(source, /ctx\.quadraticCurveTo\(brick\.x \+ 4, reflectorLineY/);
  assert.match(source, /ctx\.lineWidth = reflectorThreatened \? 4 : 3/);
  assert.match(source, /const hpBaselineY = brick\.y \+ brick\.h \/ 2 \+ 6/);
  assert.match(source, /reflectorLineY/);
  assert.match(source, /const BRICK_TRAIT_DATA/);
  assert.match(source, /description: "첫 피격 1회 무시"/);
  assert.match(source, /description: "파괴 시 주변 피해 · 공 밀어냄"/);
  assert.match(source, /description: "3초마다 주변 체력 \+1"/);
  assert.match(source, /aria-label="특수 블록 기능 안내"/);
  assert.match(source, /traitData\.glyph/);
  assert.match(styles, /\.brick-key-strip/);
  assert.doesNotMatch(source, /"shield"/);
});

test("renders beam links and clears wave-scoped skill state", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(effect\.kind === "beam"\)/);
  assert.match(source, /const beamGradient = ctx\.createLinearGradient/);
  assert.match(source, /delete ball\.skillCharges\["archer-pierce"\]/);
  assert.match(source, /function clearBallEnchantments/);
  assert.match(source, /clearBallEnchantments\(ball, game\.upgrades\)/);
  assert.match(source, /function clearWaveScopedSkillState/);
  assert.match(source, /game\.balls\.forEach\(\(ball\) => clearBallEnchantments\(ball, game\.upgrades\)\)/);
  assert.match(source, /if \(!Array\.isArray\(upgrades\)\) return 0/);
  assert.match(source, /game\.paddleCounters\[id\] = newPaddleCounter\(\)/);
  assert.match(source, /game\.bossActive = false;\s+clearWaveScopedSkillState\(game\)/);
});

test("selects rewards before preparing the next wave and uses one animated transition path", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /"initialskills"/);
  assert.match(source, /STARTING SKILL/);
  assert.match(source, /selected\.length < 2/);
  assert.match(source, /game\.pendingWave = completedWave \+ 1/);
  assert.doesNotMatch(source, /startWave\(completedWave \+ 1\)/);
  assert.match(source, /const enterPendingWave = useCallback/);
  assert.match(source, /prepareWave\(game, nextWave/);
  assert.match(source, /setMode\("transition"\)/);
  assert.match(source, /className="wave-transition-overlay"/);
  assert.match(styles, /@keyframes wave-scene-fade/);
  assert.match(source, /setMode\("bossreward"\)/);
  assert.match(source, /if \(botActiveRef\.current\) \{\s+startNextWave\(\)/);
  assert.match(source, /if \(resume\) \{\s+enterPendingWave\(game\)/);
  assert.match(source, /const skipUpgradeChoice = useCallback[\s\S]*if \(game\) enterPendingWave\(game\)/);
  assert.match(source, /const applyBossReward = useCallback[\s\S]*enterPendingWave\(game\)/);
});

test("animates wave clear before rewards without delaying bots or the final result", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /"waveclear"/);
  assert.match(source, /if \(game\.pendingWave !== null \|\| rewardOpeningRef\.current\) return/);
  assert.match(source, /setClearedWave\(\{ wave: completedWave, boss: wasBoss \}\);\s+setMode\("waveclear"\)/);
  assert.match(source, /transitionTimersRef\.current = \[window\.setTimeout\(openReward, 720\)\]/);
  assert.match(source, /if \(botActiveRef\.current\) \{\s+openReward\(\);\s+return/);
  assert.match(source, /const openReward = \(\) => \{[\s\S]*setMode\("bossreward"\)[\s\S]*levelUp\(\)/);
  assert.match(source, /skillBenchConfigRef\.current\.environment === "ecosystem"\)[\s\S]*applyBossReward[\s\S]*else \{\s+enterPendingWave\(game\)/);
  assert.match(source, /if \(completedWave >= MAX_WAVE\) \{[\s\S]*finishRun\(\);\s+return;\s+}\s+game\.pendingWave = completedWave \+ 1/);
  assert.match(source, /className=\{`wave-clear-overlay/);
  assert.match(styles, /@keyframes wave-clear-left/);
  assert.match(styles, /@keyframes wave-clear-right/);
  assert.match(styles, /@keyframes wave-shutter-top/);
  assert.match(styles, /@keyframes wave-shutter-bottom/);
  assert.match(source, /const backToLobby = \(\) => \{\s+transitionTimersRef\.current\.forEach/);
  assert.match(source, /rewardOpeningRef\.current = false/);
});

test("respawns a ball at the cost of one core health", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /game\.coreHp = Math\.max\(0, game\.coreHp - 1\);/);
  assert.match(source, /const respawnBall = makePlayerBall\(game\.upgrades, game\.paddleX\);/);
  assert.match(source, /game\.balls\.push\(respawnBall\);/);
  assert.match(source, /BALL LOST \/\/ CORE -1 \/\/ RESPAWN/);
});

test("uses clear-driven waves without a time limit and keeps skill-specific combat effects", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const STARTING_WAVE_ELAPSED = 0;/);
  assert.match(source, /game\.rowTimer \+= dt/);
  assert.match(source, /game\.rowInterval = 0/);
  assert.doesNotMatch(source, /const timeRemaining = game\.bossActive/);
  assert.match(source, /game\.bricks\.every\(\(brick\) => !brick\.alive \|\| brick\.trait === "indestructible"\)/);
  assert.match(source, /type GameEffect =/);
  assert.match(source, /HORIZONTAL ENCHANT/);
  assert.match(source, /emitEffect\("beam"/);
  assert.match(source, /drawMagnetLinks/);
});

test("propagates paddle debuffs and reports barriers in the in-game HUD", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /blastVulnerability/);
  assert.match(source, /applyDebuffs\(near, sourcePaddle\)/);
  assert.match(source, /applyDebuffs\(linked, sourcePaddle\)/);
  assert.match(source, /applyDebuffs\(brick, sourcePaddle\)/);
  assert.match(source, /emitEffect\("blast"/);
  assert.match(source, /barriers: game\.paddleBarriers\.player/);
  assert.match(source, /hud-badge hud-core/);
  assert.match(source, /className="core-meter"/);
  assert.match(source, /mode === "lobby" \|\| mode === "initialskills"/);
  assert.match(source, /SHIELD ×\{hud\.barriers\}/);
  assert.doesNotMatch(source, /barrierSummary|CORE LINE/);
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
  assert.match(source, /const activeClassCharges = ballCooldownEntries/);
  assert.match(source, /const SKILL_ICONS/);
  assert.match(source, /const drawSkillPanel/);
  assert.match(source, /ATK/);
  assert.match(source, /SHIELD ×\{hud\.barriers\}/);
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

test("resets every wave to exactly one base ball above the paddle", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /ball\.y = PLAYER_PADDLE_Y - ball\.radius - 3/);
  assert.match(source, /ball\.vy = -Math\.sqrt/);
  assert.match(source, /function prepareWave/);
  assert.match(source, /game\.balls = \[makePlayerBall\(game\.upgrades, game\.paddleX\)\]/);
  assert.match(source, /function parkBallsAbovePaddle\(game: GameState, targetX = W \/ 2, targetY = H \/ 3\)/);
  assert.match(source, /parkBallsAbovePaddle\(game, targetX, targetY\)/);
  assert.match(source, /if \(resume\) \{\s+enterPendingWave\(game\)/);
  assert.match(source, /if \(game\) enterPendingWave\(game\)/);
  assert.doesNotMatch(source, /while \(game\.balls\.length < game\.wave\)/);
});

test("renders item multiballs gray and removes them after the wave", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const WAVE_MULTIBALL_COLOR = "#9aa3b2"/);
  assert.match(source, /waveBonus: boolean/);
  assert.match(source, /waveBonus: true/);
  assert.match(source, /ball\.temporaryTime > 0 \|\| ball\.visualSkill !== null \? WAVE_MULTIBALL_COLOR/);
  assert.match(source, /const drawColor = ballBodyColor\(ball\)/);
  assert.match(source, /lostBaseBall/);
});

test("runs a no-ghost playtest bot and persists balance metrics", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const balanceConfig = await readFile(new URL("../app/balance-config.ts", import.meta.url), "utf8");
  assert.match(source, /const activeGhosts: GhostRecord\[\] = \[\]/);
  assert.match(source, /function chooseBotUpgrade/);
  assert.match(source, /function chooseBotAimTarget/);
  assert.match(source, /function botAimPoint/);
  assert.match(source, /botActiveRef\.current/);
  assert.match(source, /game\.botMetrics\.maxBalls/);
  assert.match(source, /game\.botMetrics\.ballLosses/);
  assert.match(source, /game\.botMetrics\.missileActivations/);
  assert.match(source, /game\.botMetrics\.safetySaves/);
  assert.match(source, /game\.botMetrics\.gravityRescues/);
  assert.match(source, /startingSkills: game\.skillHistory/);
  assert.match(source, /skillHistory: game\.skillHistory\.map/);
  assert.match(source, /skillMetrics: Object\.fromEntries/);
  assert.match(source, /source: "start"/);
  assert.match(source, /source: "boss"/);
  assert.match(source, /recordSkillImpact/);
  assert.match(balanceConfig, /echo-breaker-bot-results-v1/);
  assert.match(source, /recordBotWaveSample/);
  assert.match(source, /waveSamples: botSkillBenchVariantRef\.current \? \[\] : \[\.\.\.game\.botWaveSamples\]/);
  assert.match(source, /EXPORT JSON/);
});

test("aims the visible benchmark bot at live hittable bricks independently of paddle interception", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(!brick\.alive \|\| !isDamageableBrick\(brick\)\) return false/);
  assert.match(source, /brick\.trait === "reflector"[\s\S]*brick\.traitLockTime <= 0[\s\S]*originY > brick\.y \+ brick\.h/);
  assert.match(source, /const aimPoint = botAimPoint\(game\.bricks, game\.paddleX, PLAYER_PADDLE_Y, Math\.floor\(game\.rowTimer \/ BOT_REFLECTOR_AIM_PHASE_SECONDS\)\)/);
  assert.match(source, /pointerXRef\.current = aimPoint\.x;\s*pointerYRef\.current = aimPoint\.y/);
  assert.match(source, /botPaddleTargetXRef\.current = predictedX/);
  assert.match(source, /game\.paddleX \+= \(botPaddleTargetXRef\.current - game\.paddleX\)/);
  assert.match(source, /const aim = paddleAimDirection\(contactX, paddle\.y, pointerXRef\.current, pointerYRef\.current\)/);
  assert.match(source, /if \(asBot\) parkBallsAbovePaddle\(game, openingAim\.x, openingAim\.y\)/);
  assert.doesNotMatch(source, /pointerXRef\.current = predictedX/);
});

test("banks around protected reflector undersides and rotates weak-side attempts", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const BOT_REFLECTOR_AIM_PHASE_SECONDS = 4/);
  assert.match(source, /function protectedReflectorBlockingAim/);
  assert.match(source, /const contactTime = \(protectedFaceY - originY\) \/ verticalTravel/);
  assert.match(source, /contactX >= brick\.x - 8 && contactX <= brick\.x \+ brick\.w \+ 8/);
  assert.match(source, /function reflectorWeakSideBankAim/);
  assert.match(source, /mirroredTargetX = wallX === 0 \? -weakSideX : W \* 2 - weakSideX/);
  assert.match(source, /constraintPenalty: Math\.max\(0, horizontalRatio - MAX_PADDLE_REBOUND_RATIO\)/);
  assert.match(source, /const reflector = reflectors\[Math\.floor\(phase \/ 2\) % reflectors\.length\]/);
  assert.match(source, /Math\.floor\(game\.rowTimer \/ BOT_REFLECTOR_AIM_PHASE_SECONDS\)/);
  assert.doesNotMatch(source, /leftGap >= rightGap/);
});

test("runs benchmark telemetry through a parallel headless worker pool", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/benchmark/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/benchmark-config.ts", import.meta.url), "utf8");
  const engine = await readFile(new URL("../app/benchmark-headless.ts", import.meta.url), "utf8");
  const worker = await readFile(new URL("../app/benchmark-worker.ts", import.meta.url), "utf8");
  const store = await readFile(new URL("../app/benchmark-result-store.ts", import.meta.url), "utf8");
  assert.match(source, /balanceConfigRef\.current/);
  assert.match(source, /BALANCE_STORAGE_KEY/);
  assert.match(lab, /<GameRuntime benchmarkMode \/>/);
  assert.doesNotMatch(lab, /BalanceSimulator|SkillBench|BenchmarkSetup/);
  assert.match(source, /new Worker\(new URL\("\.\/benchmark-worker\.ts", import\.meta\.url\)/);
  assert.match(source, /navigator\.hardwareConcurrency/);
  assert.match(source, /Math\.min\(8, targetRuns/);
  assert.match(source, /worker\.terminate\(\)/);
  assert.match(engine, /waveDefinition\(wave\)/);
  assert.match(engine, /request\.skills\?\.length \? request\.skills : DEFAULT_SKILLS/);
  assert.match(worker, /runHeadlessBenchmark\(event\.data\)/);
  assert.match(source, /updateBenchmarkRuns/);
  assert.match(source, /\[3, 5, 10, 20, 100, 500, 1000\]/);
  assert.match(config, /runs: 3 \| 5 \| 10 \| 20 \| 100 \| 500 \| 1000/);
  assert.match(config, /runs === 1000/);
  assert.match(source, /completed % 25 === 0/);
  assert.match(source, /putBenchmarkResults\(batch\)/);
  assert.match(source, /getBenchmarkResults<BotRunResult>/);
  assert.match(store, /indexedDB\.open/);
  assert.match(store, /createObjectStore\(RUN_STORE, \{ keyPath: "id" \}\)/);
});

test("offers a visible real-physics watch run beside the headless benchmark", async () => {
  const response = await render("/benchmark");
  const html = await response.text();
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(html, /WATCH RUN/);
  assert.match(html, /실제 화면 관찰/);
  assert.match(source, /type BenchmarkRunMode = "parallel" \| "watch"/);
  assert.match(source, /benchmarkRunMode === "watch"/);
  assert.match(source, /WATCH RUN START/);
  assert.match(source, /\[1, 2, 4, 8\]\.map/);
  assert.match(source, /benchmarkWatchRef\.current \? "watch-v1" : BENCHMARK_RULESET/);
  assert.match(source, /const targetRuns = .*benchmarkMode \? 1 : botTargetRuns/);
  assert.match(source, /LIVE BOT · \{botSpeed\}× · W\{hud\.wave\}/);
  assert.match(styles, /\.benchmark-mode-switch/);
  assert.match(styles, /\.watch-run-badge/);
});

test("finishes bot evaluations at the wave 20 final boss", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const BOT_EVALUATION_WAVE = MAX_WAVE/);
  assert.match(source, /completedWave >= MAX_WAVE/);
  assert.match(source, /evaluationComplete: game\.wave >= \(benchmarkMode \? benchmarkConfigRef\.current\.targetWave : BOT_EVALUATION_WAVE\)/);
  assert.match(source, /TARGET W\$\{benchmarkConfig\.targetWave\}/);
  assert.match(source, /BENCHMARK START/);
});

test("runs the benchmark with the complete live-game ruleset", async () => {
  const response = await render("/benchmark");
  assert.equal(response.status, 200);
  const html = await response.text();
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/benchmark-config.ts", import.meta.url), "utf8");
  assert.match(html, /CORE BREAKER BENCH/);
  assert.match(config, /stage: 5/);
  assert.match(config, /pressure: true/);
  assert.match(config, /items: true/);
  assert.match(config, /brickTypes: true/);
  assert.match(config, /skills: true/);
  assert.match(config, /bosses: true/);
  assert.match(source, /benchmarkMode && <aside className="ghost-panel">/);
  assert.doesNotMatch(source, /if \(!activeBenchmark\./);
  assert.match(source, /botSkillBenchActiveRef\.current = !benchmarkMode/);
});

test("renders live benchmark KPIs, wave charts, and per-run data", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /benchmarkWaveStats = Array\.from\(\{ length: MAX_WAVE \}/);
  assert.match(source, /웨이브별 도달률 그래프/);
  assert.match(source, /웨이브별 평균 코어 체력 그래프/);
  assert.match(source, /benchmarkCompletionRate/);
  assert.match(source, /benchmark-data-table/);
  assert.match(source, /benchmarkSkillStats/);
  assert.match(source, /benchmark-skill-table/);
  assert.match(source, /스킬별 벤치마크 성과/);
  assert.match(source, /item\.startingSkills\.map/);
  assert.match(source, /const BENCHMARK_RULESET: BenchmarkRuleset = PARALLEL_BENCHMARK_RULESET/);
  assert.match(source, /benchmarkRuleset === BENCHMARK_RULESET/);
  assert.match(styles, /\.benchmark-dashboard/);
  assert.match(styles, /\.benchmark-charts/);
  assert.match(styles, /\.benchmark-skill-table/);
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

test("keeps fixed-step acceleration for the legacy skill benchmark runner", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /type BotSpeed = 1 \| 2 \| 4 \| 8/);
  assert.match(source, /const steps = botActiveRef\.current \? botSpeedRef\.current : 1/);
  assert.match(source, /for \(let step = 0; step < steps && runningRef\.current; step\+\+\) updateGame\(dt\)/);
  assert.match(source, /speed: botSpeedRef\.current/);
  assert.match(source, /botSpeedRef\.current = botSpeed/);
  assert.match(source, /CPU 자동 · 최대 8/);
});

test("keeps safety blocks until they reflect a ball", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /block\.life -= dt/);
  assert.doesNotMatch(source, /block\.life > 0 && ball\.y/);
  assert.match(source, /game\.safetyBlocks = game\.safetyBlocks\.filter\(\(block\) => block !== safetyBlock\)/);
});

test("removes the neutral floor and spends core health when the base ball falls", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /BALL_FLOOR_Y|NEUTRAL FLOOR|neutralFloor/);
  assert.match(source, /if \(ball\.y - ball\.radius > H\)/);
  assert.match(source, /const lostBaseBall =/);
  assert.match(source, /game\.coreHp = Math\.max\(0, game\.coreHp - 1\)/);
  assert.match(source, /BALL LOST \/\/ CORE -1 \/\/ RESPAWN/);
});

test("keeps the faster base ball speed for the one-ball ruleset", async () => {
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

test("keeps fixed multiball budgets and adds utility item drops", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const NORMAL_STAGE_MULTIBALL_WAVES = \[2, 4, 6, 8, 11, 13, 16, 18\]/);
  assert.match(source, /const BOSS_MULTIBALL_BUDGET = 2/);
  assert.match(source, /function hasScheduledMultiball/);
  assert.match(source, /col === multiballColumn \? "multiball" : pickBrickDrop\(\)/);
  assert.match(source, /index < forcedMultiballs \? "multiball"/);
  assert.match(source, /game\.bossMultiballsRemaining = game\.bossActive \? BOSS_MULTIBALL_BUDGET : 0/);
  const randomDrop = source.slice(source.indexOf("function pickBrickDrop"), source.indexOf("function hasScheduledMultiball"));
  assert.match(randomDrop, /environmentRandom\(\) >= 0\.055/);
  assert.match(randomDrop, /\["auto-barrier", "core-repair", "cooldown-reset"\]/);
  assert.match(source, /type ItemKind = "multiball" \| "auto-barrier" \| "core-repair" \| "cooldown-reset"/);
  assert.match(source, /AUTO BARRIER/);
  assert.match(source, /CORE REPAIR/);
  assert.match(source, /COOLDOWN RESET/);
});

test("renders the warrior archer mage Skill Lab", async () => {
  const response = await render("/skill-lab");
  const source = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/skill-lab/skill-lab.module.css", import.meta.url), "utf8");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /SKILL LAB/);
  ["전사", "궁수", "법사", "일반 스킬", "보스 궁극기"].forEach((label) => {
    assert.match(html, new RegExp(label));
  });
  assert.match(source, /CATEGORY_ICONS/);
  assert.match(source, /data-category=\{skill\.category\}/);
  assert.match(styles, /\.skillCard\[data-category="warrior"\]/);
});

test("defines all class skills as permanent ball-owned skills without ball costs", async () => {
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const names = ["강타", "충격파", "처형", "분쇄", "철벽", "대지 분쇄", "광전사", "연사", "관통 화살", "도탄 화살", "집중 사격", "약점 사격", "화살비", "무한 탄창", "화염구", "연쇄 번개", "빙결 표식", "블랙홀", "마력 봉인", "원소 폭풍", "메테오"];
  names.forEach((name) => assert.match(config, new RegExp(`"${name}"`)));
  assert.match(config, /export const NORMAL_SKILLS/);
  assert.match(config, /export const ULTIMATE_SKILLS/);
  assert.match(config, /owner: "ball"/);
  assert.match(config, /블록 타격 시 상시 적용/);
  assert.match(config, /ballCost: 0/);
  assert.doesNotMatch(config, /ballCost: [12]/);
});

test("applies class skills from brick hits and grants ultimates after bosses", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const smashLevel = availableBallSkillLevel\("warrior-smash"\)/);
  assert.match(source, /const ricochetLevel = availableBallSkillLevel\("archer-ricochet"\)/);
  assert.match(source, /const fireballLevel = availableBallSkillLevel\("mage-fireball"\)/);
  assert.match(source, /const activateHitSkill =/);
  assert.match(source, /activateHitSkill\("archer-rapid"/);
  assert.match(source, /activateHitSkill\("mage-black-hole"/);
  assert.match(source, /game\.upgrades\.push\(rewardId\)/);
  assert.match(source, /ULTIMATE ACQUIRED/);
  assert.match(source, /ultimateCatalog\.map/);
  assert.doesNotMatch(source, /activeSkillMap\[upgrade\.id\]\.ballCost/);
});

test("gates temporary-arrow skill inheritance behind rapid level three while allowing paced recursion", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  assert.match(source, /canTriggerSkills: boolean/);
  assert.match(source, /const inheritsSkills = rapidLevel >= 3/);
  assert.match(source, /canTriggerSkills: inheritsSkills/);
  assert.match(source, /skillGeneration: number/);
  assert.match(source, /1 \+ skillGeneration \* 0\.5/);
  assert.match(source, /id === "archer-rapid" \|\| id === "archer-infinite"/);
  assert.match(source, /const ballsAtFrameStart = \[\.\.\.game\.balls\]/);
  assert.match(config, /"archer-rapid": \[3\.8, 3\.4, 3\]/);
  assert.match(config, /"archer-infinite": \[8, 7, 5\.5\]/);
  assert.match(config, /SKILL_EVOLUTIONS\["archer-rapid"\]/);
});

test("reuses bounded particle and effect slots during recursive arrow storms", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const MAX_ACTIVE_PARTICLES = 500/);
  assert.match(source, /const MAX_ACTIVE_EFFECTS = 240/);
  assert.match(source, /function pushPooledParticle/);
  assert.match(source, /function pushPooledEffect/);
  assert.match(source, /const particle = game\.particles\[index\]/);
  assert.match(source, /const effect = game\.effects\[index\]/);
  assert.match(source, /game\.particlePool\.push\(particle\)/);
  assert.match(source, /game\.effectPool\.push\(effect\)/);
});

test("shows emphasized damage numbers and resets hit combos on paddle return", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  assert.match(source, /emphasis\?: "damage"/);
  assert.match(source, /const brickHpAtFrameStart = new Map/);
  assert.match(source, /text: `-\$\{roundedDamage\}`/);
  assert.match(source, /ctx\.strokeText\(f\.text, 0, 0\)/);
  assert.match(source, /const registerBrickComboHit = \(ball: Ball\)/);
  assert.match(source, /registerBrickComboHit\(ball\)/);
  assert.match(source, /ball\.sourcePaddleId = paddle\.id;[\s\S]*?game\.combo = 0;/);
  assert.doesNotMatch(source, /if \(game\.comboTimer <= 0 && game\.combo > 0\) game\.combo = 0/);
  assert.match(config, /"common-combo", "콤보 증폭", "콤보당 점수 증가"/);
});

test("lets balls pass through black-hole centers and restores their entry speed", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /gravityBaseSpeed: number \| null/);
  assert.match(source, /ball\.gravityBaseSpeed \?\?= Math\.max\(1, Math\.hypot\(ball\.vx, ball\.vy\)\)/);
  assert.match(source, /const gravitySpeedRatio = 0\.58 \+ 0\.42 \* deepestRatio/);
  assert.match(source, /ball\.vx \*= ball\.gravityBaseSpeed \/ affectedSpeed/);
  assert.match(source, /ball\.gravityBaseSpeed = null/);
  assert.doesNotMatch(source, /ball\.y = Math\.min\(ball\.y, well\.y \+ 14\)/);
  assert.doesNotMatch(source, /ball\.vy = -Math\.max\(230, Math\.abs\(ball\.vy\)\)/);
});

test("separates impact shockwave damage from fireball damage over time", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const skills = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const benchmark = await readFile(new URL("../app/benchmark-headless.ts", import.meta.url), "utf8");
  assert.match(skills, /"warrior-shockwave"[\s\S]*"주변 즉발 피해"/);
  assert.match(skills, /"mage-fireball"[\s\S]*"주변 점화 · 회복 차단"/);
  assert.match(skills, /legacyDestructionTrigger/);
  assert.match(source, /triggerImpactShockwave\(brick, ball, shockwaveLevel\)/);
  assert.match(source, /igniteFireballArea\(brick, sourcePaddle\.id, fireballLevel\)/);
  assert.match(source, /emitEffect\("beam", centerX, centerY, classSkillColor\("warrior-shockwave"\)/);
  assert.match(source, /text: `충격 -\$\{Math\.max\(1, Math\.round\(appliedDamage\)\)\}`/);
  assert.match(source, /text: `충격파 \/\/ \$\{hitCount\} HIT · CHAIN ×\$\{waveCount\}`/);
  assert.match(source, /emitEffect\("beam", centerX, centerY, classSkillColor\("mage-fireball"\)/);
  assert.match(source, /text: `점화 \$\{2 \+ level\}초`/);
  assert.match(source, /text: `화염구 \/\/ \$\{ignited\}개 점화`/);
  assert.match(source, /near\.burnTime = Math\.max\(near\.burnTime, 2 \+ level\)/);
  assert.match(source, /recordSkillImpact\("mage-fireball"/);
  assert.match(source, /BURN \$\{Math\.max\(0, Math\.ceil\(brick\.burnTime\)\)\}s/);
  assert.match(benchmark, /PARALLEL_BENCHMARK_RULESET = "parallel-v9"/);
  assert.match(benchmark, /skill\.id === "warrior-shockwave"/);
  assert.match(benchmark, /skill\.id === "mage-fireball"/);
});

test("removes reflection counters and keeps permanent skill icons on the paddle", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const COUNTED_SKILL_IDS: UpgradeId\[\] = \[\]/);
  assert.match(source, /const drawSkillPanel =/);
  assert.match(source, /스킬은 공마다 독립 쿨타임으로 발동/);
  assert.doesNotMatch(source, /paddleCounter\.chargePulse = 1\.2/);
  assert.doesNotMatch(source, /paddleCounter\.skillReflections\[id\]/);
});

test("expires temporary arrows by time and renders per-skill visual feedback away from the paddle", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  assert.match(source, /temporaryTime: number/);
  assert.match(source, /ball\.temporaryTime = Math\.max\(0, ball\.temporaryTime - dt\)/);
  assert.doesNotMatch(source, /temporaryHits/);
  assert.match(source, /const COUNTED_SKILL_IDS: UpgradeId\[\] = \[\]/);
  assert.match(source, /const impactClassSkills =/);
  assert.match(source, /classSkillColor\(id\)/);
  assert.match(config, /export const SKILL_COLORS/);
  assert.match(lab, /const skillStyle =/);
});

test("adds common utility skills to gameplay, Skill Lab, and skill benchmarks", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  const bench = await readFile(new URL("../app/skill-lab/skill-bench.tsx", import.meta.url), "utf8");
  ["common-magnet", "common-luck", "common-wide", "common-move-speed", "common-xp", "common-combo", "common-ball-size", "common-skill-range", "common-chain", "common-damage", "common-cooldown"].forEach((id) => assert.match(config, new RegExp(`"${id}"`)));
  assert.match(config, /passiveSkill\("common-xp", "코어 강화", "CORE 최대 체력 증가"/);
  assert.match(source, /if \(upgrade\.id === "common-xp"\)/);
  assert.match(source, /game\.maxCoreHp \+= coreGain/);
  assert.match(source, /skillValue\("common-magnet"/);
  assert.match(source, /skillValue\("common-luck"/);
  assert.match(source, /skillValue\("common-wide"/);
  assert.match(source, /skillValue\("common-move-speed"/);
  assert.match(source, /skillValue\("common-combo"/);
  assert.match(source, /commonSkillRangeMultiplier/);
  assert.match(source, /commonChainBonus/);
  assert.match(source, /8 \+ skillValue\("common-ball-size"/);
  assert.match(source, /1 \+ commonDamage/);
  assert.match(lab, /common: "공용"/);
  assert.match(bench, /common: "공용"/);
});

test("uses neutral common colors and highlights explicit skill values", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const globalCss = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  const labCss = await readFile(new URL("../app/skill-lab/skill-lab.module.css", import.meta.url), "utf8");
  const commonColors = [...config.matchAll(/"common-[^"]+": "(#[0-9a-f]+)"/g)].map((match) => match[1]);
  assert.equal(commonColors.length, 11);
  assert.ok(commonColors.every((color) => color === "#9aa3b2"));
  assert.match(source, /common: \{ tag: "COMMON", color: "#9aa3b2" \}/);
  assert.match(lab, /common: "#9aa3b2"/);
  assert.match(config, /"스킬의 적용 범위가 10\/20\/30% 증가합니다\."/);
  assert.match(config, /"스킬의 연계 횟수가 1\/2\/3회 증가합니다\."/);
  assert.match(config, /"공의 최종 반경이 9\/10\/11px로 증가합니다\."/);
  assert.match(config, /"공의 기본 직접 피해가 2\/3\/4로 증가합니다\."/);
  assert.match(config, /"모든 공의 스킬 쿨타임이 10\/20\/30% 감소합니다\."/);
  assert.doesNotMatch(config, /"[^"]*(?:LV만큼|LV\+1|2\+LV|레벨에 따라)[^"]*", \[/);
  assert.match(source, /function SkillDescriptionText/);
  assert.match(source, /className=.*skill-value-accent/);
  assert.match(globalCss, /\.skill-value-accent/);
  assert.match(lab, /styles\.valueAccent/);
  assert.match(labCss, /\.valueAccent/);
});

test("tracks independent per-ball skill cooldowns and applies common cooldown reduction", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  assert.match(source, /skillCooldowns: Partial<Record<ClassSkillId, number>>/);
  assert.match(source, /ball\.skillCooldowns\[skillId\] = Math\.max\(0/);
  assert.match(source, /const cooldown = skillCooldownSeconds/);
  assert.match(source, /skillValue\("common-cooldown"/);
  assert.match(config, /export const SKILL_COOLDOWNS/);
  assert.match(config, /passiveSkill\("common-cooldown", "재사용 가속"/);
  assert.match(lab, /공별 독립 쿨타임/);
  assert.match(lab, /updateCooldown/);
});

test("shows ball skill effects only while each per-ball cooldown is ready", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const ballCooldownEntries = \(ball\.canTriggerSkills \? \[\.\.\.new Set\(game\.upgrades\)\] : \[\]\)/);
  assert.match(source, /filter\(\(entry\) => entry\.remaining <= 0\)/);
  assert.doesNotMatch(source, /activeSkillEffects/);
});

test("renders segmented per-ball cooldown gauges and a numeric timer on the base ball", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const coolingSkills = ballCooldownEntries\.filter/);
  assert.match(source, /const progress = Math\.max\(0, Math\.min\(1, 1 - entry\.remaining \/ entry\.total\)\)/);
  assert.match(source, /nextReady\.remaining\.toFixed\(1\)/);
  assert.match(source, /!ball\.waveBonus && ball\.temporaryTime <= 0/);
});

test("keeps extra-ball skill readiness visible at reduced intensity", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const isExtraBall = ball\.waveBonus \|\| ball\.temporaryTime > 0 \|\| ball\.visualSkill !== null/);
  assert.match(source, /const skillEffectAlpha = isExtraBall \? 0\.38 : 1/);
  assert.match(source, /const cooldownGaugeAlpha = isExtraBall \? 0\.5 : 1/);
  assert.match(source, /0\.92 \* skillEffectAlpha/);
  assert.match(source, /0\.95 \* cooldownGaugeAlpha/);
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

test("renders CC0 fireball and magic spark strips on charged mage balls", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const license = await readFile(new URL("../docs/THIRD_PARTY_ASSETS.md", import.meta.url), "utf8");
  assert.match(source, /MAGE_SPELL_ASSETS = \["\/assets\/vfx\/mage-fireball\.png", "\/assets\/vfx\/mage-sparks\.png"\]/);
  assert.match(source, /MAGE_SPELL_FRAMES = 6/);
  assert.match(source, /id === "mage-fireball" \? 0 : id === "mage-lightning" \? 1/);
  assert.match(source, /ctx\.rotate\(Math\.atan2\(ball\.vy, ball\.vx\)\)/);
  assert.match(source, /mageSpellReadyRef\.current\[mageSpellVariant\]/);
  assert.match(license, /Pixel Art Spells/);
  assert.match(license, /DevWizard/);
});

test("gives every warrior skill a distinct charged or field signature", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /kind: "ring" \| "beam" \| "blast" \| "drop" \| "spark" \| "lightning" \| "skill"/);
  assert.match(source, /skillId: ClassSkillId \| null/);
  assert.match(source, /emitSkillEffect\("warrior-guard"/);
  assert.match(source, /emitSkillEffect\("warrior-earthquake"/);
  assert.match(source, /emitSkillEffect\("warrior-berserker"/);
  ["warrior-smash", "warrior-shockwave", "warrior-execute", "warrior-crush", "warrior-guard", "warrior-earthquake", "warrior-berserker"].forEach((id) => {
    assert.match(source, new RegExp(`effect\\.skillId === "${id}"|id === "${id}"`));
  });
  assert.match(source, /ctx\.arc\(0, 0, visualRadius \+ 3 \+ pulse/);
  assert.match(source, /ctx\.fillRect\(-3\.5, -3\.5, 7, 7\)/);
  assert.match(source, /const distance = reach \* \(0\.25 \+ progress \* 0\.5\)/);
});

test("gives every archer skill a distinct projectile or targeting signature", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /emitSkillEffect\("archer-rapid"/);
  assert.match(source, /emitSkillEffect\("archer-arrow-rain"/);
  assert.match(source, /emitSkillEffect\("archer-infinite"/);
  ["archer-rapid", "archer-pierce", "archer-ricochet", "archer-focus", "archer-weakpoint", "archer-arrow-rain", "archer-infinite"].forEach((id) => {
    assert.match(source, new RegExp(`effect\\.skillId === "${id}"|id === "${id}"`));
  });
  assert.match(source, /const fall = \(PLAYER_LINE_Y - BRICK_ROW_Y\) \* progress/);
  assert.match(source, /const denominator = 1 \+ Math\.sin\(t\) \*\* 2/);
  assert.match(source, /ctx\.arc\(0, 0, reticle/);
  assert.match(source, /const points = \[\[-length \* 0\.25/);
});

test("gives every mage skill a distinct elemental field signature", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  assert.match(source, /emitSkillEffect\("mage-freeze"/);
  assert.match(source, /emitSkillEffect\("mage-black-hole"/);
  assert.match(source, /emitSkillEffect\("mage-mana-blast"/);
  assert.match(source, /emitSkillEffect\("mage-elemental-storm"/);
  assert.match(source, /emitSkillEffect\("mage-meteor"/);
  ["mage-fireball", "mage-lightning", "mage-freeze", "mage-black-hole", "mage-mana-blast", "mage-elemental-storm", "mage-meteor"].forEach((id) => {
    assert.match(source, new RegExp(`effect\\.skillId === "${id}"|id === "${id}"`));
  });
  assert.match(source, /ctx\.fillStyle = "#fff7dc"/);
  assert.match(source, /const stormColors = \["#ff7043", "#a78bfa", "#65dcff"\]/);
  assert.match(source, /const destinationY = effect\.y2 - effect\.y/);
  assert.match(source, /const radius = effect\.size \* 0\.035 \* t/);
  assert.match(source, /const frozenTargets = game\.bricks/);
  assert.match(source, /target\.frostVulnerability = Math\.max/);
  assert.match(source, /const frostDamage = brick\.frostVulnerability/);
  assert.match(source, /빙결 파쇄/);
  assert.doesNotMatch(source, /freezeTimer/);
  assert.match(config, /"빙결 표식"/);
  assert.match(config, /회복·반사 봉인 · 다음 피격 강화/);
  assert.match(config, /const legacyTimeFreeze/);
});

test("classifies skills by both hero class and combat mechanic", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  assert.match(config, /type SkillMechanic = "impact" \| "chain" \| "control" \| "summon" \| "defense" \| "passive" \| "ultimate"/);
  ["타격", "연쇄", "제어", "소환", "방어", "지속", "궁극"].forEach((label) => assert.match(config, new RegExp(`"${label}"`)));
  assert.match(source, /SKILL_MECHANIC_LABELS\[skill\.mechanic\]/);
  assert.match(source, /const readyCategories = \[\.\.\.new Set\(activeClassCharges/);
  assert.match(source, /category === "warrior"/);
  assert.match(source, /category === "archer"/);
  assert.match(source, /category === "mage"/);
  assert.match(lab, /mechanicFilter/);
  assert.match(lab, /aria-label="스킬 작동 방식 필터"/);
  assert.match(config, /mechanic: base\.mechanic/);
});

test("connects control and chain skills to special brick traits", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /target\.burnTime > 0/);
  assert.match(source, /target\.trait === "healer" \|\| target\.trait === "reflector"/);
  assert.match(source, /target\.traitLockTime = Math\.max/);
  assert.match(source, /healer\.traitLockTime > 0/);
  assert.match(source, /target\.trait === "guard" \|\| target\.trait === "healer" \|\| target\.trait === "reflector"/);
  assert.match(source, /LOCK \$\{Math\.ceil\(brick\.traitLockTime\)\}s/);
  assert.match(source, /const ricochetPriority =/);
  assert.match(source, /target\.trait === "healer" \? 0/);
});

test("evolves every normal class skill at level three", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  assert.match(config, /export const SKILL_EVOLUTIONS/);
  ["warrior-smash", "warrior-shockwave", "warrior-execute", "warrior-crush", "warrior-guard", "archer-rapid", "archer-pierce", "archer-ricochet", "archer-focus", "archer-weakpoint", "mage-fireball", "mage-lightning", "mage-freeze", "mage-black-hole", "mage-mana-blast"].forEach((id) => assert.match(config, new RegExp(`"${id}"`)));
  assert.match(source, /LV3 EVOLUTION/);
  assert.match(source, /currentLevel === 2 && config!\.evolution/);
  assert.doesNotMatch(source, /config\.evolution && <p className="upgrade-evolution"/);
  assert.match(source, /const waveQueue: Brick\[\] = \[origin\]/);
  assert.match(source, /const evolvedChain = Math\.max\(ricochetLevel, lightningLevel\) >= 3/);
  assert.match(source, /upgradeLevel\(firePaddle\.upgrades, "mage-fireball"\) >= 3/);
  assert.match(source, /skillValue\("archer-weakpoint", weakpointLevel\)/);
  assert.match(source, /skillValue\("warrior-execute", executeLevel\) \/ 100/);
  assert.match(source, /skillValue\("mage-black-hole", level\)/);
  assert.match(lab, /LV3 진화 규칙/);
});

test("limits freeze visuals to marked bricks", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /emitSkillEffect\("mage-freeze", targetX, targetY/);
  assert.doesNotMatch(source, /emitSkillEffect\("mage-freeze", W \/ 2, BRICK_ROW_Y/);
  assert.match(source, /if \(brick\.frostVulnerability > 0\)/);
});

test("turns ultimates into build amplifiers", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const benchmark = await readFile(new URL("../app/benchmark-headless.ts", import.meta.url), "utf8");
  assert.match(source, /game\.ultimateAuras\["warrior-earthquake"\] = true/);
  assert.match(source, /game\.ultimateAuras\["warrior-earthquake"\]/);
  assert.match(source, /spawnInfiniteBonus/);
  assert.match(source, /pierceBuild \* 2 \+ ricochetBuild \* 2/);
  assert.match(source, /target\.traitLockTime = Math\.max\(target\.traitLockTime, 4 \+ level\)/);
  assert.match(source, /const meteorCount = 1 \+ Math\.floor\(afflictedCount \/ 4\)/);
  assert.match(source, /ball\.skillCharges\["warrior-berserker"\] = level/);
  assert.match(benchmark, /const evolutionMultiplier = level >= 3 && skill\.evolution \? 1\.55 : 1/);
  assert.match(benchmark, /const ultimateBuildMultiplier/);
});
