import wave
from pathlib import Path

import numpy as np


SR = 48_000
OUT = Path(__file__).parents[1] / "public" / "audio" / "sfx"


SOUNDS = {
    # Core gameplay
    "ball-launch": ("sweep", 220, 520, 0.18, 0.28),
    "paddle-reflect": ("click", 280, 190, 0.07, 0.23),
    "wall-reflect": ("click", 180, 120, 0.06, 0.18),
    "brick-hit": ("stone", 180, 120, 0.08, 0.22),
    "brick-break": ("stone-break", 230, 90, 0.28, 0.32),
    "ball-lost": ("fall", 320, 70, 0.34, 0.25),
    "last-ball-lost": ("fall", 260, 42, 0.55, 0.34),
    "item-drop": ("sparkle", 430, 720, 0.18, 0.18),
    "item-pickup": ("sparkle", 520, 1040, 0.28, 0.26),
    "multiball-pickup": ("magic-rise", 260, 780, 0.42, 0.28),
    "core-repair": ("heal", 330, 660, 0.52, 0.25),
    "cooldown-reset": ("magic-rise", 520, 880, 0.34, 0.22),
    # Combat and skills
    "skill-cast": ("magic-rise", 260, 620, 0.34, 0.27),
    "skill-charge-ready": ("sparkle", 660, 1320, 0.32, 0.22),
    "skill-impact": ("impact-magic", 180, 720, 0.26, 0.32),
    "magic-attack": ("magic-rise", 380, 980, 0.27, 0.24),
    "physical-attack": ("impact", 130, 80, 0.20, 0.30),
    "critical-hit": ("critical", 110, 1040, 0.38, 0.37),
    "chain-attack": ("sparkle", 420, 880, 0.24, 0.25),
    "pierce-attack": ("sweep", 720, 300, 0.22, 0.28),
    "explosion": ("explosion", 120, 55, 0.50, 0.42),
    "fire-attack": ("fire", 170, 90, 0.34, 0.32),
    "frost-attack": ("crystal", 780, 1220, 0.36, 0.26),
    "gravity-well": ("gravity", 110, 48, 0.72, 0.30),
    "black-hole": ("gravity", 220, 38, 0.85, 0.36),
    "projectile-launch": ("sweep", 280, 900, 0.18, 0.25),
    "weakpoint-hit": ("critical", 180, 1240, 0.25, 0.34),
    "enemy-defeat": ("stone-break", 300, 80, 0.34, 0.28),
    "healer-brick": ("heal", 240, 620, 0.42, 0.24),
    "barrier-create": ("shield", 180, 620, 0.50, 0.26),
    "barrier-reflect": ("shield", 500, 980, 0.22, 0.28),
    "barrier-break": ("crystal-break", 920, 180, 0.38, 0.31),
    # Rune and magic ambience
    "rune-activate": ("rune", 240, 720, 0.72, 0.24),
    "rune-charge": ("rune", 320, 960, 0.65, 0.22),
    "rune-rotate": ("sweep", 780, 420, 0.36, 0.18),
    "crystal-create": ("crystal", 540, 1180, 0.42, 0.22),
    "crystal-shatter": ("crystal-break", 1040, 260, 0.48, 0.28),
    "magic-energy-rise": ("magic-rise", 280, 820, 0.85, 0.21),
    "magic-energy-fade": ("fall", 680, 90, 0.62, 0.18),
    "warp": ("warp", 160, 1240, 0.72, 0.28),
    "stone-resonance": ("stone", 110, 72, 0.82, 0.20),
    "ancient-device": ("rune", 160, 520, 0.86, 0.23),
    "magic-failure": ("fall", 240, 55, 0.42, 0.25),
    # Boss
    "boss-arrival": ("boss-rise", 48, 260, 1.25, 0.42),
    "boss-battle-start": ("boss-rise", 72, 380, 0.92, 0.38),
    "boss-attack-telegraph": ("rune", 96, 180, 0.62, 0.29),
    "boss-attack-launch": ("impact", 100, 54, 0.30, 0.40),
    "boss-wall-create": ("stone", 70, 42, 0.72, 0.34),
    "boss-barrier-create": ("shield", 90, 440, 0.72, 0.34),
    "boss-shield-active": ("shield", 180, 720, 0.68, 0.30),
    "boss-shield-break": ("crystal-break", 760, 90, 0.60, 0.40),
    "boss-core-hit": ("impact", 85, 42, 0.34, 0.42),
    "boss-core-warning": ("boss-rise", 62, 31, 0.80, 0.40),
    "boss-core-destroy": ("explosion", 60, 28, 1.00, 0.52),
    "boss-pattern-shift": ("warp", 140, 880, 0.72, 0.30),
    "boss-defeat": ("boss-rise", 80, 1040, 1.20, 0.44),
    "boss-reward": ("magic-rise", 260, 1040, 0.74, 0.30),
    # UI and flow
    "ui-hover": ("ui", 520, 520, 0.045, 0.10),
    "ui-click": ("ui", 680, 820, 0.075, 0.16),
    "start-confirm": ("ui-rise", 240, 720, 0.24, 0.22),
    "skill-select": ("ui-rise", 330, 660, 0.30, 0.20),
    "skill-reroll": ("sweep", 560, 240, 0.22, 0.17),
    "wave-start": ("rune", 180, 520, 0.60, 0.24),
    "wave-clear": ("ui-rise", 300, 900, 0.68, 0.28),
    "level-up": ("ui-rise", 280, 880, 0.76, 0.26),
    "reward-select": ("sparkle", 420, 920, 0.42, 0.22),
    "countdown": ("ui", 240, 240, 0.12, 0.18),
    "pause": ("fall", 520, 160, 0.18, 0.16),
    "game-over": ("fall", 220, 48, 0.90, 0.36),
    # Environment and feedback
    "brick-crack": ("stone", 260, 180, 0.12, 0.17),
    "stone-debris": ("stone-break", 150, 70, 0.42, 0.25),
    "metal-impact": ("impact", 380, 90, 0.18, 0.28),
    "low-impact": ("impact", 72, 38, 0.38, 0.38),
    "screen-shake-impact": ("impact", 92, 38, 0.28, 0.31),
    "danger-warning": ("warning", 180, 180, 0.38, 0.30),
    "core-danger": ("warning", 130, 260, 0.46, 0.34),
    "time-warning": ("warning", 300, 120, 0.30, 0.25),
    "menu-transition": ("sweep", 260, 520, 0.18, 0.14),
    "save-complete": ("sparkle", 620, 1040, 0.24, 0.18),
}


def env(n, attack=0.02, release=0.2):
    a = max(1, int(SR * attack))
    r = max(1, int(SR * release))
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def render(kind, f0, f1, duration, amp, seed):
    rng = np.random.default_rng(seed)
    n = int(SR * duration)
    t = np.arange(n) / SR
    sweep = f0 * t + (f1 - f0) * t * t / max(2 * duration, 1e-6)
    phase = 2 * np.pi * sweep
    sine = np.sin(phase)
    noise = rng.normal(0, 1, n)
    if kind in {"click", "ui"}:
        x = sine + 0.25 * noise
        e = env(n, 0.002, min(0.05, duration * 0.7))
    elif kind in {"impact", "stone", "stone-break", "explosion", "fire"}:
        x = 0.72 * sine + 0.38 * noise
        e = env(n, 0.003, min(0.35, duration * 0.82))
    elif kind in {"crystal", "crystal-break", "sparkle"}:
        x = sine + 0.35 * np.sin(phase * 2.01 + 0.7) + 0.12 * noise
        e = env(n, 0.006, min(0.32, duration * 0.65))
    elif kind in {"magic-rise", "rune", "ui-rise", "warp", "sweep"}:
        x = 0.72 * sine + 0.22 * np.sin(phase * 2.0) + 0.06 * noise
        e = env(n, 0.025, min(0.28, duration * 0.5))
    elif kind in {"gravity", "fall", "warning"}:
        x = 0.82 * sine + 0.18 * np.sin(phase * 0.5) + 0.12 * noise
        e = env(n, 0.015, min(0.36, duration * 0.65))
    elif kind == "shield":
        x = 0.65 * sine + 0.28 * np.sin(phase * 1.5) + 0.10 * noise
        e = env(n, 0.03, min(0.38, duration * 0.58))
    elif kind == "heal":
        x = 0.75 * sine + 0.20 * np.sin(phase * 2.5) + 0.05 * noise
        e = env(n, 0.03, min(0.28, duration * 0.45))
    elif kind == "critical":
        x = 0.55 * sine + 0.35 * np.sin(phase * 2.7) + 0.25 * noise
        e = env(n, 0.002, min(0.28, duration * 0.75))
    elif kind == "boss-rise":
        x = 0.60 * sine + 0.28 * np.sin(phase * 0.5) + 0.15 * noise
        e = env(n, 0.05, min(0.55, duration * 0.54))
    else:
        x = sine
        e = env(n)
    # Add a quiet, descending resonance tail for a less synthetic finish.
    tail = np.sin(2 * np.pi * max(38, f1 * 0.5) * t) * np.exp(-t * 8) * 0.12
    x = (x + tail) * e * amp
    x /= max(1, np.max(np.abs(x)))
    return np.int16(np.clip(x * 0.82, -1, 1) * 32767)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for index, (name, params) in enumerate(SOUNDS.items()):
        kind, f0, f1, duration, amp = params
        audio = render(kind, f0, f1, duration, amp, 20260807 + index * 17)
        target = OUT / f"{name}.wav"
        with wave.open(str(target), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(SR)
            wav.writeframes(audio.tobytes())
    print(f"Generated {len(SOUNDS)} original procedural SFX files in {OUT}")


if __name__ == "__main__":
    main()
