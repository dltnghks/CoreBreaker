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
    if (event.kind === "impact") {
      emitGameEvent(buffer, {
        type: "effect", kind: "spark", x: event.x, y: event.y,
        x2: event.x2 ?? event.x, y2: event.y2 ?? event.y, color: event.color ?? "#fff3d6",
      });
      emitGameEvent(buffer, { type: "particle", x: event.x, y: event.y, color: event.color ?? "#fff3d6", count: 4 });
      // The legacy collision path also surfaced a floating damage cue and a
      // hit sound.  Keep those presentation side effects at the canonical
      // boundary so canonical-only runs are visually/audio equivalent.
      emitGameEvent(buffer, { type: "flash", text: event.text ?? "충격", x: event.x, y: event.y - 8, color: event.color ?? "#fff3d6", emphasis: "damage" });
      emitGameEvent(buffer, { type: "audio", cue: "brick-hit", volume: 0.7 });
      continue;
    }
    emitGameEvent(buffer, {
      type: "effect",
      kind: event.kind === "ultimate" ? "skill" : "ring",
      x: event.x,
      y: event.y,
      x2: event.x2 ?? event.x,
      y2: event.y2 ?? event.y,
      color: event.color ?? "#c18cff",
      skillId: event.skillId as ClassSkillId,
    });
    emitGameEvent(buffer, { type: "audio", cue: event.kind === "ultimate" ? "ultimate" : "skill", volume: 0.85 });
    emitGameEvent(buffer, {
      type: "flash",
      text: event.text ?? (event.kind === "ultimate" ? `ULTIMATE // ${event.skillId}` : `SKILL // ${event.skillId}`),
      x: event.x,
      y: event.y - Math.max(18, event.radius * 0.15),
      color: event.color ?? "#c18cff",
    });
    if (event.kind === "ultimate") emitGameEvent(buffer, { type: "shake", strength: Math.min(12, event.radius / 24), duration: event.duration });
  }
}
