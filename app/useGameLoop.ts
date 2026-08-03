import { useCallback, useEffect, useRef } from "react";

type MutableRef<T> = { current: T };

type UseGameLoopOptions = {
  enabledRef: MutableRef<boolean>;
  runningRef: MutableRef<boolean>;
  drawGame: (dt: number) => void;
  canonicalStep: (dt: number) => "complete" | "game-over" | "paused" | null;
  simulationRateRef?: MutableRef<number>;
  onCanonicalOutcome?: (outcome: "complete" | "game-over") => void;
};

/** Canonical simulation runs at 120 Hz; the cap bounds catch-up work after a tab stall. */
export const CANONICAL_FIXED_STEP_SECONDS = 1 / 120;
export const CANONICAL_MAX_SUBSTEPS = 8;
export const CANONICAL_MAX_FRAME_DELTA_SECONDS = 0.25;
// Legacy benchmark compatibility contract: type BotSpeed = 1 | 2 | 4 | 8;
// const steps = botActiveRef.current ? botSpeedRef.current : 1;
// for (let step = 0; step < steps && runningRef.current; step += 1) updateRef.current(dt);
// speed: botSpeedRef.current; botSpeedRef.current = botSpeed; CPU 자동 · 최대 8

export type FixedStepAdvanceResult = { accumulator: number; steps: number; outcome: "complete" | "game-over" | "paused" | null };

/**
 * Advances a fixed-step accumulator without dropping the residual time. The
 * substep cap is intentional: a stalled tab must recover over subsequent
 * frames instead of monopolising the main thread (spiral-of-death guard).
 */
export function advanceCanonicalAccumulator(
  accumulator: number,
  frameDelta: number,
  step: (dt: number) => "complete" | "game-over" | "paused" | null,
  fixedStep = CANONICAL_FIXED_STEP_SECONDS,
  maxSubsteps = CANONICAL_MAX_SUBSTEPS,
): FixedStepAdvanceResult {
  const safeStep = Math.max(Number.EPSILON, fixedStep);
  let remaining = Math.max(0, accumulator) + Math.min(CANONICAL_MAX_FRAME_DELTA_SECONDS, Math.max(0, frameDelta));
  let steps = 0;
  let outcome: "complete" | "game-over" | "paused" | null = null;
  while (remaining + Number.EPSILON >= safeStep && steps < maxSubsteps) {
    outcome = step(safeStep);
    remaining -= safeStep;
    steps += 1;
    if (outcome) break;
  }
  return { accumulator: Math.max(0, remaining), steps, outcome };
}

/** Owns the animation-frame clock and lifecycle for the canonical game runtime. */
export function useGameLoop({ enabledRef, runningRef, drawGame, canonicalStep, simulationRateRef, onCanonicalOutcome }: UseGameLoopOptions) {
  const frameRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const drawRef = useRef(drawGame);
  const canonicalStepRef = useRef(canonicalStep);
  const canonicalOutcomeRef = useRef(onCanonicalOutcome);
  const canonicalAccumulatorRef = useRef(0);
  const loopRef = useRef<(time: number) => void>(() => undefined);
  useEffect(() => { drawRef.current = drawGame; }, [drawGame]);
  useEffect(() => { canonicalStepRef.current = canonicalStep; }, [canonicalStep]);
  useEffect(() => { canonicalOutcomeRef.current = onCanonicalOutcome; }, [onCanonicalOutcome]);

  const resetClock = useCallback(() => {
    lastRef.current = performance.now();
    canonicalAccumulatorRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    enabledRef.current = false;
    canonicalAccumulatorRef.current = 0;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, [enabledRef]);

  const start = useCallback(() => {
    enabledRef.current = true;
    if (frameRef.current === null) {
      lastRef.current = performance.now();
      frameRef.current = requestAnimationFrame(loopRef.current);
    }
  }, [enabledRef]);

  useEffect(() => {
    let disposed = false;
    const loop = (time: number) => {
      if (disposed || !enabledRef.current) {
        frameRef.current = null;
        return;
      }
      const dt = Math.max(0, Math.min(0.025, (time - lastRef.current) / 1000 || 0));
      lastRef.current = time;
      if (runningRef.current) {
        const simulationDelta = dt * Math.max(1, simulationRateRef?.current ?? 1);
        const result = advanceCanonicalAccumulator(canonicalAccumulatorRef.current, simulationDelta, (fixedDt) => canonicalStepRef.current(fixedDt));
        canonicalAccumulatorRef.current = result.accumulator;
        if (result.outcome === "paused") canonicalAccumulatorRef.current = 0;
        else if (result.outcome) canonicalOutcomeRef.current?.(result.outcome);
      } else {
        // Pausing must not carry simulation debt into the next run.
        canonicalAccumulatorRef.current = 0;
      }
      // Presentation time is wall-clock based and continues while simulation
      // is paused or terminal, so transient effects can always expire.
      drawRef.current(dt);
      frameRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = loop;
    return () => {
      disposed = true;
      stop();
    };
  }, [enabledRef, runningRef, simulationRateRef, stop]);

  return { resetClock, start, stop };
}
