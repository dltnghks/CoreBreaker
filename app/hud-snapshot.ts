import type { UpgradeId } from "./skill-config";
import type { GameState } from "./_types/game";
import { finiteNumber } from "./game-runtime-projection";

export type HudSkillLevel = { id: UpgradeId; level: number; enhancement?: number };

/** Immutable, render-ready view of the simulation state used by the HUD. */
export type HudSnapshot = Readonly<{
  score: number; time: number; level: number; combo: number; bricks: number; balls: number;
  wave: number; nextRow: number; coreHp: number; maxCoreHp: number; barriers: number;
  overdriveLevel: number; overdriveMultiplier: number; bossActive: boolean; bossPending: boolean;
  nextBossWave: number; bossTimeRemaining: number; waveName: string; aliveBricks: number;
  skillLevels: readonly HudSkillLevel[];
}>;

export type HudSnapshotOptions = {
  waveName: string;
  overdriveMultiplier: number;
  upgradeLevel: (upgrades: UpgradeId[], id: UpgradeId) => number;
};

export function hudSnapshotFromGame(game: GameState, options: HudSnapshotOptions): HudSnapshot {
  const skillLevels = [...new Set(game.upgrades)].map((id) => ({
    id,
    level: options.upgradeLevel(game.upgrades, id),
    enhancement: game.bossEnhancements?.[id] ?? 0,
  }));
  return Object.freeze({
    score: finiteNumber(game.score), time: finiteNumber(game.elapsed), level: finiteNumber(game.level, 1), combo: finiteNumber(game.combo),
    bricks: finiteNumber(game.bricksBroken), balls: game.balls.length,
    wave: finiteNumber(game.wave, 1), nextRow: Math.max(0, finiteNumber(game.rowTimer)), coreHp: finiteNumber(game.coreHp), maxCoreHp: finiteNumber(game.maxCoreHp),
    barriers: finiteNumber(game.paddleBarriers.player), overdriveLevel: finiteNumber(game.overdriveLevel),
    overdriveMultiplier: finiteNumber(options.overdriveMultiplier, 1), bossActive: game.bossActive, bossPending: game.bossPending,
    nextBossWave: finiteNumber(game.nextBossWave), bossTimeRemaining: Math.max(0, finiteNumber(game.bossTimeRemaining)),
    waveName: options.waveName, aliveBricks: game.bricks.filter((brick) => brick.alive).length, skillLevels,
  });
}

/** Return true when two HUD snapshots would render identically. */
export function hudSnapshotsEqual(a: HudSnapshot | null, b: HudSnapshot): boolean {
  if (!a) return false;
  if (a.skillLevels.length !== b.skillLevels.length) return false;
  const scalarKeys: (keyof HudSnapshot)[] = [
    "score", "time", "level", "combo", "bricks", "balls", "wave", "nextRow", "coreHp", "maxCoreHp",
    "barriers", "overdriveLevel", "overdriveMultiplier", "bossActive", "bossPending", "nextBossWave",
    "bossTimeRemaining", "waveName", "aliveBricks",
  ];
  if (scalarKeys.some((key) => a[key] !== b[key])) return false;
  return a.skillLevels.every((skill, index) => {
    const next = b.skillLevels[index];
    return skill.id === next.id && skill.level === next.level && skill.enhancement === next.enhancement;
  });
}
