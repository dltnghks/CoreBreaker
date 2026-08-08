export type HeroClass = "warrior" | "archer" | "mage" | "common";
export type SkillCategory = HeroClass;
export type SkillMechanic = "impact" | "chain" | "control" | "summon" | "defense" | "passive";
export type EnchantMode = "persistent" | "charge" | "single";
export type SkillDamageType = "physical" | "magic";
export type SkillValueUnit = "damage" | "percent" | "pixels" | "seconds" | "count" | "health" | "multiplier";
export type SkillApplicationScope = "per-ball" | "shared";
export type SkillTriggerType = "brick-hit" | "brick-break" | "repeat-hit" | "special-brick-hit" | "passive";
export type SkillTrait = "direct-damage" | "smash" | "execute" | "crush" | "focus" | "weakpoint" | "mana-seal" | "splash" | "chain" | "burn" | "freeze" | "pierce" | "rapid-fire" | "barrier" | "black-hole" | "passive";
export type SkillTraitConfig = {
  kind: SkillTrait;
  values: [number, number, number];
  unit: SkillValueUnit;
  damageType: SkillDamageType;
  damage: [number, number, number];
};
export type SkillEvolutionTraitConfig = SkillTraitConfig;
export type SkillEffectTrigger = "on-cast" | "on-hit" | "on-break" | "on-direct-hit" | "while-active" | "on-tick" | "on-expire";
export type SkillEffectTarget = "hit" | "area" | "nearest" | "same-trait" | "all-enemies" | "self" | "paddle" | "core";
export type SkillEffectKind = SkillTrait | "damage" | "create-field" | "periodic-damage" | "apply-status" | "modify-damage" | "spawn";
export type SkillEffectConfig = {
  id: string;
  kind: SkillEffectKind;
  trait?: SkillTrait;
  trigger: SkillEffectTrigger;
  target: SkillEffectTarget;
  order: number;
  values: [number, number, number];
  unit: SkillValueUnit;
  damageType: SkillDamageType;
  damage: [number, number, number];
  damageSource: "configured" | "skill";
  status?: "burn" | "freeze" | "mana-seal" | "disable-healing";
  spawnKind?: "rapid-arrow" | "ball";
  scopeId?: string;
  interval: [number, number, number];
  duration: [number, number, number];
  radius: [number, number, number];
  enabled: boolean;
};

export const SKILL_TRIGGER_LABELS: Record<SkillTriggerType, string> = {
  "brick-hit": "블록 직접 타격",
  "brick-break": "블록 파괴",
  "repeat-hit": "같은 블록 연속 타격",
  "special-brick-hit": "특수 블록 타격",
  passive: "보유 중 상시 적용",
};

export const SKILL_APPLICATION_LABELS: Record<SkillApplicationScope, string> = {
  "per-ball": "스킬 보유 공 · 공별 독립 쿨타임",
  shared: "전체 공 · 스킬별 공유 쿨타임",
};

export const SKILL_TRAIT_LABELS: Record<SkillTrait, string> = {
  "direct-damage": "추가 피해",
  smash: "강타",
  execute: "처형",
  crush: "분쇄",
  focus: "집중 사격",
  weakpoint: "약점 사격",
  "mana-seal": "마력 봉인",
  splash: "범위 피해",
  chain: "연쇄 피해",
  burn: "화상",
  freeze: "빙결",
  pierce: "관통",
  "rapid-fire": "추가 투사체",
  barrier: "코어 방어막",
  "black-hole": "블랙홀",
  passive: "지속 효과",
};

export const SKILL_VALUE_UNIT_LABELS: Record<SkillValueUnit, string> = {
  damage: "피해량",
  percent: "퍼센트 (%)",
  pixels: "픽셀 (px)",
  seconds: "초 (s)",
  count: "대상 수 (개)",
  health: "체력 (HP)",
  multiplier: "배율 (×)",
};

export const SKILL_VALUE_UNIT_SUFFIX: Record<SkillValueUnit, string> = {
  damage: "피해",
  percent: "%",
  pixels: "px",
  seconds: "초",
  count: "개",
  health: "HP",
  multiplier: "배",
};

/** Global execution priority. Skill Lab edits which traits exist; the engine
 * owns their order so the same trait always behaves consistently. */
export const SKILL_TRAIT_PRIORITY: Record<SkillTrait, number> = {
  passive: 0,
  execute: 10,
  weakpoint: 20,
  "direct-damage": 30,
  smash: 30,
  crush: 30,
  focus: 35,
  splash: 40,
  chain: 50,
  pierce: 60,
  burn: 70,
  freeze: 70,
  "mana-seal": 70,
  "rapid-fire": 80,
  barrier: 80,
  "black-hole": 90,
};

export const SKILL_EFFECT_KIND_LABELS: Record<SkillEffectKind, string> = {
  damage: "湲곗〈 ?쇳빐",
  "direct-damage": "직접 피해 효과",
  smash: "강타 피해 효과",
  execute: "처형 효과",
  crush: "분쇄 피해 효과",
  focus: "집중 피해 효과",
  weakpoint: "약점 피해 배율 효과",
  "mana-seal": "마나 봉인 효과",
  splash: "범위 피해 효과",
  chain: "연쇄 피해 효과",
  burn: "화상 지속 효과",
  freeze: "빙결 상태 효과",
  pierce: "관통 투사체 효과",
  "rapid-fire": "추가 투사체 생성 효과",
  barrier: "배리어 부여 효과",
  "black-hole": "블랙홀 필드 효과",
  passive: "패시브 스탯 효과",
  "create-field": "Field 생성",
  "periodic-damage": "주기 피해",
  "apply-status": "상태 적용",
  "modify-damage": "피해 보정",
  spawn: "객체 생성",
};
export const SKILL_EFFECT_TRIGGER_LABELS: Record<SkillEffectTrigger, string> = {
  "on-cast": "발동 시",
  "on-hit": "타격 시",
  "on-break": "파괴 시",
  "on-direct-hit": "직접 타격 시",
  "while-active": "유지 중",
  "on-tick": "틱마다",
  "on-expire": "종료 시",
};
export const SKILL_EFFECT_TARGET_LABELS: Record<SkillEffectTarget, string> = {
  hit: "타격 대상",
  area: "범위 대상",
  nearest: "가까운 대상",
  "same-trait": "같은 특성 대상",
  "all-enemies": "모든 적",
  self: "시전자",
  paddle: "패들",
  core: "CORE",
};

const emptyEffect = (id: string, kind: SkillEffectKind = "modify-damage"): SkillEffectConfig => ({
  id, kind, trigger: "on-hit", target: "hit", order: 40,
  values: [1, 2, 3], unit: "count", damageType: "magic", damage: [0, 0, 0], damageSource: "configured",
  interval: [1, 1, 1], duration: [0, 0, 0], radius: [0, 0, 0], enabled: true,
});

const LEGACY_SKILL_VALUE_UNITS: Record<string, SkillValueUnit> = {
  DMG: "damage", "%": "percent", px: "pixels", "초": "seconds", "개": "count", "회": "count", HP: "health", "배": "multiplier",
};

export function normalizeSkillValueUnit(value: unknown, fallback: SkillValueUnit = "damage"): SkillValueUnit {
  if (value === "damage" || value === "percent" || value === "pixels" || value === "seconds" || value === "count" || value === "health" || value === "multiplier") return value;
  return typeof value === "string" ? LEGACY_SKILL_VALUE_UNITS[value] ?? fallback : fallback;
}

export const SKILL_MECHANIC_LABELS: Record<SkillMechanic, string> = {
  impact: "타격",
  chain: "연쇄",
  control: "제어",
  summon: "소환",
  defense: "방어",
  passive: "지속",
};

export type BuiltinClassSkillId =
  | "warrior-smash" | "warrior-shockwave" | "warrior-execute" | "warrior-crush" | "warrior-guard"
  | "archer-rapid" | "archer-pierce" | "archer-ricochet" | "archer-focus" | "archer-weakpoint"
  | "mage-fireball" | "mage-lightning" | "mage-freeze" | "mage-black-hole" | "mage-mana-blast"
  | "common-magnet" | "common-luck" | "common-wide" | "common-move-speed" | "common-xp"
  | "common-skill-range" | "common-chain" | "common-damage" | "common-magic" | "common-cooldown"
  | "common-skill-duration";

export type CustomSkillId = `custom-${string}`;
export type ClassSkillId = BuiltinClassSkillId | CustomSkillId;

export type SkillVfxAnchor = "brick" | "trajectory" | "field" | "paddle";
export type SkillVfxRotation = "none" | "direction" | "spin";
export type SkillVfxConfig = {
  scale: number;
  opacity: number;
  duration: number;
  anchor: SkillVfxAnchor;
  rotation: SkillVfxRotation;
};

/** Presentation tuning shared by the canonical event producer and canvas renderer. */
export const SKILL_VFX_CONFIG: Partial<Record<ClassSkillId, SkillVfxConfig>> = {
  "warrior-smash": { scale: 0.92, opacity: 0.78, duration: 0.42, anchor: "brick", rotation: "none" },
  "warrior-shockwave": { scale: 1.1, opacity: 0.72, duration: 0.62, anchor: "brick", rotation: "none" },
  "warrior-execute": { scale: 0.95, opacity: 0.8, duration: 0.45, anchor: "brick", rotation: "none" },
  "warrior-crush": { scale: 1, opacity: 0.76, duration: 0.48, anchor: "brick", rotation: "none" },
  "warrior-guard": { scale: 0.9, opacity: 0.68, duration: 0.75, anchor: "paddle", rotation: "none" },
  "archer-rapid": { scale: 1.02, opacity: 0.92, duration: 0.5, anchor: "trajectory", rotation: "direction" },
  "archer-pierce": { scale: 1.38, opacity: 1, duration: 0.42, anchor: "trajectory", rotation: "direction" },
  "archer-ricochet": { scale: 1.18, opacity: 0.98, duration: 0.52, anchor: "trajectory", rotation: "direction" },
  "archer-focus": { scale: 1.1, opacity: 0.96, duration: 0.45, anchor: "brick", rotation: "none" },
  "archer-weakpoint": { scale: 1.14, opacity: 1, duration: 0.45, anchor: "brick", rotation: "none" },
  "mage-fireball": { scale: 1, opacity: 0.78, duration: 0.72, anchor: "brick", rotation: "none" },
  "mage-lightning": { scale: 1.05, opacity: 0.7, duration: 0.48, anchor: "trajectory", rotation: "none" },
  "mage-freeze": { scale: 1, opacity: 0.68, duration: 0.55, anchor: "brick", rotation: "none" },
  "mage-black-hole": { scale: 1, opacity: 0.6, duration: 4, anchor: "field", rotation: "spin" },
  "mage-mana-blast": { scale: 1, opacity: 0.74, duration: 0.5, anchor: "brick", rotation: "none" },
};

export type LegacyUpgradeId =
  | "pierce" | "blast" | "glass" | "link" | "speed" | "wide" | "magnet" | "luck" | "xp" | "chain" | "skill-range" | "damage" | "magic" | "cooldown" | "fever"
  | "echo-split" | "double-drop" | "missile-mode" | "safety-block" | "gravity-well"
  | "horizontal-sweep" | "vertical-drill" | "emergency-wide" | "barrier-skill" | "last-shot"
  | "poison" | "blast-amp" | "corrosion" | "pressure";

export type UpgradeId = ClassSkillId | LegacyUpgradeId;

/** Compatibility aliases for the pre-class-skill common upgrades. */
export const LEGACY_CLASS_SKILL_ALIASES: Partial<Record<LegacyUpgradeId, BuiltinClassSkillId>> = {
  magnet: "common-magnet",
  luck: "common-luck",
  wide: "common-wide",
  speed: "common-move-speed",
  xp: "common-xp",
  chain: "common-chain",
  "skill-range": "common-skill-range",
  damage: "common-damage",
  magic: "common-magic",
  cooldown: "common-cooldown",
};

export function canonicalUpgradeId(id: UpgradeId): UpgradeId {
  return LEGACY_CLASS_SKILL_ALIASES[id as LegacyUpgradeId] ?? id;
}

export const ENCHANT_MODE_LABELS: Record<EnchantMode, string> = {
  persistent: "지속형",
  charge: "충전형",
  single: "단발형",
};

export type SkillConfig = {
  configVersion?: number;
  id: ClassSkillId;
  enabled: boolean;
  builtIn: boolean;
  name: string;
  category: SkillCategory;
  mechanic: SkillMechanic;
  enchantMode?: EnchantMode;
  owner: "ball";
  applicationScope: SkillApplicationScope;
  trigger: string;
  triggerType: SkillTriggerType;
  traits: SkillTrait[];
  traitConfigs: SkillTraitConfig[];
  evolutionTraits: SkillEvolutionTraitConfig[];
  effects: SkillEffectConfig[];
  evolutionEffects: SkillEffectConfig[];
  effect: string;
  description: string;
  evolutionEnabled: boolean;
  evolution: string | null;
  color: string;
  unit: SkillValueUnit;
  levels: [number, number, number];
  /** Skill-owned magic damage before the run magic-power multiplier. */
  magicDamage: [number, number, number] | null;
  /** Damage owned by this skill before its selected physical/magic stat multiplier. */
  skillDamage: [number, number, number];
  damageType: SkillDamageType;
  cooldown: [number, number, number];
  direction: "up" | "down";
  /** Design-review metadata only; it does not affect runtime selection or combat. */
  risk: number;
  ballCost: 0;
};

const SKILL_DESCRIPTION_VARIABLES: Record<BuiltinClassSkillId, Record<string, string>> = {
  "warrior-smash": {}, "warrior-shockwave": {}, "warrior-execute": {}, "warrior-crush": {}, "warrior-guard": {},
  "archer-rapid": { "{arrowCount}": "2" }, "archer-pierce": {}, "archer-ricochet": { "{ricochetStep}": "0.5" },
  "archer-focus": { "{maxStacks}": "3", "{focusReset}": "3" }, "archer-weakpoint": {},
  "mage-fireball": { "{fixedMagicDamage}": "1" }, "mage-lightning": { "{evolutionTargets}": "3" },
  "mage-freeze": {}, "mage-black-hole": { "{blackHoleDuration}": "4", "{fixedMagicDamage}": "1" }, "mage-mana-blast": {},
  "common-magnet": {}, "common-luck": { "{extraDropChance}": "50" }, "common-wide": { "{evolutionWide}": "50" },
  "common-move-speed": { "{evolutionMove}": "20" }, "common-xp": { "{evolutionHeal}": "1" },
  "common-skill-range": { "{evolutionRange}": "50" }, "common-chain": { "{evolutionTargets}": "3" },
  "common-damage": { "{evolutionPhysicalBonus}": "3" }, "common-magic": { "{evolutionMagicBonus}": "3" },
  "common-cooldown": { "{resetChance}": "20" }, "common-skill-duration": { "{evolutionDuration}": "30" },
};

function formatSkillValues(values: readonly number[], level?: number) {
  if (level !== undefined) {
    const index = Math.max(0, Math.min(values.length - 1, Math.max(1, level) - 1));
    const value = values[index] ?? 0;
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return values.map((value) => Number.isInteger(value) ? String(value) : String(value)).join("/");
}

/** Resolve numeric placeholders in player-facing skill descriptions from the active config. */
export function resolveSkillDescription(config: Pick<SkillConfig, "description" | "levels" | "cooldown" | "traitConfigs" | "magicDamage" | "skillDamage">, level?: number) {
  const traitValues = (kind: SkillTrait) => formatSkillValues(config.traitConfigs.find((trait) => trait.kind === kind)?.values ?? [0, 0, 0], level);
  const replacements: Record<string, string> = {
    "{levels}": formatSkillValues(config.levels, level),
    "{cooldown}": formatSkillValues(config.cooldown, level),
    "{skillDamage}": formatSkillValues(config.skillDamage, level),
    "{magicDamage}": formatSkillValues(config.magicDamage ?? [0, 0, 0], level),
    "{physicalBonus}": "공통 물리 강화",
    "{magicBonus}": "공통 마법 강화",
    "{trait:splash}": traitValues("splash"),
    "{trait:burn}": traitValues("burn"),
    "{trait:freeze}": traitValues("freeze"),
    "{trait:black-hole}": traitValues("black-hole"),
    "{trait:mana-seal}": traitValues("mana-seal"),
  };
  const constants = "id" in config ? SKILL_DESCRIPTION_VARIABLES[config.id as BuiltinClassSkillId] ?? {} : {};
  return Object.entries({ ...replacements, ...constants }).reduce((text, [token, value]) => text.replaceAll(token, value), config.description);
}

/** One-line copy for dense cards and the in-run owned-skill tooltip. */
export function resolveSkillSummary(config: Pick<SkillConfig, "description" | "levels" | "cooldown" | "traitConfigs" | "magicDamage" | "skillDamage">, level?: number) {
  const resolved = resolveSkillDescription(config, level)
    .replace(/[^.!?]*진화[^.!?]*[.!?]?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = resolved.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [resolved];
  return sentences[0] ?? resolved;
}

export const SKILL_CONFIG_VERSION = 2;

export const SKILL_MAGIC_DAMAGE: Partial<Record<BuiltinClassSkillId, [number, number, number]>> = {
  "mage-freeze": [1, 2, 3],
  "mage-lightning": [2, 4, 6],
};

/** Skills whose configured level values are physical damage values. */
export const PHYSICAL_DAMAGE_SKILLS = new Set<BuiltinClassSkillId>([
  "warrior-smash", "warrior-shockwave", "warrior-crush",
]);
export const PHYSICAL_SKILLS = new Set<BuiltinClassSkillId>([
  ...PHYSICAL_DAMAGE_SKILLS,
  "warrior-execute", "archer-pierce", "archer-ricochet", "archer-focus", "archer-weakpoint",
]);

export const SKILL_STORAGE_KEY = "echo-breaker-class-skills-v1";
export const SKILL_BUILD_STORAGE_KEY = "echo-breaker-skill-build-v1";

export const SKILL_COLORS: Record<BuiltinClassSkillId, string> = {
  "warrior-smash": "#ff6b57",
  "warrior-shockwave": "#ff9f43",
  "warrior-execute": "#ff3f6c",
  "warrior-crush": "#ffd166",
  "warrior-guard": "#4ea8ff",
  "archer-rapid": "#72f1b8",
  "archer-pierce": "#4de2ff",
  "archer-ricochet": "#9cff57",
  "archer-focus": "#ffe45e",
  "archer-weakpoint": "#ff5c93",
  "mage-fireball": "#ff7043",
  "mage-lightning": "#a78bfa",
  "mage-freeze": "#65dcff",
  "mage-black-hole": "#7c4dff",
  "mage-mana-blast": "#d66bff",
  "common-magnet": "#9aa3b2",
  "common-luck": "#9aa3b2",
  "common-wide": "#9aa3b2",
  "common-move-speed": "#9aa3b2",
  "common-xp": "#9aa3b2",
  "common-skill-range": "#9aa3b2",
  "common-chain": "#9aa3b2",
  "common-damage": "#9aa3b2",
  "common-magic": "#9aa3b2",
  "common-cooldown": "#9aa3b2",
  "common-skill-duration": "#9aa3b2",
};

const SKILL_MECHANICS: Record<BuiltinClassSkillId, SkillMechanic> = {
  "warrior-smash": "impact",
  "warrior-shockwave": "impact",
  "warrior-execute": "impact",
  "warrior-crush": "control",
  "warrior-guard": "defense",
  "archer-rapid": "summon",
  "archer-pierce": "impact",
  "archer-ricochet": "chain",
  "archer-focus": "impact",
  "archer-weakpoint": "impact",
  "mage-fireball": "control",
  "mage-lightning": "chain",
  "mage-freeze": "control",
  "mage-black-hole": "control",
  "mage-mana-blast": "control",
  "common-magnet": "passive",
  "common-luck": "passive",
  "common-wide": "passive",
  "common-move-speed": "passive",
  "common-xp": "passive",
  "common-skill-range": "passive",
  "common-chain": "passive",
  "common-damage": "passive",
  "common-magic": "passive",
  "common-cooldown": "passive",
  "common-skill-duration": "passive",
};

export const SKILL_COOLDOWNS: Record<BuiltinClassSkillId, [number, number, number]> = {
  "warrior-smash": [1.2, 1, 0.8],
  "warrior-shockwave": [4, 3.5, 3],
  "warrior-execute": [4, 3, 2],
  "warrior-crush": [2, 1, 0.5],
  "warrior-guard": [15, 12, 8],
  "archer-rapid": [3.8, 3.4, 3],
  "archer-pierce": [2.5, 2.1, 1.7],
  "archer-ricochet": [2.2, 1.8, 1.4],
  "archer-focus": [1.8, 1.5, 1.2],
  "archer-weakpoint": [3, 2.5, 2],
  "mage-fireball": [2.8, 2.3, 1.8],
  "mage-lightning": [2.5, 2, 1.5],
  "mage-freeze": [3, 2.5, 2],
  "mage-black-hole": [12, 10, 8],
  "mage-mana-blast": [3, 2.5, 2],
  "common-magnet": [0, 0, 0],
  "common-luck": [0, 0, 0],
  "common-wide": [0, 0, 0],
  "common-move-speed": [0, 0, 0],
  "common-xp": [0, 0, 0],
  "common-skill-range": [0, 0, 0],
  "common-chain": [0, 0, 0],
  "common-damage": [0, 0, 0],
  "common-magic": [0, 0, 0],
  "common-cooldown": [0, 0, 0],
  "common-skill-duration": [0, 0, 0],
};

export const SKILL_EVOLUTIONS: Partial<Record<BuiltinClassSkillId, string>> = {
  "warrior-smash": "강타의 쿨타임이 0.4초로 고정됩니다.",
  "warrior-shockwave": "충격파 범위가 50px 증가합니다.",
  "warrior-execute": "최대 배율 적용 기준이 체력 40%로 완화됩니다.",
  "warrior-crush": "가드와 반사 블록의 효과를 무시합니다.",
  "warrior-guard": "철벽의 최대 저장 수가 4회로 증가합니다.",
  "archer-rapid": "생성된 화살이 원본 공과 독립적으로 유지되고, 화면 아래로 떨어지거나 웨이브가 종료되면 사라집니다.",
  "archer-pierce": "가드와 반사 블록도 관통합니다.",
  "archer-ricochet": "연쇄 범위가 50px, 대상 수가 2개 증가합니다.",
  "archer-focus": "집중 약화 중첩이 웨이브 종료까지 유지됩니다.",
  "archer-weakpoint": "약점 사격의 직접 피해 배율이 3배에서 4배로 증가합니다.",
  "mage-fireball": "범위 내 모든 블록에 화상을 적용합니다.",
  "mage-lightning": "연쇄 대상 수가 3개 증가하고 대상당 피해 계수가 0.5가 됩니다.",
  "mage-freeze": "동결 종료 시 주변 블록으로 동결이 확산됩니다.",
  "mage-black-hole": "필드 내 블록에 초당 1의 피해를 줍니다.",
  "mage-mana-blast": "봉인 효과가 웨이브 종료까지 유지됩니다.",
};

// Common skills also gain a distinct evolution at their fourth pick.
SKILL_EVOLUTIONS["common-magnet"] = "아이템이 패들에 닿기 전까지 속도가 빨라지고, 화면 전체에서 흡수됩니다.";
SKILL_EVOLUTIONS["common-luck"] = "아이템 드롭 시 50% 확률로 추가 아이템을 생성합니다.";
SKILL_EVOLUTIONS["common-wide"] = "패들 폭이 50px 추가 증가합니다.";
SKILL_EVOLUTIONS["common-move-speed"] = "이동속도 증가량이 20% 추가됩니다.";
SKILL_EVOLUTIONS["common-xp"] = "웨이브 시작 시 CORE가 1회 추가로 회복됩니다.";
SKILL_EVOLUTIONS["common-skill-range"] = "광역 범위가 50px 추가 증가합니다.";
SKILL_EVOLUTIONS["common-chain"] = "연쇄 대상 수가 3개 추가 증가합니다.";
SKILL_EVOLUTIONS["common-damage"] = "물리 스킬 피해가 3 추가 증가합니다.";
SKILL_EVOLUTIONS["common-magic"] = "마법 스킬 피해가 3 추가 증가합니다.";
SKILL_EVOLUTIONS["common-cooldown"] = "액티브 스킬 발동 시 20% 확률로 쿨타임을 즉시 초기화합니다.";
SKILL_EVOLUTIONS["common-skill-duration"] = "모든 지속 효과 시간이 30% 추가 증가합니다.";

function builtinTriggerType(id: BuiltinClassSkillId): SkillTriggerType {
  if (id.startsWith("common-")) return "passive";
  if (id === "archer-focus") return "repeat-hit";
  if (id === "warrior-crush" || id === "mage-mana-blast") return "special-brick-hit";
  return "brick-hit";
}

function builtinTraits(id: BuiltinClassSkillId): SkillTrait[] {
  if (id.startsWith("common-")) return ["passive"];
  const traits: Partial<Record<BuiltinClassSkillId, SkillTrait[]>> = {
    "warrior-smash": ["smash"],
    "warrior-shockwave": ["splash"],
    "warrior-execute": ["execute"],
    "warrior-crush": ["crush"],
    "warrior-guard": ["barrier"],
    "archer-rapid": ["rapid-fire"],
    "archer-pierce": ["pierce"],
    "archer-ricochet": ["chain"],
    "archer-focus": ["focus"],
    "archer-weakpoint": ["weakpoint"],
    "mage-fireball": ["splash", "burn"],
    "mage-lightning": ["chain"],
    "mage-freeze": ["freeze"],
    "mage-black-hole": ["black-hole"],
    "mage-mana-blast": ["mana-seal"],
  };
  return [...(traits[id] ?? ["direct-damage"])] as SkillTrait[];
}

function createTraitConfigs(id: BuiltinClassSkillId, traits: SkillTrait[], values: [number, number, number], unit: SkillValueUnit): SkillTraitConfig[] {
  const damage = SKILL_MAGIC_DAMAGE[id] ?? [0, 0, 0];
  const damageSpec = (kind: SkillTrait): [number, number, number] => {
    if (PHYSICAL_DAMAGE_SKILLS.has(id) && ["direct-damage", "smash", "crush", "chain"].includes(kind)) {
      return [...values] as [number, number, number];
    }
    if (id === "warrior-shockwave" && kind === "splash") {
      return [...values] as [number, number, number];
    }
    return [...damage] as [number, number, number];
  };
  const effectSpec = (kind: SkillTrait): { values: [number, number, number]; unit: SkillValueUnit } => {
    if (kind === "splash") {
      if (id === "warrior-smash") return { values: [85, 95, 105], unit: "pixels" };
      if (id === "warrior-shockwave") return { values: [105, 115, 125], unit: "pixels" };
      if (id === "mage-fireball") return { values: [100, 125, 150], unit: "pixels" };
    }
    if (kind === "burn") return { values: [2, 4, 6], unit: "seconds" };
    if (kind === "freeze") return { values: [2, 4, 6], unit: "seconds" };
    if (kind === "barrier") return { values: [1, 1, 1], unit: "count" };
    return { values: [...values] as [number, number, number], unit };
  };
  return traits.map((kind) => ({
    kind,
    ...effectSpec(kind),
    damageType: PHYSICAL_SKILLS.has(id) ? "physical" : "magic",
    damage: damageSpec(kind),
  }));
}

function createTraitEffects(traits: SkillTraitConfig[], prefix = "trait"): SkillEffectConfig[] {
  return traits.map((trait) => ({
    id: `${prefix}-${trait.kind}`,
    kind: trait.kind,
    trigger: "on-hit",
    target: "hit",
    order: SKILL_TRAIT_PRIORITY[trait.kind] ?? 30,
    values: [...trait.values] as [number, number, number],
    unit: trait.unit,
    damageType: trait.damageType,
    damage: [...trait.damage] as [number, number, number],
    damageSource: "configured",
    interval: [1, 1, 1],
    duration: [0, 0, 0],
    radius: [0, 0, 0],
    enabled: true,
  }));
}

function builtinEffects(): SkillEffectConfig[] {
  return [];
}

function builtinEvolutionEffects(id: BuiltinClassSkillId): SkillEffectConfig[] {
  if (id !== "mage-black-hole") return [];
  const effect = emptyEffect("black-hole-evolution-periodic-damage", "periodic-damage");
  return [{
    ...effect,
    trigger: "while-active",
    target: "area",
    order: 70,
    unit: "seconds",
    values: [1, 1, 1],
    interval: [1, 1, 1],
    damageType: "magic",
    damage: [1, 1, 1],
  }];
}

const skill = (
  id: BuiltinClassSkillId,
  name: string,
  category: SkillCategory,
  trigger: string,
  effect: string,
  description: string,
  levels: [number, number, number],
  unit: SkillValueUnit,
  direction: "up" | "down" = "up",
): SkillConfig => ({
  configVersion: SKILL_CONFIG_VERSION,
  id,
  enabled: true,
  builtIn: true,
  name,
  category,
  mechanic: SKILL_MECHANICS[id],
  owner: "ball",
  applicationScope: "per-ball",
  triggerType: builtinTriggerType(id),
  traits: builtinTraits(id),
  traitConfigs: createTraitConfigs(id, builtinTraits(id), levels, unit),
  evolutionTraits: [],
  effects: [...createTraitEffects(createTraitConfigs(id, builtinTraits(id), levels, unit)), ...builtinEffects()],
  evolutionEffects: builtinEvolutionEffects(id),
  trigger: SKILL_COOLDOWNS[id][0] > 0 ? "공별 쿨타임 완료 후 블록 타격" : trigger,
  effect,
  description,
  evolution: SKILL_EVOLUTIONS[id] ?? null,
  evolutionEnabled: Boolean(SKILL_EVOLUTIONS[id]),
  color: SKILL_COLORS[id],
  unit,
  levels,
  magicDamage: SKILL_MAGIC_DAMAGE[id] ? [...SKILL_MAGIC_DAMAGE[id]!] as [number, number, number] : null,
  skillDamage: id === "warrior-execute"
    ? [0, 0, 0]
    : PHYSICAL_DAMAGE_SKILLS.has(id)
    ? [...levels] as [number, number, number]
    : SKILL_MAGIC_DAMAGE[id] ? [...SKILL_MAGIC_DAMAGE[id]!] as [number, number, number] : [0, 0, 0],
  damageType: PHYSICAL_SKILLS.has(id) ? "physical" : "magic",
  cooldown: SKILL_COOLDOWNS[id],
  direction,
  risk: 10,
  ballCost: 0,
});

const passiveSkill = (
  id: BuiltinClassSkillId,
  name: string,
  effect: string,
  description: string,
  levels: [number, number, number],
  unit: SkillValueUnit,
): SkillConfig => ({
  configVersion: SKILL_CONFIG_VERSION,
  id,
  enabled: true,
  builtIn: true,
  name,
  category: "common",
  mechanic: SKILL_MECHANICS[id],
  owner: "ball",
  applicationScope: "per-ball",
  triggerType: "passive",
  traits: ["passive"],
  traitConfigs: [{ kind: "passive", values: [...levels] as [number, number, number], unit, damageType: "magic", damage: [0, 0, 0] }],
  evolutionTraits: [],
  effects: createTraitEffects([{ kind: "passive", values: [...levels] as [number, number, number], unit, damageType: "magic", damage: [0, 0, 0] }]),
  evolutionEffects: [],
  trigger: "획득 즉시 상시 적용",
  effect,
  description,
  evolution: SKILL_EVOLUTIONS[id] ?? null,
  evolutionEnabled: Boolean(SKILL_EVOLUTIONS[id]),
  color: SKILL_COLORS[id],
  unit,
  levels,
  magicDamage: null,
  skillDamage: [0, 0, 0],
  damageType: "magic",
  cooldown: SKILL_COOLDOWNS[id],
  direction: "up",
  risk: 5,
  ballCost: 0,
});

export const DEFAULT_SKILLS: SkillConfig[] = [
  skill("warrior-smash", "강타", "warrior", "블록 타격 시 상시 적용", "직접 타격 물리 피해 강화", "직접 타격을 강화하는 단일 대상 핵심 스킬입니다. {levels}의 물리 피해를 추가하며, 실제 피해는 스킬 기본 피해 + {physicalBonus}입니다. 가드 블록에는 발동하지 않고 범위 피해가 없습니다.", [1, 3, 5], "damage"),
  skill("warrior-shockwave", "충격파", "warrior", "블록 타격 시 상시 적용", "주변 물리 피해", "주변 블록을 공격하는 범위 피해 핵심 스킬입니다. 원래 대상 포함 범위 내 모든 블록에 {levels}의 물리 피해를 주며, 기본 범위는 {trait:splash}px입니다. 기본 쿨타임은 {cooldown}초이고 연쇄 효과는 없습니다. 실제 피해는 스킬 기본 피해 + {physicalBonus}입니다.", [1, 2, 3], "damage"),
  skill("warrior-execute", "처형", "warrior", "블록 타격 시 상시 적용", "저체력 대상 피해 증폭", "대상 HP가 낮을수록 직접 타격 피해를 증폭합니다. HP 100%에서 기본 배율, HP 25%에서 최대 {levels}배를 적용하며 HP 25% 이하에서도 유지됩니다. 기본 공격과 다른 직접 타격 스킬 피해에 함께 적용되고, 기본 쿨타임은 {cooldown}초입니다.", [1.5, 2, 3], "multiplier"),
  skill("warrior-crush", "분쇄", "warrior", "블록 타격 시 상시 적용", "특수 블록 물리 피해", "가드·힐러·반사 등 특수 블록에만 {levels}의 물리 추가 피해를 줍니다. 기본 쿨타임은 {cooldown}초이며, 실제 피해는 스킬 기본 피해 + {physicalBonus}입니다. 일반 블록에는 추가 피해를 주지 않습니다.", [1, 2, 3], "damage"),
  skill("warrior-guard", "철벽", "warrior", "블록 타격 시 자동 발동", "CORE 보호막 충전", "CORE 피해를 막는 방어 충전 스킬입니다. 발동 1회당 방어 충전 1회를 얻고 기본 최대 저장 수는 1회, 진화 후 최대 4회입니다. 기본 쿨타임은 {levels}초입니다.", [15, 12, 8], "seconds", "down"),

  skill("archer-rapid", "연사", "archer", "블록 타격 시 자동 발동", "임시 화살 2발 생성", "임시 화살을 여러 개 생성하는 핵심 공격 스킬입니다. 기본 발동 시 임시 화살 {arrowCount}발을 생성하며 {levels}초 유지됩니다. 진화 화살은 원본 공과 독립적으로 존재하고 별도 스킬을 발동하지 않으며, 화면 아래로 떨어지거나 웨이브 종료 시 사라집니다.", [5, 7, 9], "seconds"),
  skill("archer-pierce", "관통 화살", "archer", "블록 타격 시 상시 적용", "쿨타임마다 블록 관통", "공이 여러 블록을 관통하는 핵심 공격 스킬입니다. 블록 {levels}개를 관통하고 각 블록에 일반 공과 동일한 피해(기본 물리 피해 + {physicalBonus})를 적용하며 관통에 따른 피해 감소는 없습니다.", [1, 2, 3], "count"),
  skill("archer-ricochet", "튕김 화살", "archer", "블록 타격 시 상시 적용", "주변 블록 연쇄 물리 공격", "주변 블록 {levels}개로 공격을 전파합니다. 연쇄된 각 대상에 원래 타격과 동일한 피해(기본 물리 피해 + {physicalBonus})를 적용하고, 1회차는 1.0배, 이후 매 회차 {ricochetStep}배씩 증가합니다. 진화로 추가되는 대상에도 같은 증가가 적용됩니다.", [1, 2, 3], "count"),
  skill("archer-focus", "집중 사격", "archer", "블록 타격 시 상시 적용", "반복 타격 약화", "같은 블록을 반복 타격할수록 받는 피해가 중첩당 {levels}% 증가합니다. 최대 {maxStacks}중첩, 최대 약화량은 레벨별 30/60/90%이며, {focusReset}초 동안 타격이 없으면 초기화됩니다. 진화 시 웨이브 종료까지 유지됩니다.", [10, 20, 30], "percent"),
  skill("archer-weakpoint", "약점 사격", "archer", "블록 타격 시 상시 적용", "직접 피해 증폭", "모든 직접 타격 피해를 증가시키는 단일 대상 화력 스킬입니다. 직접 타격 배율은 {levels}배이며 진화 시 레벨과 관계없이 4배를 적용합니다.", [2, 2.5, 3], "multiplier"),

  skill("mage-fireball", "화염 봉인", "mage", "블록 타격 시 자동 발동", "광역 회복 차단", "주변 모든 블록의 회복을 차단하는 광역 제어 스킬입니다. 범위 {trait:splash}px 내 모든 블록에 {trait:burn}초 동안 회복 차단을 적용하고, 진화 시 같은 시간 동안 초당 {fixedMagicDamage}의 고정 마법 화상을 추가합니다. 직접 피해는 없습니다.", [2, 4, 6], "seconds"),
  skill("mage-lightning", "연쇄 번개", "mage", "블록 타격 시 상시 적용", "주변 블록 연쇄 마법 공격", "여러 블록에 피해를 분산하는 광역 연쇄 공격입니다. 연결 대상은 {levels}개이며 대상당 피해량도 동일합니다: LV1 2개×2피해, LV2 4개×4피해, LV3 6개×6피해의 고정 마법 피해를 줍니다. 진화 시 연결 대상이 +{evolutionTargets}개, 대상당 피해량은 연결 대상 수×0.5 + {magicBonus}입니다.", [2, 4, 6], "count"),
  skill("mage-freeze", "빙결 표식", "mage", "블록 타격 시 상시 적용", "동결·다음 피격 강화", "적을 얼리고 다음 직접 타격을 강화하는 제어 스킬입니다. 동결 지속시간은 {trait:freeze}초이며 다음 직접 타격에 추가 피해 {magicDamage} + {magicBonus}를 적용합니다. 진화 시 동결 종료 후 주변 블록으로 동결이 확산됩니다.", [2, 4, 6], "seconds"),
  skill("mage-black-hole", "블랙홀", "mage", "블록 타격 시 자동 발동", "공 흡인 필드", "공을 끌어모으는 필드 스킬입니다. 충돌한 블록 중심에 범위 {levels}px, 기본 지속시간 {blackHoleDuration}초의 필드를 생성하며 생성 블록이 파괴되어도 유지됩니다. 기본은 공 제어 전용이고, 진화 시 필드 내 블록에 초당 {fixedMagicDamage}의 고정 마법 피해를 줍니다.", [100, 150, 200], "pixels"),
  skill("mage-mana-blast", "마나 봉인", "mage", "블록 타격 시 상시 적용", "특수 기능 봉인", "가드·힐러·반사 등 특수 블록 기능을 봉인하는 카운터 스킬입니다. 특수 블록에만 {trait:mana-seal}초 동안 적용되며 직접 피해는 없습니다.", [5, 8, 11], "seconds"),
  passiveSkill("common-magnet", "아이템 자석", "아이템 흡수 범위 증가", "아이템 획득 범위를 증가시키는 패시브입니다. 획득 범위가 {levels}px 증가하며, 진화 시 화면 전체의 아이템을 끌어옵니다.", [70, 120, 180], "pixels"),
  passiveSkill("common-luck", "행운", "아이템 추가 드롭 확률 증가", "아이템 드롭 확률을 증가시키는 패시브입니다. 드롭 확률이 {levels}% 증가하고, 진화 시 아이템 드롭 순간 {extraDropChance}% 확률로 추가 아이템을 생성합니다.", [8, 14, 20], "percent"),
  passiveSkill("common-wide", "패들 확장", "패들 길이 증가", "패들 폭을 직접 증가시키는 패시브입니다. 패들 폭이 +{levels}px 증가하고, 진화 시 추가로 +{evolutionWide}px 증가합니다.", [50, 100, 150], "pixels"),
  passiveSkill("common-move-speed", "패들 가속", "패들 이동속도 증가", "패들의 좌우 이동속도를 증가시키는 패시브입니다. 이동속도가 {levels}% 증가하고, 진화 시 추가로 +{evolutionMove}% 증가합니다.", [15, 25, 40], "percent"),
  passiveSkill("common-xp", "코어 강화", "CORE 최대 체력 증가", "CORE 최대 체력과 현재 체력을 함께 증가시키는 패시브입니다. 체력이 +{levels}HP 증가하고, 진화 시 웨이브 시작 시 CORE가 +{evolutionHeal}HP 회복됩니다.", [1, 2, 3], "health"),
  passiveSkill("common-skill-range", "범위 증폭", "광역 스킬 범위 증가", "광역 스킬의 적용 범위를 증가시키는 패시브입니다. 범위가 {levels}% 증가하고, 진화 시 추가로 +{evolutionRange}px 증가합니다.", [20, 40, 60], "percent"),
  passiveSkill("common-chain", "연계 증폭", "스킬 연계 횟수 증가", "연쇄 스킬의 연결 대상 수를 증가시키는 패시브입니다. 기본 연결 대상 수가 +{levels}개 증가하고, 진화 시 추가로 +{evolutionTargets}개 증가합니다.", [1, 1, 1], "count"),
  passiveSkill("common-damage", "공격 강화", "물리 피해 증가", "모든 물리 스킬 피해를 증가시키는 패시브입니다. 일반 공 피해와 물리 스킬 피해가 +{levels} 증가하고, 진화 시 추가로 +{evolutionPhysicalBonus} 증가합니다.", [1, 2, 3], "damage"),
  passiveSkill("common-magic", "마력 강화", "마법 피해 증가", "모든 마법 스킬 피해를 증가시키는 패시브입니다. 마법 스킬 피해가 +{levels} 증가하고, 퍼센트 배율은 사용하지 않으며, 진화 시 추가로 +{evolutionMagicBonus} 증가합니다.", [1, 2, 3], "damage"),
  passiveSkill("common-cooldown", "재사용 가속", "스킬 쿨타임 감소", "모든 액티브 스킬의 쿨타임을 감소시키는 패시브입니다. 쿨타임이 {levels}% 감소하고, 진화 시 액티브 스킬 발동 시 {resetChance}% 확률로 즉시 초기화됩니다.", [10, 20, 30], "percent"),
  passiveSkill("common-skill-duration", "스킬 지속 강화", "스킬 지속시간 배율 증가", "상태 이상·화상·회복 차단·동결·봉인·필드 등 모든 지속 효과의 시간을 증가시키는 패시브입니다. 지속시간이 {levels}% 증가하고, 진화 시 추가로 +{evolutionDuration}% 증가합니다.", [10, 20, 30], "percent"),
];

export const NORMAL_SKILLS = DEFAULT_SKILLS;

const TRIGGER_TYPES = new Set<SkillTriggerType>(["brick-hit", "brick-break", "repeat-hit", "special-brick-hit", "passive"]);
const TRAITS = new Set<SkillTrait>(["direct-damage", "smash", "execute", "crush", "focus", "weakpoint", "mana-seal", "splash", "chain", "burn", "freeze", "pierce", "rapid-fire", "barrier", "black-hole", "passive"]);

function tuple3(value: unknown, fallback: [number, number, number]) {
  const values = Array.isArray(value) ? value.map(Number) : [];
  return values.length === 3 && values.every(Number.isFinite) ? values as [number, number, number] : [...fallback] as [number, number, number];
}

const SPECIALIZED_TRAIT_BY_ID: Partial<Record<BuiltinClassSkillId, SkillTrait>> = {
  "warrior-smash": "smash",
  "warrior-execute": "execute",
  "warrior-crush": "crush",
  "archer-focus": "focus",
  "archer-weakpoint": "weakpoint",
  "mage-mana-blast": "mana-seal",
};

function migrateTraitKind(skillId: ClassSkillId, kind: SkillTrait) {
  return kind === "direct-damage" && !skillId.startsWith("custom-") ? SPECIALIZED_TRAIT_BY_ID[skillId as BuiltinClassSkillId] ?? kind : kind;
}

function normalizeTraitConfigs(saved: Partial<SkillConfig>, base: SkillConfig, traits: SkillTrait[]) {
  const savedConfigs = Array.isArray(saved.traitConfigs) ? saved.traitConfigs : [];
  const legacyDamageType: SkillDamageType = saved.damageType === "physical" ? "physical" : "magic";
  const legacyDamage = tuple3(saved.skillDamage, tuple3(saved.magicDamage, base.skillDamage));
  const differs = (left: unknown, right: [number, number, number]) => JSON.stringify(tuple3(left, right)) !== JSON.stringify(right);
  return traits.map((kind, index): SkillTraitConfig => {
    const stored = savedConfigs.find((entry) => entry && migrateTraitKind(base.id, entry.kind) === kind);
    const fallback = base.traitConfigs.find((entry) => entry.kind === kind);
    const storedMatchesBase = Boolean(stored && fallback
      && JSON.stringify(tuple3(stored.values, fallback.values)) === JSON.stringify(fallback.values)
      && JSON.stringify(tuple3(stored.damage, fallback.damage)) === JSON.stringify(fallback.damage)
      && stored.damageType === fallback.damageType);
    const legacyPrimaryChanged = index === 0 && (differs(saved.levels, base.levels) || differs(saved.skillDamage, base.skillDamage) || differs(saved.magicDamage, base.magicDamage ?? base.skillDamage) || (saved.damageType && saved.damageType !== base.damageType));
    const useLegacyFields = (!stored && Array.isArray(saved.traits) && saved.traits.includes(kind)) || (index === 0 && saved.builtIn === false) || (storedMatchesBase && legacyPrimaryChanged);
    const damageType: SkillDamageType = useLegacyFields ? legacyDamageType : stored?.damageType === "physical" ? "physical" : stored?.damageType === "magic" ? "magic" : fallback?.damageType ?? legacyDamageType;
    return {
      kind,
      values: tuple3(stored?.values, useLegacyFields ? tuple3(saved.levels, fallback?.values ?? base.levels) : fallback?.values ?? tuple3(saved.levels, base.levels)),
      unit: normalizeSkillValueUnit(stored?.unit, useLegacyFields ? normalizeSkillValueUnit(saved.unit, fallback?.unit ?? base.unit) : fallback?.unit ?? normalizeSkillValueUnit(saved.unit, base.unit)),
      damageType,
      damage: tuple3(stored?.damage, useLegacyFields ? legacyDamage : fallback?.damage ?? legacyDamage).map((value) => Math.max(0, value)) as [number, number, number],
    };
  });
}

function normalizeEffectConfigs(value: unknown, fallback: SkillEffectConfig[]): SkillEffectConfig[] {
  if (!Array.isArray(value)) return fallback.map((effect) => ({ ...effect, values: [...effect.values] as [number, number, number], damage: [...effect.damage] as [number, number, number], interval: [...effect.interval] as [number, number, number], duration: [...effect.duration] as [number, number, number], radius: [...effect.radius] as [number, number, number] }));
  return value.flatMap((entry): SkillEffectConfig[] => {
    if (!entry || typeof entry !== "object") return [];
    const saved = entry as Partial<SkillEffectConfig>;
    if (typeof saved.id !== "string" || !saved.id.trim()) return [];
    const base = fallback.find((effect) => effect.id === saved.id) ?? emptyEffect(saved.id);
    const trigger = ["on-cast", "on-hit", "on-break", "on-direct-hit", "while-active", "on-tick", "on-expire"].includes(saved.trigger as string) ? saved.trigger! : base.trigger;
    const target = ["hit", "area", "nearest", "same-trait", "all-enemies", "self", "paddle", "core"].includes(saved.target as string) ? saved.target! : base.target;
    const legacyKind = (saved.kind as string) === "trait" && TRAITS.has(saved.trait as SkillTrait) ? saved.trait : saved.kind;
    const kind = [...TRAITS, "damage", "create-field", "periodic-damage", "apply-status", "modify-damage", "spawn"].includes(legacyKind as string) ? legacyKind as SkillEffectKind : base.kind;
    const tuple = (raw: unknown, fallbackTuple: [number, number, number]) => Array.isArray(raw) ? [0, 1, 2].map((index) => Number.isFinite(Number(raw[index])) ? Number(raw[index]) : fallbackTuple[index]) as [number, number, number] : [...fallbackTuple] as [number, number, number];
    return [{
      ...base,
      ...saved,
      id: typeof saved.id === "string" ? saved.id : base.id,
      kind, trait: TRAITS.has(kind as SkillTrait) ? saved.trait : undefined, trigger, target,
      order: Number.isFinite(Number(saved.order)) ? Number(saved.order) : base.order,
      values: tuple(saved.values, base.values),
      damage: tuple(saved.damage, base.damage).map((entry) => Math.max(0, entry)) as [number, number, number],
      interval: tuple(saved.interval, base.interval).map((entry) => Math.max(0.05, entry)) as [number, number, number],
      duration: tuple(saved.duration, base.duration).map((entry) => Math.max(0, entry)) as [number, number, number],
      radius: tuple(saved.radius, base.radius).map((entry) => Math.max(0, entry)) as [number, number, number],
      damageType: saved.damageType === "physical" ? "physical" : "magic",
      damageSource: saved.damageSource === "skill" ? "skill" : "configured",
      enabled: saved.enabled !== false,
    }];
  });
}

function normalizeCommonSkillFields(saved: Partial<SkillConfig>, base: SkillConfig): SkillConfig {
  const triggerType = TRIGGER_TYPES.has(saved.triggerType as SkillTriggerType) ? saved.triggerType! : base.triggerType;
  const normalizedEffects = normalizeEffectConfigs(saved.effects, base.effects);
  const hasExplicitEffects = Array.isArray(saved.effects);
  const effectTraitEntries = normalizedEffects.filter((effect) => TRAITS.has(effect.kind as SkillTrait));
  const effectsMatchBase = effectTraitEntries.length > 0 && effectTraitEntries.every((effect) => {
    const fallback = base.traitConfigs.find((entry) => entry.kind === migrateTraitKind(base.id, effect.kind as SkillTrait));
    return fallback && JSON.stringify(effect.values) === JSON.stringify(fallback.values) && JSON.stringify(effect.damage) === JSON.stringify(fallback.damage) && effect.damageType === fallback.damageType;
  });
  const legacyTraitFieldsChanged = Array.isArray(saved.traitConfigs) && effectsMatchBase && saved.traitConfigs.some((entry) => {
    const fallback = base.traitConfigs.find((trait) => trait.kind === migrateTraitKind(base.id, entry.kind));
    return fallback && (JSON.stringify(entry.values) !== JSON.stringify(fallback.values) || JSON.stringify(entry.damage) !== JSON.stringify(fallback.damage) || entry.damageType !== fallback.damageType);
  });
  const effectTraitKindsCandidate = [...new Set(effectTraitEntries.map((effect) => migrateTraitKind(base.id, effect.kind as SkillTrait)))];
  const legacyTraitListChanged = saved.builtIn === false && Array.isArray(saved.traits) && JSON.stringify([...new Set(saved.traits.filter((trait): trait is SkillTrait => TRAITS.has(trait as SkillTrait)).map((trait) => migrateTraitKind(base.id, trait)))]) !== JSON.stringify(effectTraitKindsCandidate);
  const legacyPrimaryFieldsChanged = saved.builtIn === false && Array.isArray(saved.skillDamage) && JSON.stringify(saved.skillDamage) !== JSON.stringify(base.skillDamage);
  const legacyEffectConflict = legacyTraitFieldsChanged || legacyTraitListChanged || legacyPrimaryFieldsChanged;
  const effectTraitKinds = hasExplicitEffects && !legacyEffectConflict ? effectTraitKindsCandidate : [];
  const traits = effectTraitKinds.length > 0
    ? effectTraitKinds
    : Array.isArray(saved.traits)
      ? [...new Set(saved.traits.filter((trait): trait is SkillTrait => TRAITS.has(trait as SkillTrait)).map((trait) => migrateTraitKind(base.id, trait)))]
      : [...base.traits];
  const normalizedTraits = traits.length ? traits : (hasExplicitEffects ? [] : [...base.traits]);
  const effectTraitConfigs = hasExplicitEffects && !legacyEffectConflict ? effectTraitEntries : [];
  const effectTraitConfigSource: SkillTraitConfig[] = effectTraitConfigs.map((effect) => ({
    kind: effect.kind as SkillTrait,
    values: [...effect.values] as [number, number, number],
    unit: effect.unit,
    damageType: effect.damageType,
    damage: [...effect.damage] as [number, number, number],
  }));
  const traitConfigs = normalizeTraitConfigs({ ...saved, traitConfigs: effectTraitConfigSource.length > 0 ? effectTraitConfigSource : saved.traitConfigs }, base, normalizedTraits).map((trait) => {
    const effect = effectTraitConfigs.find((entry) => migrateTraitKind(base.id, entry.kind as SkillTrait) === trait.kind);
    return effect ? { ...trait, values: [...effect.values] as [number, number, number], unit: effect.unit, damageType: effect.damageType, damage: [...effect.damage] as [number, number, number] } : trait;
  });
  const configuredEffects = normalizedEffects.filter((effect) => !TRAITS.has(effect.kind as SkillTrait));
  const traitEffects = createTraitEffects(traitConfigs).map((effect) => {
    const savedEffect = normalizedEffects.find((entry) => entry.kind === effect.kind);
    const sourceEffect = legacyEffectConflict ? effect : savedEffect ?? effect;
    return {
      ...sourceEffect,
      values: [...effect.values] as [number, number, number],
      unit: effect.unit,
      damageType: effect.damageType,
      damage: [...effect.damage] as [number, number, number],
    };
  });
  const normalizedEvolutionEffects = normalizeEffectConfigs(saved.evolutionEffects, base.evolutionEffects);
  const evolutionEffectTraits = Array.isArray(saved.evolutionEffects) ? normalizedEvolutionEffects.filter((effect) => TRAITS.has(effect.kind as SkillTrait)) : [];
  const savedEvolutionTraits = Array.isArray(saved.evolutionTraits) ? saved.evolutionTraits.filter((entry) => entry && TRAITS.has(entry.kind)) : [];
  const evolutionTraitSource = evolutionEffectTraits.length > 0 ? evolutionEffectTraits : savedEvolutionTraits;
  const evolutionTraitConfigSource: SkillTraitConfig[] = evolutionTraitSource.map((effect) => ({
    kind: effect.kind as SkillTrait,
    values: [...effect.values] as [number, number, number],
    unit: effect.unit,
    damageType: effect.damageType,
    damage: [...effect.damage] as [number, number, number],
  }));
  const evolutionTraits = evolutionTraitSource.length
    ? normalizeTraitConfigs({ ...saved, traitConfigs: evolutionTraitConfigSource }, base, [...new Set(evolutionTraitSource.map((entry) => migrateTraitKind(base.id, entry.kind as SkillTrait)))])
    : [];
  const primary = traitConfigs[0] ?? base.traitConfigs[0];
  const savedLevels = tuple3(saved.levels, base.levels);
  const primaryValues = primary?.values ?? base.levels;
  // A trait's values describe its mechanic (for example Shockwave's splash
  // radius), while `levels` remains the skill's displayed level value. Older
  // normalized configs copied the first trait values into `levels`, so repair
  // that built-in shape when loading persisted data.
  const legacyTraitCopiedIntoLevels = base.builtIn
    && saved.builtIn !== false
    && JSON.stringify(savedLevels) === JSON.stringify(primaryValues)
    && JSON.stringify(base.levels) !== JSON.stringify(primaryValues);
  const levels = legacyTraitCopiedIntoLevels ? [...base.levels] as [number, number, number] : savedLevels;
  const skillDamage = tuple3(saved.skillDamage, base.skillDamage);
  const damageType = saved.damageType === "physical" ? "physical" : saved.damageType === "magic" ? "magic" : base.damageType;
  const riskValue = Number(saved.risk);
  const evolutionConfiguredEffects = normalizedEvolutionEffects.filter((effect) => !TRAITS.has(effect.kind as SkillTrait));
  const evolutionTraitEffects = createTraitEffects(evolutionTraits, "evolution-trait").map((effect) => {
    const savedEffect = normalizedEvolutionEffects.find((entry) => entry.kind === effect.kind);
    return savedEffect ? {
      ...savedEffect,
      values: [...effect.values] as [number, number, number],
      unit: effect.unit,
      damageType: effect.damageType,
      damage: [...effect.damage] as [number, number, number],
    } : effect;
  });
  return {
    ...base,
    ...saved,
    configVersion: SKILL_CONFIG_VERSION,
    enabled: saved.enabled !== false,
    applicationScope: saved.applicationScope === "shared" ? "shared" : "per-ball",
    triggerType,
    traits: normalizedTraits,
    traitConfigs,
    evolutionTraits,
    effects: [...traitEffects, ...configuredEffects],
    evolutionEffects: [...evolutionTraitEffects, ...evolutionConfiguredEffects],
    evolutionEnabled: saved.evolutionEnabled !== false && (saved.evolutionEnabled === true || Boolean(saved.evolution)),
    levels,
    // The card's level values use the skill's primary `unit`; effect traits
    // may use a different unit (for example, a fireball's splash radius is px
    // while its displayed level value is the seal duration in seconds).
    unit: base.builtIn ? base.unit : normalizeSkillValueUnit(saved.unit, base.unit),
    cooldown: tuple3(saved.cooldown, base.cooldown).map((value) => Math.max(0, value)) as [number, number, number],
    skillDamage: skillDamage.map((value) => Math.max(0, value)) as [number, number, number],
    damageType,
    magicDamage: damageType === "magic" ? skillDamage.map((value) => Math.max(0, value)) as [number, number, number] : null,
    risk: Number.isFinite(riskValue) ? Math.max(0, Math.min(100, riskValue)) : base.risk,
    owner: "ball",
    ballCost: 0,
  };
}

function syncExplicitPrimaryFields(saved: Partial<SkillConfig>, normalized: SkillConfig) {
  const primary = normalized.traitConfigs[0];
  if (!primary) return normalized;
  if (Array.isArray(saved.skillDamage) && saved.skillDamage.length === 3) {
    const damage = tuple3(saved.skillDamage, primary.damage).map((value) => Math.max(0, value)) as [number, number, number];
    const damageType: SkillDamageType = saved.damageType === "physical" ? "physical" : saved.damageType === "magic" ? "magic" : primary.damageType;
    primary.damage = damage;
    primary.damageType = damageType;
    normalized.skillDamage = [...damage];
    normalized.damageType = damageType;
    normalized.magicDamage = damageType === "magic" ? [...damage] : null;
  }
  return normalized;
}

export function normalizeSkillConfigs(saved: unknown): SkillConfig[] {
  const entries = Array.isArray(saved) ? saved : [];
  const builtins = DEFAULT_SKILLS.map((base) => {
    const savedSkill = entries.find((entry) => entry && typeof entry === "object" && "id" in entry && entry.id === base.id) as Partial<SkillConfig> | undefined;
    const values = Array.isArray(savedSkill?.levels) ? savedSkill.levels.map(Number) : [];
    const levels = values.length === 3 && values.every(Number.isFinite) ? values as [number, number, number] : base.levels;
    const legacyTimeFreeze = base.id === "mage-freeze"
      && `${savedSkill?.effect ?? ""} ${savedSkill?.description ?? ""}`.match(/타이머|제한시간|시간.*정지/);
    const legacyDestructionTrigger = (base.id === "warrior-shockwave" || base.id === "mage-fireball")
      && `${savedSkill?.effect ?? ""} ${savedSkill?.description ?? ""}`.includes("파괴");
    const formulaDescription = /(?:LV|레벨에 따라|2\+LV)/.test(savedSkill?.description ?? "");
    const refreshedCommonSpec = (["common-move-speed", "common-skill-range", "common-chain", "common-damage", "common-magic", "common-cooldown", "common-skill-duration"] as ClassSkillId[]).includes(base.id);
    const legacyReflectionTrigger = /패들|반사 횟수|충전/.test(savedSkill?.trigger ?? "");
    const legacyAlwaysOnTrigger = base.category !== "common" && /상시 적용|자동 발동/.test(savedSkill?.trigger ?? "");
    const migrated = base.id === "common-xp" ? base
      : legacyTimeFreeze || legacyDestructionTrigger || formulaDescription || refreshedCommonSpec || legacyReflectionTrigger || legacyAlwaysOnTrigger ? { ...savedSkill, name: base.name, trigger: base.trigger, effect: base.effect, description: base.description, levels: base.levels, unit: base.unit, direction: base.direction }
        : savedSkill;
    const savedCooldown = Array.isArray(savedSkill?.cooldown) && savedSkill.cooldown.length === 3 && savedSkill.cooldown.every((value) => Number.isFinite(Number(value)))
      ? savedSkill.cooldown.map(Number) as [number, number, number]
      : base.cooldown;
    const savedMagicDamage = Array.isArray(savedSkill?.magicDamage) && savedSkill.magicDamage.length === 3 && savedSkill.magicDamage.every((value) => Number.isFinite(Number(value)))
      ? savedSkill.magicDamage.map(Number) as [number, number, number]
      : base.magicDamage ? [...base.magicDamage] as [number, number, number] : null;
    return syncExplicitPrimaryFields(savedSkill ?? {}, normalizeCommonSkillFields({ ...migrated, id: base.id, builtIn: true, category: base.category, mechanic: base.mechanic, color: base.color, evolution: base.evolution, magicDamage: savedMagicDamage, skillDamage: tuple3(savedSkill?.skillDamage, savedMagicDamage ?? base.skillDamage), levels: base.id === "common-xp" || legacyReflectionTrigger ? base.levels : levels, cooldown: legacyReflectionTrigger ? base.cooldown : savedCooldown, unit: base.id === "mage-fireball" ? base.unit : migrated?.unit ?? base.unit }, base));
  });
  const custom = entries.flatMap((entry): SkillConfig[] => {
    if (!entry || typeof entry !== "object") return [];
    const savedSkill = entry as Partial<SkillConfig>;
    if (typeof savedSkill.id !== "string" || !savedSkill.id.startsWith("custom-")) return [];
    const category = (["warrior", "archer", "mage", "common"] as SkillCategory[]).includes(savedSkill.category as SkillCategory) ? savedSkill.category! : "mage";
    const mechanic = (["impact", "chain", "control", "summon", "defense", "passive"] as SkillMechanic[]).includes(savedSkill.mechanic as SkillMechanic) ? savedSkill.mechanic! : "impact";
    const fallback: SkillConfig = {
      id: savedSkill.id as CustomSkillId,
      enabled: true,
      builtIn: false,
      name: typeof savedSkill.name === "string" && savedSkill.name.trim() ? savedSkill.name : "사용자 스킬",
      category,
      mechanic,
      owner: "ball",
      applicationScope: "per-ball",
      trigger: "공별 쿨다운 완료 후 블록 타격",
      triggerType: "brick-hit",
      traits: ["direct-damage"],
      traitConfigs: [{ kind: "direct-damage", values: [1, 2, 3], unit: "damage", damageType: "magic", damage: [1, 2, 3] }],
      evolutionTraits: [],
      effects: [],
      evolutionEffects: [],
      effect: "선택한 특성 적용",
      description: "Skill Lab에서 만든 사용자 스킬입니다.",
      evolutionEnabled: false,
      evolution: null,
      color: typeof savedSkill.color === "string" ? savedSkill.color : "#d66bff",
      unit: "damage",
      levels: [1, 2, 3],
      magicDamage: [1, 2, 3],
      skillDamage: [1, 2, 3],
      damageType: "magic",
      cooldown: [2, 1.8, 1.6],
      direction: "up",
      risk: 10,
      ballCost: 0,
    };
    const normalized = syncExplicitPrimaryFields(savedSkill, normalizeCommonSkillFields({ ...savedSkill, id: fallback.id, builtIn: false, category, mechanic }, fallback));
    return [normalized];
  });
  return [...builtins, ...custom];
}

export function skillConfigMap(skills: SkillConfig[]) {
  return Object.fromEntries(skills.map((entry) => [entry.id, entry])) as Partial<Record<UpgradeId, SkillConfig>>;
}

/** Stable behavior/config identity for benchmark result matching. */
export function skillConfigSignature(skill: SkillConfig) {
  return JSON.stringify({
    id: skill.id,
    enabled: skill.enabled,
    category: skill.category,
    mechanic: skill.mechanic,
    applicationScope: skill.applicationScope,
    triggerType: skill.triggerType,
    traits: skill.traits,
    traitConfigs: skill.traitConfigs,
    levels: skill.levels,
    magicDamage: skill.magicDamage,
    skillDamage: skill.skillDamage,
    damageType: skill.damageType,
    cooldown: skill.cooldown,
    direction: skill.direction,
    evolution: skill.evolution,
    evolutionEnabled: skill.evolutionEnabled,
    evolutionTraits: skill.evolutionTraits,
    effects: skill.effects,
    evolutionEffects: skill.evolutionEffects,
  });
}

export function levelValue(level: number, values: [number, number, number]) {
  if (level <= 0) return 0;
  if (level <= 3) return values[level - 1];
  return Math.max(1, values[2] - (level - 3));
}
