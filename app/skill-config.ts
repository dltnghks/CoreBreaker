export type HeroClass = "warrior" | "archer" | "mage" | "common";
export type SkillCategory = HeroClass;
export type EnchantMode = "persistent" | "charge" | "single";

export type ClassSkillId =
  | "warrior-smash" | "warrior-shockwave" | "warrior-execute" | "warrior-crush" | "warrior-guard"
  | "warrior-earthquake" | "warrior-berserker"
  | "archer-rapid" | "archer-pierce" | "archer-ricochet" | "archer-focus" | "archer-weakpoint"
  | "archer-arrow-rain" | "archer-infinite"
  | "mage-fireball" | "mage-lightning" | "mage-freeze" | "mage-black-hole" | "mage-mana-blast"
  | "mage-elemental-storm" | "mage-meteor"
  | "common-magnet" | "common-luck" | "common-wide" | "common-xp" | "common-combo";

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
  enchantMode?: EnchantMode;
  owner: "paddle";
  trigger: string;
  effect: string;
  description: string;
  color: string;
  unit: string;
  levels: [number, number, number];
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
  "common-magnet": "#5ce8e0",
  "common-luck": "#ffd166",
  "common-wide": "#7dd3fc",
  "common-xp": "#8afff5",
  "common-combo": "#f0abfc",
};

const skill = (
  id: ClassSkillId,
  name: string,
  category: SkillCategory,
  trigger: string,
  effect: string,
  description: string,
  levels: [number, number, number],
  ultimate = false,
): SkillConfig => ({
  id,
  name,
  category,
  owner: "paddle",
  trigger,
  effect,
  description,
  color: SKILL_COLORS[id],
  unit: "회",
  levels,
  direction: "down",
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
  owner: "paddle",
  trigger: "획득 즉시 상시 적용",
  effect,
  description,
  color: SKILL_COLORS[id],
  unit,
  levels,
  direction: "up",
  risk: 5,
  ghost: false,
  ballCost: 0,
  ultimate: false,
});

export const DEFAULT_SKILLS: SkillConfig[] = [
  skill("warrior-smash", "강타", "warrior", "패들 반사 횟수 충전", "다음 공격 피해 증가", "충전이 완료된 공의 다음 직접 공격이 LV만큼 추가 피해를 줍니다.", [3, 2, 1]),
  skill("warrior-shockwave", "충격파", "warrior", "패들 반사 횟수 충전", "블럭 파괴 시 주변 폭발", "충전된 공이 블럭을 파괴하면 주변 블럭에 충격파 피해를 줍니다.", [6, 5, 4]),
  skill("warrior-execute", "처형", "warrior", "패들 반사 횟수 충전", "저체력 블럭 즉시 파괴", "충전된 공이 현재 체력 25% 이하인 일반 블럭을 즉시 파괴합니다.", [7, 5, 3]),
  skill("warrior-crush", "분쇄", "warrior", "패들 반사 횟수 충전", "가드·쉴드 추가 피해", "충전된 공은 가드를 파괴하고 쉴드 블럭에 LV+1의 피해를 줍니다.", [5, 4, 3]),
  skill("warrior-guard", "철벽", "warrior", "패들 반사 횟수 충전", "CORE LINE 방어막 충전", "충전 완료 시 CORE LINE 피해를 한 번 막는 방어막을 얻습니다.", [14, 11, 8]),
  skill("warrior-earthquake", "대지 분쇄", "warrior", "패들 반사 횟수 충전", "필드 전체 충격파", "모든 일반 블럭에 1 피해를 주고 강한 화면 충격을 발생시킵니다.", [18, 14, 10], true),
  skill("warrior-berserker", "광전사", "warrior", "패들 반사 횟수 충전", "공 공격력·속도 폭증", "충전된 공이 기본 공격력 +3과 25% 추가 속도를 얻습니다.", [15, 12, 9], true),

  skill("archer-rapid", "연사", "archer", "패들 반사 횟수 충전", "임시 화살 1발 생성", "충전 완료 시 현재 공을 복제한 임시 화살을 발사합니다. 화살은 일정 횟수 적중 후 사라집니다.", [8, 6, 4]),
  skill("archer-pierce", "관통 화살", "archer", "패들 반사 횟수 충전", "다음 공이 여러 블럭 관통", "충전된 공이 LV+1개의 블럭을 관통합니다.", [6, 5, 4]),
  skill("archer-ricochet", "도탄 화살", "archer", "패들 반사 횟수 충전", "주변 블럭으로 도탄", "충전된 공이 적중하면 주변 블럭 LV개를 자동으로 추가 공격합니다.", [5, 4, 3]),
  skill("archer-focus", "집중 사격", "archer", "패들 반사 횟수 충전", "같은 블럭 재공격 강화", "충전된 공이 이미 같은 패들에 맞은 블럭을 공격하면 LV+1의 추가 피해를 줍니다.", [4, 3, 2]),
  skill("archer-weakpoint", "약점 사격", "archer", "패들 반사 횟수 충전", "다음 공격 확정 치명타", "충전된 공의 다음 직접 공격 피해가 3배가 됩니다.", [8, 6, 4]),
  skill("archer-arrow-rain", "화살비", "archer", "패들 반사 횟수 충전", "다수 블럭 동시 공격", "무작위 일반 블럭 8+LV×4개에 화살을 떨어뜨립니다.", [20, 16, 12], true),
  skill("archer-infinite", "무한 탄창", "archer", "패들 반사 횟수 충전", "임시 화살 3발 생성", "현재 공의 특성을 복제한 임시 화살 3발을 동시에 발사합니다.", [16, 12, 8], true),

  skill("mage-fireball", "화염구", "mage", "패들 반사 횟수 충전", "다음 파괴 시 화염 폭발", "충전된 공이 블럭을 파괴하면 주변에 화염 폭발 피해를 줍니다.", [6, 5, 4]),
  skill("mage-lightning", "연쇄 번개", "mage", "패들 반사 횟수 충전", "주변 블럭 연쇄 공격", "충전된 공이 적중한 블럭에서 주변 블럭 LV+1개로 번개가 연결됩니다.", [7, 5, 3]),
  skill("mage-freeze", "빙결", "mage", "패들 반사 횟수 충전", "블럭 하강 일시 정지", "충전 완료 시 블럭 하강 타이머를 2+LV초 동안 정지합니다.", [12, 9, 6]),
  skill("mage-black-hole", "블랙홀", "mage", "패들 반사 횟수 충전", "상단에 중력장 생성", "충전 완료 시 맵 상단에 공을 끌어당기는 블랙홀을 생성합니다.", [14, 11, 8]),
  skill("mage-mana-blast", "마력 폭발", "mage", "패들 반사 횟수 충전", "가까운 블럭 광역 피해", "충전 완료 시 공 주변의 가까운 블럭 3+LV개에 마력 피해를 줍니다.", [10, 8, 6]),
  skill("mage-elemental-storm", "원소 폭풍", "mage", "패들 반사 횟수 충전", "화염·번개·빙결 동시 충전", "현재 공에 화염과 번개를 충전하고 블럭 하강을 즉시 정지합니다.", [18, 14, 10], true),
  skill("mage-meteor", "메테오", "mage", "패들 반사 횟수 충전", "최고 체력 블럭 대형 폭발", "가장 체력이 높은 블럭에 8+LV×4 피해와 대형 폭발을 가합니다.", [20, 16, 12], true),
  passiveSkill("common-magnet", "아이템 자석", "아이템 흡수 범위 증가", "패들 주변의 아이템을 끌어당기는 범위가 증가합니다.", [70, 120, 180], "px"),
  passiveSkill("common-luck", "행운", "아이템 추가 드롭 확률 증가", "아이템이 없는 브릭을 파괴했을 때 추가로 아이템이 생성될 확률이 증가합니다.", [8, 14, 20], "%"),
  passiveSkill("common-wide", "패들 확장", "패들 길이 증가", "플레이어 패들의 실제 충돌 범위와 표시 길이가 증가합니다.", [20, 35, 50], "px"),
  passiveSkill("common-xp", "학습 가속", "브릭 파괴 경험치 증가", "브릭을 파괴할 때 즉시 획득하는 기본 경험치가 추가로 증가합니다.", [1, 2, 3], " XP"),
  passiveSkill("common-combo", "콤보 안정화", "콤보 유지 시간 증가", "브릭을 파괴한 뒤 콤보가 끊기기까지의 시간이 증가합니다.", [0.6, 1.2, 2], "초"),
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
    return { ...base, ...savedSkill, id: base.id, category: base.category, color: base.color, owner: "paddle", ballCost: 0, ultimate: base.ultimate, levels };
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
