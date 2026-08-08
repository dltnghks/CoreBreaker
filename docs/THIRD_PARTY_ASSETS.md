# Third-party assets

> Last audited: 2026-08-09
>
> Runtime usage: combat VFX are loaded by `app/GameRuntime.tsx` and rendered by `app/game-runtime-canvas.ts`; procedural Canvas effects remain as loading/error fallbacks.

## BGM

- File: `public/audio/BGM_LOOP.mp3`
- Title: **Retro Arcade Game Music**
- Creator: MondaMusic
- Source: https://pixabay.com/music/video-games-retro-arcade-game-music-512837/
- License: Pixabay Content License
- Changes: Used as the looping gameplay BGM. The repository also contains `public/audio/BGM_LOOP.m4a` as an alternate encoded copy.

Pixabay attribution is retained here for provenance. Redistribution remains subject to the Pixabay Content License.

## Ring Explosion

- File: `public/assets/vfx/ring-explosion.png`
- Original title: **Ring Explosion**
- Creator: BenHickling
- Source: https://opengameart.org/content/ring-explosion
- License: CC0 1.0 Universal
- License URL: https://creativecommons.org/publicdomain/zero/1.0/
- Changes: Renamed on import and rendered as a 56-frame, 10-column sprite sheet. No pixel edits.

Attribution is not required by CC0, but the source is retained here for provenance and future asset audits.

## Spark Effect

- Files: `public/assets/vfx/hit-spark-a.png`, `public/assets/vfx/hit-spark-b.png`
- Original title: **Spark effect**
- Creator: kurohina
- Source: https://opengameart.org/content/spark-effect
- License: CC0 1.0 Universal
- License URL: https://creativecommons.org/publicdomain/zero/1.0/
- Changes: Renamed on import. Both 9-frame strips are rendered at different sizes for normal and guarded brick impacts.

## Radial Lightning Effect

- File: `public/assets/vfx/radial-lightning.png`
- Original title: **Radial lightning effect** (`pixelated_tilesheet.png` variant)
- Creator: 13rice
- Source: https://opengameart.org/content/radial-lightning-effect
- License: CC0 1.0 Universal
- License URL: https://creativecommons.org/publicdomain/zero/1.0/
- Changes: Renamed on import. The 8-frame sheet is color-shifted at runtime for warrior and critical-hit variants.

## Pixel Art Spells

- Files: `public/assets/vfx/mage-fireball.png`, `public/assets/vfx/mage-sparks.png`
- Original title: **Pixel Art Spells** (`Fireball.png`, `Magic Sparks.png`)
- Creator: DevWizard
- Source: https://opengameart.org/content/pixel-art-spells
- License: CC0 1.0 Universal
- License URL: https://creativecommons.org/publicdomain/zero/1.0/
- Changes: Selected and renamed two 6-frame strips. Fireball rotates with ball velocity; sparks remain screen-aligned.

## Usage policy

- Every imported asset must retain its original title, creator, source URL, license, and local filename in this document.
- New assets must be license-compatible with redistribution in the playable web build.
- CC0 assets may be tinted, scaled, rotated, frame-cropped, or composited at runtime.
- Gameplay must remain readable if an image fails to load; procedural fallback effects are required for critical hit, explosion, and skill feedback.
- Asset changes that materially alter the visual language must also update `docs/GAME_DESIGN.md`.
