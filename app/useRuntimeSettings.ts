import { useCallback, useEffect, useState, type RefObject } from "react";
import { GameAudio } from "./game-audio";
import { applyWaveDefinitions, WAVE_STORAGE_KEY } from "./wave-config";

const SFX_VOLUME_STORAGE_KEY = "echo-breaker-sfx-volume-v1";
const MUSIC_VOLUME_STORAGE_KEY = "echo-breaker-music-volume-v1";

/** Owns browser-backed runtime settings that are applied before a run starts. */
export function useRuntimeSettings(audioRef: RefObject<GameAudio | null>, ready = true) {
  const [sfxVolume, setSfxVolumeState] = useState(1);
  const [musicVolume, setMusicVolumeState] = useState(1);
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
    if (!ready) return;
    const storedSfx = Number(localStorage.getItem(SFX_VOLUME_STORAGE_KEY));
    const storedMusic = Number(localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY));
    const nextSfx = Number.isFinite(storedSfx) ? Math.max(0, Math.min(1, storedSfx)) : 1;
    const nextMusic = Number.isFinite(storedMusic) ? Math.max(0, Math.min(1, storedMusic)) : 1;
    const audio = new GameAudio();
    audio.setSfxVolume(nextSfx * 1.0);
    audio.setMusicVolume(nextMusic * 0.3);
    audio.setMuted(false);
    audioRef.current = audio;
    // Try immediately for browsers that allow autoplay. Browsers that block
    // it keep the decoded transport ready and resume it on the first gesture.
    audio.setMusicState({ active: true, state: "title" });
    void audio.startMusic().catch(() => undefined);
    const unlockTitleMusic = () => {
      audio.setMusicState({ active: true, state: "title" });
      void audio.startMusic().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlockTitleMusic, { once: true });
    window.addEventListener("keydown", unlockTitleMusic, { once: true });
    const timer = window.setTimeout(() => {
      setSfxVolumeState(nextSfx);
      setMusicVolumeState(nextMusic);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", unlockTitleMusic);
      window.removeEventListener("keydown", unlockTitleMusic);
      audio.close();
    };
  }, [audioRef, ready]);

  const setSfxVolume = useCallback((value: number) => {
    const next = Math.max(0, Math.min(1, value));
    setSfxVolumeState(next);
    localStorage.setItem(SFX_VOLUME_STORAGE_KEY, String(next));
    const audio = audioRef.current ?? new GameAudio();
    audioRef.current = audio;
    audio.setSfxVolume(next * 1.0);
  }, [audioRef]);

  const setMusicVolume = useCallback((value: number) => {
    const next = Math.max(0, Math.min(1, value));
    setMusicVolumeState(next);
    localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(next));
    const audio = audioRef.current ?? new GameAudio();
    audioRef.current = audio;
    audio.setMusicVolume(next * 0.3);
  }, [audioRef]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }, []);

  return { sfxVolume, musicVolume, setSfxVolume, setMusicVolume, isFullscreen, toggleFullscreen };
}
