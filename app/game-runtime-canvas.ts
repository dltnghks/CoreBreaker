import { SKILL_VFX_CONFIG, canonicalUpgradeId } from "./skill-config";
import type { ClassSkillId, SkillConfig, UpgradeId } from "./skill-config";
import type { GameState, GhostRecord, ItemKind } from "./_types/game";
import { beginGameCanvasFrame, endGameCanvasFrame, renderBalls, renderBricks, renderHud, renderPaddles, renderTransientFeedback, renderWorldOverlays } from "./game-renderer";

const W = 900;
const H = 600;
const PLAYER_LINE_Y = H - 84;
const PLAYER_PADDLE_Y = H - 70;
const BRICK_ROW_Y = 74;
const ITEM_BARRIER_Y = H - 18;
const MIN_AIM_VERTICAL_DISTANCE = 52;
const AIM_LIMIT_GUIDE_LENGTH = 100;
const AIM_LINE_LENGTH = 170;
const MAX_PADDLE_REBOUND_RATIO = 0.84;
const PLAYER_BALL_COLOR = "#fffaf0";
const PIXEL_FONT = '"Neo둥근모", monospace';
const GHOST_COLORS = ["#9b8cff", "#58d5ff", "#ff78b7"];
const RING_EXPLOSION_COLUMNS = 10;
const RING_EXPLOSION_FRAME_SIZE = 100;
const RING_EXPLOSION_FRAMES = 56;
const HIT_SPARK_ASSETS = ["a", "b"] as const;
const HIT_SPARK_FRAME_SIZE = 32;
const HIT_SPARK_FRAMES = 9;
const RADIAL_LIGHTNING_COLUMNS = 4;
const RADIAL_LIGHTNING_FRAME_SIZE = 64;
const RADIAL_LIGHTNING_FRAMES = 8;
const SKILL_SHEET_COLUMNS = 8;
const SKILL_SHEET_ROWS = 5;

const ITEM_DATA: Record<ItemKind, { label: string; symbol: string; color: string }> = {
  multiball: { label: "MULTI BALL", symbol: "+", color: "#ffcf4a" },
  "auto-barrier": { label: "AUTO BARRIER", symbol: "B", color: "#65dcff" },
  "core-repair": { label: "CORE REPAIR", symbol: "C", color: "#72f1b8" },
  "cooldown-reset": { label: "COOLDOWN RESET", symbol: "R", color: "#c18cff" },
};
const BRICK_TRAIT_COLORS = {
  guard: "#fff27a",
  explosive: "#ff8a3d",
  indestructible: "#aeb8ca",
  healer: "#72f1b8",
  reflector: "#65dcff",
};

function paddleAimDirection(fromX: number, fromY: number, targetX: number, targetY: number) {
  const deltaX = targetX - fromX;
  const deltaY = Math.min(-MIN_AIM_VERTICAL_DISTANCE, targetY - fromY);
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const rawHorizontalRatio = deltaX / distance;
  const horizontalRatio = Math.max(-MAX_PADDLE_REBOUND_RATIO, Math.min(MAX_PADDLE_REBOUND_RATIO, rawHorizontalRatio));
  return {
    horizontalRatio,
    verticalRatio: -Math.sqrt(Math.max(0, 1 - horizontalRatio * horizontalRatio)),
    limited: Math.abs(rawHorizontalRatio) > MAX_PADDLE_REBOUND_RATIO,
  };
}

export type GameRuntimeCanvasOptions = {
  canvas: HTMLCanvasElement;
  game: GameState;
  activeGhosts: GhostRecord[];
  botActive: boolean;
  pointerX: number;
  pointerY: number;
  ringExplosion: HTMLImageElement | null;
  ringExplosionReady: boolean;
  hitSparks: Array<HTMLImageElement | null>;
  hitSparkReady: boolean[];
  radialLightning: HTMLImageElement | null;
  radialLightningReady: boolean;
  mageSpells: Array<HTMLImageElement | null>;
  mageSpellReady: boolean[];
  skillSheets: Array<HTMLImageElement | null>;
  skillSheetReady: boolean[];
  itemIcons: Partial<Record<ItemKind, HTMLImageElement | null>>;
  itemIconReady: Partial<Record<ItemKind, boolean>>;
  skillValue: (id: UpgradeId, level: number) => number;
  upgradeLevel: (upgrades: UpgradeId[], id: UpgradeId) => number;
  classSkillColor: (id: ClassSkillId) => string;
  getSkill: (id: string) => SkillConfig | undefined;
  ghostPaddleY: () => number;
  ghostPaddleWidth: (ghost: GhostRecord) => number;
};

export function renderGameRuntimeCanvas({
  canvas,
  game,
  activeGhosts,
  botActive,
  pointerX,
  pointerY,
  ringExplosion,
  ringExplosionReady,
  hitSparks,
  hitSparkReady,
  radialLightning,
  radialLightningReady,
  mageSpells,
  mageSpellReady,
  skillSheets,
  skillSheetReady,
  itemIcons,
  itemIconReady,
  skillValue,
  upgradeLevel,
  classSkillColor,
  getSkill,
  ghostPaddleY,
  ghostPaddleWidth,
}: GameRuntimeCanvasOptions) {
  const frame = beginGameCanvasFrame(canvas, game, W, H, PLAYER_LINE_Y);
  if (!frame) return;
  const { ctx } = frame;

  renderBricks({ ctx, game, width: W, height: H, playerLineY: PLAYER_LINE_Y, traitColors: BRICK_TRAIT_COLORS, itemData: ITEM_DATA, classSkillColor });
  const magnetLinks: Array<{ x: number; y: number; itemX: number; itemY: number; alpha: number; color: string }> = [];
  const addMagnetLinks = (x: number, y: number, width: number, upgrades: UpgradeId[]) => {
    const normalizedUpgrades = upgrades.map(canonicalUpgradeId);
    const rangeBonus = skillValue("common-magnet", upgradeLevel(normalizedUpgrades, "common-magnet"));
    if (rangeBonus <= 0) return;
    const range = width / 2 + rangeBonus;
    game.items.forEach((item) => { if (item.y > y + 12 || item.y < y - range || Math.abs(item.x - x) > range) return; magnetLinks.push({ x, y, itemX: item.x, itemY: item.y, alpha: .18 + .28 * (1 - Math.min(1, Math.abs(item.y - y) / range)), color: classSkillColor("common-magnet") }); });
  };
  addMagnetLinks(game.paddleX, PLAYER_PADDLE_Y, game.paddleWidth, game.upgrades);
  activeGhosts.forEach((ghost, index) => addMagnetLinks(game.ghostPaddles[index], ghostPaddleY(), ghostPaddleWidth(ghost), ghost.upgrades));
renderWorldOverlays({ ctx, elapsed: game.elapsed, gravityWells: game.gravityWells, bossBarriers: game.bossBarriers, bossWalls: game.bossWalls, bossShield: game.bossShield, bricks: game.bricks, skillSheets, skillSheetReady, itemBarrierTime: game.itemBarrierTime, itemBarrierY: ITEM_BARRIER_Y, width: W, barrierColor: ITEM_DATA["auto-barrier"].color, magnetLinks });
  renderPaddles({
    ctx,
    playerX: game.paddleX,
    playerY: PLAYER_PADDLE_Y,
    playerWidth: Math.min(280, game.paddleWidth),
    playerColor: PLAYER_BALL_COLOR,
    ghostPaddles: activeGhosts.map((ghost, index) => ({ x: game.ghostPaddles[index], y: ghostPaddleY(), width: ghostPaddleWidth(ghost), color: GHOST_COLORS[index % GHOST_COLORS.length], name: ghost.name })),
    safetyBlocks: game.safetyBlocks,
    playerCharge: game.paddleCounters?.player?.chargePulse && game.paddleCounters.player.chargePulse > 0
      ? {
        color: game.paddleCounters.player.chargeColor ?? PLAYER_BALL_COLOR,
        intensity: Math.min(1, game.paddleCounters.player.chargePulse),
        pulse: game.paddleCounters.player.chargePulse,
      }
      : undefined,
    elapsed: game.elapsed,
    coreBreak: game.coreBreakTime > 0 ? { x: game.coreBreakX, y: game.coreBreakY, progress: 1 - game.coreBreakTime / Math.max(0.001, game.coreBreakDuration) } : undefined,
    aim: !botActive ? (() => {
      const a = paddleAimDirection(game.paddleX, PLAYER_PADDLE_Y, pointerX, pointerY);
      const targetY = Math.max(BRICK_ROW_Y, Math.min(PLAYER_PADDLE_Y - MIN_AIM_VERTICAL_DISTANCE, pointerY));
      const verticalTravel = PLAYER_PADDLE_Y - targetY;
      const ray = (hr: number, vr: number, max = Number.POSITIVE_INFINITY) => {
        const vt = verticalTravel / Math.max(0.001, -vr); const st = hr > 0 ? (W - 12 - game.paddleX) / hr : hr < 0 ? (12 - game.paddleX) / hr : Number.POSITIVE_INFINITY; const t = Math.max(0, Math.min(vt, st, max));
        return { x: game.paddleX + hr * t, y: PLAYER_PADDLE_Y + vr * t };
      };
      const edge = -Math.sqrt(1 - MAX_PADDLE_REBOUND_RATIO * MAX_PADDLE_REBOUND_RATIO);
      return { ...ray(a.horizontalRatio, a.verticalRatio, AIM_LINE_LENGTH), left: ray(-MAX_PADDLE_REBOUND_RATIO, edge, AIM_LIMIT_GUIDE_LENGTH), right: ray(MAX_PADDLE_REBOUND_RATIO, edge, AIM_LIMIT_GUIDE_LENGTH), limited: a.limited };
    })() : undefined,
  });

  renderBalls({ ctx, game, getSkill, classSkillColor, mageSpells, mageSpellReady });
  renderHud({ ctx, game, width: W, height: H });

  game.items.forEach((item) => {
    const data = ITEM_DATA[item.kind];
    ctx.save();
    ctx.translate(item.x, item.y);
    const icon = itemIcons[item.kind];
    const iconReady = itemIconReady[item.kind] && icon;
    const pulse = 1 + Math.sin(game.elapsed * 7 + item.x * .03) * .06;
    ctx.shadowBlur = item.kind === "multiball" ? 22 : 16;
    ctx.shadowColor = data.color;
    if (iconReady) {
      const size = (item.kind === "multiball" ? 44 : 42) * pulse;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(icon, -size / 2, -size / 2, size, size);
    } else {
      const size = item.kind === "multiball" ? 10 : 9;
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = data.color;
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.rotate(-Math.PI / 4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#07101b";
      ctx.font = `900 11px ${PIXEL_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(data.symbol, 0, 1);
    }
    ctx.restore();
  });

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  game.effects.forEach((effect) => {
    const remaining = Math.max(0, effect.life / effect.maxLife);
    const progress = 1 - remaining;
    ctx.globalAlpha = remaining * 0.9;
    ctx.strokeStyle = effect.color;
    ctx.shadowColor = effect.color;
    ctx.shadowBlur = 18;
    if (effect.kind === "skill") {
      const effectSkillId = effect.skillId;
      const skillVfx = effectSkillId ? SKILL_VFX_CONFIG[effectSkillId] : undefined;
      const spriteRow = effectSkillId?.startsWith("warrior-")
        ? { sheet: 0, row: ["warrior-smash", "warrior-shockwave", "warrior-execute", "warrior-crush", "warrior-guard"].indexOf(effectSkillId) }
        : effectSkillId?.startsWith("archer-")
          ? { sheet: 1, row: ["archer-rapid", "archer-pierce", "archer-ricochet", "archer-focus", "archer-weakpoint"].indexOf(effectSkillId) }
          : effectSkillId?.startsWith("mage-")
            ? { sheet: 2, row: ["mage-fireball", "mage-lightning", "mage-freeze", "mage-black-hole", "mage-mana-blast"].indexOf(effectSkillId) }
            : null;
      const spriteImage = spriteRow && spriteRow.row >= 0 ? skillSheets[spriteRow.sheet] : null;
      const skillOpacity = Math.max(0, Math.min(1, skillVfx?.opacity ?? 0.78));
      if (spriteRow && spriteRow.row >= 0 && skillSheetReady[spriteRow.sheet] && spriteImage) {
        const frame = Math.min(SKILL_SHEET_COLUMNS - 1, Math.floor(progress * SKILL_SHEET_COLUMNS));
        const frameWidth = spriteImage.naturalWidth / SKILL_SHEET_COLUMNS;
        const frameHeight = spriteImage.naturalHeight / SKILL_SHEET_ROWS;
        const skillScale = skillVfx?.scale ?? 1;
        const spriteSize = effect.size * skillScale * (0.9 + progress * 0.28);
        const frameAspect = frameWidth / Math.max(1, frameHeight);
        const drawWidth = spriteSize * frameAspect;
        ctx.save();
        ctx.translate(effect.x, effect.y);
        if (skillVfx?.rotation === "direction" && (effect.x2 !== effect.x || effect.y2 !== effect.y)) {
          ctx.rotate(Math.atan2(effect.y2 - effect.y, effect.x2 - effect.x));
        } else if (skillVfx?.rotation === "spin") {
          ctx.rotate(progress * Math.PI * 2);
        }
        ctx.globalAlpha = Math.min(1, remaining * 1.85 * skillOpacity);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spriteImage, frame * frameWidth, spriteRow.row * frameHeight, frameWidth, frameHeight, -drawWidth / 2, -spriteSize / 2, drawWidth, spriteSize);
        ctx.restore();
      } else {
        ctx.globalAlpha = remaining * 0.9 * skillOpacity;
        ctx.lineWidth = 3 + remaining * 4;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size * (0.2 + progress * 0.8), 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (effect.kind === "beam") {
      const dx = effect.x2 - effect.x;
      const dy = effect.y2 - effect.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const unitX = dx / distance;
      const unitY = dy / distance;
      const beamGradient = ctx.createLinearGradient(effect.x, effect.y, effect.x2, effect.y2);
      beamGradient.addColorStop(0, "rgba(255,255,255,.9)");
      beamGradient.addColorStop(0.2, effect.color);
      beamGradient.addColorStop(0.8, effect.color);
      beamGradient.addColorStop(1, "rgba(255,255,255,.9)");
      ctx.strokeStyle = beamGradient;
      ctx.lineCap = "round";
      ctx.globalAlpha = Math.min(1, remaining * 1.8);
      ctx.lineWidth = Math.max(2, effect.size * (0.42 + remaining * 0.2));
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.stroke();
      const tracer = Math.min(distance, distance * progress);
      ctx.strokeStyle = "rgba(255,255,255,.96)";
      ctx.lineWidth = Math.max(2, effect.size * 0.32);
      ctx.beginPath();
      ctx.moveTo(effect.x + unitX * Math.max(0, tracer - 22), effect.y + unitY * Math.max(0, tracer - 22));
      ctx.lineTo(effect.x + unitX * tracer, effect.y + unitY * tracer);
      ctx.stroke();
    } else if (effect.kind === "ring") {
      ctx.lineWidth = 2 + remaining * 4;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.size * (0.25 + progress * 0.75), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = remaining * 0.38;
      ctx.lineWidth = 1 + remaining * 2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.size * (0.1 + progress * 0.52), 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === "blast") {
      const radius = effect.size * (0.3 + progress * 0.7);
      const glow = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, radius);
      glow.addColorStop(0, effect.color);
      glow.addColorStop(0.35, effect.color);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = remaining * 0.42;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = remaining;
      ctx.lineWidth = 4 + remaining * 6;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      const explosionImage = ringExplosion;
      if (ringExplosionReady && explosionImage) {
        const frame = Math.min(RING_EXPLOSION_FRAMES - 1, Math.floor(progress * RING_EXPLOSION_FRAMES));
        const sourceX = (frame % RING_EXPLOSION_COLUMNS) * RING_EXPLOSION_FRAME_SIZE;
        const sourceY = Math.floor(frame / RING_EXPLOSION_COLUMNS) * RING_EXPLOSION_FRAME_SIZE;
        const spriteSize = effect.size * 2.35;
        ctx.save();
        ctx.globalAlpha = Math.min(1, 0.55 + remaining * 0.6);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          explosionImage,
          sourceX,
          sourceY,
          RING_EXPLOSION_FRAME_SIZE,
          RING_EXPLOSION_FRAME_SIZE,
          effect.x - spriteSize / 2,
          effect.y - spriteSize / 2,
          spriteSize,
          spriteSize,
        );
        ctx.restore();
      }
    } else if (effect.kind === "spark") {
      const variant = Math.max(0, Math.min(HIT_SPARK_ASSETS.length - 1, effect.variant));
      const sparkImage = hitSparks[variant];
      if (hitSparkReady[variant] && sparkImage) {
        const frame = Math.min(HIT_SPARK_FRAMES - 1, Math.floor(progress * HIT_SPARK_FRAMES));
        const spriteSize = effect.size * (0.86 + progress * 0.2);
        ctx.save();
        ctx.globalAlpha = Math.min(1, remaining * 1.8);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          sparkImage,
          frame * HIT_SPARK_FRAME_SIZE,
          0,
          HIT_SPARK_FRAME_SIZE,
          HIT_SPARK_FRAME_SIZE,
          effect.x - spriteSize / 2,
          effect.y - spriteSize / 2,
          spriteSize,
          spriteSize,
        );
        ctx.restore();
      } else {
        ctx.globalAlpha = remaining;
        ctx.lineWidth = 2 + remaining * 2;
        for (let ray = 0; ray < 6; ray++) {
          const angle = (Math.PI * 2 * ray) / 6;
          ctx.beginPath();
          ctx.moveTo(effect.x + Math.cos(angle) * 5, effect.y + Math.sin(angle) * 5);
          ctx.lineTo(effect.x + Math.cos(angle) * effect.size * progress, effect.y + Math.sin(angle) * effect.size * progress);
          ctx.stroke();
        }
      }
    } else if (effect.kind === "lightning") {
      const lightningImage = radialLightning;
      if (radialLightningReady && lightningImage) {
        const frame = Math.min(RADIAL_LIGHTNING_FRAMES - 1, Math.floor(progress * RADIAL_LIGHTNING_FRAMES));
        const sourceX = (frame % RADIAL_LIGHTNING_COLUMNS) * RADIAL_LIGHTNING_FRAME_SIZE;
        const sourceY = Math.floor(frame / RADIAL_LIGHTNING_COLUMNS) * RADIAL_LIGHTNING_FRAME_SIZE;
        const spriteSize = effect.size * (0.8 + Math.sin(progress * Math.PI) * 0.35);
        ctx.save();
        ctx.globalAlpha = Math.min(1, remaining * 2.2);
        ctx.imageSmoothingEnabled = false;
        ctx.filter = effect.variant === 1
          ? "hue-rotate(145deg) saturate(1.9) brightness(1.35)"
          : "hue-rotate(180deg) saturate(1.65) brightness(1.2)";
        ctx.drawImage(
          lightningImage,
          sourceX,
          sourceY,
          RADIAL_LIGHTNING_FRAME_SIZE,
          RADIAL_LIGHTNING_FRAME_SIZE,
          effect.x - spriteSize / 2,
          effect.y - spriteSize / 2,
          spriteSize,
          spriteSize,
        );
        ctx.restore();
      } else {
        ctx.globalAlpha = remaining;
        ctx.lineWidth = 3 + remaining * 3;
        ctx.beginPath();
        for (let bolt = 0; bolt < 9; bolt++) {
          const angle = (Math.PI * 2 * bolt) / 9 + progress * 0.6;
          const inner = effect.size * 0.12;
          const outer = effect.size * (0.25 + progress * 0.35);
          ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
          ctx.lineTo(effect.x + Math.cos(angle + 0.12) * outer, effect.y + Math.sin(angle + 0.12) * outer);
        }
        ctx.stroke();
      }
    } else if ((effect.kind as string) === "skill") {
      ctx.save();
      ctx.translate(effect.x, effect.y);
      ctx.globalAlpha = Math.min(1, remaining * 1.8);
      ctx.strokeStyle = effect.color;
      ctx.fillStyle = effect.color;
      ctx.shadowColor = effect.color;
      ctx.shadowBlur = 16;
      ctx.lineCap = "round";
      const effectSkillId = effect.skillId;
      const skillScale = SKILL_VFX_CONFIG[effectSkillId as keyof typeof SKILL_VFX_CONFIG]?.scale ?? 1;
      const spriteRow = effectSkillId?.startsWith("warrior-")
        ? { sheet: 0, row: ["warrior-smash", "warrior-shockwave", "warrior-execute", "warrior-crush", "warrior-guard"].indexOf(effectSkillId) }
        : effectSkillId?.startsWith("archer-")
          ? { sheet: 1, row: ["archer-rapid", "archer-pierce", "archer-ricochet", "archer-focus", "archer-weakpoint"].indexOf(effectSkillId) }
          : effectSkillId?.startsWith("mage-")
            ? { sheet: 2, row: ["mage-fireball", "mage-lightning", "mage-freeze", "mage-black-hole", "mage-mana-blast"].indexOf(effectSkillId) }
            : null;
      const spriteImage = spriteRow && spriteRow.row >= 0 ? skillSheets[spriteRow.sheet] : null;
      if (spriteRow && spriteRow.row >= 0 && skillSheetReady[spriteRow.sheet] && spriteImage) {
        const frame = Math.min(SKILL_SHEET_COLUMNS - 1, Math.floor(progress * SKILL_SHEET_COLUMNS));
        const frameWidth = spriteImage.naturalWidth / SKILL_SHEET_COLUMNS;
        const frameHeight = spriteImage.naturalHeight / SKILL_SHEET_ROWS;
        const spriteSize = effect.size * skillScale * (0.9 + progress * 0.28);
        const frameAspect = frameWidth / Math.max(1, frameHeight);
        const drawWidth = spriteSize * frameAspect;
        ctx.globalAlpha = Math.min(1, remaining * 1.85);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spriteImage, frame * frameWidth, spriteRow.row * frameHeight, frameWidth, frameHeight, -drawWidth / 2, -spriteSize / 2, drawWidth, spriteSize);
        ctx.restore();
        return;
      }
      if (effectSkillId === "warrior-smash") {
        const reach = effect.size * (0.35 + progress * 0.45);
        ctx.lineWidth = 8 * remaining + 2;
        ctx.rotate(-0.35);
        ctx.beginPath();
        ctx.moveTo(-reach, -reach * 0.5);
        ctx.lineTo(reach, reach * 0.5);
        ctx.stroke();
        ctx.rotate(0.7);
        ctx.beginPath();
        ctx.moveTo(-reach * 0.7, reach * 0.45);
        ctx.lineTo(reach * 0.7, -reach * 0.45);
        ctx.stroke();
        ctx.fillStyle = "#fff4df";
        for (let shard = 0; shard < 5; shard++) {
          const angle = shard * Math.PI * 2 / 5 - 0.35;
          const distance = reach * (0.25 + progress * 0.5);
          ctx.save();
          ctx.rotate(angle);
          ctx.translate(distance, 0);
          ctx.beginPath();
          ctx.moveTo(8 * remaining, 0);
          ctx.lineTo(-5, -3);
          ctx.lineTo(-3, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else if (effectSkillId === "warrior-shockwave") {
        for (let wave = 0; wave < 3; wave++) {
          const radius = effect.size * Math.max(0.08, progress - wave * 0.12);
          ctx.globalAlpha = Math.max(0, remaining - wave * 0.16);
          ctx.lineWidth = 7 - wave * 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (effectSkillId === "warrior-execute") {
        const blade = effect.size * (0.35 + progress * 0.65);
        ctx.lineWidth = 5 + remaining * 5;
        ctx.beginPath();
        ctx.moveTo(0, -blade);
        ctx.lineTo(0, blade * 0.7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-12, blade * 0.38);
        ctx.lineTo(0, blade * 0.7);
        ctx.lineTo(12, blade * 0.38);
        ctx.stroke();
      } else if (effectSkillId === "warrior-crush") {
        ctx.rotate(progress * 1.6);
        for (let shard = 0; shard < 6; shard++) {
          const angle = shard * Math.PI / 3;
          const distance = effect.size * (0.12 + progress * 0.5);
          ctx.save();
          ctx.rotate(angle);
          ctx.translate(distance, 0);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-5, -5, 10, 10);
          ctx.restore();
        }
      } else if (effectSkillId === "warrior-guard") {
        const span = Math.min(W - 80, effect.size * 5.4);
        ctx.lineWidth = 4 + remaining * 3;
        for (let shield = -2; shield <= 2; shield++) {
          const centerX = shield * span / 5;
          const radius = 18 + progress * 8;
          ctx.beginPath();
          for (let side = 0; side <= 6; side++) {
            const angle = -Math.PI / 2 + side * Math.PI / 3;
            const x = centerX + Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius * 0.7;
            if (side === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (effectSkillId === "archer-rapid") {
        ctx.rotate(Math.atan2(effect.y2 - effect.y, effect.x2 - effect.x));
        ctx.lineWidth = 2.5;
        for (let arrow = -1; arrow <= 1; arrow++) {
          const offset = arrow * 9;
          const travel = effect.size * (0.15 + progress * 0.55);
          ctx.beginPath();
          ctx.moveTo(-travel, offset);
          ctx.lineTo(travel, offset);
          ctx.lineTo(travel - 9, offset - 5);
          ctx.moveTo(travel, offset);
          ctx.lineTo(travel - 9, offset + 5);
          ctx.stroke();
        }
      } else if (effectSkillId === "archer-pierce") {
        ctx.rotate(Math.atan2(effect.y2 - effect.y, effect.x2 - effect.x));
        const length = effect.size * (0.3 + progress * 0.65);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-length, 0);
        ctx.lineTo(length, 0);
        ctx.lineTo(length - 14, -9);
        ctx.moveTo(length, 0);
        ctx.lineTo(length - 14, 9);
        ctx.stroke();
      } else if (effectSkillId === "archer-ricochet") {
        const length = effect.size * (0.5 + progress * 0.45);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-length, length * 0.35);
        ctx.lineTo(-length * 0.25, -length * 0.2);
        ctx.lineTo(length * 0.25, length * 0.16);
        ctx.lineTo(length, -length * 0.4);
        ctx.stroke();
        const points = [[-length * 0.25, -length * 0.2], [length * 0.25, length * 0.16], [length, -length * 0.4]];
        points.forEach(([x, y], pointIndex) => {
          const previous = pointIndex === 0 ? [-length, length * 0.35] : points[pointIndex - 1];
          const angle = Math.atan2(y - previous[1], x - previous[0]);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(7, 0);
          ctx.lineTo(-4, -5);
          ctx.lineTo(-1, 0);
          ctx.lineTo(-4, 5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        });
      } else if (effectSkillId === "archer-focus") {
        const radius = effect.size * (0.7 - progress * 0.42);
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        for (let tick = 0; tick < 4; tick++) {
          const angle = tick * Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * (radius + 10), Math.sin(angle) * (radius + 10));
          ctx.lineTo(Math.cos(angle) * (radius - 7), Math.sin(angle) * (radius - 7));
          ctx.stroke();
        }
      } else if (effectSkillId === "archer-weakpoint") {
        ctx.rotate(progress * Math.PI * 0.75);
        const radius = effect.size * (0.24 + progress * 0.18);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-radius - 14, 0);
        ctx.lineTo(radius + 14, 0);
        ctx.moveTo(0, -radius - 14);
        ctx.lineTo(0, radius + 14);
        ctx.stroke();
      } else if (effectSkillId === "mage-fireball") {
        ctx.rotate(progress * 2.4);
        for (let flame = 0; flame < 8; flame++) {
          const angle = flame * Math.PI / 4;
          const inner = effect.size * 0.12;
          const outer = effect.size * (0.3 + progress * 0.28);
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle - 0.15) * inner, Math.sin(angle - 0.15) * inner);
          ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
          ctx.lineTo(Math.cos(angle + 0.15) * inner, Math.sin(angle + 0.15) * inner);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = Math.min(1, remaining * 2.4);
        ctx.fillStyle = "#fff7dc";
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(0, 0, effect.size * Math.max(0.05, 0.15 * remaining), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = remaining * 0.8;
        ctx.strokeStyle = "#ffb347";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, effect.size * (0.18 + progress * 0.48), 0, Math.PI * 2);
        ctx.stroke();
      } else if (effectSkillId === "mage-lightning") {
        ctx.lineWidth = 3.5;
        for (let bolt = 0; bolt < 5; bolt++) {
          const angle = bolt * Math.PI * 2 / 5 + progress;
          const reach = effect.size * (0.25 + progress * 0.38);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle - 0.16) * reach * 0.45, Math.sin(angle - 0.16) * reach * 0.45);
          ctx.lineTo(Math.cos(angle + 0.12) * reach * 0.72, Math.sin(angle + 0.12) * reach * 0.72);
          ctx.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
          ctx.stroke();
        }
      } else if (effectSkillId === "mage-freeze") {
        const span = Math.min(W - 100, effect.size);
        ctx.lineWidth = 2.5;
        for (let crystal = 0; crystal < 9; crystal++) {
          const centerX = -span / 2 + span * crystal / 8;
          const radius = 8 + progress * 18;
          for (let arm = 0; arm < 6; arm++) {
            const angle = arm * Math.PI / 3;
            ctx.beginPath();
            ctx.moveTo(centerX, 0);
            ctx.lineTo(centerX + Math.cos(angle) * radius, Math.sin(angle) * radius);
            ctx.stroke();
          }
        }
      } else if (effectSkillId === "mage-black-hole") {
        ctx.lineWidth = 3 + remaining * 2;
        ctx.rotate(progress * 3.5);
        ctx.beginPath();
        for (let step = 0; step <= 60; step++) {
          const t = step / 60 * Math.PI * 4;
          const radius = effect.size * 0.035 * t * (1 - progress * 0.35);
          const x = Math.cos(t) * radius;
          const y = Math.sin(t) * radius * 0.55;
          if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (effectSkillId === "mage-mana-blast") {
        ctx.rotate(-progress * 1.4);
        for (let rune = 0; rune < 6; rune++) {
          const angle = rune * Math.PI / 3;
          const distance = effect.size * (0.18 + progress * 0.34);
          ctx.save();
          ctx.rotate(angle);
          ctx.translate(distance, 0);
          ctx.rotate(Math.PI / 4);
          ctx.strokeRect(-7, -7, 14, 14);
          ctx.restore();
        }
      } else {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, effect.size * progress, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (effect.kind === "drop") {
      const fallY = effect.y + (effect.y2 - effect.y) * progress * progress;
      const driftX = effect.x + (effect.x2 - effect.x) * progress * 0.18;
      ctx.globalAlpha = Math.max(0.18, remaining);
      ctx.fillStyle = effect.color;
      ctx.fillRect(driftX - effect.size / 2, fallY - 8, effect.size, 16);
      ctx.globalAlpha = remaining * 0.45;
      ctx.fillRect(driftX - effect.size * 0.36, effect.y, effect.size * 0.72, Math.max(2, fallY - effect.y));
    } else {
      ctx.lineWidth = Math.max(2, effect.size * remaining);
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.stroke();
      ctx.globalAlpha = remaining * 0.35;
      ctx.lineWidth = Math.max(5, effect.size * remaining * 2.2);
      ctx.stroke();
    }
  });
  ctx.restore();

  renderTransientFeedback(ctx, game, W, H);

  ctx.restore();
  endGameCanvasFrame(frame);

}
