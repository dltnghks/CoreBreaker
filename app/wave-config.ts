export type WaveDefinition = {
  wave: number;
  name: string;
  timeLimit: number;
  boss: "mid" | "final" | null;
  pattern: string[];
};

export const WAVE_TIME_LIMIT = 60;

const wave = (wave: number, name: string, _timeLimit: number, pattern: string[], boss: WaveDefinition["boss"] = null): WaveDefinition => ({ wave, name, timeLimit: WAVE_TIME_LIMIT, pattern, boss });

// n: normal, h: high HP, g: one-hit guard, e: explosive,
// x: indestructible, c: healer, r: underside reflector, .: gap
export const WAVE_DEFINITIONS: WaveDefinition[] = [
  wave(1, "OPENING", 34, ["..nnnnnnnn..", "...nn..nn..."]),
  wave(2, "GUARD LESSON", 34, ["...gg..gg...", "..nnnnnnnn..", "....nnnn...."]),
  wave(3, "BOUNCE GATE", 36, ["..rr....rr..", ".nnn....nnn.", "...nn..nn..."]),
  wave(4, "POWDER KEG", 37, ["....eeee....", "..nnnnnnnn..", "...nn..nn..."]),
  wave(5, "STONE CHANNEL", 39, ["xx........xx", "x..hhhhhh..x", "x...nnnn...x"]),
  wave(6, "FIELD MEDIC", 39, [".....cc.....", "..nnhhhhhn..", ".nnnn..nnnn."]),
  wave(7, "TWIN GATES", 40, ["xxh......hxx", "xgnn....nngx", "xenn....nnex"]),
  wave(8, "REFLECTOR POCKETS", 42, [".rr..cc..rr.", ".hh..nn..hh.", "..nneeeenn..", "...n....n..."]),
  wave(9, "FORTRESS", 44, ["x.gggggggg.x", "xghhhhhhhhgx", "xg.eecc.ee.g", "xxnn....nnxx"]),
  wave(10, "MID BOSS · IRON HEART", 48, [], "mid"),
  wave(11, "AFTERSHOCK", 40, ["e.n.e.n.e.n.", ".hhhhhhhhhh.", "..r.n..n.r..", "...nnccnn..."]),
  wave(12, "DOUBLE HELIX", 42, ["xn........nx", ".gn......ng.", "..en....ne..", "...rn..nr...", "....nccn...."]),
  wave(13, "RECOVERY GRID", 43, ["c.g.c.g.c.g.", ".h.h.h.h.h.h", "eeeeeeeeeeee", "..rr....rr.."]),
  wave(14, "HOLLOW CORE", 44, ["xhhhhhhhhhhx", "xh........hx", "xh..gccg..hx", "xh........hx", "xhhhheehhhhx"]),
  wave(15, "ELITE · TRIDENT", 46, ["..gg..gg..gg", ".hhh.cc..hh.", "nneennnneenn", "..rr..rr..rr"]),
  wave(16, "DIAMOND LOCK", 46, [".....xx.....", "...xhhhcx...", "..xhegggehx.", "...xhhhcx...", ".....rr....."]),
  wave(17, "PRESSURE GRID", 47, ["gegegegegege", "hrhrhrhrhrhr", "gcgcgcgcgcgc", "..xx....xx.."]),
  wave(18, "LAST CORRIDOR", 48, ["xhhennnneehx", "x..........x", "x.rrccccrr.x", "x.gggggggg.x", "xhhennnneehx"]),
  wave(19, "FINAL GUARD", 50, ["gggggggggggg", "rrrrrrrrrrrr", "hhcchhcchhcc", ".gegegegege.", "xxnnnnnnnnxx"]),
  wave(20, "FINAL BOSS · ECHO CORE", 55, [], "final"),
];

export const MAX_WAVE = WAVE_DEFINITIONS.length;

export function waveDefinition(waveNumber: number) {
  return WAVE_DEFINITIONS[Math.max(0, Math.min(MAX_WAVE - 1, waveNumber - 1))];
}
