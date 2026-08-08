import { appHref } from "./site-path";

export type GameSound = "start" | "paddle" | "brick-hit" | "brick-break" | "explosion" | "item" | "level-up" | "skill" | "skill-impact" | "critical" | "boss" | "boss-clear" | "barrier" | "core-damage" | "game-over" | "ui-hover" | "ui-click" | "start-confirm" | "skill-select" | "skill-reroll" | "wave-start" | "wave-clear" | "reward-select" | "countdown" | "pause" | "danger-warning" | "core-danger" | "time-warning" | "menu-transition" | "save-complete";

export type MusicLayer = "normal";
export type MusicState = "title" | "transition" | "gameplay" | "wave-clear" | "reward-select" | "boss-intro" | "boss-gameplay" | "boss-reward" | "result";

export type AdaptiveMusicState = {
  active: boolean;
  state: MusicState;
};

const MUSIC_FILES: Record<MusicLayer, string> = {
  normal: appHref("/audio/BGM_LOOP.mp3"),
};
const SFX_FILES: Record<GameSound, string> = {
  start: appHref("/audio/sfx/start-confirm.wav"),
  paddle: appHref("/audio/sfx/paddle-reflect.wav"),
  "brick-hit": appHref("/audio/sfx/brick-hit.wav"),
  "brick-break": appHref("/audio/sfx/brick-break.wav"),
  explosion: appHref("/audio/sfx/explosion.wav"),
  item: appHref("/audio/sfx/item-pickup.wav"),
  "level-up": appHref("/audio/sfx/level-up.wav"),
  skill: appHref("/audio/sfx/skill-cast.wav"),
  "skill-impact": appHref("/audio/sfx/skill-impact.wav"),
  critical: appHref("/audio/sfx/critical-hit.wav"),
  boss: appHref("/audio/sfx/boss-arrival.wav"),
  "boss-clear": appHref("/audio/sfx/boss-defeat.wav"),
  barrier: appHref("/audio/sfx/barrier-reflect.wav"),
  "core-damage": appHref("/audio/sfx/boss-core-hit.wav"),
  "game-over": appHref("/audio/sfx/game-over.wav"),
  "ui-hover": appHref("/audio/sfx/ui-hover.wav"),
  "ui-click": appHref("/audio/sfx/ui-click.wav"),
  "start-confirm": appHref("/audio/sfx/start-confirm.wav"),
  "skill-select": appHref("/audio/sfx/skill-select.wav"),
  "skill-reroll": appHref("/audio/sfx/skill-reroll.wav"),
  "wave-start": appHref("/audio/sfx/wave-start.wav"),
  "wave-clear": appHref("/audio/sfx/wave-clear.wav"),
  "reward-select": appHref("/audio/sfx/reward-select.wav"),
  countdown: appHref("/audio/sfx/countdown.wav"),
  pause: appHref("/audio/sfx/pause.wav"),
  "danger-warning": appHref("/audio/sfx/danger-warning.wav"),
  "core-danger": appHref("/audio/sfx/core-danger.wav"),
  "time-warning": appHref("/audio/sfx/time-warning.wav"),
  "menu-transition": appHref("/audio/sfx/menu-transition.wav"),
  "save-complete": appHref("/audio/sfx/save-complete.wav"),
};
const MUSIC_CROSSFADE_SECONDS = 2;
const MUSIC_STATE_PARAMS: Record<MusicState, { rate: number; detune: number; gain: number }> = {
  title: { rate: 1, detune: 0, gain: 0.58 },
  transition: { rate: 1, detune: 0, gain: 0.72 },
  gameplay: { rate: 1, detune: 0, gain: 1 },
  "wave-clear": { rate: 1, detune: 0, gain: 0.72 },
  "reward-select": { rate: 1, detune: 0, gain: 0.62 },
  "boss-intro": { rate: 1, detune: 0, gain: 0.70 },
  "boss-gameplay": { rate: 1, detune: 0, gain: 0.63 },
  "boss-reward": { rate: 1, detune: 0, gain: 0.58 },
  result: { rate: 1, detune: 0, gain: 0.45 },
};

type MusicSource = { source: AudioBufferSourceNode; gain: GainNode };
type MusicLayerRuntime = { gain: GainNode; sources: Set<MusicSource>; timer: number | null };

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private muted = false;
  private lastPlayed: Partial<Record<GameSound, number>> = {};
  private musicMaster: GainNode | null = null;
  private musicLayers: Partial<Record<MusicLayer, MusicLayerRuntime>> = {};
  private musicBuffers: Partial<Record<MusicLayer, AudioBuffer>> = {};
  private musicLoadPromise: Promise<void> | null = null;
  private musicElement: HTMLAudioElement | null = null;
  private sfxBuffers: Partial<Record<GameSound, AudioBuffer>> = {};
  private sfxLoadPromise: Promise<void> | null = null;
  private musicStarted = false;
  private musicState: AdaptiveMusicState = { active: false, state: "title" };
  private sfxVolume = 0.28;
  private musicVolume = 0.24;

  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 16;
      this.compressor.ratio.value = 7;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.18;
      this.master.gain.value = this.muted ? 0 : this.sfxVolume;
      this.master.connect(this.compressor);
      this.compressor.connect(this.context.destination);
      this.musicMaster = this.context.createGain();
      this.musicMaster.gain.value = this.muted ? 0 : this.musicVolume;
      this.musicMaster.connect(this.compressor);
    }
    if (!this.sfxLoadPromise) this.sfxLoadPromise = this.loadSfxBuffers();
    if (this.context.state === "suspended") await this.context.resume();
  }

  async startMusic() {
    await this.unlock();
    if (!this.context || !this.musicMaster) return;
    if (this.musicStarted) {
      void this.musicElement?.play().catch(() => undefined);
      return;
    }
    if (!this.musicLoadPromise) this.musicLoadPromise = this.loadMusicBuffers();
    await this.musicLoadPromise;
    if (!this.context || !this.musicMaster || this.musicStarted) return;

    const startAt = this.context.currentTime + 0.12;
    // Mark the transport as active before scheduling loop timers. The
    // scheduler intentionally refuses to create follow-up sources after
    // close(), so this flag must be set before the first schedule call.
    this.musicStarted = true;
    if (!this.musicBuffers.normal) {
      this.startElementMusic();
      this.applyMusicState();
      return;
    }
    (Object.keys(MUSIC_FILES) as MusicLayer[]).forEach((layer) => {
      const buffer = this.musicBuffers[layer];
      if (!buffer) return;
      const gain = this.context!.createGain();
      gain.connect(this.musicMaster!);
      gain.gain.value = 0.0001;
      this.musicLayers[layer] = { gain, sources: new Set(), timer: null };
      this.createMusicSource(layer, startAt, 0.25);
      this.scheduleMusicLoop(layer, startAt);
    });
    this.applyMusicState();
  }

  setMusicState(state: AdaptiveMusicState) {
    this.musicState = {
      active: state.active,
      state: state.state,
    };
    this.applyMusicState();
  }

  setSfxVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.master && this.context && !this.muted) this.master.gain.setTargetAtTime(this.sfxVolume, this.context.currentTime, 0.02);
  }

  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicMaster && this.context && !this.muted) this.musicMaster.gain.setTargetAtTime(this.musicVolume, this.context.currentTime, 0.02);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.sfxVolume, this.context.currentTime, 0.015);
      this.musicMaster?.gain.setTargetAtTime(muted ? 0 : this.musicVolume, this.context.currentTime, 0.015);
    }
  }

  play(sound: GameSound, intensity = 1) {
    const context = this.context;
    if (!context || !this.master || this.muted || context.state !== "running") return;
    const nowMs = performance.now();
    const throttle = sound === "brick-hit" ? 28 : sound === "brick-break" ? 34 : sound === "paddle" ? 45 : 16;
    if (nowMs - (this.lastPlayed[sound] ?? 0) < throttle) return;
    this.lastPlayed[sound] = nowMs;

    const power = Math.max(0.5, Math.min(2, intensity));
    // These two cues are intentionally kept procedural: their very high
    // repetition rate feels tighter and less fatiguing than the rendered WAVs.
    const sample = sound === "paddle" || sound === "brick-break" ? undefined : this.sfxBuffers[sound];
    if (sample) {
      this.playSample(sample, power);
      return;
    }
    switch (sound) {
      case "start":
        this.tone(180, 0.08, "square", 0.07, 1.45);
        this.tone(270, 0.14, "triangle", 0.06, 1.35, 0.07);
        break;
      case "paddle":
        this.tone(230 + Math.min(20, intensity) * 10, 0.055, "square", 0.045, 1.3);
        break;
      case "brick-hit":
        this.tone(150 + power * 35, 0.04, "square", 0.025, 0.72);
        break;
      case "brick-break":
        this.noise(0.045, 0.018 * power, 1800, "highpass");
        this.tone(380 + Math.min(30, intensity) * 9, 0.065, "triangle", 0.045, 1.55);
        this.tone(620 + Math.min(20, intensity) * 7, 0.045, "square", 0.022, 0.8, 0.025);
        break;
      case "explosion":
        this.noise(0.24, 0.11 * power, 720);
        this.noise(0.08, 0.045 * power, 2200, "highpass");
        this.tone(105, 0.24, "sawtooth", 0.09, 0.34);
        this.tone(54, 0.3, "sine", 0.1, 0.62, 0.015);
        break;
      case "item":
        this.tone(520, 0.07, "sine", 0.055, 1.08);
        this.tone(780, 0.11, "triangle", 0.05, 1.12, 0.065);
        break;
      case "level-up":
        this.tone(330, 0.12, "triangle", 0.06, 1.02);
        this.tone(495, 0.14, "triangle", 0.055, 1.02, 0.08);
        this.tone(660, 0.2, "sine", 0.06, 1.15, 0.16);
        break;
      case "skill":
        this.noise(0.055, 0.025 * power, 2400, "highpass");
        this.tone(440, 0.1, "square", 0.045, 1.5);
        this.tone(880, 0.16, "triangle", 0.045, 0.9, 0.06);
        break;
      case "skill-impact":
        this.noise(0.07, 0.035 * power, 1600, "highpass");
        this.tone(210, 0.09, "square", 0.055, 0.58);
        this.tone(560, 0.08, "triangle", 0.035, 1.4, 0.018);
        break;
      case "critical":
        this.noise(0.11, 0.07 * power, 2100, "highpass");
        this.tone(72, 0.2, "sine", 0.11, 0.48);
        this.tone(920, 0.12, "square", 0.055, 1.65, 0.015);
        break;
      case "boss":
        this.tone(130, 0.55, "sawtooth", 0.07, 0.62);
        this.tone(92, 0.7, "square", 0.045, 1.08, 0.18);
        break;
      case "boss-clear":
        this.tone(260, 0.12, "triangle", 0.06, 1.2);
        this.tone(390, 0.18, "triangle", 0.06, 1.2, 0.09);
        this.tone(780, 0.3, "sine", 0.07, 1.08, 0.2);
        break;
      case "barrier":
        this.tone(740, 0.16, "sine", 0.05, 0.72);
        this.tone(1040, 0.22, "triangle", 0.04, 0.85, 0.04);
        break;
      case "core-damage":
        this.noise(0.22, 0.1 * power, 650);
        this.tone(82, 0.34, "sawtooth", 0.11, 0.48);
        this.tone(45, 0.42, "sine", 0.12, 0.72, 0.02);
        break;
      case "game-over":
        this.tone(220, 0.24, "sawtooth", 0.065, 0.75);
        this.tone(145, 0.36, "square", 0.06, 0.65, 0.18);
        this.tone(82, 0.5, "sawtooth", 0.06, 0.5, 0.4);
        break;
    }
  }

  close() {
    Object.values(this.musicLayers).forEach((layer) => {
      if (!layer) return;
      if (layer.timer !== null) window.clearTimeout(layer.timer);
      layer.sources.forEach(({ source }) => {
        try { source.stop(); } catch { /* already ended */ }
      });
    });
    this.musicLayers = {};
    this.musicStarted = false;
    this.musicElement?.pause();
    this.musicElement = null;
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.musicMaster = null;
  }

  private async loadMusicBuffers() {
    if (!this.context) return;
    await Promise.all((Object.entries(MUSIC_FILES) as [MusicLayer, string][]).map(async ([layer, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        this.musicBuffers[layer] = await this.context!.decodeAudioData(await response.arrayBuffer());
      } catch (error) {
        console.warn(`[music] unable to load ${url}`, error);
      }
    }));
  }

  private startElementMusic() {
    if (!this.context || !this.musicMaster || this.musicElement) return;
    const element = new Audio(MUSIC_FILES.normal);
    element.preload = "auto";
    element.loop = true;
    element.crossOrigin = "anonymous";
    const mediaSource = this.context.createMediaElementSource(element);
    const gain = this.context.createGain();
    mediaSource.connect(gain);
    gain.connect(this.musicMaster);
    this.musicElement = element;
    this.musicLayers.normal = { gain, sources: new Set(), timer: null };
    void element.play().catch((error) => console.warn("[music] element playback blocked", error));
  }

  private async loadSfxBuffers() {
    if (!this.context) return;
    await Promise.all((Object.entries(SFX_FILES) as [GameSound, string][]).map(async ([sound, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        this.sfxBuffers[sound] = await this.context!.decodeAudioData(await response.arrayBuffer());
      } catch (error) {
        console.warn(`[sfx] unable to load ${url}`, error);
      }
    }));
  }

  private applyMusicState() {
    if (!this.context || !this.musicStarted) return;
    const { active } = this.musicState;
    const params = MUSIC_STATE_PARAMS[this.musicState.state];
    const targets: Record<MusicLayer, number> = { normal: active ? params.gain : 0.0001 };
    const now = this.context.currentTime;
    if (this.musicElement) {
      this.musicElement.playbackRate = params.rate;
      this.musicElement.preservesPitch = true;
    }
    (Object.keys(targets) as MusicLayer[]).forEach((layer) => {
      const runtime = this.musicLayers[layer];
      if (!runtime) return;
      runtime.gain.gain.cancelScheduledValues(now);
      runtime.gain.gain.setTargetAtTime(targets[layer], now, MUSIC_CROSSFADE_SECONDS / 3);
      runtime.sources.forEach(({ source }) => {
        source.playbackRate.setTargetAtTime(params.rate, now, MUSIC_CROSSFADE_SECONDS / 3);
        source.detune.setTargetAtTime(params.detune, now, MUSIC_CROSSFADE_SECONDS / 3);
      });
    });
  }

  private createMusicSource(layer: MusicLayer, startAt: number, fadeInSeconds: number) {
    const context = this.context;
    const buffer = this.musicBuffers[layer];
    const runtime = this.musicLayers[layer];
    if (!context || !buffer || !runtime) return null;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(runtime.gain);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(1, startAt + fadeInSeconds);
    const entry = { source, gain };
    runtime.sources.add(entry);
    source.addEventListener("ended", () => runtime.sources.delete(entry), { once: true });
    source.start(startAt);
    return entry;
  }

  private scheduleMusicLoop(layer: MusicLayer, startAt: number) {
    const context = this.context;
    const buffer = this.musicBuffers[layer];
    const runtime = this.musicLayers[layer];
    if (!context || !buffer || !runtime || !this.musicStarted) return;
    const nextAt = startAt + Math.max(0.1, buffer.duration - MUSIC_CROSSFADE_SECONDS);
    const delay = Math.max(50, (nextAt - context.currentTime) * 1000 - 250);
    runtime.timer = window.setTimeout(() => {
      if (!this.musicStarted || !this.context) return;
      const next = this.createMusicSource(layer, nextAt, MUSIC_CROSSFADE_SECONDS);
      if (!next) return;
      runtime.sources.forEach((entry) => {
        if (entry === next) return;
        entry.gain.gain.setValueAtTime(1, nextAt);
        entry.gain.gain.linearRampToValueAtTime(0.0001, nextAt + MUSIC_CROSSFADE_SECONDS);
        try { entry.source.stop(nextAt + MUSIC_CROSSFADE_SECONDS + 0.05); } catch { /* already ended */ }
      });
      this.scheduleMusicLoop(layer, nextAt);
    }, delay);
  }

  private playSample(buffer: AudioBuffer, intensity: number) {
    if (!this.context || !this.master || this.muted || this.context.state !== "running") return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const start = this.context.currentTime;
    source.buffer = buffer;
    source.detune.value = (Math.random() - 0.5) * 24;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.72, 0.38 * intensity), start + 0.004);
    gain.gain.setTargetAtTime(0.0001, start + Math.min(0.018, buffer.duration * 0.08), Math.max(0.055, Math.min(0.24, buffer.duration * 0.24)));
    source.connect(gain);
    gain.connect(this.master);
    source.start(start);
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, sweep = 1, delay = 0) {
    if (!this.context || !this.master) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, frequency * sweep), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private noise(duration: number, volume: number, frequency = 900, type: BiquadFilterType = "lowpass") {
    if (!this.context || !this.master) return;
    const samples = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, samples, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < samples; index++) data[index] = (Math.random() * 2 - 1) * (1 - index / samples);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = type;
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }
}
