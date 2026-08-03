import type { CSSProperties } from "react";
import type { Upgrade, UpgradeChoice } from "../../_types/game";
import type { SkillConfig, UpgradeId } from "../../skill-config";
import { SkillIconArt } from "../SkillIconArt";

const SKILL_VALUE_PARTS = /([+-]?\d+(?:\.\d+)?(?:\/[+-]?\d+(?:\.\d+)?)*(?:~[+-]?\d+(?:\.\d+)?)?(?:%|px|초|개|배|DMG|HP|회|발)?)/g;
const SKILL_VALUE_EXACT = /^[+-]?\d+(?:\.\d+)?(?:\/[+-]?\d+(?:\.\d+)?)*(?:~[+-]?\d+(?:\.\d+)?)?(?:%|px|초|개|배|DMG|HP|회|발)?$/;

export function SkillDescriptionText({ text }: { text: string }) {
  return (
    <>
      {text.split(SKILL_VALUE_PARTS).filter(Boolean).map((part, index) => (
        <span key={`${part}-${index}`} className={SKILL_VALUE_EXACT.test(part) ? "skill-value-accent" : undefined}>
          {part}
        </span>
      ))}
    </>
  );
}

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
  onSkip: () => void;
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
  onSkip,
}: SkillSelectionModalProps) {
  if (mode === "initialskills") {
    return (
      <div className="overlay level-overlay initial-skill-overlay">
        <p className="overlay-kicker">LOADOUT SETUP // 1 STARTING SKILL</p>
        <h2>시작 스킬 1개를 선택하세요</h2>
        <div className="upgrade-grid">
          {choices.map(({ upgrade }, index) => {
            const config = activeSkillMap[upgrade.id]!;
            return (
              <button
                key={upgrade.id}
                className={`upgrade-card class-${upgrade.category}`}
                onClick={() => onSelectInitialSkill(upgrade)}
                style={{ "--accent": upgrade.color } as CSSProperties}
              >
                <span className="upgrade-index">0{index + 1}</span>
                <span className="upgrade-tag">STARTING SKILL · {upgrade.tag}</span>
                <span className="upgrade-icon" aria-hidden="true"><SkillIconArt id={upgrade.id} /></span>
                <strong>{upgrade.name}</strong>
                <div className="upgrade-level-values">
                  <span className="next">
                    <small>START</small>
                    <b>{config.levels[0]}{config.unit}</b>
                    {config.cooldown[0] > 0 && <i>CD {config.cooldown[0]}s</i>}
                  </span>
                </div>
                <em>SELECT &amp; START</em>
                <div className="upgrade-tooltip" role="tooltip">
                  <span>발동 조건</span>
                  <b>{config.trigger}</b>
                  <p><SkillDescriptionText text={config.description} /></p>
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
      <p className="overlay-kicker">WAVE REWARD // SIGNAL UPGRADE</p>
      <h2>조합을 선택하세요</h2>
      <div className="upgrade-grid">
        <p className="upgrade-ball-summary">스킬은 공마다 독립 쿨타임으로 발동 · 재사용 가속은 모든 공의 쿨타임을 줄입니다.</p>
        {choices.map(({ upgrade }, index) => {
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
              <span className="upgrade-index">0{index + 1}</span>
              <span className="upgrade-tag">{upgrade.tag}</span>
              <span className="upgrade-icon" aria-hidden="true"><SkillIconArt id={upgrade.id} /></span>
              <strong>{upgrade.name}</strong>
              <div className="upgrade-level-values" aria-label={`${upgrade.name} 레벨별 수치`}>
                {config!.levels.map((value, levelIndex) => (
                  <span
                    key={levelIndex}
                    className={`${!evolutionChoice && currentLevel === levelIndex ? "next" : currentLevel > levelIndex ? "owned" : ""} ${evolutionChoice && levelIndex === 2 ? "evolution" : ""}`}
                  >
                    <small>LV{levelIndex + 1}</small>
                    <b>{value}{config!.unit}</b>
                    {config!.cooldown[levelIndex] > 0 && <i>CD {config!.cooldown[levelIndex]}s</i>}
                  </span>
                ))}
              </div>
              <em>{evolutionChoice ? "EVOLUTION" : currentLevel > 0 ? `LV ${currentLevel + 1} 획득` : "NEW SKILL"}</em>
              <div className="upgrade-tooltip" role="tooltip">
                <span>발동 조건</span>
                <b>{config!.trigger}</b>
                <p><SkillDescriptionText text={config!.description} /></p>
                {evolutionChoice && config!.evolution && (
                  <p className="upgrade-evolution">
                    <b>진화</b>
                    <SkillDescriptionText text={config!.evolution} />
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="upgrade-choice-actions">
        <button type="button" onClick={onReroll} disabled={rerollsLeft <= 0}>리롤 {rerollsLeft}/1</button>
        <button type="button" onClick={onSkip}>선택 건너뛰기</button>
      </div>
    </div>
  );
}
