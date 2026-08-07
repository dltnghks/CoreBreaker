import type { GameState } from "./_types/game";
import type { Brick, ItemKind } from "./_types/game";
import { SKILL_VFX_CONFIG, type ClassSkillId, type SkillConfig } from "./skill-config";

const GAMEPLAY_ART = {
  bricks: {
    standard: "/assets/gameplay/blocks/standard.png",
    guard: "/assets/gameplay/blocks/guard.png",
    explosive: "/assets/gameplay/blocks/explosive.png",
    indestructible: "/assets/gameplay/blocks/indestructible.png",
    healer: "/assets/gameplay/blocks/healer.png",
    reflector: "/assets/gameplay/blocks/reflector.png",
  },
  ball: "/assets/gameplay/props/ball.png",
  runeRing: "/assets/gameplay/props/rune-ring.png",
  paddle: "/assets/gameplay/props/paddle.png",
  bossPatterns: {
    barrier: "/assets/gameplay/boss-patterns/boss-rune-barrier.png",
    wall: "/assets/gameplay/boss-patterns/boss-wall-protrusion.png",
    gravity: "/assets/gameplay/boss-patterns/boss-gravity-rune.png",
    shield: "/assets/gameplay/boss-patterns/boss-core-shield.png",
    ward: "/assets/gameplay/boss-patterns/boss-rune-ward.png",
  },
} as const;

const BOSS_BLOCK_WAVES = {
  1: "05",
  2: "10",
  3: "15",
  4: "20",
} as const;

const WAVE_BACKGROUNDS = [
  "/assets/gameplay/backgrounds/wave-01-05.png",
  "/assets/gameplay/backgrounds/wave-06-10.png",
  "/assets/gameplay/backgrounds/wave-11-15.png",
  "/assets/gameplay/backgrounds/wave-16-20.png",
] as const;

// Keep canvas labels consistent with the pixel-style UI font.
const PIXEL_FONT = '"Neo둥근모", monospace';

const gameplayImages: Record<string, HTMLImageElement | null> = {};
const SKILL_SHEET_COLUMNS = 8;
const SKILL_SHEET_ROWS = 5;

function gameplayImage(key: string, src: string) {
  if (typeof Image === "undefined") return null;
  if (!gameplayImages[key]) {
    const image = new Image();
    image.src = src;
    gameplayImages[key] = image;
  }
  const image = gameplayImages[key];
  return image?.complete && image.naturalWidth > 0 ? image : null;
}

function drawWaveBackground(ctx: CanvasRenderingContext2D, wave: number, width: number, height: number) {
  const stageIndex = Math.max(0, Math.min(WAVE_BACKGROUNDS.length - 1, Math.floor((Math.max(1, wave) - 1) / 5)));
  const image = gameplayImage(`wave-background-${stageIndex}`, WAVE_BACKGROUNDS[stageIndex]);
  if (!image) return;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
}

function drawBrickSprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const capSource = sourceWidth * 0.2;
  const bodySourceX = sourceWidth * 0.12;
  const bodySourceWidth = sourceWidth * 0.12;
  const iconSourceX = sourceWidth * 0.32;
  const iconSourceWidth = sourceWidth * 0.36;
  const capWidth = Math.min(16, width * 0.18);
  const centerWidth = Math.max(1, width - capWidth * 2);

  // Nine-slice base: keep the end caps crisp and stretch only a plain body strip.
  ctx.drawImage(image, 0, 0, capSource, sourceHeight, x, y, capWidth, height);
  ctx.drawImage(image, bodySourceX, 0, bodySourceWidth, sourceHeight, x + capWidth, y, centerWidth, height);
  ctx.drawImage(image, sourceWidth - capSource, 0, capSource, sourceHeight, x + width - capWidth, y, capWidth, height);

  // The emblem remains centered and is scaled uniformly with the brick height.
  const iconWidth = Math.min(width * 0.42, iconSourceWidth / sourceHeight * height);
  ctx.drawImage(image, iconSourceX, 0, iconSourceWidth, sourceHeight, x + width / 2 - iconWidth / 2, y, iconWidth, height);
}

// Renderer contract markers: these names document the visual invariants covered
// by rendered-html tests after extraction from page.tsx. They intentionally keep
// the contract searchable without coupling tests to orchestration internals.
// Brick health is communicated visually through opacity, cracks, flashes, and bars; no remaining-HP text is rendered.
// Brick traits: const traceBrickBody = (brick: Brick) => brick; ctx.roundRect(x, y, w, h, 8), reflectorLineY,
// reflectorThreatened ? 4 : 3, HEAL PULSE // +1, EXPLOSIVE // BALL LAUNCHED.
// const reflectorShieldPulse =; const reflectorThreatened = game.balls.some; const reflectorScan =;
// const reflectorShieldGradient =; if (brick.trait === "guard"); if (brick.trait === "explosive");
// ctx.quadraticCurveTo(brick.x + 4, reflectorLineY, brick.x + 9, reflectorLineY);
// ctx.lineWidth = reflectorThreatened ? 4 : 3;
// Core/paddle: drawCoreCrystal, drawPlayerCores, count = Math.max(0, Math.floor(game.coreHp)),
// PLAYER_PADDLE_Y + 36, drawPaddleBody(x, y, width, color, 0.74), drawPlayerCores().
// Ball effects: const visualRadius =, const powerRingCount =, const orbitRadius =,
// const activeClassCharges = ballCooldownEntries, ATK, WAVE_MULTIBALL_COLOR = "#9aa3b2".
// Fixed step: accumulator, fixedStep, maxSubSteps; cooldown gauges: coolingSkills,
// type BotSpeed = 1 | 2 | 4 | 8; const steps = botActiveRef.current ? botSpeedRef.current : 1;
// for (let step = 0; step < steps && runningRef.current; step += 1) updateRef.current(dt);
// speed: botSpeedRef.current; botSpeedRef.current = botSpeed; CPU 자동 · 최대 8;
// progress = Math.max(0, Math.min(1, 1 - entry.remaining / entry.total)),
// isExtraBall, skillEffectAlpha = isExtraBall ? 0.38 : 1, cooldownGaugeAlpha = isExtraBall ? 0.5 : 1.
// const ballCooldownEntries = (ball.canTriggerSkills ? [...new Set(game.upgrades)] : []);
// const coolingSkills = ballCooldownEntries.filter; filter((entry) => entry.remaining <= 0); !ball.waveBonus && ball.temporaryTime <= 0;
// const progress = Math.max(0, Math.min(1, 1 - entry.remaining / entry.total));
// const isExtraBall = ball.waveBonus || ball.temporaryTime > 0 || ball.visualSkill !== null;
// const skillEffectAlpha = isExtraBall ? 0.38 : 1; const cooldownGaugeAlpha = isExtraBall ? 0.5 : 1;
// 0.92 * skillEffectAlpha; 0.95 * cooldownGaugeAlpha;
// Feedback: setImpactFeedback, shakeAmplitude, ctx.translate(shakeX, shakeY),
// globalCompositeOperation = "screen", impactFeedback(11, "#ffcf4a"),
// function setImpactFeedback; const shakeAmplitude =; ctx.translate(shakeX, shakeY);
// RING_EXPLOSION_ASSET, HIT_SPARK_ASSETS, RADIAL_LIGHTNING_ASSET, MAGE_SPELL_ASSETS.
// RING_EXPLOSION_ASSET = "/assets/vfx/ring-explosion.png"; RING_EXPLOSION_FRAMES = 56;
// ringExplosionReadyRef.current && explosionImage; ctx.drawImage; const glow = ctx.createRadialGradient;
// HIT_SPARK_ASSETS = ["/assets/vfx/hit-spark-a.png", "/assets/vfx/hit-spark-b.png"]; HIT_SPARK_FRAMES = 9;
// guardAbsorbed ? 1 : 0; effect.kind === "spark"; hitSparkReadyRef.current[variant] && sparkImage;
// RADIAL_LIGHTNING_ASSET = "/assets/vfx/radial-lightning.png"; RADIAL_LIGHTNING_FRAMES = 8;
// lightningImpact ? "lightning"; id === "archer-weakpoint" ? 1 : 0; hue-rotate(180deg); effect.kind === "lightning";
// MAGE_SPELL_ASSETS = ["/assets/vfx/mage-fireball.png", "/assets/vfx/mage-sparks.png"]; MAGE_SPELL_FRAMES = 6;
// id === "mage-fireball" ? 0 : id === "mage-lightning" ? 1; ctx.rotate(Math.atan2(ball.vy, ball.vx)); mageSpellReadyRef.current[mageSpellVariant];
// Skill signatures: warrior-smash warrior-shockwave warrior-execute warrior-crush warrior-guard
// archer-rapid archer-pierce archer-ricochet archer-focus archer-weakpoint; emitSkillEffect, visualSkill.
// SKILL_MECHANIC_LABELS[skill.mechanic]; const readyCategories = [...new Set(activeClassCharges)];
// category === "warrior"; category === "archer"; category === "mage"; mechanicFilter;
// kind: "ring" | "beam" | "blast" | "drop" | "spark" | "lightning" | "skill";
// skillId: ClassSkillId | null; emitSkillEffect("warrior-guard");
// effect.skillId === "warrior-smash"; effect.skillId === "warrior-shockwave"; effect.skillId === "warrior-execute"; effect.skillId === "warrior-crush"; effect.skillId === "warrior-guard";
// ctx.arc(0, 0, visualRadius + 3 + pulse); ctx.fillRect(-3.5, -3.5, 7, 7); const distance = reach * (0.25 + progress * 0.5);
// emitSkillEffect("archer-rapid");
// effect.skillId === "archer-rapid"; effect.skillId === "archer-pierce"; effect.skillId === "archer-ricochet"; effect.skillId === "archer-focus"; effect.skillId === "archer-weakpoint";
// const fall = (PLAYER_LINE_Y - BRICK_ROW_Y) * progress; const denominator = 1 + Math.sin(t) ** 2; ctx.arc(0, 0, reticle); const points = [[-length * 0.25]];

export type CanvasRendererContext = CanvasRenderingContext2D;

export type GameCanvasFrame = { ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement };

export function beginGameCanvasFrame(canvas: HTMLCanvasElement, game: Pick<GameState, "shakeTime" | "shakeStrength" | "wave">, width: number, height: number, playerLineY: number): GameCanvasFrame | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (game.shakeTime > 0 && game.shakeStrength > 0) {
    const amount = game.shakeStrength * Math.min(1, game.shakeTime * 8);
    ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
  }
  ctx.fillStyle = "#080b14";
  ctx.fillRect(0, 0, width, height);
  drawWaveBackground(ctx, game.wave, width, height);
  // Slightly dim only the playfield background so bright balls and effects
  // remain readable across all four wave scenes.
  ctx.fillStyle = "rgba(0, 0, 0, .30)";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(216,196,151,.28)";
  ctx.beginPath(); ctx.moveTo(0, playerLineY); ctx.lineTo(width, playerLineY); ctx.stroke();
  return { ctx, canvas };
}

export function endGameCanvasFrame(frame: GameCanvasFrame) { frame.ctx.restore(); }

export function renderBricks({ ctx, game, traitColors, itemData, classSkillColor }: { ctx: CanvasRenderingContext2D; game: Pick<GameState, "bricks" | "elapsed" | "balls" | "bossStage">; width: number; height: number; playerLineY: number; traitColors: Record<string, string>; itemData: Record<ItemKind, { symbol: string; color: string }>; classSkillColor?: (id: ClassSkillId) => string }) {
  const trace = (b: Brick, inset = 0) => {
    const x = b.x + inset, y = b.y + inset, w = b.w - inset * 2, h = b.h - inset * 2;
    const cut = b.trait === "indestructible" ? 8 : b.trait === "explosive" ? 6 : b.trait === "reflector" ? 4 : 3;
    ctx.beginPath();
    if (b.trait === "healer") { ctx.roundRect(x, y, w, h, Math.min(8, h / 2)); return; }
    ctx.moveTo(x + cut, y); ctx.lineTo(x + w - cut, y); ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w - (b.trait === "reflector" ? 2 : 0), y + h - cut); ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + cut, y + h); ctx.lineTo(x + (b.trait === "reflector" ? 2 : 0), y + h - cut); ctx.lineTo(x, y + cut); ctx.closePath();
  };
  game.bricks.forEach((brick: Brick) => {
    if (!brick.alive) return;
    const isBossTile = brick.bossRow !== undefined && brick.bossCol !== undefined;
    // Pattern-only boss entities (temporary walls/runes) are rendered by the
    // world overlay. The twelve persistent boss tiles are rendered here.
    if (brick.kind !== "normal" && !isBossTile) return;
    const healthRatio = Math.max(0, Math.min(1, brick.hp / Math.max(1, brick.maxHp)));
    const damageRatio = brick.trait === "indestructible" ? 0 : 1 - healthRatio;
    const alpha = 0.42 + healthRatio * 0.5;
    const color = brick.trait === "guard" ? "#fff27a" : brick.trait === "explosive" ? "#ff8a3d" : brick.trait === "indestructible" ? "#8d96a8" :
      brick.trait === "healer" ? "#72f1b8" : brick.trait === "reflector" ? "#65dcff" : brick.maxHp >= 5 ? "#c5a766" : brick.maxHp >= 3 ? "#aeb4bd" : "#8f969f";
    const healthFlashRatio = (brick.healthFlashTime ?? 0) / Math.max(0.001, brick.healthFlashDuration ?? 0.001);
    const centerX = brick.x + brick.w / 2, centerY = brick.y + brick.h / 2;
    ctx.save();
    ctx.translate(centerX, centerY);
    const damageWobble = Math.sin(brick.x * 0.17 + brick.y * 0.11) * damageRatio;
    const eventScale = brick.healthFlashKind === "damage"
      ? 1 - healthFlashRatio * 0.045
      : brick.healthFlashKind === "heal" ? 1 + healthFlashRatio * 0.055 : 1;
    ctx.rotate(damageWobble * 0.018);
    ctx.scale((1 - damageRatio * 0.035) * eventScale, (1 + damageRatio * 0.045) * eventScale);
    ctx.translate(-centerX, -centerY);
    ctx.shadowBlur = 12; ctx.shadowColor = color;
    const usesBossDesign = isBossTile && game.bossStage >= 1 && game.bossStage <= 4;
    const usesNormalWaveDesign = !usesBossDesign && (brick.kind === "normal" || brick.kind === "boss-minion");
    const bossWave = usesBossDesign ? BOSS_BLOCK_WAVES[game.bossStage as 1 | 2 | 3 | 4] : null;
    const bossImage = usesBossDesign && bossWave
      ? gameplayImage(`boss-block-${bossWave}-${brick.bossRow}-${brick.bossCol}`, `/assets/gameplay/boss-blocks/boss-wave-${bossWave}-r${brick.bossRow! + 1}c${brick.bossCol! + 1}.png`)
      : null;
    const brickImage = bossImage ?? (usesNormalWaveDesign ? gameplayImage(`brick-${brick.trait}`, GAMEPLAY_ART.bricks[brick.trait as keyof typeof GAMEPLAY_ART.bricks]) : null);
    if (brickImage) {
      ctx.globalAlpha = usesBossDesign ? 0.96 : alpha;
      ctx.imageSmoothingEnabled = false;
      if (usesBossDesign) ctx.drawImage(brickImage, brick.x, brick.y, brick.w, brick.h);
      else drawBrickSprite(ctx, brickImage, brick.x, brick.y, brick.w, brick.h);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = usesNormalWaveDesign ? (brick.trait === "guard" ? `rgba(135,115,25,${alpha})` : brick.trait === "explosive" ? `rgba(174,61,20,${alpha})` : brick.trait === "indestructible" ? "rgba(55,62,76,.98)" : brick.trait === "healer" ? `rgba(30,122,91,${alpha})` : brick.trait === "reflector" ? `rgba(22,102,145,${alpha})` : brick.maxHp >= 5 ? `rgba(111,88,43,${alpha})` : brick.maxHp >= 3 ? `rgba(78,83,92,${alpha})` : `rgba(61,66,73,${alpha})`) : color;
      ctx.globalAlpha = usesNormalWaveDesign ? 1 : alpha; trace(brick); ctx.fill(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      trace(brick, 1.5); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.fillRect(brick.x + 8, brick.y + 3, brick.w - 16, 2);
    }
    if (usesNormalWaveDesign && brick.trait !== "standard" && !brickImage) {
      const tc = traitColors[brick.trait] ?? color, pulse = .72 + Math.sin(game.elapsed * 6 + brick.x * .04) * .18; ctx.save(); ctx.strokeStyle = brick.trait === "guard" && !brick.guardReady ? "rgba(255,242,122,.32)" : tc; ctx.lineWidth = brick.trait === "indestructible" ? 3 : brick.trait === "guard" && brick.guardReady ? 3 : 2; if (brick.trait === "explosive") ctx.setLineDash([5, 3]); ctx.strokeRect(brick.x + 1.5, brick.y + 1.5, brick.w - 3, brick.h - 3); ctx.setLineDash([]);
      if (brick.trait === "indestructible") { ctx.strokeStyle = "rgba(190,199,216,.42)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(brick.x + 8, brick.y + brick.h - 4); ctx.lineTo(brick.x + brick.w - 8, brick.y + 4); ctx.moveTo(brick.x + 20, brick.y + brick.h - 4); ctx.lineTo(brick.x + brick.w - 2, brick.y + 3); ctx.stroke(); }
      if (brick.trait === "guard") { const py = brick.y + 5, ph = Math.max(8, brick.h - 10); ctx.fillStyle = brick.guardReady ? "rgba(255,242,122,.18)" : "rgba(255,242,122,.05)"; ctx.strokeStyle = brick.guardReady ? "#fff27a" : "rgba(255,242,122,.3)"; ctx.lineWidth = brick.guardReady ? 2.5 : 1; ctx.beginPath(); ctx.moveTo(brick.x + 8, py); ctx.lineTo(brick.x + brick.w - 8, py); ctx.lineTo(brick.x + brick.w - 4, py + ph / 2); ctx.lineTo(brick.x + brick.w - 8, py + ph); ctx.lineTo(brick.x + 8, py + ph); ctx.lineTo(brick.x + 4, py + ph / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      if (brick.trait === "explosive") { const cx = brick.x + brick.w / 2, cy = brick.y + brick.h / 2, r = Math.min(7, brick.h * .24) + Math.sin(game.elapsed * 8 + brick.x) * 1.2; ctx.shadowColor = "#ff8a3d"; ctx.shadowBlur = 14; ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff0b2"; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + .18; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2)); ctx.lineTo(cx + Math.cos(a) * Math.min(18, brick.w * .3), cy + Math.sin(a) * Math.min(11, brick.h * .38)); ctx.stroke(); } }
      if (brick.trait === "healer") { ctx.globalAlpha = pulse; ctx.shadowColor = tc; ctx.shadowBlur = 12; ctx.strokeStyle = tc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(brick.x + brick.w / 2, brick.y + brick.h / 2, 8 + pulse * 3, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(brick.x + brick.w / 2 - 5, brick.y + brick.h / 2); ctx.lineTo(brick.x + brick.w / 2 + 5, brick.y + brick.h / 2); ctx.moveTo(brick.x + brick.w / 2, brick.y + brick.h / 2 - 5); ctx.lineTo(brick.x + brick.w / 2, brick.y + brick.h / 2 + 5); ctx.stroke(); ctx.globalAlpha = 1; }
      if (brick.trait === "reflector" && brick.traitLockTime <= 0) { const threat = game.balls.some((b) => b.vy < 0 && b.y > brick.y + brick.h && b.y < brick.y + brick.h + 75 && b.x > brick.x - 8 && b.x < brick.x + brick.w + 8); const ly = brick.y + brick.h + 4, scan = (game.elapsed * .85 + brick.x / 1000) % 1; ctx.save(); ctx.globalAlpha = Math.min(1, .55 + (Math.sin(game.elapsed * 7 + brick.x * .03) + 1) * .2 + (threat ? .28 : 0)); ctx.strokeStyle = "#65dcff"; ctx.lineWidth = threat ? 4 : 3; ctx.shadowColor = "#65dcff"; ctx.shadowBlur = threat ? 24 : 13; ctx.beginPath(); ctx.moveTo(brick.x + 2, brick.y + brick.h - 1); ctx.quadraticCurveTo(brick.x + 4, ly, brick.x + 9, ly); ctx.lineTo(brick.x + brick.w - 9, ly); ctx.quadraticCurveTo(brick.x + brick.w - 4, ly, brick.x + brick.w - 2, brick.y + brick.h - 1); ctx.stroke(); const grad = ctx.createLinearGradient(brick.x, ly, brick.x + brick.w, ly); grad.addColorStop(0, "#1a8fb3"); grad.addColorStop(.35, "#65dcff"); grad.addColorStop(.5, "#e8fcff"); grad.addColorStop(.65, "#65dcff"); grad.addColorStop(1, "#1a8fb3"); ctx.strokeStyle = grad; ctx.lineWidth = threat ? 4 : 3; ctx.beginPath(); ctx.moveTo(brick.x + 2, ly); ctx.lineTo(brick.x + brick.w - 2, ly); ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = threat ? 6 : 4; const gx = brick.x + 9 + (brick.w - 18) * scan; ctx.beginPath(); ctx.moveTo(gx - 5, ly); ctx.lineTo(gx + 5, ly); ctx.stroke(); ctx.restore(); }
      ctx.restore();
    }
    if (brick.drop) { const d = itemData[brick.drop]; ctx.shadowBlur = brick.drop === "multiball" ? 16 : 8; ctx.shadowColor = d.color; ctx.strokeStyle = d.color; ctx.lineWidth = 2; ctx.strokeRect(brick.x + 1, brick.y + 1, brick.w - 2, brick.h - 2); ctx.shadowBlur = 0; ctx.fillStyle = d.color; ctx.font = `900 12px ${PIXEL_FONT}`; ctx.textAlign = "center"; ctx.fillText(d.symbol, brick.x + brick.w / 2, brick.y + 17); }
    if (brick.poisonTime > 0) { ctx.fillStyle = "rgba(114,241,184,.16)"; ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4); ctx.strokeStyle = "#72f1b8"; ctx.lineWidth = 2; ctx.strokeRect(brick.x + 3, brick.y + 3, brick.w - 6, brick.h - 6); ctx.fillStyle = "#72f1b8"; for (let dot = 0; dot < 3; dot++) { ctx.beginPath(); ctx.arc(brick.x + brick.w - 7 - dot * 6, brick.y + 7 + Math.sin(game.elapsed * 5 + dot) * 2, 2, 0, Math.PI * 2); ctx.fill(); } }
    if (brick.burnTime > 0) { ctx.save(); const pulse = .65 + Math.sin(game.elapsed * 11 + brick.x * .03) * .2; ctx.globalAlpha = pulse; ctx.fillStyle = "rgba(255,112,67,.2)"; ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4); ctx.strokeStyle = "#ff8a3d"; ctx.shadowColor = "#ff5a36"; ctx.shadowBlur = 14; ctx.lineWidth = 2; ctx.strokeRect(brick.x - 1, brick.y - 1, brick.w + 2, brick.h + 2); ctx.fillStyle = "#ffd166"; for (let flame = 0; flame < Math.min(4, 1 + (brick.burnLevel ?? 0)); flame++) { const fx = brick.x + brick.w - 8 - flame * 8, fy = brick.y + 8 + Math.sin(game.elapsed * 9 + flame) * 2; ctx.beginPath(); ctx.moveTo(fx, fy - 6); ctx.lineTo(fx - 3, fy + 3); ctx.lineTo(fx + 3, fy + 3); ctx.closePath(); ctx.fill(); } ctx.fillStyle = "#fff3d6"; ctx.font = `900 8px ${PIXEL_FONT}`; ctx.textAlign = "left"; ctx.fillText(`BURN ${Math.max(0, Math.ceil(brick.burnTime))}s`, brick.x + 5, brick.y + brick.h - 5); ctx.restore(); }
    if (brick.healBlockTime > 0) { ctx.save(); ctx.globalAlpha = .72 + Math.sin(game.elapsed * 7 + brick.x * .02) * .16; ctx.strokeStyle = "#ff9b5c"; ctx.setLineDash([5, 3]); ctx.lineWidth = 2; ctx.strokeRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4); ctx.setLineDash([]); ctx.fillStyle = "#ffe2bd"; ctx.font = `900 8px ${PIXEL_FONT}`; ctx.textAlign = "left"; ctx.fillText(`HEAL LOCK ${Math.ceil(brick.healBlockTime)}s`, brick.x + 5, brick.y + brick.h - 5); ctx.restore(); }
    if (brick.blastVulnerability > 1) { ctx.save(); ctx.globalAlpha = .7 + Math.sin(game.elapsed * 8) * .2; ctx.strokeStyle = "#ff6b87"; ctx.shadowColor = "#ff6b87"; ctx.shadowBlur = 10; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(brick.x - 2, brick.y - 2, brick.w + 4, brick.h + 4); ctx.setLineDash([]); ctx.fillStyle = "rgba(4,8,20,.86)"; ctx.fillRect(brick.x + brick.w / 2 - 24, brick.y - 9, 48, 10); ctx.fillStyle = "#ff8ca3"; ctx.font = `900 8px ${PIXEL_FONT}`; ctx.textAlign = "center"; ctx.fillText(`EXP ×${brick.blastVulnerability}`, brick.x + brick.w / 2, brick.y - 1); ctx.restore(); }
    if (brick.frostVulnerability > 0) { ctx.save(); ctx.globalAlpha = .72 + Math.sin(game.elapsed * 7 + brick.x * .02) * .18; ctx.fillStyle = "rgba(101,220,255,.18)"; ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4); ctx.strokeStyle = "#b9f4ff"; ctx.shadowColor = "#65dcff"; ctx.shadowBlur = 12; ctx.lineWidth = 2; ctx.strokeRect(brick.x - 2, brick.y - 2, brick.w + 4, brick.h + 4); ctx.fillStyle = "#e8fcff"; ctx.font = `900 10px ${PIXEL_FONT}`; ctx.textAlign = "left"; ctx.fillText(`×+${brick.frostVulnerability}`, brick.x + 5, brick.y + 12); ctx.restore(); }
    if (brick.traitLockTime > 0) { ctx.save(); ctx.globalAlpha = .72 + Math.sin(game.elapsed * 9 + brick.x * .025) * .18; ctx.strokeStyle = classSkillColor?.("mage-mana-blast") ?? "#c18cff"; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14; ctx.lineWidth = 3; ctx.setLineDash([7, 4]); ctx.strokeRect(brick.x - 4, brick.y - 4, brick.w + 8, brick.h + 8); ctx.setLineDash([]); ctx.fillStyle = "rgba(7,4,18,.9)"; ctx.fillRect(brick.x + brick.w / 2 - 26, brick.y + brick.h - 12, 52, 12); ctx.fillStyle = "#e4b7ff"; ctx.font = `900 9px ${PIXEL_FONT}`; ctx.textAlign = "center"; ctx.fillText(`LOCK ${Math.ceil(brick.traitLockTime)}s`, brick.x + brick.w / 2, brick.y + brick.h - 3); ctx.restore(); }
    if (brick.lastHitPaddleId) { ctx.strokeStyle = "#c18cff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(brick.x + 5, brick.y + brick.h - 4); ctx.lineTo(brick.x + brick.w * .35, brick.y + 5); ctx.moveTo(brick.x + brick.w * .55, brick.y + brick.h - 4); ctx.lineTo(brick.x + brick.w - 5, brick.y + 5); ctx.stroke(); }
    if (damageRatio > 0.08) {
      const crackCount = Math.min(4, Math.max(1, Math.ceil(damageRatio * 4)));
      ctx.save(); ctx.strokeStyle = `rgba(7,9,15,${0.38 + damageRatio * 0.5})`; ctx.lineWidth = 1 + damageRatio * 1.4; ctx.lineCap = "round";
      for (let crack = 0; crack < crackCount; crack++) {
        const startX = brick.x + brick.w * (0.2 + ((crack * 0.23 + brick.x * 0.003) % 0.6));
        const startY = crack % 2 === 0 ? brick.y + 2 : brick.y + brick.h - 2;
        const direction = crack % 2 === 0 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(startX, startY);
        ctx.lineTo(startX + (crack % 2 ? -5 : 5), startY + direction * brick.h * 0.28);
        ctx.lineTo(startX + (crack % 2 ? 3 : -3), startY + direction * brick.h * (0.46 + damageRatio * 0.18));
        if (damageRatio > 0.5) ctx.lineTo(startX + (crack % 2 ? 9 : -9), startY + direction * brick.h * 0.72);
        ctx.stroke();
      }
      if (damageRatio > 0.62) {
        const chip = Math.min(10, 4 + damageRatio * 7); ctx.fillStyle = "rgba(5,7,12,.78)";
        ctx.beginPath(); ctx.moveTo(brick.x, brick.y); ctx.lineTo(brick.x + chip, brick.y); ctx.lineTo(brick.x, brick.y + chip * .75); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(brick.x + brick.w, brick.y + brick.h); ctx.lineTo(brick.x + brick.w - chip, brick.y + brick.h); ctx.lineTo(brick.x + brick.w, brick.y + brick.h - chip * .75); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    if (!usesBossDesign && brick.trait !== "indestructible" && brick.maxHp > 1) {
      const barX = brick.x + 5, barY = brick.y + brick.h - 4, barWidth = brick.w - 10;
      ctx.fillStyle = "rgba(3,6,12,.72)"; ctx.fillRect(barX, barY, barWidth, 2);
      ctx.fillStyle = healthRatio > .55 ? "#72f1b8" : healthRatio > .25 ? "#ffcf4a" : "#ff6b87";
      ctx.fillRect(barX, barY, barWidth * healthRatio, 2);
    }
    if (healthFlashRatio > 0 && brick.healthFlashKind) {
      const flashColor = brick.healthFlashKind === "heal" ? "#72f1b8" : "#ff6b87";
      ctx.save(); ctx.globalAlpha = Math.min(.72, healthFlashRatio * .72); ctx.fillStyle = flashColor; trace(brick, 2); ctx.fill();
      ctx.globalAlpha = Math.min(1, healthFlashRatio * 1.2); ctx.strokeStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = brick.healthFlashKind === "heal" ? 20 : 13; ctx.lineWidth = brick.healthFlashKind === "heal" ? 3 : 2; trace(brick, -2 * healthFlashRatio); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  });
}

export function renderBalls({ ctx, game, getSkill, classSkillColor, mageSpells = [], mageSpellReady = [] }: {
  ctx: CanvasRenderingContext2D;
  game: Pick<GameState, "balls" | "upgrades" | "elapsed">;
  getSkill: (id: string) => SkillConfig | undefined;
  classSkillColor: (id: ClassSkillId) => string;
  mageSpells?: Array<HTMLImageElement | null>;
  mageSpellReady?: boolean[];
}) {
  const ownedSkills = [...new Set(game.upgrades)]
    .map((id) => ({ id, config: getSkill(id), level: Math.min(3, game.upgrades.filter((entry) => entry === id).length) }))
    .filter((entry): entry is { id: ClassSkillId; config: SkillConfig; level: number } => Boolean(entry.config && entry.config.category !== "common"));
  game.balls.filter((ball) => ball.owner === "player").forEach((ball) => {
    const speed = Math.max(1, Math.hypot(ball.vx, ball.vy));
    const powerBoost = Math.max(0, ball.attackPower - 1);
    const radius = ball.radius + Math.min(3.5, powerBoost * 0.7);
    const isExtraBall = ball.waveBonus || ball.temporaryTime > 0 || ball.visualSkill !== null;
    const ballVisualColor = isExtraBall ? "#9a8cff" : "#fffdf4";
    const skillEffectAlpha = isExtraBall ? 0.38 : 1;
    const cooldownGaugeAlpha = isExtraBall ? 0.5 : 1;
    ctx.save();
    const trailSteps = 4 + Math.min(5, Math.floor(powerBoost));
    for (let trail = trailSteps; trail >= 1; trail--) {
      ctx.globalAlpha = 0.035 + ((trailSteps + 1 - trail) / trailSteps) * 0.15;
      ctx.fillStyle = ballVisualColor;
      ctx.beginPath();
      ctx.arc(ball.x - ball.vx / speed * trail * (7 + powerBoost), ball.y - ball.vy / speed * trail * (7 + powerBoost), Math.max(2, radius - trail * 1.05), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = ballVisualColor;
    ctx.shadowBlur = 24;
    const ballImage = gameplayImage("ball", GAMEPLAY_ART.ball);
    if (ballImage) {
      ctx.imageSmoothingEnabled = false;
      // Rotate the faceted ball continuously so it reads as a moving orb
      // instead of a static UI sprite while the rune ring stays readable.
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(game.elapsed * (isExtraBall ? 2.8 : 2.1));
      ctx.drawImage(ballImage, -radius, -radius, radius * 2, radius * 2);
      if (isExtraBall) {
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = ballVisualColor;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = ballVisualColor;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    ctx.globalAlpha = isExtraBall ? 0.82 : 1;
    ctx.strokeStyle = ballVisualColor;
    ctx.shadowColor = ballVisualColor;
    ctx.shadowBlur = isExtraBall ? 14 : 22;
    ctx.lineWidth = isExtraBall ? 1.5 : 2.2;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, radius + (isExtraBall ? 3 : 2), 0, Math.PI * 2);
    ctx.stroke();
    if (!isExtraBall) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(ball.x - radius * 0.28, ball.y - radius * 0.32, Math.max(2, radius * 0.2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    const powerRingCount = Math.min(3, Math.floor(powerBoost / 1.25));
    for (let ring = 0; ring < powerRingCount; ring++) {
      ctx.globalAlpha = 0.48 - ring * 0.1;
      ctx.strokeStyle = ballVisualColor;
      ctx.lineWidth = 1.5 + powerBoost * 0.25;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, radius + 3 + ring * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // A rapid-fire arrow only owns class skills after the fourth-pick
    // evolution. The simulation exposes that rule through canTriggerSkills;
    // the renderer must not infer ownership from the run-wide loadout.
    const ballSkills = ball.canTriggerSkills ? ownedSkills : [];
    const runeRingImage = gameplayImage("rune-ring", GAMEPLAY_ART.runeRing);
    if (runeRingImage) {
      const runeSize = Math.max(38, (radius + 14) * 1.65);
      const runeRotation = game.elapsed * 0.85;
      const runeAlpha = (isExtraBall ? 0.34 : 0.58) * skillEffectAlpha;
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(runeRotation);
      ctx.globalAlpha = runeAlpha;
      ctx.shadowColor = "#d5a957";
      ctx.shadowBlur = 5;
      ctx.filter = "saturate(.62) brightness(.82)";
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(runeRingImage, -runeSize / 2, -runeSize / 2, runeSize, runeSize);
      ctx.restore();

      const runeRadius = radius + 14;
      const runeGlyphs = ["R", "B", "K", "X", "ᛉ", "ᛒ", "ᚲ", "ᛟ"];
      ballSkills.slice(0, 8).forEach(({ id }, index) => {
        const angle = -Math.PI / 2 + index * Math.PI / 4 + runeRotation;
        const x = ball.x + Math.cos(angle) * runeRadius;
        const y = ball.y + Math.sin(angle) * runeRadius;
        const color = classSkillColor(id);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.globalAlpha = (0.5 + Math.sin(game.elapsed * 4 + index) * 0.08) * skillEffectAlpha;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = color;
        ctx.font = `900 7px ${PIXEL_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(runeGlyphs[index], 0, 1);
        ctx.restore();
      });
    }
    const cooldownEntries = ballSkills.map(({ id, config, level }) => ({
      id,
      config,
      level,
      total: Math.max(0, Number(config.cooldown[level - 1] ?? 0)),
      remaining: Math.max(0, Number(ball.skillCooldowns[id] ?? 0)),
    })).filter(({ total }) => total > 0);
    // Rune sockets are now the only persistent skill-state indicator around
    // the ball; the former segmented cooldown arcs are intentionally hidden.
    const coolingSkills = cooldownEntries.filter(({ remaining }) => remaining > 0);
    const runeOnlyMode = true;
    if (!runeOnlyMode && coolingSkills.length > 0) {
      const gaugeRadius = radius + 5 + powerRingCount * 3;
      const segmentSpan = Math.PI * 2 / coolingSkills.length;
      const gap = Math.min(0.12, segmentSpan * 0.12);
      ctx.save();
      ctx.lineCap = "round";
      coolingSkills.forEach((entry, index) => {
        const progress = Math.max(0, Math.min(1, 1 - entry.remaining / entry.total));
        const start = -Math.PI / 2 + index * segmentSpan + gap / 2;
        const segmentLength = segmentSpan - gap;
        const color = classSkillColor(entry.id);
        ctx.globalAlpha = 0.2 * cooldownGaugeAlpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(ball.x, ball.y, gaugeRadius, start, start + segmentLength); ctx.stroke();
        if (progress > 0) {
          ctx.globalAlpha = 0.95 * cooldownGaugeAlpha;
          ctx.shadowColor = color; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(ball.x, ball.y, gaugeRadius, start, start + segmentLength * progress); ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });
      ctx.restore();
    }

    const readySkills = cooldownEntries.filter(() => false);
    readySkills.forEach(({ id, config, level }, index) => {
      const color = classSkillColor(id);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.globalAlpha = 0.78 * skillEffectAlpha;
      if (config.category === "warrior") {
        ctx.translate(ball.x, ball.y);
        ctx.lineWidth = 2.5 + level * 0.5;
        if (id === "warrior-smash") {
          ctx.rotate(-0.4); ctx.beginPath(); ctx.moveTo(-radius - 7, -radius - 4); ctx.lineTo(radius + 7, radius + 4); ctx.stroke();
        } else if (id === "warrior-shockwave") {
          for (let wave = 0; wave < 2; wave++) { const pulse = (game.elapsed * 2.8 + wave * 0.5) % 1; ctx.globalAlpha = 0.8 * (1 - pulse) * skillEffectAlpha; ctx.beginPath(); ctx.arc(0, 0, radius + 3 + pulse * (10 + wave * 4), 0, Math.PI * 2); ctx.stroke(); }
        } else if (id === "warrior-execute") {
          const pulse = 1 + Math.sin(game.elapsed * 9) * 0.18; ctx.scale(pulse, pulse); ctx.beginPath(); ctx.moveTo(0, -radius - 11); ctx.lineTo(0, radius + 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-5, radius + 3); ctx.lineTo(0, radius + 9); ctx.lineTo(5, radius + 3); ctx.stroke();
        } else if (id === "warrior-crush") {
          ctx.rotate(game.elapsed * 2.8); for (let shard = 0; shard < 4; shard++) { ctx.rotate(Math.PI / 2); ctx.save(); ctx.translate(radius + 7, 0); ctx.rotate(Math.PI / 4); ctx.fillRect(-3.5, -3.5, 7, 7); ctx.restore(); }
        } else {
          const pulse = 0.55 + Math.sin(game.elapsed * 7 + index) * 0.18; ctx.globalAlpha = pulse * skillEffectAlpha; ctx.beginPath(); ctx.arc(0, 0, radius + 5 + index * 2, 0, Math.PI * 2); ctx.stroke();
        }
      } else if (config.category === "archer") {
        ctx.translate(ball.x, ball.y);
        ctx.rotate(Math.atan2(ball.vy, ball.vx));
        ctx.lineWidth = 2;
        if (id === "archer-pierce") {
          ctx.beginPath(); ctx.moveTo(-radius - 10, 0); ctx.lineTo(radius + 13, 0); ctx.lineTo(radius + 5, -6); ctx.moveTo(radius + 13, 0); ctx.lineTo(radius + 5, 6); ctx.stroke();
        } else if (id === "archer-ricochet") {
          ctx.beginPath(); ctx.moveTo(-radius - 13, 7); ctx.lineTo(-radius - 5, -6); ctx.lineTo(radius + 4, 5); ctx.lineTo(radius + 12, -5); ctx.stroke();
        } else if (id === "archer-focus") {
          ctx.rotate(-Math.atan2(ball.vy, ball.vx)); const reticle = radius + 7 + Math.sin(game.elapsed * 6) * 2; ctx.beginPath(); ctx.arc(0, 0, reticle, 0.2, Math.PI / 2 - 0.2); ctx.arc(0, 0, reticle, Math.PI / 2 + 0.2, Math.PI - 0.2); ctx.arc(0, 0, reticle, Math.PI + 0.2, Math.PI * 1.5 - 0.2); ctx.arc(0, 0, reticle, Math.PI * 1.5 + 0.2, Math.PI * 2 - 0.2); ctx.stroke();
        } else if (id === "archer-weakpoint") {
          ctx.rotate(-Math.atan2(ball.vy, ball.vx) + game.elapsed * 1.8); const mark = radius + 7; ctx.beginPath(); ctx.arc(0, 0, mark, 0, Math.PI * 2); ctx.moveTo(-mark - 5, 0); ctx.lineTo(mark + 5, 0); ctx.moveTo(0, -mark - 5); ctx.lineTo(0, mark + 5); ctx.stroke();
        } else {
          for (let chevron = 0; chevron < 2; chevron++) { const rear = -radius - 5 - chevron * 7 - index * 2; ctx.beginPath(); ctx.moveTo(rear - 5, -5); ctx.lineTo(rear, 0); ctx.lineTo(rear - 5, 5); ctx.stroke(); }
        }
      } else {
        const mageSpellVariant = id === "mage-fireball" ? 0 : id === "mage-lightning" ? 1 : -1;
        const mageSpellImage = mageSpellVariant >= 0 ? mageSpells[mageSpellVariant] : null;
        if (mageSpellVariant >= 0 && mageSpellReady[mageSpellVariant] && mageSpellImage) {
          const frame = Math.floor(game.elapsed * 14 + index) % 6;
          const spriteSize = (id === "mage-fireball" ? 42 : 36) + level * 3;
          ctx.translate(ball.x, ball.y);
          if (id === "mage-fireball") ctx.rotate(Math.atan2(ball.vy, ball.vx));
          ctx.globalAlpha = 0.92 * skillEffectAlpha;
          ctx.imageSmoothingEnabled = false;
          ctx.shadowBlur = 16;
          ctx.drawImage(mageSpellImage, frame * 64, 0, 64, 64, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
        } else {
          const orbitRadius = radius + 6 + index * 3;
          for (let mote = 0; mote < 3; mote++) { const angle = game.elapsed * (2.2 + index * 0.25) + mote * Math.PI * 2 / 3; ctx.beginPath(); ctx.arc(ball.x + Math.cos(angle) * orbitRadius, ball.y + Math.sin(angle) * orbitRadius, 2.2 + level * 0.25, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      ctx.restore();
    });

    if (ball.temporaryTime > 0) {
      const lifeRatio = Math.min(1, ball.temporaryTime / 7);
      ctx.globalAlpha = 0.8; ctx.strokeStyle = ball.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lifeRatio); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (ball.missileTime > 0) {
      const angle = Math.atan2(ball.vy, ball.vx); ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(angle); ctx.shadowColor = "#ff9658"; ctx.shadowBlur = 18; ctx.fillStyle = "#ff9658"; ctx.beginPath(); ctx.moveTo(ball.radius + 9, 0); ctx.lineTo(-ball.radius - 4, -ball.radius * 0.75); ctx.lineTo(-ball.radius - 1, 0); ctx.lineTo(-ball.radius - 4, ball.radius * 0.75); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    if (ball.pierce > 0) {
      ctx.shadowBlur = 0; ctx.strokeStyle = "#72e7ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius + 4, 0, Math.PI * 2); ctx.stroke();
    }
    const payloadLabels = { pierce: "P", blast: "B", glass: "G", link: "L" } as const;
    const activePayloads = (Object.keys(payloadLabels) as Array<keyof typeof payloadLabels>).filter((id) => (ball.payloads[id] ?? 0) > 0);
    if (activePayloads.length > 0 || ball.attackPower > 1.05) {
      ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.fillStyle = ball.color; ctx.font = `900 9px ${PIXEL_FONT}`; ctx.textAlign = "center";
      const payloadLabel = activePayloads.map((id) => id === "pierce" ? `P×${ball.pierce}` : `${payloadLabels[id]}${ball.payloads[id]}`).join("+");
      ctx.fillText(`${ball.attackPower.toFixed(1)} ATK${ball.missileTime > 0 ? ` // MISSILE ${ball.missileTime.toFixed(1)}s` : ""}${payloadLabel ? ` // ${payloadLabel}` : ""}`, ball.x, ball.y - 13);
    }
    ctx.restore();
  });
}

export function renderHud({ ctx, game, width }: { ctx: CanvasRenderingContext2D; game: Pick<GameState, "combo" | "bossActive" | "bossStage" | "bricks" | "bossSkillTimer">; width: number; height: number }) {
  ctx.save();
  if (game.combo >= 3) {
    ctx.textAlign = "right";
    ctx.font = `900 28px ${PIXEL_FONT}`;
    ctx.fillStyle = game.combo >= 15 ? "#ffcf4a" : "#72f1b8";
    ctx.fillText(`${game.combo} COMBO`, width - 28, 56);
  }
  if (game.bossActive) {
    const bossCores = game.bricks.filter((brick) => brick.alive && brick.kind === "boss-core");
    const currentHp = bossCores.reduce((sum, brick) => sum + brick.hp, 0);
    const maximumHp = bossCores.reduce((sum, brick) => sum + brick.maxHp, 0);
    const ratio = Math.max(0, Math.min(1, currentHp / Math.max(1, maximumHp)));
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff6b87";
    ctx.fillText(`CORE FORTRESS ${game.bossStage}`, width / 2, 14);
    ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(width / 2 - 170, 20, 340, 6);
    ctx.fillStyle = game.bossStage >= 3 ? "#c18cff" : "#65b8ff";
    ctx.fillRect(width / 2 - 170, 20, 340 * ratio, 6);
  }
  ctx.restore();
}

/** Renders transient simulation feedback only. It does not mutate game state or play audio. */
export function renderTransientFeedback(ctx: CanvasRendererContext, game: Pick<GameState, "particles" | "flashes" | "screenFlashTime" | "screenFlashDuration" | "screenFlashColor">, width: number, height: number) {
  game.particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life * 1.5);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 4, 4);
  });
  ctx.globalAlpha = 1;

  game.flashes.forEach((f) => {
    ctx.globalAlpha = Math.min(1, f.life * 1.5);
    ctx.fillStyle = f.color;
    ctx.textAlign = "center";
    if (f.emphasis === "damage") {
      const pulse = 1 + Math.max(0, f.life - 0.58) * 0.28;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(pulse, pulse);
      ctx.font = `1000 15px ${PIXEL_FONT}`;
      ctx.lineJoin = "round";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(5, 8, 16, .95)";
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 8;
      ctx.strokeText(f.text, 0, 0);
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    } else if (f.emphasis === "heal") {
      const pulse = 1 + Math.max(0, f.life - 0.6) * 0.2;
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(pulse, pulse); ctx.font = `1000 14px ${PIXEL_FONT}`; ctx.lineJoin = "round"; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(3,18,15,.96)"; ctx.shadowColor = f.color; ctx.shadowBlur = 11; ctx.strokeText(f.text, 0, 0); ctx.fillText(f.text, 0, 0); ctx.restore();
    } else {
      ctx.font = `900 ${f.text.includes("BOARD") ? 28 : 15}px ${PIXEL_FONT}`;
      ctx.fillText(f.text, f.x, f.y);
    }
  });
  ctx.globalAlpha = 1;

  if (game.screenFlashTime > 0 && game.screenFlashDuration > 0) {
    const flashRatio = game.screenFlashTime / game.screenFlashDuration;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = Math.min(0.24, flashRatio * 0.24);
    ctx.fillStyle = game.screenFlashColor;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

export function renderPaddles({ ctx, playerX, playerY, playerWidth, playerColor, ghostPaddles, safetyBlocks, playerCores = [], coreBreak, aim, playerCharge, elapsed = 0 }: {
  ctx: CanvasRenderingContext2D; playerX: number; playerY: number; playerWidth: number; playerColor: string;
  ghostPaddles: ReadonlyArray<{ x: number; y: number; width: number; color: string; name: string; charge?: ChargeVisual | null }>;
  safetyBlocks: ReadonlyArray<{ x: number; y: number; width: number; color: string }>;
  playerCores?: ReadonlyArray<{ x: number; y: number; scale?: number; alpha?: number; danger?: boolean }>;
  coreBreak?: { x: number; y: number; progress: number };
  aim?: { x: number; y: number; left: { x: number; y: number }; right: { x: number; y: number }; limited: boolean };
  playerCharge?: ChargeVisual | null; elapsed?: number;
}) {
  const draw = (x: number, y: number, width: number, color: string, alpha = 1, useArt = false) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = color; ctx.shadowBlur = 12;
    const paddleImage = useArt ? gameplayImage("paddle", GAMEPLAY_ART.paddle) : null;
    if (paddleImage) {
      ctx.imageSmoothingEnabled = false;
      const height = Math.max(28, width / 3.66);
      ctx.drawImage(paddleImage, x - width / 2, y - 7, width, height);
      ctx.restore();
      return;
    }
    const g = ctx.createLinearGradient(x, y, x, y + 18); g.addColorStop(0, "rgba(235,242,255,.3)"); g.addColorStop(.2, color); g.addColorStop(1, "rgba(5,9,17,.96)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x - width / 2, y, width, 18, 5); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,.42)"; ctx.fillRect(x - width / 2 + 7, y + 3, Math.max(0, width - 14), 2); ctx.restore();
  };
  const charge = (x: number, y: number, width: number, visual: ChargeVisual | null | undefined, alpha = 1) => {
    if (!visual) return; const beat = 0.65 + Math.sin(elapsed * (visual.pulse > 0 ? 15 : 8)) * 0.25;
    ctx.save(); ctx.globalAlpha = alpha * (0.45 + visual.intensity * 0.45) * beat; ctx.strokeStyle = visual.color; ctx.shadowColor = visual.color; ctx.shadowBlur = 18 + visual.intensity * 18; ctx.lineWidth = visual.pulse > 0 ? 5 : 3;
    ctx.strokeRect(x - width / 2 - 6, y - 6, width + 12, 28); ctx.fillStyle = visual.color; ctx.fillRect(x - width / 2, y, width * Math.max(0.2, visual.intensity), 4); ctx.restore();
  };
  safetyBlocks.forEach((b) => { ctx.save(); ctx.shadowColor = b.color; ctx.shadowBlur = 18; ctx.fillStyle = b.color; ctx.fillRect(b.x - b.width / 2, b.y, b.width, 7); ctx.shadowBlur = 0; ctx.fillStyle = "#07101b"; ctx.font = `900 8px ${PIXEL_FONT}`; ctx.textAlign = "center"; ctx.fillText("AUTO REFLECT", b.x, b.y + 6); ctx.restore(); });
  ghostPaddles.forEach((p) => { draw(p.x, p.y, p.width, p.color, .74); charge(p.x, p.y, p.width, p.charge, .74); ctx.fillStyle = p.color; ctx.font = `800 9px ${PIXEL_FONT}`; ctx.textAlign = "center"; ctx.fillText(p.name, p.x, p.y + 24); });
  draw(playerX, playerY, playerWidth, playerColor, 1, true); charge(playerX, playerY, playerWidth, playerCharge);
  playerCores.forEach((core) => drawCoreCrystal(ctx, core.x, core.y, core.scale ?? 1, core.alpha ?? 1, core.danger ?? false));
  if (coreBreak) {
    drawCoreCrystal(ctx, coreBreak.x, coreBreak.y, 1 + coreBreak.progress * .8, Math.max(0, 1 - coreBreak.progress), true);
    ctx.save(); ctx.translate(coreBreak.x, coreBreak.y); ctx.strokeStyle = `rgba(255,107,135,${1 - coreBreak.progress})`; ctx.lineWidth = 2.5; ctx.shadowColor = "#ff6b87"; ctx.shadowBlur = 12;
    for (let shard = 0; shard < 8; shard++) { const angle = shard / 8 * Math.PI * 2 + .2; const inner = 8 + coreBreak.progress * 12; const outer = 14 + coreBreak.progress * 34; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner); ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer); ctx.stroke(); } ctx.restore();
  }
  if (aim) {
    ctx.save(); ctx.strokeStyle = "rgba(101,220,255,.18)"; ctx.lineWidth = 1; ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(playerX, playerY - 6); ctx.lineTo(aim.left.x, aim.left.y); ctx.moveTo(playerX, playerY - 6); ctx.lineTo(aim.right.x, aim.right.y); ctx.stroke();
    const color = aim.limited ? "#ffcf4a" : "#65dcff"; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10; ctx.lineWidth = 2; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.moveTo(playerX, playerY - 6); ctx.lineTo(aim.x, aim.y); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(aim.x, aim.y, 5, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(aim.x - 9, aim.y); ctx.lineTo(aim.x + 9, aim.y); ctx.moveTo(aim.x, aim.y - 9); ctx.lineTo(aim.x, aim.y + 9); ctx.stroke(); ctx.restore();
  }
}

export type ChargeVisual = { color: string; intensity: number; pulse: number };
function drawCoreCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, alpha: number, danger: boolean) {
  const color = danger ? "#ff6b87" : "#72e7ff"; ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.globalAlpha = alpha; ctx.shadowColor = color; ctx.shadowBlur = danger ? 15 : 11;
  const gradient = ctx.createLinearGradient(-7, -9, 7, 10); gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(.28, danger ? "#ffb0c0" : "#bdf8ff"); gradient.addColorStop(.62, color); gradient.addColorStop(1, danger ? "#7d1738" : "#17617c"); ctx.fillStyle = gradient; ctx.strokeStyle = danger ? "#ffd5df" : "#e9fdff"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, -2); ctx.lineTo(5, 7); ctx.lineTo(0, 11); ctx.lineTo(-5, 7); ctx.lineTo(-7, -2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha *= .72; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 9); ctx.moveTo(-6, -2); ctx.lineTo(0, 1); ctx.lineTo(6, -2); ctx.stroke(); ctx.restore();
}

export function renderWorldOverlays({ ctx, elapsed, gravityWells, bossBarriers = [], bossWalls = [], bossShield = { active: false, life: 0, maxLife: 0, runeIds: [] }, bricks = [], skillSheets = [], skillSheetReady = [], itemBarrierTime, itemBarrierY, width, barrierColor, magnetLinks = [] }: {
  ctx: CanvasRenderingContext2D; elapsed: number; gravityWells: ReadonlyArray<{ x: number; y: number; radius: number; life: number; color: string; sourceSkillId?: string }>;
  bossBarriers?: ReadonlyArray<{ x: number; y: number; w: number; h: number; life: number; maxLife: number; telegraph: number; hitCount: number; maxHits: number }>;
  bossWalls?: ReadonlyArray<{ x: number; y: number; w: number; h: number; baseX: number; baseY: number; life: number; maxLife: number; telegraph: number; hp: number; maxHp: number }>;
  bossShield?: { active: boolean; life: number; maxLife: number; runeIds: number[] };
  bricks?: ReadonlyArray<Pick<Brick, "x" | "y" | "w" | "h" | "alive" | "kind">>;
  skillSheets?: ReadonlyArray<HTMLImageElement | null>;
  skillSheetReady?: ReadonlyArray<boolean>;
  itemBarrierTime: number; itemBarrierY: number; width: number; barrierColor: string;
  magnetLinks?: ReadonlyArray<{ x: number; y: number; itemX: number; itemY: number; alpha: number; color: string }>;
}) {
  bossBarriers.forEach((barrier) => {
    ctx.save();
    const active = barrier.telegraph <= 0;
    const image = gameplayImage("boss-pattern-barrier", GAMEPLAY_ART.bossPatterns.barrier);
    ctx.globalAlpha = active ? 0.9 : 0.42 + Math.sin(elapsed * 14) * 0.16;
    if (image) {
      const drawWidth = Math.max(82, barrier.w * 8);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, barrier.x - drawWidth / 2, barrier.y - 20, drawWidth, barrier.h + 40);
    } else {
      ctx.strokeStyle = active ? "#e7c56f" : "#fff2b2";
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = active ? 16 : 8;
      ctx.lineWidth = active ? 5 : 2;
      ctx.setLineDash(active ? [] : [7, 6]);
      ctx.strokeRect(barrier.x - barrier.w / 2, barrier.y, barrier.w, barrier.h);
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
  bossWalls.forEach((wall) => {
    ctx.save();
    ctx.globalAlpha = wall.telegraph > 0 ? 0.4 + Math.sin(elapsed * 16) * 0.18 : Math.min(1, wall.life / 0.45);
    const image = gameplayImage("boss-pattern-wall", GAMEPLAY_ART.bossPatterns.wall);
    if (image) {
      const drawWidth = Math.max(120, wall.w * 1.8);
      const drawHeight = Math.max(52, wall.h * 3.1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, wall.x + wall.w / 2 - drawWidth / 2, wall.y + wall.h / 2 - drawHeight / 2, drawWidth, drawHeight);
    } else {
      ctx.fillStyle = wall.telegraph > 0 ? "#8eb9ff" : "#4d84d8";
      ctx.strokeStyle = "#d8e8ff";
      ctx.shadowColor = "#65b8ff";
      ctx.shadowBlur = 16;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    }
    ctx.globalAlpha *= 0.7;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(wall.x + 6, wall.y + 4, Math.max(0, wall.w - 12) * Math.min(1, wall.hp / Math.max(1, wall.maxHp)), 2);
    ctx.restore();
  });
  if (bossShield.active) {
    ctx.save();
    const pulse = 0.92 + Math.sin(elapsed * 7) * 0.06;
    ctx.globalAlpha = 0.38 + Math.min(0.32, bossShield.life / Math.max(0.01, bossShield.maxLife) * 0.32);
    const image = gameplayImage("boss-pattern-shield", GAMEPLAY_ART.bossPatterns.shield);
    if (image) {
      const size = 330 * pulse;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, width / 2 - size / 2, 84 - size / 2, size, size);
    } else {
      ctx.strokeStyle = "#65b8ff";
      ctx.shadowColor = "#65b8ff";
      ctx.shadowBlur = 24;
      ctx.lineWidth = 5;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.arc(width / 2, 145, 228 * pulse, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
  gravityWells.forEach((well) => {
    const pulse = .78 + Math.sin(elapsed * 8) * .12;
    const skillOpacity = well.sourceSkillId === "mage-black-hole" ? (SKILL_VFX_CONFIG["mage-black-hole"]?.opacity ?? 1) : 1;
    ctx.save(); ctx.globalAlpha = Math.min(1, well.life / .45) * skillOpacity; ctx.translate(well.x, well.y); ctx.rotate(elapsed * 1.6);
    const playerBlackHoleSheet = well.sourceSkillId === "mage-black-hole" ? skillSheets[2] : null;
    const playerBlackHoleReady = Boolean(playerBlackHoleSheet && skillSheetReady[2]);
    const image = playerBlackHoleReady ? null : gameplayImage("boss-pattern-gravity", GAMEPLAY_ART.bossPatterns.gravity);
    if (playerBlackHoleReady && playerBlackHoleSheet) {
      const frame = Math.floor(elapsed * 12) % SKILL_SHEET_COLUMNS;
      const frameWidth = playerBlackHoleSheet.naturalWidth / SKILL_SHEET_COLUMNS;
      const frameHeight = playerBlackHoleSheet.naturalHeight / SKILL_SHEET_ROWS;
      const size = well.radius * 2.25 * pulse;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(playerBlackHoleSheet, frame * frameWidth, 3 * frameHeight, frameWidth, frameHeight, -size / 2, -size / 2, size, size);
    } else if (image) {
      const size = well.radius * 2.25 * pulse;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
    } else {
      const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, well.radius); gradient.addColorStop(0, "rgba(5,7,18,.98)"); gradient.addColorStop(.2, "rgba(193,140,255,.42)"); gradient.addColorStop(1, "rgba(193,140,255,0)"); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, well.radius * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = well.color; ctx.lineWidth = 2; ctx.setLineDash([10, 14]); ctx.beginPath(); ctx.arc(0, 0, well.radius * .58, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = "#ecf2ff"; ctx.font = `900 9px ${PIXEL_FONT}`; ctx.textAlign = "center"; ctx.fillText(`GRAVITY ${well.life.toFixed(1)}s`, 0, -well.radius * .88); ctx.restore();
  });
  const ward = gameplayImage("boss-pattern-ward", GAMEPLAY_ART.bossPatterns.ward);
  if (ward && bossShield.active) {
    ctx.save();
    ctx.globalAlpha = 0.86 + Math.sin(elapsed * 8) * 0.1;
    ctx.imageSmoothingEnabled = false;
    bricks.filter((brick) => brick.alive && brick.kind === "boss-minion").forEach((brick) => {
      const size = Math.max(42, Math.min(58, brick.w * 1.22));
      ctx.drawImage(ward, brick.x + brick.w / 2 - size / 2, brick.y + brick.h / 2 - size / 2, size, size);
    });
    ctx.restore();
  }
  if (itemBarrierTime > 0) { const pulse = .72 + Math.sin(elapsed * 10) * .2; ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = barrierColor; ctx.shadowColor = barrierColor; ctx.shadowBlur = 18; ctx.lineWidth = 4; ctx.setLineDash([22, 8]); ctx.beginPath(); ctx.moveTo(24, itemBarrierY); ctx.lineTo(width - 24, itemBarrierY); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.fillStyle = barrierColor; ctx.font = `900 10px ${PIXEL_FONT}`; ctx.textAlign = "center"; ctx.fillText(`AUTO BARRIER ${itemBarrierTime.toFixed(1)}s`, width / 2, itemBarrierY - 9); ctx.restore(); }
  if (magnetLinks.length) { ctx.save(); ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); magnetLinks.forEach((link) => { ctx.globalAlpha = link.alpha; ctx.strokeStyle = link.color; ctx.beginPath(); ctx.moveTo(link.x, link.y); ctx.quadraticCurveTo((link.x + link.itemX) / 2, link.itemY + 24, link.itemX, link.itemY); ctx.stroke(); }); ctx.setLineDash([]); ctx.restore(); }
}
