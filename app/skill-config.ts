export type HeroClass = "warrior" | "archer" | "mage" | "common";
export type SkillCategory = HeroClass;
export type SkillMechanic = "impact" | "chain" | "control" | "summon" | "defense" | "passive" | "ultimate";
export type EnchantMode = "persistent" | "charge" | "single";

export const SKILL_MECHANIC_LABELS: Record<SkillMechanic, string> = {
  impact: "타격",
  chain: "연쇄",
  control: "제어",
  summon: "소환",
  defense: "방어",
  passive: "지속",
  ultimate: "궁극",
};

export type ClassSkillId =
  | "warrior-smash" | "warrior-shockwave" | "warrior-execute" | "warrior-crush" | "warrior-guard"
  | "warrior-earthquake" | "warrior-berserker"
  | "archer-rapid" | "archer-pierce" | "archer-ricochet" | "archer-focus" | "archer-weakpoint"
  | "archer-arrow-rain" | "archer-infinite"
  | "mage-fireball" | "mage-lightning" | "mage-freeze" | "mage-black-hole" | "mage-mana-blast"
  | "mage-elemental-storm" | "mage-meteor"
  | "common-magnet" | "common-luck" | "common-wide" | "common-xp" | "common-combo"
  | "common-ball-size" | "common-skill-range" | "common-chain" | "common-damage" | "common-cooldown";

export type LegacyUpgradeId =
  | "pierce" | "blast" | "glass" | "link" | "speed" | "wide" | "magnet" | "chain" | "fever"
  | "echo-split" | "double-drop" | "missile-mode" | "safety-block" | "gravity-well"
  | "horizontal-sweep" | "vertical-drill" | "emergency-wide" | "barrier-skill" | "last-shot"
  | "poison" | "blast-amp" | "corrosion" | "pressure";

export type UpgradeId = ClassSkillId | LegacyUpgradeId;

export const ENCHANT_MODE_LABELS: Record<EnchantMode, string> = {
  persistent: "지속형",
  charge: "충전형",
  single: "단발형",
};

export type SkillConfig = {
  id: ClassSkillId;
  name: string;
  category: SkillCategory;
  mechanic: SkillMechanic;
  enchantMode?: EnchantMode;
  owner: "ball";
  trigger: string;
  effect: string;
  description: string;
  evolution: string | null;
  color: string;
  unit: string;
  levels: [number, number, number];
  cooldown: [number, number, number];
  direction: "up" | "down";
  risk: number;
  ghost: boolean;
  ballCost: 0;
  ultimate: boolean;
};

export const SKILL_STORAGE_KEY = "echo-breaker-class-skills-v1";

export const SKILL_COLORS: Record<ClassSkillId, string> = {
  "warrior-smash": "#ff6b57",
  "warrior-shockwave": "#ff9f43",
  "warrior-execute": "#ff3f6c",
  "warrior-crush": "#ffd166",
  "warrior-guard": "#4ea8ff",
  "warrior-earthquake": "#e85d3f",
  "warrior-berserker": "#ff174f",
  "archer-rapid": "#72f1b8",
  "archer-pierce": "#4de2ff",
  "archer-ricochet": "#9cff57",
  "archer-focus": "#ffe45e",
  "archer-weakpoint": "#ff5c93",
  "archer-arrow-rain": "#37e6a1",
  "archer-infinite": "#b8ff5a",
  "mage-fireball": "#ff7043",
  "mage-lightning": "#a78bfa",
  "mage-freeze": "#65dcff",
  "mage-black-hole": "#7c4dff",
  "mage-mana-blast": "#d66bff",
  "mage-elemental-storm": "#c18cff",
  "mage-meteor": "#ff8a3d",
  "common-magnet": "#9aa3b2",
  "common-luck": "#9aa3b2",
  "common-wide": "#9aa3b2",
  "common-xp": "#9aa3b2",
  "common-combo": "#9aa3b2",
  "common-ball-size": "#9aa3b2",
  "common-skill-range": "#9aa3b2",
  "common-chain": "#9aa3b2",
  "common-damage": "#9aa3b2",
  "common-cooldown": "#9aa3b2",
};

const SKILL_MECHANICS: Record<ClassSkillId, SkillMechanic> = {
  "warrior-smash": "impact",
  "warrior-shockwave": "chain",
  "warrior-execute": "impact",
  "warrior-crush": "control",
  "warrior-guard": "defense",
  "warrior-earthquake": "ultimate",
  "warrior-berserker": "ultimate",
  "archer-rapid": "summon",
  "archer-pierce": "impact",
  "archer-ricochet": "chain",
  "archer-focus": "impact",
  "archer-weakpoint": "impact",
  "archer-arrow-rain": "ultimate",
  "archer-infinite": "ultimate",
  "mage-fireball": "control",
  "mage-lightning": "chain",
  "mage-freeze": "control",
  "mage-black-hole": "control",
  "mage-mana-blast": "control",
  "mage-elemental-storm": "ultimate",
  "mage-meteor": "ultimate",
  "common-magnet": "passive",
  "common-luck": "passive",
  "common-wide": "passive",
  "common-xp": "passive",
  "common-combo": "passive",
  "common-ball-size": "passive",
  "common-skill-range": "passive",
  "common-chain": "passive",
  "common-damage": "passive",
  "common-cooldown": "passive",
};

export const SKILL_COOLDOWNS: Record<ClassSkillId, [number, number, number]> = {
  "warrior-smash": [1.2, 1, 0.8],
  "warrior-shockwave": [2.8, 2.4, 2],
  "warrior-execute": [3, 2.5, 2],
  "warrior-crush": [2.4, 2, 1.6],
  "warrior-guard": [7, 6, 5],
  "warrior-earthquake": [4.5, 4, 3.5],
  "warrior-berserker": [0, 0, 0],
  "archer-rapid": [3.8, 3.4, 3],
  "archer-pierce": [2.5, 2.1, 1.7],
  "archer-ricochet": [2.2, 1.8, 1.4],
  "archer-focus": [1.8, 1.5, 1.2],
  "archer-weakpoint": [3, 2.5, 2],
  "archer-arrow-rain": [6, 5, 4],
  "archer-infinite": [8, 7, 5.5],
  "mage-fireball": [2.8, 2.3, 1.8],
  "mage-lightning": [2.5, 2, 1.5],
  "mage-freeze": [3, 2.5, 2],
  "mage-black-hole": [6, 5, 4],
  "mage-mana-blast": [3, 2.5, 2],
  "mage-elemental-storm": [7, 6, 5],
  "mage-meteor": [8, 7, 6],
  "common-magnet": [0, 0, 0],
  "common-luck": [0, 0, 0],
  "common-wide": [0, 0, 0],
  "common-xp": [0, 0, 0],
  "common-combo": [0, 0, 0],
  "common-ball-size": [0, 0, 0],
  "common-skill-range": [0, 0, 0],
  "common-chain": [0, 0, 0],
  "common-damage": [0, 0, 0],
  "common-cooldown": [0, 0, 0],
};

export const SKILL_EVOLUTIONS: Partial<Record<ClassSkillId, string>> = {
  "warrior-smash": "강타 충돌 지점 주변 2개 블럭에 1 피해를 줍니다.",
  "warrior-shockwave": "충격파로 블럭을 파괴하면 그 블럭에서 새로운 충격파가 이어집니다.",
  "warrior-execute": "처형 기준이 현재 체력 25%에서 40%로 증가합니다.",
  "warrior-crush": "특수 블럭 파괴 시 같은 특성의 모든 블럭에 1 피해를 줍니다.",
  "warrior-guard": "철벽 발동 시 CORE 방어막을 2개 충전합니다.",
  "archer-rapid": "연사 발동 시 서로 다른 각도의 임시 화살 2발을 생성합니다.",
  "archer-pierce": "공이 블럭을 관통할 때마다 다음 직접 피해가 1씩 증가합니다.",
  "archer-ricochet": "도탄으로 블럭을 파괴하면 남은 블럭을 향해 도탄이 계속 이어집니다.",
  "archer-focus": "같은 블럭을 재공격할 때 집중 추가 피해가 1.5배로 증폭됩니다.",
  "archer-weakpoint": "약점 사격의 직접 피해 배율이 3배에서 4배로 증가합니다.",
  "mage-fireball": "화상으로 블럭을 파괴하면 주변 블럭으로 화염이 다시 퍼집니다.",
  "mage-lightning": "번개로 블럭을 파괴하면 다음 블럭으로 연쇄 번개가 계속 이어집니다.",
  "mage-freeze": "빙결 표식을 파쇄하면 가까운 블럭 2개에 빙결 표식이 전이됩니다.",
  "mage-black-hole": "블랙홀의 지속 시간이 6초, 흡입 범위가 220px로 증가합니다.",
  "mage-mana-blast": "기능이 봉인된 블럭은 직접 공격으로 1의 추가 피해를 받습니다.",
};

SKILL_EVOLUTIONS["archer-rapid"] = "임시 화살이 보유한 다른 스킬과 연사·무한 화살을 사용할 수 있습니다. 생성 세대마다 화살 생성 쿨타임이 증가합니다.";

const skill = (
  id: ClassSkillId,
  name: string,
  category: SkillCategory,
  trigger: string,
  effect: string,
  description: string,
  levels: [number, number, number],
  unit: string,
  direction: "up" | "down" = "up",
  ultimate = false,
): SkillConfig => ({
  id,
  name,
  category,
  mechanic: SKILL_MECHANICS[id],
  owner: "ball",
  trigger: SKILL_COOLDOWNS[id][0] > 0 ? "공별 쿨타임 완료 후 블록 타격" : trigger,
  effect,
  description,
  evolution: SKILL_EVOLUTIONS[id] ?? null,
  color: SKILL_COLORS[id],
  unit,
  levels,
  cooldown: SKILL_COOLDOWNS[id],
  direction,
  risk: ultimate ? 30 : 10,
  ghost: false,
  ballCost: 0,
  ultimate,
});

const passiveSkill = (
  id: ClassSkillId,
  name: string,
  effect: string,
  description: string,
  levels: [number, number, number],
  unit: string,
): SkillConfig => ({
  id,
  name,
  category: "common",
  mechanic: SKILL_MECHANICS[id],
  owner: "ball",
  trigger: "획득 즉시 상시 적용",
  effect,
  description,
  evolution: null,
  color: SKILL_COLORS[id],
  unit,
  levels,
  cooldown: SKILL_COOLDOWNS[id],
  direction: "up",
  risk: 5,
  ghost: false,
  ballCost: 0,
  ultimate: false,
});

export const DEFAULT_SKILLS: SkillConfig[] = [
  skill("warrior-smash", "강타", "warrior", "블록 타격 시 상시 적용", "직접 피해 증가", "쿨타임이 준비된 직접 타격에 +1/+2/+3 피해를 추가합니다.", [1, 2, 3], "DMG"),
  skill("warrior-shockwave", "충격파", "warrior", "블록 타격 시 상시 적용", "주변 즉발 피해", "쿨타임이 준비된 타격 지점에서 주변 블록에 1/1/2 피해를 줍니다.", [1, 1, 2], "DMG"),
  skill("warrior-execute", "처형", "warrior", "블록 타격 시 상시 적용", "저체력 블록 즉시 파괴", "현재 체력이 25/32/40% 이하인 일반 블록을 즉시 파괴합니다.", [25, 32, 40], "%"),
  skill("warrior-crush", "분쇄", "warrior", "블록 타격 시 상시 적용", "가드 파괴·특수 블록 추가 피해", "가드를 제거하고 특수 블록에 +2/+3/+4 피해를 추가합니다.", [2, 3, 4], "DMG"),
  skill("warrior-guard", "철벽", "warrior", "블록 타격 시 자동 발동", "CORE 보호막 충전", "블록을 타격하면 6/5/4초마다 CORE 피해를 1회 막는 보호막을 얻습니다.", [6, 5, 4], "초", "down"),
  skill("warrior-earthquake", "대지 분쇄", "warrior", "블록 타격 시 상시 적용", "쿨타임 타격에 여진 발생", "쿨타임이 준비된 직접 타격에서 주변 블록에 여진 피해를 줍니다.", [1, 1, 2], "DMG", "up", true),
  skill("warrior-berserker", "광전사", "warrior", "획득 즉시 상시 적용", "공 공격력·속도·충돌 범위 폭증", "모든 공이 공격력 +3/+4/+5와 25% 추가 속도를 얻습니다.", [3, 4, 5], "DMG", "up", true),

  skill("archer-rapid", "연사", "archer", "블록 타격 시 자동 발동", "시간제 임시 화살 생성", "블록을 타격하면 임시 화살을 생성합니다. 화살은 4.75/5.5/6.25초 유지됩니다.", [4.75, 5.5, 6.25], "초"),
  skill("archer-pierce", "관통 화살", "archer", "블록 타격 시 상시 적용", "쿨타임마다 블록 관통", "쿨타임이 준비된 공이 블록 2/3/4개를 연속 관통합니다.", [2, 3, 4], "개"),
  skill("archer-ricochet", "도탄 화살", "archer", "블록 타격 시 상시 적용", "위험 특수 블록 우선 도탄", "쿨타임이 준비된 타격이 주변 블록 1/2/3개로 도탄됩니다.", [1, 2, 3], "개"),
  skill("archer-focus", "집중 사격", "archer", "블록 타격 시 상시 적용", "같은 블록 재공격 강화", "같은 블록을 다시 타격하면 +2/+3/+4 피해를 추가합니다.", [2, 3, 4], "DMG"),
  skill("archer-weakpoint", "약점 사격", "archer", "블록 타격 시 상시 적용", "직접 피해 증폭", "쿨타임이 준비된 직접 타격 피해가 2/2.5/3배로 증가합니다.", [2, 2.5, 3], "배"),
  skill("archer-arrow-rain", "화살비", "archer", "블록 타격 시 자동 발동", "보유 궁수 스킬을 복제한 일제 사격", "블록 타격 시 일정 간격으로 강화된 화살비를 발사합니다.", [8, 12, 16], "발", "up", true),
  skill("archer-infinite", "무한 탄창", "archer", "블록 타격 시 자동 발동", "임시 화살 3발 생성", "블록 타격 시 일정 간격으로 임시 화살 3발을 생성합니다.", [5, 6, 7], "초", "up", true),

  skill("mage-fireball", "화염구", "mage", "블록 타격 시 상시 적용", "주변 점화 · 회복 차단", "쿨타임이 준비된 타격이 주변 블록을 3/4/5초 동안 점화합니다.", [3, 4, 5], "초"),
  skill("mage-lightning", "연쇄 번개", "mage", "블록 타격 시 상시 적용", "주변 블록 연쇄 공격", "쿨타임이 준비된 타격에서 주변 블록 2/3/4개로 번개가 연결됩니다.", [2, 3, 4], "개"),
  skill("mage-freeze", "빙결 표식", "mage", "블록 타격 시 상시 적용", "회복·반사 봉인 · 다음 피격 강화", "타격한 블록을 빙결해 다음 피격에 +1/+2/+3 피해를 주고 특성을 봉인합니다.", [1, 2, 3], "DMG"),
  skill("mage-black-hole", "블랙홀", "mage", "블록 타격 시 자동 발동", "상단에 중력장 유지", "블록을 타격하면 상단의 블랙홀이 생성되거나 갱신됩니다.", [155, 170, 220], "px"),
  skill("mage-mana-blast", "마력 봉인", "mage", "블록 타격 시 상시 적용", "특수 블록 기능 일시 봉인", "타격한 특수 블록의 가드·회복·반사 기능을 4/6/8초 동안 봉인합니다.", [4, 6, 8], "초"),
  skill("mage-elemental-storm", "원소 폭풍", "mage", "블록 타격 시 자동 발동", "화염·번개·빙결 동시 적용", "블록 타격 시 일정 간격으로 화염·번개·빙결을 동시에 적용합니다.", [4, 5, 6], "개", "up", true),
  skill("mage-meteor", "메테오", "mage", "블록 타격 시 자동 발동", "상태이상 수에 비례한 연속 운석", "블록 타격 시 일정 간격으로 상태이상 수에 비례한 운석을 떨어뜨립니다.", [12, 16, 20], "DMG", "up", true),
  passiveSkill("common-magnet", "아이템 자석", "아이템 흡수 범위 증가", "패들 주변의 아이템을 끌어당기는 범위가 증가합니다.", [70, 120, 180], "px"),
  passiveSkill("common-luck", "행운", "아이템 추가 드롭 확률 증가", "아이템이 없는 브릭을 파괴했을 때 추가로 아이템이 생성될 확률이 증가합니다.", [8, 14, 20], "%"),
  passiveSkill("common-wide", "패들 확장", "패들 길이 증가", "플레이어 패들의 실제 충돌 범위와 표시 길이가 증가합니다.", [20, 35, 50], "px"),
  passiveSkill("common-xp", "코어 강화", "CORE 최대 체력 증가", "CORE 최대 체력과 현재 체력이 함께 증가합니다.", [1, 2, 3], "HP"),
  passiveSkill("common-combo", "콤보 증폭", "콤보당 점수 증가", "패들에 다시 닿기 전까지 쌓인 콤보 1회당 획득 점수 배율이 추가로 증가합니다.", [1, 2, 3], "%"),
  passiveSkill("common-ball-size", "공 거대화", "공 반경 증가", "공의 최종 반경이 9/10/11px로 증가합니다.", [1, 2, 3], "px"),
  passiveSkill("common-skill-range", "범위 증폭", "스킬 범위 증가", "스킬의 적용 범위가 10/20/30% 증가합니다.", [10, 20, 30], "%"),
  passiveSkill("common-chain", "연계 증폭", "스킬 연계 횟수 증가", "스킬의 연계 횟수가 1/2/3회 증가합니다.", [1, 2, 3], "회"),
  passiveSkill("common-damage", "공격 강화", "공 기본 피해 증가", "공의 기본 직접 피해가 2/3/4로 증가합니다.", [1, 2, 3], "DMG"),
  passiveSkill("common-cooldown", "재사용 가속", "스킬 쿨타임 감소", "모든 공의 스킬 쿨타임이 10/20/30% 감소합니다.", [10, 20, 30], "%"),
];

export const ULTIMATE_SKILL_IDS = new Set<ClassSkillId>(DEFAULT_SKILLS.filter((entry) => entry.ultimate).map((entry) => entry.id));
export const NORMAL_SKILLS = DEFAULT_SKILLS.filter((entry) => !entry.ultimate);
export const ULTIMATE_SKILLS = DEFAULT_SKILLS.filter((entry) => entry.ultimate);

export function normalizeSkillConfigs(saved: unknown): SkillConfig[] {
  const entries = Array.isArray(saved) ? saved : [];
  return DEFAULT_SKILLS.map((base) => {
    const savedSkill = entries.find((entry) => entry && typeof entry === "object" && "id" in entry && entry.id === base.id) as Partial<SkillConfig> | undefined;
    const values = Array.isArray(savedSkill?.levels) ? savedSkill.levels.map(Number) : [];
    const levels = values.length === 3 && values.every(Number.isFinite) ? values as [number, number, number] : base.levels;
    const legacyTimeFreeze = (base.id === "mage-freeze" || base.id === "mage-elemental-storm")
      && `${savedSkill?.effect ?? ""} ${savedSkill?.description ?? ""}`.match(/타이머|제한시간|시간.*정지/);
    const legacyDestructionTrigger = (base.id === "warrior-shockwave" || base.id === "mage-fireball")
      && `${savedSkill?.effect ?? ""} ${savedSkill?.description ?? ""}`.includes("파괴");
    const formulaDescription = /(?:LV|레벨에 따라|2\+LV)/.test(savedSkill?.description ?? "");
    const refreshedCommonSpec = (["common-ball-size", "common-skill-range", "common-chain", "common-damage", "common-cooldown"] as ClassSkillId[]).includes(base.id);
    const legacyReflectionTrigger = /패들|반사 횟수|충전/.test(savedSkill?.trigger ?? "");
    const legacyAlwaysOnTrigger = base.category !== "common" && /상시 적용|자동 발동/.test(savedSkill?.trigger ?? "");
    const migrated = base.id === "common-xp" ? base
      : legacyTimeFreeze || legacyDestructionTrigger || formulaDescription || refreshedCommonSpec || legacyReflectionTrigger || legacyAlwaysOnTrigger ? { ...savedSkill, name: base.name, trigger: base.trigger, effect: base.effect, description: base.description, levels: base.levels, unit: base.unit, direction: base.direction }
      : savedSkill;
    const savedCooldown = Array.isArray(savedSkill?.cooldown) && savedSkill.cooldown.length === 3 && savedSkill.cooldown.every((value) => Number.isFinite(Number(value)))
      ? savedSkill.cooldown.map(Number) as [number, number, number]
      : base.cooldown;
    return { ...base, ...migrated, id: base.id, category: base.category, mechanic: base.mechanic, color: base.color, owner: "ball", ballCost: 0, ultimate: base.ultimate, levels: base.id === "common-xp" || legacyReflectionTrigger ? base.levels : levels, cooldown: legacyReflectionTrigger ? base.cooldown : savedCooldown };
  });
}

export function skillConfigMap(skills: SkillConfig[]) {
  return Object.fromEntries(skills.map((entry) => [entry.id, entry])) as Partial<Record<UpgradeId, SkillConfig>>;
}

export function levelValue(level: number, values: [number, number, number]) {
  if (level <= 0) return 0;
  if (level <= 3) return values[level - 1];
  return Math.max(1, values[2] - (level - 3));
}
