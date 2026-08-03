import assert from "node:assert/strict";
import { readFile as fsReadFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

// The game runtime is intentionally split across the page orchestration layer
// and pure simulation modules. Contract tests inspect the composed runtime
// surface so moving an implementation between those modules does not erase
// coverage for the behavior itself.
async function readGameSource() {
  const paths = [
    "../app/page.tsx",
    "../app/GameRuntime.tsx",
    "../app/game-update-prelude.ts",
    "../app/collision-physics.ts",
    "../app/canonical-engine.ts",
    "../app/game-runtime-projection.ts",
    "../app/game-runtime-canvas.ts",
    "../app/useGameInput.ts",
    "../app/useGamePresentation.ts",
    "../app/useRuntimeSettings.ts",
    "../app/useBenchmarkSession.ts",
    "../app/useGameRuntimeController.ts",
    "../app/useGameLoop.ts",
    "../app/game-events.ts",
    "../app/game-renderer.ts",
    "../app/hud-snapshot.ts",
    "../app/_types/game.ts",
    "../app/_components/modals/SkillSelectionModal.tsx",
    "../app/_components/benchmark/BenchmarkDashboard.tsx",
    "../app/skill-config.ts",
    "../app/balance-config.ts",
    "../app/benchmark-config.ts",
    "../app/wave-config.ts",
    "../app/bot-policy.ts",
    "../app/benchmark-headless.ts",
    "../app/benchmark-worker.ts",
    "../app/skill-lab/page.tsx",
    "../app/skill-lab/skill-bench.tsx",
  ];
  return (await Promise.all(paths.map((path) => fsReadFile(new URL(path, import.meta.url), "utf8")))).join("\n");
}

async function readFile(url, encoding) {
  if (String(url).endsWith("/app/page.tsx")) return readGameSource();
  return fsReadFile(url, encoding);
}

// Canonical behavior is covered by executable engine/projection contracts;
// deleted legacy update-pipeline source shapes are intentionally not asserted.

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
  assert.match(html, /새 공은 100% 속도에서 5초 동안 현재 속도로 복귀합니다/);
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

test("moves with A and D while mouse and arrow keys exclusively control rebound aim", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const physics = await readFile(new URL("../app/collision-physics.ts", import.meta.url), "utf8");
  const renderer = await readFile(new URL("../app/game-renderer.ts", import.meta.url), "utf8");
  assert.match(source, /PADDLE_KEYBOARD_SPEED = 460/);
  assert.match(source, /KEYBOARD_AIM_RATIO_SPEED = 1\.2/);
  assert.match(source, /window\.addEventListener\("keydown", onKeyDown\)/);
  assert.match(source, /key === "arrowleft" \|\| key === "arrowright"/);
  assert.match(source, /Number\(keyboardRef\.current\.right\) - Number\(keyboardRef\.current\.left\)/);
  assert.match(source, /aimInputModeRef = useRef<"mouse" \| "keyboard">\("mouse"\)/);
  assert.match(source, /pressed && !wasPressed && aimInputModeRef\.current !== "keyboard"/);
  assert.match(source, /aimInputModeRef\.current = "keyboard"/);
  assert.match(source, /else if \(aimInputModeRef\.current === "keyboard"\)/);
  assert.match(source, /keyboardAimRef\.current\.horizontalRatio \+ aimMovement \* KEYBOARD_AIM_RATIO_SPEED \* dt/);
  assert.match(source, /aimInputModeRef\.current = "mouse";\s*pointerXRef\.current/);
  assert.match(source, /pointerYRef/);
  assert.match(source, /function paddleAimDirection/);
  assert.match(source, /horizontalRatio = Math\.max\(-MAX_PADDLE_REBOUND_RATIO/);
  assert.match(source, /verticalRatio: -Math\.sqrt/);
  assert.match(source, /const AIM_LIMIT_GUIDE_LENGTH = 100/);
  assert.match(source, /const AIM_LINE_LENGTH = 170/);
  assert.match(source, /renderPaddles\(/);
  assert.match(renderer, /export function renderPaddles/);
  assert.match(renderer, /aim\?:/);
  assert.match(renderer, /aim\.left|aim\.right|aim\.limited/);
  assert.match(physics, /const rawContactTime = verticalTravel > 0/);
  assert.match(physics, /const alreadyTouchingTop = previousY <= paddle\.y \+ slop/);
  assert.match(physics, /const sideDepthContact =/);
  assert.match(physics, /sweptPaddleContact/);
  assert.match(physics, /const paddleContactX = paddle\.previousX \+ \(paddle\.x - paddle\.previousX\) \* contactTime/);
  assert.match(source, /const stepResult = stepCanonicalEngine/);
  assert.match(source, /stepCanonicalEngine\(state, \{\s+move,\s+aimX,\s+aimY,\s+\}, dt\)/);
  assert.match(source, /MOVE <kbd>A<\/kbd><kbd>D<\/kbd> · AIM \/ MOUSE OR <kbd>←<\/kbd><kbd>→<\/kbd>/);
  assert.doesNotMatch(source, /PADDLE_ENGLISH_FACTOR|paddle\.velocity/);
});

test("ramps ball speed within a wave and resolves circular brick collisions", async () => {
  const response = await render();
  const html = await response.text();
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const loop = await readFile(new URL("../app/useGameLoop.ts", import.meta.url), "utf8");
  const physics = await readFile(new URL("../app/collision-physics.ts", import.meta.url), "utf8");
  const benchmark = await readFile(new URL("../app/benchmark-headless.ts", import.meta.url), "utf8");
  const engine = await readFile(new URL("../app/canonical-engine.ts", import.meta.url), "utf8");
  assert.doesNotMatch(html, /<small>SPEED<\/small>/);
  assert.match(source, /OVERDRIVE_RATE_PER_SECOND = 0\.01/);
  assert.match(source, /MAX_OVERDRIVE_LEVEL = 50/);
  assert.match(loop, /const dt = Math\.max\(0, Math\.min\(0\.025/);
  assert.match(engine, /state\.rowTimer = 0;[\s\S]*state\.overdriveLevel = 0;/);
  assert.match(engine, /const ratio = overdriveMultiplier\(nextOverdriveLevel\)/);
  assert.match(physics, /export function circleRectangleCollision/);
  assert.match(physics, /export function separateAndReflectBall/);
  assert.match(physics, /collision\.penetration \+ 0\.1/);
  assert.match(benchmark, /stepCanonicalEngine\(state, controlProvider\(state, step\), FIXED_STEP_SECONDS\)/);
  assert.match(engine, /export function overdriveLevelAt/);
  assert.match(engine, /const overdrive = overdriveMultiplier\(state\.overdriveLevel\)/);
});

test("guarantees a minimum vertical angle after every reflection", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const physics = await readFile(new URL("../app/collision-physics.ts", import.meta.url), "utf8");
  assert.match(physics, /export const MIN_VERTICAL_SPEED_RATIO = 0\.32/);
  assert.match(physics, /export function ensureMinimumVerticalAngle/);
  assert.match(physics, /const minimumVerticalSpeed = speed \* MIN_VERTICAL_SPEED_RATIO/);
  assert.match(physics, /Math\.sqrt\(Math\.max\(0, speed \* speed - minimumVerticalSpeed \* minimumVerticalSpeed\)\)/);
  assert.match(physics, /ensureMinimumVerticalAngle\(ball, collision\.normalY\)/);
  assert.match(source, /separateAndReflectBall|ensureMinimumVerticalAngle/);
});

test("removes the floating time, wave, and speed HUD while retaining score", async () => {
  const response = await render();
  const html = await response.text();
  assert.doesNotMatch(html, /hud-badge hud-time/);
  assert.doesNotMatch(html, /hud-badge hud-wave/);
  assert.doesNotMatch(html, /hud-badge hud-speed/);
  assert.match(html, /hud-badge hud-score/);
});

test("restores legacy per-skill ball VFX and gates rapid-arrow inheritance on evolution", async () => {
  const renderer = await fsReadFile(new URL("../app/game-renderer.ts", import.meta.url), "utf8");
  assert.match(renderer, /const ballSkills = ball\.canTriggerSkills \? ownedSkills : \[\]/);
  assert.match(renderer, /const readySkills = cooldownEntries/);
  assert.match(renderer, /config\.category === "warrior"/);
  assert.match(renderer, /config\.category === "archer"/);
  assert.match(renderer, /id === "warrior-shockwave"/);
  assert.match(renderer, /id === "archer-ricochet"/);
  assert.match(renderer, /1 - entry\.remaining \/ entry\.total/);
});

test("renders boss reinforcements with the same trait design as normal-wave bricks", async () => {
  const renderer = await fsReadFile(new URL("../app/game-renderer.ts", import.meta.url), "utf8");
  assert.match(renderer, /brick\.kind === "normal" \|\| brick\.kind === "boss-minion"/);
  assert.doesNotMatch(renderer, /brick\.kind === "boss-minion" \? "#ff9658"/);
});

test("keeps the game-loop, simulation, and UI boundaries explicit", async () => {
  const page = await fsReadFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const source = await fsReadFile(new URL("../app/GameRuntime.tsx", import.meta.url), "utf8");
  const loop = await readFile(new URL("../app/useGameLoop.ts", import.meta.url), "utf8");
  const prelude = await readFile(new URL("../app/game-update-prelude.ts", import.meta.url), "utf8");
  const events = await readFile(new URL("../app/game-events.ts", import.meta.url), "utf8");
  const hud = await readFile(new URL("../app/hud-snapshot.ts", import.meta.url), "utf8");
  const renderer = await readFile(new URL("../app/game-renderer.ts", import.meta.url), "utf8");
  const runtimeCanvas = await readFile(new URL("../app/game-runtime-canvas.ts", import.meta.url), "utf8");
  assert.match(source, /useGameLoop\(/);
  assert.match(page, /return <GameRuntime \/>/);
  assert.doesNotMatch(page, /useGameLoop|stepCanonicalEngine|CanvasRenderingContext2D|new Worker/);
  assert.doesNotMatch(source, /requestAnimationFrame\(loop\)/);
  assert.match(loop, /cancelAnimationFrame/);
  assert.match(loop, /advanceCanonicalAccumulator\(canonicalAccumulatorRef\.current, simulationDelta/);
  assert.match(prelude, /export function advanceGamePrelude/);
  assert.match(prelude, /export function applyPaddleInput/);
  assert.doesNotMatch(prelude, /setHud|requestAnimationFrame|CanvasRenderingContext2D|AudioContext/);
  assert.match(events, /export type GameEvent/);
  assert.match(events, /type: "audio"|type: "particle"|type: "effect"/);
  assert.match(hud, /export type HudSnapshot/);
  assert.match(hud, /export function hudSnapshotsEqual/);
  assert.doesNotMatch(hud, /CanvasRenderingContext2D|requestAnimationFrame/);
  assert.doesNotMatch(source, /ctx\.|CanvasRenderingContext2D|getContext\(/);
  assert.match(source, /renderGameRuntimeCanvas\(/);
  assert.match(runtimeCanvas, /renderTransientFeedback\(ctx, game, W, H\)/);
  assert.match(runtimeCanvas, /renderHud\(\{ ctx, game, width: W, height: H \}\)/);
  assert.match(renderer, /export function renderTransientFeedback/);
  assert.match(renderer, /game\.particles\.forEach/);
  assert.match(renderer, /game\.flashes\.forEach/);
  assert.match(renderer, /screenFlashTime/);
  assert.match(renderer, /export function renderHud/);
  assert.match(renderer, /CORE FORTRESS/);
  assert.match(renderer, /OVERDRIVE/);
  assert.doesNotMatch(renderer, /GameAudio|\.play\(/);
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
  const modal = await readFile(new URL("../app/_components/modals/SkillSelectionModal.tsx", import.meta.url), "utf8");
  const icon = await readFile(new URL("../app/_components/SkillIconArt.tsx", import.meta.url), "utf8");
  const renderer = await readFile(new URL("../app/game-renderer.ts", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /className="upgrade-level-values"/);
  assert.match(modal, /<SkillIconArt id=\{upgrade\.id\} \/>/);
  assert.match(icon, /assets\/ui\/skills\/forged-core/);
  assert.match(icon, /className="skill-icon-fallback"/);
  assert.match(modal, /class-\$\{upgrade\.category\}/);
  assert.match(css, /\.upgrade-card\.class-warrior/);
  assert.match(css, /\.class-archer \.upgrade-icon/);
  assert.match(css, /\.class-mage \.upgrade-icon/);
  assert.match(renderer, /ctx\.roundRect\(/);
  assert.match(css, /\.upgrade-level-values span:nth-child\(1\)\{color:#65dcff\}/);
  assert.match(css, /\.upgrade-level-values span:nth-child\(2\)\{color:#a78bfa\}/);
  assert.match(css, /\.upgrade-level-values span:nth-child\(3\)\{color:#ffcf4a\}/);
  assert.match(modal, /className="upgrade-tooltip" role="tooltip"/);
  assert.match(css, /\.upgrade-card:hover \.upgrade-tooltip/);
});

test("shows compact skill icons with color-only level states and fourth-pick evolutions", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /skillLevels: \[\]/);
  assert.match(source, /className="skill-loadout-hud"/);
  assert.match(source, /isSkillEvolved\(gameRef\.current\?\.upgrades \?\? \[\], id\)/);
  assert.match(source, /pickCount === 3 && Boolean\(config\?\.evolution\)/);
  assert.match(styles, /\.upgrade-card\.evolution-card/);
  assert.match(styles, /@keyframes evolution-rainbow/);
  assert.match(source, /className={`skill-loadout-entry class-\$\{category\} level-\$\{Math\.min\(3, level\)\}/);
  assert.doesNotMatch(source, /<span aria-hidden="true">×<\/span><strong>\{level\}<\/strong>/);
  assert.match(styles, /\.skill-loadout-entry\.level-1\{opacity:\.68;filter:grayscale/);
  assert.match(styles, /\.skill-loadout-entry\.level-2\{opacity:\.84;filter:grayscale/);
  assert.match(styles, /\.skill-loadout-entry\.level-3\{opacity:1;filter:saturate/);
  assert.match(styles, /\.skill-loadout-hud\{position:absolute;z-index:5;top:66px;left:14px/);
  assert.match(styles, /\.skill-loadout-entry\.evolved:before/);
  assert.match(styles, /\.skill-loadout-entry\.evolved:before\{border-style:solid;animation:none/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)\{\.skill-loadout-entry\.evolved,\.skill-loadout-entry>b\{animation:none\}\}/);
  assert.match(styles, /\.skill-loadout-entry\.class-common/);
});

test("defines 20 fixed brick patterns with bosses at waves 10 and 20", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const waves = await readFile(new URL("../app/wave-config.ts", import.meta.url), "utf8");
  assert.match(source, /MAX_WAVE/);
  assert.match(source, /WAVE_STORAGE_KEY/);
  assert.match(source, /waveDefinition/);
  assert.match(source, /makeWaveBricks\(waveNumber/);
  assert.doesNotMatch(waves, /timeLimit|WAVE_TIME_LIMIT/);
  assert.match(waves, /wave\(10, "MID BOSS/);
  assert.match(waves, /wave\(20, "FINAL BOSS/);
  const patternRows = [...waves.matchAll(/"([.nhgexcr]{12})"/g)].map((match) => match[1]);
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

test("introduces the first reflector bricks on the lowest row", async () => {
  const waves = await readFile(new URL("../app/wave-config.ts", import.meta.url), "utf8");
  assert.match(waves, /wave\(3, "BOUNCE GATE", \["\.\.nnnnnnnn\.\.", "\.nnn\.\.\.\.nnn\.", "\.\.rr\.\.\.\.rr\.\."\]\)/);
});

test("edits and persists the canonical 20-wave definitions in Stage Lab", async () => {
  const waves = await readFile(new URL("../app/wave-config.ts", import.meta.url), "utf8");
  const game = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const stageLab = await readFile(new URL("../app/stage-lab/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/stage-lab/stage-lab.module.css", import.meta.url), "utf8");
  assert.match(waves, /export const WAVE_STORAGE_KEY/);
  assert.match(waves, /export function normalizeWaveDefinitions/);
  assert.match(waves, /export function applyWaveDefinitions/);
  assert.match(waves, /hpMultiplier: number/);
  assert.match(game, /applyWaveDefinitions\(JSON\.parse\(savedWaves\)\)/);
  assert.match(game, /waveDefinitions: getActiveWaveDefinitions\(\)/);
  assert.match(stageLab, /localStorage\.setItem\(WAVE_STORAGE_KEY/);
  assert.match(stageLab, /applyWaveDefinitions\(normalized\)/);
  assert.match(stageLab, /resetWaveDefinitions\(\)/);
  assert.match(stageLab, /JSON 가져오기/);
  assert.match(stageLab, /JSON 내보내기/);
  assert.match(stageLab, /저장·게임 적용/);
  assert.match(styles, /grid-template-columns:repeat\(12/);
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
  assert.match(source, /const bossHpMultiplier = \[1, 0\.85, 0\.95, 1\.05, 1\.2\]/);
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

test("propagates paddle debuffs and keeps barrier state accessible in the in-game HUD", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /blastVulnerability/);
  assert.match(source, /applyDebuffs|blastVulnerability/);
  assert.match(source, /paddleBarriers|barriers/);
  assert.match(source, /<output className="sr-only" aria-live="polite" aria-atomic="true">코어 체력/);
  assert.doesNotMatch(source, /aria-label="특수 블록 기능 안내"/);
  assert.match(source, /보호막 \$\{hud\.barriers\}개/);
  assert.doesNotMatch(source, /barrierSummary|CORE LINE/);
  assert.match(source, /EXP ×/);
});

test("renders individual core crystals below the player paddle with a break effect", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /renderPaddles/);
  assert.match(source, /coreHp/);
  assert.match(source, /coreBreak/);
  assert.doesNotMatch(source, /const healthText = `◆/);
  assert.match(source, /drawPaddleBody\(x, y, width, color, 0\.74\)/);
  assert.doesNotMatch(source, /drawPaddleBody\(x, y, width, color, 0\.74, game\.coreHp\)/);
  assert.match(source, /<output className="sr-only" aria-live="polite" aria-atomic="true">코어 체력 \{hud\.coreHp\}\/\{hud\.maxCoreHp\}/);
  assert.doesNotMatch(source, /hud-badge hud-core|core-health-icons|core-health-icon/);
  assert.doesNotMatch(source, /className="core-meter"/);
  assert.doesNotMatch(styles, /hud-core|core-health|core-meter/);
  assert.match(styles, /\.sr-only\{position:absolute!important;width:1px!important/);
});

test("resets every wave to exactly one base ball above the paddle", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const engine = await readFile(new URL("../app/canonical-engine.ts", import.meta.url), "utf8");
  assert.match(engine, /state\.balls = \[makeBall\(state, state\.paddleX\)\]/);
  assert.match(engine, /command\.type === "start-next-wave" && state\.phase === "ready-for-next-wave"/);
  assert.match(source, /dispatchCanonicalCommand\(state, \{ type: "start-next-wave" \}\)/);
  assert.doesNotMatch(source, /while \(game\.balls\.length < game\.wave\)/);
});

test("routes visible bot shots above protected reflector undersides", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const policy = await readFile(new URL("../app/bot-policy.ts", import.meta.url), "utf8");
  assert.match(source, /function protectedReflectorBlockingAim/);
  assert.match(source, /const contactTime = \(protectedFaceY - originY\) \/ verticalTravel/);
  assert.match(source, /contactX >= brick\.x - 8 && contactX <= brick\.x \+ brick\.w \+ 8/);
  assert.match(source, /function reflectorWeakSideBankAim/);
  assert.match(source, /reflectorBankAim\(reflector, originX, phase, reflectors\)/);
  assert.match(source, /reflectorWeakSideBankAim\(target, originX, phase, bricks\.filter/);
  assert.match(source, /const reflector = reflectors\[Math\.floor\(phase \/ 2\) % reflectors\.length\]/);
  assert.match(source, /decideBotControls/);
  assert.match(policy, /reflectorBankAim/);
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
  assert.match(engine, /createCanonicalState/);
  assert.match(engine, /stepCanonicalEngine/);
  assert.match(source, /waveDefinitions: getActiveWaveDefinitions\(\)/);
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
  assert.match(source, /useState<BenchmarkRunMode>\("watch"\)/);
  assert.match(source, /benchmarkRunMode === "watch"/);
  assert.match(source, /WATCH RUN START/);
  assert.match(source, /\[1, 2, 4, 8\]\.map/);
  assert.match(source, /benchmarkWatchRef\.current \? "watch-v1" : BENCHMARK_RULESET/);
  assert.match(source, /const targetRuns = .*benchmarkMode \? 1 : botTargetRuns/);
  assert.match(source, /LIVE BOT · \{botSpeed\}× · W\{hud\.wave\}/);
  assert.match(styles, /\.benchmark-mode-switch/);
  assert.match(styles, /\.watch-run-badge/);
});

test("labels visible benchmark records as exact live-runtime runs", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /engineVersion: benchmarkWatchRef\.current \? ENGINE_VERSION/);
  assert.match(source, /engineParity: benchmarkWatchRef\.current \? ENGINE_PARITY/);
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
  assert.match(source, /TIMEOUT FORENSICS/);
  assert.match(source, /diagnostic\.remainingBricks/);
  assert.match(source, /diagnostic\.secondsSinceLastDamage/);
  assert.match(styles, /\.benchmark-timeout-section/);
  assert.match(styles, /\.benchmark-timeout-table/);
  assert.match(styles, /\.benchmark-skill-table/);
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

test("keeps fixed-step acceleration for the legacy skill benchmark runner", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const loop = await readFile(new URL("../app/useGameLoop.ts", import.meta.url), "utf8");
  assert.match(source, /type BotSpeed = 1 \| 2 \| 4 \| 8/);
  assert.match(loop, /const steps = botActiveRef\.current \? botSpeedRef\.current : 1/);
  assert.match(loop, /for \(let step = 0; step < steps && runningRef\.current; step \+= 1\)/);
  assert.match(loop, /updateRef\.current\(dt\)/);
  assert.match(source, /speed: botSpeedRef\.current/);
  assert.match(source, /botSpeedRef\.current = botSpeed/);
  assert.match(source, /CPU 자동 · 최대 8/);
});

test("keeps the faster base ball speed for the one-ball ruleset", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const BASE_BALL_VX = 240/);
  assert.match(source, /const BASE_BALL_VY = 320/);
  assert.match(source, /vx: BASE_BALL_VX \* speed, vy: -BASE_BALL_VY \* speed/);
});

test("keeps fixed multiball budgets and adds utility item drops", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const engine = await readFile(new URL("../app/canonical-engine.ts", import.meta.url), "utf8");
  assert.match(source, /const NORMAL_STAGE_MULTIBALL_WAVES = \[2, 4, 6, 8, 11, 13, 16, 18\]/);
  assert.match(source, /function hasScheduledMultiball/);
  assert.match(engine, /canonicalRandom\(state, "world"\) < 0\.055/);
  assert.match(engine, /\["auto-barrier", "core-repair", "cooldown-reset"\] as CanonicalItemKind\[\]/);
  assert.match(engine, /brick\.drop \?\? \(canonicalRandom\(state, "world"\)/);
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
  const labels = ["전사", "궁수", "법사"];
  labels.forEach((label) => {
    assert.match(html, new RegExp(label));
  });
  assert.match(source, /CATEGORY_ICONS/);
  assert.match(source, /data-category=\{skill\.category\}/);
  assert.match(styles, /\.skillCard\[data-category="warrior"\]/);
});

test("defines all class skills as permanent ball-owned skills without ball costs", async () => {
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  const names = ["warrior-smash", "warrior-shockwave", "warrior-execute", "warrior-crush", "warrior-guard", "archer-rapid", "archer-pierce", "archer-ricochet", "archer-focus", "archer-weakpoint", "mage-fireball", "mage-lightning", "mage-freeze", "mage-black-hole", "mage-mana-blast"];
  names.forEach((name) => assert.match(config, new RegExp(`"${name}"`)));
  assert.match(config, /export const NORMAL_SKILLS/);
  assert.doesNotMatch(config, /ULTIMATE_SKILLS/);
  assert.match(config, /owner: "ball"/);
  assert.match(config, /블록 타격 시 상시 적용/);
  assert.match(config, /ballCost: 0/);
  assert.doesNotMatch(config, /ballCost: [12]/);
});

test("keeps selected skill icons only in the left loadout HUD", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /className="skill-loadout-hud"/);
  assert.doesNotMatch(source, /drawSkillPanel\(game\.paddleX/);
  assert.doesNotMatch(source, /drawSkillPanel\(x, y, width/);
  assert.doesNotMatch(source, /drawCounterRail\(/);
  assert.match(source, /스킬은 공마다 독립 쿨타임으로 발동/);
  assert.doesNotMatch(source, /paddleCounter\.chargePulse = 1\.2/);
  assert.doesNotMatch(source, /paddleCounter\.skillReflections\[id\]/);
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

test("shows ball skill effects only while each per-ball cooldown is ready", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /const ballCooldownEntries = \(ball\.canTriggerSkills \? \[\.\.\.new Set\(game\.upgrades\)\] : \[\]\)/);
  assert.match(source, /filter\(\(entry\) => entry\.remaining <= 0\)/);
  assert.doesNotMatch(source, /activeSkillEffects/);
});

test("renders segmented per-ball cooldown gauges without a skill-name timer label", async () => {
  const renderer = await fsReadFile(new URL("../app/game-renderer.ts", import.meta.url), "utf8");
  assert.match(renderer, /const coolingSkills = cooldownEntries\.filter/);
  assert.match(renderer, /1 - entry\.remaining \/ entry\.total/);
  assert.doesNotMatch(renderer, /nextReady/);
  assert.doesNotMatch(renderer, /config\.name.*remaining\.toFixed/);
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
  assert.doesNotMatch(audio, /case "ultimate"/);
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
  ["warrior-smash", "warrior-shockwave", "warrior-execute", "warrior-crush", "warrior-guard"].forEach((id) => {
    assert.match(source, new RegExp(`effect\\.skillId === "${id}"|id === "${id}"`));
  });
  assert.match(source, /ctx\.arc\(0, 0, visualRadius \+ 3 \+ pulse/);
  assert.match(source, /ctx\.fillRect\(-3\.5, -3\.5, 7, 7\)/);
  assert.match(source, /const distance = reach \* \(0\.25 \+ progress \* 0\.5\)/);
});

test("gives every archer skill a distinct projectile or targeting signature", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /emitSkillEffect\("archer-rapid"/);
  ["archer-rapid", "archer-pierce", "archer-ricochet", "archer-focus", "archer-weakpoint"].forEach((id) => {
    assert.match(source, new RegExp(`effect\\.skillId === "${id}"|id === "${id}"`));
  });
  assert.match(source, /ctx\.arc\(0, 0, reticle/);
  assert.match(source, /const points = \[\[-length \* 0\.25/);
});

test("classifies skills by both hero class and combat mechanic", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/skill-lab/page.tsx", import.meta.url), "utf8");
  const config = await readFile(new URL("../app/skill-config.ts", import.meta.url), "utf8");
  assert.match(config, /type SkillMechanic = "impact" \| "chain" \| "control" \| "summon" \| "defense" \| "passive"/);
  assert.doesNotMatch(config, /"ultimate"/);
  ["타격", "연쇄", "제어", "소환", "방어", "지속"].forEach((label) => assert.match(config, new RegExp(`"${label}"`)));
  assert.match(source, /SKILL_MECHANIC_LABELS\[skill\.mechanic\]/);
  assert.match(source, /const readyCategories = \[\.\.\.new Set\(activeClassCharges/);
  assert.match(source, /category === "warrior"/);
  assert.match(source, /category === "archer"/);
  assert.match(source, /category === "mage"/);
  assert.match(lab, /mechanicFilter/);
  assert.match(lab, /aria-label="스킬 작동 방식 필터"/);
  assert.match(config, /mechanic: base\.mechanic/);
});
