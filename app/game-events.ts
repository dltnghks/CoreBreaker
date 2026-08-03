import type { ClassSkillId, UpgradeId } from "./skill-config";

export type GameEventMetadata = {
  /** Canonical fixed-step tick that produced the event. */
  tick?: number;
  /** Monotonic order within a canonical run. */
  sequence?: number;
};

/** Side effects emitted by the simulation and consumed by UI/audio adapters. */
type GameEventPayload =
  | { type: "audio"; cue: string; volume?: number }
  | { type: "particle"; x: number; y: number; color: string; count?: number }
  | { type: "effect"; kind: "ring" | "beam" | "blast" | "drop" | "spark" | "lightning" | "skill"; x: number; y: number; x2?: number; y2?: number; color: string; skillId?: ClassSkillId | null }
  | { type: "flash"; text: string; x: number; y: number; color: string; emphasis?: "damage" }
  | { type: "shake"; strength: number; duration: number }
  | {
      type: "skill-activated";
      skillId: UpgradeId;
      level: number;
      activation: "skill";
      x: number;
      y: number;
      radius: number;
      duration: number;
      variant?: number;
      x2?: number;
      y2?: number;
      color?: string;
      text?: string;
    }
  | {
      type: "combat-impact";
      source: UpgradeId;
      x: number;
      y: number;
      radius: number;
      duration: number;
      variant?: number;
      color?: string;
      text?: string;
    }
  | { type: "upgrade-chosen"; skillId: UpgradeId; level: number; source: "start" | "wave" | "boss" }
  | { type: "brick-damaged"; brickIndex: number; damage: number; x: number; y: number; color: string; source?: UpgradeId; damageType?: "physical" | "magic"; delivery?: "ball" | "skill" | "dot" | "skill-projectile" | "environment" }
  | { type: "brick-destroyed"; brickIndex: number; x: number; y: number; color: string; combo: number; points: number; source?: UpgradeId; damageType?: "physical" | "magic" }
  | { type: "brick-exploded"; brickIndex: number; x: number; y: number; radius: number; color: string }
  | { type: "item-dropped"; itemId: number; kind: string; x: number; y: number }
  | { type: "item-collected"; kind: string; x: number; y: number }
  | { type: "paddle-reflected"; x: number; y: number }
  | { type: "barrier-reflected"; x: number; y: number; chargesRemaining: number }
  | { type: "ball-out"; x: number; y: number; remainingBalls: number }
  | { type: "core-damaged"; amount: number; remaining: number; x: number; y: number; speedPercent: number }
  | { type: "wave-cleared"; wave: number; boss: boolean }
  | { type: "run-completed"; wave: number }
  | { type: "game-over"; reason: "ball" | "core" };

export type GameEvent = GameEventPayload & GameEventMetadata;

export type GameEventBuffer = { events: GameEvent[] };

export function emitGameEvent(buffer: GameEventBuffer, event: GameEvent): void {
  buffer.events.push(event);
}

/** Drain events once per render frame, preserving FIFO ordering. */
export function drainGameEvents(buffer: GameEventBuffer): GameEvent[] {
  return buffer.events.splice(0);
}
