import { useRef, useState } from "react";

export type GameRuntimeMode =
  | "lobby"
  | "initialskills"
  | "playing"
  | "levelup"
  | "bossreward"
  | "waveclear"
  | "transition"
  | "result";

/** Owns UI phase state derived from canonical outcomes and command responses. */
export function useGameRuntimeController() {
  const [mode, setMode] = useState<GameRuntimeMode>("lobby");
  const [transitionWave, setTransitionWave] = useState<number | null>(null);
  const [clearedWave, setClearedWave] = useState<{ wave: number; boss: boolean } | null>(null);
  const transitionTimersRef = useRef<number[]>([]);
  const rewardOpeningRef = useRef(false);

  return {
    mode,
    setMode,
    transitionWave,
    setTransitionWave,
    clearedWave,
    setClearedWave,
    transitionTimersRef,
    rewardOpeningRef,
  };
}
