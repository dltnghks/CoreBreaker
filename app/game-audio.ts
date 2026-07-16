export type GameSound = "start" | "paddle" | "brick-hit" | "brick-break" | "explosion" | "item" | "level-up" | "skill" | "skill-impact" | "critical" | "ultimate" | "boss" | "boss-clear" | "barrier" | "core-damage" | "game-over";

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private muted = false;
  private lastPlayed: Partial<Record<GameSound, number>> = {};

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
      this.master.gain.value = this.muted ? 0 : 0.28;
      this.master.connect(this.compressor);
      this.compressor.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.28, this.context.currentTime, 0.015);
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
      case "ultimate":
        this.noise(0.34, 0.12 * power, 820);
        this.tone(58, 0.48, "sine", 0.13, 0.55);
        this.tone(220, 0.28, "sawtooth", 0.075, 1.8, 0.04);
        this.tone(660, 0.34, "triangle", 0.07, 1.35, 0.12);
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
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.compressor = null;
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
