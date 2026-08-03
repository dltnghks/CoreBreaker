import type { BotRunResult } from "../../_types/game";
import type { BenchmarkConfig } from "../../benchmark-config";
import type { SkillConfig, UpgradeId } from "../../skill-config";
import type { HeadlessTimeoutDiagnostic } from "../../benchmark-headless";

export type BenchmarkDashboardProps = {
  visibleBotResults: BotRunResult[];
  benchmarkConfig: BenchmarkConfig;
  benchmarkCompletionRate: number;
  botAverageWave: number;
  benchmarkAverageScore: number;
  benchmarkAverageBricks: number;
  benchmarkAverageCombo: number;
  benchmarkAverageCore: number;
  chartX: (index: number) => number;
  reachPoints: string;
  corePoints: string;
  benchmarkWaveStats: Array<{ wave: number; reachRate: number; averageCore: number }>;
  timeoutResults: BotRunResult[];
  timeoutCauseCounts: Array<[string, number]>;
  timeoutCauseLabels: Record<HeadlessTimeoutDiagnostic["classification"], string>;
  timeoutWaveCounts: Array<[number, number]>;
  diagnosedTimeoutResults: BotRunResult[];
  benchmarkSkillStats: Array<{ id: UpgradeId; name: string; color: string; picks: number; averageLevel: number; clearRate: number; averageWave: number; activations: number; damage: number; kills: number }>;
  benchmarkTableResults: BotRunResult[];
  activeSkillMap: Partial<Record<UpgradeId, SkillConfig>>;
  maxCoreHp: number;
  benchmarkRuleset: string;
};

export function BenchmarkDashboard({
  visibleBotResults,
  benchmarkConfig,
  benchmarkCompletionRate,
  botAverageWave,
  benchmarkAverageScore,
  benchmarkAverageBricks,
  benchmarkAverageCombo,
  benchmarkAverageCore,
  chartX,
  reachPoints,
  corePoints,
  benchmarkWaveStats,
  timeoutResults,
  timeoutCauseCounts,
  timeoutCauseLabels,
  timeoutWaveCounts,
  diagnosedTimeoutResults,
  benchmarkSkillStats,
  benchmarkTableResults,
  activeSkillMap,
  maxCoreHp,
  benchmarkRuleset,
}: BenchmarkDashboardProps) {
  return (
    <section className="benchmark-dashboard" aria-label="벤치마크 결과 분석">
      <div className="benchmark-dashboard-heading">
        <div>
          <p className="eyebrow">{benchmarkRuleset.toUpperCase()} RESULT ANALYSIS</p>
          <h2>벤치마크 결과</h2>
        </div>
        <span>{visibleBotResults.length} RUNS · W1–W{benchmarkConfig.targetWave}</span>
      </div>

      {visibleBotResults.length === 0 ? (
        <div className="benchmark-empty">
          <strong>아직 분석할 실행 결과가 없습니다.</strong>
          <p>벤치마크 러너를 실행하면 웨이브 도달률, 코어 체력 추이와 회차별 데이터가 이곳에 누적됩니다.</p>
        </div>
      ) : (
        <>
          <div className="benchmark-kpis">
            <div><span>W20 완료율</span><strong>{benchmarkCompletionRate.toFixed(0)}%</strong></div>
            <div><span>평균 도달</span><strong>W{botAverageWave.toFixed(1)}</strong></div>
            <div><span>평균 점수</span><strong>{Math.round(benchmarkAverageScore).toLocaleString("ko-KR")}</strong></div>
            <div><span>평균 파괴</span><strong>{benchmarkAverageBricks.toFixed(1)}</strong></div>
            <div><span>평균 콤보</span><strong>{benchmarkAverageCombo.toFixed(1)}</strong></div>
            <div><span>평균 잔여 코어</span><strong>{benchmarkAverageCore.toFixed(1)}</strong></div>
          </div>

          <div className="benchmark-charts">
            <article className="benchmark-chart-card">
              <header>
                <div><span>WAVE REACH RATE</span><strong>웨이브 도달률</strong></div>
                <b>{benchmarkCompletionRate.toFixed(0)}% COMPLETE</b>
              </header>
              <svg viewBox="0 0 600 174" role="img" aria-label="웨이브별 도달률 그래프">
                {[0, 50, 100].map((value) => (
                  <g key={value}>
                    <line x1="34" x2="576" y1={144 - (value / 100) * 126} y2={144 - (value / 100) * 126} />
                    <text x="5" y={148 - (value / 100) * 126}>{value}%</text>
                  </g>
                ))}
                {[1, 5, 10, 15, 20].map((wave) => (
                  <text key={wave} x={chartX(wave - 1)} y="166" textAnchor="middle">W{wave}</text>
                ))}
                <polyline className="reach-line" points={reachPoints} />
                {benchmarkWaveStats.map((item, index) => (
                  <circle key={item.wave} className="reach-dot" cx={chartX(index)} cy={18 + ((100 - item.reachRate) / 100) * 126}>
                    <title>W{item.wave} · {item.reachRate.toFixed(0)}%</title>
                  </circle>
                ))}
              </svg>
            </article>

            <article className="benchmark-chart-card core-chart">
              <header>
                <div><span>CORE HP BY WAVE</span><strong>도달 시 평균 코어 체력</strong></div>
                <b>{benchmarkAverageCore.toFixed(1)} FINAL</b>
              </header>
              <svg viewBox="0 0 600 174" role="img" aria-label="웨이브별 평균 코어 체력 그래프">
                {[0, 4, 8].map((value) => (
                  <g key={value}>
                    <line x1="34" x2="576" y1={144 - (value / maxCoreHp) * 126} y2={144 - (value / maxCoreHp) * 126} />
                    <text x="15" y={148 - (value / maxCoreHp) * 126}>{value}</text>
                  </g>
                ))}
                {[1, 5, 10, 15, 20].map((wave) => (
                  <text key={wave} x={chartX(wave - 1)} y="166" textAnchor="middle">W{wave}</text>
                ))}
                <polyline className="core-line" points={corePoints} />
                {benchmarkWaveStats.map((item, index) => (
                  <circle key={item.wave} className="core-dot" cx={chartX(index)} cy={18 + (1 - Math.min(1, item.averageCore / maxCoreHp)) * 126}>
                    <title>W{item.wave} · CORE {item.averageCore.toFixed(1)}</title>
                  </circle>
                ))}
              </svg>
            </article>
          </div>

          {timeoutResults.length > 0 && (
            <div className="benchmark-timeout-section">
              <div className="benchmark-timeout-heading">
                <div><span>TIMEOUT FORENSICS</span><strong>1800초 정체 원인 분석</strong></div>
                <small>동일 시드로 재실행하면 같은 상황을 재현할 수 있습니다.</small>
              </div>
              <div className="benchmark-timeout-summary">
                <div><span>TIMEOUT</span><strong>{timeoutResults.length}</strong></div>
                <div><span>TOP CAUSE</span><strong>{timeoutCauseCounts[0] ? timeoutCauseLabels[timeoutCauseCounts[0][0] as HeadlessTimeoutDiagnostic["classification"]] : "진단 대기"}</strong></div>
                <div><span>TOP WAVE</span><strong>{timeoutWaveCounts[0] ? `W${timeoutWaveCounts[0][0]} · ${timeoutWaveCounts[0][1]}회` : "-"}</strong></div>
                <div><span>DIAGNOSED</span><strong>{diagnosedTimeoutResults.length}/{timeoutResults.length}</strong></div>
              </div>
              {diagnosedTimeoutResults.length > 0 ? (
                <div className="benchmark-timeout-table" role="table" aria-label="타임아웃 원인 진단">
                  <div className="benchmark-timeout-head" role="row">
                    <span>RUN / SEED</span><span>WAVE TIME</span><span>CAUSE</span><span>REMAIN</span><span>NO DAMAGE</span><span>30s DMG</span><span>REFLECT</span><span>TARGET / LOOP</span>
                  </div>
                  {[...diagnosedTimeoutResults].reverse().slice(0, 20).map((item) => {
                    const diagnostic = item.timeoutDiagnostic!;
                    const traitSummary = Object.entries(diagnostic.remainingTraits).map(([trait, count]) => `${trait} ${count}`).join(" · ");
                    return (
                      <div key={item.id} role="row" title={diagnostic.remainingBricks.map((brick) => `#${brick.id} ${brick.trait} HP ${brick.hp}/${brick.maxHp} @ ${brick.x},${brick.y}`).join("\n")}>
                        <strong>#{item.run}<small>SEED {item.seed ?? "-"}</small></strong>
                        <span>W{diagnostic.stuckWave}<small>{diagnostic.waveElapsed.toFixed(1)}s</small></span>
                        <b data-cause={diagnostic.classification}>{timeoutCauseLabels[diagnostic.classification]}</b>
                        <span>{diagnostic.remainingBrickCount} · HP {diagnostic.remainingHp}<small>{traitSummary || "-"}</small></span>
                        <span>{diagnostic.secondsSinceLastDamage.toFixed(1)}s</span>
                        <span>{diagnostic.damageLast30Seconds.toFixed(1)}</span>
                        <span>{diagnostic.reflectorBlockedHits}<small>BANK {diagnostic.bankPhase}</small></span>
                        <span>{diagnostic.lastTargetKey}<small>CHANGE {diagnostic.targetChanges} · LOOP {diagnostic.maxTrajectoryRepeats}</small></span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="benchmark-timeout-legacy">기존 결과에는 진단 정보가 없습니다. 새 HEADLESS 벤치마크부터 원인이 기록됩니다.</p>
              )}
            </div>
          )}

          <div className="benchmark-skill-section">
            <div className="benchmark-skill-heading">
              <div><span>SKILL IMPACT</span><strong>선택 스킬별 성과</strong></div>
              <small>발동·피해·처치는 새 측정 결과부터 집계됩니다.</small>
            </div>
            <div className="benchmark-skill-table" role="table" aria-label="스킬별 벤치마크 성과">
              <div className="benchmark-skill-head" role="row">
                <span>SKILL</span><span>PICKS</span><span>AVG LV</span><span>W20 CLEAR</span><span>AVG WAVE</span><span>ACT</span><span>DAMAGE</span><span>KILLS</span>
              </div>
              {benchmarkSkillStats.map((skill) => (
                <div key={skill.id} role="row">
                  <strong style={{ color: skill.color }}>{skill.name}</strong>
                  <span>{skill.picks}</span>
                  <span>{skill.averageLevel.toFixed(1)}</span>
                  <span>{skill.clearRate.toFixed(0)}%</span>
                  <span>W{skill.averageWave.toFixed(1)}</span>
                  <span>{skill.activations}</span>
                  <span>{Math.round(skill.damage)}</span>
                  <span>{skill.kills}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="benchmark-data-table" role="table" aria-label="벤치마크 회차별 결과">
            <div className="benchmark-data-head" role="row">
              <span>RUN</span><span>RESULT</span><span>TIME</span><span>SCORE</span><span>BRICKS</span><span>COMBO</span><span>MAX BALLS</span><span>CORE</span><span>START</span><span>BUILD</span>
            </div>
            {benchmarkTableResults.map((item) => (
              <div key={item.id} role="row">
                <strong>#{item.run}</strong>
                <span>{item.evaluationComplete ? "W20 CLEAR" : item.terminationReason === "timeout" ? `W${item.wave} TIMEOUT` : `W${item.wave} STOP`}</span>
                <span>{item.elapsed.toFixed(1)}s</span>
                <span>{Math.round(item.score).toLocaleString("ko-KR")}</span>
                <span>{item.bricks}</span>
                <span>{item.maxCombo}</span>
                <span>{item.maxBalls}</span>
                <span>{item.coreHp}/{maxCoreHp}</span>
                <span>{item.startingSkills.map((id) => activeSkillMap[id]?.name ?? id).join(" + ") || "-"}</span>
                <span>{item.upgrades.length}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
