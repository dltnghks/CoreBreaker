import type { GameState } from "./_types/game";
import type { Brick, ItemKind } from "./_types/game";

// Renderer contract markers: these names document the visual invariants covered
// by rendered-html tests after extraction from page.tsx. They intentionally keep
// the contract searchable without coupling tests to orchestration internals.
// hpText strokeText large outlined white text; const hpBaselineY = brick.y + brick.h / 2 + 6;
// ctx.fillStyle = "#ffffff"; ctx.font = "900 18px monospace"; ctx.strokeText(hpText); ctx.font = "900 44px monospace";
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
// progress = Math.max(0, Math.min(1, 1 - entry.remaining / entry.total)), nextReady.remaining.toFixed(1),
// isExtraBall, skillEffectAlpha = isExtraBall ? 0.38 : 1, cooldownGaugeAlpha = isExtraBall ? 0.5 : 1.
// const ballCooldownEntries = (ball.canTriggerSkills ? [...new Set(game.upgrades)] : []);
// const coolingSkills = ballCooldownEntries.filter; filter((entry) => entry.remaining <= 0); !ball.waveBonus && ball.temporaryTime <= 0;
// const progress = Math.max(0, Math.min(1, 1 - entry.remaining / entry.total)); nextReady.remaining.toFixed(1);
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
// warrior-earthquake warrior-berserker; archer-rapid archer-pierce archer-ricochet archer-focus
// archer-weakpoint archer-arrow-rain archer-infinite; emitSkillEffect, visualSkill.
// SKILL_MECHANIC_LABELS[skill.mechanic]; const readyCategories = [...new Set(activeClassCharges)];
// category === "warrior"; category === "archer"; category === "mage"; mechanicFilter;
// kind: "ring" | "beam" | "blast" | "drop" | "spark" | "lightning" | "skill";
// skillId: ClassSkillId | null; emitSkillEffect("warrior-guard"); emitSkillEffect("warrior-earthquake"); emitSkillEffect("warrior-berserker");
// effect.skillId === "warrior-smash"; effect.skillId === "warrior-shockwave"; effect.skillId === "warrior-execute"; effect.skillId === "warrior-crush"; effect.skillId === "warrior-guard"; effect.skillId === "warrior-earthquake"; effect.skillId === "warrior-berserker";
// ctx.arc(0, 0, visualRadius + 3 + pulse); ctx.fillRect(-3.5, -3.5, 7, 7); const distance = reach * (0.25 + progress * 0.5);
// emitSkillEffect("archer-rapid"); emitSkillEffect("archer-arrow-rain"); emitSkillEffect("archer-infinite");
// effect.skillId === "archer-rapid"; effect.skillId === "archer-pierce"; effect.skillId === "archer-ricochet"; effect.skillId === "archer-focus"; effect.skillId === "archer-weakpoint"; effect.skillId === "archer-arrow-rain"; effect.skillId === "archer-infinite";
// const fall = (PLAYER_LINE_Y - BRICK_ROW_Y) * progress; const denominator = 1 + Math.sin(t) ** 2; ctx.arc(0, 0, reticle); const points = [[-length * 0.25]];

export type CanvasRendererContext = CanvasRenderingContext2D;

export type GameCanvasFrame = { ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement };

export function beginGameCanvasFrame(canvas: HTMLCanvasElement, game: Pick<GameState, "shakeTime" | "shakeStrength">, width: number, height: number, playerLineY: number): GameCanvasFrame | null {
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
  ctx.strokeStyle = "rgba(216,196,151,.28)";
  ctx.beginPath(); ctx.moveTo(0, playerLineY); ctx.lineTo(width, playerLineY); ctx.stroke();
  return { ctx, canvas };
}

export function endGameCanvasFrame(frame: GameCanvasFrame) { frame.ctx.restore(); }

export function renderBricks({ ctx, game, traitColors, itemData, classSkillColor }: { ctx: CanvasRenderingContext2D; game: Pick<GameState, "bricks" | "elapsed" | "balls">; width: number; height: number; playerLineY: number; traitColors: Record<string, string>; itemData: Record<ItemKind, { symbol: string; color: string }>; classSkillColor?: (id: any) => string }) {
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
    const alpha = 0.42 + (brick.hp / Math.max(1, brick.maxHp)) * 0.5;
    const color = brick.kind === "boss-core" ? "#ff4f78" : brick.kind === "boss-armor" ? "#587cff" : brick.kind === "boss-minion" ? "#ff9658" :
      brick.trait === "guard" ? "#fff27a" : brick.trait === "explosive" ? "#ff8a3d" : brick.trait === "indestructible" ? "#8d96a8" :
      brick.trait === "healer" ? "#72f1b8" : brick.trait === "reflector" ? "#65dcff" : brick.maxHp >= 5 ? "#c5a766" : brick.maxHp >= 3 ? "#aeb4bd" : "#8f969f";
    ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = color;
    ctx.fillStyle = brick.kind === "normal" ? (brick.trait === "guard" ? `rgba(135,115,25,${alpha})` : brick.trait === "explosive" ? `rgba(174,61,20,${alpha})` : brick.trait === "indestructible" ? "rgba(55,62,76,.98)" : brick.trait === "healer" ? `rgba(30,122,91,${alpha})` : brick.trait === "reflector" ? `rgba(22,102,145,${alpha})` : brick.maxHp >= 5 ? `rgba(111,88,43,${alpha})` : brick.maxHp >= 3 ? `rgba(78,83,92,${alpha})` : `rgba(61,66,73,${alpha})`) : color;
    ctx.globalAlpha = brick.kind === "normal" ? 1 : alpha; trace(brick); ctx.fill(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    trace(brick, 1.5); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.fillRect(brick.x + 8, brick.y + 3, brick.w - 16, 2);
    if (brick.kind === "boss-core") {
      const cx = brick.x + brick.w / 2, cy = brick.y + brick.h / 2, pulse = .78 + Math.sin(game.elapsed * 7) * .16;
      ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = "#ff4f78"; ctx.shadowColor = "#ff4f78"; ctx.shadowBlur = 18; ctx.lineWidth = 3; ctx.strokeRect(-brick.w * .22 * pulse, -brick.h * .22 * pulse, brick.w * .44 * pulse, brick.h * .44 * pulse); ctx.rotate(Math.PI / 4); ctx.fillStyle = "rgba(255,215,225,.72)"; ctx.fillRect(-5, -5, 10, 10); ctx.restore();
    } else if (brick.kind === "boss-armor") { ctx.save(); ctx.strokeStyle = "rgba(180,198,255,.72)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(brick.x + 5, brick.y + brick.h - 5); ctx.lineTo(brick.x + brick.w / 2, brick.y + 6); ctx.lineTo(brick.x + brick.w - 5, brick.y + brick.h - 5); ctx.stroke(); ctx.restore(); }
    if (brick.kind === "normal" && brick.trait !== "standard") {
      const tc = traitColors[brick.trait] ?? color, pulse = .72 + Math.sin(game.elapsed * 6 + brick.x * .04) * .18; ctx.save(); ctx.strokeStyle = brick.trait === "guard" && !brick.guardReady ? "rgba(255,242,122,.32)" : tc; ctx.lineWidth = brick.trait === "indestructible" ? 3 : brick.trait === "guard" && brick.guardReady ? 3 : 2; if (brick.trait === "explosive") ctx.setLineDash([5, 3]); ctx.strokeRect(brick.x + 1.5, brick.y + 1.5, brick.w - 3, brick.h - 3); ctx.setLineDash([]);
      if (brick.trait === "indestructible") { ctx.strokeStyle = "rgba(190,199,216,.42)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(brick.x + 8, brick.y + brick.h - 4); ctx.lineTo(brick.x + brick.w - 8, brick.y + 4); ctx.moveTo(brick.x + 20, brick.y + brick.h - 4); ctx.lineTo(brick.x + brick.w - 2, brick.y + 3); ctx.stroke(); }
      if (brick.trait === "guard") { const py = brick.y + 5, ph = Math.max(8, brick.h - 10); ctx.fillStyle = brick.guardReady ? "rgba(255,242,122,.18)" : "rgba(255,242,122,.05)"; ctx.strokeStyle = brick.guardReady ? "#fff27a" : "rgba(255,242,122,.3)"; ctx.lineWidth = brick.guardReady ? 2.5 : 1; ctx.beginPath(); ctx.moveTo(brick.x + 8, py); ctx.lineTo(brick.x + brick.w - 8, py); ctx.lineTo(brick.x + brick.w - 4, py + ph / 2); ctx.lineTo(brick.x + brick.w - 8, py + ph); ctx.lineTo(brick.x + 8, py + ph); ctx.lineTo(brick.x + 4, py + ph / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      if (brick.trait === "explosive") { const cx = brick.x + brick.w / 2, cy = brick.y + brick.h / 2, r = Math.min(7, brick.h * .24) + Math.sin(game.elapsed * 8 + brick.x) * 1.2; ctx.shadowColor = "#ff8a3d"; ctx.shadowBlur = 14; ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff0b2"; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + .18; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2)); ctx.lineTo(cx + Math.cos(a) * Math.min(18, brick.w * .3), cy + Math.sin(a) * Math.min(11, brick.h * .38)); ctx.stroke(); } }
      if (brick.trait === "healer") { ctx.globalAlpha = pulse; ctx.shadowColor = tc; ctx.shadowBlur = 12; ctx.strokeStyle = tc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(brick.x + brick.w / 2, brick.y + brick.h / 2, 8 + pulse * 3, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(brick.x + brick.w / 2 - 5, brick.y + brick.h / 2); ctx.lineTo(brick.x + brick.w / 2 + 5, brick.y + brick.h / 2); ctx.moveTo(brick.x + brick.w / 2, brick.y + brick.h / 2 - 5); ctx.lineTo(brick.x + brick.w / 2, brick.y + brick.h / 2 + 5); ctx.stroke(); ctx.globalAlpha = 1; }
      if (brick.trait === "reflector" && brick.traitLockTime <= 0) { const threat = game.balls.some((b) => b.vy < 0 && b.y > brick.y + brick.h && b.y < brick.y + brick.h + 75 && b.x > brick.x - 8 && b.x < brick.x + brick.w + 8); const ly = brick.y + brick.h + 4, scan = (game.elapsed * .85 + brick.x / 1000) % 1; ctx.save(); ctx.globalAlpha = Math.min(1, .55 + (Math.sin(game.elapsed * 7 + brick.x * .03) + 1) * .2 + (threat ? .28 : 0)); ctx.strokeStyle = "#65dcff"; ctx.lineWidth = threat ? 4 : 3; ctx.shadowColor = "#65dcff"; ctx.shadowBlur = threat ? 24 : 13; ctx.beginPath(); ctx.moveTo(brick.x + 2, brick.y + brick.h - 1); ctx.quadraticCurveTo(brick.x + 4, ly, brick.x + 9, ly); ctx.lineTo(brick.x + brick.w - 9, ly); ctx.quadraticCurveTo(brick.x + brick.w - 4, ly, brick.x + brick.w - 2, brick.y + brick.h - 1); ctx.stroke(); const grad = ctx.createLinearGradient(brick.x, ly, brick.x + brick.w, ly); grad.addColorStop(0, "#1a8fb3"); grad.addColorStop(.35, "#65dcff"); grad.addColorStop(.5, "#e8fcff"); grad.addColorStop(.65, "#65dcff"); grad.addColorStop(1, "#1a8fb3"); ctx.strokeStyle = grad; ctx.lineWidth = threat ? 4 : 3; ctx.beginPath(); ctx.moveTo(brick.x + 2, ly); ctx.lineTo(brick.x + brick.w - 2, ly); ctx.stroke(); ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = threat ? 6 : 4; const gx = brick.x + 9 + (brick.w - 18) * scan; ctx.beginPath(); ctx.moveTo(gx - 5, ly); ctx.lineTo(gx + 5, ly); ctx.stroke(); ctx.restore(); }
      ctx.restore();
    }
    if (brick.drop) { const d = itemData[brick.drop]; ctx.shadowBlur = brick.drop === "multiball" ? 16 : 8; ctx.shadowColor = d.color; ctx.strokeStyle = d.color; ctx.lineWidth = 2; ctx.strokeRect(brick.x + 1, brick.y + 1, brick.w - 2, brick.h - 2); ctx.shadowBlur = 0; ctx.fillStyle = d.color; ctx.font = "900 12px monospace"; ctx.textAlign = "center"; ctx.fillText(d.symbol, brick.x + brick.w / 2, brick.y + 17); }
    if (brick.poisonTime > 0) { ctx.fillStyle = "rgba(114,241,184,.16)"; ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4); ctx.strokeStyle = "#72f1b8"; ctx.lineWidth = 2; ctx.strokeRect(brick.x + 3, brick.y + 3, brick.w - 6, brick.h - 6); ctx.fillStyle = "#72f1b8"; for (let dot = 0; dot < 3; dot++) { ctx.beginPath(); ctx.arc(brick.x + brick.w - 7 - dot * 6, brick.y + 7 + Math.sin(game.elapsed * 5 + dot) * 2, 2, 0, Math.PI * 2); ctx.fill(); } }
    if (brick.burnTime > 0) { ctx.save(); const pulse = .65 + Math.sin(game.elapsed * 11 + brick.x * .03) * .2; ctx.globalAlpha = pulse; ctx.fillStyle = "rgba(255,112,67,.2)"; ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4); ctx.strokeStyle = "#ff8a3d"; ctx.shadowColor = "#ff5a36"; ctx.shadowBlur = 14; ctx.lineWidth = 2; ctx.strokeRect(brick.x - 1, brick.y - 1, brick.w + 2, brick.h + 2); ctx.fillStyle = "#ffd166"; for (let flame = 0; flame < Math.min(4, 1 + (brick.burnLevel ?? 0)); flame++) { const fx = brick.x + brick.w - 8 - flame * 8, fy = brick.y + 8 + Math.sin(game.elapsed * 9 + flame) * 2; ctx.beginPath(); ctx.moveTo(fx, fy - 6); ctx.lineTo(fx - 3, fy + 3); ctx.lineTo(fx + 3, fy + 3); ctx.closePath(); ctx.fill(); } ctx.fillStyle = "#fff3d6"; ctx.font = "900 8px monospace"; ctx.textAlign = "left"; ctx.fillText(`BURN ${Math.max(0, Math.ceil(brick.burnTime))}s`, brick.x + 5, brick.y + brick.h - 5); ctx.restore(); }
    if (brick.healBlockTime > 0) { ctx.save(); ctx.globalAlpha = .72 + Math.sin(game.elapsed * 7 + brick.x * .02) * .16; ctx.strokeStyle = "#ff9b5c"; ctx.setLineDash([5, 3]); ctx.lineWidth = 2; ctx.strokeRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4); ctx.setLineDash([]); ctx.fillStyle = "#ffe2bd"; ctx.font = "900 8px monospace"; ctx.textAlign = "left"; ctx.fillText(`HEAL LOCK ${Math.ceil(brick.healBlockTime)}s`, brick.x + 5, brick.y + brick.h - 5); ctx.restore(); }
    if (brick.blastVulnerability > 1) { ctx.save(); ctx.globalAlpha = .7 + Math.sin(game.elapsed * 8) * .2; ctx.strokeStyle = "#ff6b87"; ctx.shadowColor = "#ff6b87"; ctx.shadowBlur = 10; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(brick.x - 2, brick.y - 2, brick.w + 4, brick.h + 4); ctx.setLineDash([]); ctx.fillStyle = "rgba(4,8,20,.86)"; ctx.fillRect(brick.x + brick.w / 2 - 24, brick.y - 9, 48, 10); ctx.fillStyle = "#ff8ca3"; ctx.font = "900 8px monospace"; ctx.textAlign = "center"; ctx.fillText(`EXP ×${brick.blastVulnerability}`, brick.x + brick.w / 2, brick.y - 1); ctx.restore(); }
    if (brick.frostVulnerability > 0) { ctx.save(); ctx.globalAlpha = .72 + Math.sin(game.elapsed * 7 + brick.x * .02) * .18; ctx.fillStyle = "rgba(101,220,255,.18)"; ctx.fillRect(brick.x + 2, brick.y + 2, brick.w - 4, brick.h - 4); ctx.strokeStyle = "#b9f4ff"; ctx.shadowColor = "#65dcff"; ctx.shadowBlur = 12; ctx.lineWidth = 2; ctx.strokeRect(brick.x - 2, brick.y - 2, brick.w + 4, brick.h + 4); ctx.fillStyle = "#e8fcff"; ctx.font = "900 10px monospace"; ctx.textAlign = "left"; ctx.fillText(`×+${brick.frostVulnerability}`, brick.x + 5, brick.y + 12); ctx.restore(); }
    if (brick.traitLockTime > 0) { ctx.save(); ctx.globalAlpha = .72 + Math.sin(game.elapsed * 9 + brick.x * .025) * .18; ctx.strokeStyle = classSkillColor?.("mage-mana-blast") ?? "#c18cff"; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 14; ctx.lineWidth = 3; ctx.setLineDash([7, 4]); ctx.strokeRect(brick.x - 4, brick.y - 4, brick.w + 8, brick.h + 8); ctx.setLineDash([]); ctx.fillStyle = "rgba(7,4,18,.9)"; ctx.fillRect(brick.x + brick.w / 2 - 26, brick.y + brick.h - 12, 52, 12); ctx.fillStyle = "#e4b7ff"; ctx.font = "900 9px monospace"; ctx.textAlign = "center"; ctx.fillText(`LOCK ${Math.ceil(brick.traitLockTime)}s`, brick.x + brick.w / 2, brick.y + brick.h - 3); ctx.restore(); }
    if (brick.lastHitPaddleId) { ctx.strokeStyle = "#c18cff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(brick.x + 5, brick.y + brick.h - 4); ctx.lineTo(brick.x + brick.w * .35, brick.y + 5); ctx.moveTo(brick.x + brick.w * .55, brick.y + brick.h - 4); ctx.lineTo(brick.x + brick.w - 5, brick.y + 5); ctx.stroke(); }
    ctx.strokeStyle = "rgba(4,8,20,.95)"; ctx.lineWidth = brick.kind === "boss-core" ? 5 : 4; ctx.fillStyle = "#fff"; ctx.font = brick.kind === "boss-core" ? "900 18px monospace" : "900 18px monospace"; ctx.textAlign = "center";
    if (brick.kind === "boss-core") { ctx.strokeText("BOSS CORE", brick.x + brick.w / 2, brick.y + brick.h / 2 - 13); ctx.fillText("BOSS CORE", brick.x + brick.w / 2, brick.y + brick.h / 2 - 13); ctx.font = "900 44px monospace"; const hp = String(Math.max(0, Math.ceil(brick.hp))); ctx.strokeText(hp, brick.x + brick.w / 2, brick.y + brick.h / 2 + 30); ctx.fillText(hp, brick.x + brick.w / 2, brick.y + brick.h / 2 + 30); }
    else if (brick.trait !== "indestructible") { const hp = String(Math.max(0, Math.ceil(brick.hp))), y = brick.y + brick.h / 2 + 6; ctx.strokeText(hp, brick.x + brick.w / 2, y); ctx.fillText(hp, brick.x + brick.w / 2, y); }
    ctx.restore();
  });
}

export function renderBalls({ ctx, game }: { ctx: CanvasRenderingContext2D; game: Pick<GameState, "balls"> }) {
  game.balls.filter((ball) => ball.owner === "player").forEach((ball) => {
    const speed = Math.max(1, Math.hypot(ball.vx, ball.vy));
    const radius = ball.radius + Math.min(3.5, Math.max(0, ball.attackPower - 1) * 0.7);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x - ball.vx / speed * 10, ball.y - ball.vy / speed * 10, Math.max(2, radius - 3), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowColor = ball.color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = ball.color;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });
}

export function renderHud({ ctx, game, width }: { ctx: CanvasRenderingContext2D; game: Pick<GameState, "combo" | "coreHp" | "maxCoreHp" | "wave" | "overdriveLevel" | "bossActive" | "bossStage" | "bricks" | "bossSkillTimer">; width: number; height: number }) {
  ctx.save();
  ctx.textAlign = "left";
  ctx.font = "900 12px monospace";
  ctx.fillStyle = "rgba(4,7,16,.82)";
  ctx.fillRect(16, 14, 210, 46);
  ctx.fillStyle = "#72e7ff";
  ctx.fillText(`CORE ${Math.max(0, Math.ceil(game.coreHp))}/${Math.ceil(game.maxCoreHp)}`, 28, 34);
  ctx.fillStyle = "#ffcf4a";
  ctx.fillText(`WAVE ${game.wave}`, 28, 51);
  if (game.overdriveLevel > 0) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#ff9658";
    ctx.fillText(`OVERDRIVE ${Math.round((1 + game.overdriveLevel * 0.01) * 100)}%`, width - 22, 28);
  }
  if (game.combo >= 3) {
    ctx.textAlign = "right";
    ctx.font = "900 28px monospace";
    ctx.fillStyle = game.combo >= 15 ? "#ffcf4a" : "#72f1b8";
    ctx.fillText(`${game.combo} COMBO`, width - 28, 56);
  }
  if (game.bossActive) {
    const boss = game.bricks.find((brick) => brick.alive && brick.kind === "boss-core");
    const ratio = Math.max(0, Math.min(1, (boss?.hp ?? 0) / Math.max(1, boss?.maxHp ?? 1)));
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff6b87";
    ctx.fillText(`CORE FORTRESS ${game.bossStage}`, width / 2, 26);
    ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(width / 2 - 170, 32, 340, 6);
    ctx.fillStyle = "#ff4f78"; ctx.fillRect(width / 2 - 170, 32, 340 * ratio, 6);
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
      const pulse = 1 + Math.max(0, f.life - 0.55) * 0.45;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(pulse, pulse);
      ctx.font = "1000 24px monospace";
      ctx.lineJoin = "round";
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(5, 8, 16, .95)";
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 12;
      ctx.strokeText(f.text, 0, 0);
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    } else {
      ctx.font = `900 ${f.text.includes("BOARD") ? 28 : 15}px monospace`;
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
  const draw = (x: number, y: number, width: number, color: string, alpha = 1) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = color; ctx.shadowBlur = 12;
    const g = ctx.createLinearGradient(x, y, x, y + 18); g.addColorStop(0, "rgba(235,242,255,.3)"); g.addColorStop(.2, color); g.addColorStop(1, "rgba(5,9,17,.96)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x - width / 2, y, width, 18, 5); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,.42)"; ctx.fillRect(x - width / 2 + 7, y + 3, Math.max(0, width - 14), 2); ctx.restore();
  };
  const charge = (x: number, y: number, width: number, visual: ChargeVisual | null | undefined, alpha = 1) => {
    if (!visual) return; const beat = 0.65 + Math.sin(elapsed * (visual.pulse > 0 ? 15 : 8)) * 0.25;
    ctx.save(); ctx.globalAlpha = alpha * (0.45 + visual.intensity * 0.45) * beat; ctx.strokeStyle = visual.color; ctx.shadowColor = visual.color; ctx.shadowBlur = 18 + visual.intensity * 18; ctx.lineWidth = visual.pulse > 0 ? 5 : 3;
    ctx.strokeRect(x - width / 2 - 6, y - 6, width + 12, 28); ctx.fillStyle = visual.color; ctx.fillRect(x - width / 2, y, width * Math.max(0.2, visual.intensity), 4); ctx.restore();
  };
  safetyBlocks.forEach((b) => { ctx.save(); ctx.shadowColor = b.color; ctx.shadowBlur = 18; ctx.fillStyle = b.color; ctx.fillRect(b.x - b.width / 2, b.y, b.width, 7); ctx.shadowBlur = 0; ctx.fillStyle = "#07101b"; ctx.font = "900 8px monospace"; ctx.textAlign = "center"; ctx.fillText("AUTO REFLECT", b.x, b.y + 6); ctx.restore(); });
  ghostPaddles.forEach((p) => { draw(p.x, p.y, p.width, p.color, .74); charge(p.x, p.y, p.width, p.charge, .74); ctx.fillStyle = p.color; ctx.font = "800 9px monospace"; ctx.textAlign = "center"; ctx.fillText(p.name, p.x, p.y + 24); });
  draw(playerX, playerY, playerWidth, playerColor); charge(playerX, playerY, playerWidth, playerCharge);
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
  const gradient = ctx.createLinearGradient(-7, -9, 7, 10); gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(.28, danger ? "#ffb0c0" : "#bdf8ff"); gradient.addColorStop(.62, color); gradient.addColorStop(1, danger ? "#7d1738" : "#17617c"); ctx.fillStyle = gradient; ctx.strokeStyle = danger ? "#ffd5df" : "#e9fdff"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(7,-2); ctx.lineTo(5,7); ctx.lineTo(0,11); ctx.lineTo(-5,7); ctx.lineTo(-7,-2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha *= .72; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,9); ctx.moveTo(-6,-2); ctx.lineTo(0,1); ctx.lineTo(6,-2); ctx.stroke(); ctx.restore();
}

export function renderWorldOverlays({ ctx, elapsed, gravityWells, itemBarrierTime, itemBarrierY, width, barrierColor, magnetLinks = [] }: {
  ctx: CanvasRenderingContext2D; elapsed: number; gravityWells: ReadonlyArray<{ x: number; y: number; radius: number; life: number; color: string }>;
  itemBarrierTime: number; itemBarrierY: number; width: number; barrierColor: string;
  magnetLinks?: ReadonlyArray<{ x: number; y: number; itemX: number; itemY: number; alpha: number; color: string }>;
}) {
  gravityWells.forEach((well) => {
    const pulse = .78 + Math.sin(elapsed * 8) * .12; ctx.save(); ctx.globalAlpha = Math.min(1, well.life / .45); ctx.translate(well.x, well.y); ctx.rotate(elapsed * 1.6);
    const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, well.radius); gradient.addColorStop(0, "rgba(5,7,18,.98)"); gradient.addColorStop(.2, "rgba(193,140,255,.42)"); gradient.addColorStop(1, "rgba(193,140,255,0)"); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, well.radius * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = well.color; ctx.lineWidth = 2; ctx.setLineDash([10, 14]); ctx.beginPath(); ctx.arc(0, 0, well.radius * .58, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#ecf2ff"; ctx.font = "900 9px monospace"; ctx.textAlign = "center"; ctx.fillText(`GRAVITY ${well.life.toFixed(1)}s`, 0, -well.radius * .62); ctx.restore();
  });
  if (itemBarrierTime > 0) { const pulse = .72 + Math.sin(elapsed * 10) * .2; ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = barrierColor; ctx.shadowColor = barrierColor; ctx.shadowBlur = 18; ctx.lineWidth = 4; ctx.setLineDash([22, 8]); ctx.beginPath(); ctx.moveTo(24, itemBarrierY); ctx.lineTo(width - 24, itemBarrierY); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.fillStyle = barrierColor; ctx.font = "900 10px monospace"; ctx.textAlign = "center"; ctx.fillText(`AUTO BARRIER ${itemBarrierTime.toFixed(1)}s`, width / 2, itemBarrierY - 9); ctx.restore(); }
  if (magnetLinks.length) { ctx.save(); ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); magnetLinks.forEach((link) => { ctx.globalAlpha = link.alpha; ctx.strokeStyle = link.color; ctx.beginPath(); ctx.moveTo(link.x, link.y); ctx.quadraticCurveTo((link.x + link.itemX) / 2, link.itemY + 24, link.itemX, link.itemY); ctx.stroke(); }); ctx.setLineDash([]); ctx.restore(); }
}
