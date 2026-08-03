import { useCallback, useEffect, useState, type RefObject } from "react";
import { GameAudio } from "./game-audio";
import { applyWaveDefinitions, WAVE_STORAGE_KEY } from "./wave-config";

const SOUND_STORAGE_KEY = "echo-breaker-sound-v1";

/** Owns browser-backed runtime settings that are applied before a run starts. */
export function useRuntimeSettings(audioRef: RefObject<GameAudio | null>) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    try {
      const savedWaves = localStorage.getItem(WAVE_STORAGE_KEY);
      if (savedWaves) applyWaveDefinitions(JSON.parse(savedWaves));
    } catch {
      // Invalid drafts never replace canonical wave defaults.
    }
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    const enabled = localStorage.getItem(SOUND_STORAGE_KEY) !== "off";
    const audio = new GameAudio();
    audio.setMuted(!enabled);
    audioRef.current = audio;
    const timer = window.setTimeout(() => setSoundEnabled(enabled), 0);
    return () => {
      window.clearTimeout(timer);
      audio.close();
    };
  }, [audioRef]);

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(SOUND_STORAGE_KEY, next ? "on" : "off");
    const audio = audioRef.current ?? new GameAudio();
    audioRef.current = audio;
    audio.setMuted(!next);
    if (next) void audio.unlock().then(() => audio.play("item"));
  }, [audioRef, soundEnabled]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }, []);

  return { soundEnabled, isFullscreen, toggleSound, toggleFullscreen };
}
