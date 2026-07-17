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
// Explosives use one dispersed row per wave with at least two cells between them.
export const WAVE_DEFINITIONS: WaveDefinition[] = [
  wave(1, "OPENING", 34, ["..nnnnnnnn..", "...nn..nn..."]),
  wave(2, "GUARD LESSON", 34, ["...gg..gg...", "..nnnnnnnn..", "....nnnn...."]),
  wave(3, "BOUNCE GATE", 36, ["..rr....rr..", ".nnn....nnn.", "...nn..nn..."]),
  wave(4, "POWDER KEG", 37, ["..e..e..e...", "..nnnnnnnn..", "...nn..nn..."]),
  wave(5, "STONE CHANNEL", 39, ["xx........xx", "x..hhhhhh..x", "x...nnnn...x"]),
  wave(6, "FIELD MEDIC", 39, ["....cccc....", "..hhhhhhhh..", "nnnnnnnnnnnn", ".gennnnnneg.", "rrnnhhhhnnrr"]),
  wave(7, "TWIN GATES", 40, ["xxhhhhhhhhxx", "xgnnnnnnnngx", "xennccccnnex", "rr..nnnn..rr", "hnhnhnhnhnhn"]),
  wave(8, "REFLECTOR POCKETS", 42, ["rrccnnnnccrr", "hhhhhhhhhhhh", "nnennennenne", "ggnnccccnngg", "rrnnnnnnnnrr"]),
  wave(9, "FORTRESS", 44, ["xggggggggggx", "xhhhhhhhhhhx", "xgccccccccgx", "xgenhnehnegx", "xxrrnnnnrrxx"]),
  wave(10, "MID BOSS · IRON HEART", 48, [], "mid"),
  wave(11, "AFTERSHOCK", 40, ["enhenhenhenh", "hhhhhhhhhhhh", "rrnnccnnccrr", "ggggnnnngggg", "nnnnhhhhnnnn", "..xx....xx.."]),
  wave(12, "DOUBLE HELIX", 42, ["xxnnnnnnnnxx", "xgghhhhhgggx", "nnennennenne", "rrnnccccnnrr", "ggnnhhhhnngg", "nnnnnnnnnnnn"]),
  wave(13, "RECOVERY GRID", 43, ["cccccccccccc", "ghghghghghgh", "enhenhenhenh", "rrhhrrhhrrhh", "ggnnggnnggnn", "hhhhhhhhhhhh"]),
  wave(14, "HOLLOW CORE", 44, ["xhhhhhhhhhhx", "xhgggggggghx", "xhccnnnncchx", "xhenhenhenhx", "xhrrrrrrrrhx", "xhhhhhhhhhhx"]),
  wave(15, "ELITE · TRIDENT", 46, ["gggggggggggg", "hhhhcchhhhcc", "nnenhenhenne", "rrrrrrrrrrrr", "hnhnhnhnhnhn", "xxnnnnnnnnxx"]),
  wave(16, "DIAMOND LOCK", 46, ["xxxxx..xxxxx", "xhhhhhhhhhhx", "xgccggggccgx", "xgenhenhengx", "xgrrrrrrrrgx", "xhhhhhhhhhhx", "xxnnnnnnnnxx"]),
  wave(17, "PRESSURE GRID", 47, ["genhenhenhen", "hrhrhrhrhrhr", "gcgcgcgcgcgc", "hnhnhnhnhnhn", "gggggggggggg", "hhhhhhhhhhhh", "xxrrnnnnrrxx"]),
  wave(18, "LAST CORRIDOR", 48, ["xhhennnnenhx", "xggggggggggx", "xrrccccccccx", "xnhnhnhnhnhx", "xhhhhhhhhhhx", "xggggggggggx", "xxrrnnnnrrxx"]),
  wave(19, "FINAL GUARD", 50, ["gggggggggggg", "rrrrrrrrrrrr", "hhhhhhhhhhhh", "cccccccccccc", "enhenhenhenh", "ghghghghghgh", "xxnnnnnnnnxx"]),
  wave(20, "FINAL BOSS · ECHO CORE", 55, [], "final"),
];

export const MAX_WAVE = WAVE_DEFINITIONS.length;

export function waveDefinition(waveNumber: number) {
  return WAVE_DEFINITIONS[Math.max(0, Math.min(MAX_WAVE - 1, waveNumber - 1))];
}
