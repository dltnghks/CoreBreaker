import { legacyStateSnapshot } from "./legacy-state-snapshot";
import type { GameState } from "./_types/game";

export type ReplayFrame = { frame: number; dt: number; input: { move: -1 | 0 | 1; aimX: number; aimY: number }; snapshot: ReturnType<typeof legacyStateSnapshot> };
export type ReplayLog = { mode: "legacy" | "canonical"; seed: number; frames: ReplayFrame[] };

export function createReplayRecorder(mode: ReplayLog["mode"], seed: number) {
  const log: ReplayLog = { mode, seed, frames: [] };
  return {
    log,
    record(frame: number, dt: number, input: ReplayFrame["input"], game: GameState) {
      log.frames.push({ frame, dt, input, snapshot: legacyStateSnapshot(game) });
      if (log.frames.length > 240) log.frames.splice(0, log.frames.length - 240);
    },
    exportJson() { return JSON.stringify(log); },
  };
}

export function compareReplayLogs(a: ReplayLog, b: ReplayLog) {
  const differences: Array<{ frame: number; field: string; left: unknown; right: unknown }> = [];
  const count = Math.max(a.frames.length, b.frames.length);
  for (let i = 0; i < count; i += 1) {
    const left = a.frames[i]?.snapshot as Record<string, unknown> | undefined;
    const right = b.frames[i]?.snapshot as Record<string, unknown> | undefined;
    for (const field of new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})])) {
      if (JSON.stringify(left?.[field]) !== JSON.stringify(right?.[field])) differences.push({ frame: i, field, left: left?.[field], right: right?.[field] });
    }
  }
  return { equal: differences.length === 0, differences };
}
