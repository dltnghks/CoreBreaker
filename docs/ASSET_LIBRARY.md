# CORE BREAKER — Asset Library

> Initial curation · 2026-08-05  
> Owner: Lead Art Direction  
> Status: reference shortlist; selected third-party assets are documented separately in `docs/THIRD_PARTY_ASSETS.md`

This document describes art-direction candidates and reference sources. It is not an inventory of imported runtime files. A candidate listed here should not be treated as used in the game unless it also appears in `docs/THIRD_PARTY_ASSETS.md` or is identified as a project original.

## Curation rule

CORE BREAKER is not assembled from unrelated fantasy packs. The library uses one visual grammar:

**dark stone mass → aged bronze trim → restrained rune geometry → one high-energy crystal accent.**

The player ball, collision, brick state, and chain reaction remain visually dominant. Decorative assets must stay in the frame, environment, or event layers and must never compete with gameplay readability.

Ratings:

- `★★★★★ Essential` — approved foundation asset
- `★★★★☆ Recommended` — approved with an art pass
- `★★★☆☆ Optional` — useful for blockout, secondary content, or controlled effects
- `★★☆☆☆ Weak` — reference only unless heavily rebuilt
- `★☆☆☆☆ Reject` — do not bring into the project

## Final CORE BREAKER Asset Library

```text
assets/
  ui/
    kenney-fantasy-ui-borders/
    kenney-ui-pack-adventure/
    oga-free-fantasy-game-gui-reference/
  environment/
    kenney-modular-dungeon-kit/
    oga-dungeon-pack/
    oga-crystals-reference/
  gameplay/
    oga-fantasy-icon-set/
    oga-crystals-reference/
    core-breaker-originals/       # player ball, paddle, brick family
  effects/
    kenney-light-masks/
    oga-pure-projectile-effect-reference/
    oga-2d-spell-effects-reference/
  icons/
    oga-fantasy-icon-set/
    core-breaker-originals/       # skills, buffs, debuffs, status marks
  fonts/
    cinzel/
    alegreya-sans-sc/
    im-fell-english/
  references/
    oga-dungeon-tiles-and-buttons/
    kenney-mini-dungeon/
```

## UI

### Fantasy UI Borders

**Category**: UI / decorative frames / panels / buttons  
**Website**: [Kenney](https://kenney.nl/assets/fantasy-ui-borders)  
**URL**: [Asset page](https://kenney.nl/assets/fantasy-ui-borders)  
**License**: Creative Commons CC0; Kenney states that assets on its asset pages can be used commercially without attribution. [License guidance](https://kenney.nl/support)  
**Preview**: [Kenney preview gallery](https://kenney.nl/assets/fantasy-ui-borders)  
**Rating**: `★★★★★ Essential`

**Why it fits CORE BREAKER**: This is the closest approved source for irregular fantasy borders and modular decorative corners. Its primitives can establish Hades-like framing without importing a complete, conflicting UI skin.

**Recommended usage**: HUD frame corners, relic selection windows, pause window, tooltip header, wave-clear banner, and low-contrast section dividers.

**Suggested modifications**: Remove bright gold fills; keep only line art and corner geometry. Recolor bronze toward `#B87945`, darken fills to `#151A22`, add a 1px rune-teal inner line, and introduce a worn stone mask. Use only 10–20% opacity for decorative borders during combat.

### UI Pack - Adventure

**Category**: UI / buttons / panels / sliders  
**Website**: [Kenney](https://kenney.nl/assets/ui-pack-adventure)  
**URL**: [Asset page](https://kenney.nl/assets/ui-pack-adventure)  
**License**: Creative Commons CC0.  
**Preview**: [Kenney preview gallery](https://kenney.nl/assets/ui-pack-adventure)  
**Rating**: `★★★★☆ Recommended`

**Why it fits CORE BREAKER**: The pack provides a coherent set of scalable control primitives and panel states, which is valuable for prototyping Skill Lab and upgrade selection before the final custom pass.

**Recommended usage**: Prototype-only button states, disabled/active states, sliders, and selection focus references.

**Suggested modifications**: Do not ship the pack as-is. Replace saturated fills with stone/bronze materials, remove bevel-heavy or cartoon details, reduce corner radius, add irregular mask breaks, and use the project’s rune icons instead of generic symbols.

### Free Fantasy Game GUI

**Category**: UI / vector frames / windows / icons  
**Website**: [OpenGameArt.org](https://opengameart.org/content/free-fantasy-game-gui)  
**URL**: [Asset page](https://opengameart.org/content/free-fantasy-game-gui)  
**License**: CC0; the page describes the assets as editable vector UI elements for commercial projects.  
**Preview**: [OpenGameArt preview](https://opengameart.org/content/free-fantasy-game-gui)  
**Rating**: `★★★☆☆ Optional`

**Why it fits CORE BREAKER**: The vector source format makes it useful for extracting simple scroll, frame, and button geometry without a resolution ceiling.

**Recommended usage**: Reference and selective extraction for upgrade-screen relic panels, not for the active HUD.

**Suggested modifications**: Strip generic RPG ornament, remove gradients, redraw every icon in the CORE BREAKER rune language, desaturate by 35%, and rebuild the material response as stone plus oxidized bronze. Direct use is not approved.

## Environment

### Modular Dungeon Kit

**Category**: Environment / dungeon / floor / walls / pillars  
**Website**: [Kenney](https://kenney.nl/assets/modular-dungeon-kit)  
**URL**: [Asset page](https://kenney.nl/assets/modular-dungeon-kit)  
**License**: Creative Commons CC0.  
**Preview**: [Kenney preview gallery](https://kenney.nl/assets/modular-dungeon-kit)  
**Rating**: `★★★★☆ Recommended`

**Why it fits CORE BREAKER**: It provides a modular spatial base for the ancient ruin language, including updated ground texture, color variation, and taller wall options.

**Recommended usage**: Blockout for the Sanctum, background arches, stone floor plane, distant pillars, and camera-safe arena dressing.

**Suggested modifications**: Use as a structural base, not as the finished look. Replace clean surfaces with two stone value families, add bronze anchor plates and sparse rune decals, lower ambient saturation, and reserve teal/crystal emission for gameplay moments.

### Dungeon Pack

**Category**: Environment / dungeon / floor / walls / props / interface reference  
**Website**: [OpenGameArt.org](https://opengameart.org/content/dungeon-pack)  
**URL**: [Asset page](https://opengameart.org/content/dungeon-pack)  
**License**: CC0; the page explicitly allows personal, educational, and commercial use.  
**Preview**: [OpenGameArt preview](https://opengameart.org/content/dungeon-pack)  
**Rating**: `★★★☆☆ Optional`

**Why it fits CORE BREAKER**: The grayscale palette and included walls, floors, props, and interface pieces make it a useful value and composition reference for the ruin environment.

**Recommended usage**: Graybox reference, silhouette studies, and prop density studies. Directly usable only after a controlled upscale/repaint pass.

**Suggested modifications**: Do not use the default Zelda-like palette. Rebuild the palette around `#0B0D12`, `#68717C`, and `#B87945`; remove pixel-level outlines; add large-scale stone breakup and a single rune-light source.

### Crystals

**Category**: Environment / crystal / gameplay orb reference  
**Website**: [OpenGameArt.org](https://opengameart.org/content/crystals-0)  
**URL**: [Asset page](https://opengameart.org/content/crystals-0)  
**License**: CC0; the page identifies the contributing source images and re-releases the set under CC0.  
**Preview**: [OpenGameArt preview](https://opengameart.org/content/crystals-0)  
**Rating**: `★★★☆☆ Optional`

**Why it fits CORE BREAKER**: Crystal silhouettes and mineral facets are directly relevant to the player core, crystal bricks, and ruin props.

**Recommended usage**: Shape reference for the player ball evolution, crystal clusters, and collectible/core fragments.

**Suggested modifications**: Treat the source as a silhouette library. Redraw at a larger working resolution, reduce the number of facets, add a dark stone socket, and use `#8EFFF0` only on the inner core rather than bathing the entire crystal in neon.

## Gameplay

### Fantasy Icon Set

**Category**: Gameplay / icons / currency / relics / status objects  
**Website**: [OpenGameArt.org](https://opengameart.org/content/fantasy-icon-set)  
**URL**: [Asset page](https://opengameart.org/content/fantasy-icon-set)  
**License**: CC0; the page states commercial use is allowed and no attribution is required.  
**Preview**: [OpenGameArt preview](https://opengameart.org/content/fantasy-icon-set)  
**Rating**: `★★★★☆ Recommended`

**Why it fits CORE BREAKER**: The source is high-definition rather than a tiny pixel sheet and can supply a small set of physical object motifs such as shield, gold, rose, wood, and relic-like silhouettes.

**Recommended usage**: Currency marker, relic inventory seed, non-combat reward objects, and reference for the scale and lighting of skill icons.

**Suggested modifications**: Re-render or repaint into the project’s dark stone/bronze material language. Crop aggressively, remove background, keep one light direction, and replace soft fantasy gradients with a hard rim plus controlled rune glow. Do not use it for the core skill family without redrawing.

### Core Breaker Originals — player ball / paddle / brick family

**Category**: Gameplay / player ball / paddle / breakable blocks  
**Website**: Internal art direction  
**URL**: [ART_DIRECTION.md](ART_DIRECTION.md)  
**License**: Original project asset; no external license.  
**Preview**: [Gameplay interface prototype](../app/visual-directions/page.tsx)  
**Rating**: `★★★★★ Essential`

**Why it fits CORE BREAKER**: These elements are the identity carriers and must not be delegated to a generic asset pack. The ball needs a distinct silhouette, the paddle needs the correct relic weight, and every brick type needs readable state language.

**Recommended usage**: Final production source for player ball evolution, bronze/rune paddle, Normal/Heavy/Guard/Heal/Reflect/Explosion/Unbreakable bricks.

**Suggested modifications**: Continue as original art. Keep collision feedback brighter than the brick material, use damage cracks instead of HP numbers, and bind each brick type to a material plus a shape/pattern cue.

## Effects

### Light Masks

**Category**: VFX / light masks / cookies / impact lighting  
**Website**: [Kenney](https://kenney.nl/assets/light-masks)  
**URL**: [Asset page](https://kenney.nl/assets/light-masks)  
**License**: Creative Commons CC0.  
**Preview**: [Kenney preview gallery](https://kenney.nl/assets/light-masks)  
**Rating**: `★★★★★ Essential`

**Why it fits CORE BREAKER**: Masks are a better match than importing a full generic VFX pack because they let the team author the final motion, color, and timing around collision readability.

**Recommended usage**: Ball glow, collision flash, chain-reaction pulse, crystal emissive breakup, and restrained screen-space light accents.

**Suggested modifications**: Use as additive masks only. Tint by attribute, keep the player core in the brightest band, clamp the screen footprint, and avoid full-screen bloom except for CORE loss, boss arrival, or wave clear.

### Pure Projectile — Magic Effect

**Category**: VFX / projectile / magic impact reference  
**Website**: [OpenGameArt.org](https://opengameart.org/content/pure-projectile-magic-effect)  
**URL**: [Asset page](https://opengameart.org/content/pure-projectile-magic-effect)  
**License**: CC0.  
**Preview**: [OpenGameArt preview](https://opengameart.org/content/pure-projectile-magic-effect)  
**Rating**: `★★★☆☆ Optional`

**Why it fits CORE BREAKER**: The pack has useful examples of projectile and spell energy silhouettes, but it should not define the final VFX style.

**Recommended usage**: Motion and shape reference for Fire, Holy, and Dark impact layers.

**Suggested modifications**: Use only as reference or as temporary prototype layers. Remove soft fantasy halos, convert to a sharper impact → damage → chain sequence, and redraw residual trails so they do not obscure the ball.

### 2D Spell Effects

**Category**: VFX / fire / lightning / explosion / rain  
**Website**: [OpenGameArt.org](https://opengameart.org/content/2d-spell-effects)  
**URL**: [Asset page](https://opengameart.org/content/2d-spell-effects)  
**License**: CC0; the creator describes the files as free for any project.  
**Preview**: [OpenGameArt preview](https://opengameart.org/content/2d-spell-effects)  
**Rating**: `★★★☆☆ Optional`

**Why it fits CORE BREAKER**: It contains a useful range of elemental effect studies and transparent PNG layers.

**Recommended usage**: Timing reference and temporary effects during combat feedback prototyping.

**Suggested modifications**: Reject the older rendering language as final art. Reduce blur, sharpen the silhouette, recolor to the approved attribute palette, and limit each effect to one impact focal point.

## Icons

### Fantasy Icon Set — icon source subset

**Category**: Icons / currency / buffs / world objects  
**Website**: [OpenGameArt.org](https://opengameart.org/content/fantasy-icon-set)  
**URL**: [Asset page](https://opengameart.org/content/fantasy-icon-set)  
**License**: CC0.  
**Preview**: [OpenGameArt preview](https://opengameart.org/content/fantasy-icon-set)  
**Rating**: `★★★★☆ Recommended`

**Why it fits CORE BREAKER**: High-resolution object icons can be selectively reduced into a consistent relic vocabulary without inheriting a pixel-art language.

**Recommended usage**: Gold/currency, repair, shield, relic fragments, and non-combat reward marks.

**Suggested modifications**: Normalize all icons to one 3/4 light direction, a 1px dark keyline, and one colored accent. The skill icon set itself should remain original and rune-driven.

## Fonts

Google Fonts’ repository explains that family folders include the exact font files and license metadata, with most families using SIL Open Font License 1.1. [Google Fonts repository and licensing guidance](https://github.com/google/fonts)

### Cinzel

**Category**: Fonts / fantasy title / relic name  
**Website**: [Google Fonts](https://fonts.google.com/specimen/Cinzel)  
**URL**: [Font page](https://fonts.google.com/specimen/Cinzel)  
**License**: SIL Open Font License 1.1.  
**Preview**: [Google Fonts specimen](https://fonts.google.com/specimen/Cinzel)  
**Rating**: `★★★★☆ Recommended`

**Why it fits CORE BREAKER**: Monumental capitals and Roman inscription cues support the ancient ruin layer.

**Recommended usage**: Title, wave clear, boss names, relic names, and short ceremonial labels.

**Suggested modifications**: Use sparingly at display sizes. Increase tracking for labels, avoid long body copy, and pair with Alegreya Sans SC for functional UI.

### Alegreya Sans SC

**Category**: Fonts / UI / HUD / short descriptions  
**Website**: [Google Fonts](https://fonts.google.com/specimen/Alegreya+Sans+SC)  
**URL**: [Font page](https://fonts.google.com/specimen/Alegreya+Sans+SC)  
**License**: SIL Open Font License 1.1; the family is also described as open-source and commercially usable by Adobe Fonts.  
**Preview**: [Google Fonts specimen](https://fonts.google.com/specimen/Alegreya+Sans+SC)  
**Rating**: `★★★★★ Essential`

**Why it fits CORE BREAKER**: It provides a humanist, slightly ritualized UI voice without looking like a dashboard or a mobile RPG.

**Recommended usage**: HUD labels, wave/timer labels, relic descriptions, tooltips, and menu controls.

**Suggested modifications**: Use bold or extra-bold only for labels and damage numbers. Keep body copy at high contrast and avoid all-caps paragraphs.

### IM Fell English

**Category**: Fonts / flavor text / lore / ceremonial secondary title  
**Website**: [Google Fonts](https://fonts.google.com/specimen/IM+Fell+English)  
**URL**: [Font page](https://fonts.google.com/specimen/IM+Fell+English)  
**License**: SIL Open Font License 1.1. [License confirmation](https://ctan.org/tex-archive/fonts/imfellenglish?lang=en)  
**Preview**: [Google Fonts specimen](https://fonts.google.com/specimen/IM+Fell+English)  
**Rating**: `★★★☆☆ Optional`

**Why it fits CORE BREAKER**: It adds an old printed-manuscript note that can support lore and relic flavor without contaminating the gameplay HUD.

**Recommended usage**: Lore fragments, loading text, relic flavor lines, or a rare ceremonial callout.

**Suggested modifications**: Never use for timers, damage numbers, or dense instructions. Pair with the UI sans and keep opacity below primary information.

## References only

### Dungeon tiles and buttons 16x16

**Category**: Reference / dungeon tiles / buttons  
**Website**: [OpenGameArt.org](https://opengameart.org/content/dungeon-tiles-and-buttons-16x16)  
**URL**: [Asset page](https://opengameart.org/content/dungeon-tiles-and-buttons-16x16)  
**License**: CC0; commercial use is allowed and attribution is appreciated but not required.  
**Preview**: [OpenGameArt preview](https://opengameart.org/content/dungeon-tiles-and-buttons-16x16)  
**Rating**: `★★☆☆☆ Weak`

**Why it is not a final asset**: The page presents 16×16 dungeon tiles and buttons with a Zelda-like pixel language. That conflicts with the non-pixel, premium dark-fantasy direction.

**Recommended usage**: Reference only for tile rhythm and button silhouette. Do not import into the shipped asset library.

**Suggested modifications**: Rebuild from scratch at high resolution with chiseled stone edges, bronze pins, and rune-teal emissive seams.

### Mini Dungeon

**Category**: Reference / dungeon props / medieval forms  
**Website**: [Kenney](https://kenney.nl/assets/mini-dungeon)  
**URL**: [Asset page](https://kenney.nl/assets/mini-dungeon)  
**License**: Creative Commons CC0.  
**Preview**: [Kenney preview gallery](https://kenney.nl/assets/mini-dungeon)  
**Rating**: `★★★☆☆ Optional`

**Why it is not a final asset**: The miniature 3D style is useful for understanding prop silhouettes but is too toy-like and compact to become the final visual language.

**Recommended usage**: Reference only for pillar, weapon, shield, and dungeon prop silhouettes.

**Suggested modifications**: If used in blockout, hide the low-poly read with dark materials and replace the final surfaces with original sculpted assets.

## Rejected candidates

| Candidate | Rating | Rejection reason |
|---|---:|---|
| [Kenney Brick Kit](https://kenney.nl/assets/brick-kit) | ★☆☆☆☆ | Official page tags it as toy/plastic; wrong material language for ancient stone relics. |
| [Kenney UI Pack](https://kenney.nl/assets/ui-pack) | ★★☆☆☆ | Useful generic primitives, but too clean and neutral to define CORE BREAKER. Use only if stripped to source geometry. |
| [OpenGameArt UI pieces](https://opengameart.org/content/ui-pieces) | ★☆☆☆☆ | Explicitly pixel-art and DawnBringer-based; conflicts with the premium non-pixel direction. |
| [OpenGameArt Particle Effects](https://opengameart.org/content/particle-effects) | ★★☆☆☆ | Mixed/older pixel-art-ish collection and dual CC-BY/CC-BY-SA licensing; not suitable for a clean production intake. |
| [OpenGameArt Some basic UI icons](https://opengameart.org/content/some-basic-ui-icons) | ★☆☆☆☆ | Pixel-art map/editor language; too generic and too small for gameplay-critical icons. |
| [OpenGameArt Magic Effect Particle System](https://opengameart.org/content/magic-effect-particle-system) | ★★☆☆☆ | CC-BY 4.0 is commercially usable, but the pack is too small and inconsistent to anchor the project; keep only as a possible credited prototype. |

## Style consistency review

### Duplicated styles

- Kenney UI and OpenGameArt fantasy GUI both offer borders, buttons, panels, and icons. Select Kenney Fantasy UI Borders as the only structural frame source; use the OGA vector GUI only for isolated geometry studies.
- The Dungeon Pack, Modular Dungeon Kit, and Mini Dungeon all cover dungeon architecture. Use Modular Dungeon Kit for 3D structure, Dungeon Pack for graybox value studies, and Mini Dungeon only for silhouette reference.
- Crystals and Fantasy Icon Set both provide collectible/object motifs. Crystals own the mineral language; Fantasy Icon Set owns low-priority inventory objects.

### Conflicting styles

- Pixel-art packs conflict with the premium dark-fantasy target and are rejected from final use.
- Kenney’s cleaner modular style needs surface breakup and a controlled material pass before it can sit beside the hand-authored CORE and brick art.
- Vector fantasy UI can become glossy or generic if shipped unchanged. It must be reduced to dark fills, thin bronze structure, and one rune accent.
- Soft spell halos conflict with the “collision first” rule. Convert them to short, directional impact layers.

### Unified art direction recommendations

1. Use one material hierarchy everywhere: charcoal stone base, muted bronze edge, pale rune highlight, one attribute color.
2. Keep an 80/15/5 value ratio: 80% dark neutral, 15% stone/bronze structure, 5% high-energy accent.
3. Use one light direction for all icons and props: upper-left key, lower-right occlusion.
4. Reserve `#8EFFF0` and `#26D9C4` for the player ball, active rune state, and chain-reaction energy; do not use them as generic decoration.
5. Replace generic icons with a single rune vocabulary built from circles, diamonds, split rings, cracks, and directional cuts.
6. Keep frames outside the playfield’s main read. HUD borders should be thin, broken, and low opacity; gameplay feedback should be bright, short, and spatially attached.
7. Maintain one approved modification preset for third-party assets: desaturate → darken base → add stone/bronze material → add controlled edge light → add rune accent → test at gameplay scale.

## Acquisition checklist

- [ ] Download only from the linked original page.
- [ ] Save the asset’s license text or page snapshot beside the intake record.
- [ ] Preserve author and source URL even for CC0 assets.
- [ ] Put third-party content under the matching `assets/` subfolder with its own `LICENSE.txt`.
- [ ] Run a 900×600 gameplay-scale readability test before integrating.
- [ ] Check bright and dark backgrounds, reduced saturation, and colorblind-safe secondary cues.
- [ ] Never use a candidate in production before the modification pass and Art QA checklist in `ART_DIRECTION.md`.
