"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { compareBalanceCandidates, comparePairedBalanceRuns, experimentRunsToCsv, type BalanceCandidate, type BalanceCandidateSummary, type BalanceExperiment, type BalancePairedComparison } from "../../balance-experiment";
import { tuningParameterValue } from "../../balance-epoch";
import { getBalanceCandidateRuns, getBalanceCandidateSummaries, getBalanceCandidates, getBalanceExperimentBundle, getBalanceExperiments } from "../../balance-experiment-store";
import styles from "./BalanceExperimentDashboard.module.css";

type CandidateView = { candidate: BalanceCandidate; summary: BalanceCandidateSummary; experiment: BalanceExperiment };

const METRIC_LABELS: Record<string, string> = {
  completionRate: "완주율 (%)",
  averageElapsed: "평균 실행 시간 (s)",
  medianElapsed: "중앙 실행 시간 (s)",
  averageWave: "평균 도달 웨이브",
  averageCoreHp: "평균 잔여 CORE",
  averageScore: "평균 점수",
  averagePhysicalDamage: "평균 물리 피해",
  averageMagicDamage: "평균 마법 피해",
  averageBallLosses: "평균 공 손실",
  timeoutRate: "타임아웃 비율 (%)",
};

function downloadFile(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function valueText(metric: string, value: number) {
  if (metric === "completionRate" || metric === "timeoutRate") return `${value.toFixed(1)}%`;
  if (metric === "averageElapsed" || metric === "medianElapsed") return `${value.toFixed(1)}s`;
  return value.toFixed(1);
}

function favorableDelta(metric: string, delta: number) {
  const lowerIsBetter = metric === "averageElapsed" || metric === "medianElapsed" || metric === "averageBallLosses" || metric === "timeoutRate";
  return lowerIsBetter ? delta < 0 : delta > 0;
}

function candidateTuningValue(view: CandidateView | null) {
  const tuning = view?.experiment.tuning;
  if (!view || !tuning) return null;
  const skill = view.candidate.config.skills.find((entry) => entry.id === tuning.skillId);
  return skill ? tuningParameterValue(skill, tuning.parameter, tuning.level) : null;
}

function tuningValueText(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function defaultCandidateIds(experimentId: string, views: CandidateView[]) {
  const scoped = views.filter((view) => view.experiment.id === experimentId);
  const tuning = scoped[0]?.experiment.tuning;
  const baseline = tuning?.referenceValue === undefined
    ? scoped[0]
    : scoped.find((view) => candidateTuningValue(view) === tuning.referenceValue) ?? scoped[0];
  const comparison = [...scoped]
    .filter((view) => view.candidate.score !== null)
    .sort((a, b) => (a.candidate.score ?? Infinity) - (b.candidate.score ?? Infinity))[0] ?? scoped.at(-1);
  return { baselineId: baseline?.candidate.id ?? "", comparisonId: comparison?.candidate.id ?? baseline?.candidate.id ?? "" };
}

export function BalanceExperimentDashboard({ refreshToken, onResume, resumeDisabled = false }: { refreshToken: number; onResume?: (experimentId: string) => void; resumeDisabled?: boolean }) {
  const [experiments, setExperiments] = useState<BalanceExperiment[]>([]);
  const [candidateViews, setCandidateViews] = useState<CandidateView[]>([]);
  const [activeExperimentId, setActiveExperimentId] = useState("");
  const activeExperimentIdRef = useRef("");
  const [baselineId, setBaselineId] = useState("");
  const [comparisonId, setComparisonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [paired, setPaired] = useState<BalancePairedComparison | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const nextExperiments = await getBalanceExperiments(24);
        const views = (await Promise.all(nextExperiments.map(async (experiment) => {
          const [candidates, summaries] = await Promise.all([
            getBalanceCandidates(experiment.id),
            getBalanceCandidateSummaries(experiment.id),
          ]);
          const summaryMap = new Map(summaries.map((summary) => [summary.candidateId, summary]));
          return candidates.flatMap((candidate) => {
            const summary = summaryMap.get(candidate.id);
            return summary ? [{ candidate, summary, experiment }] : [];
          });
        }))).flat().sort((a, b) => b.experiment.createdAt - a.experiment.createdAt || b.candidate.epoch - a.candidate.epoch);
        if (cancelled) return;
        setExperiments(nextExperiments);
        setCandidateViews(views);
        const currentExperimentId = activeExperimentIdRef.current;
        const nextExperimentId = nextExperiments.some((experiment) => experiment.id === currentExperimentId && views.some((view) => view.experiment.id === currentExperimentId))
          ? currentExperimentId
          : nextExperiments.find((experiment) => views.some((view) => view.experiment.id === experiment.id))?.id ?? "";
        const defaults = defaultCandidateIds(nextExperimentId, views);
        activeExperimentIdRef.current = nextExperimentId;
        setActiveExperimentId(nextExperimentId);
        setBaselineId((selected) => views.some((view) => view.experiment.id === nextExperimentId && view.candidate.id === selected) ? selected : defaults.baselineId);
        setComparisonId((selected) => views.some((view) => view.experiment.id === nextExperimentId && view.candidate.id === selected) ? selected : defaults.comparisonId);
      } catch (error) {
        console.error("[balance-experiment] load failed", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [refreshToken]);

  const activeCandidateViews = candidateViews.filter((view) => view.experiment.id === activeExperimentId);

  const selectExperiment = (experimentId: string) => {
    const defaults = defaultCandidateIds(experimentId, candidateViews);
    activeExperimentIdRef.current = experimentId;
    setActiveExperimentId(experimentId);
    setBaselineId(defaults.baselineId);
    setComparisonId(defaults.comparisonId);
    setPaired(null);
  };

  const baseline = candidateViews.find((view) => view.candidate.id === baselineId) ?? null;
  const comparison = candidateViews.find((view) => view.candidate.id === comparisonId) ?? null;
  const comparisonRows = useMemo(() => baseline && comparison ? compareBalanceCandidates(baseline.summary, comparison.summary) : [], [baseline, comparison]);

  useEffect(() => {
    let cancelled = false;
    const baselineCandidate = candidateViews.find((view) => view.candidate.id === baselineId);
    const comparisonCandidate = candidateViews.find((view) => view.candidate.id === comparisonId);
    if (!baselineCandidate || !comparisonCandidate) return;
    void Promise.all([getBalanceCandidateRuns(baselineCandidate.candidate.id), getBalanceCandidateRuns(comparisonCandidate.candidate.id)]).then(([baselineRuns, comparisonRuns]) => {
      if (!cancelled) setPaired(comparePairedBalanceRuns(baselineRuns, comparisonRuns));
    });
    return () => { cancelled = true; };
  }, [baselineId, candidateViews, comparisonId, refreshToken]);

  const exportExperiment = async (format: "json" | "csv") => {
    const selected = comparison ?? baseline;
    if (!selected) return;
    if (format === "csv") {
      const runs = await getBalanceCandidateRuns(selected.candidate.id);
      const tuning = selected.experiment.tuning;
      const candidateValue = candidateTuningValue(selected);
      downloadFile(`core-breaker-${selected.experiment.id}-${selected.candidate.id}.csv`, experimentRunsToCsv(runs, tuning && candidateValue !== null ? {
        parameter: tuning.parameter,
        level: tuning.level,
        referenceValue: tuning.referenceValue ?? null,
        candidateValue,
        configHash: selected.candidate.configHash,
        score: selected.candidate.score,
      } : undefined), "text/csv;charset=utf-8");
      return;
    }
    const bundle = await getBalanceExperimentBundle(selected.experiment.id);
    downloadFile(`core-breaker-${selected.experiment.id}.json`, JSON.stringify({ experiment: selected.experiment, ...bundle }, null, 2), "application/json");
  };

  return (
    <section className={styles.panel} aria-label="밸런스 실험 기록과 후보 비교">
      <header className={styles.heading}>
        <div><p>BALANCE EXPERIMENT HISTORY</p><h2>실험 기록과 후보 비교</h2></div>
        <span>{loading ? "LOADING" : `${experiments.length} EXPERIMENTS · ${candidateViews.length} CANDIDATES`}</span>
      </header>
      {!loading && experiments.length === 0 ? (
        <div className={styles.empty}>HEADLESS 벤치마크를 실행하면 설정과 결과가 하나의 실험으로 계속 저장됩니다.</div>
      ) : (
        <>
          <div className={styles.experimentGrid}>
            {experiments.slice(0, 8).map((experiment) => (
              <div className={styles.experiment} data-active={activeExperimentId === experiment.id} key={experiment.id}>
                <button className={styles.experimentSelect} type="button" aria-pressed={activeExperimentId === experiment.id} onClick={() => selectExperiment(experiment.id)} disabled={!candidateViews.some((view) => view.experiment.id === experiment.id)}>
                  <strong>{experiment.name}</strong>
                  <span><small>EPOCH {experiment.currentEpoch}</small><small>{experiment.completedRuns}/{experiment.targetRuns} RUNS</small></span>
                  <span><small>{experiment.policy.toUpperCase()}</small><small className={styles.status}>{experiment.status.toUpperCase()}</small></span>
                  <small>{new Date(experiment.createdAt).toLocaleString("ko-KR")}</small>
                </button>
                {experiment.mode === "auto-tune" && experiment.status === "paused" && <button className={styles.resume} type="button" onClick={() => onResume?.(experiment.id)} disabled={resumeDisabled || !onResume}>이 실험 재개</button>}
              </div>
            ))}
          </div>
          {activeCandidateViews.length > 0 && (
            <div className={styles.compare}>
              <div className={styles.selectors}>
                <label>BASELINE<select value={baselineId} onChange={(event) => setBaselineId(event.target.value)}>{activeCandidateViews.map((view) => <option key={view.candidate.id} value={view.candidate.id}>{view.candidate.label}</option>)}</select></label>
                <b>VERSUS</b>
                <label>CANDIDATE<select value={comparisonId} onChange={(event) => setComparisonId(event.target.value)}>{activeCandidateViews.map((view) => <option key={view.candidate.id} value={view.candidate.id}>{view.candidate.label}</option>)}</select></label>
              </div>
              {baseline && comparison && (
                <>
                  {comparison.experiment.tuning && <div className={styles.summary}>
                    <div><span>PARAMETER</span><strong>{comparison.experiment.tuning.parameter}</strong></div>
                    <div><span>REFERENCE</span><strong>{tuningValueText(comparison.experiment.tuning.referenceValue)}</strong></div>
                    <div><span>BASELINE VALUE</span><strong>{tuningValueText(candidateTuningValue(baseline))}</strong></div>
                    <div><span>CANDIDATE VALUE</span><strong>{tuningValueText(candidateTuningValue(comparison))}</strong></div>
                  </div>}
                  <div className={styles.summary}>
                    <div><span>BASE RUNS</span><strong>{baseline.summary.runCount}</strong></div>
                    <div><span>CANDIDATE RUNS</span><strong>{comparison.summary.runCount}</strong></div>
                    <div><span>CONFIG HASH</span><strong>{comparison.candidate.configHash}</strong></div>
                    <div><span>ENGINE</span><strong>{comparison.experiment.engineVersion.replace("canonical-command-contract-", "")}</strong></div>
                  </div>
                  {paired && paired.pairCount > 0 && <div className={styles.summary}>
                    <div><span>PAIRED SEEDS</span><strong>{paired.pairCount}</strong></div>
                    <div><span>IMPROVED</span><strong className={styles.positive}>{paired.improvedSeeds}</strong></div>
                    <div><span>REGRESSED</span><strong className={styles.negative}>{paired.regressedSeeds}</strong></div>
                    <div><span>TIME Δ</span><strong className={paired.averageElapsedDelta < 0 ? styles.positive : paired.averageElapsedDelta > 0 ? styles.negative : undefined}>{paired.averageElapsedDelta > 0 ? "+" : ""}{paired.averageElapsedDelta.toFixed(1)}s</strong></div>
                  </div>}
                  <div className={styles.table} role="table" aria-label="후보 지표 비교">
                    <div className={`${styles.row} ${styles.head}`} role="row"><span>METRIC</span><span>BASELINE</span><span>CANDIDATE</span><span>DELTA</span></div>
                    {comparisonRows.map((row) => (
                      <div className={styles.row} role="row" key={row.metric}>
                        <strong>{METRIC_LABELS[row.metric]}</strong><span>{valueText(row.metric, row.baseline)}</span><span>{valueText(row.metric, row.candidate)}</span>
                        <b className={row.delta === 0 ? undefined : favorableDelta(row.metric, row.delta) ? styles.positive : styles.negative}>{row.delta > 0 ? "+" : ""}{valueText(row.metric, row.delta)}</b>
                      </div>
                    ))}
                  </div>
                  <div className={styles.actions}>
                    <button type="button" onClick={() => void exportExperiment("csv")}>후보 CSV</button>
                    <button type="button" onClick={() => void exportExperiment("json")}>실험 JSON</button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
