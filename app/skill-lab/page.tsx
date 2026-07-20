"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { DEFAULT_SKILLS, normalizeSkillConfigs, SKILL_MECHANIC_LABELS, SKILL_STORAGE_KEY, type SkillCategory, type SkillConfig, type SkillMechanic } from "../skill-config";
import styles from "./skill-lab.module.css";

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  warrior: "전사",
  archer: "궁수",
  mage: "법사",
  common: "공용",
};

const CATEGORIES: SkillCategory[] = ["warrior", "archer", "mage", "common"];
const CATEGORY_ICONS: Record<SkillCategory, string> = { warrior: "◆", archer: "➵", mage: "✧", common: "◇" };
const MECHANICS = Object.keys(SKILL_MECHANIC_LABELS) as SkillMechanic[];
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SKILL_STORAGE_KEY);
      if (saved) {
        setSkills(normalizeSkillConfigs(JSON.parse(saved)));
      }
    } catch {
      setSkills(DEFAULT_SKILLS);
    }
  }, []);

  const selected = skills.find((skill) => skill.id === selectedId) ?? skills[0];
  const visibleSkills = skills.filter((skill) => (filter === "all" || skill.category === filter) && (mechanicFilter === "all" || skill.mechanic === mechanicFilter));
  const buildSkills = skills.filter((skill) => build[skill.id]);

  useEffect(() => {
    if (visibleSkills.length > 0 && !visibleSkills.some((skill) => skill.id === selectedId)) {
      setSelectedId(visibleSkills[0].id);
    }
  }, [mechanicFilter, filter, selectedId, visibleSkills]);

  const warnings = useMemo(() => {
    const issues: string[] = [];
    skills.forEach((skill) => {
      const [a, b, c] = skill.levels;
      const ordered = skill.direction === "up" ? a < b && b < c : a > b && b > c;
      if (!ordered) issues.push(`${skill.name}: 레벨 성장 방향이 일정하지 않습니다.`);
      const firstStep = Math.abs(b - a);
      const secondStep = Math.abs(c - b);
      if (firstStep > 0 && secondStep / firstStep >= 3) issues.push(`${skill.name}: LV3 상승폭이 이전 단계보다 과도합니다.`);
    });
    return issues;
  }, [skills]);

  const activeSynergies = SYNERGIES.filter((synergy) => synergy.ids.every((id) => build[id]));

  const updateSelected = (patch: Partial<SkillConfig>) => {
    setSkills((current) => current.map((skill) => skill.id === selected.id ? { ...skill, ...patch } : skill));
  };

  const updateLevel = (index: number, value: number) => {
    const levels = [...selected.levels] as [number, number, number];
    levels[index] = Number.isFinite(value) ? value : 0;
    updateSelected({ levels });
  };

  const updateCooldown = (index: number, value: number) => {
    const cooldown = [...selected.cooldown] as [number, number, number];
    cooldown[index] = Number.isFinite(value) ? Math.max(0, value) : 0;
    updateSelected({ cooldown });
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
        <nav><a href="/">← GAME</a><a href="/benchmark">BENCHMARK</a><button onClick={saveDraft}>SAVE & APPLY</button><button onClick={exportJson}>EXPORT JSON</button></nav>
      </header>

      <section className={styles.toolbar} aria-label="스킬 카테고리 필터">
        {(["all", ...CATEGORIES] as const).map((category) => (
          <button key={category} className={filter === category ? styles.active : ""} style={category === "all" ? undefined : categoryStyle(category)} onClick={() => setFilter(category)}>
            {category === "all" ? "ALL" : CATEGORY_LABELS[category]}
          </button>
        ))}
        <span>{skills.length} SKILLS · {warnings.length} WARNINGS</span>
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
            <button key={skill.id} data-category={skill.category} className={`${styles.skillCard} ${selected.id === skill.id ? styles.selected : ""}`} style={skillStyle(skill)} onClick={() => setSelectedId(skill.id)}>
              <i className={styles.skillIcon} aria-hidden="true">{CATEGORY_ICONS[skill.category]}</i>
              <span>{CATEGORY_LABELS[skill.category]} · {SKILL_MECHANIC_LABELS[skill.mechanic]} · {skill.ultimate ? "보스 궁극기" : "일반 스킬"}</span><strong>{skill.name}</strong><small><b>발동</b> {skill.trigger}</small>
              <p className={styles.description}><SkillDescriptionText text={skill.description} /></p>
              <em>{skill.levels.map((value) => `${value}${skill.unit}`).join(" / ")}{skill.cooldown.some((value) => value > 0) ? ` · CD ${skill.cooldown.join("/")}s` : ""} · {skill.evolution ? "LV3 EVOLUTION" : skill.ultimate ? "ULTIMATE" : "PERMANENT"}</em>
            </button>
          ))}
        </div>

        <aside className={styles.editor} style={skillStyle(selected)}>
          <div className={styles.editorHeading}><span>{CATEGORY_LABELS[selected.category]} · {SKILL_MECHANIC_LABELS[selected.mechanic]} · {selected.ultimate ? "ULTIMATE" : "NORMAL"}</span><strong>{selected.name}</strong></div>
          <label>이름<input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} /></label>
          <label>적용 기준<input value="스킬 보유 공 · 공별 독립 쿨타임" readOnly /></label>
          <label>발동 조건<input value={selected.trigger} onChange={(event) => updateSelected({ trigger: event.target.value })} /></label>
          <label>수치가 의미하는 효과<input value={selected.effect} onChange={(event) => updateSelected({ effect: event.target.value })} /></label>
          <label>게임 내 상세 설명<textarea rows={5} value={selected.description} onChange={(event) => updateSelected({ description: event.target.value })} /></label>
          {selected.evolution && <label>LV3 진화 규칙<textarea rows={3} value={selected.evolution} onChange={(event) => updateSelected({ evolution: event.target.value })} /></label>}
          <div className={styles.levelGrid}>
            {selected.levels.map((value, index) => <label key={index}>LV{index + 1}<input type="number" step="0.1" value={value} onChange={(event) => updateLevel(index, Number(event.target.value))} /></label>)}
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
