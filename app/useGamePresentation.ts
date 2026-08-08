import { useCallback, useRef, type RefObject } from "react";
import type { GameAudio } from "./game-audio";
import { drainGameEvents, type GameEventBuffer } from "./game-events";
import type { ClassSkillId, SkillConfig } from "./skill-config";
import type { GameEffect, GameState, Particle } from "./_types/game";

type PresentationAdapters = {
  gameRef: RefObject<GameState | null>;
  audioRef: RefObject<GameAudio | null>;
  eventsRef: RefObject<GameEventBuffer>;
  getSkill: (id: string) => SkillConfig | undefined;
  width: number;
  height: number;
  maxFlashes: number;
};

const MAX_ACTIVE_PARTICLES = 500;
const MAX_ACTIVE_EFFECTS = 240;

function pushParticle(game: GameState, values: Particle) {
  if (game.particles.length >= MAX_ACTIVE_PARTICLES) {
    const index = game.particlePoolCursor % game.particles.length;
    Object.assign(game.particles[index], values);
    game.particlePoolCursor = (index + 1) % game.particles.length;
    return;
  }
  const particle = game.particlePool.pop() ?? { ...values };
  Object.assign(particle, values);
  game.particles.push(particle);
}

function pushEffect(game: GameState, values: GameEffect) {
  if (game.effects.length >= MAX_ACTIVE_EFFECTS) {
    const index = game.effectPoolCursor % game.effects.length;
    Object.assign(game.effects[index], values, { maxLife: values.life });
    game.effectPoolCursor = (index + 1) % game.effects.length;
    return;
  }
  const effect = game.effectPool.pop() ?? { ...values };
  Object.assign(effect, values, { maxLife: values.life });
  game.effects.push(effect);
}

function setImpact(game: GameState, strength: number, color?: string, duration = 0.16, flashDuration = 0) {
  if (strength >= (game.shakeStrength ?? 0) || (game.shakeTime ?? 0) <= 0) {
    game.shakeStrength = Math.min(14, strength);
    game.shakeTime = duration;
    game.shakeDuration = duration;
  }
  if (color && flashDuration > 0 && flashDuration >= (game.screenFlashTime ?? 0)) {
    game.screenFlashColor = color;
    game.screenFlashTime = flashDuration;
    game.screenFlashDuration = flashDuration;
  }
}

/** Owns renderer-only lifetimes and FIFO materialization of canonical events. */
export function useGamePresentation(options: PresentationAdapters) {
  const {
    gameRef,
    audioRef,
    eventsRef,
    getSkill,
    width,
    height,
    maxFlashes,
  } = options;
  const presentationRandomRef = useRef(0x85ebca6b);
  const presentationRandom = useCallback(() => {
    let value = presentationRandomRef.current >>> 0;
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    presentationRandomRef.current = value;
    return value / 4294967296;
  }, []);

  const advancePresentation = useCallback((dt: number) => {
    const game = gameRef.current;
    if (!game) return;
    game.shakeTime = Math.max(0, (game.shakeTime ?? 0) - dt);
    if (game.shakeTime <= 0) game.shakeStrength = 0;
    game.screenFlashTime = Math.max(0, (game.screenFlashTime ?? 0) - dt);
    game.coreBreakTime = Math.max(0, (game.coreBreakTime ?? 0) - dt);
    game.particles.forEach((particle) => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 150 * dt;
      particle.life -= dt;
    });
    game.particles = game.particles.filter((particle) => particle.life > 0);
    game.flashes.forEach((flash) => { flash.y -= 28 * dt; flash.life -= dt; });
    game.flashes = game.flashes.filter((flash) => flash.life > 0).slice(-maxFlashes);
    game.bricks.forEach((brick) => {
      brick.healthFlashTime = Math.max(0, (brick.healthFlashTime ?? 0) - dt);
      if (brick.healthFlashTime <= 0) brick.healthFlashKind = null;
    });
    game.effects.forEach((effect) => { effect.life -= dt; });
    game.effects = game.effects.filter((effect) => effect.life > 0);
  }, [gameRef, maxFlashes]);

  const consumePresentationEvents = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    const playAudio = (cue: Parameters<GameAudio["play"]>[0], volume = 1) => {
      const audio = audioRef.current;
      if (audio) void audio.unlock().then(() => audio.play(cue, volume));
    };

    const damageSlots = new Map<string, number>();
    for (const event of drainGameEvents(eventsRef.current)) {
      if (event.type === "upgrade-chosen") {
        const skill = getSkill(event.skillId);
        const color = skill?.color ?? "#c18cff";
        playAudio("skill", Math.max(0.6, event.level));
        pushEffect(game, { kind: "ring", x: width / 2, y: height / 2, x2: width / 2, y2: height / 2, size: 150, life: 0.8, maxLife: 0.8, color, variant: 0, skillId: event.skillId as ClassSkillId });
        game.flashes.push({ text: skill?.name ?? event.skillId, x: width / 2, y: height / 2, life: 1.2, color });
      } else if (event.type === "skill-activated") {
        const skill = getSkill(event.skillId);
        const color = event.color ?? skill?.color ?? "#c18cff";
        const critical = event.skillId === "warrior-execute" || event.skillId === "archer-weakpoint";
        const explosive = event.skillId === "warrior-shockwave"
          || event.skillId === "warrior-crush"
          || event.skillId === "mage-fireball"
          || event.skillId === "mage-mana-blast";
        playAudio(critical ? "critical" : explosive ? "explosion" : "skill-impact", Math.max(0.5, event.level));
        pushEffect(game, {
          kind: "skill",
          x: event.x,
          y: event.y,
          x2: event.x2 ?? event.x,
          y2: event.y2 ?? event.y,
          size: event.radius,
          life: event.duration,
          maxLife: event.duration,
          color,
          variant: event.variant ?? 0,
          skillId: event.skillId as ClassSkillId,
        });
        game.flashes.push({ text: event.text ?? `SKILL // ${event.skillId}`, x: event.x, y: event.y - Math.max(18, event.radius * 0.15), life: 0.8, color });
        setImpact(game, 4 + event.level * 0.5, color, 0.2, 0.1);
      } else if (event.type === "combat-impact") {
        const color = event.color ?? "#fff3d6";
        pushEffect(game, { kind: "spark", x: event.x, y: event.y, x2: event.x, y2: event.y, size: event.radius, life: 0.35, maxLife: 0.35, color, variant: 0, skillId: null });
        for (let index = 0; index < 4; index += 1) {
          const angle = (Math.PI * 2 * index) / 4;
          pushParticle(game, { x: event.x, y: event.y, vx: Math.cos(angle) * 85, vy: Math.sin(angle) * 85, life: 0.35, color });
        }
        if (event.text) game.flashes.push({ text: event.text, x: event.x, y: event.y - 8, life: 0.65, color, emphasis: "damage" });
      } else if (event.type === "brick-exploded") {
        playAudio("explosion", 1.4);
        pushEffect(game, { kind: "blast", x: event.x, y: event.y, x2: event.x, y2: event.y, size: event.radius, life: 0.72, maxLife: 0.72, color: event.color, variant: 0, skillId: null });
        for (let index = 0; index < 24; index += 1) {
          const angle = (Math.PI * 2 * index) / 24;
          const speed = 220 + (index % 4) * 45;
          pushParticle(game, { x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.55, color: index % 2 === 0 ? "#ffb15c" : event.color });
        }
        game.flashes.push({ text: "EXPLOSIVE // BALL LAUNCHED", x: event.x, y: event.y - 18, life: 0.9, color: "#ffb15c" });
        setImpact(game, 7, event.color, 0.3, 0.16);
      } else if (event.type === "audio") {
        playAudio(event.cue as Parameters<GameAudio["play"]>[0], event.volume);
      } else if (event.type === "shake") {
        setImpact(game, event.strength, undefined, event.duration);
      } else if (event.type === "brick-damaged") {
        playAudio("brick-hit", event.damage);
        const roundedDamage = Math.abs(event.damage - Math.round(event.damage)) < 0.05
          ? String(Math.round(event.damage))
          : event.damage.toFixed(1);
        const damageType = event.damageType ?? "physical";
        const slotKey = `${event.brickIndex}:${damageType}`;
        const slot = damageSlots.get(slotKey) ?? 0;
        damageSlots.set(slotKey, slot + 1);
        const isMagic = damageType === "magic";
        const brick = game.bricks.find((entry) => Math.abs(entry.x + entry.w / 2 - event.x) < 1 && Math.abs(entry.y + entry.h / 2 - event.y) < 1);
        if (brick) {
          brick.healthFlashDuration = 0.28;
          brick.healthFlashTime = brick.healthFlashDuration;
          brick.healthFlashKind = "damage";
        }
        game.flashes.push({
          text: isMagic ? `✦-${roundedDamage}` : `-${roundedDamage}`,
          x: event.x + (isMagic ? 22 : -18),
          y: event.y + (isMagic ? -10 - slot * 20 : 12 + slot * 20),
          life: 0.82,
          color: isMagic ? "#b996ff" : event.damage >= 3 ? "#ffcf4a" : "#ffffff",
          emphasis: "damage",
        });
      } else if (event.type === "brick-healed") {
        const brick = game.bricks.find((entry) => Math.abs(entry.x + entry.w / 2 - event.x) < 1 && Math.abs(entry.y + entry.h / 2 - event.y) < 1);
        if (brick) {
          brick.healthFlashDuration = 0.5;
          brick.healthFlashTime = brick.healthFlashDuration;
          brick.healthFlashKind = "heal";
        }
        pushEffect(game, { kind: "ring", x: event.x, y: event.y, x2: event.x, y2: event.y, size: 30, life: 0.48, maxLife: 0.48, color: "#72f1b8", variant: 0, skillId: null });
        for (let index = 0; index < 6; index += 1) {
          const angle = (Math.PI * 2 * index) / 6;
          pushParticle(game, { x: event.x, y: event.y, vx: Math.cos(angle) * 42, vy: -55 - Math.abs(Math.sin(angle)) * 35, life: 0.52, color: "#72f1b8" });
        }
        game.flashes.push({ text: `+${event.amount}`, x: event.x, y: event.y - 8, life: 0.85, color: "#72f1b8", emphasis: "heal" });
      } else if (event.type === "brick-destroyed") {
        const destroyedBrick = game.bricks.find((brick) => Math.abs(brick.x + brick.w / 2 - event.x) < 1 && Math.abs(brick.y + brick.h / 2 - event.y) < 1);
        const isBossCore = destroyedBrick?.kind === "boss-core";
        const isShieldRune = destroyedBrick?.kind === "boss-minion" && destroyedBrick.bossRow === undefined && destroyedBrick.bossCol === undefined;
        if (isBossCore) {
          playAudio("boss-clear", 1.5);
          pushEffect(game, { kind: "blast", x: event.x, y: event.y, x2: event.x, y2: event.y, size: 150, life: 1.05, maxLife: 1.05, color: "#ff6b87", variant: 0, skillId: null });
          for (let index = 0; index < 32; index += 1) {
            const angle = presentationRandom() * Math.PI * 2;
            const speed = 70 + presentationRandom() * 260;
            pushParticle(game, { x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.75 + presentationRandom() * 0.9, color: event.color });
          }
          game.flashes.push({ text: "CORE DESTROYED", x: width / 2, y: height / 2, life: 1.8, color: "#ff8ca3" });
          setImpact(game, 12, "#ff6b87", 0.7, 0.35);
          return;
        }
        playAudio(isShieldRune ? "skill-impact" : "brick-break", isShieldRune ? 0.8 : event.combo);
        pushEffect(game, { kind: "spark", x: event.x, y: event.y, x2: event.x, y2: event.y, size: isShieldRune ? 24 : 38, life: isShieldRune ? 0.28 : 0.42, maxLife: isShieldRune ? 0.28 : 0.42, color: event.color, variant: event.brickIndex % 2, skillId: null });
        for (let index = 0; index < (isShieldRune ? 3 : 7); index += 1) {
          pushParticle(game, {
            x: event.x,
            y: event.y,
            vx: (presentationRandom() - 0.5) * 180,
            vy: (presentationRandom() - 0.7) * 150,
            life: 0.45 + presentationRandom() * 0.4,
            color: event.color,
          });
        }
        game.flashes.push({ text: `+${Math.floor(event.points)}`, x: event.x, y: event.y - 8, life: 0.55, color: event.color });
      } else if (event.type === "ball-out") {
        pushEffect(game, { kind: "drop", x: event.x, y: event.y - 52, x2: event.x, y2: event.y, size: 24, life: 0.55, maxLife: 0.55, color: "#ff6b87", variant: 0, skillId: null });
        game.flashes.push({ text: event.remainingBalls > 0 ? `BALL OUT // ${event.remainingBalls} LEFT` : "LAST BALL OUT", x: event.x, y: event.y - 72, life: 0.8, color: "#ff6b87" });
      } else if (event.type === "core-damaged") {
        playAudio("core-damage");
        game.coreBreakX = event.x;
        game.coreBreakY = event.y;
        game.coreBreakDuration = 1.05;
        game.coreBreakTime = game.coreBreakDuration;
        pushEffect(game, { kind: "ring", x: event.x, y: event.y, x2: event.x, y2: event.y, size: 62, life: 0.75, maxLife: 0.75, color: "#ff6b87", variant: 0, skillId: null });
        setImpact(game, 9, "#ff6b87", 0.42, 0.22);
        for (let index = 0; index < 24; index += 1) {
          const angle = presentationRandom() * Math.PI * 2;
          const speed = 120 + presentationRandom() * 170;
          pushParticle(game, { x: event.x, y: event.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.4 + presentationRandom() * 0.4, color: "#ff6b87" });
        }
        game.flashes.push({
          text: event.remaining <= 0
            ? "ALL BALLS LOST // CORE DESTROYED"
            : `CORE BREAK // RESPAWN SPEED 100% → ${event.speedPercent}%`,
          x: width / 2,
          y: height - 105,
          life: event.remaining <= 0 ? 1.4 : 1.7,
          color: event.remaining <= 0 ? "#ff6b87" : "#ffcf4a",
        });
      } else if (event.type === "item-dropped") {
        playAudio("item", 0.5);
      } else if (event.type === "item-collected") {
        playAudio(event.kind === "auto-barrier" ? "barrier" : "item", 1.2);
        const label = event.kind === "multiball"
          ? "MULTI BALL +1"
          : event.kind === "auto-barrier"
            ? "AUTO BARRIER // 10s"
            : event.kind === "core-repair"
              ? "CORE REPAIR // +1"
              : "SKILL COOLDOWN // READY";
        const color = event.kind === "auto-barrier" ? "#65dcff" : event.kind === "core-repair" ? "#72f1b8" : event.kind === "cooldown-reset" ? "#c18cff" : "#9aa3b2";
        pushEffect(game, { kind: "ring", x: event.x, y: event.y, x2: event.x, y2: event.y, size: 58, life: 0.55, maxLife: 0.55, color, variant: 0, skillId: null });
        game.flashes.push({ text: label, x: event.x, y: event.y - 28, life: 1, color });
      } else if (event.type === "paddle-reflected") {
        playAudio("paddle", game.combo);
        pushEffect(game, { kind: "ring", x: event.x, y: event.y, x2: event.x, y2: event.y, size: 34, life: 0.3, maxLife: 0.3, color: "#fff27a", variant: 0, skillId: null });
      } else if (event.type === "barrier-reflected") {
        playAudio("barrier", 1.2);
        pushEffect(game, { kind: "ring", x: event.x, y: event.y, x2: event.x, y2: event.y, size: 74, life: 0.65, maxLife: 0.65, color: "#65dcff", variant: 0, skillId: null });
        game.flashes.push({ text: event.chargesRemaining < 0 ? "AUTO BARRIER // REFLECT" : event.chargesRemaining > 0 ? `AUTO BARRIER // ${event.chargesRemaining} LEFT` : "BARRIER // REFLECT", x: event.x, y: event.y - 14, life: 0.7, color: "#65dcff" });
      } else if (event.type === "wave-cleared") {
        playAudio(event.boss ? "boss-clear" : "wave-clear", event.boss ? 1.4 : 1);
      } else if (event.type === "game-over") {
        playAudio("game-over");
      } else if (event.type === "effect") {
        pushEffect(game, { kind: event.kind, x: event.x, y: event.y, x2: event.x2 ?? event.x, y2: event.y2 ?? event.y, size: event.kind === "skill" ? 72 : 45, life: event.kind === "skill" ? 0.9 : 0.45, maxLife: event.kind === "skill" ? 0.9 : 0.45, color: event.color, variant: 0, skillId: event.skillId ?? null });
      } else if (event.type === "particle") {
        const count = Math.max(1, Math.min(12, event.count ?? 4));
        for (let index = 0; index < count; index += 1) {
          const angle = (Math.PI * 2 * index) / count;
          pushParticle(game, { x: event.x, y: event.y, vx: Math.cos(angle) * 85, vy: Math.sin(angle) * 85, life: 0.35, color: event.color });
        }
      } else if (event.type === "flash") {
        game.flashes.push({ text: event.text, x: event.x, y: event.y, life: 0.8, color: event.color, emphasis: event.emphasis });
      }
    }
  }, [audioRef, eventsRef, gameRef, getSkill, height, presentationRandom, width]);

  return { advancePresentation, consumePresentationEvents };
}
