import type { ClassSkillId, UpgradeId } from "./skill-config";
import type { CanonicalVisualEvent } from "./canonical-engine";

/** Side effects emitted by the simulation and consumed by UI/audio adapters. */
export type GameEvent =
  | { type: "audio"; cue: string; volume?: number }
  | { type: "particle"; x: number; y: number; color: string; count?: number }
  | { type: "effect"; kind: "ring" | "beam" | "blast" | "drop" | "spark" | "lightning" | "skill"; x: number; y: number; x2?: number; y2?: number; color: string; skillId?: ClassSkillId | null }
  | { type: "flash"; text: string; x: number; y: number; color: string; emphasis?: "damage" }
  | { type: "shake"; strength: number; duration: number }
  | { type: "skill-activated"; skillId: ClassSkillId; level: number }
  | { type: "brick-damaged"; brickIndex: number; damage: number; source?: UpgradeId }
  | { type: "brick-destroyed"; brickIndex: number; source?: UpgradeId }
  | { type: "item-dropped"; itemId: number; kind: string };

export type GameEventBuffer = { events: GameEvent[] };

export function emitGameEvent(buffer: GameEventBuffer, event: GameEvent): void {
  buffer.events.push(event);
}

/** Drain events once per render frame, preserving FIFO ordering. */
export function drainGameEvents(buffer: GameEventBuffer): GameEvent[] {
  return buffer.events.splice(0);
}

/** Convert canonical simulation visuals into the UI/audio event contract. */
export function emitCanonicalVisualEvents(buffer: GameEventBuffer, events: CanonicalVisualEvent[]): void {
  for (const event of events) {
    emitGameEvent(buffer, {
      type: "effect",
      kind: event.kind === "ultimate" ? "skill" : "ring",
      x: event.x,
      y: event.y,
      x2: event.x,
      y2: event.y,
      color: "#c18cff",
      skillId: event.skillId as ClassSkillId,
    });
    emitGameEvent(buffer, { type: "audio", cue: event.kind === "ultimate" ? "ultimate" : "skill", volume: 0.85 });
    if (event.kind === "ultimate") emitGameEvent(buffer, { type: "shake", strength: Math.min(12, event.radius / 24), duration: event.duration });
  }
}
