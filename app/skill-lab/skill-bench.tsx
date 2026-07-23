"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { BALANCE_STORAGE_KEY, BOT_RESULTS_STORAGE_KEY, DEFAULT_BALANCE_CONFIG, DEFAULT_SKILL_BENCH_CONFIG, DEFAULT_SKILL_BENCH_PROGRESS, normalizeBalanceConfig, normalizeSkillBenchConfig, normalizeSkillBenchProgress, SKILL_BENCH_PROGRESS_KEY, SKILL_BENCH_STORAGE_KEY, type BalanceConfig, type SkillBenchConfig, type SkillBenchProgress } from "../balance-config";
import { DEFAULT_SKILLS, normalizeSkillConfigs, SKILL_STORAGE_KEY, type SkillCategory, type SkillConfig, type UpgradeId } from "../skill-config";
import { BENCHMARK_STORAGE_KEY, DEFAULT_BENCHMARK_CONFIG, normalizeBenchmarkConfig, type BenchmarkConfig } from "../benchmark-config";
import styles from "./skill-lab.module.css";
import { appHref } from "../site-path";

const CATEGORIES: SkillCategory[] = ["warrior", "archer", "mage", "common"];
const CATEGORY_LABELS: Record<SkillCategory, string> = { warrior: "전사", archer: "궁수", mage: "법사", common: "공용" };

type BenchVariant = { batchId?: string; environment?: SkillBenchConfig["environment"]; skillId: UpgradeId | "original"; level: 0 | 1 | 2 | 3; skillValues: [number, number, number]; seed: number };
type BenchRun = { wave?: number; maxBalls?: number; coreHp?: number; score?: number; bricks?: number; maxCombo?: number; evaluationComplete?: boolean; balanceConfig?: BalanceConfig; benchmarkConfig?: BenchmarkConfig | null; skillBench?: BenchVariant | null };
type GroupStats = { level: 0 | 1 | 2 | 3; count: number; averageWave: number; completionRate: number; averageMaxBalls: number; averageCoreHp: number; averageScore: number; averageBricks: number; averageCombo: number };

function configSignature(config: BalanceConfig) {
  return JSON.stringify(Object.entries(config).map(([key, value]) => [key, Number(value.toFixed(4))]));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function statFor(level: 0 | 1 | 2 | 3, runs: BenchRun[]): GroupStats {
  const group = runs.filter((run) => run.skillBench?.level === level);
  return {
    level,
    count: group.length,
    averageWave: average(group.map((run) => run.wave ?? 0)),
    completionRate: group.length ? group.filter((run) => run.evaluationComplete).length / group.length * 100 : 0,
    averageMaxBalls: average(group.map((run) => run.maxBalls ?? 0)),
    averageCoreHp: average(group.map((run) => run.coreHp ?? 0)),
    averageScore: average(group.map((run) => run.score ?? 0)),
    averageBricks: average(group.map((run) => run.bricks ?? 0)),
    averageCombo: average(group.map((run) => run.maxCombo ?? 0)),
  };
}

function evaluate(groups: GroupStats[], runsPerVariant: number) {
  if (!groups.every((group) => group.count >= runsPerVariant)) return { label: "수집 중", tone: "collecting", detail: `${groups.reduce((sum, group) => sum + group.count, 0)}/${runsPerVariant * 4}회 완료` };
  const baseline = groups[0];
  const level3 = groups[3];
  if (baseline.completionRate >= 80) return { label: "판정 불가", tone: "ceiling", detail: "기준군도 W20을 대부분 통과합니다. 난이도를 먼저 높여야 합니다." };
  const waveGain = level3.averageWave - baseline.averageWave;
  const completionGain = level3.completionRate - baseline.completionRate;
  if (waveGain >= 4 || completionGain >= 30) return { label: "과성능 후보", tone: "high", detail: `LV3 평균 +${waveGain.toFixed(1)}W · 완료율 ${completionGain >= 0 ? "+" : ""}${completionGain.toFixed(0)}%p` };
  if (waveGain <= 1 && completionGain <= 5) return { label: "저성능 후보", tone: "low", detail: `LV3 상승 ${waveGain.toFixed(1)}W · ${completionGain.toFixed(0)}%p` };
  return { label: "적정 후보", tone: "fit", detail: `LV3 상승 ${waveGain.toFixed(1)}W · 완료율 +${completionGain.toFixed(0)}%p` };
}

export default function SkillBench() {
  const [skills, setSkills] = useState<SkillConfig[]>(DEFAULT_SKILLS);
  const [config, setConfig] = useState<SkillBenchConfig>(DEFAULT_SKILL_BENCH_CONFIG);
  const [progress, setProgress] = useState<SkillBenchProgress>(DEFAULT_SKILL_BENCH_PROGRESS);
  const [balance, setBalance] = useState<BalanceConfig>(DEFAULT_BALANCE_CONFIG);
  const [runs, setRuns] = useState<BenchRun[]>([]);
  const [benchmark, setBenchmark] = useState<BenchmarkConfig>(DEFAULT_BENCHMARK_CONFIG);
  const [message, setMessage] = useState("단일 스킬 또는 여러 스킬을 같은 시드로 비교할 수 있습니다.");

  useEffect(() => {
    try { setSkills(normalizeSkillConfigs(JSON.parse(localStorage.getItem(SKILL_STORAGE_KEY) ?? "null"))); } catch { setSkills(DEFAULT_SKILLS); }
    try { setConfig(normalizeSkillBenchConfig(JSON.parse(localStorage.getItem(SKILL_BENCH_STORAGE_KEY) ?? "null"))); } catch { setConfig(DEFAULT_SKILL_BENCH_CONFIG); }
    try { setBalance(normalizeBalanceConfig(JSON.parse(localStorage.getItem(BALANCE_STORAGE_KEY) ?? "null"))); } catch { setBalance(DEFAULT_BALANCE_CONFIG); }
    try { setBenchmark(normalizeBenchmarkConfig(JSON.parse(localStorage.getItem(BENCHMARK_STORAGE_KEY) ?? "null"))); } catch { setBenchmark(DEFAULT_BENCHMARK_CONFIG); }
  }, []);

  useEffect(() => {
    const load = () => {
      try { const saved = JSON.parse(localStorage.getItem(BOT_RESULTS_STORAGE_KEY) ?? "[]"); setRuns(Array.isArray(saved) ? saved : []); } catch { setRuns([]); }
      try { setProgress(normalizeSkillBenchProgress(JSON.parse(localStorage.getItem(SKILL_BENCH_PROGRESS_KEY) ?? "null"))); } catch { setProgress(DEFAULT_SKILL_BENCH_PROGRESS); }
    };
    load();
    const timer = window.setInterval(load, 1000);
    const onStorage = (event: StorageEvent) => {
      if (event.key === BOT_RESULTS_STORAGE_KEY || event.key === SKILL_BENCH_PROGRESS_KEY) load();
      if (event.key === BENCHMARK_STORAGE_KEY) setBenchmark(normalizeBenchmarkConfig(event.newValue ? JSON.parse(event.newValue) : null));
    };
    window.addEventListener("storage", onStorage);
    return () => { window.clearInterval(timer); window.removeEventListener("storage", onStorage); };
  }, []);

  const selectedSkill = skills.find((skill) => skill.id === config.skillId) ?? skills[0];
  const selectedIds = useMemo(() => {
    if (config.mode === "single") return [selectedSkill.id];
    if (config.scope === "all") return skills.map((skill) => skill.id);
    if (config.scope === "category") return skills.filter((skill) => skill.category === config.category).map((skill) => skill.id);
    return config.skillIds.filter((id) => skills.some((skill) => skill.id === id));
  }, [config.category, config.mode, config.scope, config.skillIds, selectedSkill.id, skills]);

  const batchRuns = useMemo(() => runs.filter((run) => run.skillBench?.batchId === config.batchId
    && run.benchmarkConfig?.stage === benchmark.stage
    && run.benchmarkConfig?.targetWave === benchmark.targetWave), [benchmark.stage, benchmark.targetWave, config.batchId, runs]);
  const runsForSkill = (skill: SkillConfig) => {
    const balanceKey = configSignature(balance);
    const levelKey = JSON.stringify(skill.levels);
    return batchRuns.filter((run) => run.skillBench?.skillId === skill.id
      && JSON.stringify(run.skillBench.skillValues) === levelKey
      && run.balanceConfig
      && configSignature(normalizeBalanceConfig(run.balanceConfig)) === balanceKey);
  };
  const matchingRuns = useMemo(() => config.environment === "original" ? batchRuns.filter((run) => run.skillBench?.skillId === "original") : runsForSkill(selectedSkill), [batchRuns, balance, config.environment, selectedSkill]);
  const groups = useMemo(() => ([0, 1, 2, 3] as const).map((level) => statFor(level, matchingRuns)), [matchingRuns]);
  const verdict = useMemo(() => config.environment === "original"
    ? groups[0].count >= config.runsPerVariant
      ? { label: "기준 측정 완료", tone: "fit", detail: `평균 ${groups[0].averageWave.toFixed(1)}W · W20 ${groups[0].completionRate.toFixed(0)}%` }
      : { label: "기준 수집 중", tone: "collecting", detail: `${groups[0].count}/${config.runsPerVariant}회 완료` }
    : evaluate(groups, config.runsPerVariant), [config.environment, config.runsPerVariant, groups]);
  const rankings = useMemo(() => selectedIds.map((id) => {
    const skill = skills.find((item) => item.id === id)!;
    const skillGroups = ([0, 1, 2, 3] as const).map((level) => statFor(level, runsForSkill(skill)));
    return { skill, groups: skillGroups, verdict: evaluate(skillGroups, config.runsPerVariant) };
  }), [selectedIds, skills, batchRuns, balance, config.runsPerVariant]);

  const applyBench = () => {
    if (config.environment !== "original" && selectedIds.length === 0) { setMessage("테스트할 스킬을 하나 이상 선택하세요."); return; }
    const batchId = `bench-${Date.now()}`;
    const next = { ...config, enabled: true, skillId: selectedSkill.id, skillIds: selectedIds, batchId };
    const totalRuns = next.environment === "original" ? next.runsPerVariant : selectedIds.length * next.runsPerVariant * 4;
    const idle = { ...DEFAULT_SKILL_BENCH_PROGRESS, batchId, totalRuns, updatedAt: Date.now() };
    setConfig(next);
    setProgress(idle);
    localStorage.setItem(SKILL_BENCH_STORAGE_KEY, JSON.stringify(next));
    localStorage.setItem(SKILL_BENCH_PROGRESS_KEY, JSON.stringify(idle));
    setMessage(next.environment === "original" ? `스킬 없는 오리지널 기준군 ${next.runsPerVariant}회로 설정했습니다.` : `${selectedIds.length}개 스킬 · 기준군/LV1/LV2/LV3 각 ${next.runsPerVariant}회 · 총 ${idle.totalRuns}회로 설정했습니다.`);
  };

  const disableBench = () => {
    const next = { ...config, enabled: false };
    setConfig(next);
    localStorage.setItem(SKILL_BENCH_STORAGE_KEY, JSON.stringify(next));
    setMessage("스킬 벤치를 해제했습니다.");
  };

  const toggleCustom = (id: string) => setConfig((current) => ({ ...current, skillIds: current.skillIds.includes(id) ? current.skillIds.filter((item) => item !== id) : [...current.skillIds, id] }));
  const maxBalls = Math.max(1, ...groups.map((group) => group.averageMaxBalls));
  const displayGroups = config.environment === "original" ? [groups[0]] : groups;
  const progressPercent = progress.totalRuns ? Math.min(100, progress.completedRuns / progress.totalRuns * 100) : 0;
  const currentSkill = skills.find((skill) => skill.id === progress.currentSkillId);
  const experimentCount = config.environment === "original" ? config.runsPerVariant : selectedIds.length * config.runsPerVariant * 4;
  const environmentCopy = config.environment === "original"
    ? "스킬 획득을 완전히 차단하고 게임 자체의 난이도와 W20 도달률을 측정합니다."
    : config.environment === "isolated"
      ? "대상 스킬만 시작 레벨로 부여하고 플레이 중 다른 스킬 획득을 차단합니다."
      : "대상 스킬을 시작 레벨로 부여하고 플레이 중 다른 스킬 획득을 허용합니다.";

  return (
    <section className={styles.skillBench} aria-label="스킬 레벨 비교 벤치">
      <div className={styles.benchHeader}>
        <div><p>CONTROLLED W20 EXPERIMENT</p><h2>BATCH SKILL BENCH</h2></div>
        <div className={`${styles.benchVerdict} ${styles[verdict.tone]}`}><strong>{verdict.label}</strong><span>{config.environment === "original" ? "ORIGINAL" : selectedSkill.name} · {verdict.detail}</span></div>
      </div>

      <div className={styles.benchRoleTabs} role="tablist" aria-label="스킬 벤치 실험 역할">
        <button type="button" role="tab" aria-selected={config.environment === "original"} onClick={() => setConfig((current) => ({ ...current, environment: "original" }))}><strong>ORIGINAL</strong><span>스킬 없는 원본 기준</span></button>
        <button type="button" role="tab" aria-selected={config.environment === "isolated"} onClick={() => setConfig((current) => ({ ...current, environment: "isolated" }))}><strong>ISOLATED</strong><span>단일 스킬 순수 영향</span></button>
        <button type="button" role="tab" aria-selected={config.environment === "ecosystem"} onClick={() => setConfig((current) => ({ ...current, environment: "ecosystem" }))}><strong>ECOSYSTEM</strong><span>실전 조합 영향</span></button>
      </div>
      <p className={styles.benchEnvironmentCopy}>{environmentCopy}</p>

      {config.environment !== "original" && <div className={styles.benchModeRow}>
        <button type="button" className={config.mode === "single" ? styles.active : ""} onClick={() => setConfig((current) => ({ ...current, mode: "single" }))}>단일 스킬</button>
        <button type="button" className={config.mode === "batch" ? styles.active : ""} onClick={() => setConfig((current) => ({ ...current, mode: "batch" }))}>배치 평가</button>
        {config.mode === "batch" && <>
          <button type="button" className={config.scope === "all" ? styles.active : ""} onClick={() => setConfig((current) => ({ ...current, scope: "all" }))}>ALL SKILLS</button>
          <button type="button" className={config.scope === "category" ? styles.active : ""} onClick={() => setConfig((current) => ({ ...current, scope: "category" }))}>카테고리</button>
          <button type="button" className={config.scope === "custom" ? styles.active : ""} onClick={() => setConfig((current) => ({ ...current, scope: "custom" }))}>직접 선택</button>
        </>}
      </div>}

      <div className={styles.benchControls}>
        {config.environment !== "original" && <label>결과 상세 스킬<select value={selectedSkill.id} onChange={(event) => setConfig((current) => ({ ...current, skillId: event.target.value }))}>{skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label>}
        {config.environment !== "original" && config.mode === "batch" && config.scope === "category" && <label>테스트 카테고리<select value={config.category} onChange={(event) => setConfig((current) => ({ ...current, category: event.target.value }))}>{CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select></label>}
        <label>그룹별 반복<select value={config.runsPerVariant} onChange={(event) => setConfig((current) => ({ ...current, runsPerVariant: Number(event.target.value) as 3 | 5 | 10 }))}><option value="3">3회 · 빠른 탐색</option><option value="5">5회 · 기본</option><option value="10">10회 · 정밀</option></select></label>
        <div className={styles.benchValues}><span>실험 규모</span><strong>{config.environment === "original" ? "NO SKILL" : `${selectedIds.length} SKILLS`} · {experimentCount} RUNS</strong></div>
        <button type="button" onClick={applyBench}>APPLY BENCH</button>
        {config.enabled && <button type="button" onClick={disableBench}>DISABLE</button>}
      </div>

      {config.environment !== "original" && config.mode === "batch" && config.scope === "custom" && <div className={styles.benchSkillPicker}>{skills.map((skill) => <label key={skill.id}><input type="checkbox" checked={config.skillIds.includes(skill.id)} onChange={() => toggleCustom(skill.id)} />{skill.name}</label>)}</div>}

      <div className={styles.benchProgress}>
        <div><strong>{progress.status.toUpperCase()}</strong><span>{progress.completedRuns}/{progress.totalRuns} RUNS · {progressPercent.toFixed(1)}%</span><span>{progress.currentSkillId === "original" ? "ORIGINAL · NO SKILL" : currentSkill ? `${currentSkill.name} · ${progress.currentLevel === 0 ? "기준군" : `LV${progress.currentLevel}`}` : "대기 중"}</span></div>
        <i><b style={{ "--bench-progress": `${progressPercent}%` } as CSSProperties} /></i>
      </div>

      {config.environment !== "original" && config.mode === "batch" && <div className={styles.benchRanking} role="table" aria-label="스킬 배치 평가 요약">
        <div><span>스킬</span><span>완료</span><span>LV3 WAVE Δ</span><span>W20 Δ</span><span>판정</span></div>
        {rankings.map(({ skill, groups: skillGroups, verdict: skillVerdict }) => <button type="button" key={skill.id} onClick={() => setConfig((current) => ({ ...current, skillId: skill.id }))}><strong>{skill.name}</strong><span>{skillGroups.reduce((sum, group) => sum + group.count, 0)}/{config.runsPerVariant * 4}</span><span>{(skillGroups[3].averageWave - skillGroups[0].averageWave).toFixed(1)}</span><span>{(skillGroups[3].completionRate - skillGroups[0].completionRate).toFixed(0)}%p</span><em className={styles[skillVerdict.tone]}>{skillVerdict.label}</em></button>)}
      </div>}

      <div className={styles.benchTable} role="table" aria-label={`${config.environment === "original" ? "오리지널" : selectedSkill.name} 레벨별 봇 테스트 결과`}>
        <div className={styles.benchTableHead} role="row"><span>실험군</span><span>완료</span><span>평균 웨이브</span><span>W20 완료율</span><span>평균 점수</span><span>파괴 브릭</span><span>최대 콤보</span><span>최대 공</span><span>잔여 코어</span></div>
        {displayGroups.map((group) => <div key={group.level} className={styles.benchTableRow} role="row">
          <strong>{config.environment === "original" ? "NO SKILL" : group.level === 0 ? "기준군" : `LV${group.level}`}</strong><span>{group.count}/{config.runsPerVariant}</span>
          <span><i style={{ "--bench-fill": `${Math.min(100, group.averageWave / 20 * 100)}%` } as CSSProperties} /><b>{group.averageWave.toFixed(1)}</b></span>
          <span><i style={{ "--bench-fill": `${group.completionRate}%` } as CSSProperties} /><b>{group.completionRate.toFixed(0)}%</b></span>
          <span><b>{Math.round(group.averageScore).toLocaleString("ko-KR")}</b></span><span><b>{group.averageBricks.toFixed(1)}</b></span><span><b>{group.averageCombo.toFixed(1)}</b></span>
          <span><i style={{ "--bench-fill": `${group.averageMaxBalls / maxBalls * 100}%` } as CSSProperties} /><b>{group.averageMaxBalls.toFixed(1)}</b></span>
          <span><i style={{ "--bench-fill": `${group.averageCoreHp / 8 * 100}%` } as CSSProperties} /><b>{group.averageCoreHp.toFixed(1)}</b></span>
        </div>)}
      </div>
      <div className={styles.benchFooter}><span>{message}</span><a href={appHref("/")}>게임에서 {progress.status === "paused" ? "이어서 실행" : "자동 테스트 시작"} →</a></div>
    </section>
  );
}
