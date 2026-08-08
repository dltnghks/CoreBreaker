"use client";

import { useEffect, useMemo, useState } from "react";
import { BENCHMARK_STAGES, BENCHMARK_STORAGE_KEY, benchmarkFeatures, DEFAULT_BENCHMARK_CONFIG, normalizeBenchmarkConfig, type BenchmarkConfig, type BenchmarkStage } from "../benchmark-config";
import { DEFAULT_SKILLS, type UpgradeId } from "../skill-config";
import styles from "./benchmark.module.css";
import { appHref } from "../site-path";

export default function BenchmarkSetup() {
  const [config, setConfig] = useState<BenchmarkConfig>(DEFAULT_BENCHMARK_CONFIG);
  const [saved, setSaved] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setShowSetup((visible) => !visible);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    try { setConfig(normalizeBenchmarkConfig(JSON.parse(localStorage.getItem(BENCHMARK_STORAGE_KEY) ?? "null"))); } catch { setConfig(DEFAULT_BENCHMARK_CONFIG); }
  }, []);

  const features = useMemo(() => benchmarkFeatures(config.stage), [config.stage]);
  const skillCount = (id: UpgradeId) => config.startingSkills.filter((entry) => entry === id).length;
  const setSkillCount = (id: UpgradeId, count: number) => setConfig((current) => ({ ...current, startingSkills: [...current.startingSkills.filter((entry) => entry !== id), ...Array.from({ length: count }, () => id)] }));
  const apply = () => {
    localStorage.setItem(BENCHMARK_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new StorageEvent("storage", { key: BENCHMARK_STORAGE_KEY, newValue: JSON.stringify(config) }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  if (!showSetup) return null;

  return <section className={styles.setup} aria-label="벤치마크 기능 계층 설정">
    <header><div><p>CONTROLLED FEATURE LADDER</p><h1>BENCHMARK LAB</h1></div><nav><a href={appHref("/")}>GAMEPLAY</a><a href={appHref("/skill-lab")}>SKILL AUTHORING</a></nav></header>
    <div className={styles.stageGrid} role="tablist" aria-label="벤치마크 확장 단계">
      {BENCHMARK_STAGES.map((entry) => <button key={entry.stage} type="button" role="tab" aria-selected={config.stage === entry.stage} onClick={() => setConfig((current) => ({ ...current, stage: entry.stage as BenchmarkStage }))}><b>{entry.stage}</b><strong>{entry.name}</strong><span>{entry.description}</span></button>)}
    </div>
    <div className={styles.pipeline} aria-label="현재 활성 기능">
      {Object.entries(features).map(([key, enabled]) => <span key={key} data-enabled={enabled}>{enabled ? "ON" : "OFF"} · {key.toUpperCase()}</span>)}
    </div>
    <div className={styles.controls}>
      <label>반복 횟수<select value={config.runs} onChange={(event) => setConfig((current) => ({ ...current, runs: Number(event.target.value) as BenchmarkConfig["runs"] }))}>{[3, 5, 10, 20, 100].map((value) => <option key={value} value={value}>{value}회</option>)}</select></label>
      <label>측정 종료 웨이브<select value={config.targetWave} disabled><option value={config.targetWave}>W{config.targetWave} · START WAVE</option></select></label>
      <label>시작 웨이브<select value={config.startWave} onChange={(event) => { const startWave = Number(event.target.value) as BenchmarkConfig["startWave"]; setConfig((current) => ({ ...current, startWave, targetWave: startWave })); }}><option value={1}>W1 · NORMAL</option><option value={5}>W5 · BOSS</option><option value={10}>W10 · BOSS</option><option value={15}>W15 · BOSS</option><option value={20}>W20 · FINAL BOSS</option></select></label>
      <button type="button" onClick={apply}>{saved ? "APPLIED" : "APPLY ENVIRONMENT"}</button>
    </div>
    <div className={styles.skillSelect} aria-label="시작 스킬 선택">
      <p>시작 스킬 · 레벨</p>
      <div>{DEFAULT_SKILLS.map((skill) => {
        const maximum = skill.evolutionEnabled ? 4 : 3;
        return <label key={skill.id}><span>{skill.name}</span><select value={skillCount(skill.id)} onChange={(event) => setSkillCount(skill.id, Number(event.target.value))}><option value={0}>없음</option>{Array.from({ length: maximum }, (_, index) => <option key={index + 1} value={index + 1}>LV{index + 1}{index + 1 === 4 ? " · EVOLVE" : ""}</option>)}</select></label>;
      })}</div>
    </div>
  </section>;
}
