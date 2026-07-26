import type { GameState } from "./_types/game";

export type LegacyStepAdapter = (state: GameState, input: { move: -1 | 0 | 1; aimX: number; aimY: number }, dt: number) => void;

export function createLegacyStepAdapter(step: (dt: number) => void): LegacyStepAdapter {
  return (_state, _input, dt) => step(dt);
}

/** Deterministic, presentation-free projection used by legacy/canonical parity harnesses. */
export function legacyStateSnapshot(game: GameState) {
  return {
    elapsed: Number(game.elapsed.toFixed(6)), wave: game.wave, score: Number(game.score.toFixed(4)),
    coreHp: Number(game.coreHp.toFixed(4)), bricksBroken: game.bricksBroken,
    paddleX: Number(game.paddleX.toFixed(4)), paddleWidth: Number(game.paddleWidth.toFixed(4)),
    balls: game.balls.map((b) => ({ x: Number(b.x.toFixed(4)), y: Number(b.y.toFixed(4)), vx: Number(b.vx.toFixed(4)), vy: Number(b.vy.toFixed(4)), attackPower: b.attackPower, pierce: b.pierce, payload: b.payload, payloads: { ...b.payloads } })),
    bricks: game.bricks.map((b) => ({ x: b.x, y: b.y, hp: Number(b.hp.toFixed(4)), alive: b.alive, trait: b.trait })),
    effects: game.effects.map((e) => ({ kind: e.kind, x: e.x, y: e.y, life: Number(e.life.toFixed(4)) })),
    particles: game.particles.length,
    flashes: game.flashes.map((f) => ({ text: f.text, x: f.x, y: f.y, life: Number(f.life.toFixed(4)) })),
  };
}
