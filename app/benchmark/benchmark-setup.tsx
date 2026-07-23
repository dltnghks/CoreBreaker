"use client";

import { useEffect, useMemo, useState } from "react";
import { BENCHMARK_STAGES, BENCHMARK_STORAGE_KEY, benchmarkFeatures, DEFAULT_BENCHMARK_CONFIG, normalizeBenchmarkConfig, type BenchmarkConfig, type BenchmarkStage } from "../benchmark-config";
import styles from "./benchmark.module.css";
import { appHref } from "../site-path";

export default function BenchmarkSetup() {
  const [config, setConfig] = useState<BenchmarkConfig>(DEFAULT_BENCHMARK_CONFIG);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try { setConfig(normalizeBenchmarkConfig(JSON.parse(localStorage.getItem(BENCHMARK_STORAGE_KEY) ?? "null"))); } catch { setConfig(DEFAULT_BENCHMARK_CONFIG); }
  }, []);

  const features = useMemo(() => benchmarkFeatures(config.stage), [config.stage]);
  const apply = () => {
    localStorage.setItem(BENCHMARK_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new StorageEvent("storage", { key: BENCHMARK_STORAGE_KEY, newValue: JSON.stringify(config) }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

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
      <label>평가 종료 웨이브<select value={config.targetWave} disabled><option value={20}>W20 · FINAL</option></select></label>
      <button type="button" onClick={apply}>{saved ? "APPLIED" : "APPLY ENVIRONMENT"}</button>
    </div>
  </section>;
}
