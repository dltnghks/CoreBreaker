# Canonical engine parity gate

The canonical engine is the only production simulation path for normal play,
WATCH, and HEADLESS. This table records the migration evidence that must stay
green before legacy code can be deleted. `동일` means deterministic state and
semantic-event parity; presentation-only particle variation is not compared.

| Rule area | Status | Canonical implementation | Regression evidence | Comparison |
| --- | --- | --- | --- | --- |
| 120 Hz time and paddle input | 동일 | `canonical-engine.ts` temporal/input phase | `game-loop-fixed-step`, `game-runtime-projection` | time/position `1e-4` |
| Ball movement and wall reflection | 동일 | canonical ball phase + `collision-physics.ts` | 120-frame ball parity | position/velocity `1e-4` |
| Brick and paddle collision | 동일 | canonical collision phase | brick/paddle parity tests | HP exact, vectors `1e-4` |
| Guard, explosive, indestructible, healer, reflector | 동일 | canonical brick phase | benchmark parity contracts | HP/trait/alive exact |
| Boss layout and reinforcements | 동일 | canonical wave/boss phase | boss-layout and seeded pilot tests | IDs/HP/phase exact |
| Items, core damage, respawn | 동일 | canonical item and lifecycle phases | item contract and recovery tests | kind/core/ball count exact |
| Common and legacy-compatible skills | 동일 | canonical skill dispatch | common passive and payload tests | state/effect contract exact |
| Warrior, archer, mage and common skills | 동일 | canonical skill dispatch | every-skill tests | activation/damage/events exact |
| Score, combo, metrics | 동일 | canonical damage and completion phases | deterministic benchmark tests | exact |
| Start, wave, boss rewards | 동일 | canonical phase/command contract | interactive command tests | choices/phase/history exact |
| Replayable RNG | 동일 | serializable world/reward PRNG state | serialization/RNG test | exact |
| Audio, VFX, shake | 동일 | semantic `GameEvent` + `useGamePresentation` | event FIFO and visible runtime tests | semantic events exact |
| Direct `GameViewState` projection | 동일 | `game-view-projection` + `game-runtime-projection` | detached projection tests | projected fields exact |

## Approved differences

There are currently no approved gameplay-rule differences. Any intentional
balance or rule change must be added here with its expected result and a
dedicated test; it must not be hidden by widening parity tolerances.

## Cutover checkpoints

1. Contract: phase/command/outcome, serializable RNG, semantic events.
2. Default: normal play, WATCH, and HEADLESS use the canonical fixed-step path.
3. Removal: the compatibility bridge and reverse state mapping are deleted;
   visible runtime state is now a one-way, detached projection.

All parity rows are green. New gameplay rules must be implemented in the
canonical engine and consumed through projection/events.
