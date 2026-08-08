import type { BalanceCandidate, BalanceCandidateConfig, BalanceCandidateSummary, BalanceExperimentRun, BalanceTuningConfig, BalanceTuningParameter } from "./balance-experiment";
import type { SkillConfig } from "./skill-config";

function cloneSkills(skills: SkillConfig[]) {
  return skills.map((skill) => ({
    ...skill,
    traits: [...skill.traits],
    traitConfigs: skill.traitConfigs.map((trait) => ({ ...trait, values: [...trait.values] as [number, number, number], damage: [...trait.damage] as [number, number, number] })),
    levels: [...skill.levels] as [number, number, number],
    skillDamage: [...skill.skillDamage] as [number, number, number],
    magicDamage: skill.magicDamage ? [...skill.magicDamage] as [number, number, number] : null,
    cooldown: [...skill.cooldown] as [number, number, number],
  }));
}

export function tuningParameterValue(skill: SkillConfig, parameter: BalanceTuningParameter, level: 1 | 2 | 3) {
  if (parameter === "levelValue") return skill.traitConfigs[0]?.values[level - 1] ?? skill.levels[level - 1];
  if (parameter === "magicDamage") return skill.traitConfigs[0]?.damageType === "magic" ? skill.traitConfigs[0].damage[level - 1] : skill.damageType === "magic" ? skill.skillDamage[level - 1] : 0;
  return skill.cooldown[level - 1];
}

export function tuningParameterStep(skill: SkillConfig, parameter: BalanceTuningParameter) {
  if (parameter === "magicDamage") return 1;
  if (parameter === "cooldown") return 0.1;
  if (["DMG", "개", "회", "HP"].includes(skill.unit)) return 1;
  if (skill.unit === "초") return 0.25;
  if (skill.unit === "배") return 0.25;
  if (skill.unit === "px") return 5;
  if (skill.unit === "%") return 1;
  return 0.1;
}

export function normalizeTuningParameterValue(skill: SkillConfig, parameter: BalanceTuningParameter, value: number) {
  const step = tuningParameterStep(skill, parameter);
  const minimum = parameter === "cooldown" ? 0.2 : 0;
  const stepped = Math.max(minimum, Math.round(value / step) * step);
  const precision = step >= 1 ? 1 : step >= 0.1 ? 100 : 1000;
  return Math.round(stepped * precision) / precision;
}

function setTuningParameter(skill: SkillConfig, parameter: BalanceTuningParameter, level: 1 | 2 | 3, value: number) {
  const index = level - 1;
  const nextValue = normalizeTuningParameterValue(skill, parameter, value);
  if (parameter === "levelValue") {
    skill.levels[index] = nextValue;
    if (skill.traitConfigs[0]) skill.traitConfigs[0].values[index] = nextValue;
  }
  else if (parameter === "magicDamage") {
    if (!skill.magicDamage) skill.magicDamage = [0, 0, 0];
    skill.magicDamage[index] = nextValue;
    skill.skillDamage[index] = nextValue;
    if (skill.traitConfigs[0]) skill.traitConfigs[0].damage[index] = nextValue;
  } else skill.cooldown[index] = nextValue;
  return nextValue;
}

function candidateFingerprint(config: BalanceCandidateConfig) {
  const input = JSON.stringify(config);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createEpochCandidates(options: {
  experimentId: string;
  epoch: number;
  baseConfig: BalanceCandidateConfig;
  tuning: BalanceTuningConfig;
  parentCandidateId?: string | null;
  createdAt?: number;
  excludedValues?: number[];
}) {
  const { experimentId, epoch, baseConfig, tuning, parentCandidateId = null } = options;
  const createdAt = options.createdAt ?? Date.now();
  const count = Math.max(3, Math.min(9, Math.round(tuning.candidatesPerEpoch)));
  const sourceSkill = baseConfig.skills.find((skill) => skill.id === tuning.skillId);
  if (!sourceSkill) throw new Error(`Unknown tuning skill: ${tuning.skillId}`);
  if (tuning.parameter === "magicDamage" && !sourceSkill.magicDamage) throw new Error(`${tuning.skillId} does not own magic damage`);
  if (tuning.parameter === "cooldown" && sourceSkill.cooldown.every((value) => value <= 0)) throw new Error(`${tuning.skillId} does not own a cooldown`);
  const step = tuningParameterStep(sourceSkill, tuning.parameter);
  const baseValue = normalizeTuningParameterValue(sourceSkill, tuning.parameter, tuningParameterValue(sourceSkill, tuning.parameter, tuning.level));
  const valueKey = (value: number) => normalizeTuningParameterValue(sourceSkill, tuning.parameter, value).toFixed(6);
  const excluded = new Set((options.excludedValues ?? []).map(valueKey));
  const values: number[] = [];
  for (let radius = 0; values.length < count; radius += 1) {
    const offsets = radius === 0 ? [0] : [-radius, radius];
    for (const offset of offsets) {
      const value = normalizeTuningParameterValue(sourceSkill, tuning.parameter, baseValue + offset * step);
      const key = valueKey(value);
      if (excluded.has(key) || values.some((entry) => valueKey(entry) === key)) continue;
      values.push(value);
      if (values.length >= count) break;
    }
  }
  values.sort((a, b) => a - b);
  return values.map((candidateValue, index): BalanceCandidate => {
    const skills = cloneSkills(baseConfig.skills);
    const skill = skills.find((entry) => entry.id === tuning.skillId)!;
    const value = setTuningParameter(skill, tuning.parameter, tuning.level, candidateValue);
    const config: BalanceCandidateConfig = {
      skills,
      balance: { ...baseConfig.balance },
      benchmark: { ...baseConfig.benchmark },
      waves: baseConfig.waves.map((wave) => ({ ...wave, pattern: [...wave.pattern], blocks: wave.blocks?.map((block) => ({ ...block })) })),
    };
    const configHash = candidateFingerprint(config);
    return {
      id: `${experimentId}-e${epoch}-c${index + 1}-${configHash}`,
      experimentId,
      epoch,
      label: `${tuning.parameter} LV${tuning.level} = ${value}`,
      parentCandidateId,
      configHash,
      config,
      score: null,
      status: "queued",
      createdAt,
      updatedAt: createdAt,
    };
  });
}

export function scoreBalanceCandidate(summary: BalanceCandidateSummary, tuning: BalanceTuningConfig) {
  const completionError = Math.abs(summary.completionRate - tuning.targetCompletionRate) * 2;
  const coreError = Math.abs(summary.averageCoreHp - tuning.targetCoreHp) * 6;
  const timeoutPenalty = summary.timeoutRate * 1.5;
  const incompletePenalty = Math.max(0, 15 - summary.averageWave) * 2;
  return completionError + coreError + timeoutPenalty + incompletePenalty;
}

export function pendingCandidateSeeds(candidates: BalanceCandidate[], seeds: number[], existingRuns: BalanceExperimentRun[]) {
  const completed = new Set(existingRuns.map((run) => `${run.candidateId}:${run.seed}`));
  return candidates.flatMap((candidate) => seeds
    .filter((seed) => !completed.has(`${candidate.id}:${seed}`))
    .map((seed) => ({ candidate, seed })));
}
