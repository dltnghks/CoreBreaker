export type WaveDefinition = {
  wave: number;
  name: string;
  boss: "early" | "mid" | "late" | "final" | null;
  pattern: string[];
  blocks?: WaveBlock[];
  hpMultiplier: number;
};

export type WaveBlockType = "n" | "h" | "g" | "e" | "x" | "c" | "r";
export type WaveBlock = { type: WaveBlockType; x: number; y: number; width: number; height: number };

export const WAVE_STORAGE_KEY = "core-breaker-wave-definitions-v1";
export const WAVE_COLUMNS = 24;
export const WAVE_LEGACY_COLUMNS = 12;
export const MAX_WAVE_ROWS = 8;
export const WAVE_GRID_ROWS = MAX_WAVE_ROWS;
export const WAVE_CELL_SIZE = 30;
export const WAVE_CELL_TYPES = [".", "n", "h", "g", "e", "x", "c", "r"] as const;

const wave = (wave: number, name: string, pattern: string[], boss: WaveDefinition["boss"] = null): WaveDefinition => ({ wave, name, pattern, boss, hpMultiplier: 1 });

// n: normal, h: high HP, g: one-hit guard, e: explosive,
// x: indestructible, c: healer, r: underside reflector, .: gap
// Explosives use one dispersed row per wave with at least two cells between them.
const BASE_WAVE_DEFINITIONS: WaveDefinition[] = [
  wave(1, "OPENING", ["..nnnnnnnn..", "...nn..nn..."]),
  wave(2, "GUARD LESSON", ["...gg..gg...", "..nnnnnnnn..", "....nnnn...."]),
  wave(3, "BOUNCE GATE", ["..nnnnnnnn..", ".nnn....nnn.", "..rr....rr.."]),
  wave(4, "POWDER KEG", ["..e..e..e...", "..nnnnnnnn..", "...nn..nn..."]),
  wave(5, "BOSS · STONE WARDEN", ["xx........xx", "x..hhhhhh..x", "x...nnnn...x"]),
  wave(6, "FIELD MEDIC", ["....cccc....", "..hhhhhhhh..", "nnnnnnnnnnnn", ".gennnnnneg.", "rrnnhhhhnnrr"]),
  wave(7, "TWIN GATES", ["xxhhhhhhhhxx", "xgnnnnnnnngx", "xennccccnnex", "rr..nnnn..rr", "hnhnhnhnhnhn"]),
  wave(8, "REFLECTOR POCKETS", ["rrccnnnnccrr", "hhhhhhhhhhhh", "nnennennenne", "ggnnccccnngg", "rrnnnnnnnnrr"]),
  wave(9, "FORTRESS", ["xggggggggggx", "xhhhhhhhhhhx", "xgccccccccgx", "xgenhnehnegx", "xxrrnnnnrrxx"]),
  wave(10, "MID BOSS · IRON HEART", [], "mid"),
  wave(11, "AFTERSHOCK", ["enhenhenhenh", "hhhhhhhhhhhh", "rrnnccnnccrr", "ggggnnnngggg", "nnnnhhhhnnnn", "..xx....xx.."]),
  wave(12, "DOUBLE HELIX", ["xxnnnnnnnnxx", "xgghhhhhgggx", "nnennennenne", "rrnnccccnnrr", "ggnnhhhhnngg", "nnnnnnnnnnnn"]),
  wave(13, "RECOVERY GRID", ["cccccccccccc", "ghghghghghgh", "enhenhenhenh", "rrhhrrhhrrhh", "ggnnggnnggnn", "hhhhhhhhhhhh"]),
  wave(14, "HOLLOW CORE", ["xhhhhhhhhhhx", "xhgggggggghx", "xhccnnnncchx", "xhenhenhenhx", "xhrrrrrrrrhx", "xhhhhhhhhhhx"]),
  wave(15, "BOSS · TRIDENT WARDEN", ["gggggggggggg", "hhhhcchhhhcc", "nnenhenhenne", "rrrrrrrrrrrr", "hnhnhnhnhnhn", "xxnnnnnnnnxx"]),
  wave(16, "DIAMOND LOCK", ["xxxxx..xxxxx", "xhhhhhhhhhhx", "xgccggggccgx", "xgenhenhengx", "xgrrrrrrrrgx", "xhhhhhhhhhhx", "xxnnnnnnnnxx"]),
  wave(17, "PRESSURE GRID", ["genhenhenhen", "hrhrhrhrhrhr", "gcgcgcgcgcgc", "hnhnhnhnhnhn", "gggggggggggg", "hhhhhhhhhhhh", "xxrrnnnnrrxx"]),
  wave(18, "LAST CORRIDOR", ["xhhennnnenhx", "xggggggggggx", "xrrccccccccx", "xnhnhnhnhnhx", "xhhhhhhhhhhx", "xggggggggggx", "xxrrnnnnrrxx"]),
  wave(19, "FINAL GUARD", ["gggggggggggg", "rrrrrrrrrrrr", "hhhhhhhhhhhh", "cccccccccccc", "enhenhenhenh", "ghghghghghgh", "xxnnnnnnnnxx"]),
  wave(20, "FINAL BOSS · ECHO CORE", [], "final"),
];

function expandLegacyPattern(pattern: string[]) {
  return pattern.map((row) => [...row].flatMap((cell) => [cell, cell]).join(""));
}

export const WAVE_DEFINITIONS: WaveDefinition[] = BASE_WAVE_DEFINITIONS.map((definition) => ({
  ...definition,
  pattern: expandLegacyPattern(definition.pattern),
}));

export const MAX_WAVE = WAVE_DEFINITIONS.length;

const BOSS_WAVE_ROLES: Record<number, Exclude<WaveDefinition["boss"], null>> = { 5: "early", 10: "mid", 15: "late", 20: "final" };
const withBossRole = (definition: WaveDefinition): WaveDefinition => ({ ...definition, boss: BOSS_WAVE_ROLES[definition.wave] ?? definition.boss });
export function blocksFromPattern(pattern: string[]): WaveBlock[] {
  const blocks: WaveBlock[] = [];
  const expandedPattern = pattern.map((row) => row.length === WAVE_LEGACY_COLUMNS ? expandLegacyPattern([row])[0] : row);
  for (let rowIndex = 0; rowIndex < expandedPattern.length; rowIndex += 1) {
    const row = expandedPattern[rowIndex];
    for (let col = 0; col < row.length; col += 2) {
      const rawType = row[col];
      const rawContinuation = row[col + 1];
      const type = (rawType === "s" ? "n" : rawType) as WaveBlockType | ".";
      const continuation = (rawContinuation === "s" ? "n" : rawContinuation) as WaveBlockType | "." | undefined;
      if (type === "." && continuation === ".") continue;
      if (type === "." || continuation !== type) throw new Error(`Wave ${rowIndex + 1}의 ${col + 1}열 블록 footprint가 올바르지 않습니다.`);
      blocks.push({ type, x: col, y: rowIndex, width: 2, height: 1 });
    }
  }
  return blocks;
}

function patternFromBlocks(blocks: WaveBlock[]) {
  const rows = Array.from({ length: MAX_WAVE_ROWS }, () => Array.from({ length: WAVE_COLUMNS }, () => "."));
  const occupied = new Set<string>();
  for (const block of blocks) {
    if (!WAVE_CELL_TYPES.includes(block.type) || !Number.isInteger(block.x) || !Number.isInteger(block.y) || !Number.isInteger(block.width) || !Number.isInteger(block.height) || block.width < 1 || block.height < 1 || block.x < 0 || block.y < 0 || block.x + block.width > WAVE_COLUMNS || block.y + block.height > MAX_WAVE_ROWS) throw new Error("웨이브 블록 footprint가 그리드 범위를 벗어났습니다.");
    for (let y = block.y; y < block.y + block.height; y += 1) {
      for (let x = block.x; x < block.x + block.width; x += 1) {
        const key = `${x}:${y}`;
        if (occupied.has(key)) throw new Error("웨이브 블록 footprint가 서로 겹칩니다.");
        occupied.add(key);
        rows[y][x] = block.type;
      }
    }
  }
  return rows.map((row) => row.join(""));
}

const cloneDefinitions = (definitions: WaveDefinition[]) => definitions.map((definition) => ({ ...withBossRole(definition), pattern: [...definition.pattern], blocks: (definition.blocks ?? blocksFromPattern(definition.pattern)).map((block) => ({ ...block })) }));
let activeWaveDefinitions: WaveDefinition[] = cloneDefinitions(WAVE_DEFINITIONS);

export function normalizeWaveDefinitions(value: unknown): WaveDefinition[] {
  const source = Array.isArray(value) ? value : value && typeof value === "object" && Array.isArray((value as { waves?: unknown }).waves) ? (value as { waves: unknown[] }).waves : null;
  if (!source || source.length !== MAX_WAVE) throw new Error(`웨이브 정의는 정확히 ${MAX_WAVE}개여야 합니다.`);
  return WAVE_DEFINITIONS.map((_fallback, index) => {
    const fallback = withBossRole(WAVE_DEFINITIONS[index]);
    const candidate = source[index] as Partial<WaveDefinition> | undefined;
    if (!candidate || candidate.wave !== index + 1) throw new Error(`Wave ${index + 1} 번호가 올바르지 않습니다.`);
    const name = typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim().slice(0, 40) : fallback.name;
    const hpMultiplier = Number(candidate.hpMultiplier ?? 1);
    if (!Number.isFinite(hpMultiplier) || hpMultiplier < 0.25 || hpMultiplier > 5) throw new Error(`Wave ${index + 1} HP 배율은 0.25~5 사이여야 합니다.`);
    if (fallback.boss) return { ...fallback, name, blocks: fallback.blocks ?? blocksFromPattern(fallback.pattern), hpMultiplier };
    if (Array.isArray(candidate.blocks) && !Array.isArray(candidate.pattern)) {
      const blocks = candidate.blocks.map((value) => ({ ...value })) as WaveBlock[];
      const pattern = patternFromBlocks(blocks);
      if (!blocks.some((block) => block.type !== "x")) throw new Error(`Wave ${index + 1}에는 파괴 가능한 블록이 필요합니다.`);
      return { wave: index + 1, name, boss: null, pattern, blocks, hpMultiplier };
    }
    if (!Array.isArray(candidate.pattern) || candidate.pattern.length < 1 || candidate.pattern.length > MAX_WAVE_ROWS) throw new Error(`Wave ${index + 1} 행 수는 1~${MAX_WAVE_ROWS}여야 합니다.`);
    const sourcePattern = candidate.pattern.map((row) => typeof row === "string" && row.length === WAVE_LEGACY_COLUMNS ? expandLegacyPattern([row])[0] : row);
    const pattern = sourcePattern.map((rawRow, rowIndex) => {
      const row = rawRow;
      if (typeof row !== "string" || row.length !== WAVE_COLUMNS) throw new Error(`Wave ${index + 1}의 ${rowIndex + 1}행은 ${WAVE_COLUMNS}칸이어야 합니다.`);
      if ([...row].some((cell) => !WAVE_CELL_TYPES.includes(cell as typeof WAVE_CELL_TYPES[number]))) throw new Error(`Wave ${index + 1}의 ${rowIndex + 1}행에 지원하지 않는 블록이 있습니다.`);
      return row;
    });
    if (!pattern.some((row) => [...row].some((cell) => cell !== "." && cell !== "x"))) throw new Error(`Wave ${index + 1}에는 파괴 가능한 블록이 필요합니다.`);
    return { wave: index + 1, name, boss: null, pattern, blocks: blocksFromPattern(pattern), hpMultiplier };
  });
}

export function applyWaveDefinitions(value: unknown) {
  activeWaveDefinitions = normalizeWaveDefinitions(value);
  return cloneDefinitions(activeWaveDefinitions);
}

export function resetWaveDefinitions() {
  activeWaveDefinitions = cloneDefinitions(WAVE_DEFINITIONS);
  return cloneDefinitions(activeWaveDefinitions);
}

export function getActiveWaveDefinitions() {
  return cloneDefinitions(activeWaveDefinitions);
}

export function waveDefinitionFrom(definitions: WaveDefinition[], waveNumber: number) {
  return withBossRole(definitions[Math.max(0, Math.min(MAX_WAVE - 1, waveNumber - 1))] ?? WAVE_DEFINITIONS[0]);
}

export function waveDefinition(waveNumber: number) {
  return waveDefinitionFrom(activeWaveDefinitions, waveNumber);
}
