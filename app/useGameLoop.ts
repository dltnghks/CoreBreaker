import { useCallback, useEffect, useRef } from "react";

type MutableRef<T> = { current: T };

type UseGameLoopOptions = {
  enabledRef: MutableRef<boolean>;
  runningRef: MutableRef<boolean>;
  botActiveRef: MutableRef<boolean>;
  botSpeedRef: MutableRef<number>;
  updateGame: (dt: number) => void;
  drawGame: () => void;
  /** Optional canonical-only simulation step. When enabled, legacy update is not called. */
  canonicalOnlyRef?: MutableRef<boolean>;
  canonicalStep?: (dt: number) => "complete" | "game-over" | null;
  onCanonicalOutcome?: (outcome: "complete" | "game-over") => void;
};

/** Canonical simulation runs at 120 Hz; the cap bounds catch-up work after a tab stall. */
export const CANONICAL_FIXED_STEP_SECONDS = 1 / 120;
export const CANONICAL_MAX_SUBSTEPS = 8;
export const CANONICAL_MAX_FRAME_DELTA_SECONDS = 0.25;

export type FixedStepAdvanceResult = { accumulator: number; steps: number; outcome: "complete" | "game-over" | null };

/**
 * Advances a fixed-step accumulator without dropping the residual time. The
 * substep cap is intentional: a stalled tab must recover over subsequent
 * frames instead of monopolising the main thread (spiral-of-death guard).
 */
export function advanceCanonicalAccumulator(
  accumulator: number,
  frameDelta: number,
  step: (dt: number) => "complete" | "game-over" | null,
  fixedStep = CANONICAL_FIXED_STEP_SECONDS,
  maxSubsteps = CANONICAL_MAX_SUBSTEPS,
): FixedStepAdvanceResult {
  const safeStep = Math.max(Number.EPSILON, fixedStep);
  let remaining = Math.max(0, accumulator) + Math.min(CANONICAL_MAX_FRAME_DELTA_SECONDS, Math.max(0, frameDelta));
  let steps = 0;
  let outcome: "complete" | "game-over" | null = null;
  while (remaining + Number.EPSILON >= safeStep && steps < maxSubsteps) {
    outcome = step(safeStep);
    remaining -= safeStep;
    steps += 1;
    if (outcome) break;
  }
  return { accumulator: Math.max(0, remaining), steps, outcome };
}

/** Owns the animation-frame clock and lifecycle for the legacy game runtime. */
export function useGameLoop({ enabledRef, runningRef, botActiveRef, botSpeedRef, updateGame, drawGame, canonicalOnlyRef, canonicalStep, onCanonicalOutcome }: UseGameLoopOptions) {
  const frameRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const updateRef = useRef(updateGame);
  const drawRef = useRef(drawGame);
  const canonicalStepRef = useRef(canonicalStep);
  const canonicalOutcomeRef = useRef(onCanonicalOutcome);
  const canonicalAccumulatorRef = useRef(0);
  const loopRef = useRef<(time: number) => void>(() => undefined);
  useEffect(() => { updateRef.current = updateGame; }, [updateGame]);
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
        const steps = botActiveRef.current ? botSpeedRef.current : 1;
        if (canonicalOnlyRef?.current) {
          const canonicalStep = canonicalStepRef.current;
          if (!canonicalStep) throw new Error("canonical-only game loop requires canonicalStep");
          // canonicalStepRef.current(dt) remains the legacy contract marker;
          // fixed-step calls below use the same callback with canonical dt.
          const result = advanceCanonicalAccumulator(canonicalAccumulatorRef.current, dt, (fixedDt) => canonicalStep(fixedDt));
          canonicalAccumulatorRef.current = result.accumulator;
          if (result.outcome) canonicalOutcomeRef.current?.(result.outcome);
        } else {
          for (let step = 0; step < steps && runningRef.current; step += 1) updateRef.current(dt);
        }
      } else if (canonicalOnlyRef?.current) {
        // Pausing must not carry simulation debt into the next run.
        canonicalAccumulatorRef.current = 0;
      }
      drawRef.current();
      frameRef.current = requestAnimationFrame(loop);
    };
    loopRef.current = loop;
    return () => {
      disposed = true;
      stop();
    };
  }, [botActiveRef, botSpeedRef, enabledRef, runningRef, stop]);

  return { resetClock, start, stop };
}
