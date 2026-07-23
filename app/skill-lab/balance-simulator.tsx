"use client";

import { useEffect, useMemo, useState } from "react";
import { BALANCE_STORAGE_KEY, BOT_LIVE_STORAGE_KEY, BOT_RESULTS_STORAGE_KEY, DEFAULT_BALANCE_CONFIG, normalizeBalanceConfig, type BalanceConfig, type BotWaveSample } from "../balance-config";
import { BENCHMARK_STORAGE_KEY, DEFAULT_BENCHMARK_CONFIG, normalizeBenchmarkConfig, type BenchmarkConfig } from "../benchmark-config";
import styles from "./skill-lab.module.css";
import { appHref } from "../site-path";

type StoredBotRun = {
  id?: string;
  wave?: number;
  balanceConfig?: BalanceConfig;
  benchmarkConfig?: BenchmarkConfig | null;
  waveSamples?: BotWaveSample[];
};

type ControlSpec = {
  key: keyof BalanceConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
};

const CONTROLS: ControlSpec[] = [
  { key: "rowStartInterval", label: "첫 웨이브 간격", min: 5, max: 14, step: 0.5, unit: "초" },
  { key: "rowMinInterval", label: "최소 웨이브 간격", min: 2.5, max: 8, step: 0.25, unit: "초" },
  { key: "rowAcceleration", label: "웨이브 가속", min: 0, max: 0.25, step: 0.01, unit: "초/W" },
  { key: "baseHpWaveStep", label: "기본 체력 +1 주기", min: 2, max: 10, step: 1, unit: "W" },
  { key: "hardChanceGrowth", label: "강화 블록 증가", min: 0, max: 0.08, step: 0.005, unit: "/W" },
  { key: "guardChanceGrowth", label: "가드 증가", min: 0, max: 0.01, step: 0.0005, unit: "/W" },
  { key: "bossBaseHp", label: "보스 기본 체력", min: 40, max: 500, step: 10, unit: "HP" },
  { key: "bossHpPerStage", label: "보스 단계 성장", min: 0, max: 240, step: 10, unit: "HP" },
  { key: "bossTimeLimit", label: "보스 제한시간", min: 25, max: 75, step: 1, unit: "초" },
  { key: "bossAttackInterval", label: "보스 공격 주기", min: 3, max: 9, step: 0.25, unit: "초" },
];

const WIDTH = 960;
const HEIGHT = 210;
const PAD = { left: 48, right: 18, top: 18, bottom: 28 };

function signature(config: BalanceConfig) {
  return JSON.stringify(Object.entries(config).map(([key, value]) => [key, Number(value.toFixed(4))]));
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sampleAtWave(run: StoredBotRun, wave: number) {
  const samples = (run.waveSamples ?? []).filter((sample) => sample.wave === wave);
  return samples.length ? samples[samples.length - 1] : undefined;
}

function designFieldHp(config: BalanceConfig, wave: number) {
  if (wave % 20 === 0) {
    const stage = wave / 20;
    return config.bossBaseHp + stage * config.bossHpPerStage;
  }
  const baseHp = 1 + Math.floor((wave - 1) / Math.max(1, Math.round(config.baseHpWaveStep)));
  const hardHp = baseHp + 1 + Math.floor((wave - 1) / Math.max(1, Math.round(config.hardHpWaveStep)));
  const hardChance = Math.min(0.9, 0.16 + wave * config.hardChanceGrowth);
  return 8 * (baseHp * (1 - hardChance) + hardHp * hardChance);
}

function linePath(values: number[], maximum: number) {
  const chartWidth = WIDTH - PAD.left - PAD.right;
  const chartHeight = HEIGHT - PAD.top - PAD.bottom;
  return values.map((value, index) => {
    const x = PAD.left + index / Math.max(1, values.length - 1) * chartWidth;
    const y = PAD.top + chartHeight - value / Math.max(1, maximum) * chartHeight;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function WaveChart({ title, unit, primary, secondary, primaryLabel, secondaryLabel }: { title: string; unit: string; primary: number[]; secondary?: number[]; primaryLabel: string; secondaryLabel?: string }) {
  const maximum = Math.max(1, ...primary, ...(secondary ?? []));
  const ticks = [0, 0.5, 1];
  return (
    <div className={styles.balanceChart}>
      <div className={styles.chartHeading}><strong>{title}</strong><span>{primaryLabel}{secondaryLabel ? ` · ${secondaryLabel}` : ""}</span></div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${title} 웨이브 그래프`}>
        {ticks.map((tick) => {
          const y = PAD.top + (1 - tick) * (HEIGHT - PAD.top - PAD.bottom);
          return <g key={tick}><line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className={styles.chartGrid} /><text x={PAD.left - 8} y={y + 4} textAnchor="end">{Math.round(maximum * tick)}{unit}</text></g>;
        })}
        {[20, 40, 60, 80, 100].map((wave) => {
          const x = PAD.left + (wave - 1) / 99 * (WIDTH - PAD.left - PAD.right);
          return <g key={wave}><line x1={x} x2={x} y1={PAD.top} y2={HEIGHT - PAD.bottom} className={styles.bossMarker} /><text x={x} y={HEIGHT - 8} textAnchor="middle">{wave}</text></g>;
        })}
        <path d={linePath(primary, maximum)} className={styles.chartPrimary} />
        {secondary && <path d={linePath(secondary, maximum)} className={styles.chartSecondary} />}
      </svg>
    </div>
  );
}

export default function BalanceSimulator() {
  const [config, setConfig] = useState<BalanceConfig>(DEFAULT_BALANCE_CONFIG);
  const [runs, setRuns] = useState<StoredBotRun[]>([]);
  const [ready, setReady] = useState(false);
  const [targetWave, setTargetWave] = useState(60);
  const [message, setMessage] = useState("봇 결과가 쌓이면 같은 설정의 실측 곡선을 표시합니다.");
  const [benchmark, setBenchmark] = useState<BenchmarkConfig>(DEFAULT_BENCHMARK_CONFIG);

  useEffect(() => {
    try {
      setConfig(normalizeBalanceConfig(JSON.parse(localStorage.getItem(BALANCE_STORAGE_KEY) ?? "null")));
    } catch {
      setConfig(DEFAULT_BALANCE_CONFIG);
    }
    try { setBenchmark(normalizeBenchmarkConfig(JSON.parse(localStorage.getItem(BENCHMARK_STORAGE_KEY) ?? "null"))); } catch { setBenchmark(DEFAULT_BENCHMARK_CONFIG); }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(BALANCE_STORAGE_KEY, JSON.stringify(config));
    setMessage("설정 적용 완료 · 실행 중인 봇은 다음 생성 웨이브부터 반영됩니다.");
  }, [config, ready]);

  useEffect(() => {
    const loadRuns = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(BOT_RESULTS_STORAGE_KEY) ?? "[]") as StoredBotRun[];
        const completed = Array.isArray(parsed) ? parsed : [];
        const live = JSON.parse(localStorage.getItem(BOT_LIVE_STORAGE_KEY) ?? "null") as StoredBotRun | null;
        setRuns(live ? [...completed, live] : completed);
      } catch {
        setRuns([]);
      }
    };
    loadRuns();
    const timer = window.setInterval(loadRuns, 1000);
    const onStorage = (event: StorageEvent) => {
      if (event.key === BOT_RESULTS_STORAGE_KEY || event.key === BOT_LIVE_STORAGE_KEY) loadRuns();
      if (event.key === BENCHMARK_STORAGE_KEY) setBenchmark(normalizeBenchmarkConfig(event.newValue ? JSON.parse(event.newValue) : null));
    };
    window.addEventListener("storage", onStorage);
    return () => { window.clearInterval(timer); window.removeEventListener("storage", onStorage); };
  }, []);

  const matchingRuns = useMemo(() => {
    const currentSignature = signature(config);
    return runs.filter((run) => run.balanceConfig
      && signature(normalizeBalanceConfig(run.balanceConfig)) === currentSignature
      && run.benchmarkConfig?.stage === benchmark.stage
      && run.benchmarkConfig?.targetWave === benchmark.targetWave
      && (run.waveSamples?.length ?? 0) > 0);
  }, [benchmark.stage, benchmark.targetWave, config, runs]);

  const graph = useMemo(() => {
    const waves = Array.from({ length: 100 }, (_, index) => index + 1);
    return {
      reach: waves.map((wave) => matchingRuns.length ? matchingRuns.filter((run) => (run.wave ?? 0) >= wave).length / matchingRuns.length * 100 : 0),
      balls: waves.map((wave) => median(matchingRuns.map((run) => sampleAtWave(run, wave)?.balls).filter((value): value is number => value !== undefined))),
      fieldHp: waves.map((wave) => median(matchingRuns.map((run) => sampleAtWave(run, wave)?.brickHp).filter((value): value is number => value !== undefined))),
      designHp: waves.map((wave) => designFieldHp(config, wave)),
    };
  }, [config, matchingRuns]);

  const updateConfig = (key: keyof BalanceConfig, value: number) => {
    setConfig((current) => normalizeBalanceConfig({ ...current, [key]: value }));
  };

  const autoFit = () => {
    const completedRuns = matchingRuns.filter((run) => run.id !== "live");
    if (completedRuns.length < 3) {
      setMessage("같은 설정으로 최소 3회 봇 테스트가 필요합니다.");
      return;
    }
    const averageWave = completedRuns.reduce((sum, run) => sum + (run.wave ?? 0), 0) / completedRuns.length;
    const ratio = Math.max(0.72, Math.min(1.35, averageWave / targetWave));
    const next = normalizeBalanceConfig({
      ...config,
      rowAcceleration: config.rowAcceleration * ratio,
      baseHpWaveStep: config.baseHpWaveStep / ratio,
      hardHpWaveStep: config.hardHpWaveStep / ratio,
      hardChanceGrowth: config.hardChanceGrowth * ratio,
      bossBaseHp: config.bossBaseHp * ratio,
      bossHpPerStage: config.bossHpPerStage * ratio,
    });
    setConfig(next);
    setMessage(`평균 W${averageWave.toFixed(1)} → 목표 W${targetWave} 기준 1차 보정값을 적용했습니다. 같은 정책으로 다시 테스트하세요.`);
  };

  const reset = () => {
    setConfig(DEFAULT_BALANCE_CONFIG);
    setMessage("기본 밸런스 값으로 복원했습니다.");
  };

  return (
    <section className={styles.balanceSimulator} aria-label="웨이브 밸런스 시뮬레이터">
      <div className={styles.balanceHeader}>
        <div><p>LIVE BOT TELEMETRY</p><h2>WAVE BALANCE SIMULATOR</h2></div>
        <div className={styles.balanceStatus}><strong>{matchingRuns.length}</strong><span>MATCHED RUNS</span></div>
      </div>

      <div className={styles.balanceLayout}>
        <div className={styles.balanceControls}>
          {CONTROLS.map((control) => (
            <label key={control.key}>
              <span>{control.label}<b>{config[control.key].toFixed(control.step < 0.01 ? 4 : control.step < 1 ? 2 : 0)} {control.unit}</b></span>
              <input type="range" min={control.min} max={control.max} step={control.step} value={config[control.key]} onChange={(event) => updateConfig(control.key, Number(event.target.value))} />
            </label>
          ))}
          <div className={styles.fitControls}>
            <label>목표 평균 도달 웨이브<input type="number" min="20" max="100" step="5" value={targetWave} onChange={(event) => setTargetWave(Math.max(20, Math.min(100, Number(event.target.value))))} /></label>
            <button type="button" onClick={autoFit}>BOT DATA AUTO FIT</button>
            <button type="button" onClick={reset}>RESET</button>
          </div>
        </div>

        <div className={styles.balanceGraphs}>
          <WaveChart title="웨이브 도달률" unit="%" primary={graph.reach} primaryLabel="실측 도달률" />
          <WaveChart title="생존 공 개수" unit="" primary={graph.balls} primaryLabel="실측 중앙값" />
          <WaveChart title="필드 잔여 체력" unit="" primary={graph.fieldHp} secondary={graph.designHp} primaryLabel="봇 실측" secondaryLabel="설계 예상" />
        </div>
      </div>
      <div className={styles.balanceFooter}><span>{message}</span><a href={appHref("/")}>게임에서 봇 테스트 실행 →</a></div>
    </section>
  );
}
