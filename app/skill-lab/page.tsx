"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { DEFAULT_SKILLS, normalizeSkillConfigs, SKILL_APPLICATION_LABELS, SKILL_MECHANIC_LABELS, SKILL_STORAGE_KEY, SKILL_TRAIT_LABELS, SKILL_TRIGGER_LABELS, type CustomSkillId, type SkillApplicationScope, type SkillCategory, type SkillConfig, type SkillDamageType, type SkillMechanic, type SkillTrait, type SkillTraitConfig, type SkillTriggerType } from "../skill-config";
import styles from "./skill-lab.module.css";
import { appHref } from "../site-path";

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  warrior: "전사",
  archer: "궁수",
  mage: "법사",
  common: "공용",
};

const CATEGORIES: SkillCategory[] = ["warrior", "archer", "mage", "common"];
const CATEGORY_ICONS: Record<SkillCategory, string> = { warrior: "◆", archer: "➵", mage: "✧", common: "◇" };
const MECHANICS = Object.keys(SKILL_MECHANIC_LABELS) as SkillMechanic[];
const TRIGGERS = Object.keys(SKILL_TRIGGER_LABELS) as SkillTriggerType[];
const TRAITS = Object.keys(SKILL_TRAIT_LABELS) as SkillTrait[];
const DAMAGE_TRAITS = new Set<SkillTrait>(["direct-damage", "smash", "crush", "focus", "mana-seal", "splash", "chain", "burn", "freeze", "black-hole"]);
const CATEGORY_COLORS: Record<SkillCategory, string> = {
  warrior: "#ff6b57",
  archer: "#72f1b8",
  mage: "#9a8cff",
  common: "#9aa3b2",
};

const categoryStyle = (category: SkillCategory) => ({ "--category-color": CATEGORY_COLORS[category] }) as CSSProperties;
const skillStyle = (skill: SkillConfig) => ({ "--category-color": skill.color }) as CSSProperties;

const SKILL_VALUE_PARTS = /([+-]?\d+(?:\.\d+)?(?:\/[+-]?\d+(?:\.\d+)?)*(?:~[+-]?\d+(?:\.\d+)?)?(?:%|px|초|개|배|DMG|HP|회|발)?)/g;
const SKILL_VALUE_EXACT = /^[+-]?\d+(?:\.\d+)?(?:\/[+-]?\d+(?:\.\d+)?)*(?:~[+-]?\d+(?:\.\d+)?)?(?:%|px|초|개|배|DMG|HP|회|발)?$/;

function SkillDescriptionText({ text }: { text: string }) {
  return <>{text.split(SKILL_VALUE_PARTS).filter(Boolean).map((part, index) => (
    <span key={`${part}-${index}`} className={SKILL_VALUE_EXACT.test(part) ? styles.valueAccent : undefined}>{part}</span>
  ))}</>;
}

const SYNERGIES: Array<{ ids: string[]; label: string }> = [
  { ids: ["warrior-smash", "warrior-shockwave"], label: "강타로 파괴한 블록에서 충격파 발생" },
  { ids: ["warrior-crush", "warrior-execute"], label: "가드와 특수 블록을 분쇄한 뒤 저체력 블록 처형" },
  { ids: ["archer-rapid", "archer-ricochet"], label: "늘어난 화살이 주변 블록으로 연속 도탄" },
  { ids: ["archer-pierce", "archer-weakpoint"], label: "치명타 화살이 여러 블록을 관통" },
  { ids: ["mage-fireball", "mage-lightning"], label: "화염 폭발과 연쇄 번개가 동시에 확산" },
  { ids: ["mage-freeze", "mage-black-hole"], label: "하강을 멈춘 동안 공을 상단에 집중" },
];

export default function SkillLab() {
  const [skills, setSkills] = useState<SkillConfig[]>(DEFAULT_SKILLS);
  const [selectedId, setSelectedId] = useState(DEFAULT_SKILLS[0].id);
  const [filter, setFilter] = useState<SkillCategory | "all">("all");
  const [mechanicFilter, setMechanicFilter] = useState<SkillMechanic | "all">("all");
  const [build, setBuild] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = localStorage.getItem(SKILL_STORAGE_KEY);
        if (saved) setSkills(normalizeSkillConfigs(JSON.parse(saved)));
      } catch {
        setSkills(DEFAULT_SKILLS);
      }
    });
    return () => { active = false; };
  }, []);

  const visibleSkills = skills.filter((skill) => (showArchived || skill.enabled) && (filter === "all" || skill.category === filter) && (mechanicFilter === "all" || skill.mechanic === mechanicFilter));
  const effectiveSelectedId = visibleSkills.some((skill) => skill.id === selectedId) ? selectedId : visibleSkills[0]?.id ?? selectedId;
  const selected = skills.find((skill) => skill.id === effectiveSelectedId) ?? skills[0];
  const buildSkills = skills.filter((skill) => build[skill.id]);

  const warnings = useMemo(() => {
    const issues: string[] = [];
    skills.forEach((skill) => {
      skill.traitConfigs.forEach((trait) => {
        const [a, b, c] = trait.values;
        const monotonic = (a <= b && b <= c) || (a >= b && b >= c);
        if (!monotonic) issues.push(`${skill.name} · ${SKILL_TRAIT_LABELS[trait.kind]}: 레벨 성장 방향이 일정하지 않습니다.`);
        const firstStep = Math.abs(b - a);
        const secondStep = Math.abs(c - b);
        if (firstStep > 0 && secondStep / firstStep >= 3) issues.push(`${skill.name} · ${SKILL_TRAIT_LABELS[trait.kind]}: LV3 상승폭이 이전 단계보다 과도합니다.`);
      });
      if (skill.triggerType === "brick-break" && !skill.traits.some((trait) => ["splash", "chain", "pierce", "rapid-fire", "barrier", "black-hole"].includes(trait))) issues.push(`${skill.name}: 블록 파괴 후 적용할 수 있는 특성이 없습니다.`);
    });
    return issues;
  }, [skills]);

  const activeSynergies = SYNERGIES.filter((synergy) => synergy.ids.every((id) => build[id]));

  const updateSelected = (patch: Partial<SkillConfig>) => {
    setSkills((current) => current.map((skill) => skill.id === selected.id ? { ...skill, ...patch } : skill));
  };

  const updateCooldown = (index: number, value: number) => {
    const cooldown = [...selected.cooldown] as [number, number, number];
    cooldown[index] = Number.isFinite(value) ? Math.max(0, value) : 0;
    updateSelected({ cooldown });
  };

  const updateTraitConfig = (kind: SkillTrait, updater: (trait: SkillTraitConfig) => SkillTraitConfig) => {
    const traitConfigs = selected.traitConfigs.map((trait) => trait.kind === kind ? updater(trait) : trait);
    const primary = traitConfigs[0];
    updateSelected({
      traitConfigs,
      ...(primary ? {
        levels: [...primary.values] as [number, number, number],
        unit: primary.unit,
        skillDamage: [...primary.damage] as [number, number, number],
        damageType: primary.damageType,
        magicDamage: primary.damageType === "magic" ? [...primary.damage] as [number, number, number] : null,
      } : {}),
    });
  };

  const updateTraitValue = (kind: SkillTrait, index: number, value: number) => updateTraitConfig(kind, (trait) => {
    const values = [...trait.values] as [number, number, number];
    values[index] = Number.isFinite(value) ? value : 0;
    return { ...trait, values };
  });

  const updateTraitDamage = (kind: SkillTrait, index: number, value: number) => updateTraitConfig(kind, (trait) => {
    const damage = [...trait.damage] as [number, number, number];
    damage[index] = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    return { ...trait, damage };
  });

  const toggleTrait = (trait: SkillTrait) => {
    const removing = selected.traits.includes(trait);
    const traits = removing ? selected.traits.filter((entry) => entry !== trait) : [...selected.traits, trait];
    const normalizedTraits = traits.length ? traits : [selected.category === "common" ? "passive" : "direct-damage"];
    const traitConfigs = normalizedTraits.map((kind) => selected.traitConfigs.find((entry) => entry.kind === kind) ?? {
      kind,
      values: [1, 2, 3],
      unit: kind === "passive" ? "%" : "DMG",
      damageType: "magic" as const,
      damage: DAMAGE_TRAITS.has(kind) ? [1, 2, 3] : [0, 0, 0],
    });
    const primary = traitConfigs[0];
    updateSelected({ traits: normalizedTraits, traitConfigs, levels: [...primary.values], unit: primary.unit, skillDamage: [...primary.damage], damageType: primary.damageType, magicDamage: primary.damageType === "magic" ? [...primary.damage] : null });
  };

  const changeCategory = (category: SkillCategory) => {
    const traits: SkillTrait[] = category === "common" ? ["passive"] : selected.traits.includes("passive") ? ["direct-damage"] : selected.traits;
    const traitConfigs = traits.map((kind) => selected.traitConfigs.find((entry) => entry.kind === kind) ?? { kind, values: [1, 2, 3], unit: kind === "passive" ? "%" : "DMG", damageType: "magic" as const, damage: kind === "passive" ? [0, 0, 0] : [1, 2, 3] });
    const primary = traitConfigs[0];
    updateSelected({ category, color: CATEGORY_COLORS[category], triggerType: category === "common" ? "passive" : selected.triggerType === "passive" ? "brick-hit" : selected.triggerType, traits, traitConfigs, levels: [...primary.values], unit: primary.unit, skillDamage: [...primary.damage], damageType: primary.damageType, magicDamage: primary.damageType === "magic" ? [...primary.damage] : null });
  };

  const addSkill = (source?: SkillConfig) => {
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` as CustomSkillId;
    const category = source?.category ?? (filter === "all" ? "mage" : filter);
    const next: SkillConfig = {
      ...(source ?? DEFAULT_SKILLS.find((skill) => skill.category === category) ?? DEFAULT_SKILLS[0]),
      id,
      enabled: true,
      builtIn: false,
      name: source ? `${source.name} 복제` : "새 스킬",
      category,
      mechanic: source?.mechanic ?? "impact",
      color: source?.color ?? CATEGORY_COLORS[category],
      evolution: source?.evolution ?? null,
      trigger: source?.trigger ?? SKILL_TRIGGER_LABELS["brick-hit"],
      triggerType: source?.triggerType ?? "brick-hit",
      effect: source?.effect ?? "선택한 피해와 특성을 적용",
      description: source?.description ?? "블록 타격 시 선택한 피해와 특성을 적용합니다.",
      unit: source?.unit ?? "DMG",
      direction: source?.direction ?? "up",
      levels: [...(source?.levels ?? [1, 2, 3])] as [number, number, number],
      skillDamage: [...(source?.skillDamage ?? [1, 2, 3])] as [number, number, number],
      magicDamage: source?.damageType === "physical" ? null : [...(source?.skillDamage ?? [1, 2, 3])] as [number, number, number],
      cooldown: [...(source?.cooldown ?? [2, 1.8, 1.6])] as [number, number, number],
      traits: [...(source?.traits ?? ["direct-damage"])],
      traitConfigs: (source?.traitConfigs ?? [{ kind: "direct-damage", values: [1, 2, 3], unit: "DMG", damageType: "magic", damage: [1, 2, 3] }]).map((trait) => ({ ...trait, values: [...trait.values], damage: [...trait.damage] })),
    };
    setSkills((current) => [...current, next]);
    setSelectedId(id);
    setShowArchived(false);
    setMessage(source ? "스킬을 복제했습니다. 저장하면 게임에 적용됩니다." : "새 사용자 스킬을 추가했습니다.");
  };

  const archiveSelected = () => {
    if (selected.enabled) setShowArchived(true);
    updateSelected({ enabled: !selected.enabled });
    setMessage(selected.enabled ? "스킬을 보관했습니다. 보상 목록에서 제외됩니다." : "스킬을 복원했습니다.");
  };

  const deleteSelected = () => {
    if (selected.builtIn) return;
    setSkills((current) => current.filter((skill) => skill.id !== selected.id));
    setSelectedId(DEFAULT_SKILLS[0].id);
    setMessage("사용자 스킬을 현재 설정에서 삭제했습니다. 기존 실험 기록은 유지됩니다.");
  };

  const addToBuild = (skill: SkillConfig) => {
    setBuild((current) => current[skill.id]
      ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== skill.id))
      : { ...current, [skill.id]: 1 });
    setMessage("");
  };

  const saveDraft = () => {
    localStorage.setItem(SKILL_STORAGE_KEY, JSON.stringify(skills));
    setMessage("저장 완료. 게임의 다음 플레이부터 이름·설명·수치가 적용됩니다.");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ skills, build }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "core-breaker-skills.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div><p>INTERNAL BALANCE TOOL</p><h1>SKILL LAB</h1></div>
        <nav><a href={appHref("/")}>← GAME</a><a href={appHref("/benchmark")}>BENCHMARK</a><button onClick={() => addSkill()}>ADD SKILL</button><button onClick={saveDraft}>SAVE & APPLY</button><button onClick={exportJson}>EXPORT JSON</button></nav>
      </header>

      <section className={styles.toolbar} aria-label="스킬 카테고리 필터">
        {(["all", ...CATEGORIES] as const).map((category) => (
          <button key={category} className={filter === category ? styles.active : ""} style={category === "all" ? undefined : categoryStyle(category)} onClick={() => setFilter(category)}>
            {category === "all" ? "ALL" : CATEGORY_LABELS[category]}
          </button>
        ))}
        <button className={showArchived ? styles.active : ""} onClick={() => setShowArchived((current) => !current)}>{showArchived ? "HIDE ARCHIVED" : "SHOW ARCHIVED"}</button>
        <span>{skills.filter((skill) => skill.enabled).length} ACTIVE · {skills.filter((skill) => !skill.enabled).length} ARCHIVED · {warnings.length} WARNINGS</span>
      </section>

      <section className={styles.toolbar} aria-label="스킬 작동 방식 필터">
        {(["all", ...MECHANICS] as const).map((mechanic) => (
          <button key={mechanic} className={mechanicFilter === mechanic ? styles.active : ""} onClick={() => setMechanicFilter(mechanic)}>
            {mechanic === "all" ? "모든 작동 방식" : SKILL_MECHANIC_LABELS[mechanic]}
          </button>
        ))}
        <span>{visibleSkills.length} VISIBLE</span>
      </section>

      <section className={styles.workspace}>
        <div className={styles.catalog}>
          {visibleSkills.map((skill) => (
            <button key={skill.id} data-category={skill.category} data-enabled={skill.enabled} className={`${styles.skillCard} ${selected.id === skill.id ? styles.selected : ""}`} style={skillStyle(skill)} onClick={() => setSelectedId(skill.id)}>
              <i className={styles.skillIcon} aria-hidden="true">{CATEGORY_ICONS[skill.category]}</i>
              <span>{CATEGORY_LABELS[skill.category]} · {SKILL_MECHANIC_LABELS[skill.mechanic]} · {skill.builtIn ? "기본" : "사용자"}{skill.enabled ? "" : " · 보관됨"}</span><strong>{skill.name}</strong><small><b>발동</b> {SKILL_TRIGGER_LABELS[skill.triggerType]}</small>
              <p className={styles.description}><SkillDescriptionText text={skill.description} /></p>
              <em>{skill.traitConfigs.map((trait) => `${SKILL_TRAIT_LABELS[trait.kind]} ${trait.values.join("/")}${trait.unit}${DAMAGE_TRAITS.has(trait.kind) ? ` · ${trait.damageType.toUpperCase()} ${trait.damage.join("/")}` : ""}`).join(" · ")}{skill.cooldown.some((value) => value > 0) ? ` · CD ${skill.cooldown.join("/")}s` : ""}</em>
            </button>
          ))}
        </div>

        <aside className={styles.editor} style={skillStyle(selected)}>
          <div className={styles.editorHeading}><span>{CATEGORY_LABELS[selected.category]} · {SKILL_MECHANIC_LABELS[selected.mechanic]} · NORMAL</span><strong>{selected.name}</strong></div>
          <div className={styles.editorActions}><button type="button" onClick={() => addSkill(selected)}>DUPLICATE</button><button type="button" onClick={archiveSelected}>{selected.enabled ? "ARCHIVE" : "RESTORE"}</button>{!selected.builtIn && <button type="button" className={styles.danger} onClick={deleteSelected}>DELETE</button>}</div>
          <label>이름<input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} /></label>
          <div className={styles.editorPair}>
            <label>클래스<select value={selected.category} disabled={selected.builtIn} onChange={(event) => changeCategory(event.target.value as SkillCategory)}>{CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label>
            <label>작동 방식<select value={selected.mechanic} disabled={selected.builtIn} onChange={(event) => updateSelected({ mechanic: event.target.value as SkillMechanic })}>{MECHANICS.map((mechanic) => <option key={mechanic} value={mechanic}>{SKILL_MECHANIC_LABELS[mechanic]}</option>)}</select></label>
          </div>
          <label>적용 기준<select value={selected.applicationScope} onChange={(event) => updateSelected({ applicationScope: event.target.value as SkillApplicationScope })}>{Object.entries(SKILL_APPLICATION_LABELS).map(([scope, label]) => <option key={scope} value={scope}>{label}</option>)}</select></label>
          <label>발동 조건<select value={selected.triggerType} onChange={(event) => updateSelected({ triggerType: event.target.value as SkillTriggerType, trigger: SKILL_TRIGGER_LABELS[event.target.value as SkillTriggerType] })}>{TRIGGERS.filter((trigger) => selected.category === "common" ? trigger === "passive" : trigger !== "passive").map((trigger) => <option key={trigger} value={trigger}>{SKILL_TRIGGER_LABELS[trigger]}</option>)}</select></label>
          <fieldset className={styles.traitPicker}><legend>특성 · 기본 스킬도 바로 편집 가능</legend>{TRAITS.filter((trait) => selected.category === "common" ? trait === "passive" : trait !== "passive").map((trait) => <label key={trait} className={styles.check}><input type="checkbox" checked={selected.traits.includes(trait)} onChange={() => toggleTrait(trait)} />{SKILL_TRAIT_LABELS[trait]}</label>)}</fieldset>
          <label>수치가 의미하는 효과<input value={selected.effect} onChange={(event) => updateSelected({ effect: event.target.value })} /></label>
          <label>게임 내 상세 설명<textarea rows={5} value={selected.description} onChange={(event) => updateSelected({ description: event.target.value })} /></label>
          {selected.evolution && <label>LV3 달성 후 1회 추가 선택 진화<textarea rows={3} value={selected.evolution} onChange={(event) => updateSelected({ evolution: event.target.value })} /></label>}
          <div className={styles.traitConfigList}>
            {selected.traitConfigs.map((trait) => (
              <fieldset key={trait.kind} className={styles.traitConfigCard}>
                <legend>{SKILL_TRAIT_LABELS[trait.kind]} 특성 수치</legend>
                <label>효과 단위<input value={trait.unit} onChange={(event) => updateTraitConfig(trait.kind, (current) => ({ ...current, unit: event.target.value }))} /></label>
                <div className={styles.levelGrid}>{trait.values.map((value, index) => <label key={index}>LV{index + 1} 효과<input type="number" step="0.1" value={value} onChange={(event) => updateTraitValue(trait.kind, index, Number(event.target.value))} /></label>)}</div>
                {DAMAGE_TRAITS.has(trait.kind) && <>
                  <label>피해 유형<select value={trait.damageType} onChange={(event) => updateTraitConfig(trait.kind, (current) => ({ ...current, damageType: event.target.value as SkillDamageType }))}><option value="physical">물리 피해</option><option value="magic">마법 피해</option></select></label>
                  <div className={styles.levelGrid}>{trait.damage.map((value, index) => <label key={index}>LV{index + 1} 피해<input type="number" min="0" step="1" value={value} onChange={(event) => updateTraitDamage(trait.kind, index, Number(event.target.value))} /></label>)}</div>
                </>}
              </fieldset>
            ))}
          </div>
          <div className={styles.levelGrid}>
            {selected.cooldown.map((value, index) => <label key={index}>LV{index + 1} 쿨타임<input type="number" min="0" step="0.1" value={value} onChange={(event) => updateCooldown(index, Number(event.target.value))} /></label>)}
          </div>
          <label>위험도 <b>{selected.risk}%</b><input type="range" min="0" max="100" value={selected.risk} onChange={(event) => updateSelected({ risk: Number(event.target.value) })} /></label>
          <button className={styles.buildButton} onClick={() => addToBuild(selected)}>{build[selected.id] ? "REMOVE FROM BUILD" : "ADD TO TEST BUILD"}</button>
        </aside>
      </section>

      <section className={styles.bottomGrid}>
        <div className={styles.buildPanel}>
          <div className={styles.sectionTitle}><span>PADDLE BUILD · UNLIMITED</span><button onClick={() => setBuild({})}>CLEAR</button></div>
          <div className={styles.slots}>
            {CATEGORIES.map((category) => (
              <div key={category} style={categoryStyle(category)}><span>{CATEGORY_LABELS[category]} {buildSkills.filter((skill) => skill.category === category).length}</span>
                {buildSkills.filter((skill) => skill.category === category).map((skill) => (
                  <label key={skill.id}>{skill.name}<select value={build[skill.id]} onChange={(event) => setBuild((current) => ({ ...current, [skill.id]: Number(event.target.value) }))}><option value="1">LV1</option><option value="2">LV2</option><option value="3">LV3</option></select></label>
                ))}
              </div>
            ))}
          </div>
          {activeSynergies.length > 0 && <ul className={styles.synergies}>{activeSynergies.map((synergy) => <li key={synergy.label}>SYNERGY · {synergy.label}</li>)}</ul>}
          {message && <p className={styles.message}>{message}</p>}
        </div>

        <div className={styles.validation}>
          <div className={styles.sectionTitle}><span>BALANCE CHECK</span><strong>{warnings.length === 0 ? "CLEAR" : `${warnings.length} ISSUES`}</strong></div>
          {warnings.length === 0 ? <p>레벨 성장과 리스크 규칙에 문제가 없습니다.</p> : <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
        </div>
      </section>
    </main>
  );
}
