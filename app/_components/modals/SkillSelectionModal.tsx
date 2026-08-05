import type { CSSProperties } from "react";
import type { Upgrade, UpgradeChoice } from "../../_types/game";
import { SKILL_VALUE_UNIT_SUFFIX, type SkillConfig, type UpgradeId } from "../../skill-config";
import { SkillIconArt } from "../SkillIconArt";

function skillPickCount(upgrades: UpgradeId[], id: UpgradeId) {
  if (!Array.isArray(upgrades)) return 0;
  return upgrades.filter((upgrade) => upgrade === id).length;
}

export type SkillSelectionModalProps = {
  mode: "initialskills" | "levelup";
  choices: UpgradeChoice[];
  activeSkillMap: Partial<Record<UpgradeId, SkillConfig>>;
  userUpgrades: UpgradeId[];
  rerollsLeft: number;
  onSelectInitialSkill: (upgrade: Upgrade) => void;
  onApplyUpgrade: (upgrade: Upgrade, ballCost: number) => void;
  onReroll: () => void;
};

export function SkillSelectionModal({
  mode,
  choices,
  activeSkillMap,
  userUpgrades,
  rerollsLeft,
  onSelectInitialSkill,
  onApplyUpgrade,
  onReroll,
}: SkillSelectionModalProps) {
  if (mode === "initialskills") {
    return (
      <div className="overlay level-overlay initial-skill-overlay">
        <div className="upgrade-grid">
          {choices.map(({ upgrade }) => {
            const config = activeSkillMap[upgrade.id]!;
            return (
              <button
                key={upgrade.id}
                className={`upgrade-card class-${upgrade.category}`}
                onClick={() => onSelectInitialSkill(upgrade)}
                style={{ "--accent": upgrade.color } as CSSProperties}
              >
                <div className="upgrade-card-heading">
                  <span className="upgrade-icon" aria-hidden="true"><SkillIconArt id={upgrade.id} /></span>
                  <strong>{upgrade.name}</strong>
                </div>
                <div className="upgrade-level-values">
                  <span className="next">
                    <small>START</small>
                    <b>{config.levels[0]}{SKILL_VALUE_UNIT_SUFFIX[config.unit]}</b>
                    {config.cooldown[0] > 0 && <i>CD {config.cooldown[0]}s</i>}
                  </span>
                </div>
                <div className="upgrade-tooltip" role="tooltip">
                  <span>발동 조건</span>
                  <b>{config.trigger}</b>
                  <p>{config.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="overlay level-overlay">
      <div className="upgrade-grid">
        {choices.map(({ upgrade }) => {
          const pickCount = skillPickCount(userUpgrades, upgrade.id);
          const currentLevel = Math.min(3, pickCount);
          const config = activeSkillMap[upgrade.id];
          const evolutionChoice = pickCount === 3 && Boolean(config?.evolution);
          return (
            <button
              key={upgrade.id}
              className={`upgrade-card class-${upgrade.category}${evolutionChoice ? " evolution-card" : ""}`}
              onClick={() => onApplyUpgrade(upgrade, 0)}
              aria-label={`${upgrade.name}, ${evolutionChoice ? "진화" : "영구 적용 스킬"}`}
              style={{ "--accent": upgrade.color } as CSSProperties}
            >
              <div className="upgrade-card-heading">
                <span className="upgrade-icon" aria-hidden="true"><SkillIconArt id={upgrade.id} /></span>
                <strong>{upgrade.name}</strong>
              </div>
              <div className="upgrade-level-values" aria-label={`${upgrade.name} 레벨별 수치`}>
                {config!.levels.map((value, levelIndex) => (
                  <span
                    key={levelIndex}
                    className={`${!evolutionChoice && currentLevel === levelIndex ? "next" : currentLevel > levelIndex ? "owned" : ""} ${evolutionChoice && levelIndex === 2 ? "evolution" : ""}`}
                  >
                    <small>LV{levelIndex + 1}</small>
                    <b>{value}{SKILL_VALUE_UNIT_SUFFIX[config!.unit]}</b>
                    {config!.cooldown[levelIndex] > 0 && <i>CD {config!.cooldown[levelIndex]}s</i>}
                  </span>
                ))}
              </div>
              <div className="upgrade-tooltip" role="tooltip">
                <span>발동 조건</span>
                <b>{config!.trigger}</b>
                <p>{config!.description}</p>
                {evolutionChoice && config!.evolution && <p className="upgrade-evolution">{config!.evolution}</p>}
              </div>
            </button>
          );
        })}
      </div>
      <div className="upgrade-choice-actions">
        <button type="button" onClick={onReroll} disabled={rerollsLeft <= 0}>리롤 {rerollsLeft}/1</button>
      </div>
    </div>
  );
}
