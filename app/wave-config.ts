export type WaveDefinition = {
  wave: number;
  name: string;
  timeLimit: number;
  boss: "mid" | "final" | null;
  pattern: string[];
};

export const WAVE_TIME_LIMIT = 60;

const wave = (wave: number, name: string, _timeLimit: number, pattern: string[], boss: WaveDefinition["boss"] = null): WaveDefinition => ({ wave, name, timeLimit: WAVE_TIME_LIMIT, pattern, boss });

// n: normal, h: high HP, g: one-hit guard, s: shield, .: gap
export const WAVE_DEFINITIONS: WaveDefinition[] = [
  wave(1, "OPENING", 34, ["..nnnnnnnn..", "...nn..nn..."]),
  wave(2, "TWIN GATES", 34, ["nnn......nnn", ".nn......nn.", "..nn....nn.."]),
  wave(3, "CHECKER", 36, ["n.n.n.n.n.n.", ".n.n.n.n.n.n", "n.n.n.n.n.n."]),
  wave(4, "ARROWHEAD", 37, [".....nn.....", "....nhhn....", "...nn..nn...", "..nn....nn.."]),
  wave(5, "GUARD WALL", 39, ["..gggggggg..", ".nnhhhhhhnn.", "...nnnnnn..."]),
  wave(6, "CROSS FIRE", 39, [".....hh.....", "..n..hh..n..", "nnnhhhhhhnnn", "..n..hh..n.."]),
  wave(7, "SIDE TOWERS", 40, ["hh........hh", "hnn......nnh", "hnn......nnh", "hh........hh"]),
  wave(8, "SHIELD POCKETS", 42, [".ss..nn..ss.", ".hh..nn..hh.", "..nnnnnnnn..", "...n....n..."]),
  wave(9, "FORTRESS", 44, ["..gggggggg..", ".ghhhhhhhhg.", ".ghsssssshg.", "..nn....nn.."]),
  wave(10, "MID BOSS · IRON HEART", 48, [], "mid"),
  wave(11, "AFTERSHOCK", 40, ["n.n.n.n.n.n.", ".hhhhhhhhhh.", "..n.n..n.n..", "...nn..nn..."]),
  wave(12, "DOUBLE HELIX", 42, ["nn........nn", ".nn......nn.", "..nn....nn..", "...nn..nn...", "....nnnn...."]),
  wave(13, "ARMORED RAIN", 43, ["s.s.s.s.s.s.", ".g.g.g.g.g.g", "hhhhhhhhhhhh", "..nn....nn.."]),
  wave(14, "HOLLOW CORE", 44, [".hhhhhhhhhh.", ".h........h.", ".h..gggg..h.", ".h........h.", ".hhhhhhhhhh."]),
  wave(15, "ELITE · TRIDENT", 46, ["..gg..gg..gg", ".hhh.hh..hh.", "nnnnnnnnnnnn", "..ss..ss..ss"]),
  wave(16, "DIAMOND LOCK", 46, [".....ss.....", "...shhhhs...", "..shgggghs..", "...shhhhs...", ".....ss....."]),
  wave(17, "PRESSURE GRID", 47, ["ghghghghghgh", "hshshshshshs", "ghghghghghgh", "..nn....nn.."]),
  wave(18, "LAST CORRIDOR", 48, ["hhhnnnnnnhhh", "h..........h", "h.ssssssss.h", "h.gggggggg.h", "hhhnnnnnnhhh"]),
  wave(19, "FINAL GUARD", 50, ["gggggggggggg", "ssssssssssss", "hhhhhhhhhhhh", ".ghghghghgh.", "..nnnnnnnn.."]),
  wave(20, "FINAL BOSS · ECHO CORE", 55, [], "final"),
];

export const MAX_WAVE = WAVE_DEFINITIONS.length;

export function waveDefinition(waveNumber: number) {
  return WAVE_DEFINITIONS[Math.max(0, Math.min(MAX_WAVE - 1, waveNumber - 1))];
}
