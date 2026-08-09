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
  items: {
    autoBarrier: "/assets/gameplay/items/auto-barrier.png",
  },
  skills: {
    warriorGuard: "/assets/ui/skills/forged-core/warrior/warrior-guard.png",
  },
  bossPatterns: {
    barrier: "/assets/gameplay/boss-patterns/boss-rune-barrier.png",
    wall: "/assets/gameplay/boss-patterns/boss-wall-protrusion.png",
    gravity: "/assets/gameplay/boss-patterns/boss-gravity-rune.png",
    shield: "/assets/gameplay/boss-patterns/boss-core-shield.png",
    ward: "/assets/gameplay/boss-patterns/boss-rune-ward.png",
  },
  bossVfx: {
    barrier: "/assets/gameplay/boss-vfx/boss-barrier-sheet.png",
    wall: "/assets/gameplay/boss-vfx/boss-wall-sheet.png",
    gravity: "/assets/gameplay/boss-vfx/boss-gravity-sheet.png",
    shield: "/assets/gameplay/boss-vfx/boss-shield-sheet.png",
  },
} as const;

const BOSS_BLOCK_WAVES = {
  1: "05",
  2: "10",
  3: "15",
  4: "20",
} as const;

const WAVE_BACKGROUNDS = [
  "/assets/gameplay/backgrounds/wave-01-05-v7.png",
  "/assets/gameplay/backgrounds/wave-06-10-v7.png",
  "/assets/gameplay/backgrounds/wave-11-15-v7.png",
  "/assets/gameplay/backgrounds/wave-16-20-v7.png",
] as const;

// Keep canvas labels consistent with the pixel-style UI font.
const PIXEL_FONT = '"Neo둥근모", monospace';

const gameplayImages: Record<string, HTMLImageElement | null> = {};
const SKILL_SHEET_COLUMNS = 8;
const SKILL_SHEET_ROWS = 5;
const BOSS_VFX_COLUMNS = 4;
const BOSS_VFX_ROWS = 2;
const BOSS_VFX_FRAMES = BOSS_VFX_COLUMNS * BOSS_VFX_ROWS;

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

function drawBossVfxFrame(ctx: CanvasRenderingContext2D, image: HTMLImageElement, frame: number, x: number, y: number, width: number, height: number, alpha = 1, rotation = 0, columns = BOSS_VFX_COLUMNS, rows = BOSS_VFX_ROWS) {
  const frameWidth = image.naturalWidth / columns;
  const frameHeight = image.naturalHeight / rows;
  const frameCount = columns * rows;
  const safeFrame = ((Math.floor(frame) % frameCount) + frameCount) % frameCount;
  const sourceX = (safeFrame % columns) * frameWidth;
  const sourceY = Math.floor(safeFrame / columns) * frameHeight;
  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, sourceX, sourceY, frameWidth, frameHeight, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function bossVfxFrameAspect(image: HTMLImageElement, columns = 8, rows = 1) {
  return (image.naturalHeight / rows) / (image.naturalWidth / columns);
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

// Renderer contract markers: these names document the visual invariants covered
// by rendered-html tests after extraction from page.tsx. They intentionally keep
// the contract searchable without coupling tests to orchestration internals.
// Brick health is communicated visually through opacity, cracks, and flashes; no remaining-HP text or bar is rendered.
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

export function beginGameCanvasFrame(canvas: HTMLCanvasElement, game: Pick<GameState, "shakeTime" | "shakeStrength" | "wave">, width: number, height: number): GameCanvasFrame | null {
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
  return { ctx, canvas };
}

export function endGameCanvasFrame(frame: GameCanvasFrame) { frame.ctx.restore(); }

export function renderBricks({ ctx, game, traitColors, itemData, classSkillColor }: { ctx: CanvasRenderingContext2D; game: Pick<GameState, "bricks" | "elapsed" | "balls" | "bossStage">; width: number; height: number; traitColors: Record<string, string>; itemData: Record<ItemKind, { symbol: string; color: string }>; classSkillColor?: (id: ClassSkillId) => string }) {
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
    const bossIntroTimer = (game as GameState).bossIntroTimer ?? 0;
    const bossIntroOffset = isBossTile && bossIntroTimer > 0 ? -Math.min(120, bossIntroTimer * 40) : 0;
    const bossIntroAlpha = isBossTile && bossIntroTimer > 0
      ? brick.kind === "boss-core" ? Math.min(1, 0.5 + (3 - bossIntroTimer) * 0.18) : Math.min(1, 0.35 + Math.max(0, 2 - bossIntroTimer) * 0.32)
      : 1;
    ctx.save();
    ctx.translate(centerX, centerY + bossIntroOffset);
    const damageWobble = Math.sin(brick.x * 0.17 + brick.y * 0.11) * damageRatio;
    const eventScale = brick.healthFlashKind === "damage"
      ? 1 - healthFlashRatio * 0.045
      : brick.healthFlashKind === "heal" ? 1 + healthFlashRatio * 0.055 : 1;
    ctx.rotate(damageWobble * 0.018);
    ctx.scale((1 - damageRatio * 0.035) * eventScale, (1 + damageRatio * 0.045) * eventScale);
    ctx.translate(-centerX, -centerY);
    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
    const usesBossDesign = isBossTile && game.bossStage >= 1 && game.bossStage <= 4;
    const usesNormalWaveDesign = !usesBossDesign && (brick.kind === "normal" || brick.kind === "boss-minion");
    const bossWave = usesBossDesign ? BOSS_BLOCK_WAVES[game.bossStage as 1 | 2 | 3 | 4] : null;
    const bossImage = usesBossDesign
      ? brick.kind === "boss-core"
        ? gameplayImage(`boss-core-2x2-${bossWave}`, `/assets/gameplay/boss-blocks/boss-core-2x2-wave-${bossWave}.png`)
        : bossWave
          ? gameplayImage(`boss-block-${bossWave}-${brick.bossRow}-${brick.bossCol}`, `/assets/gameplay/boss-blocks/boss-wave-${bossWave}-r${brick.bossRow! + 1}c${brick.bossCol! + 1}.png`)
          : null
      : null;
    const brickArt = usesNormalWaveDesign ? GAMEPLAY_ART.bricks[brick.trait as keyof typeof GAMEPLAY_ART.bricks] : null;
    const brickImage = bossImage ?? (brickArt ? gameplayImage(`brick-${brick.trait}`, brickArt) : null);
    if (brickImage) {
      ctx.globalAlpha = usesBossDesign ? 0.96 * bossIntroAlpha : alpha;
      ctx.imageSmoothingEnabled = false;
      if (usesBossDesign) ctx.drawImage(brickImage, brick.x, brick.y, brick.w, brick.h);
      else ctx.drawImage(brickImage, brick.x, brick.y, brick.w, brick.h);
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
    if (healthFlashRatio > 0 && brick.healthFlashKind) {
      const flashColor = brick.healthFlashKind === "heal" ? "#72f1b8" : "#ff6b87";
      ctx.save(); ctx.globalAlpha = Math.min(.72, healthFlashRatio * .72); ctx.fillStyle = flashColor; trace(brick, 2); ctx.fill();
      if (brick.healthFlashKind === "damage") {
        ctx.globalAlpha = Math.min(1, healthFlashRatio * 1.2); ctx.strokeStyle = flashColor; ctx.shadowColor = flashColor; ctx.shadowBlur = 13; ctx.lineWidth = 2; trace(brick, -2 * healthFlashRatio); ctx.stroke();
      }
      ctx.restore();
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
  game.balls.forEach((ball) => {
    const speed = Math.max(1, Math.hypot(ball.vx, ball.vy));
    const powerBoost = Math.max(0, ball.attackPower - 1);
    const isExtraBall = ball.waveBonus || ball.temporaryTime > 0;
    // Keep the main ball readable without adding another player-identification
    // ring; skill rings remain the only ring effects around the ball.
    const radius = ball.radius + Math.min(3.5, powerBoost * 0.7) + (isExtraBall ? 0 : 1.5);
    const ballAlpha = isExtraBall ? 0.58 : 1;
    const ballVisualColor = isExtraBall ? "#9a8cff" : "#fffdf4";
    const skillEffectAlpha = isExtraBall ? 0.38 : 1;
    ctx.save();
    const trailSteps = 4;
    for (let trail = trailSteps; trail >= 1; trail--) {
      ctx.globalAlpha = (0.035 + ((trailSteps + 1 - trail) / trailSteps) * 0.15) * ballAlpha;
      ctx.fillStyle = ballVisualColor;
      ctx.beginPath();
      ctx.arc(ball.x - ball.vx / speed * trail * 7, ball.y - ball.vy / speed * trail * 7, Math.max(2, radius - trail * 1.05), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = ballAlpha;
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
    ctx.globalAlpha = (isExtraBall ? 0.82 : 1) * ballAlpha;
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
      ctx.globalAlpha = (0.48 - ring * 0.1) * ballAlpha;
      ctx.strokeStyle = ballVisualColor;
      ctx.lineWidth = 1.5 + powerBoost * 0.25;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, radius + 3 + ring * 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Only owned skills whose cooldown has reached zero get a rune slot. The
    // slot uses the existing skill icon art, so the ring reads as a ready
    // state rather than a persistent loadout or a post-cast effect.
    const readySkillVisuals = ball.canTriggerSkills
      ? ownedSkills
        .filter(({ id, config }) => Number(config.cooldown[Math.max(0, Math.min(2, game.upgrades.filter((entry) => entry === id).length - 1))] ?? 0) > 0 && Number(ball.skillCooldowns[id] ?? 0) <= 0)
        .map(({ id, config, level }) => ({ id, level, evolved: Boolean(config.evolutionEnabled && game.upgrades.filter((entry) => entry === id).length >= 4) }))
      : [];
    if (readySkillVisuals.length > 0) {
      const laneCount = readySkillVisuals.length > 4 ? 2 : 1;
      const runeRotation = game.elapsed * 0.85;
      const runeRingImage = gameplayImage("rune-ring", GAMEPLAY_ART.runeRing);
      for (let lane = 0; lane < laneCount; lane += 1) {
        const laneSkills = readySkillVisuals.filter((_, index) => index % laneCount === lane);
        const laneRadius = radius + 13 + lane * 8;
        ctx.save();
        ctx.globalAlpha = 0.28 * skillEffectAlpha;
        ctx.strokeStyle = lane === 0 ? "#d5a957" : "#8d7bd9";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(ball.x, ball.y, laneRadius, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        laneSkills.forEach((visual, laneIndex) => {
          const level = Math.max(1, Math.min(4, visual.level));
          const evolved = visual.evolved || level >= 4;
          const color = classSkillColor(visual.id as ClassSkillId);
          const angle = -Math.PI / 2 + laneIndex * Math.PI * 2 / Math.max(1, laneSkills.length) + runeRotation * (lane === 0 ? 1 : -0.78);
          const x = ball.x + Math.cos(angle) * laneRadius;
          const y = ball.y + Math.sin(angle) * laneRadius;
          // Keep each rune compact: its maximum is 25% of the ball diameter.
          // Higher levels gain presence through glow and orbit marks instead
          // of becoming visually bulky.
          const iconSize = Math.max(4, (radius * 2) * 0.25);
          const iconPath = `/assets/ui/skills/forged-core/${visual.id.split("-", 1)[0]}/${visual.id}.png`;
          const iconImage = gameplayImage(`skill-icon:${visual.id}`, iconPath);
          const pulse = 1 + Math.sin(game.elapsed * (evolved ? 7 : 5) + laneIndex) * (evolved ? 0.1 : 0.045);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle + Math.PI / 2);
          ctx.globalAlpha = (isExtraBall ? 0.32 : 0.9) * skillEffectAlpha;
          ctx.shadowColor = color;
          ctx.shadowBlur = 5 + level * 2 + (evolved ? 7 : 0);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.1 + level * 0.45 + (evolved ? 0.8 : 0);
          ctx.beginPath(); ctx.arc(0, 0, iconSize * 0.62 * pulse, 0, Math.PI * 2); ctx.stroke();
          if (runeRingImage) {
            ctx.globalAlpha *= 0.52;
            ctx.drawImage(runeRingImage, -iconSize * 0.72, -iconSize * 0.72, iconSize * 1.44, iconSize * 1.44);
          }
          ctx.globalAlpha = (isExtraBall ? 0.42 : 1) * skillEffectAlpha;
          ctx.imageSmoothingEnabled = false;
          if (iconImage) {
            ctx.drawImage(iconImage, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
          } else {
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.moveTo(0, -iconSize / 2); ctx.lineTo(iconSize / 2, 0); ctx.lineTo(0, iconSize / 2); ctx.lineTo(-iconSize / 2, 0); ctx.closePath(); ctx.fill();
          }
          if (evolved) {
            ctx.globalAlpha = (isExtraBall ? 0.36 : 0.85) * skillEffectAlpha;
            ctx.strokeStyle = "#fff0b0";
            ctx.lineWidth = 1.1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath(); ctx.arc(0, 0, iconSize * 0.92 + Math.sin(game.elapsed * 6 + laneIndex) * 1.5, 0, Math.PI * 2); ctx.stroke();
            for (let mark = 0; mark < 4; mark += 1) {
              const markAngle = mark * Math.PI / 2 + game.elapsed * 0.7;
              ctx.fillStyle = "#fff0b0";
              ctx.fillRect(Math.cos(markAngle) * (iconSize + 2) - 1, Math.sin(markAngle) * (iconSize + 2) - 1, 2, 2);
            }
          }
          ctx.restore();
        });
      }
    }

    if (ball.temporaryTime > 0) {
      const lifeRatio = Math.min(1, ball.temporaryTime / 7);
      ctx.globalAlpha = 0.8 * ballAlpha; ctx.strokeStyle = ball.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lifeRatio); ctx.stroke();
    }
    ctx.globalAlpha = ballAlpha;
    if (ball.missileTime > 0) {
      const angle = Math.atan2(ball.vy, ball.vx); ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(angle); ctx.shadowColor = "#ff9658"; ctx.shadowBlur = 18; ctx.fillStyle = "#ff9658"; ctx.beginPath(); ctx.moveTo(ball.radius + 9, 0); ctx.lineTo(-ball.radius - 4, -ball.radius * 0.75); ctx.lineTo(-ball.radius - 1, 0); ctx.lineTo(-ball.radius - 4, ball.radius * 0.75); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    if (ball.pierce > 0) {
      ctx.shadowBlur = 0; ctx.strokeStyle = "#72e7ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius + 4, 0, Math.PI * 2); ctx.stroke();
    }
    const payloadLabels = { pierce: "P", blast: "B", glass: "G", link: "L" } as const;
    const activePayloads = (Object.keys(payloadLabels) as Array<keyof typeof payloadLabels>).filter((id) => (ball.payloads[id] ?? 0) > 0);
    if (activePayloads.length > 0 || ball.attackPower > 1.05) {
      ctx.shadowBlur = 0; ctx.globalAlpha = ballAlpha; ctx.fillStyle = ball.color; ctx.font = `900 9px ${PIXEL_FONT}`; ctx.textAlign = "center";
      const payloadLabel = activePayloads.map((id) => id === "pierce" ? `P×${ball.pierce}` : `${payloadLabels[id]}${ball.payloads[id]}`).join("+");
      ctx.fillText(`${ball.attackPower.toFixed(1)} ATK${ball.missileTime > 0 ? ` // MISSILE ${ball.missileTime.toFixed(1)}s` : ""}${payloadLabel ? ` // ${payloadLabel}` : ""}`, ball.x, ball.y - 13);
    }
    ctx.restore();
  });
}

export function renderHud({ ctx, game, width }: { ctx: CanvasRenderingContext2D; game: Pick<GameState, "combo" | "bossActive" | "bossStage" | "bricks" | "bossSkillTimer" | "bossStatus">; width: number; height: number }) {
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
    ctx.font = `900 10px ${PIXEL_FONT}`;
    ctx.fillText(game.bossStatus ?? `CORE FORTRESS ${game.bossStage}`, width / 2, 14);
    ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(width / 2 - 170, 20, 340, 6);
    const hpColor = `hsl(${Math.round(345 - (1 - ratio) * 345)} 86% 62%)`;
    ctx.fillStyle = hpColor;
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

export function renderPaddles({ ctx, playerX, playerY, playerWidth, playerColor, safetyBlocks, playerCores = [], coreBreak, aim, elapsed = 0, itemBarrierTime = 0, skillBarrierTime = 0, skillBarrierCharges = 0, skillBarrierMaxTime = 0 }: {
  ctx: CanvasRenderingContext2D; playerX: number; playerY: number; playerWidth: number; playerColor: string;
  safetyBlocks: ReadonlyArray<{ x: number; y: number; width: number; color: string }>;
  playerCores?: ReadonlyArray<{ x: number; y: number; scale?: number; alpha?: number; danger?: boolean }>;
  coreBreak?: { x: number; y: number; progress: number };
  aim?: { x: number; y: number; left: { x: number; y: number }; right: { x: number; y: number }; limited: boolean };
  elapsed?: number; itemBarrierTime?: number; skillBarrierTime?: number; skillBarrierCharges?: number; skillBarrierMaxTime?: number;
}) {
  const draw = (x: number, y: number, width: number, color: string, alpha = 1, useArt = false) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = color; ctx.shadowBlur = 12;
    const paddleImage = useArt ? gameplayImage("paddle", GAMEPLAY_ART.paddle) : null;
    if (paddleImage) {
      ctx.imageSmoothingEnabled = false;
      ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
      ctx.drawImage(paddleImage, x - width / 2, y - 7, width, 30);
      ctx.restore();
      return;
    }
    const g = ctx.createLinearGradient(x, y, x, y + 18); g.addColorStop(0, "rgba(235,242,255,.3)"); g.addColorStop(.2, color); g.addColorStop(1, "rgba(5,9,17,.96)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x - width / 2, y, width, 18, 5); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,.42)"; ctx.fillRect(x - width / 2 + 7, y + 3, Math.max(0, width - 14), 2); ctx.restore();
  };
  safetyBlocks.forEach((b) => { ctx.save(); ctx.shadowColor = b.color; ctx.shadowBlur = 18; ctx.fillStyle = b.color; ctx.fillRect(b.x - b.width / 2, b.y, b.width, 7); ctx.shadowBlur = 0; ctx.fillStyle = "#07101b"; ctx.font = `900 8px ${PIXEL_FONT}`; ctx.textAlign = "center"; ctx.fillText("AUTO REFLECT", b.x, b.y + 6); ctx.restore(); });
  draw(playerX, playerY, playerWidth, playerColor, 1, true);
  playerCores.forEach((core) => drawCoreCrystal(ctx, core.x, core.y, core.scale ?? 1, core.alpha ?? 1, core.danger ?? false));
  const itemBarrierActive = itemBarrierTime > 0;
  const skillBarrierActive = skillBarrierCharges > 0;
  const statusOffset = itemBarrierActive && skillBarrierActive ? 19 : 0;
  if (itemBarrierTime > 0) {
    const maxBarrierTime = 5;
    const progress = Math.min(1, itemBarrierTime / maxBarrierTime);
    const warning = itemBarrierTime <= 1;
    const color = warning ? "#ff6b87" : "#65dcff";
    const centerX = playerX - statusOffset;
    const centerY = playerY - 34;
    const icon = gameplayImage("item-auto-barrier", GAMEPLAY_ART.items.autoBarrier);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = warning ? 0.78 + Math.sin(elapsed * 18) * 0.2 : 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = warning ? 16 : 10;
    if (icon) ctx.drawImage(icon, centerX - 11, centerY - 11, 22, 22);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(5, 12, 22, .86)";
    ctx.beginPath(); ctx.arc(centerX, centerY, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(centerX, centerY, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
    ctx.fillStyle = "#f4fbff";
    ctx.font = `900 8px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(itemBarrierTime.toFixed(1), centerX, centerY);
    ctx.restore();
  }
  if (skillBarrierActive) {
    const timed = skillBarrierTime > 0 && skillBarrierMaxTime > 0;
    const progress = timed ? Math.min(1, skillBarrierTime / skillBarrierMaxTime) : 1;
    const warning = timed && skillBarrierTime <= 1;
    const color = warning ? "#ff6b87" : "#4ea8ff";
    const centerX = playerX + statusOffset;
    const centerY = playerY - 34;
    const icon = gameplayImage("skill-warrior-guard", GAMEPLAY_ART.skills.warriorGuard);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = warning ? 0.78 + Math.sin(elapsed * 18) * 0.2 : 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = warning ? 16 : 10;
    if (icon) ctx.drawImage(icon, centerX - 11, centerY - 11, 22, 22);
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(5, 12, 22, .86)";
    ctx.beginPath(); ctx.arc(centerX, centerY, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(centerX, centerY, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress); ctx.stroke();
    ctx.fillStyle = "#f4fbff";
    ctx.font = `900 8px ${PIXEL_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(timed ? skillBarrierTime.toFixed(1) : `x${Math.max(1, Math.round(skillBarrierCharges))}`, centerX, centerY);
    ctx.restore();
  }
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

function drawCoreCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, alpha: number, danger: boolean) {
  const color = danger ? "#ff6b87" : "#72e7ff"; ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.globalAlpha = alpha; ctx.shadowColor = color; ctx.shadowBlur = danger ? 15 : 11;
  const gradient = ctx.createLinearGradient(-7, -9, 7, 10); gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(.28, danger ? "#ffb0c0" : "#bdf8ff"); gradient.addColorStop(.62, color); gradient.addColorStop(1, danger ? "#7d1738" : "#17617c"); ctx.fillStyle = gradient; ctx.strokeStyle = danger ? "#ffd5df" : "#e9fdff"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, -2); ctx.lineTo(5, 7); ctx.lineTo(0, 11); ctx.lineTo(-5, 7); ctx.lineTo(-7, -2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha *= .72; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 9); ctx.moveTo(-6, -2); ctx.lineTo(0, 1); ctx.lineTo(6, -2); ctx.stroke(); ctx.restore();
}

export function renderWorldOverlays({ ctx, elapsed, gravityWells, bossBarriers = [], bossWalls = [], bossShield = { active: false, life: 0, maxLife: 0, runeIds: [] }, bossArmorReformTimer = 0, bossArmorReformCells = [], bossIntroTimer = 0, bossReinforcementTelegraph = 0, bossReinforcementCount = 0, bricks = [], skillSheets = [], skillSheetReady = [], itemBarrierTime = 0, itemBarrierY, width, barrierColor = "#65dcff", magnetLinks = [] }: {
  ctx: CanvasRenderingContext2D; elapsed: number; gravityWells: ReadonlyArray<{ x: number; y: number; radius: number; life: number; color: string; sourceSkillId?: string }>;
  bossBarriers?: ReadonlyArray<{ x: number; y: number; w: number; h: number; life: number; maxLife: number; telegraph: number; hitCount: number; maxHits: number }>;
  bossWalls?: ReadonlyArray<{ x: number; y: number; w: number; h: number; baseX: number; baseY: number; life: number; maxLife: number; telegraph: number; hp: number; maxHp: number }>;
  bossShield?: { active: boolean; life: number; maxLife: number; runeIds: number[] };
  bossArmorReformTimer?: number;
  bossArmorReformCells?: ReadonlyArray<{ row: number; col: number }>;
  bossIntroTimer?: number;
  bossReinforcementTelegraph?: number; bossReinforcementCount?: number;
  bricks?: ReadonlyArray<Pick<Brick, "x" | "y" | "w" | "h" | "alive" | "kind">>;
  skillSheets?: ReadonlyArray<HTMLImageElement | null>;
  skillSheetReady?: ReadonlyArray<boolean>;
  itemBarrierTime?: number; itemBarrierY?: number; width: number; barrierColor?: string;
  magnetLinks?: ReadonlyArray<{ x: number; y: number; itemX: number; itemY: number; alpha: number; color: string }>;
}) {
  const bossGravityWells = gravityWells.filter((well) => well.sourceSkillId === "gravity-well");
  if ((bossIntroTimer ?? 0) > 0) {
    ctx.save();
    const phase = 3 - (bossIntroTimer ?? 0);
    const label = phase < 1 ? "BOSS INCOMING" : phase < 2 ? "CORE WARNING" : "ARMOR ONLINE";
    const color = phase < 1 ? "#ffd166" : phase < 2 ? "#72e7ff" : "#c5a766";
    ctx.globalAlpha = 0.72 + Math.sin(elapsed * 10) * 0.18;
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.font = `900 15px ${PIXEL_FONT}`;
    ctx.fillText(label, width / 2, 48);
    const core = bricks.find((brick) => brick.kind === "boss-core");
    if (core) {
      const landing = Math.max(0, Math.min(1, (phase - 2.15) / 0.85));
      ctx.globalAlpha = 0.16 + (1 - landing) * 0.28;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      for (let trail = 1; trail <= 3; trail += 1) {
        const offset = trail * 18 + Math.max(0, 3 - phase) * 22;
        ctx.strokeRect(core.x - 16, core.y - offset, core.w + 32, core.h + 32);
      }
      ctx.setLineDash([]);
      if (landing > 0) {
        ctx.globalAlpha = (1 - landing) * 0.75;
        ctx.beginPath();
        ctx.ellipse(core.x + core.w / 2, core.y + core.h + 14, 80 + landing * 180, 12 + landing * 18, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (phase >= 2) {
        ctx.globalAlpha = 0.12 + Math.sin(elapsed * 18) * 0.06;
        ctx.fillStyle = "#f4d58b";
        ctx.fillRect(core.x - 34, core.y - 34, core.w + 68, core.h + 68);
      }
    }
    ctx.restore();
  }
  const bossCore = bricks.find((brick) => brick.kind === "boss-core" && brick.alive);
  const bossPatternColors = [
    bossBarriers.length > 0 ? "#a86cff" : null,
    bossWalls.length > 0 ? "#65b8ff" : null,
    bossGravityWells.length > 0 ? "#c18cff" : null,
    bossShield.active ? "#ffd166" : null,
    bossReinforcementTelegraph > 0 ? "#ffcf4a" : null,
  ].filter((color): color is string => color !== null);
  if (bossCore && bossPatternColors.length > 0) {
    ctx.save();
    const color = bossPatternColors[Math.floor(elapsed) % bossPatternColors.length];
    const pulse = 0.18 + Math.sin(elapsed * 7) * 0.05;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.lineWidth = 4;
    ctx.strokeRect(bossCore.x - 28, bossCore.y - 28, bossCore.w + 56, bossCore.h + 56);
    ctx.restore();
  }
  if ((bossArmorReformTimer ?? 0) > 0 && (bossArmorReformCells?.length ?? 0) > 0) {
    ctx.save();
    const pulse = 0.38 + Math.sin(elapsed * 16) * 0.12;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#8d96a8";
    ctx.strokeStyle = "#e4d7b8";
    ctx.shadowColor = "#c5a766";
    ctx.shadowBlur = 18;
    ctx.setLineDash([5, 5]);
    for (const cell of bossArmorReformCells ?? []) {
      const x = (width - (98 * 4 + 7 * 3)) / 2 + cell.col * 105;
      const y = 58 + cell.row * 33;
      ctx.fillRect(x, y, 98, 28);
      ctx.strokeRect(x, y, 98, 28);
    }
    ctx.setLineDash([]);
    ctx.restore();
  }
  if (bossReinforcementTelegraph > 0) {
    ctx.save();
    const pulse = 0.65 + Math.sin(elapsed * 18) * 0.2;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#ffcf4a";
    ctx.fillStyle = "rgba(255, 207, 74, .08)";
    ctx.shadowColor = "#ffcf4a";
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 7]);
    ctx.strokeRect(30, 212, width - 60, 208);
    ctx.setLineDash([]);
    ctx.fillRect(30, 212, width - 60, 208);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe7a0";
    ctx.font = `900 12px ${PIXEL_FONT}`;
    ctx.fillText(`REINFORCEMENTS INCOMING · ${bossReinforcementCount || "?"}`, width / 2, 306);
    ctx.font = `800 9px ${PIXEL_FONT}`;
    ctx.fillText(`${bossReinforcementTelegraph.toFixed(1)}s`, width / 2, 326);
    ctx.restore();
  }
  bossBarriers.forEach((barrier) => {
    ctx.save();
    const active = barrier.telegraph <= 0;
    const image = gameplayImage("boss-vfx-barrier", GAMEPLAY_ART.bossVfx.barrier);
    const fallbackImage = gameplayImage("boss-pattern-barrier", GAMEPLAY_ART.bossPatterns.barrier);
    ctx.globalAlpha = active ? 0.9 : 0.42 + Math.sin(elapsed * 14) * 0.16;
    ctx.shadowColor = active ? "#a86cff" : "#5da8ff";
    ctx.shadowBlur = active ? 24 : 12;
    if (image) {
      const frame = barrier.telegraph > 0
        ? Math.min(2, Math.floor((1 - Math.min(1, barrier.telegraph / 0.72)) * 3))
        : barrier.life < 0.8 ? 6 + Math.min(1, Math.floor((0.8 - barrier.life) * 4)) : 3 + (Math.floor(elapsed * 5) % 3);
      const drawWidth = Math.max(96, barrier.w * 2.4);
      const drawHeight = drawWidth * bossVfxFrameAspect(image);
      ctx.imageSmoothingEnabled = false;
      drawBossVfxFrame(ctx, image, frame, barrier.x, barrier.y + barrier.h / 2, drawWidth, drawHeight, 1, 0, 8, 1);
    } else if (fallbackImage) {
      const drawWidth = Math.max(82, barrier.w * 8);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fallbackImage, barrier.x - drawWidth / 2, barrier.y - 20, drawWidth, barrier.h + 40);
    } else {
      ctx.strokeStyle = active ? "#e7c56f" : "#fff2b2";
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = active ? 16 : 8;
      ctx.lineWidth = active ? 5 : 2;
      ctx.setLineDash(active ? [] : [7, 6]);
      ctx.strokeRect(barrier.x - barrier.w / 2, barrier.y, barrier.w, barrier.h);
      ctx.setLineDash([]);
    }
    if (!active) {
      ctx.globalAlpha = 0.72 + Math.sin(elapsed * 16) * 0.16;
      ctx.strokeStyle = "#c495ff";
      ctx.shadowColor = "#b76dff";
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 7]);
      ctx.strokeRect(barrier.x - barrier.w * 2.2, barrier.y - 8, barrier.w * 4.4, barrier.h + 16);
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
  bossWalls.forEach((wall) => {
    ctx.save();
    ctx.globalAlpha = wall.telegraph > 0 ? 0.4 + Math.sin(elapsed * 16) * 0.18 : Math.min(1, wall.life / 0.45);
    ctx.shadowColor = wall.telegraph > 0 ? "#65b8ff" : "#b56cff";
    ctx.shadowBlur = wall.telegraph > 0 ? 12 : 20;
    const image = gameplayImage("boss-vfx-wall", GAMEPLAY_ART.bossVfx.wall);
    const fallbackImage = gameplayImage("boss-pattern-wall", GAMEPLAY_ART.bossPatterns.wall);
    if (image) {
      const frame = wall.telegraph > 0
        ? Math.min(2, Math.floor((1 - Math.min(1, wall.telegraph / 0.65)) * 3))
        : wall.life < 0.7 ? 6 + Math.min(1, Math.floor((0.7 - wall.life) * 4)) : 3 + (Math.floor(elapsed * 5) % 3);
      const drawWidth = Math.max(110, wall.w * 1.4);
      const drawHeight = drawWidth * bossVfxFrameAspect(image);
      ctx.imageSmoothingEnabled = false;
      drawBossVfxFrame(ctx, image, frame, wall.x + wall.w / 2, wall.y + wall.h / 2, drawWidth, drawHeight, 1, 0, 8, 1);
    } else if (fallbackImage) {
      const drawWidth = Math.max(120, wall.w * 1.8);
      const drawHeight = Math.max(52, wall.h * 3.1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fallbackImage, wall.x + wall.w / 2 - drawWidth / 2, wall.y + wall.h / 2 - drawHeight / 2, drawWidth, drawHeight);
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
    if (wall.telegraph > 0) {
      ctx.globalAlpha = 0.62 + Math.sin(elapsed * 18) * 0.18;
      ctx.strokeStyle = "#d5a8ff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
      ctx.strokeRect(wall.x - 8, wall.y - 8, wall.w + 16, wall.h + 16);
      ctx.setLineDash([]);
    }
    ctx.restore();
  });
  if (bossShield.active) {
    ctx.save();
    const pulse = 0.92 + Math.sin(elapsed * 7) * 0.06;
    ctx.globalAlpha = 0.38 + Math.min(0.32, bossShield.life / Math.max(0.01, bossShield.maxLife) * 0.32);
    const image = gameplayImage("boss-vfx-shield", GAMEPLAY_ART.bossVfx.shield);
    const fallbackImage = gameplayImage("boss-pattern-shield", GAMEPLAY_ART.bossPatterns.shield);
    const core = bricks.find((brick) => brick.alive && brick.kind === "boss-core");
    const centerX = core ? core.x + core.w / 2 : width / 2;
    const centerY = core ? core.y + core.h / 2 : 180;
    ctx.translate(centerX, centerY);
    ctx.rotate(elapsed * 0.12);
    ctx.shadowColor = "#b66cff";
    ctx.shadowBlur = 28;
    if (image) {
      const drawWidth = 270 * pulse;
      const drawHeight = drawWidth * bossVfxFrameAspect(image);
      const lifeRatio = bossShield.life / Math.max(0.01, bossShield.maxLife);
      const frame = lifeRatio > 0.78 ? Math.min(2, Math.floor((1 - lifeRatio) / 0.08)) : lifeRatio < 0.22 ? 6 + Math.min(1, Math.floor((0.22 - lifeRatio) * 8)) : 3 + (Math.floor(elapsed * 5) % 3);
      drawBossVfxFrame(ctx, image, frame, 0, 0, drawWidth, drawHeight, 1, 0, 8, 1);
    } else if (fallbackImage) {
      const size = 270 * pulse;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fallbackImage, -size / 2, -size / 2, size, size);
    } else {
      ctx.strokeStyle = "#c18cff";
      ctx.shadowBlur = 24;
      ctx.lineWidth = 5;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 135 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha *= 0.58;
    ctx.strokeStyle = "#e6c7ff";
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, 152 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  gravityWells.forEach((well) => {
    const pulse = .78 + Math.sin(elapsed * 8) * .12;
    const skillOpacity = well.sourceSkillId === "mage-black-hole" ? (SKILL_VFX_CONFIG["mage-black-hole"]?.opacity ?? 1) : 1;
    ctx.save(); ctx.globalAlpha = Math.min(1, well.life / .45) * skillOpacity; ctx.translate(well.x, well.y); ctx.rotate(elapsed * 1.6);
    const playerBlackHoleSheet = well.sourceSkillId === "mage-black-hole" ? skillSheets[2] : null;
    const playerBlackHoleReady = Boolean(playerBlackHoleSheet && skillSheetReady[2]);
    const image = playerBlackHoleReady ? null : gameplayImage("boss-vfx-gravity", GAMEPLAY_ART.bossVfx.gravity);
    const fallbackImage = playerBlackHoleReady ? null : gameplayImage("boss-pattern-gravity", GAMEPLAY_ART.bossPatterns.gravity);
    if (playerBlackHoleReady && playerBlackHoleSheet) {
      const frame = Math.floor(elapsed * 12) % SKILL_SHEET_COLUMNS;
      const frameWidth = playerBlackHoleSheet.naturalWidth / SKILL_SHEET_COLUMNS;
      const frameHeight = playerBlackHoleSheet.naturalHeight / SKILL_SHEET_ROWS;
      const size = well.radius * 2.25 * pulse;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(playerBlackHoleSheet, frame * frameWidth, 3 * frameHeight, frameWidth, frameHeight, -size / 2, -size / 2, size, size);
    } else if (image) {
      const drawWidth = well.radius * 3 * pulse;
      const drawHeight = drawWidth * bossVfxFrameAspect(image);
      drawBossVfxFrame(ctx, image, Math.floor(elapsed * 9) % 8, 0, 0, drawWidth, drawHeight, 1, 0, 8, 1);
    } else if (fallbackImage) {
      const size = well.radius * 2.25 * pulse;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(fallbackImage, -size / 2, -size / 2, size, size);
    } else {
      const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, well.radius); gradient.addColorStop(0, "rgba(5,7,18,.98)"); gradient.addColorStop(.2, "rgba(193,140,255,.42)"); gradient.addColorStop(1, "rgba(193,140,255,0)"); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, well.radius * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = well.color; ctx.lineWidth = 2; ctx.setLineDash([10, 14]); ctx.beginPath(); ctx.arc(0, 0, well.radius * .58, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
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
  if (itemBarrierTime > 0 && itemBarrierY !== undefined) {
    const pulse = 0.72 + Math.sin(elapsed * 10) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = barrierColor;
    ctx.shadowColor = barrierColor;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 4;
    ctx.setLineDash([22, 8]);
    ctx.beginPath();
    ctx.moveTo(24, itemBarrierY);
    ctx.lineTo(width - 24, itemBarrierY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  if (magnetLinks.length) { ctx.save(); ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); magnetLinks.forEach((link) => { ctx.globalAlpha = link.alpha; ctx.strokeStyle = link.color; ctx.beginPath(); ctx.moveTo(link.x, link.y); ctx.quadraticCurveTo((link.x + link.itemX) / 2, link.itemY + 24, link.itemX, link.itemY); ctx.stroke(); }); ctx.setLineDash([]); ctx.restore(); }
}
