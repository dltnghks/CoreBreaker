"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { applyWaveDefinitions, MAX_WAVE_ROWS, normalizeWaveDefinitions, resetWaveDefinitions, WAVE_CELL_TYPES, WAVE_COLUMNS, WAVE_DEFINITIONS, WAVE_STORAGE_KEY, type WaveDefinition } from "../wave-config";
import styles from "./stage-lab.module.css";

const CELL_INFO: Record<string, { label: string; color: string }> = {
  ".": { label: "빈칸", color: "#242936" }, n: { label: "일반", color: "#6e88a8" }, h: { label: "고체력", color: "#b98c5f" },
  g: { label: "가드", color: "#dfc76d" }, e: { label: "폭발", color: "#e76f60" }, x: { label: "파괴 불가", color: "#636775" },
  c: { label: "회복", color: "#6cc99a" }, r: { label: "반사", color: "#62c9e8" },
};

const cloneWaves = (waves: WaveDefinition[]) => waves.map((wave) => ({ ...wave, pattern: [...wave.pattern], blocks: wave.blocks?.map((block) => ({ ...block })) }));

export default function StageLabPage() {
  const [draft, setDraft] = useState<WaveDefinition[]>(() => cloneWaves(WAVE_DEFINITIONS));
  const [selectedWave, setSelectedWave] = useState(1);
  const [brush, setBrush] = useState<(typeof WAVE_CELL_TYPES)[number]>("n");
  const [message, setMessage] = useState("변경 사항은 저장·적용 전까지 게임에 반영되지 않습니다.");

  useEffect(() => {
    const saved = localStorage.getItem(WAVE_STORAGE_KEY);
    if (!saved) return;
    try {
      setDraft(normalizeWaveDefinitions(JSON.parse(saved)));
      setMessage("현재 게임에 적용된 저장 스테이지를 불러왔습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? `저장 데이터 오류: ${error.message}` : "저장 데이터를 읽을 수 없습니다.");
    }
  }, []);

  const current = draft[selectedWave - 1];
  const validation = useMemo(() => {
    try { normalizeWaveDefinitions(draft); return { valid: true, error: "20개 웨이브 검증 완료" }; }
    catch (error) { return { valid: false, error: error instanceof Error ? error.message : "검증 실패" }; }
  }, [draft]);

  const updateCurrent = (change: Partial<WaveDefinition>) => setDraft((waves) => waves.map((wave) => wave.wave === selectedWave ? { ...wave, ...change } : wave));
  const paintCell = (rowIndex: number, colIndex: number) => {
    if (current.boss) return;
    const rows = [...current.pattern];
    const cells = [...rows[rowIndex]];
    const start = Math.floor(colIndex / 2) * 2;
    cells[start] = brush;
    cells[start + 1] = brush;
    rows[rowIndex] = cells.join("");
    updateCurrent({ pattern: rows });
  };
  const addRow = () => {
    if (current.boss || current.pattern.length >= MAX_WAVE_ROWS) return;
    updateCurrent({ pattern: [...current.pattern, ".".repeat(WAVE_COLUMNS)] });
  };
  const removeRow = () => {
    if (current.boss || current.pattern.length <= 1) return;
    updateCurrent({ pattern: current.pattern.slice(0, -1) });
  };
  const saveAndApply = () => {
    try {
      const normalized = normalizeWaveDefinitions(draft);
      localStorage.setItem(WAVE_STORAGE_KEY, JSON.stringify({ version: 1, waves: normalized }));
      applyWaveDefinitions(normalized);
      setDraft(normalized);
      setMessage("저장 완료. 게임과 새 벤치마크 실행에 적용됩니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "저장 실패"); }
  };
  const resetDraft = () => { setDraft(cloneWaves(WAVE_DEFINITIONS)); setMessage("기본 스테이지를 초안에 불러왔습니다. 아직 적용되지 않았습니다."); };
  const applyDefaults = () => { localStorage.removeItem(WAVE_STORAGE_KEY); resetWaveDefinitions(); setDraft(cloneWaves(WAVE_DEFINITIONS)); setMessage("저장된 편집값을 제거하고 기본 스테이지를 적용했습니다."); };
  const exportJson = () => {
    if (!validation.valid) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, waves: draft }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "core-breaker-stages.json"; link.click(); URL.revokeObjectURL(url);
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    try { setDraft(normalizeWaveDefinitions(JSON.parse(await file.text()))); setMessage("JSON을 초안으로 가져왔습니다. 저장·적용을 눌러야 게임에 반영됩니다."); }
    catch (error) { setMessage(error instanceof Error ? `가져오기 실패: ${error.message}` : "가져오기 실패"); }
  };

  return <main className={styles.shell}>
    <header className={styles.header}><div><p>CORE BREAKER // CANONICAL WAVE TOOL</p><h1>STAGE LAB</h1><span>실제 게임과 벤치마크가 사용하는 20웨이브 원본을 편집합니다.</span></div><nav><a href="/">GAME</a><a href="/benchmark">BENCHMARK</a><a href="/skill-lab">SKILL LAB</a></nav></header>
    <section className={styles.waveTabs} aria-label="웨이브 선택">{draft.map((wave) => <button key={wave.wave} type="button" className={selectedWave === wave.wave ? styles.active : ""} onClick={() => setSelectedWave(wave.wave)}><b>W{wave.wave}</b><span>{wave.name}</span>{wave.boss && <i>BOSS</i>}</button>)}</section>
    <section className={styles.workspace}>
      <aside className={styles.controls}>
        <label>웨이브 이름<input value={current.name} maxLength={40} onChange={(event) => updateCurrent({ name: event.target.value })} /></label>
        <label>체력 배율<input type="number" min="0.25" max="5" step="0.05" value={current.hpMultiplier} onChange={(event) => updateCurrent({ hpMultiplier: Number(event.target.value) })} /><small>기본 HP 계산 결과에 곱해집니다.</small></label>
        <div className={styles.palette}><strong>블록 브러시</strong>{WAVE_CELL_TYPES.map((cell) => <button key={cell} type="button" className={brush === cell ? styles.selectedBrush : ""} style={{ "--cell-color": CELL_INFO[cell].color } as CSSProperties} onClick={() => setBrush(cell)}><i>{cell === "." ? "·" : cell.toUpperCase()}</i><span>{CELL_INFO[cell].label}</span></button>)}</div>
        <div className={styles.rowActions}><button type="button" onClick={addRow} disabled={Boolean(current.boss) || current.pattern.length >= MAX_WAVE_ROWS}>행 추가</button><button type="button" onClick={removeRow} disabled={Boolean(current.boss) || current.pattern.length <= 1}>마지막 행 삭제</button></div>
        <p className={validation.valid ? styles.valid : styles.invalid}>{validation.error}</p>
      </aside>
      <div className={styles.editor}>
        <header><div><span>WAVE {current.wave}</span><h2>{current.name}</h2></div><b>HP × {current.hpMultiplier.toFixed(2)}</b></header>
        {current.boss ? <div className={styles.bossPreview}><strong>{current.boss === "final" ? "FINAL" : "MID"} CORE FORTRESS</strong><span>보스의 4×3 본체·공격 패턴은 게임 로직에서 생성됩니다.<br />이 탭에서는 이름과 전체 HP 배율을 편집할 수 있습니다.</span></div> : <div className={styles.grid} role="grid" aria-label={`Wave ${current.wave} 블록 배치`}>{current.pattern.map((row, rowIndex) => [...row].map((cell, colIndex) => <button key={`${rowIndex}-${colIndex}`} type="button" role="gridcell" aria-label={`${rowIndex + 1}행 ${colIndex + 1}열 ${CELL_INFO[cell].label}`} title={CELL_INFO[cell].label} data-cell={cell} style={{ "--cell-color": CELL_INFO[cell].color } as CSSProperties} onClick={() => paintCell(rowIndex, colIndex)}>{cell === "." ? "" : cell.toUpperCase()}</button>))}</div>}
        <div className={styles.previewLabel}><span>LIVE PATTERN PREVIEW</span><small>{current.boss ? "PROCEDURAL BOSS" : `${current.pattern.length} ROWS · ${current.pattern.join("").replaceAll(".", "").length} BRICKS`}</small></div>
      </div>
    </section>
    <footer className={styles.footer}><p aria-live="polite">{message}</p><div><button type="button" onClick={resetDraft}>기본값을 초안에 불러오기</button><button type="button" onClick={applyDefaults}>기본값 즉시 적용</button><label>JSON 가져오기<input type="file" accept="application/json,.json" onChange={(event) => void importJson(event.target.files?.[0])} /></label><button type="button" onClick={exportJson} disabled={!validation.valid}>JSON 내보내기</button><button type="button" className={styles.save} onClick={saveAndApply} disabled={!validation.valid}>저장·게임 적용</button></div></footer>
  </main>;
}
