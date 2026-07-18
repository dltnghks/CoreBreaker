export type WaveDefinition = {
  wave: number;
  name: string;
  boss: "mid" | "final" | null;
  pattern: string[];
};

const wave = (wave: number, name: string, pattern: string[], boss: WaveDefinition["boss"] = null): WaveDefinition => ({ wave, name, pattern, boss });

// n: normal, h: high HP, g: one-hit guard, e: explosive,
// x: indestructible, c: healer, r: underside reflector, .: gap
// Explosives use one dispersed row per wave with at least two cells between them.
export const WAVE_DEFINITIONS: WaveDefinition[] = [
  wave(1, "OPENING", ["..nnnnnnnn..", "...nn..nn..."]),
  wave(2, "GUARD LESSON", ["...gg..gg...", "..nnnnnnnn..", "....nnnn...."]),
  wave(3, "BOUNCE GATE", ["..rr....rr..", ".nnn....nnn.", "...nn..nn..."]),
  wave(4, "POWDER KEG", ["..e..e..e...", "..nnnnnnnn..", "...nn..nn..."]),
  wave(5, "STONE CHANNEL", ["xx........xx", "x..hhhhhh..x", "x...nnnn...x"]),
  wave(6, "FIELD MEDIC", ["....cccc....", "..hhhhhhhh..", "nnnnnnnnnnnn", ".gennnnnneg.", "rrnnhhhhnnrr"]),
  wave(7, "TWIN GATES", ["xxhhhhhhhhxx", "xgnnnnnnnngx", "xennccccnnex", "rr..nnnn..rr", "hnhnhnhnhnhn"]),
  wave(8, "REFLECTOR POCKETS", ["rrccnnnnccrr", "hhhhhhhhhhhh", "nnennennenne", "ggnnccccnngg", "rrnnnnnnnnrr"]),
  wave(9, "FORTRESS", ["xggggggggggx", "xhhhhhhhhhhx", "xgccccccccgx", "xgenhnehnegx", "xxrrnnnnrrxx"]),
  wave(10, "MID BOSS · IRON HEART", [], "mid"),
  wave(11, "AFTERSHOCK", ["enhenhenhenh", "hhhhhhhhhhhh", "rrnnccnnccrr", "ggggnnnngggg", "nnnnhhhhnnnn", "..xx....xx.."]),
  wave(12, "DOUBLE HELIX", ["xxnnnnnnnnxx", "xgghhhhhgggx", "nnennennenne", "rrnnccccnnrr", "ggnnhhhhnngg", "nnnnnnnnnnnn"]),
  wave(13, "RECOVERY GRID", ["cccccccccccc", "ghghghghghgh", "enhenhenhenh", "rrhhrrhhrrhh", "ggnnggnnggnn", "hhhhhhhhhhhh"]),
  wave(14, "HOLLOW CORE", ["xhhhhhhhhhhx", "xhgggggggghx", "xhccnnnncchx", "xhenhenhenhx", "xhrrrrrrrrhx", "xhhhhhhhhhhx"]),
  wave(15, "ELITE · TRIDENT", ["gggggggggggg", "hhhhcchhhhcc", "nnenhenhenne", "rrrrrrrrrrrr", "hnhnhnhnhnhn", "xxnnnnnnnnxx"]),
  wave(16, "DIAMOND LOCK", ["xxxxx..xxxxx", "xhhhhhhhhhhx", "xgccggggccgx", "xgenhenhengx", "xgrrrrrrrrgx", "xhhhhhhhhhhx", "xxnnnnnnnnxx"]),
  wave(17, "PRESSURE GRID", ["genhenhenhen", "hrhrhrhrhrhr", "gcgcgcgcgcgc", "hnhnhnhnhnhn", "gggggggggggg", "hhhhhhhhhhhh", "xxrrnnnnrrxx"]),
  wave(18, "LAST CORRIDOR", ["xhhennnnenhx", "xggggggggggx", "xrrccccccccx", "xnhnhnhnhnhx", "xhhhhhhhhhhx", "xggggggggggx", "xxrrnnnnrrxx"]),
  wave(19, "FINAL GUARD", ["gggggggggggg", "rrrrrrrrrrrr", "hhhhhhhhhhhh", "cccccccccccc", "enhenhenhenh", "ghghghghghgh", "xxnnnnnnnnxx"]),
  wave(20, "FINAL BOSS · ECHO CORE", [], "final"),
];

export const MAX_WAVE = WAVE_DEFINITIONS.length;

export function waveDefinition(waveNumber: number) {
  return WAVE_DEFINITIONS[Math.max(0, Math.min(MAX_WAVE - 1, waveNumber - 1))];
}
